from __future__ import annotations

from functools import lru_cache
from numbers import Number
from pathlib import Path
from typing import Any
import logging
import traceback

import numpy as np
import pandas as pd
from joblib import load


ROOT_DIR = Path(__file__).resolve().parent
MODEL_PATH = ROOT_DIR / "model.pkl"

REQUIRED_FIELDS = [
    "Age",
    "Sex",
    "ChestPainType",
    "RestingBP",
    "Cholesterol",
    "FastingBS",
    "RestingECG",
    "MaxHR",
    "ExerciseAngina",
    "Oldpeak",
    "ST_Slope",
]
NUMERIC_FIELDS = ["Age", "RestingBP", "Cholesterol", "FastingBS", "MaxHR", "Oldpeak"]
CATEGORICAL_FIELDS = ["Sex", "ChestPainType", "RestingECG", "ExerciseAngina", "ST_Slope"]

LOGGER = logging.getLogger(__name__)

FIELD_ALIASES = {
    "age": "Age",
    "restingbp": "RestingBP",
    "resting_blood_pressure": "RestingBP",
    "bloodpressure": "RestingBP",
    "bp": "RestingBP",
    "cholesterol": "Cholesterol",
    "fastingbs": "FastingBS",
    "fasting_bs": "FastingBS",
    "fastingbloodsugar": "FastingBS",
    "maxhr": "MaxHR",
    "max_hr": "MaxHR",
    "heartrate": "MaxHR",
    "heart_rate": "MaxHR",
    "pulse": "MaxHR",
    "oldpeak": "Oldpeak",
    "sex": "Sex",
    "gender": "Sex",
    "chestpaintype": "ChestPainType",
    "chest_pain_type": "ChestPainType",
    "pain_type": "ChestPainType",
    "restingecg": "RestingECG",
    "resting_ecg": "RestingECG",
    "ecg": "RestingECG",
    "exerciseangina": "ExerciseAngina",
    "exercise_angina": "ExerciseAngina",
    "angina": "ExerciseAngina",
    "st_slope": "ST_Slope",
    "stslope": "ST_Slope",
    "slope": "ST_Slope",
    "spo2": "spo2",
    "oxygen": "spo2",
    "o2": "spo2",
    "temperature": "temperature",
    "temp": "temperature",
}


@lru_cache(maxsize=1)
def load_model():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Trained heart model not found at {MODEL_PATH}")

    model = load(MODEL_PATH)
    LOGGER.info("Loaded trained model from %s", MODEL_PATH)

    if not hasattr(model, "predict"):
        raise TypeError(f"Loaded artifact from {MODEL_PATH} does not implement predict().")
    if not hasattr(model, "predict_proba"):
        raise TypeError(f"Loaded artifact from {MODEL_PATH} does not implement predict_proba().")

    feature_names = list(getattr(model, "feature_names_in_", []) or [])
    if feature_names and feature_names != REQUIRED_FIELDS:
        raise ValueError(
            "Feature order mismatch between model and training schema. "
            f"Expected {REQUIRED_FIELDS}, got {feature_names}"
        )

    if hasattr(model, "named_steps"):
        step_names = list(model.named_steps.keys())
        LOGGER.info("Model pipeline steps: %s", step_names)

        preprocessor = model.named_steps.get("preprocessor")
        if preprocessor is None:
          raise ValueError("Model pipeline is missing the preprocessor step.")

        fitted_transformers = getattr(preprocessor, "transformers_", None)
        if fitted_transformers:
            LOGGER.info(
                "Preprocessor transformers: %s",
                [(name, cols) for name, _, cols in fitted_transformers],
            )

        numeric_columns = list(next((cols for name, _, cols in getattr(preprocessor, "transformers", []) if name == "numeric"), []))
        categorical_columns = list(next((cols for name, _, cols in getattr(preprocessor, "transformers", []) if name == "categorical"), []))
        if numeric_columns and numeric_columns != NUMERIC_FIELDS:
            raise ValueError(f"Numeric feature order mismatch. Expected {NUMERIC_FIELDS}, got {numeric_columns}")
        if categorical_columns and categorical_columns != CATEGORICAL_FIELDS:
            raise ValueError(
                f"Categorical feature order mismatch. Expected {CATEGORICAL_FIELDS}, got {categorical_columns}"
            )

        categorical_step = getattr(getattr(preprocessor, "named_transformers_", {}), "get", lambda *_: None)("categorical")
        if categorical_step is not None and hasattr(categorical_step, "named_steps"):
            encoder = categorical_step.named_steps.get("encoder")
            if encoder is not None:
                LOGGER.info("OneHotEncoder categories: %s", [list(values) for values in getattr(encoder, "categories_", [])])

    return model


def _canonical_key(key: str) -> str:
    return key.strip().lower().replace(" ", "").replace("-", "").replace("_", "")


def _extract_payload(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object.")

    if isinstance(data.get("vitals"), dict):
        return data["vitals"]

    return data


def normalize_payload(data: Any) -> dict[str, Any]:
    source = _extract_payload(data)
    normalized: dict[str, Any] = {}

    for key, value in source.items():
        canonical = FIELD_ALIASES.get(_canonical_key(str(key)), key)
        if canonical in REQUIRED_FIELDS:
            normalized[canonical] = value


    missing_fields = [field for field in REQUIRED_FIELDS if field not in normalized]
    if missing_fields:
        import logging
        logging.error(f"Prediction error: Missing required fields: {', '.join(missing_fields)}. Payload: {data}")
        raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")


    for field in NUMERIC_FIELDS:
        try:
            normalized[field] = float(normalized[field])
        except (TypeError, ValueError) as exc:
            import logging
            logging.error(f"Prediction error: Field '{field}' must be numeric. Payload: {data}")
            raise ValueError(f"Field '{field}' must be numeric.") from exc


    for field in CATEGORICAL_FIELDS:
        value = normalized[field]
        if value is None:
            import logging
            logging.error(f"Prediction error: Field '{field}' cannot be empty. Payload: {data}")
            raise ValueError(f"Field '{field}' cannot be empty.")
        normalized[field] = str(value).strip()
        if not normalized[field]:
            import logging
            logging.error(f"Prediction error: Field '{field}' cannot be empty. Payload: {data}")
            raise ValueError(f"Field '{field}' cannot be empty.")

    return normalized


def _status_from_prediction(prediction: Any) -> str:
    if isinstance(prediction, Number):
        return "Critical" if float(prediction) >= 1 else "Normal"

    if isinstance(prediction, str):
        label = prediction.strip().lower()
        if label in {"critical", "risk", "disease", "positive", "heartdisease", "1", "true"}:
            return "Critical"

    return "Normal"


def _risk_from_status(status: str) -> str:
    return "High" if status == "Critical" else "Low"


def _confidence_for_prediction(model: Any, frame: pd.DataFrame, prediction: Any) -> float:
    if not hasattr(model, "predict_proba"):
        return 1.0

    probabilities = model.predict_proba(frame)[0]
    classes = list(getattr(model, "classes_", []) or [])

    if classes:
        for index, label in enumerate(classes):
            if str(label).strip().lower() == str(prediction).strip().lower():
                return float(probabilities[index])

    return float(np.max(probabilities))


def predict_heart_disease(data: Any) -> dict[str, Any]:
    try:
        model = load_model()
        features = normalize_payload(data)
        frame = pd.DataFrame([[features[field] for field in REQUIRED_FIELDS]], columns=REQUIRED_FIELDS)

        LOGGER.info("Feature vector before prediction: %s", frame.iloc[0].to_dict())

        raw_prediction = model.predict(frame)[0]
        LOGGER.info("Prediction output: %s", raw_prediction)

        probabilities = model.predict_proba(frame)[0]
        classes = list(getattr(model, "classes_", []) or [])
        if classes:
            probability_map = {str(label): float(probabilities[index]) for index, label in enumerate(classes)}
            LOGGER.info("Prediction probabilities: %s", probability_map)
        else:
            LOGGER.info("Prediction probabilities: %s", [float(value) for value in probabilities])

        confidence = _confidence_for_prediction(model, frame, raw_prediction) * 100
        confidence = round(float(confidence), 2)
        clinical_status = _status_from_prediction(raw_prediction)
        message = f"Model prediction completed successfully with class {clinical_status}."

        return {
            "status": "success",
            "risk": clinical_status,
            "prediction": str(raw_prediction),
            "prediction_status": clinical_status,
            "confidence": confidence,
            "message": message,
            "features": features,
        }
    except Exception:
        LOGGER.error("Heart model prediction failed:\n%s", traceback.format_exc())
        raise
def _risk_classification(score: int) -> str:
    if score <= 25:
        return "Normal"
    elif score <= 50:
        return "Warning"
    elif score <= 75:
        return "High Risk"
    else:
        return "Critical"

def _generate_medical_alerts(features: dict) -> list:
    alerts = []
    try:
        spo2 = float(features.get("spo2", 0))
        hr = float(features.get("MaxHR", 0))
        temp = float(features.get("temperature", 0))
        if spo2 < 80:
            alerts.append("SpO2 critically low (emergency)")
        elif spo2 < 90:
            alerts.append("SpO2 low (critical)")
        if hr > 140:
            alerts.append("Heart rate critical")
        elif hr > 120:
            alerts.append("Heart rate high risk")
        if temp > 38:
            alerts.append("Fever alert")
    except Exception:
        pass
    return alerts

def _alert_message(alerts: list, status: str) -> str:
    if alerts:
        return "; ".join(alerts)
    if status == "Critical":
        return "Immediate medical attention required"
    elif status == "Normal":
        return "Vitals within normal range"
    return "No critical alerts"


def predict_status(data: Any) -> str:
    return predict_heart_disease(data)["status"]