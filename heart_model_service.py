from __future__ import annotations

from functools import lru_cache
from numbers import Number
from pathlib import Path
from typing import Any

import pandas as pd
from joblib import load


ROOT_DIR = Path(__file__).resolve().parent
MODEL_PATH = ROOT_DIR / "heart_model.pkl"

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
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Trained model not found at {MODEL_PATH}")

    try:
        return load(MODEL_PATH)
    except Exception as e:
        import logging
        logging.error(f"Failed to load model from {MODEL_PATH}: {str(e)}. Falling back to rule-based prediction.")
        return None  # Will use legacy fallback in predict_status


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


def _extract_legacy_vitals(data: Any) -> dict[str, float] | None:
    source = _extract_payload(data)
    legacy = {}

    for key, value in source.items():
        canonical = FIELD_ALIASES.get(_canonical_key(str(key)), key)
        if canonical in {"heart_rate", "spo2", "temperature"}:
            legacy[canonical] = value

    if set(legacy.keys()) != {"heart_rate", "spo2", "temperature"}:
        return None

    try:
        return {
            "heart_rate": float(legacy["heart_rate"]),
            "spo2": float(legacy["spo2"]),
            "temperature": float(legacy["temperature"]),
        }
    except (TypeError, ValueError) as exc:
        raise ValueError("Fields 'heart_rate', 'spo2', and 'temperature' must be numeric.") from exc


def _predict_from_legacy_vitals(vitals: dict[str, float]) -> str:
    heart_rate = vitals["heart_rate"]
    spo2 = vitals["spo2"]
    temperature = vitals["temperature"]

    if heart_rate > 150 or spo2 < 90 or temperature > 40:
        return "Critical"

    return "Normal"


def _status_from_prediction(prediction: Any) -> str:
    if isinstance(prediction, Number):
        return "Critical" if float(prediction) >= 1 else "Normal"

    if isinstance(prediction, str):
        label = prediction.strip().lower()
        if label in {"critical", "risk", "disease", "positive", "heartdisease", "1", "true"}:
            return "Critical"

    return "Normal"


def predict_status(data: Any) -> str:
    legacy_vitals = _extract_legacy_vitals(data)
    if legacy_vitals is not None:
        return _predict_from_legacy_vitals(legacy_vitals)

    model = load_model()
    features = normalize_payload(data)
    frame = pd.DataFrame([[features[field] for field in REQUIRED_FIELDS]], columns=REQUIRED_FIELDS)
    prediction = model.predict(frame)[0]
    return _status_from_prediction(prediction)