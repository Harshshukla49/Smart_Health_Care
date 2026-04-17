from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split


FEATURE_COLUMNS = ["heart_rate", "spo2", "temperature"]
LABEL_COLUMN = "output"
VALID_LABELS = {"normal", "warning", "critical"}


def load_dataset(csv_path: Path) -> pd.DataFrame:
    if not csv_path.exists():
        raise FileNotFoundError(f"Dataset not found: {csv_path}")

    df = pd.read_csv(csv_path)
    required_columns = FEATURE_COLUMNS + [LABEL_COLUMN]
    missing_columns = [column for column in required_columns if column not in df.columns]
    if missing_columns:
        raise ValueError(f"Missing required dataset columns: {', '.join(missing_columns)}")

    df = df[required_columns].copy()
    for feature in FEATURE_COLUMNS:
        df[feature] = pd.to_numeric(df[feature], errors="coerce")

    df[LABEL_COLUMN] = df[LABEL_COLUMN].astype(str).str.strip().str.lower()
    df = df.dropna(subset=required_columns)
    df = df[df[LABEL_COLUMN].isin(VALID_LABELS)]

    if df.empty:
        raise ValueError("Dataset is empty after cleaning. Check input values and output labels.")

    return df


def train_vitals_model(csv_path: Path, model_output_path: Path) -> dict:
    df = load_dataset(csv_path)

    X = df[FEATURE_COLUMNS]
    y = df[LABEL_COLUMN]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=10,
        min_samples_leaf=2,
        random_state=42,
    )
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)
    report = classification_report(y_test, predictions)

    model_bundle = {
        "model": model,
        "feature_columns": FEATURE_COLUMNS,
        "label_column": LABEL_COLUMN,
        "classes": sorted(df[LABEL_COLUMN].unique().tolist()),
        "accuracy": float(accuracy),
    }
    joblib.dump(model_bundle, model_output_path)

    print(f"Dataset path: {csv_path}")
    print(f"Rows used: {len(df)}")
    print(f"Validation accuracy: {accuracy:.4f}")
    print("Classification report:")
    print(report)
    print(f"Saved model bundle: {model_output_path}")

    return model_bundle


if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent
    dataset_path = base_dir / "datasetheartrate" / "vitals_dataset.csv"
    model_path = base_dir / "vitals_model.pkl"
    train_vitals_model(dataset_path, model_path)