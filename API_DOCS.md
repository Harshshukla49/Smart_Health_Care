# Smart Health Backend API Documentation

## Base URL
```
http://127.0.0.1:5000
```
**Port**: 5000 (Flask default)
**Server**: Run `python app.py` to start

## Heart Disease Prediction Endpoint

### `POST /predict`

**Purpose**: Predict heart disease risk using ML model trained on heart disease dataset.

**Request Body**: JSON object with **exactly 11 required fields**:

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `Age` | number | ✅ | Patient age | `40` |
| `Sex` | string | ✅ | M/F | `"M"` |
| `ChestPainType` | string | ✅ | ATA/TA/NAP/ASY | `"ATA"` |
| `RestingBP` | number | ✅ | Resting blood pressure (mm Hg) | `140` |
| `Cholesterol` | number | ✅ | Serum cholesterol (mg/dl) | `289` |
| `FastingBS` | number | ✅ | Fasting blood sugar (1=diabetic, 0=normal) | `0` |
| `RestingECG` | string | ✅ | Normal/ST/LV | `"Normal"` |
| `MaxHR` | number | ✅ | Maximum heart rate | `172` |
| `ExerciseAngina` | string | ✅ | Y/N | `"N"` |
| `Oldpeak` | number | ✅ | ST depression | `0.0` |
| `ST_Slope` | string | ✅ | Up/Flat/Down | `"Up"` |

**PowerShell Command (Windows)**:
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/predict" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{
  "Age": 40,
  "Sex": "M",
  "ChestPainType": "ATA",
  "RestingBP": 140,
  "Cholesterol": 289,
  "FastingBS": 0,
  "RestingECG": "Normal",
  "MaxHR": 172,
  "ExerciseAngina": "N",
  "Oldpeak": 0.0,
  "ST_Slope": "Up"
}'
```

**curl Command (Linux/Mac/WSL)**:
```bash
curl -X POST http://127.0.0.1:5000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "Age": 40,
    "Sex": "M",
    "ChestPainType": "ATA",
    "RestingBP": 140,
    "Cholesterol": 289,
    "FastingBS": 0,
    "RestingECG": "Normal",
    "MaxHR": 172,
    "ExerciseAngina": "N",
    "Oldpeak": 0.0,
    "ST_Slope": "Up"
  }'
```

### Example Response
**Success (200)**:
```json
{
  "prediction": "No Heart Disease",
  "probability": 0.85
}
```

**Error Examples**:
```json
// Missing field
{
  "error": "Missing required field: Age"
}

// Invalid data type
{
  "error": "Invalid input data",
  "message": "Field 'Age' must be numeric."
}

// No JSON
{
  "error": "No JSON data provided"
}
```

## Other Endpoints

### `GET /`
```json
{
  "status": "ok",
  "message": "Smart Healthcare Backend Running"
}
```

### `GET /health`
Health check with test prediction.

### `POST /predict` (Legacy Vitals Mode)
Also supports vitals-only prediction:
```json
{
  "heart_rate": 82,
  "spo2": 98,
  "temperature": 36.8
}
```
Returns: `{"status": "Normal"}` or `{"status": "Critical"}`

## Model Details
- **Model**: `heart_model.pkl` (scikit-learn)
- **Features**: 11 clinical features from heart disease dataset
- **Backend**: Flask + joblib + pandas + numpy

## Troubleshooting
- **PowerShell curl issues**: Use `Invoke-RestMethod` instead (above)
- **Model not loaded**: Ensure `heart_model.pkl` exists (run `train_heart_model.py`)
- **CORS errors**: Frontend handled by Flask-CORS
- **Port conflict**: Change `app.run(port=5001)`

## Testing
```bash
# Run tests
python -m pytest test_predict_api.py -v

# Start server
python app.py
