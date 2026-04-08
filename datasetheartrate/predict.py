import joblib
import numpy as np
import pandas as pd
from pathlib import Path
import sys

# Paths relative to datasetheartrate/ directory
MODEL_PATH = Path("../heart_model.pkl")
DATA_PATH = Path("heart.csv")

def load_model():
    """Load the trained RandomForest pipeline model."""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found at {MODEL_PATH} (expected in parent directory)")
    return joblib.load(MODEL_PATH)

def load_and_prepare_data():
    """Load and prepare dataset exactly as in training."""
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Dataset not found: {DATA_PATH}")
    
    # Load raw data
    df = pd.read_csv(DATA_PATH)
    
    # Clean data (same as training script)
    df.columns = [col.strip() for col in df.columns]
    
    # Verify required columns exist
    required_cols = [
        "Age", "Sex", "ChestPainType", "RestingBP", "Cholesterol", 
        "FastingBS", "RestingECG", "MaxHR", "ExerciseAngina", 
        "Oldpeak", "ST_Slope", "HeartDisease"
    ]
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing columns: {missing_cols}")
    
    # Use first row as sample input
    sample_df = df[required_cols].iloc[[0]].copy()
    
    # Extract features (drop target)
    X_sample = sample_df.drop("HeartDisease", axis=1)
    
    print("Sample patient data:")
    print(X_sample.to_string(index=False))
    print("-" * 50)
    
    return X_sample

def main():
    try:
        # Load model pipeline (includes preprocessing)
        print("Loading trained model...")
        model = load_model()
        print("✓ Model loaded successfully")
        
        # Prepare sample data
        print("Loading dataset and preparing sample...")
        X_sample = load_and_prepare_data()
        print("✓ Sample data prepared")
        
        # Make prediction (pipeline handles all preprocessing automatically)
        prediction = model.predict(X_sample)[0]
        probability = model.predict_proba(X_sample)[0]
        
        print("Prediction result:")
        if prediction == 1:
            print("🔴 Heart Disease Detected")
            print(f"Risk probability: {probability[1]:.1%}")
        else:
            print("🟢 No Heart Disease")
            print(f"Risk probability: {probability[1]:.1%}")
            
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        print("Required files:", file=sys.stderr)
        print(f"  - heart_model.pkl (in parent directory)", file=sys.stderr)
        print(f"  - datasetheartrate/heart.csv", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
