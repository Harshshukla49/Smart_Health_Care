import os
import random
import smtplib
import secrets
import string
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash
from twilio.rest import Client
import firebase_admin
from firebase_admin import credentials, db

import joblib
import numpy as np
import pandas as pd
from sensor_adapter import create_sensor_adapter

BASE_DIR = Path(__file__).resolve().parent
VITAL_FEATURE_COLUMNS = ["heart_rate", "spo2", "temperature"]
VITAL_MODEL_PATH = BASE_DIR / "model.pkl"
VITALS_DATASET_PATHS = [
    BASE_DIR / "datasetheartrate" / "vitals_dataset.csv",
    BASE_DIR / "datasetheartrate" / "heart.csv",
]

vitals_model = None
vitals_model_classes = []

if VITAL_MODEL_PATH.exists():
    try:
        model_bundle = joblib.load(VITAL_MODEL_PATH)
        if isinstance(model_bundle, dict):
            vitals_model = model_bundle.get("model")
            vitals_model_classes = list(model_bundle.get("classes", []) or [])
        else:
            vitals_model = model_bundle

        print(f"Loaded vitals model from {VITAL_MODEL_PATH}")
    except Exception as e:
        print(f"Failed to load vitals model from {VITAL_MODEL_PATH}: {e}")
else:
    print(f"Vitals model not found at {VITAL_MODEL_PATH}")

SPO2_MODEL_PATHS = [
    BASE_DIR / "spo2_model.pkl",
    BASE_DIR / "frontend" / "src" / "pages" / "spo2_dataset" / "spo2_model.pkl",
]

spo2_model = None
spo2_feature_columns = []
for candidate_path in SPO2_MODEL_PATHS:
    if not candidate_path.exists():
        continue

    try:
        spo2_model_data = joblib.load(candidate_path)
        if isinstance(spo2_model_data, dict):
            spo2_model = spo2_model_data.get("model")
            spo2_feature_columns = list(spo2_model_data.get("feature_columns", []) or [])
        else:
            spo2_model = spo2_model_data
            feature_names = getattr(spo2_model, "feature_names_in_", None)
            spo2_feature_columns = list(feature_names) if feature_names is not None else []

        print(f"Loaded SpO2 model from {candidate_path}")
        break
    except Exception as e:
        print(f"Failed to load SpO2 model from {candidate_path}: {e}")

# Load environment variables from .env file
load_dotenv()

# Initialize Flask app once
app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

dataset_vitals_rows = []
sensor_adapter = None


def _normalize_dataset_row(row):
    if row is None:
        return None

    lower_map = {str(key).strip().lower(): value for key, value in dict(row).items()}
    heart_rate = _coerce_float(
        lower_map.get("heart_rate")
        or lower_map.get("heartrate")
        or lower_map.get("hr")
        or lower_map.get("maxhr")
    )
    spo2 = _coerce_float(lower_map.get("spo2") or lower_map.get("sp02"), 97)
    temperature = _coerce_float(lower_map.get("temperature") or lower_map.get("temp"), 36.8)

    if heart_rate <= 0:
        return None

    return {
        "heart_rate": float(_clamp(heart_rate, 40, 180)),
        "spo2": float(_clamp(spo2, 70, 100)),
        "temperature": round(float(_clamp(temperature, 33, 43)), 1),
    }


def _load_vitals_dataset_rows():
    rows = []
    for dataset_path in VITALS_DATASET_PATHS:
        if not dataset_path.exists():
            continue

        try:
            frame = pd.read_csv(dataset_path)
            normalized = [
                _normalize_dataset_row(record)
                for record in frame.to_dict(orient="records")
            ]
            rows.extend([entry for entry in normalized if entry])
        except Exception as error:
            print(f"Failed to load dataset {dataset_path}: {error}")

    if rows:
        print(f"Loaded {len(rows)} vitals rows from dataset files")
    else:
        print("No usable vitals rows loaded from datasets")

    return rows


def _get_env(name, default=None):
    """Read env values safely and strip surrounding whitespace/quotes."""
    value = os.getenv(name, default)
    if value is None:
        return None
    value = str(value).strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
        value = value[1:-1].strip()
    return value

# ===== LOAD CREDENTIALS FROM ENVIRONMENT VARIABLES =====
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_FROM = os.getenv('TWILIO_PHONE_FROM')
PATIENT_PHONE = os.getenv('PATIENT_PHONE')

# Initialize Twilio client if credentials are available
twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

# Initialize Firebase
cred = credentials.Certificate("firebase_key.json")
firebase_admin.initialize_app(cred, {
    'databaseURL': os.getenv('FIREBASE_DATABASE_URL', 'https://smart-health-care-cd723-default-rtdb.asia-southeast1.firebasedatabase.app/')
})

# Email Configuration
EMAIL_SENDER = _get_env('EMAIL_SENDER')
EMAIL_USERNAME = _get_env('EMAIL_USERNAME') or EMAIL_SENDER
EMAIL_PASSWORD = _get_env('EMAIL_PASSWORD')
EMAIL_RECEIVER = _get_env('EMAIL_RECEIVER')
SMTP_SERVER = _get_env('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(_get_env('SMTP_PORT', '587'))
SMTP_USE_SSL = _get_env('SMTP_USE_SSL', 'false').lower() in ('1', 'true', 'yes', 'y', 'on')
AUTH_TOKEN_TTL_SECONDS = int(_get_env('AUTH_TOKEN_TTL_SECONDS', '43200'))
RESET_TOKEN_TTL_SECONDS = int(_get_env('RESET_TOKEN_TTL_SECONDS', '900'))
APP_ADMIN_SECRET = _get_env('APP_ADMIN_SECRET', '')
AUTH_SECRET = _get_env('APP_AUTH_SECRET') or _get_env('FLASK_SECRET_KEY') or 'smart-health-dev-secret'
auth_serializer = URLSafeTimedSerializer(AUTH_SECRET)


def send_html_email(to_email, subject, html_body):
    """Send HTML email with robust SMTP auth handling."""
    if not EMAIL_SENDER or not EMAIL_PASSWORD:
        return False, "Email service not configured. Set EMAIL_SENDER and EMAIL_PASSWORD in .env"

    message = MIMEMultipart('alternative')
    message['Subject'] = subject
    message['From'] = EMAIL_SENDER
    message['To'] = to_email
    message.attach(MIMEText(html_body, 'html'))

    server = None
    try:
        # Use SSL for port 465, STARTTLS for 587, or plain SMTP for custom setups.
        if SMTP_USE_SSL or SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT)
        else:
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
            server.ehlo()
            if SMTP_PORT == 587:
                server.starttls()
                server.ehlo()

        server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
        server.sendmail(EMAIL_SENDER, to_email, message.as_string())
        return True, None
    except smtplib.SMTPAuthenticationError:
        return False, "SMTP authentication failed. For Gmail, set EMAIL_PASSWORD to a Google App Password (not your normal Gmail password)."
    except Exception as e:
        return False, str(e)
    finally:
        if server:
            try:
                server.quit()
            except Exception:
                pass


@app.errorhandler(400)
def handle_bad_request(error):
    description = getattr(error, "description", None) or "Bad request"
    return jsonify({"error": "Bad request", "message": str(description)}), 400


@app.errorhandler(500)
def handle_internal_error(error):
    return jsonify({"error": "Internal server error", "message": "An unexpected error occurred."}), 500


@app.errorhandler(ValueError)
def handle_value_error(error):
    return jsonify({"error": "Invalid input", "message": str(error)}), 400


def _coerce_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _coerce_int(value, default=0):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return int(default)


def _clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


dataset_vitals_rows = _load_vitals_dataset_rows()
sensor_adapter = create_sensor_adapter(os.getenv('SENSOR_ADAPTER', 'simulated'), dataset_vitals_rows)


def _parse_vitals_payload(payload):
    if not isinstance(payload, dict):
        raise ValueError("Request body must be a JSON object.")

    heart_rate = payload.get("heart_rate")
    if heart_rate is None:
        heart_rate = payload.get("heartRate")

    spo2 = payload.get("spo2")
    temperature = payload.get("temperature")
    if temperature is None:
        temperature = payload.get("temp")

    missing = []
    if heart_rate is None:
        missing.append("heart_rate")
    if spo2 is None:
        missing.append("spo2")
    if temperature is None:
        missing.append("temperature")

    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")

    try:
        return {
            "heart_rate": float(heart_rate),
            "spo2": float(spo2),
            "temperature": float(temperature),
        }
    except (TypeError, ValueError) as exc:
        raise ValueError("Fields heart_rate, spo2, and temperature must be numeric.") from exc


def _predict_vitals(payload):
    if vitals_model is None:
        raise RuntimeError(
            "Vitals model is not loaded. Train it first with: venv\\Scripts\\python.exe model.py"
        )

    vitals = _parse_vitals_payload(payload)
    vector = np.array([[vitals[column] for column in VITAL_FEATURE_COLUMNS]], dtype=float)

    prediction_label = str(vitals_model.predict(vector)[0]).strip().lower()
    confidence = 1.0

    if hasattr(vitals_model, "predict_proba"):
        probabilities = vitals_model.predict_proba(vector)[0]
        best_index = int(np.argmax(probabilities))
        confidence = float(probabilities[best_index])

        if hasattr(vitals_model, "classes_"):
            prediction_label = str(vitals_model.classes_[best_index]).strip().lower()

    return {
        "prediction": prediction_label,
        "confidence": round(confidence, 4),
        "vitals": vitals,
    }


def _model_prediction_to_risk(prediction):
    normalized = str(prediction or "").strip().lower()
    if normalized in ("critical", "high"):
        return "High", "critical"
    if normalized in ("warning", "medium"):
        return "Medium", "warning"
    return "Low", "normal"


def _build_predict_response(vitals, model_result=None):
    if model_result:
        risk, prediction = _model_prediction_to_risk(model_result.get("prediction"))
        confidence = float(model_result.get("confidence", 0.0))
        if prediction == "critical":
            message = "Model indicates a high-risk pattern. Immediate intervention may be required."
        elif prediction == "warning":
            message = "Model indicates medium risk. Continue active monitoring."
        else:
            message = "Model indicates low risk with stable vitals."

        return {
            "risk": risk,
            "prediction": prediction,
            "status": prediction,
            "message": message,
            "confidence": round(confidence, 4),
            "vitals": vitals,
        }

    return {
        "risk": "Prediction unavailable",
        "prediction": "unavailable",
        "status": "unavailable",
        "message": "Prediction unavailable",
        "confidence": 0.0,
        "vitals": vitals,
    }


def predict_risk(vitals):
    parsed_vitals = _parse_vitals_payload(vitals)

    if vitals_model is None:
        return _build_predict_response(parsed_vitals, None)

    try:
        result = _predict_vitals(parsed_vitals)
        return _build_predict_response(parsed_vitals, result)
    except Exception:
        return _build_predict_response(parsed_vitals, None)


def _pick_dataset_vitals_row():
    if dataset_vitals_rows:
        return dict(random.choice(dataset_vitals_rows))

    return {
        "heart_rate": 80.0,
        "spo2": 97.0,
        "temperature": 36.8,
    }


def _patient_collection_reference():
    return db.reference('patient')


def _doctor_collection_reference():
    return db.reference('doctor')


def _password_reset_reference():
    return db.reference('password_resets')


def _issue_auth_token(payload):
    token = auth_serializer.dumps(payload)
    return {
        'token': token,
        'expiresIn': AUTH_TOKEN_TTL_SECONDS,
    }


def _read_auth_payload():
    auth_header = str(request.headers.get('Authorization') or '').strip()
    if not auth_header.lower().startswith('bearer '):
        return {}

    token = auth_header[7:].strip()
    if not token:
        return {}

    try:
        payload = auth_serializer.loads(token, max_age=AUTH_TOKEN_TTL_SECONDS)
        return payload if isinstance(payload, dict) else {}
    except (BadSignature, SignatureExpired):
        return {}


def _request_user_role():
    payload = _read_auth_payload()
    if payload.get('role'):
        return str(payload.get('role')).strip().lower()

    return str(request.headers.get('X-User-Role') or '').strip().lower()


def _request_patient_id():
    payload = _read_auth_payload()
    if payload.get('role') == 'patient' and payload.get('patientId'):
        return str(payload.get('patientId')).strip()

    return str(request.headers.get('X-Patient-Id') or '').strip()


def _request_doctor_id(payload=None):
    auth_payload = _read_auth_payload()
    if auth_payload.get('role') == 'doctor' and auth_payload.get('email'):
        return str(auth_payload.get('email')).strip().lower()

    if isinstance(payload, dict):
        from_payload = payload.get('doctorId') or payload.get('doctorEmail')
        if from_payload:
            return str(from_payload).strip().lower()

    for key in ('X-Doctor-Email', 'X-User-Email'):
        value = request.headers.get(key)
        if value:
            return str(value).strip().lower()

    return ''


def _request_doctor_phone(payload=None):
    auth_payload = _read_auth_payload()
    if auth_payload.get('role') == 'doctor' and auth_payload.get('phone'):
        return str(auth_payload.get('phone')).strip()

    if isinstance(payload, dict):
        from_payload = payload.get('doctorPhone') or payload.get('phone')
        if from_payload:
            return str(from_payload).strip()

    value = request.headers.get('X-Doctor-Phone')
    if value:
        return str(value).strip()

    return ''


def _doctor_owns_record(record, doctor_id):
    if not doctor_id:
        return False

    owner = str((record or {}).get('doctorId') or '').strip().lower()
    return bool(owner) and owner == doctor_id


def _generate_patient_id():
    year = datetime.now().year
    collection = _patient_collection_reference()

    for _ in range(25):
        candidate = f"PAT-{year}-{secrets.randbelow(10000):04d}"
        if not collection.child(candidate).get():
            return candidate

    return f"PAT-{year}-{int(datetime.now().timestamp())}"


def _generate_secure_password(length=12):
    length = max(10, int(length))
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"

    # Ensure generated credentials always include upper/lower/digit/symbol.
    required = [
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%^&*"),
    ]
    remaining = [secrets.choice(alphabet) for _ in range(length - len(required))]
    password_chars = required + remaining
    secrets.SystemRandom().shuffle(password_chars)
    return ''.join(password_chars)


def _sanitize_patient_response(record):
    cleaned = dict(record or {})
    cleaned.pop('password', None)
    return cleaned


def _normalize_reading(payload):
    timestamp = payload.get('timestamp') or payload.get('updatedAt')
    if not timestamp:
        timestamp = datetime.now(timezone.utc).isoformat()

    return {
        'timestamp': timestamp,
        'heart_rate': _coerce_float(payload.get('heart_rate') or payload.get('heartRate')),
        'spo2': _coerce_float(payload.get('spo2') or payload.get('SpO2')),
        'temperature': _coerce_float(payload.get('temperature') or payload.get('temp')),
    }


def _normalize_patient_record(patient_id, payload, existing_record=None):
    nested_vitals = payload.get('vitals') if isinstance(payload.get('vitals'), dict) else {}
    heart_rate = _coerce_float(
        payload.get('heart_rate')
        or payload.get('heartRate')
        or payload.get('hr')
        or nested_vitals.get('heartRate')
        or nested_vitals.get('heart_rate')
    )
    spo2 = _coerce_float(payload.get('spo2') or payload.get('SpO2') or nested_vitals.get('spo2'))
    temperature = _coerce_float(payload.get('temperature') or payload.get('temp') or nested_vitals.get('temperature'))

    stored_prediction = payload.get('prediction') if isinstance(payload.get('prediction'), dict) else {}
    if not stored_prediction and existing_record and isinstance(existing_record.get('prediction'), dict):
        stored_prediction = existing_record.get('prediction')

    prediction = {
        'risk': stored_prediction.get('risk') or payload.get('risk') or 'Prediction unavailable',
        'message': stored_prediction.get('message') or payload.get('message') or 'Prediction unavailable',
        'status': stored_prediction.get('status') or payload.get('status') or stored_prediction.get('prediction') or 'unavailable',
        'confidence': _coerce_float(stored_prediction.get('confidence') or payload.get('predictionConfidence'), 0.0),
    }

    if prediction['status'] in ('', 'unavailable'):
        prediction_result = predict_risk({
            'heart_rate': heart_rate,
            'spo2': spo2,
            'temperature': temperature,
        })
        prediction = {
            'risk': prediction_result.get('risk', 'Prediction unavailable'),
            'message': prediction_result.get('message', 'Prediction unavailable'),
            'status': prediction_result.get('status', 'unavailable'),
            'confidence': _coerce_float(prediction_result.get('confidence'), 0.0),
        }

    prediction_audit = []
    if existing_record and isinstance(existing_record.get('predictionAudit'), list):
        prediction_audit.extend(existing_record.get('predictionAudit'))
    elif isinstance(payload.get('predictionAudit'), list):
        prediction_audit.extend(payload.get('predictionAudit'))

    readings = []
    if existing_record and isinstance(existing_record.get('readings'), list):
        readings.extend(existing_record['readings'])
    elif isinstance(payload.get('readings'), list):
        readings.extend(payload['readings'])

    readings.append(_normalize_reading({
        'heart_rate': heart_rate,
        'spo2': spo2,
        'temperature': temperature,
        'timestamp': payload.get('timestamp'),
        'updatedAt': payload.get('updatedAt'),
    }))

    record = {
        'id': patient_id,
        'patientId': patient_id,
        'name': payload.get('name') or 'Unnamed Patient',
        'age': _coerce_int(payload.get('age') or payload.get('Age')),
        'gender': payload.get('gender') or (existing_record or {}).get('gender') or '',
        'phone': payload.get('phone') or payload.get('phoneNumber') or (existing_record or {}).get('phone') or '',
        'email': payload.get('email') or (existing_record or {}).get('email') or '',
        'doctorId': str(payload.get('doctorId') or (existing_record or {}).get('doctorId') or '').strip().lower(),
        'doctorEmail': str(payload.get('doctorEmail') or (existing_record or {}).get('doctorEmail') or '').strip().lower(),
        'doctorPhone': str(payload.get('doctorPhone') or (existing_record or {}).get('doctorPhone') or '').strip(),
        'symptoms': payload.get('symptoms') or (existing_record or {}).get('symptoms') or '',
        'heartRate': heart_rate,
        'spo2': spo2,
        'temperature': temperature,
        'vitals': {
            'heartRate': heart_rate,
            'spo2': spo2,
            'temperature': temperature,
            'updatedAt': payload.get('updatedAt') or datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        },
        'status': prediction.get('status', 'unavailable'),
        'prediction': prediction,
        'predictionConfidence': prediction.get('confidence', 0.0),
        'deviceConnected': bool(payload.get('deviceConnected', (existing_record or {}).get('deviceConnected', False))),
        'dataSource': payload.get('dataSource') or (existing_record or {}).get('dataSource') or 'dataset',
        'updatedAt': payload.get('updatedAt') or datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'notes': payload.get('notes') or '',
        'password': payload.get('password') or (existing_record or {}).get('password') or '',
        'readings': readings[-10:],
        'predictionAudit': prediction_audit[-100:],
    }

    if payload.get('createdAt') or (existing_record and existing_record.get('createdAt')):
        record['createdAt'] = payload.get('createdAt') or existing_record.get('createdAt')

    return record


def _read_patient_records():
    try:
        raw = _patient_collection_reference().get()
        if not raw:
            return []

        if isinstance(raw, list):
            records = [record for record in raw if record]
            return [
                _normalize_patient_record(
                    record.get('id') or f"patient-{index}",
                    record,
                    record,
                )
                for index, record in enumerate(records)
            ]

        if isinstance(raw, dict):
            patients = []
            for key, value in raw.items():
                if not value:
                    continue
                record = dict(value)
                record.setdefault('id', key)
                patients.append(_normalize_patient_record(key, record, record))
            return patients
    except Exception as error:
        print(f'Failed to read patient records: {error}')

    return []


def _write_patient_record(patient_id, payload):
    reference = _patient_collection_reference().child(patient_id)
    existing = reference.get() or {}
    record = _normalize_patient_record(patient_id, payload, existing if isinstance(existing, dict) else None)
    reference.set(record)
    return record


def _build_patient_payload_response(patient_id, normalized):
    vitals = normalized.get('vitals') or {
        'heartRate': _coerce_float(normalized.get('heartRate')),
        'spo2': _coerce_float(normalized.get('spo2')),
        'temperature': _coerce_float(normalized.get('temperature')),
        'updatedAt': normalized.get('updatedAt'),
    }
    prediction = normalized.get('prediction') if isinstance(normalized.get('prediction'), dict) else {
        'risk': 'Prediction unavailable',
        'message': 'Prediction unavailable',
        'status': 'unavailable',
        'confidence': 0.0,
    }

    return {
        'id': patient_id,
        'name': normalized.get('name'),
        'vitals': vitals,
        'prediction': prediction,
        'deviceConnected': bool(normalized.get('deviceConnected', False)),
        'dataSource': normalized.get('dataSource') or 'dataset',
        'doctorContact': {
            'email': normalized.get('doctorEmail') or '',
            'phone': normalized.get('doctorPhone') or '',
        },
        'predictionAudit': normalized.get('predictionAudit', [])[-20:],
    }


def _append_prediction_audit(record, prediction, source, vitals):
    existing = list(record.get('predictionAudit') or [])
    existing.append({
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'source': source,
        'risk': prediction.get('risk', 'Prediction unavailable'),
        'status': prediction.get('status', 'unavailable'),
        'confidence': _coerce_float(prediction.get('confidence'), 0.0),
        'message': prediction.get('message', 'Prediction unavailable'),
        'vitals': {
            'heartRate': _coerce_float(vitals.get('heart_rate') or vitals.get('heartRate')),
            'spo2': _coerce_float(vitals.get('spo2')),
            'temperature': _coerce_float(vitals.get('temperature')),
        },
    })
    record['predictionAudit'] = existing[-100:]
    return record


def _patient_room(patient_id):
    return f"patient:{patient_id}"


def _stream_patient_updates(patient_id):
    while True:
        record = _patient_collection_reference().child(patient_id).get()
        if not isinstance(record, dict) or not record.get('deviceConnected'):
            break

        normalized = _normalize_patient_record(patient_id, record, record)
        next_vitals = sensor_adapter.get_next_vitals(patient_id, normalized.get('vitals') or {})
        prediction = predict_risk(next_vitals)

        with_audit = _append_prediction_audit(dict(normalized), prediction, str(next_vitals.get('source') or 'sensor-stream'), next_vitals)

        updated_record = _write_patient_record(patient_id, {
            **with_audit,
            'heart_rate': next_vitals['heart_rate'],
            'spo2': next_vitals['spo2'],
            'temperature': next_vitals['temperature'],
            'prediction': {
                'risk': prediction.get('risk'),
                'message': prediction.get('message'),
                'status': prediction.get('status'),
                'confidence': prediction.get('confidence'),
            },
            'deviceConnected': True,
            'dataSource': next_vitals.get('source') or 'sensor-stream',
            'updatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        })

        payload = _build_patient_payload_response(patient_id, updated_record)
        socketio.emit('patient_snapshot', {
            'patientId': patient_id,
            'data': payload,
        }, to=_patient_room(patient_id))
        socketio.emit('vitals_update', {
            'patientId': patient_id,
            'vitals': payload['vitals'],
        }, to=_patient_room(patient_id))
        socketio.emit('insights_update', {
            'patientId': patient_id,
            'prediction': payload['prediction'],
        }, to=_patient_room(patient_id))
        socketio.emit('device_status_update', {
            'patientId': patient_id,
            'deviceConnected': True,
            'dataSource': payload['dataSource'],
        }, to=_patient_room(patient_id))

        socketio.sleep(3)


@app.route('/admin/migrate-patient-ownership', methods=['POST'])
def migrate_patient_ownership():
    try:
        if not APP_ADMIN_SECRET:
            return jsonify({'status': 'error', 'message': 'APP_ADMIN_SECRET is not configured.'}), 500

        provided_secret = str(request.headers.get('X-Admin-Secret') or '').strip()
        if not provided_secret or provided_secret != APP_ADMIN_SECRET:
            return jsonify({'status': 'error', 'message': 'Unauthorized admin request.'}), 401

        data = request.get_json(silent=True) or {}
        doctor_email = str(data.get('doctorEmail') or '').strip().lower()
        patient_ids = data.get('patientIds') if isinstance(data.get('patientIds'), list) else []
        dry_run = bool(data.get('dryRun', False))

        if not doctor_email:
            return jsonify({'status': 'error', 'message': 'doctorEmail is required.'}), 400

        raw = _patient_collection_reference().get() or {}
        if not isinstance(raw, dict):
            return jsonify({'status': 'success', 'message': 'No patient records to migrate.', 'updated': 0, 'matched': 0, 'dryRun': dry_run})

        normalized_ids = {str(item).strip() for item in patient_ids if str(item).strip()}
        updated = 0
        matched = 0

        for key, value in raw.items():
            if not isinstance(value, dict):
                continue

            if normalized_ids and key not in normalized_ids:
                continue

            current_owner = str(value.get('doctorId') or '').strip().lower()
            if current_owner and current_owner != doctor_email:
                continue

            matched += 1
            if dry_run:
                continue

            payload = {
                **value,
                'doctorId': doctor_email,
                'doctorEmail': doctor_email,
                'updatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            }
            _patient_collection_reference().child(key).set(payload)
            updated += 1

        return jsonify({
            'status': 'success',
            'doctorEmail': doctor_email,
            'matched': matched,
            'updated': updated,
            'dryRun': dry_run,
        })
    except Exception as error:
        return jsonify({'status': 'error', 'message': str(error)}), 500


def _create_reset_token(user_type, user_key, email):
    token = secrets.token_urlsafe(24)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=RESET_TOKEN_TTL_SECONDS)
    _password_reset_reference().child(token).set({
        'token': token,
        'userType': user_type,
        'userKey': user_key,
        'email': str(email or '').strip().lower(),
        'createdAt': datetime.now(timezone.utc).isoformat(),
        'expiresAt': expires_at.isoformat(),
        'used': False,
    })
    return token


def _consume_reset_token(token, user_type, user_key, email):
    if not token:
        return False, 'Reset token is required.'

    token_ref = _password_reset_reference().child(token)
    token_data = token_ref.get()
    if not isinstance(token_data, dict):
        return False, 'Invalid reset token.'

    if token_data.get('used'):
        return False, 'Reset token has already been used.'

    expires_at_raw = str(token_data.get('expiresAt') or '').strip()
    if expires_at_raw:
        try:
            expires_at = datetime.fromisoformat(expires_at_raw)
            now_utc = datetime.now(timezone.utc)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if now_utc > expires_at:
                return False, 'Reset token has expired.'
        except Exception:
            return False, 'Reset token expiration is invalid.'

    if str(token_data.get('userType') or '') != str(user_type):
        return False, 'Reset token type mismatch.'

    if str(token_data.get('userKey') or '').strip().lower() != str(user_key or '').strip().lower():
        return False, 'Reset token user mismatch.'

    if str(token_data.get('email') or '').strip().lower() != str(email or '').strip().lower():
        return False, 'Reset token email mismatch.'

    token_ref.update({'used': True, 'usedAt': datetime.now(timezone.utc).isoformat()})
    return True, ''


@app.route('/doctor/signup', methods=['POST'])
def doctor_signup():
    try:
        data = request.get_json(silent=True) or {}
        email = str(data.get('email') or '').strip().lower()
        phone = str(data.get('phone') or '').strip()
        name = str(data.get('name') or '').strip() or email.split('@')[0]
        password = str(data.get('password') or '')

        if not email or not phone or len(password) < 6:
            return jsonify({'status': 'error', 'message': 'Name, email, phone, and password (min 6 chars) are required.'}), 400

        doctor_ref = _doctor_collection_reference().child(email.replace('.', ','))
        existing = doctor_ref.get()
        if existing:
            return jsonify({'status': 'error', 'message': 'Doctor account already exists for this email.'}), 409

        doctor_ref.set({
            'id': email,
            'name': name,
            'email': email,
            'phone': phone,
            'passwordHash': generate_password_hash(password),
            'createdAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        })

        auth = _issue_auth_token({
            'role': 'doctor',
            'email': email,
            'name': name,
            'phone': phone,
        })

        return jsonify({
            'status': 'success',
            'doctor': {'id': email, 'name': name, 'email': email, 'phone': phone},
            'auth': auth,
        })
    except Exception as error:
        return jsonify({'status': 'error', 'message': str(error)}), 500


@app.route('/doctor/login', methods=['POST'])
def doctor_login():
    try:
        data = request.get_json(silent=True) or {}
        email = str(data.get('email') or '').strip().lower()
        password = str(data.get('password') or '')

        if not email or not password:
            return jsonify({'status': 'error', 'message': 'Email and password are required.'}), 400

        doctor = _doctor_collection_reference().child(email.replace('.', ',')).get()
        if not doctor:
            return jsonify({'status': 'error', 'message': 'Invalid email or password.'}), 401

        password_hash = str((doctor or {}).get('passwordHash') or '')
        if not password_hash or not check_password_hash(password_hash, password):
            return jsonify({'status': 'error', 'message': 'Invalid email or password.'}), 401

        doctor_name = doctor.get('name') or email.split('@')[0]
        doctor_phone = doctor.get('phone') or ''
        auth = _issue_auth_token({
            'role': 'doctor',
            'email': email,
            'name': doctor_name,
            'phone': doctor_phone,
        })

        return jsonify({
            'status': 'success',
            'doctor': {
                'id': email,
                'name': doctor_name,
                'email': email,
                'phone': doctor_phone,
            },
            'auth': auth,
        })
    except Exception as error:
        return jsonify({'status': 'error', 'message': str(error)}), 500


@app.route('/doctor/reset-password/request', methods=['POST'])
def doctor_reset_password_request():
    data = request.get_json(silent=True) or {}
    email = str(data.get('email') or '').strip().lower()

    if not email:
        return jsonify({'status': 'error', 'message': 'Email is required.'}), 400

    doctor = _doctor_collection_reference().child(email.replace('.', ',')).get()
    if not doctor:
        return jsonify({'status': 'error', 'message': 'Doctor account not found for this email.'}), 404

    token = _create_reset_token('doctor', email, email)
    subject = 'Smart Health Doctor Password Reset'
    body = f'<p>Hello Doctor, use this reset token to change your password:</p><p><strong>{token}</strong></p>'
    send_html_email(email, subject, body)

    return jsonify({
        'status': 'success',
        'message': 'Password reset token sent to email.',
        'token': token,
        'expiresIn': RESET_TOKEN_TTL_SECONDS,
    })


@app.route('/doctor/reset-password/confirm', methods=['POST'])
def doctor_reset_password_confirm():
    data = request.get_json(silent=True) or {}
    email = str(data.get('email') or '').strip().lower()
    token = str(data.get('token') or '').strip()
    new_password = str(data.get('newPassword') or '')

    if not email or not token or len(new_password) < 6:
        return jsonify({'status': 'error', 'message': 'Email, token and new password (min 6 chars) are required.'}), 400

    ok, message = _consume_reset_token(token, 'doctor', email, email)
    if not ok:
        return jsonify({'status': 'error', 'message': message}), 400

    doctor_ref = _doctor_collection_reference().child(email.replace('.', ','))
    doctor = doctor_ref.get()
    if not doctor:
        return jsonify({'status': 'error', 'message': 'Doctor account not found.'}), 404

    doctor_ref.update({'passwordHash': generate_password_hash(new_password), 'updatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S')})
    return jsonify({'status': 'success', 'message': 'Doctor password reset successful.'})


@app.route('/patient/reset-password/request', methods=['POST'])
def patient_reset_password_request():
    data = request.get_json(silent=True) or {}
    patient_id = str(data.get('patientId') or '').strip()
    email = str(data.get('email') or '').strip().lower()

    if not patient_id or not email:
        return jsonify({'status': 'error', 'message': 'Patient ID and email are required.'}), 400

    record = _patient_collection_reference().child(patient_id).get()
    if not record:
        return jsonify({'status': 'error', 'message': 'Patient not found.'}), 404

    stored_email = str((record or {}).get('email') or '').strip().lower()
    if stored_email != email:
        return jsonify({'status': 'error', 'message': 'Email does not match this patient account.'}), 403

    token = _create_reset_token('patient', patient_id, email)
    subject = 'Smart Health Patient Password Reset'
    body = f'<p>Hello, use this reset token to change your patient password:</p><p><strong>{token}</strong></p>'
    send_html_email(email, subject, body)

    return jsonify({
        'status': 'success',
        'message': 'Password reset token sent to email.',
        'token': token,
        'expiresIn': RESET_TOKEN_TTL_SECONDS,
    })


@app.route('/patient/reset-password/confirm', methods=['POST'])
def patient_reset_password_confirm():
    data = request.get_json(silent=True) or {}
    patient_id = str(data.get('patientId') or '').strip()
    email = str(data.get('email') or '').strip().lower()
    token = str(data.get('token') or '').strip()
    new_password = str(data.get('newPassword') or '')

    if not patient_id or not email or not token or len(new_password) < 6:
        return jsonify({'status': 'error', 'message': 'Patient ID, email, token, and new password (min 6 chars) are required.'}), 400

    ok, message = _consume_reset_token(token, 'patient', patient_id, email)
    if not ok:
        return jsonify({'status': 'error', 'message': message}), 400

    patient_ref = _patient_collection_reference().child(patient_id)
    record = patient_ref.get()
    if not record:
        return jsonify({'status': 'error', 'message': 'Patient not found.'}), 404

    patient_ref.update({'password': new_password, 'updatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S')})
    return jsonify({'status': 'success', 'message': 'Patient password reset successful.'})

# ===== ALERT FUNCTIONS =====
def send_sms_alert(prediction, hr, spo2, temp):
    """Send SMS alert for critical condition"""
    if not twilio_client:
        print("⚠️ Twilio not configured. SMS not sent. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env")
        return False
    
    if not TWILIO_PHONE_FROM or not PATIENT_PHONE:
        print("⚠️ Twilio phone numbers not configured. Set TWILIO_PHONE_FROM and PATIENT_PHONE in .env")
        return False
    
    try:
        message_body = f"🚨 CRITICAL HEALTH ALERT!\nPrediction: {prediction}\nHR: {hr} bpm | SpO2: {spo2}% | Temp: {temp}°C\nImmediate medical attention required!"
        
        message = twilio_client.messages.create(
            body=message_body,
            from_=TWILIO_PHONE_FROM,
            to=PATIENT_PHONE
        )
        print(f"✅ SMS sent successfully! Message SID: {message.sid}")
        return True
    except Exception as e:
        print(f"❌ Error sending SMS: {str(e)}")
        return False

def send_email_alert(prediction, hr, spo2, temp):
    """Send email alert for critical condition"""
    if not EMAIL_SENDER or EMAIL_SENDER == 'your_email@gmail.com':
        print("⚠️ Email credentials not configured. Set EMAIL_SENDER, EMAIL_PASSWORD, and EMAIL_RECEIVER in .env")
        return False
    
    try:
        
        subject = "🚨 CRITICAL HEALTH CONDITION ALERT"
        
        body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <div style="background-color: #ff6b6b; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                    <h2 style="margin: 0;">🚨 CRITICAL HEALTH ALERT</h2>
                </div>
                <div style="padding: 20px; background-color: #f5f5f5; border-radius: 10px;">
                    <h3>Condition: {prediction}</h3>
                    <p><strong>Patient Vital Signs:</strong></p>
                    <ul style="list-style-type: none; padding: 0;">
                        <li>❤️ Heart Rate: <span style="color: #ff6b6b; font-weight: bold;">{hr} bpm</span></li>
                        <li>🫁 SpO2: <span style="color: #ff6b6b; font-weight: bold;">{spo2}%</span></li>
                        <li>🌡️ Temperature: <span style="color: #ff6b6b; font-weight: bold;">{temp}°C</span></li>
                    </ul>
                    <p style="color: #ff6b6b; font-weight: bold; font-size: 16px; margin-top: 20px;">
                        ⚠️ IMMEDIATE MEDICAL ATTENTION REQUIRED!
                    </p>
                </div>
                <div style="margin-top: 20px; padding: 15px; background-color: #e8e8e8; border-radius: 5px; font-size: 12px;">
                    <p>This is an automated alert from the Smart Health Dashboard.</p>
                    <p>Timestamp: Check your dashboard for real-time updates.</p>
                </div>
            </body>
        </html>
        """
        
        ok, err = send_html_email(EMAIL_RECEIVER, subject, body)
        if ok:
            print(f"✅ Email sent successfully to {EMAIL_RECEIVER}")
            return True
        print(f"❌ Error sending email: {err}")
        return False
    except Exception as e:
        print(f"❌ Error sending email: {str(e)}")
        return False


@app.route('/')
def home():
    return jsonify({"status": "ok", "message": "Smart Healthcare Backend Running"})

@app.route('/real-data', methods=['GET'])
def get_real_data():
    try:
        raw_data = _patient_collection_reference().get() or {}
        doctor_role = _request_user_role() == 'doctor'
        doctor_id = _request_doctor_id()

        if doctor_role and not doctor_id:
            return jsonify({
                "status": "error",
                "message": "Doctor identity is required."
            }), 400

        if isinstance(raw_data, dict):
            data = {
                patient_id: _sanitize_patient_response(record)
                for patient_id, record in raw_data.items()
                if record and (not doctor_role or _doctor_owns_record(record, doctor_id))
            }
        elif isinstance(raw_data, list):
            data = [
                _sanitize_patient_response(record)
                for record in raw_data
                if record and (not doctor_role or _doctor_owns_record(record, doctor_id))
            ]
        else:
            data = {}

        return jsonify({
            "status": "success",
            "data": data
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route('/patients', methods=['GET'])
def get_patients():
    patients = _read_patient_records()

    if _request_user_role() == 'doctor':
        doctor_id = _request_doctor_id()
        if not doctor_id:
            return jsonify({
                'status': 'error',
                'message': 'Doctor identity is required.',
            }), 400

        patients = [patient for patient in patients if _doctor_owns_record(patient, doctor_id)]

    return jsonify({
        'status': 'success',
        'patients': [_sanitize_patient_response(patient) for patient in patients],
    })


@app.route('/add-patient', methods=['POST'])
def add_patient():
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'JSON body is required.'
            }), 400

        payload = {
            'name': data.get('name'),
            'age': data.get('age') or data.get('Age'),
            'gender': data.get('gender'),
            'phone': data.get('phone') or data.get('phoneNumber'),
            'email': data.get('email'),
            'symptoms': data.get('symptoms'),
            'notes': data.get('notes') or '',
            'deviceConnected': False,
            'dataSource': 'dataset',
            'createdAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        }

        doctor_id = _request_doctor_id(data)
        doctor_phone = _request_doctor_phone(data)
        if not doctor_id:
            return jsonify({
                'status': 'error',
                'message': 'Doctor identity is required to create patient.',
            }), 400
        payload['doctorId'] = doctor_id
        payload['doctorEmail'] = doctor_id
        payload['doctorPhone'] = doctor_phone

        required_fields = ['name', 'age', 'gender', 'phone', 'email', 'symptoms']
        missing_fields = [field for field in required_fields if payload.get(field) in (None, '')]
        if missing_fields:
            return jsonify({
                'status': 'error',
                'message': f"Missing required fields: {', '.join(missing_fields)}"
            }), 400

        dataset_vitals = _pick_dataset_vitals_row()
        payload.update({
            'heart_rate': dataset_vitals['heart_rate'],
            'spo2': dataset_vitals['spo2'],
            'temperature': dataset_vitals['temperature'],
        })
        prediction = predict_risk(dataset_vitals)
        payload['prediction'] = {
            'risk': prediction.get('risk'),
            'message': prediction.get('message'),
            'status': prediction.get('status'),
            'confidence': prediction.get('confidence', 0.0),
        }
        payload['predictionAudit'] = [{
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'source': 'dataset-initialization',
            'risk': prediction.get('risk', 'Prediction unavailable'),
            'status': prediction.get('status', 'unavailable'),
            'confidence': _coerce_float(prediction.get('confidence'), 0.0),
            'message': prediction.get('message', 'Prediction unavailable'),
            'vitals': {
                'heartRate': float(dataset_vitals['heart_rate']),
                'spo2': float(dataset_vitals['spo2']),
                'temperature': float(dataset_vitals['temperature']),
            },
        }]

        patient_id = _generate_patient_id()
        generated_password = _generate_secure_password(12)
        payload['password'] = generated_password

        record = _write_patient_record(patient_id, payload)
        response_patient = _sanitize_patient_response(record)

        return jsonify({
            'status': 'success',
            'message': 'Patient created successfully.',
            'patient': response_patient,
            'credentials': {
                'patientId': patient_id,
                'password': generated_password,
            },
        })
    except Exception as error:
        return jsonify({
            'status': 'error',
            'message': str(error),
        }), 500


@app.route('/login-patient', methods=['POST'])
def login_patient():
    try:
        data = request.get_json(silent=True) or {}
        patient_id = str(data.get('patientId') or data.get('id') or '').strip()
        password = str(data.get('password') or '').strip()

        if not patient_id or not password:
            return jsonify({
                'status': 'error',
                'message': 'Patient ID and password are required.',
            }), 400

        record = _patient_collection_reference().child(patient_id).get()
        if not record:
            return jsonify({
                'status': 'error',
                'message': 'Invalid Patient ID or password.',
            }), 401

        stored_password = str((record or {}).get('password') or '')
        if stored_password != password:
            return jsonify({
                'status': 'error',
                'message': 'Invalid Patient ID or password.',
            }), 401

        normalized = _normalize_patient_record(patient_id, record, record)
        auth = _issue_auth_token({
            'role': 'patient',
            'patientId': patient_id,
            'name': normalized.get('name') or 'Patient',
            'email': normalized.get('email') or '',
        })
        return jsonify({
            'status': 'success',
            'message': 'Patient login successful.',
            'patient': _sanitize_patient_response(normalized),
            'auth': auth,
        })
    except Exception as error:
        return jsonify({
            'status': 'error',
            'message': str(error),
        }), 500


@app.route('/patient/<patient_id>', methods=['GET'])
def get_patient_by_id(patient_id):
    try:
        key = str(patient_id or '').strip()
        if not key:
            return jsonify({
                'status': 'error',
                'message': 'Patient ID is required.',
            }), 400

        record = _patient_collection_reference().child(key).get()
        if not record:
            return jsonify({
                'status': 'error',
                'message': 'Patient not found.',
            }), 404

        if _request_user_role() == 'patient':
            requester_patient_id = _request_patient_id()
            if not requester_patient_id or str(requester_patient_id) != str(key):
                return jsonify({
                    'status': 'error',
                    'message': 'Access denied for this patient record.',
                }), 403

        if _request_user_role() == 'doctor':
            doctor_id = _request_doctor_id()
            if not _doctor_owns_record(record, doctor_id):
                return jsonify({
                    'status': 'error',
                    'message': 'Access denied for this patient record.',
                }), 403

        normalized = _normalize_patient_record(key, record, record)
        return jsonify({
            'status': 'success',
            'patient': _sanitize_patient_response(normalized),
        })
    except Exception as error:
        return jsonify({
            'status': 'error',
            'message': str(error),
        }), 500


@app.route('/api/patient/<patient_id>', methods=['GET'])
def get_api_patient(patient_id):
    try:
        key = str(patient_id or '').strip()
        if not key:
            return jsonify({'status': 'error', 'message': 'Patient ID is required.'}), 400

        record = _patient_collection_reference().child(key).get()
        if not record:
            return jsonify({'status': 'error', 'message': 'Patient not found.'}), 404

        if _request_user_role() == 'patient':
            requester_patient_id = _request_patient_id()
            if not requester_patient_id or str(requester_patient_id) != str(key):
                return jsonify({'status': 'error', 'message': 'Access denied for this patient record.'}), 403

        if _request_user_role() == 'doctor':
            doctor_id = _request_doctor_id()
            if not _doctor_owns_record(record, doctor_id):
                return jsonify({'status': 'error', 'message': 'Access denied for this patient record.'}), 403

        if bool((record or {}).get('deviceConnected')):
            normalized_existing = _normalize_patient_record(key, record, record)
            return jsonify({
                'status': 'success',
                'message': 'Device already connected.',
                'data': _build_patient_payload_response(key, normalized_existing),
            })

        normalized = _normalize_patient_record(key, record, record)
        return jsonify({
            'status': 'success',
            'data': _build_patient_payload_response(key, normalized),
        })
    except Exception as error:
        return jsonify({'status': 'error', 'message': str(error)}), 500


@app.route('/connect-device/<patient_id>', methods=['POST'])
def connect_device(patient_id):
    try:
        key = str(patient_id or '').strip()
        if not key:
            return jsonify({'status': 'error', 'message': 'Patient ID is required.'}), 400

        record = _patient_collection_reference().child(key).get()
        if not record:
            return jsonify({'status': 'error', 'message': 'Patient not found.'}), 404

        if _request_user_role() == 'doctor':
            doctor_id = _request_doctor_id()
            if not _doctor_owns_record(record, doctor_id):
                return jsonify({'status': 'error', 'message': 'Access denied for this patient record.'}), 403

        normalized = _normalize_patient_record(key, record, record)
        updated = _write_patient_record(key, {
            **normalized,
            'deviceConnected': True,
            'dataSource': 'sensor-stream',
        })
        socketio.start_background_task(_stream_patient_updates, key)

        return jsonify({
            'status': 'success',
            'message': 'Device connected. Live updates started.',
            'data': _build_patient_payload_response(key, updated),
        })
    except Exception as error:
        return jsonify({'status': 'error', 'message': str(error)}), 500


@app.route('/disconnect-device/<patient_id>', methods=['POST'])
def disconnect_device(patient_id):
    try:
        key = str(patient_id or '').strip()
        if not key:
            return jsonify({'status': 'error', 'message': 'Patient ID is required.'}), 400

        record = _patient_collection_reference().child(key).get()
        if not record:
            return jsonify({'status': 'error', 'message': 'Patient not found.'}), 404

        if _request_user_role() == 'doctor':
            doctor_id = _request_doctor_id()
            if not _doctor_owns_record(record, doctor_id):
                return jsonify({'status': 'error', 'message': 'Access denied for this patient record.'}), 403

        normalized = _normalize_patient_record(key, record, record)
        updated = _write_patient_record(key, {
            **normalized,
            'deviceConnected': False,
            'dataSource': 'dataset',
        })
        socketio.emit('device_status_update', {
            'patientId': key,
            'deviceConnected': False,
            'dataSource': 'dataset',
        }, to=_patient_room(key))

        return jsonify({
            'status': 'success',
            'message': 'Device disconnected.',
            'data': _build_patient_payload_response(key, updated),
        })
    except Exception as error:
        return jsonify({'status': 'error', 'message': str(error)}), 500


@app.route('/api/patient/<patient_id>/prediction-audit', methods=['GET'])
def get_patient_prediction_audit(patient_id):
    try:
        key = str(patient_id or '').strip()
        if not key:
            return jsonify({'status': 'error', 'message': 'Patient ID is required.'}), 400

        record = _patient_collection_reference().child(key).get()
        if not record:
            return jsonify({'status': 'error', 'message': 'Patient not found.'}), 404

        if _request_user_role() == 'doctor':
            doctor_id = _request_doctor_id()
            if not _doctor_owns_record(record, doctor_id):
                return jsonify({'status': 'error', 'message': 'Access denied for this patient record.'}), 403

        normalized = _normalize_patient_record(key, record, record)
        return jsonify({
            'status': 'success',
            'patientId': key,
            'audit': list(normalized.get('predictionAudit') or [])[-100:],
        })
    except Exception as error:
        return jsonify({'status': 'error', 'message': str(error)}), 500


@app.route('/api/vitals/<patient_id>', methods=['GET'])
def get_patient_vitals(patient_id):
    try:
        key = str(patient_id or '').strip()
        if not key:
            return jsonify({
                'status': 'error',
                'message': 'Patient ID is required.',
            }), 400

        record = _patient_collection_reference().child(key).get()
        if record:
            if _request_user_role() == 'patient':
                requester_patient_id = _request_patient_id()
                if not requester_patient_id or str(requester_patient_id) != str(key):
                    return jsonify({'status': 'error', 'message': 'Access denied for this patient record.'}), 403

            normalized = _normalize_patient_record(key, record, record)
            return jsonify({
                'status': 'success',
                'data': {
                    'patientId': key,
                    'heartRate': _coerce_float((normalized.get('vitals') or {}).get('heartRate') or normalized.get('heartRate')),
                    'spo2': _coerce_float((normalized.get('vitals') or {}).get('spo2') or normalized.get('spo2')),
                    'temperature': _coerce_float((normalized.get('vitals') or {}).get('temperature') or normalized.get('temperature')),
                    'updatedAt': normalized.get('updatedAt') or datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                }
            })

        dataset_vitals = _pick_dataset_vitals_row()

        return jsonify({
            'status': 'success',
            'data': {
                'patientId': key,
                'heartRate': float(dataset_vitals['heart_rate']),
                'spo2': float(dataset_vitals['spo2']),
                'temperature': float(dataset_vitals['temperature']),
                'updatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            },
            'source': 'dataset'
        })
    except Exception as error:
        return jsonify({
            'status': 'error',
            'message': str(error),
        }), 500

# Test API
@app.route('/health', methods=['GET'])
def health():
    model_state = "ready" if vitals_model is not None else "missing"
    return jsonify({
        "status": "ok" if vitals_model is not None else "warning",
        "service": "flask-health-backend",
        "model": model_state,
        "classes": vitals_model_classes,
    }), 200 if vitals_model is not None else 503

@app.route('/test', methods=['GET'])
def test():
    data = {
        "status": "success",
        "message": "API is working",
        "data": {
            "heart_rate": 72,
            "spo2": 98,
            "temperature": 36.5
        }
    }
    return jsonify(data)

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json(silent=True)
        if data is None:
            return jsonify({"error": "No JSON data provided"}), 400

        vitals = _parse_vitals_payload(data)
        prediction = predict_risk(vitals)

        patient_id = str(data.get('patientId') or data.get('patient_id') or '').strip()
        if patient_id:
            record = _patient_collection_reference().child(patient_id).get()
            if isinstance(record, dict):
                normalized = _normalize_patient_record(patient_id, record, record)
                with_audit = _append_prediction_audit(dict(normalized), prediction, 'predict-api', vitals)
                _write_patient_record(patient_id, {
                    **with_audit,
                    'prediction': {
                        'risk': prediction.get('risk'),
                        'message': prediction.get('message'),
                        'status': prediction.get('status'),
                        'confidence': prediction.get('confidence', 0.0),
                    },
                })

        return jsonify(prediction)
    except ValueError as e:
        return jsonify({"error": "Invalid input", "message": str(e)}), 400
    except Exception as e:
        return jsonify({"error": "Prediction failed", "message": str(e)}), 500


@app.route('/patient/<patient_id>/monitor', methods=['GET'])
def monitor_patient(patient_id):
    try:
        key = str(patient_id or '').strip()
        if not key:
            return jsonify({"status": "error", "message": "Patient ID is required."}), 400

        record = _patient_collection_reference().child(key).get()
        if not record:
            return jsonify({"status": "error", "message": "Patient not found."}), 404

        normalized = _normalize_patient_record(key, record, record)
        inference = predict_risk({
            "heart_rate": normalized.get("heartRate"),
            "spo2": normalized.get("spo2"),
            "temperature": normalized.get("temperature"),
        })

        return jsonify({
            "status": "success",
            "patientId": key,
            "vitals": {
                "heart_rate": normalized.get("heartRate"),
                "spo2": normalized.get("spo2"),
                "temperature": normalized.get("temperature"),
                "updatedAt": normalized.get("updatedAt"),
            },
            "prediction": inference["status"],
            "confidence": inference["confidence"],
            "risk": inference["risk"],
            "message": inference["message"],
            "pollIntervalSeconds": 3,
        })
    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


def _build_spo2_input_vector(heart_rate, bp, temp):
    values = {
        "HeartRate": float(heart_rate),
        "BP": float(bp),
        "Temp": float(temp),
        "Heart Rate (bpm)": float(heart_rate),
        "Systolic Blood Pressure (mmHg)": float(bp),
        "Diastolic Blood Pressure (mmHg)": float(bp),
        "Body Temperature (°C)": float(temp),
    }

    if spo2_feature_columns:
        row = []
        for column in spo2_feature_columns:
            if column in values:
                row.append(values[column])
            elif "heart" in column.lower() and "rate" in column.lower():
                row.append(values["HeartRate"])
            elif "systolic" in column.lower() or "blood pressure" in column.lower() or column.lower() == "bp":
                row.append(values["BP"])
            elif "diastolic" in column.lower():
                row.append(values["BP"])
            elif "temp" in column.lower() or "temperature" in column.lower():
                row.append(values["Temp"])
            else:
                row.append(0.0)

        return np.array([row], dtype=float)

    if hasattr(spo2_model, "n_features_in_"):
        fallback_row = [values["HeartRate"], values["BP"], values["Temp"]]
        expected_features = int(spo2_model.n_features_in_)
        if expected_features > len(fallback_row):
            fallback_row.extend([0.0] * (expected_features - len(fallback_row)))
        else:
            fallback_row = fallback_row[:expected_features]
        return np.array([fallback_row], dtype=float)

    return np.array([[values["HeartRate"], values["BP"], values["Temp"]]], dtype=float)


def _get_first_present(data, candidates):
    for key in candidates:
        if key in data:
            return data[key]
    return None


@app.route('/predict_spo2', methods=['POST'])
@app.route('/predict-spo2', methods=['POST'])
def predict_spo2():
    print("Request received for /predict_spo2")

    try:
        if spo2_model is None:
            return jsonify({
                "error": "SpO2 model is not loaded",
                "message": "The trained SpO2 model could not be loaded at startup."
            }), 500

        data = request.get_json(silent=True)
        if not data:
            return jsonify({
                "error": "Invalid request",
                "message": "JSON body is required."
            }), 400

        heart_rate = _get_first_present(data, ["heart_rate", "HeartRate", "hr", "heartRate"])
        bp = _get_first_present(data, ["blood_pressure", "BP", "bp", "systolic_bp", "systolic"])
        temp = _get_first_present(data, ["temperature", "Temp", "temp", "body_temperature"])

        missing_fields = []
        if heart_rate is None:
            missing_fields.append("heart_rate")
        if temp is None:
            missing_fields.append("temperature")

        if missing_fields:
            return jsonify({
                "error": "Missing fields",
                "message": f"Missing required fields: {', '.join(missing_fields)}"
            }), 400

        heart_rate = float(heart_rate)
        # Blood pressure is optional for this endpoint contract.
        # If not provided, use a neutral default so older model feature sets still work.
        bp = float(bp) if bp is not None else 120.0
        temp = float(temp)

        input_vector = _build_spo2_input_vector(heart_rate, bp, temp)
        prediction = spo2_model.predict(input_vector)
        predicted_spo2 = float(prediction[0])

        print(f"Prediction result: {predicted_spo2}")
        return jsonify({"predicted_spo2": predicted_spo2})
    except ValueError as e:
        return jsonify({
            "error": "Invalid input",
            "message": str(e)
        }), 400
    except Exception as e:
        print(f"Error in /predict_spo2: {str(e)}")
        return jsonify({
            "error": "Prediction failed",
            "message": str(e)
        }), 500

@app.route('/reset-patient-password', methods=['POST'])
def reset_patient_password():
    """Send password reset email to patient"""
    import json
    import time
    from flask import request
    
    data = json.loads(request.data) if request.data else {}
    patient_id = data.get('patientId', '').strip().lower()
    target_email = data.get('email', '').strip().lower()
    
    if not patient_id or not target_email:
        return jsonify({
            "status": "error",
            "message": "Patient ID and email are required."
        }), 400
    
    if not EMAIL_SENDER or EMAIL_SENDER == 'your_email@gmail.com':
        return jsonify({
            "status": "error",
            "message": "Email service not configured. Contact administrator."
        }), 500
    
    try:
        reset_token = f"{patient_id}-{int(time.time())}"
        reset_link = f"http://localhost:3000/reset-password?token={reset_token}&email={target_email}"
        
        subject = "🔐 Smart Health - Password Reset Request"
        
        body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <div style="background-color: #3b82f6; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
                    <h2 style="margin: 0;">🔐 Password Reset Request</h2>
                </div>
                <div style="padding: 20px; background-color: #f5f5f5; border-radius: 10px;">
                    <p>Hello,</p>
                    <p>We received a request to reset your password for Patient ID: <strong>{patient_id}</strong></p>
                    <p>Click the button below to set a new password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{reset_link}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                            Reset Password
                        </a>
                    </div>
                    <p style="font-size: 12px; color: #666;">
                        Or copy this link: <a href="{reset_link}">{reset_link}</a>
                    </p>
                    <p style="font-size: 12px; color: #666; margin-top: 30px;">
                        If you did not request this, please ignore this email. Your account will remain secure.
                    </p>
                </div>
                <div style="margin-top: 20px; padding: 15px; background-color: #e8e8e8; border-radius: 5px; font-size: 12px; text-align: center;">
                    <p>Smart Health Monitoring System</p>
                    <p>This is an automated message. Please do not reply.</p>
                </div>
            </body>
        </html>
        """
        
        ok, err = send_html_email(target_email, subject, body)
        if not ok:
            print(f"❌ Error sending reset email: {err}")
            return jsonify({
                "status": "error",
                "message": f"Failed to send reset email: {err}"
            }), 500

        print(f"✅ Password reset email sent to {target_email}")
        return jsonify({
            "status": "success",
            "message": f"Password reset link sent to {target_email}. Please check your inbox and spam folder."
        })
    except Exception as e:
        print(f"❌ Error sending reset email: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Failed to send reset email: {str(e)}"
        }), 500

@app.route('/reset-doctor-password', methods=['POST'])
def reset_doctor_password():
    """Send password reset email to doctor"""
    import json
    import time
    from flask import request
    
    data = json.loads(request.data) if request.data else {}
    target_email = data.get('email', '').strip().lower()
    
    if not target_email:
        return jsonify({
            "status": "error",
            "message": "Email is required."
        }), 400
    
    if not EMAIL_SENDER or EMAIL_SENDER == 'your_email@gmail.com':
        return jsonify({
            "status": "error",
            "message": "Email service not configured. Contact administrator."
        }), 500
    
    try:
        reset_token = f"doc-{int(time.time())}"
        reset_link = f"http://localhost:3000/reset-password?token={reset_token}&email={target_email}"
        
        subject = "🔐 Smart Health - Password Reset Request"
        
        body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <div style="background-color: #3b82f6; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
                    <h2 style="margin: 0;">🔐 Password Reset Request</h2>
                </div>
                <div style="padding: 20px; background-color: #f5f5f5; border-radius: 10px;">
                    <p>Hello Doctor,</p>
                    <p>We received a request to reset your password for your doctor account: <strong>{target_email}</strong></p>
                    <p>Click the button below to set a new password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{reset_link}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                            Reset Password
                        </a>
                    </div>
                    <p style="font-size: 12px; color: #666;">
                        Or copy this link: <a href="{reset_link}">{reset_link}</a>
                    </p>
                    <p style="font-size: 12px; color: #666; margin-top: 30px;">
                        If you did not request this, please ignore this email. Your account will remain secure.
                    </p>
                </div>
                <div style="margin-top: 20px; padding: 15px; background-color: #e8e8e8; border-radius: 5px; font-size: 12px; text-align: center;">
                    <p>Smart Health Monitoring System</p>
                    <p>This is an automated message. Please do not reply.</p>
                </div>
            </body>
        </html>
        """
        
        ok, err = send_html_email(target_email, subject, body)
        if not ok:
            print(f"❌ Error sending reset email: {err}")
            return jsonify({
                "status": "error",
                "message": f"Failed to send reset email: {err}"
            }), 500

        print(f"✅ Password reset email sent to {target_email}")
        return jsonify({
            "status": "success",
            "message": f"Password reset link sent to {target_email}. Please check your inbox and spam folder."
        })
    except Exception as e:
        print(f"❌ Error sending reset email: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Failed to send reset email: {str(e)}"
        }), 500


@socketio.on('subscribe_patient')
def on_subscribe_patient(data):
    patient_id = str((data or {}).get('patientId') or '').strip()
    if not patient_id:
        emit('subscription_error', {'message': 'patientId is required'})
        return

    join_room(_patient_room(patient_id))
    emit('subscription_ok', {'patientId': patient_id})

if __name__ == '__main__':
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', '5000'))
    socketio.run(app, host=host, port=port, debug=True)
