from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd
from joblib import dump
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


LOGGER = logging.getLogger("heart_model_trainer")
ROOT_DIR = Path(__file__).resolve().parent
PRIMARY_DATA_PATH = ROOT_DIR / "dataset" / "heart.csv"
FALLBACK_DATA_PATH = ROOT_DIR / "datasetheartrate" / "heart.csv"
MODEL_PATH = ROOT_DIR / "heart_model.pkl"
COMPAT_MODEL_PATH = ROOT_DIR / "model.pkl"
TARGET_COLUMN = "HeartDisease"
NUMERIC_COLUMNS = ["Age", "RestingBP", "Cholesterol", "FastingBS", "MaxHR", "Oldpeak"]
CATEGORICAL_COLUMNS = ["Sex", "ChestPainType", "RestingECG", "ExerciseAngina", "ST_Slope"]
EXPECTED_COLUMNS = NUMERIC_COLUMNS + CATEGORICAL_COLUMNS + [TARGET_COLUMN]
MISSING_MARKERS = ["", " ", "?", "NA", "N/A", "nan", "None"]
RANDOM_STATE = 42


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")


def _resolve_data_path() -> Path:
    for candidate in (PRIMARY_DATA_PATH, FALLBACK_DATA_PATH):
        if candidate.exists():
            return candidate

    raise FileNotFoundError(
        f"Could not find the dataset. Expected {PRIMARY_DATA_PATH} or {FALLBACK_DATA_PATH}."
    )


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    data = df.copy()
    data.columns = [column.strip() for column in data.columns]
    data = data.replace(MISSING_MARKERS, np.nan)

    missing_columns = [column for column in EXPECTED_COLUMNS if column not in data.columns]
    if missing_columns:
        raise ValueError(f"Dataset is missing required columns: {missing_columns}")

    for column in NUMERIC_COLUMNS + [TARGET_COLUMN]:
        data[column] = pd.to_numeric(data[column], errors="coerce")

    for column in CATEGORICAL_COLUMNS:
        data[column] = data[column].astype("string").str.strip()

    data = data.dropna(subset=[TARGET_COLUMN]).drop_duplicates().reset_index(drop=True)
    return data


def load_data() -> pd.DataFrame:
    data_path = _resolve_data_path()
    LOGGER.info("Loading dataset from %s", data_path)

    df = pd.read_csv(data_path)
    df = clean_data(df)

    LOGGER.info("Loaded %d rows and %d columns", df.shape[0], df.shape[1])
    LOGGER.info("Target distribution:\n%s", df[TARGET_COLUMN].value_counts(dropna=False).to_string())
    return df


def train_model(df: pd.DataFrame):
    features = df.drop(columns=[TARGET_COLUMN])
    target = df[TARGET_COLUMN].astype(int)

    LOGGER.info("Splitting dataset into train and test sets (80/20)")
    X_train, X_test, y_train, y_test = train_test_split(
        features,
        target,
        test_size=0.2,
        random_state=RANDOM_STATE,
        stratify=target,
    )

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numeric",
                Pipeline(steps=[("imputer", SimpleImputer(strategy="median"))]),
                NUMERIC_COLUMNS,
            ),
            (
                "categorical",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("encoder", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                CATEGORICAL_COLUMNS,
            ),
        ]
    )

    model = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "classifier",
                RandomForestClassifier(
                    n_estimators=200,
                    random_state=RANDOM_STATE,
                    n_jobs=-1,
                ),
            ),
        ]
    )

    LOGGER.info("Training RandomForestClassifier")
    model.fit(X_train, y_train)
    LOGGER.info("Training complete")
    return model, X_test, y_test


def evaluate_model(model, X_test: pd.DataFrame, y_test: pd.Series) -> dict:
    predictions = model.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)
    matrix = confusion_matrix(y_test, predictions)

    LOGGER.info("Accuracy: %.4f", accuracy)
    LOGGER.info("Confusion matrix:\n%s", matrix)

    return {
        "accuracy": accuracy,
        "confusion_matrix": matrix,
    }


def save_model(model, model_path: Path = MODEL_PATH) -> None:
    dump(model, model_path)
    dump(model, COMPAT_MODEL_PATH)
    LOGGER.info("Saved trained model to %s", model_path)
    LOGGER.info("Saved compatibility copy to %s", COMPAT_MODEL_PATH)


def main() -> None:
    configure_logging()
    df = load_data()
    model, X_test, y_test = train_model(df)
    evaluate_model(model, X_test, y_test)
    save_model(model)
    LOGGER.info("Heart disease model training finished successfully")


if __name__ == "__main__":
    main()