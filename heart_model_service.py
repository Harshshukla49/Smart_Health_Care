from __future__ import annotations

from functools import lru_cache
from numbers import Number
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from joblib import load


ROOT_DIR = Path(__file__).resolve().parent
MODEL_PATHS = [ROOT_DIR / "heart_model.pkl", ROOT_DIR / "model.pkl"]

NUMERIC_FIELDS = ["Age", "RestingBP", "Cholesterol", "FastingBS", "MaxHR", "Oldpeak"]
CATEGORICAL_FIELDS = ["Sex", "ChestPainType", "RestingECG", "ExerciseAngina", "ST_Slope"]
REQUIRED_FIELDS = NUMERIC_FIELDS + CATEGORICAL_FIELDS

FIELD_ALIASES = {
    "age": "Age",
    "restingbp": "RestingBP",
    "resting_blood_pressure": "RestingBP",
    "cholesterol": "Cholesterol",
    "fastingbs": "FastingBS",
    "fasting_bs": "FastingBS",
    "maxhr": "MaxHR",
    "max_hr": "MaxHR",
    "oldpeak": "Oldpeak",
    "sex": "Sex",
    "chestpaintype": "ChestPainType",
    "chest_pain_type": "ChestPainType",
    "restingecg": "RestingECG",
    "resting_ecg": "RestingECG",
    "exerciseangina": "ExerciseAngina",
    "exercise_angina": "ExerciseAngina",
    "st_slope": "ST_Slope",
    "stslope": "ST_Slope",
    "heartrate": "heart_rate",
    "heart_rate": "heart_rate",
    "spo2": "spo2",
    "temperature": "temperature",
}


@lru_cache(maxsize=1)
def load_model():
    for model_path in MODEL_PATHS:
        if not model_path.exists():
            continue

        try:
            return load(model_path)
        except Exception as e:
            import logging

            logging.error(f"Failed to load model from {model_path}: {str(e)}")

    raise FileNotFoundError(
        f"Trained heart model not found. Expected one of: {', '.join(str(path) for path in MODEL_PATHS)}"
    )


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
        raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")

    for field in NUMERIC_FIELDS:
        try:
            normalized[field] = float(normalized[field])
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Field '{field}' must be numeric.") from exc

    for field in CATEGORICAL_FIELDS:
        value = normalized[field]
        if value is None:
            raise ValueError(f"Field '{field}' cannot be empty.")
        normalized[field] = str(value).strip()
        if not normalized[field]:
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
    model = load_model()
    features = normalize_payload(data)
    frame = pd.DataFrame([[features[field] for field in REQUIRED_FIELDS]], columns=REQUIRED_FIELDS)

    raw_prediction = model.predict(frame)[0]
    status = _status_from_prediction(raw_prediction)
    confidence = round(_confidence_for_prediction(model, frame, raw_prediction), 4)
    risk = _risk_from_status(status)
    message = (
        "The trained ECG model detected a high-risk heart-disease pattern."
        if status == "Critical"
        else "The trained ECG model indicates no high-risk heart-disease pattern."
    )

    return {
        "prediction": status.lower(),
        "status": status,
        "risk": risk,
        "message": message,
        "confidence": confidence,
        "features": features,
    }


def predict_status(data: Any) -> str:
    return predict_heart_disease(data)["status"]