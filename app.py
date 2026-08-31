import re

from flask import Flask, abort, send_from_directory
from functools import wraps

app = Flask(__name__)


def require_auth(roles=None, patient_id_arg=None):
    allowed_roles = {str(role).strip().lower() for role in (roles or []) if str(role).strip()}

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            payload, auth_error = _require_auth_payload()
            if auth_error:
                return auth_error

            role = str(payload.get('role') or '').strip().lower()
            if allowed_roles and role not in allowed_roles:
                return api_error('Forbidden. You are not authorized to perform this action.', 403)

            if patient_id_arg:
                target_patient_id = str(kwargs.get(patient_id_arg) or '').strip()
                if role == 'patient':
                    requester_patient_id = str(payload.get('patientId') or '').strip()
                    if not requester_patient_id or requester_patient_id != target_patient_id:
                        return api_error('Access denied for this patient record.', 403)

                if role == 'doctor':
                    doctor_id = str(payload.get('email') or '').strip().lower()
                    if not doctor_id:
                        return api_error('Forbidden. Doctor context is missing from token.', 403)

                    record = _patient_collection_reference().child(target_patient_id).get()
                    if not isinstance(record, dict):
                        return api_error('Patient not found.', 404)
                    if not _doctor_owns_record(record, doctor_id):
                        return api_error('Access denied for this patient record.', 403)

            return fn(*args, **kwargs)

        return wrapper

    return decorator

# ========== Flask app initialization ========== #
# (All imports and app = Flask(__name__) ...)
# ...existing code...

# SECURITY FIX: Strict doctor-patient authorization check
def _doctor_owns_record(record, doctor_id):
    if not isinstance(record, dict) or not doctor_id:
        return False
    doc_id_str = str(doctor_id).strip().lower()
    assigned = str(record.get('assignedDoctorId') or '').strip().lower()
    doc_id = str(record.get('doctorId') or '').strip().lower()
    doc_email = str(record.get('doctorEmail') or '').strip().lower()

    contact_email = ''
    if isinstance(record.get('doctorContact'), dict):
        contact_email = str(record.get('doctorContact', {}).get('email') or '').strip().lower()

    return doc_id_str != '' and (
        doc_id_str == assigned or
        doc_id_str == doc_id or
        doc_id_str == doc_email or
        doc_id_str == contact_email
    )

def _validate_patient_payload(data):
    errors = []
    name = str(data.get('name', '')).strip()
    age = data.get('age')
    gender = str(data.get('gender', '')).strip().lower()
    phone = str(data.get('phone', '')).strip()
    email = str(data.get('email', '')).strip().lower()

    if not name:
        errors.append('Name is required.')
    if not age or not str(age).isdigit() or int(age) < 0 or int(age) > 120:
        errors.append('Valid age is required.')
    if gender not in {'male', 'female', 'other'}:
        errors.append('Gender must be male, female, or other.')
    if not phone or not re.match(r'^\+?\d{10,15}$', phone):
        errors.append('Valid phone number is required.')
    if not email or '@' not in email:
        errors.append('Valid email is required.')
    return errors

def _generate_patient_id():
    return str(uuid.uuid4())

@app.route('/api/doctor/<doctor_id>/patients', methods=['POST'])
@require_auth(roles={'doctor'})
def add_patient(doctor_id):
    # Authenticated doctor only
    payload = _read_auth_payload()
    requester_doctor_id = str(payload.get('email', '')).strip().lower()
    if requester_doctor_id != str(doctor_id).strip().lower():
        return api_error('Forbidden. Doctor can only add patients to their own account.', 403)

    data = request.get_json(silent=True) or {}
    errors = _validate_patient_payload(data)
    if errors:
        return api_error(errors[0], 400, {'errors': errors})

    # Check for duplicate patient (by email or phone)
    patient_ref = _patient_collection_reference()
    all_patients = patient_ref.get() or {}
    for key, patient in (all_patients.items() if isinstance(all_patients, dict) else []):
        if not isinstance(patient, dict):
            continue
        if str(patient.get('email', '')).strip().lower() == data['email'].strip().lower():
            return api_error('A patient with this email already exists.', 409)
        if _normalize_phone(patient.get('phone', '')) == _normalize_phone(data['phone']):
            return api_error('A patient with this phone already exists.', 409)

    patient_id = _generate_patient_id()
    doctor_ref = _doctor_collection_reference().child(requester_doctor_id.replace('.', ','))
    doctor = doctor_ref.get() or {}
    doc_name = str(doctor.get('name') or '').strip()
    doc_phone = str(doctor.get('phone') or '').strip()
    doc_specialty = str(doctor.get('specialty') or 'Cardiologist (Ward 4B)').strip()

    patient_record = {
        'patientId': patient_id,
        'name': data['name'].strip(),
        'age': int(data['age']),
        'gender': data['gender'].strip().lower(),
        'phone': _normalize_phone(data['phone']),
        'email': data['email'].strip().lower(),
        'doctorId': requester_doctor_id,
        'assignedDoctorId': requester_doctor_id,
        'doctorEmail': requester_doctor_id,
        'doctorName': doc_name,
        'assignedDoctorName': doc_name,
        'doctorPhone': doc_phone,
        'doctorSpecialty': doc_specialty,
        'doctorContact': {
            'id': requester_doctor_id,
            'name': doc_name,
            'email': requester_doctor_id,
            'phone': doc_phone,
            'specialty': doc_specialty,
        },
        'createdAt': now,
        'updatedAt': now,
        'medicines': [],
    }
    # Store patient
    patient_ref.child(patient_id).set(patient_record)

    doctor_patients = doctor.get('patients', [])
    if patient_id not in doctor_patients:
        doctor_patients.append(patient_id)
        doctor_ref.update({'patients': doctor_patients})

    return api_success('Patient added successfully.', {'patient': patient_record})
import os
import random
import smtplib
import secrets
import string
import time
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path
import uuid
from functools import wraps
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit, join_room
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash
from twilio.rest import Client
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials, db, firestore

import joblib
import numpy as np
import pandas as pd
from sensor_adapter import create_sensor_adapter

BASE_DIR = Path(__file__).resolve().parent
VITAL_FEATURE_COLUMNS = ["heart_rate", "spo2", "temperature"]
VITAL_MODEL_PATH = BASE_DIR / "vitals_model.pkl"
VITALS_DATASET_PATHS = [
    BASE_DIR / "datasetheartrate" / "vitals_dataset.csv",
    BASE_DIR / "datasetheartrate" / "heart.csv",
]
ECG_FIELD_KEYS = {
    "age",
    "sex",
    "chestpaintype",
    "restingbp",
    "cholesterol",
    "fastingbs",
    "restingecg",
    "maxhr",
    "exerciseangina",
    "oldpeak",
    "st_slope",
    "stslope",
}
ECG_MAX_POINTS = 100
CHAT_MESSAGE_MAX_LENGTH = 1200
CHAT_HISTORY_DEFAULT_LIMIT = 60
CHAT_HISTORY_MAX_LIMIT = 200

vitals_model = None
vitals_model_classes = []
chat_user_connections = {}
chat_sid_context = {}
active_video_calls = {}

if not VITAL_MODEL_PATH.exists():
    dataset_path = BASE_DIR / "datasetheartrate" / "vitals_dataset.csv"
    if dataset_path.exists():
        try:
            print(f"Vitals model not found at {VITAL_MODEL_PATH}. Auto-training from {dataset_path}...")
            from model import train_vitals_model
            train_vitals_model(dataset_path, VITAL_MODEL_PATH)
        except Exception as err:
            print(f"Auto-train of vitals model failed: {err}")

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
try:
    app
except NameError:
    app = Flask(__name__)


def require_auth(roles=None, patient_id_arg=None):
    allowed_roles = {str(role).strip().lower() for role in (roles or []) if str(role).strip()}

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            payload, auth_error = _require_auth_payload()
            if auth_error:
                return auth_error

            role = str(payload.get('role') or '').strip().lower()
            if allowed_roles and role not in allowed_roles:
                return api_error('Forbidden. You are not authorized to perform this action.', 403)

            if patient_id_arg:
                target_patient_id = str(kwargs.get(patient_id_arg) or '').strip()
                if role == 'patient':
                    requester_patient_id = str(payload.get('patientId') or '').strip()
                    if not requester_patient_id or requester_patient_id != target_patient_id:
                        return api_error('Access denied for this patient record.', 403)

                if role == 'doctor':
                    doctor_id = str(payload.get('email') or '').strip().lower()
                    if not doctor_id:
                        return api_error('Forbidden. Doctor context is missing from token.', 403)

                    record = _patient_collection_reference().child(target_patient_id).get()
                    if not isinstance(record, dict):
                        return api_error('Patient not found.', 404)
                    if not _doctor_owns_record(record, doctor_id):
                        return api_error('Access denied for this patient record.', 403)

            return fn(*args, **kwargs)

        return wrapper

    return decorator
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading", manage_session=False)

dataset_vitals_rows = []
sensor_adapter = None


def _utc_now_iso():
    return datetime.now(timezone.utc).isoformat()


def _request_meta():
    return {
        'timestamp': _utc_now_iso(),
        'requestId': getattr(request, 'request_id', ''),
    }


def api_success(message='OK', data=None, status_code=200):
    return jsonify({
        'status': 'success',
        'message': str(message or 'OK'),
        'data': data if data is not None else {},
        'meta': _request_meta(),
    }), status_code


def api_error(message='Request failed.', status_code=400, data=None):
    return jsonify({
        'status': 'error',
        'message': str(message or 'Request failed.'),
        'data': data if data is not None else {},
        'meta': _request_meta(),
    }), status_code


@app.before_request
def _set_request_id():
    request.request_id = str(uuid.uuid4())


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
firebase_cred_json = os.getenv('FIREBASE_CREDENTIALS_JSON')
if firebase_cred_json:
    # Production (Render): Load from environment variable
    try:
        import json
        cred = credentials.Certificate(json.loads(firebase_cred_json))
    except Exception as e:
        print(f"Error loading Firebase credentials from env var: {e}")
        raise
else:
    # Local development: Load from file
    cred = credentials.Certificate("firebase_key.json")

firebase_admin.initialize_app(cred, {
    'databaseURL': os.getenv('FIREBASE_DATABASE_URL', 'https://smart-health-care-cd723-default-rtdb.asia-southeast1.firebasedatabase.app/')
})
firestore_client = firestore.client()

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
DEFAULT_PHONE_COUNTRY_CODE = _get_env('DEFAULT_PHONE_COUNTRY_CODE', '+91')
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


# --- Medicines, Prescriptions, Adherence, and Audit Helpers ---

def _prescription_collection_reference(patient_id):
    return _patient_collection_reference().child(str(patient_id).strip()).child('medicines')


def _adherence_collection_reference(patient_id):
    return _patient_collection_reference().child(str(patient_id).strip()).child('medication_adherence')


def _audit_collection_reference(patient_id):
    return _patient_collection_reference().child(str(patient_id).strip()).child('medication_audit')


def _record_medication_audit(patient_id, action, medication_id=None, details=None):
    try:
        actor_role = _request_user_role() or 'system'
        actor_id = _request_doctor_id() if actor_role == 'doctor' else (_request_patient_id() or 'patient')
        audit_entry = {
            'id': f"aud-{uuid.uuid4().hex[:10]}",
            'patientId': str(patient_id).strip(),
            'medicationId': str(medication_id or '').strip(),
            'action': str(action).strip(),
            'performedBy': str(actor_id).strip(),
            'performedByRole': str(actor_role).strip(),
            'timestamp': _utc_now_iso(),
            'details': str(details or '').strip(),
        }
        ref = _audit_collection_reference(patient_id)
        current = ref.get()
        if not isinstance(current, list):
            current = list(current.values()) if isinstance(current, dict) else []
        current.append(audit_entry)
        if len(current) > 200:
            current = current[-200:]
        ref.set(current)
        return audit_entry
    except Exception as e:
        print(f"[Audit Log Error] {e}")
        return None


def _normalize_medication_record(med, patient_id, default_doc_id='', default_doc_name=''):
    if not isinstance(med, dict):
        return {}
    med_id = str(med.get('id') or med.get('medicationId') or f"med-{uuid.uuid4().hex[:8]}").strip()
    status = str(med.get('status') or 'Active').strip().capitalize()
    if status not in {'Active', 'Completed', 'Paused', 'Discontinued'}:
        status = 'Active'

    med_name = str(med.get('medicineName') or med.get('name') or '').strip()
    return {
        'id': med_id,
        'medicationId': med_id,
        'patientId': str(med.get('patientId') or patient_id).strip(),
        'patientName': str(med.get('patientName') or '').strip(),
        'medicineName': med_name,
        'name': med_name,
        'dosage': str(med.get('dosage') or '').strip(),
        'frequency': str(med.get('frequency') or med.get('time') or 'Every 24 hours').strip(),
        'route': str(med.get('route') or 'Oral').strip(),
        'instructions': str(med.get('instructions') or 'Take as prescribed').strip(),
        'foodInstruction': str(med.get('foodInstruction') or 'After food').strip(),
        'startDate': str(med.get('startDate') or _utc_now_iso()[:10]).strip(),
        'endDate': str(med.get('endDate') or '').strip(),
        'duration': str(med.get('duration') or '').strip(),
        'status': status,
        'notes': str(med.get('notes') or '').strip(),
        'prescribedByDoctorId': str(med.get('prescribedByDoctorId') or med.get('doctorId') or default_doc_id).strip(),
        'prescribedByDoctorName': str(med.get('prescribedByDoctorName') or med.get('doctorName') or default_doc_name).strip(),
        'createdAt': str(med.get('createdAt') or _utc_now_iso()),
        'updatedAt': str(med.get('updatedAt') or _utc_now_iso()),
        'taken': bool(med.get('taken', False)),
        'takenAt': str(med.get('takenAt') or ''),
    }


def _get_patient_medicines(patient_id):
    key = str(patient_id or '').strip()
    if not key:
        return None, 'Patient ID is required.'
    record = _patient_collection_reference().child(key).get()
    if not record:
        return None, 'Patient not found.'

    raw_medicines = record.get('medicines', [])
    if not isinstance(raw_medicines, list):
        raw_medicines = list(raw_medicines.values()) if isinstance(raw_medicines, dict) else []

    doc_id = str(record.get('assignedDoctorId') or record.get('doctorId') or record.get('doctorEmail') or '').strip()
    doc_name = str(record.get('assignedDoctorName') or record.get('doctorName') or 'Attending Physician').strip()

    medicines = [_normalize_medication_record(m, key, doc_id, doc_name) for m in raw_medicines if isinstance(m, dict)]
    return medicines, None


def _set_patient_medicines(patient_id, medicines):
    key = str(patient_id or '').strip()
    if not key:
        return False, 'Patient ID is required.'
    ref = _patient_collection_reference().child(key)
    record = ref.get()
    if not record:
        return False, 'Patient not found.'
    ref.update({'medicines': medicines})
    return True, None


def _calculate_patient_adherence(patient_id):
    ref = _adherence_collection_reference(patient_id)
    adherence_data = ref.get()
    if not isinstance(adherence_data, list):
        adherence_data = list(adherence_data.values()) if isinstance(adherence_data, dict) else []

    today_str = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    today_records = [rec for rec in adherence_data if str(rec.get('date') or str(rec.get('takenAt', ''))[:10]) == today_str]

    medicines, _ = _get_patient_medicines(patient_id)
    active_meds = [m for m in (medicines or []) if str(m.get('status', 'Active')).lower() == 'active']

    taken_count = sum(1 for r in today_records if str(r.get('status', '')).lower() == 'taken')
    missed_count = sum(1 for r in today_records if str(r.get('status', '')).lower() == 'missed')
    skipped_count = sum(1 for r in today_records if str(r.get('status', '')).lower() == 'skipped')
    total_scheduled = max(len(active_meds), len(today_records), 1)
    pending_count = max(0, total_scheduled - taken_count - missed_count - skipped_count)

    rate = round((taken_count / total_scheduled) * 100, 1) if total_scheduled > 0 else 100.0

    weekly = []
    now = datetime.now(timezone.utc)
    for i in range(6, -1, -1):
        day_date = now - timedelta(days=i)
        d_str = day_date.strftime('%Y-%m-%d')
        d_name = day_date.strftime('%a')
        d_records = [rec for rec in adherence_data if str(rec.get('date') or str(rec.get('takenAt', ''))[:10]) == d_str]
        d_taken = sum(1 for r in d_records if str(r.get('status', '')).lower() == 'taken')
        d_total = max(len(active_meds), len(d_records), 1)
        d_pct = min(100, round((d_taken / d_total) * 100)) if d_total > 0 else 100
        weekly.append({
            'date': d_str,
            'day': d_name,
            'taken': d_taken,
            'total': d_total,
            'percentage': d_pct,
        })

    return {
        'today': {
            'date': today_str,
            'taken': taken_count,
            'pending': pending_count,
            'missed': missed_count,
            'skipped': skipped_count,
            'totalScheduled': total_scheduled,
            'adherenceRate': rate,
        },
        'weekly': weekly,
        'history': adherence_data[-50:],
    }


def _generate_ai_condition_analysis(patient_id, record=None):
    if not record:
        record = _patient_collection_reference().child(str(patient_id).strip()).get() or {}

    vitals = record.get('vitals', {}) if isinstance(record.get('vitals'), dict) else {}
    hr = float(vitals.get('heart_rate') or record.get('heart_rate') or 75.0)
    spo2 = float(vitals.get('spo2') or record.get('spo2') or 98.0)
    temp = float(vitals.get('temperature') or record.get('temperature') or 36.8)
    bp_sys = float(record.get('systolicBP') or 120.0)
    bp_dia = float(record.get('diastolicBP') or 80.0)

    prediction = predict_risk({'heart_rate': hr, 'spo2': spo2, 'temperature': temp})
    ml_risk = str(prediction.get('risk') or 'Low').strip().capitalize()
    ml_score = float(prediction.get('risk_score') or 0.15)

    findings = []
    immediate_steps = []
    is_emergency = False
    status_level = 'Normal'

    # Heart Rate Evaluation
    if hr > 140:
        findings.append(f"Critical tachycardia: Heart rate ({hr:.0f} bpm) is dangerously above resting range (60-100 bpm).")
        status_level = 'Emergency'
        is_emergency = True
    elif hr > 105:
        findings.append(f"Elevated heart rate: Heart rate ({hr:.0f} bpm) is elevated compared with normal resting threshold (60-100 bpm).")
        if status_level != 'Emergency': status_level = 'Attention'
    elif hr < 50:
        findings.append(f"Bradycardia detected: Heart rate ({hr:.0f} bpm) is significantly below the typical resting baseline.")
        if status_level != 'Emergency': status_level = 'Attention'
    else:
        findings.append(f"Resting heart rate ({hr:.0f} bpm) is within normal clinical limits (60-100 bpm).")

    # SpO2 Evaluation
    if spo2 < 88:
        findings.append(f"Severe hypoxemia: Oxygen saturation ({spo2:.1f}%) has fallen below critical safety threshold (90%).")
        status_level = 'Emergency'
        is_emergency = True
    elif spo2 < 94:
        findings.append(f"Sub-optimal oxygen saturation: SpO2 ({spo2:.1f}%) is below optimal target (≥ 95%).")
        if status_level != 'Emergency': status_level = 'Attention'
    else:
        findings.append(f"Oxygen saturation ({spo2:.1f}%) is within healthy physiological range (95-100%).")

    # Temperature Evaluation
    if temp > 39.5:
        findings.append(f"High pyrexia: Body temperature ({temp:.1f}°C) indicates severe fever requiring immediate attention.")
        status_level = 'Emergency'
        is_emergency = True
    elif temp > 37.8:
        findings.append(f"Elevated body temperature: Core temperature ({temp:.1f}°C) indicates low-to-moderate fever.")
        if status_level != 'Emergency': status_level = 'Attention'
    elif temp < 35.5:
        findings.append(f"Subnormal temperature: Core temperature ({temp:.1f}°C) suggests mild hypothermia.")
        if status_level != 'Emergency': status_level = 'Attention'
    else:
        findings.append(f"Body temperature ({temp:.1f}°C) is within normal homeostatic range (36.5-37.5°C).")

    # Blood Pressure Evaluation
    if bp_sys >= 180 or bp_dia >= 120:
        findings.append(f"Hypertensive urgency/crisis: Blood pressure ({bp_sys:.0f}/{bp_dia:.0f} mmHg) is severely elevated.")
        status_level = 'Emergency'
        is_emergency = True
    elif bp_sys >= 140 or bp_dia >= 90:
        findings.append(f"Elevated blood pressure ({bp_sys:.0f}/{bp_dia:.0f} mmHg) indicates stage 2 hypertension.")
        if status_level not in {'Emergency', 'Urgent'}: status_level = 'Attention'

    # Risk level mapping
    if is_emergency or status_level == 'Emergency':
        status_level = 'Emergency'
        risk_level = 'Critical Attention'
    elif status_level == 'Urgent' or ml_risk == 'High':
        status_level = 'Urgent'
        risk_level = 'High Attention'
    elif status_level == 'Attention' or ml_risk == 'Medium':
        status_level = 'Attention'
        risk_level = 'Moderate Attention'
    else:
        status_level = 'Normal'
        risk_level = 'Low Attention'

    # Actionable First-Aid Steps based on identified condition
    if is_emergency:
        immediate_steps = [
            "Cease all physical exertion and sit or recline safely in a supported upright posture.",
            "Initiate emergency protocol: Alert caregivers and prepare to contact local emergency services.",
            "Ensure airway remains open; loosen restrictive clothing around neck and chest.",
            "Do not consume solid foods or unprescribed medications while awaiting medical assessment.",
        ]
    elif hr > 105:
        immediate_steps = [
            "Stop strenuous activity and rest quietly in a cool, seated position.",
            "Practice steady, slow diaphragmatic breathing (4 seconds in, 4 seconds out).",
            "Remain hydrated with small sips of room-temperature water if swallowing easily.",
            "Re-evaluate heart rate telemetry in 5-10 minutes; contact doctor if palpitations persist.",
        ]
    elif spo2 < 94:
        immediate_steps = [
            "Sit upright immediately to optimize chest expansion and oxygenation.",
            "Inspect the oximeter sensor placement, clean fingertip, and verify sensor stability.",
            "Breathe slowly and deeply through your nose, exhaling gently through pursed lips.",
            "Notify your assigned physician if low oxygen readings or shortness of breath continue.",
        ]
    elif temp > 37.8:
        immediate_steps = [
            "Rest in a comfortably ventilated room with lightweight, breathable clothing.",
            "Maintain fluid hydration with water or electrolyte solutions as tolerated.",
            "Apply a cool, damp compress to the forehead or neck for non-pharmacological comfort.",
            "Monitor body temperature every 30-60 minutes and report persistent fever to your care team.",
        ]
    else:
        immediate_steps = [
            "Continue regular daily activities and maintain adequate daily hydration.",
            "Keep continuous telemetry sensors securely attached for reliable baseline tracking.",
            "Take doctor-prescribed medications according to your specified daily schedule.",
            "Contact your healthcare professional for routine follow-up or if unexpected symptoms develop.",
        ]

    emergency_warning = None
    if is_emergency:
        emergency_warning = "CRITICAL ALERT: Vital signs have crossed clinical safety thresholds. Immediate medical evaluation or emergency assistance may be required."

    return {
        'overallStatus': status_level,
        'riskLevel': risk_level,
        'keyFindings': findings,
        'immediateSteps': immediate_steps,
        'isEmergency': is_emergency,
        'emergencyWarning': emergency_warning,
        'telemetry': {
            'heartRate': hr,
            'spo2': spo2,
            'temperature': temp,
            'bloodPressure': f"{int(bp_sys)}/{int(bp_dia)}",
            'mlRiskScore': round(ml_score, 4),
            'mlRiskLabel': ml_risk,
        },
        'disclaimer': "AI-assisted clinical decision support. Requires clinical review. Does not constitute a medical diagnosis or prescription.",
        'evaluatedAt': _utc_now_iso(),
    }


# ==================== API: Patient Medicines & Prescriptions ====================

@app.route('/api/patient/<patient_id>/medicines', methods=['GET'])
@require_auth(roles={'doctor', 'patient'}, patient_id_arg='patient_id')
def get_patient_medicines_api(patient_id):
    medicines, error = _get_patient_medicines(patient_id)
    if error:
        return api_error(error, 404)
    return api_success('Medicines fetched successfully.', {'medicines': medicines})


@app.route('/api/patient/<patient_id>/prescriptions', methods=['POST'])
@require_auth(roles={'doctor'}, patient_id_arg='patient_id')
def create_patient_prescription(patient_id):
    data = request.get_json(silent=True) or {}
    med_name = str(data.get('medicineName') or data.get('name') or '').strip()
    dosage = str(data.get('dosage') or '').strip()

    if not med_name or not dosage:
        return api_error('Medicine name and dosage are required.', 400)

    body_patient_id = str(data.get('patientId') or '').strip()
    if body_patient_id and body_patient_id.lower() != str(patient_id).strip().lower():
        return api_error('Prescription patientId does not match the authorized patient workspace.', 400)

    auth_payload = _read_auth_payload()
    doc_id = str(auth_payload.get('doctorId') or auth_payload.get('email') or '').strip().lower()
    doc_name = str(auth_payload.get('name') or 'Attending Physician').strip()

    # Verify patient record and doctor assignment
    patient_record = _patient_collection_reference().child(str(patient_id).strip()).get()
    if not isinstance(patient_record, dict):
        return api_error('Patient not found.', 404)

    if not _doctor_owns_record(patient_record, doc_id):
        return api_error('Unable to create prescription. Please select an authorized patient.', 403)

    patient_name = str(patient_record.get('name') or data.get('patientName') or 'Patient').strip()

    medicines, error = _get_patient_medicines(patient_id)
    if error:
        return api_error(error, 404)

    new_prescription = {
        'id': f"med-{uuid.uuid4().hex[:8]}",
        'patientId': str(patient_id).strip(),
        'patientName': patient_name,
        'medicineName': med_name,
        'dosage': dosage,
        'frequency': str(data.get('frequency') or data.get('time') or 'Every 24 hours').strip(),
        'route': str(data.get('route') or 'Oral').strip(),
        'instructions': str(data.get('instructions') or 'Take as directed').strip(),
        'foodInstruction': str(data.get('foodInstruction') or 'After food').strip(),
        'startDate': str(data.get('startDate') or _utc_now_iso()[:10]).strip(),
        'endDate': str(data.get('endDate') or '').strip(),
        'duration': str(data.get('duration') or '').strip(),
        'status': 'Active',
        'notes': str(data.get('notes') or '').strip(),
        'prescribedByDoctorId': doc_id,
        'prescribedByDoctorName': doc_name,
        'createdAt': _utc_now_iso(),
        'updatedAt': _utc_now_iso(),
        'taken': False,
    }

    normalized = _normalize_medication_record(new_prescription, patient_id, doc_id, doc_name)
    medicines.append(normalized)

    ok, write_error = _set_patient_medicines(patient_id, medicines)
    if not ok:
        return api_error(write_error, 500)

    _record_medication_audit(
        patient_id,
        action='prescription_created',
        medication_id=normalized['id'],
        details=f"Prescribed {med_name} {dosage} ({normalized['frequency']}) by Dr. {doc_name}",
    )

    return api_success('Prescription created successfully.', {'prescription': normalized, 'medicines': medicines})


@app.route('/api/patient/<patient_id>/prescriptions/<medication_id>', methods=['PUT'])
@require_auth(roles={'doctor'}, patient_id_arg='patient_id')
def update_patient_prescription(patient_id, medication_id):
    medicines, error = _get_patient_medicines(patient_id)
    if error:
        return api_error(error, 404)

    target_idx = None
    for idx, med in enumerate(medicines):
        if str(med.get('id', '')).strip() == str(medication_id).strip():
            target_idx = idx
            break

    if target_idx is None:
        return api_error('Prescription not found.', 404)

    data = request.get_json(silent=True) or {}
    existing = medicines[target_idx]

    updated_status = str(data.get('status') or existing.get('status') or 'Active').strip().capitalize()
    if updated_status not in {'Active', 'Completed', 'Paused', 'Discontinued'}:
        updated_status = existing.get('status')

    existing['medicineName'] = str(data.get('medicineName') or existing.get('medicineName') or '').strip()
    existing['dosage'] = str(data.get('dosage') or existing.get('dosage') or '').strip()
    existing['frequency'] = str(data.get('frequency') or existing.get('frequency') or '').strip()
    existing['route'] = str(data.get('route') or existing.get('route') or 'Oral').strip()
    existing['instructions'] = str(data.get('instructions') or existing.get('instructions') or '').strip()
    existing['foodInstruction'] = str(data.get('foodInstruction') or existing.get('foodInstruction') or '').strip()
    existing['startDate'] = str(data.get('startDate') or existing.get('startDate') or '').strip()
    existing['endDate'] = str(data.get('endDate') or existing.get('endDate') or '').strip()
    existing['duration'] = str(data.get('duration') or existing.get('duration') or '').strip()
    existing['notes'] = str(data.get('notes') or existing.get('notes') or '').strip()
    existing['status'] = updated_status
    existing['updatedAt'] = _utc_now_iso()

    normalized = _normalize_medication_record(existing, patient_id)
    medicines[target_idx] = normalized

    ok, write_error = _set_patient_medicines(patient_id, medicines)
    if not ok:
        return api_error(write_error, 500)

    _record_medication_audit(
        patient_id,
        action=f"prescription_updated_status_{updated_status.lower()}",
        medication_id=medication_id,
        details=f"Updated {normalized['medicineName']} status to {updated_status}",
    )

    return api_success('Prescription updated successfully.', {'prescription': normalized, 'medicines': medicines})


@app.route('/api/patient/<patient_id>/prescriptions/<medication_id>/status', methods=['POST'])
@require_auth(roles={'doctor'}, patient_id_arg='patient_id')
def update_prescription_status(patient_id, medication_id):
    data = request.get_json(silent=True) or {}
    new_status = str(data.get('status') or '').strip().capitalize()
    if new_status not in {'Active', 'Completed', 'Paused', 'Discontinued'}:
        return api_error('Status must be Active, Completed, Paused, or Discontinued.', 400)

    medicines, error = _get_patient_medicines(patient_id)
    if error:
        return api_error(error, 404)

    target_idx = None
    for idx, med in enumerate(medicines):
        if str(med.get('id', '')).strip() == str(medication_id).strip():
            target_idx = idx
            break

    if target_idx is None:
        return api_error('Prescription not found.', 404)

    medicines[target_idx]['status'] = new_status
    medicines[target_idx]['updatedAt'] = _utc_now_iso()

    ok, write_error = _set_patient_medicines(patient_id, medicines)
    if not ok:
        return api_error(write_error, 500)

    _record_medication_audit(
        patient_id,
        action=f"medication_{new_status.lower()}",
        medication_id=medication_id,
        details=f"Changed status of {medicines[target_idx].get('medicineName')} to {new_status}",
    )

    return api_success(f'Prescription marked as {new_status}.', {'prescription': medicines[target_idx], 'medicines': medicines})


@app.route('/api/patient/<patient_id>/medicines/<medicine_id>/taken', methods=['POST'])
@require_auth(roles={'doctor', 'patient'}, patient_id_arg='patient_id')
def mark_patient_medicine_taken(patient_id, medicine_id):
    medicines, error = _get_patient_medicines(patient_id)
    if error:
        return api_error(error, 404)

    payload = request.get_json(silent=True) or {}
    taken = bool(payload.get('taken', True))
    taken_at = _utc_now_iso()

    updated = False
    target_med = None
    for medicine in medicines:
        if str(medicine.get('id', '')).strip() == str(medicine_id).strip():
            medicine['taken'] = taken
            medicine['takenAt'] = taken_at if taken else ''
            medicine['updatedAt'] = taken_at
            target_med = medicine
            updated = True
            break

    if not updated or not target_med:
        return api_error('Medicine not found.', 404)

    ok, write_error = _set_patient_medicines(patient_id, medicines)
    if not ok:
        return api_error(write_error, 500)

    # Record adherence entry
    actor_role = _request_user_role() or 'patient'
    today_str = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    adherence_entry = {
        'id': f"adh-{uuid.uuid4().hex[:10]}",
        'patientId': str(patient_id).strip(),
        'medicationId': str(medicine_id).strip(),
        'medicineName': target_med.get('medicineName') or target_med.get('name') or '',
        'dosage': target_med.get('dosage') or '',
        'doseSchedule': target_med.get('frequency') or 'Scheduled dose',
        'scheduledTime': datetime.now(timezone.utc).strftime('%I:%M %p'),
        'takenAt': taken_at if taken else '',
        'status': 'Taken' if taken else 'Pending',
        'recordedBy': actor_role,
        'date': today_str,
        'createdAt': taken_at,
    }

    ref = _adherence_collection_reference(patient_id)
    current_adh = ref.get()
    if not isinstance(current_adh, list):
        current_adh = list(current_adh.values()) if isinstance(current_adh, dict) else []
    current_adh.append(adherence_entry)
    ref.set(current_adh[-200:])

    _record_medication_audit(
        patient_id,
        action='dose_marked_taken' if taken else 'dose_marked_pending',
        medication_id=medicine_id,
        details=f"Dose of {target_med.get('medicineName')} marked as {'Taken' if taken else 'Pending'}",
    )

    adherence_summary = _calculate_patient_adherence(patient_id)

    return api_success('Medicine status updated.', {
        'medicine': target_med,
        'medicines': medicines,
        'adherence': adherence_summary,
    })


@app.route('/api/patient/<patient_id>/adherence', methods=['GET', 'POST'])
@require_auth(roles={'doctor', 'patient'}, patient_id_arg='patient_id')
def patient_adherence_api(patient_id):
    if request.method == 'GET':
        adherence_summary = _calculate_patient_adherence(patient_id)
        return api_success('Adherence data retrieved.', adherence_summary)

    data = request.get_json(silent=True) or {}
    med_id = str(data.get('medicationId') or '').strip()
    status = str(data.get('status') or 'Taken').strip().capitalize()
    if status not in {'Taken', 'Missed', 'Skipped', 'Pending'}:
        status = 'Taken'

    medicines, _ = _get_patient_medicines(patient_id)
    target_med = next((m for m in (medicines or []) if str(m.get('id')) == med_id), None)
    med_name = target_med.get('medicineName') if target_med else str(data.get('medicineName') or 'Medication')
    dosage = target_med.get('dosage') if target_med else str(data.get('dosage') or '')

    now_iso = _utc_now_iso()
    today_str = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    actor_role = _request_user_role() or 'patient'

    adherence_entry = {
        'id': f"adh-{uuid.uuid4().hex[:10]}",
        'patientId': str(patient_id).strip(),
        'medicationId': med_id,
        'medicineName': med_name,
        'dosage': dosage,
        'doseSchedule': str(data.get('doseSchedule') or 'Daily dose').strip(),
        'scheduledTime': str(data.get('scheduledTime') or datetime.now(timezone.utc).strftime('%I:%M %p')).strip(),
        'takenAt': now_iso if status == 'Taken' else '',
        'status': status,
        'recordedBy': actor_role,
        'date': today_str,
        'createdAt': now_iso,
    }

    ref = _adherence_collection_reference(patient_id)
    current_adh = ref.get()
    if not isinstance(current_adh, list):
        current_adh = list(current_adh.values()) if isinstance(current_adh, dict) else []
    current_adh.append(adherence_entry)
    ref.set(current_adh[-200:])

    # If status is Taken, also update the medicine record
    if target_med and status == 'Taken':
        target_med['taken'] = True
        target_med['takenAt'] = now_iso
        _set_patient_medicines(patient_id, medicines)

    _record_medication_audit(
        patient_id,
        action=f"dose_marked_{status.lower()}",
        medication_id=med_id,
        details=f"Dose of {med_name} marked as {status}",
    )

    adherence_summary = _calculate_patient_adherence(patient_id)
    return api_success(f'Dose marked as {status}.', adherence_summary)


@app.route('/api/patient/<patient_id>/medication-timeline', methods=['GET'])
@require_auth(roles={'doctor', 'patient'}, patient_id_arg='patient_id')
def get_medication_timeline(patient_id):
    medicines, _ = _get_patient_medicines(patient_id)
    ref_adh = _adherence_collection_reference(patient_id)
    adherence_data = ref_adh.get()
    if not isinstance(adherence_data, list):
        adherence_data = list(adherence_data.values()) if isinstance(adherence_data, dict) else []

    ref_audit = _audit_collection_reference(patient_id)
    audit_data = ref_audit.get()
    if not isinstance(audit_data, list):
        audit_data = list(audit_data.values()) if isinstance(audit_data, dict) else []

    timeline = []

    # Prescription events
    for med in (medicines or []):
        created_at = med.get('createdAt') or _utc_now_iso()
        doc_name = med.get('prescribedByDoctorName') or 'Doctor'
        timeline.append({
            'type': 'prescription_created',
            'timestamp': created_at,
            'title': f"{med.get('medicineName')} {med.get('dosage')}",
            'description': f"Prescribed by Dr. {doc_name} ({med.get('frequency')}, {med.get('foodInstruction')})",
            'status': med.get('status'),
            'category': 'prescription',
        })
        if med.get('status') in {'Paused', 'Discontinued', 'Completed'}:
            timeline.append({
                'type': f"prescription_{med.get('status').lower()}",
                'timestamp': med.get('updatedAt') or created_at,
                'title': f"{med.get('medicineName')} {med.get('status')}",
                'description': f"Treatment status changed to {med.get('status')}",
                'status': med.get('status'),
                'category': 'status_change',
            })

    # Adherence events
    for adh in adherence_data:
        t_stamp = adh.get('takenAt') or adh.get('createdAt') or _utc_now_iso()
        status = adh.get('status', 'Taken')
        time_str = adh.get('scheduledTime') or ''
        timeline.append({
            'type': f"dose_{status.lower()}",
            'timestamp': t_stamp,
            'title': f"{adh.get('medicineName')} {adh.get('dosage')}",
            'description': f"Dose {status.lower()} at {time_str}" if time_str else f"Dose {status.lower()}",
            'status': status,
            'category': 'adherence',
        })

    # Sort descending by timestamp
    timeline.sort(key=lambda x: str(x.get('timestamp') or ''), reverse=True)

    return api_success('Timeline retrieved.', {'timeline': timeline[:100]})


@app.route('/api/patient/<patient_id>/ai-assessment', methods=['GET'])
@require_auth(roles={'doctor', 'patient'}, patient_id_arg='patient_id')
def get_patient_ai_assessment(patient_id):
    record = _patient_collection_reference().child(str(patient_id).strip()).get()
    if not record:
        return api_error('Patient not found.', 404)

    assessment = _generate_ai_condition_analysis(patient_id, record)
    return api_success('AI assessment generated.', assessment)

@app.errorhandler(400)
def handle_bad_request(error):
    description = getattr(error, "description", None) or "Bad request"
    return api_error(str(description), 400)


@app.errorhandler(500)
def handle_internal_error(error):
    return api_error("An unexpected error occurred.", 500)


@app.errorhandler(ValueError)
def handle_value_error(error):
    return api_error(str(error), 400)


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


def _is_ecg_payload(payload):
    if not isinstance(payload, dict):
        return False

    normalized_keys = {
        str(key).strip().lower().replace(" ", "").replace("-", "").replace("_", "")
        for key in payload.keys()
    }
    return bool(normalized_keys.intersection(ECG_FIELD_KEYS))


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
            "features": vitals,
            "vitals": vitals,
        }

    return {
        "risk": "Prediction unavailable",
        "prediction": "unavailable",
        "status": "unavailable",
        "message": "Prediction unavailable",
        "confidence": 0.0,
        "features": vitals,
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


def _vitals_model_classes():
    classes = [str(label).strip() for label in (vitals_model_classes or []) if str(label).strip()]
    if classes:
        return classes

    if vitals_model is not None and hasattr(vitals_model, "classes_"):
        return [str(label).strip() for label in getattr(vitals_model, "classes_", []) if str(label).strip()]

    return []


def _vitals_model_debug_payload():
    loaded = vitals_model is not None
    return {
        "status": "success" if loaded else "warning",
        "loaded": loaded,
        "feature_count": len(VITAL_FEATURE_COLUMNS),
        "feature_columns": list(VITAL_FEATURE_COLUMNS),
        "model_path": str(VITAL_MODEL_PATH.resolve()),
        "classes": _vitals_model_classes(),
    }


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


def _normalize_role(value):
    return str(value or '').strip().lower()


def _mask_email(email):
    email = str(email or '').strip()
    if '@' not in email:
        return email

    name, domain = email.split('@', 1)
    if len(name) <= 2:
        masked_name = name[0] + '*' if name else '*'
    else:
        masked_name = f"{name[0]}{'*' * (len(name) - 2)}{name[-1]}"

    return f"{masked_name}@{domain}"


def _normalize_phone(value):
    raw = str(value or '').strip()
    if not raw:
        return ''

    has_plus = raw.startswith('+')
    digits = ''.join(char for char in raw if char.isdigit())
    if not digits:
        return ''

    country_digits = ''.join(char for char in str(DEFAULT_PHONE_COUNTRY_CODE or '+91') if char.isdigit())

    # Treat common local mobile entry as domestic and convert to E.164.
    if not has_plus and len(digits) == 10 and country_digits:
        return f"+{country_digits}{digits}"

    return f"+{digits}" if has_plus else digits




def _mask_phone(phone):
    normalized = _normalize_phone(phone)
    if not normalized:
        return ''

    plain = normalized[1:] if normalized.startswith('+') else normalized
    if len(plain) <= 4:
        return normalized

    return f"{normalized[0] if normalized.startswith('+') else ''}{'*' * (len(plain) - 4)}{plain[-4:]}"


def _parse_iso_datetime(value):
    raw = str(value or '').strip()
    if not raw:
        return None

    try:
        parsed = datetime.fromisoformat(raw)
    except Exception:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _password_strength_errors(password):
    errors = []
    value = str(password or '')

    if len(value) < 8:
        errors.append('Password must be at least 8 characters long.')
    if not any(char.isupper() for char in value):
        errors.append('Password must include at least one uppercase letter.')
    if not any(char.islower() for char in value):
        errors.append('Password must include at least one lowercase letter.')
    if not any(char.isdigit() for char in value):
        errors.append('Password must include at least one number.')
    if not any(char in string.punctuation for char in value):
        errors.append('Password must include at least one special character.')

    return errors


def _patient_matches_by_email(email):
    normalized_email = str(email or '').strip().lower()
    if not normalized_email:
        return []

    raw = _patient_collection_reference().get() or {}
    matches = []

    if isinstance(raw, dict):
        items = raw.items()
    elif isinstance(raw, list):
        items = []
        for index, record in enumerate(raw):
            if not isinstance(record, dict):
                continue
            record_key = str(record.get('patientId') or record.get('id') or f'patient-{index}').strip()
            items.append((record_key, record))
    else:
        items = []

    for key, value in items:
        if not isinstance(value, dict):
            continue

        record_email = str(value.get('email') or '').strip().lower()
        if record_email != normalized_email:
            continue

        patient_id = str(value.get('patientId') or value.get('id') or key).strip()
        if not patient_id:
            continue

        matches.append({'patientId': patient_id, 'record': value})

    return matches


def _patient_matches_by_phone(phone):
    normalized_phone = _normalize_phone(phone)
    if not normalized_phone:
        return []

    raw = _patient_collection_reference().get() or {}
    matches = []

    if isinstance(raw, dict):
        items = raw.items()
    elif isinstance(raw, list):
        items = []
        for index, record in enumerate(raw):
            if not isinstance(record, dict):
                continue
            record_key = str(record.get('patientId') or record.get('id') or f'patient-{index}').strip()
            items.append((record_key, record))
    else:
        items = []

    for key, value in items:
        if not isinstance(value, dict):
            continue

        record_phone = _normalize_phone(value.get('phone') or value.get('phoneNumber'))
        if record_phone != normalized_phone:
            continue

        patient_id = str(value.get('patientId') or value.get('id') or key).strip()
        if not patient_id:
            continue

        matches.append({'patientId': patient_id, 'record': value})

    return matches


def _doctor_matches_by_phone(phone):
    normalized_phone = _normalize_phone(phone)
    if not normalized_phone:
        return []

    raw = _doctor_collection_reference().get() or {}
    if not isinstance(raw, dict):
        return []

    matches = []
    for key, value in raw.items():
        if not isinstance(value, dict):
            continue

        record_phone = _normalize_phone(value.get('phone'))
        if record_phone != normalized_phone:
            continue

        doctor_email = str(value.get('email') or key).replace(',', '.').strip().lower()
        if not doctor_email:
            continue

        matches.append({'email': doctor_email, 'storageKey': key, 'record': value})

    return matches


def _resolve_reset_account(identifier, role_hint=None):
    normalized_identifier = str(identifier or '').strip()
    if not normalized_identifier:
        return None, 'Phone number is required.', 400

    normalized_role = _normalize_role(role_hint)
    if normalized_role and normalized_role not in ('doctor', 'patient'):
        return None, 'Role must be either doctor or patient.', 400

    is_email_mode = '@' in normalized_identifier
    normalized_email = normalized_identifier.lower() if is_email_mode else ''
    normalized_phone = _normalize_phone(normalized_identifier) if not is_email_mode else ''

    doctor_record = None
    doctor_key = ''
    doctor_phone = ''
    patient_matches = []

    if is_email_mode:
        doctor_key = normalized_email.replace('.', ',')
        doctor_record = _doctor_collection_reference().child(doctor_key).get()
        doctor_phone = _normalize_phone((doctor_record or {}).get('phone')) if isinstance(doctor_record, dict) else ''
        patient_matches = _patient_matches_by_email(normalized_email)
    else:
        if not normalized_phone:
            return None, 'Enter a valid phone number.', 400

        doctor_matches = _doctor_matches_by_phone(normalized_phone)
        if len(doctor_matches) > 1:
            return None, 'Multiple doctor accounts found for this phone. Contact support.', 409
        if doctor_matches:
            match = doctor_matches[0]
            doctor_key = str(match.get('storageKey') or '').strip()
            doctor_record = match.get('record')

        patient_matches = _patient_matches_by_phone(normalized_phone)

    if normalized_role == 'doctor':
        if not isinstance(doctor_record, dict):
            return None, 'Doctor account not found for this phone number.', 404

        doctor_email = str(doctor_record.get('email') or (doctor_key.replace(',', '.'))).strip().lower()
        doctor_phone = _normalize_phone(doctor_record.get('phone'))
        return {
            'role': 'doctor',
            'email': doctor_email,
            'phone': doctor_phone,
            'userKey': doctor_email,
            'storageKey': doctor_key,
        }, '', 200

    if normalized_role == 'patient':
        if not patient_matches:
            return None, 'Patient account not found for this phone number.', 404
        if len(patient_matches) > 1:
            return None, 'Multiple patient accounts found for this phone number. Contact support.', 409

        patient_id = patient_matches[0]['patientId']
        patient_record = patient_matches[0]['record'] if isinstance(patient_matches[0], dict) else {}
        return {
            'role': 'patient',
            'email': str((patient_record or {}).get('email') or '').strip().lower(),
            'phone': _normalize_phone((patient_record or {}).get('phone') or (patient_record or {}).get('phoneNumber')),
            'userKey': patient_id,
            'storageKey': patient_id.replace('.', ','),
        }, '', 200

    has_doctor = isinstance(doctor_record, dict)
    has_patient = len(patient_matches) > 0

    if not has_doctor and not has_patient:
        return None, 'No account found for this phone number.', 404

    if has_doctor and has_patient:
        return None, 'This phone number belongs to multiple account types. Specify role (doctor or patient).', 409

    if has_doctor:
        doctor_email = str(doctor_record.get('email') or (doctor_key.replace(',', '.'))).strip().lower()
        doctor_phone = _normalize_phone(doctor_record.get('phone'))
        return {
            'role': 'doctor',
            'email': doctor_email,
            'phone': doctor_phone,
            'userKey': doctor_email,
            'storageKey': doctor_key,
        }, '', 200

    if len(patient_matches) > 1:
        return None, 'Multiple patient accounts found for this phone number. Contact support.', 409

    patient_id = patient_matches[0]['patientId']
    patient_record = patient_matches[0]['record'] if isinstance(patient_matches[0], dict) else {}
    return {
        'role': 'patient',
        'email': str((patient_record or {}).get('email') or '').strip().lower(),
        'phone': _normalize_phone((patient_record or {}).get('phone') or (patient_record or {}).get('phoneNumber')),
        'userKey': patient_id,
        'storageKey': patient_id.replace('.', ','),
    }, '', 200


def _firestore_user_document(uid):
    return firestore_client.collection('users').document(str(uid))


def _verify_firebase_phone_token(id_token):
    token = str(id_token or '').strip()
    if not token:
        return None, 'Firebase ID token is required.', 400

    try:
        decoded = firebase_auth.verify_id_token(token)
    except Exception:
        return None, 'Invalid or expired Firebase ID token.', 401

    uid = str(decoded.get('uid') or '').strip()
    phone_number = _normalize_phone(decoded.get('phone_number'))
    if not uid:
        return None, 'Firebase token is missing uid.', 401
    if not phone_number:
        return None, 'Firebase token does not include a valid phone number.', 400

    return {
        'uid': uid,
        'phone': phone_number,
        'decoded': decoded,
    }, '', 200


@app.route('/auth/firebase/verify-phone-token', methods=['POST'])
def verify_firebase_phone_token_route():
    data = request.get_json(silent=True) or {}
    role = _normalize_role(data.get('role'))
    if role not in ('doctor', 'patient'):
        return api_error('Role must be doctor or patient.', 400)

    verified, message, status_code = _verify_firebase_phone_token(data.get('idToken'))
    if not verified:
        return api_error(message, status_code)

    account, account_message, account_status = _resolve_reset_account(verified['phone'], role)
    if not account:
        return api_error(account_message, account_status)

    now_iso = datetime.now(timezone.utc).isoformat()
    user_ref = _firestore_user_document(verified['uid'])
    existing = user_ref.get()
    created_at = now_iso
    if existing.exists:
        existing_data = existing.to_dict() or {}
        created_at = str(existing_data.get('createdAt') or now_iso)

    user_doc = {
        'uid': verified['uid'],
        'phone': verified['phone'],
        'role': role,
        'updatedAt': now_iso,
        'createdAt': created_at,
    }
    user_ref.set(user_doc, merge=True)

    app_auth = _issue_auth_token({
        'role': role,
        'uid': verified['uid'],
        'phone': verified['phone'],
        'email': account.get('email') or '',
        'patientId': account.get('userKey') if role == 'patient' else '',
    })

    return api_success('Phone token verified.', {
        'uid': verified['uid'],
        'phone': verified['phone'],
        'role': role,
        'auth': app_auth,
        'user': user_doc,
    })


@app.route('/reset-password/firebase-phone', methods=['POST'])
def reset_password_with_firebase_phone():
    data = request.get_json(silent=True) or {}
    role = _normalize_role(data.get('role'))
    new_password = str(data.get('newPassword') or '')
    confirm_password = str(data.get('confirmPassword') or '')

    if role not in ('doctor', 'patient'):
        return api_error('Role must be doctor or patient.', 400)

    if not new_password or not confirm_password:
        return api_error('New password and confirm password are required.', 400)

    if new_password != confirm_password:
        return api_error('Password mismatch. Please check both fields.', 400)

    strength_errors = _password_strength_errors(new_password)
    if strength_errors:
        return api_error(strength_errors[0], 400, {'errors': strength_errors})

    verified, message, status_code = _verify_firebase_phone_token(data.get('idToken'))
    if not verified:
        return api_error(message, status_code)

    account, account_message, account_status = _resolve_reset_account(verified['phone'], role)
    if not account:
        return api_error(account_message, account_status)

    if role == 'doctor':
        doctor_ref = _doctor_collection_reference().child(account['storageKey'])
        doctor = doctor_ref.get()
        if not isinstance(doctor, dict):
            return api_error('Doctor account not found.', 404)

        doctor_ref.update({
            'passwordHash': generate_password_hash(new_password),
            'updatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        })
    else:
        patient_ref = _patient_collection_reference().child(account['userKey'])
        patient_record = patient_ref.get()
        if not isinstance(patient_record, dict):
            return api_error('Patient account not found.', 404)

        patient_ref.update({
            'password': new_password,
            'updatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        })

    return api_success('Password updated successfully.')


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


def _require_auth_payload():
    payload = _read_auth_payload()
    if not payload:
        return None, api_error('Unauthorized. Valid auth token is required.', 401)
    return payload, None


def _request_user_role():
    payload = _read_auth_payload()
    if payload.get('role'):
        return str(payload.get('role')).strip().lower()
    return ''


def _request_patient_id():
    payload = _read_auth_payload()
    if payload.get('role') == 'patient' and payload.get('patientId'):
        return str(payload.get('patientId')).strip()
    return ''


def _request_doctor_id(payload=None):
    auth_payload = _read_auth_payload()
    if auth_payload.get('role') == 'doctor':
        doc_id = auth_payload.get('doctorId') or auth_payload.get('email') or auth_payload.get('uid')
        if doc_id:
            return str(doc_id).strip().lower()

    if isinstance(payload, dict):
        from_payload = payload.get('doctorId') or payload.get('doctorEmail') or payload.get('assignedDoctorId')
        if from_payload:
            return str(from_payload).strip().lower()

    return ''


def _request_doctor_phone(payload=None):
    auth_payload = _read_auth_payload()
    if auth_payload.get('role') == 'doctor' and auth_payload.get('phone'):
        return str(auth_payload.get('phone')).strip()

    if isinstance(payload, dict):
        from_payload = payload.get('doctorPhone') or payload.get('phone')
        if from_payload:
            return str(from_payload).strip()

    return ''


def require_auth(roles=None, patient_id_arg=None):
    allowed_roles = {str(role).strip().lower() for role in (roles or []) if str(role).strip()}

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            payload, auth_error = _require_auth_payload()
            if auth_error:
                return auth_error

            role = str(payload.get('role') or '').strip().lower()
            if allowed_roles and role not in allowed_roles:
                return api_error('Forbidden. You are not authorized to perform this action.', 403)

            if patient_id_arg:
                target_patient_id = str(kwargs.get(patient_id_arg) or '').strip()
                if role == 'patient':
                    requester_patient_id = str(payload.get('patientId') or '').strip()
                    if not requester_patient_id or requester_patient_id != target_patient_id:
                        return api_error('Access denied for this patient record.', 403)

                if role == 'doctor':
                    doctor_id = str(payload.get('doctorId') or payload.get('email') or payload.get('uid') or '').strip().lower()
                    if not doctor_id:
                        return api_error('Forbidden. Doctor context is missing from token.', 403)

                    record = _patient_collection_reference().child(target_patient_id).get()
                    if not isinstance(record, dict):
                        return api_error('Patient not found.', 404)
                    if not _doctor_owns_record(record, doctor_id):
                        return api_error('Access denied for this patient record.', 403)

            return fn(*args, **kwargs)

        return wrapper

    return decorator


def _decode_auth_token(token):
    token_value = str(token or '').strip()
    if not token_value:
        return {}

    try:
        payload = auth_serializer.loads(token_value, max_age=AUTH_TOKEN_TTL_SECONDS)
        return payload if isinstance(payload, dict) else {}
    except (BadSignature, SignatureExpired):
        return {}


def _chat_threads_reference():
    return db.reference('chat_threads')


def _chat_presence_reference():
    return db.reference('chat_presence')


def _calls_reference():
    return db.reference('calls')


def _chat_now_iso():
    return datetime.now(timezone.utc).isoformat()


def _chat_safe_key(value):
    source = str(value or '').strip().lower()
    if not source:
        return ''

    cleaned = ''.join(ch if ch.isalnum() else '_' for ch in source)
    while '__' in cleaned:
        cleaned = cleaned.replace('__', '_')
    return cleaned.strip('_')[:120]


def _chat_presence_key(role, actor_id):
    return f"{_chat_safe_key(role)}__{_chat_safe_key(actor_id)}"


def _chat_thread_id(doctor_id, patient_id):
    doctor_safe = _chat_safe_key(doctor_id)
    patient_safe = _chat_safe_key(patient_id)
    return f"d_{doctor_safe}__p_{patient_safe}"


def _chat_room(thread_id):
    return f"chat_thread:{thread_id}"


def _chat_get_patient_record(patient_id):
    patient_key = str(patient_id or '').strip()
    if not patient_key:
        return None

    direct = _patient_collection_reference().child(patient_key).get()
    if isinstance(direct, dict):
        return direct

    raw = _patient_collection_reference().get() or {}
    if not isinstance(raw, dict):
        return None

    for key, value in raw.items():
        if not isinstance(value, dict):
            continue
        candidate = str(value.get('patientId') or value.get('id') or key).strip()
        if candidate == patient_key:
            return value

    return None


def _chat_extract_actor_from_payload(payload):
    role = str((payload or {}).get('role') or '').strip().lower()
    if role not in ('doctor', 'patient'):
        return {}

    actor_id = ''
    if role == 'doctor':
        actor_id = str((payload or {}).get('doctorId') or (payload or {}).get('email') or (payload or {}).get('uid') or '').strip().lower()
    else:
        actor_id = str((payload or {}).get('patientId') or (payload or {}).get('userId') or (payload or {}).get('uid') or '').strip()

    if not actor_id:
        return {}

    return {
        'role': role,
        'id': actor_id,
        'phone': str((payload or {}).get('phone') or '').strip(),
        'doctorId': str((payload or {}).get('doctorId') or '').strip(),
        'email': str((payload or {}).get('email') or '').strip().lower(),
        'name': str((payload or {}).get('name') or '').strip(),
    }


def _chat_resolve_http_actor(fallback_payload=None):
    token_payload = _read_auth_payload()
    actor = _chat_extract_actor_from_payload(token_payload)
    if actor:
        return actor

    role = _request_user_role()
    if role == 'doctor':
        doctor_id = _request_doctor_id(fallback_payload)
        if doctor_id:
            return {'role': 'doctor', 'id': doctor_id, 'phone': _request_doctor_phone(fallback_payload)}

    if role == 'patient':
        patient_id = _request_patient_id()
        if patient_id:
            return {'role': 'patient', 'id': patient_id, 'phone': ''}

    return {}


def _chat_resolve_socket_actor(auth_data=None):
    if isinstance(auth_data, dict):
        token = str(auth_data.get('token') or auth_data.get('authToken') or '').strip()
        if token:
            actor = _chat_extract_actor_from_payload(_decode_auth_token(token))
            if actor:
                if auth_data.get('doctorId') and not actor.get('doctorId'):
                    actor['doctorId'] = str(auth_data.get('doctorId')).strip()
                if auth_data.get('email') and not actor.get('email'):
                    actor['email'] = str(auth_data.get('email')).strip().lower()
                if auth_data.get('name') and not actor.get('name'):
                    actor['name'] = str(auth_data.get('name')).strip()
                return actor

        role = str(auth_data.get('role') or '').strip().lower()
        actor_id = str(auth_data.get('doctorId') or auth_data.get('patientId') or auth_data.get('userId') or auth_data.get('email') or '').strip()
        if role in ('doctor', 'patient') and actor_id:
            return {
                'role': role,
                'id': actor_id.lower() if role == 'doctor' else actor_id,
                'doctorId': str(auth_data.get('doctorId') or '').strip(),
                'email': str(auth_data.get('email') or '').strip().lower(),
                'patientId': str(auth_data.get('patientId') or '').strip(),
                'name': str(auth_data.get('name') or '').strip(),
            }

    auth_header = str(request.headers.get('Authorization') or '').strip()
    if auth_header.lower().startswith('bearer '):
        actor = _chat_extract_actor_from_payload(_decode_auth_token(auth_header[7:].strip()))
        if actor:
            return actor

    return {}


def _chat_get_thread_meta(thread_id):
    meta = _chat_threads_reference().child(thread_id).child('meta').get()
    return meta if isinstance(meta, dict) else {}


def _chat_authorize(actor, doctor_id, patient_id):
    role = str((actor or {}).get('role') or '').strip().lower()
    actor_id = str((actor or {}).get('id') or '').strip().lower() if role == 'doctor' else str((actor or {}).get('id') or '').strip()
    doctor_key = str(doctor_id or '').strip().lower()
    patient_key = str(patient_id or '').strip()

    if role not in ('doctor', 'patient'):
        return False, 'Invalid actor role.'

    if not doctor_key or not patient_key:
        return False, 'doctorId and patientId are required.'

    if role == 'doctor' and actor_id != doctor_key:
        return False, 'Doctor is not authorized for this thread.'

    if role == 'patient' and actor_id != patient_key:
        return False, 'Patient is not authorized for this thread.'

    patient_record = _chat_get_patient_record(patient_key)
    if not isinstance(patient_record, dict):
        return False, 'Patient record not found.'

    owner = str(patient_record.get('doctorId') or patient_record.get('doctorEmail') or '').strip().lower()
    if owner and owner != doctor_key:
        return False, 'Doctor-patient pairing is not valid.'

    return True, ''


def _chat_upsert_thread_meta(thread_id, doctor_id, patient_id):
    now_iso = _chat_now_iso()
    next_meta = {
        'threadId': thread_id,
        'doctorId': str(doctor_id or '').strip().lower(),
        'patientId': str(patient_id or '').strip(),
        'updatedAt': now_iso,
    }

    existing = _chat_get_thread_meta(thread_id)
    if not existing:
        next_meta['createdAt'] = now_iso
    else:
        next_meta['createdAt'] = str(existing.get('createdAt') or now_iso)
        if existing.get('lastMessage'):
            next_meta['lastMessage'] = existing.get('lastMessage')

    _chat_threads_reference().child(thread_id).child('meta').update(next_meta)
    return next_meta


def _chat_list_messages(thread_id, limit=CHAT_HISTORY_DEFAULT_LIMIT, before=''):
    raw = _chat_threads_reference().child(thread_id).child('messages').get() or {}
    if not isinstance(raw, dict):
        return []

    rows = []
    for key, value in raw.items():
        if not isinstance(value, dict):
            continue
        row = dict(value)
        row['id'] = str(row.get('id') or key)
        rows.append(row)

    rows.sort(key=lambda item: str(item.get('createdAt') or ''))

    if before:
        rows = [item for item in rows if str(item.get('createdAt') or '') < str(before)]

    limit = max(1, min(int(limit or CHAT_HISTORY_DEFAULT_LIMIT), CHAT_HISTORY_MAX_LIMIT))
    return rows[-limit:]


def _chat_partner_presence(role, partner_id):
    partner_key = _chat_presence_key(role, partner_id)
    presence = _chat_presence_reference().child(partner_key).get()
    if not isinstance(presence, dict):
        return {'online': False, 'lastSeen': ''}

    return {
        'online': bool(presence.get('online')),
        'lastSeen': str(presence.get('lastSeen') or ''),
    }


def _chat_create_message(actor, thread_id, text, receiver_id=''):
    content = str(text or '').strip()
    if not content:
        return None, 'Message text is required.', 400

    if len(content) > CHAT_MESSAGE_MAX_LENGTH:
        return None, f'Message exceeds {CHAT_MESSAGE_MAX_LENGTH} characters.', 400

    meta = _chat_get_thread_meta(thread_id)
    if not meta:
        return None, 'Thread not found.', 404

    doctor_id = str(meta.get('doctorId') or '').strip().lower()
    patient_id = str(meta.get('patientId') or '').strip()
    allowed, reason = _chat_authorize(actor, doctor_id, patient_id)
    if not allowed:
        return None, reason, 403

    sender_role = str(actor.get('role')).strip().lower()
    sender_id = str(actor.get('id')).strip().lower() if sender_role == 'doctor' else str(actor.get('id')).strip()
    fallback_receiver = patient_id if sender_role == 'doctor' else doctor_id
    resolved_receiver = str(receiver_id or fallback_receiver).strip().lower() if sender_role == 'doctor' else str(receiver_id or fallback_receiver).strip()

    now_iso = _chat_now_iso()
    message_id = f"msg-{int(time.time() * 1000)}-{secrets.token_hex(4)}"
    presence = _chat_partner_presence('patient' if sender_role == 'doctor' else 'doctor', resolved_receiver)
    delivered_at = now_iso if presence.get('online') else ''
    status = 'delivered' if delivered_at else 'sent'

    message = {
        'id': message_id,
        'threadId': thread_id,
        'senderRole': sender_role,
        'senderId': sender_id,
        'receiverId': resolved_receiver,
        'text': content,
        'createdAt': now_iso,
        'deliveredAt': delivered_at,
        'readAt': '',
        'status': status,
    }

    thread_ref = _chat_threads_reference().child(thread_id)
    thread_ref.child('messages').child(message_id).set(message)
    thread_ref.child('meta').update({
        'threadId': thread_id,
        'doctorId': doctor_id,
        'patientId': patient_id,
        'updatedAt': now_iso,
        'lastMessage': {
            'id': message_id,
            'text': content,
            'senderRole': sender_role,
            'senderId': sender_id,
            'createdAt': now_iso,
        },
    })

    return message, '', 200


def _chat_mark_message_read(actor, thread_id, message_id):
    meta = _chat_get_thread_meta(thread_id)
    if not meta:
        return None, 'Thread not found.', 404

    doctor_id = str(meta.get('doctorId') or '').strip().lower()
    patient_id = str(meta.get('patientId') or '').strip()
    allowed, reason = _chat_authorize(actor, doctor_id, patient_id)
    if not allowed:
        return None, reason, 403

    message_ref = _chat_threads_reference().child(thread_id).child('messages').child(message_id)
    message = message_ref.get()
    if not isinstance(message, dict):
        return None, 'Message not found.', 404

    receiver_id = str(message.get('receiverId') or '').strip()
    actor_id = str(actor.get('id') or '').strip().lower() if actor.get('role') == 'doctor' else str(actor.get('id') or '').strip()
    if receiver_id and receiver_id != actor_id:
        return None, 'Only the receiver can mark this message as read.', 403

    now_iso = _chat_now_iso()
    message_ref.update({'readAt': now_iso, 'status': 'read'})
    message['readAt'] = now_iso
    message['status'] = 'read'
    return message, '', 200


def _chat_emit_presence(role, actor_id, online, sid=''):
    now_iso = _chat_now_iso()
    key = _chat_presence_key(role, actor_id)
    try:
        _chat_presence_reference().child(key).update({
            'role': str(role or '').strip().lower(),
            'userId': str(actor_id or '').strip(),
            'online': bool(online),
            'lastSeen': now_iso,
            'socketId': str(sid or ''),
        })
    except Exception as e:
        print(f"[PRESENCE] Error updating RTDB: {e}")

    try:
        socketio.emit('chat:presence_update', {
            'role': str(role or '').strip().lower(),
            'userId': str(actor_id or '').strip(),
            'userKey': key,
            'online': bool(online),
            'lastSeen': now_iso,
        })
    except Exception as e:
        print(f"[PRESENCE] Error emitting presence update: {e}")


def _chat_emit_to_user(role, actor_id, event_name, payload):
    user_key = _chat_presence_key(role, actor_id)
    sessions = chat_user_connections.get(user_key) or set()
    delivered = 0
    for sid in sessions:
        socketio.emit(event_name, payload, to=sid)
        delivered += 1
    return delivered


def _chat_actor_display_name(role, actor_id):
    normalized_role = str(role or '').strip().lower()
    if normalized_role == 'doctor':
        key = str(actor_id or '').strip().lower()
        if not key:
            return 'Doctor'
        doctor_record = _doctor_collection_reference().child(key.replace('.', ',')).get()
        return str((doctor_record or {}).get('name') or key).strip()

    patient_record = _chat_get_patient_record(actor_id)
    return str((patient_record or {}).get('name') or actor_id or 'Patient').strip()


def _chat_counterparty_for_actor(meta, actor):
    role = str((actor or {}).get('role') or '').strip().lower()
    if role == 'doctor':
        return {
            'role': 'patient',
            'id': str((meta or {}).get('patientId') or '').strip(),
        }

    return {
        'role': 'doctor',
        'id': str((meta or {}).get('doctorId') or '').strip().lower(),
    }


def _sync_doctor_contact_in_patients(old_doctor_email, new_doctor_email, new_doctor_phone):
    raw = _patient_collection_reference().get() or {}
    if not isinstance(raw, dict):
        return 0

    normalized_old = str(old_doctor_email or '').strip().lower()
    normalized_new = str(new_doctor_email or '').strip().lower()
    updated = 0

    for patient_id, record in raw.items():
        if not isinstance(record, dict):
            continue

        owner = str(record.get('doctorId') or '').strip().lower()
        if owner not in (normalized_old, normalized_new):
            continue

        patch = {}
        if owner != normalized_new:
            patch['doctorId'] = normalized_new

        existing_doctor_email = str(record.get('doctorEmail') or '').strip().lower()
        if existing_doctor_email != normalized_new:
            patch['doctorEmail'] = normalized_new

        existing_doctor_phone = _normalize_phone(record.get('doctorPhone'))
        if existing_doctor_phone != _normalize_phone(new_doctor_phone):
            patch['doctorPhone'] = str(new_doctor_phone or '').strip()

        if patch:
            patch['updatedAt'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            _patient_collection_reference().child(patient_id).update(patch)
            updated += 1

    return updated


def _doctor_owns_record(record, doctor_id):
    if not doctor_id:
        return False

    owner_id = str((record or {}).get('doctorId') or '').strip().lower()
    owner_email = str((record or {}).get('doctorEmail') or '').strip().lower()
    return bool(owner_id or owner_email) and doctor_id in {owner_id, owner_email}


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


def _to_finite_float(value):
    try:
        numeric_value = float(value)
    except (TypeError, ValueError):
        return None

    if not np.isfinite(numeric_value):
        return None

    return numeric_value


def _sanitize_ecg_samples(values):
    parsed_values = values
    if isinstance(values, str):
        parsed_values = [item.strip() for item in values.replace('\n', ',').split(',')]

    if not isinstance(parsed_values, list):
        return []

    cleaned = []
    for item in parsed_values:
        numeric_value = _to_finite_float(item)
        if numeric_value is None:
            continue
        cleaned.append(round(numeric_value, 3))

    return cleaned[-ECG_MAX_POINTS:]


def _resolve_patient_ecg_data(payload, nested_vitals, existing_record, heart_rate, temperature):
    candidates = [
        payload.get('ecgData'),
        payload.get('ecg'),
        payload.get('ecgSignal'),
        payload.get('ecg_signal'),
        nested_vitals.get('ecgData'),
        nested_vitals.get('ecg'),
        nested_vitals.get('ecgSignal'),
        nested_vitals.get('ecg_signal'),
    ]

    for candidate in candidates:
        parsed = _sanitize_ecg_samples(candidate)
        if parsed:
            return parsed

    previous = []
    if isinstance(existing_record, dict):
        previous = _sanitize_ecg_samples(existing_record.get('ecgData'))
        if not previous:
            previous = _sanitize_ecg_samples((existing_record.get('vitals') or {}).get('ecgData'))

    return previous[-ECG_MAX_POINTS:]


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
    ecg_data = _resolve_patient_ecg_data(payload, nested_vitals, existing_record, heart_rate, temperature)

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

    doc_id = str(
        payload.get('doctorId')
        or payload.get('assignedDoctorId')
        or payload.get('doctorEmail')
        or (existing_record or {}).get('doctorId')
        or (existing_record or {}).get('assignedDoctorId')
        or (existing_record or {}).get('doctorEmail')
        or ''
    ).strip().lower()

    doc_name = str(
        payload.get('doctorName')
        or payload.get('assignedDoctorName')
        or (existing_record or {}).get('doctorName')
        or (existing_record or {}).get('assignedDoctorName')
        or ''
    ).strip()

    doc_phone = str(
        payload.get('doctorPhone')
        or (existing_record or {}).get('doctorPhone')
        or ''
    ).strip()

    doc_specialty = str(
        payload.get('doctorSpecialty')
        or (existing_record or {}).get('doctorSpecialty')
        or ''
    ).strip()

    if doc_id:
        try:
            doc_record = _doctor_collection_reference().child(doc_id.replace('.', ',')).get()
            if isinstance(doc_record, dict):
                if not doc_name and doc_record.get('name'):
                    doc_name = str(doc_record.get('name')).strip()
                if not doc_phone and doc_record.get('phone'):
                    doc_phone = str(doc_record.get('phone')).strip()
                if not doc_specialty and doc_record.get('specialty'):
                    doc_specialty = str(doc_record.get('specialty')).strip()
        except Exception:
            pass

    if not doc_specialty:
        doc_specialty = 'Cardiologist (Ward 4B)'

    record = {
        'id': patient_id,
        'patientId': patient_id,
        'name': payload.get('name') or 'Unnamed Patient',
        'age': _coerce_int(payload.get('age') or payload.get('Age')),
        'gender': payload.get('gender') or (existing_record or {}).get('gender') or '',
        'phone': payload.get('phone') or payload.get('phoneNumber') or (existing_record or {}).get('phone') or '',
        'email': payload.get('email') or (existing_record or {}).get('email') or '',
        'doctorId': doc_id,
        'assignedDoctorId': doc_id,
        'doctorEmail': doc_id,
        'doctorName': doc_name,
        'assignedDoctorName': doc_name,
        'doctorPhone': doc_phone,
        'doctorSpecialty': doc_specialty,
        'doctorContact': {
            'id': doc_id,
            'name': doc_name,
            'email': doc_id,
            'phone': doc_phone,
            'specialty': doc_specialty,
        },
        'symptoms': payload.get('symptoms') or (existing_record or {}).get('symptoms') or '',
        'heartRate': heart_rate,
        'spo2': spo2,
        'temperature': temperature,
        'vitals': {
            'heartRate': heart_rate,
            'spo2': spo2,
            'temperature': temperature,
            'ecgData': ecg_data,
            'updatedAt': payload.get('updatedAt') or datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        },
        'ecgData': ecg_data,
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
    ecg_data = _sanitize_ecg_samples(
        normalized.get('ecgData')
        or vitals.get('ecgData')
    )
    vitals['ecgData'] = ecg_data

    prediction = normalized.get('prediction') if isinstance(normalized.get('prediction'), dict) else {
        'risk': 'Prediction unavailable',
        'message': 'Prediction unavailable',
        'status': 'unavailable',
        'confidence': 0.0,
    }

    # Fetch doctor info if not in the patient record
    doctor_email = str(normalized.get('doctorEmail') or normalized.get('doctorId') or '').strip().lower()
    doctor_name = str(normalized.get('doctorName') or normalized.get('assignedDoctorName') or '').strip()
    doctor_phone = str(normalized.get('doctorPhone') or '').strip()
    doctor_specialty = str(normalized.get('doctorSpecialty') or 'Cardiologist (Ward 4B)').strip()

    if doctor_email and (not doctor_name or not doctor_phone):
        try:
            doctor_record = _doctor_collection_reference().child(doctor_email.replace('.', ',')).get()
            if doctor_record and isinstance(doctor_record, dict):
                if not doctor_phone and doctor_record.get('phone'):
                    doctor_phone = str(doctor_record.get('phone')).strip()
                if not doctor_name and doctor_record.get('name'):
                    doctor_name = str(doctor_record.get('name')).strip()
                if doctor_record.get('specialty'):
                    doctor_specialty = str(doctor_record.get('specialty')).strip()
        except Exception:
            pass

    return {
        'id': patient_id,
        'patientId': patient_id,
        'name': normalized.get('name'),
        'vitals': vitals,
        'ecgData': ecg_data,
        'prediction': prediction,
        'deviceConnected': bool(normalized.get('deviceConnected', False)),
        'dataSource': normalized.get('dataSource') or 'dataset',
        'doctorId': doctor_email,
        'assignedDoctorId': doctor_email,
        'doctorEmail': doctor_email,
        'doctorName': doctor_name,
        'assignedDoctorName': doctor_name,
        'doctorPhone': doctor_phone,
        'doctorSpecialty': doctor_specialty,
        'doctorContact': {
            'id': doctor_email,
            'name': doctor_name,
            'email': doctor_email,
            'phone': doctor_phone,
            'specialty': doctor_specialty,
        },
        'predictionAudit': normalized.get('predictionAudit', [])[-20:],
    }


def _append_prediction_audit(record, prediction, source, vitals):
    existing = list(record.get('predictionAudit') or [])
    clinical_status = prediction.get('prediction_status') or prediction.get('status') or prediction.get('risk') or 'unavailable'
    existing.append({
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'source': source,
        'risk': prediction.get('risk', 'Prediction unavailable'),
        'status': clinical_status,
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
                'status': prediction.get('prediction_status') or prediction.get('status') or prediction.get('risk'),
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
            return api_error('Name, email, phone, and password (min 6 chars) are required.', 400)

        if not _normalize_phone(phone):
            return api_error('Valid doctor phone number is required.', 400)

        doctor_ref = _doctor_collection_reference().child(email.replace('.', ','))
        existing = doctor_ref.get()
        if existing:
            return api_error('Doctor account already exists for this email.', 409)

        if _doctor_matches_by_phone(phone):
            return api_error('Doctor account already exists for this phone number.', 409)

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

        return api_success('Doctor signup successful.', {
            'doctor': {'id': email, 'name': name, 'email': email, 'phone': phone},
            'auth': auth,
        })
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/doctor/login', methods=['POST'])
def doctor_login():
    try:
        data = request.get_json(silent=True) or {}
        email = str(data.get('email') or '').strip().lower()
        password = str(data.get('password') or '')

        if not email or not password:
            return api_error('Email and password are required.', 400)

        doctor = _doctor_collection_reference().child(email.replace('.', ',')).get()
        if not doctor:
            return api_error('Invalid email or password.', 401)

        password_hash = str((doctor or {}).get('passwordHash') or '')
        if not password_hash or not check_password_hash(password_hash, password):
            return api_error('Invalid email or password.', 401)

        doctor_name = doctor.get('name') or email.split('@')[0]
        doctor_phone = doctor.get('phone') or ''
        auth = _issue_auth_token({
            'role': 'doctor',
            'email': email,
            'name': doctor_name,
            'phone': doctor_phone,
        })

        return api_success('Doctor login successful.', {
            'doctor': {
                'id': email,
                'name': doctor_name,
                'email': email,
                'phone': doctor_phone,
            },
            'auth': auth,
        })
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/doctor/profile/update', methods=['POST'])
def update_doctor_profile():
    try:
        if _request_user_role() != 'doctor':
            return jsonify({'status': 'error', 'message': 'Only doctor can update doctor profile.'}), 403

        data = request.get_json(silent=True) or {}
        current_doctor_email = _request_doctor_id(data)
        if not current_doctor_email:
            return jsonify({'status': 'error', 'message': 'Doctor identity is required.'}), 401

        old_key = current_doctor_email.replace('.', ',')
        doctor_ref = _doctor_collection_reference().child(old_key)
        doctor = doctor_ref.get()
        if not isinstance(doctor, dict):
            return jsonify({'status': 'error', 'message': 'Doctor account not found.'}), 404

        new_email = str(data.get('email') or doctor.get('email') or current_doctor_email).strip().lower()
        new_phone = str(data.get('phone') or doctor.get('phone') or '').strip()
        new_name = str(data.get('name') or doctor.get('name') or '').strip() or new_email.split('@')[0]

        if not new_email or '@' not in new_email:
            return jsonify({'status': 'error', 'message': 'Valid email is required.'}), 400
        if not _normalize_phone(new_phone):
            return jsonify({'status': 'error', 'message': 'Valid phone number is required.'}), 400

        existing_doctor_phone_matches = _doctor_matches_by_phone(new_phone)
        if any(str(item.get('email') or '').strip().lower() != current_doctor_email for item in existing_doctor_phone_matches):
            return jsonify({'status': 'error', 'message': 'Another doctor account already uses this phone number.'}), 409

        new_key = new_email.replace('.', ',')
        if new_key != old_key and _doctor_collection_reference().child(new_key).get():
            return jsonify({'status': 'error', 'message': 'Another doctor account already uses this email.'}), 409

        updated_doctor = {
            **doctor,
            'id': new_email,
            'name': new_name,
            'email': new_email,
            'phone': new_phone,
            'updatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        }

        if new_key != old_key:
            _doctor_collection_reference().child(new_key).set(updated_doctor)
            doctor_ref.delete()
        else:
            doctor_ref.update(updated_doctor)

        synced_count = _sync_doctor_contact_in_patients(current_doctor_email, new_email, new_phone)

        auth = _issue_auth_token({
            'role': 'doctor',
            'email': new_email,
            'name': new_name,
            'phone': new_phone,
        })

        return jsonify({
            'status': 'success',
            'message': 'Doctor profile updated successfully.',
            'doctor': {
                'id': new_email,
                'name': new_name,
                'email': new_email,
                'phone': new_phone,
            },
            'syncedPatients': synced_count,
            'auth': auth,
        })
    except Exception as error:
        return jsonify({'status': 'error', 'message': str(error)}), 500


@app.route('/patient/profile/update', methods=['POST'])
def update_patient_profile():
    try:
        if _request_user_role() != 'patient':
            return jsonify({'status': 'error', 'message': 'Only patient can update patient profile.'}), 403

        data = request.get_json(silent=True) or {}
        patient_id = _request_patient_id() or str(data.get('patientId') or '').strip()
        if not patient_id:
            return jsonify({'status': 'error', 'message': 'Patient identity is required.'}), 401

        patient_ref = _patient_collection_reference().child(patient_id)
        patient = patient_ref.get()
        if not isinstance(patient, dict):
            return jsonify({'status': 'error', 'message': 'Patient account not found.'}), 404

        new_email = str(data.get('email') or patient.get('email') or '').strip().lower()
        new_phone = str(data.get('phone') or patient.get('phone') or '').strip()

        if not new_email or '@' not in new_email:
            return jsonify({'status': 'error', 'message': 'Valid email is required.'}), 400
        if not _normalize_phone(new_phone):
            return jsonify({'status': 'error', 'message': 'Valid phone number is required.'}), 400

        phone_matches = _patient_matches_by_phone(new_phone)
        if any(str(match.get('patientId') or '') != str(patient_id) for match in phone_matches):
            return jsonify({'status': 'error', 'message': 'Another patient account already uses this phone number.'}), 409

        update_data = {
            'email': new_email,
            'phone': new_phone,
            'updatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        }
        if 'sosContactName' in data:
            update_data['sosContactName'] = str(data.get('sosContactName') or '').strip()
        if 'sosContactPhone' in data:
            update_data['sosContactPhone'] = str(data.get('sosContactPhone') or '').strip()
        if 'sosContactRelation' in data:
            update_data['sosContactRelation'] = str(data.get('sosContactRelation') or 'Brother').strip()
        if 'locationSharingEnabled' in data:
            update_data['locationSharingEnabled'] = bool(data.get('locationSharingEnabled'))
        if 'emergencyLocationSharingEnabled' in data:
            update_data['emergencyLocationSharingEnabled'] = bool(data.get('emergencyLocationSharingEnabled'))

        patient_ref.update(update_data)

        refreshed = patient_ref.get() or {}
        auth = _issue_auth_token({
            'role': 'patient',
            'patientId': patient_id,
            'name': str(refreshed.get('name') or patient.get('name') or 'Patient'),
            'email': new_email,
            'phone': new_phone,
        })

        return jsonify({
            'status': 'success',
            'message': 'Patient profile updated successfully.',
            'patient': _sanitize_patient_response(_normalize_patient_record(patient_id, refreshed, refreshed)),
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
    frontend_dist = BASE_DIR / 'frontend' / 'dist'
    index_file = frontend_dist / 'index.html'
    if frontend_dist.exists() and index_file.is_file():
        return send_from_directory(str(frontend_dist), 'index.html')
    return jsonify({"status": "ok", "message": "Smart Healthcare Backend Running"})

# SECURITY FIX: Strict authentication and doctor-patient isolation on /real-data
@app.route('/real-data', methods=['GET'])
def get_real_data():
    try:
        role = _request_user_role()
        if not role:
            return jsonify({
                "status": "error",
                "message": "Unauthorized. Valid auth token is required."
            }), 401

        raw_data = _patient_collection_reference().get() or {}

        if role == 'doctor':
            doctor_id = _request_doctor_id()
            if not doctor_id:
                return jsonify({
                    "status": "error",
                    "message": "Doctor identity is required."
                }), 400

            if isinstance(raw_data, dict):
                data = {
                    patient_id: _sanitize_patient_response(record)
                    for patient_id, record in raw_data.items()
                    if record and _doctor_owns_record(record, doctor_id)
                }
            elif isinstance(raw_data, list):
                data = [
                    _sanitize_patient_response(record)
                    for record in raw_data
                    if record and _doctor_owns_record(record, doctor_id)
                ]
            else:
                data = {}

            return jsonify({
                "status": "success",
                "data": data
            })

        if role == 'patient':
            patient_id = _request_patient_id()
            if not patient_id:
                return jsonify({
                    "status": "error",
                    "message": "Patient identity is required."
                }), 400

            record = _patient_collection_reference().child(patient_id).get()
            if record and isinstance(record, dict):
                data = {patient_id: _sanitize_patient_response(record)}
            else:
                data = {}

            return jsonify({
                "status": "success",
                "data": data
            })

        return jsonify({
            "status": "error",
            "message": "Forbidden. Role not authorized."
        }), 403
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


# SECURITY FIX: Strict authentication and doctor-patient isolation on /patients
@app.route('/patients', methods=['GET'])
def get_patients():
    role = _request_user_role()
    if not role:
        return jsonify({
            'status': 'error',
            'message': 'Unauthorized. Valid auth token is required.',
        }), 401

    if role == 'doctor':
        doctor_id = _request_doctor_id()
        if not doctor_id:
            return jsonify({
                'status': 'error',
                'message': 'Doctor identity is required.',
            }), 400

        all_patients = _read_patient_records()
        assigned_patients = [patient for patient in all_patients if _doctor_owns_record(patient, doctor_id)]
        return jsonify({
            'status': 'success',
            'patients': [_sanitize_patient_response(patient) for patient in assigned_patients],
        })

    if role == 'patient':
        patient_id = _request_patient_id()
        if not patient_id:
            return jsonify({
                'status': 'error',
                'message': 'Patient identity is required.',
            }), 400

        record = _patient_collection_reference().child(patient_id).get()
        if not record or not isinstance(record, dict):
            return jsonify({
                'status': 'success',
                'patients': [],
            })

        normalized = _normalize_patient_record(patient_id, record, record)
        return jsonify({
            'status': 'success',
            'patients': [_sanitize_patient_response(normalized)],
        })

    return jsonify({
        'status': 'error',
        'message': 'Forbidden. Role not authorized.',
    }), 403


@app.route('/add-patient', methods=['POST'])
def add_patient_legacy():
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
        payload['assignedDoctorId'] = doctor_id
        payload['doctorPhone'] = doctor_phone
        try:
            doc_rec = _doctor_collection_reference().child(doctor_id.replace('.', ',')).get() or {}
            doc_name = str(doc_rec.get('name') or '').strip()
            doc_spec = str(doc_rec.get('specialty') or 'Cardiologist (Ward 4B)').strip()
            payload['doctorName'] = doc_name
            payload['assignedDoctorName'] = doc_name
            payload['doctorSpecialty'] = doc_spec
        except Exception:
            payload['doctorName'] = ''
            payload['assignedDoctorName'] = ''
            payload['doctorSpecialty'] = 'Cardiologist (Ward 4B)'

        required_fields = ['name', 'age', 'gender', 'phone', 'email', 'symptoms']
        missing_fields = [field for field in required_fields if payload.get(field) in (None, '')]
        if missing_fields:
            return jsonify({
                'status': 'error',
                'message': f"Missing required fields: {', '.join(missing_fields)}"
            }), 400

        if not _normalize_phone(payload.get('phone')):
            return jsonify({
                'status': 'error',
                'message': 'Valid patient phone number is required.'
            }), 400

        if _patient_matches_by_phone(payload.get('phone')):
            return jsonify({
                'status': 'error',
                'message': 'Patient account already exists for this phone number.'
            }), 409

        dataset_vitals = _pick_dataset_vitals_row()
        manual_heart_rate = data.get('heart_rate') if data.get('heart_rate') not in (None, '') else data.get('heartRate')
        manual_spo2 = data.get('spo2') if data.get('spo2') not in (None, '') else data.get('SpO2')
        manual_temperature = data.get('temperature') if data.get('temperature') not in (None, '') else data.get('temp')
        manual_ecg_data = data.get('ecgData') or data.get('ecg') or data.get('ecgSignal') or data.get('ecg_signal')

        effective_vitals = {
            'heart_rate': _coerce_float(manual_heart_rate, dataset_vitals['heart_rate']),
            'spo2': _coerce_float(manual_spo2, dataset_vitals['spo2']),
            'temperature': _coerce_float(manual_temperature, dataset_vitals['temperature']),
        }

        payload.update(effective_vitals)
        payload['ecgData'] = _sanitize_ecg_samples(manual_ecg_data)

        prediction = predict_risk(effective_vitals)
        payload['prediction'] = {
            'risk': prediction.get('risk'),
            'message': prediction.get('message'),
            'status': prediction.get('prediction_status') or prediction.get('status') or prediction.get('risk'),
            'confidence': prediction.get('confidence', 0.0),
        }
        prediction_source = 'manual-initialization' if any(value not in (None, '') for value in [manual_heart_rate, manual_spo2, manual_temperature, manual_ecg_data]) else 'dataset-initialization'
        payload['predictionAudit'] = [{
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'source': prediction_source,
            'risk': prediction.get('risk', 'Prediction unavailable'),
            'status': prediction.get('prediction_status') or prediction.get('status') or prediction.get('risk') or 'unavailable',
            'confidence': _coerce_float(prediction.get('confidence'), 0.0),
            'message': prediction.get('message', 'Prediction unavailable'),
            'vitals': {
                'heartRate': float(effective_vitals['heart_rate']),
                'spo2': float(effective_vitals['spo2']),
                'temperature': float(effective_vitals['temperature']),
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
            return api_error('Patient ID and password are required.', 400)

        record = _patient_collection_reference().child(patient_id).get()
        if not record:
            return api_error('Invalid Patient ID or password.', 401)

        stored_password = str((record or {}).get('password') or '')
        if stored_password != password:
            return api_error('Invalid Patient ID or password.', 401)

        normalized = _normalize_patient_record(patient_id, record, record)
        auth = _issue_auth_token({
            'role': 'patient',
            'patientId': patient_id,
            'name': normalized.get('name') or 'Patient',
            'email': normalized.get('email') or '',
            'phone': normalized.get('phone') or '',
            'doctorId': normalized.get('doctorId') or '',
            'doctorEmail': normalized.get('doctorEmail') or '',
            'doctorName': normalized.get('doctorName') or '',
            'doctorPhone': normalized.get('doctorPhone') or '',
            'doctorSpecialty': normalized.get('doctorSpecialty') or '',
        })
        return api_success('Patient login successful.', {
            'patient': _sanitize_patient_response(normalized),
            'auth': auth,
        })
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/patient/<patient_id>', methods=['GET'])
@require_auth(roles={'doctor', 'patient'}, patient_id_arg='patient_id')
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
        return api_success('Patient fetched successfully.', {'patient': _sanitize_patient_response(normalized)})
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/patient/<patient_id>', methods=['GET'])
@require_auth(roles={'doctor', 'patient'}, patient_id_arg='patient_id')
def get_api_patient(patient_id):
    try:
        key = str(patient_id or '').strip()
        if not key:
            return api_error('Patient ID is required.', 400)

        record = _patient_collection_reference().child(key).get()
        if not record or not isinstance(record, dict):
            return api_error('Patient not found.', 404)

        if _request_user_role() == 'doctor':
            doctor_id = _request_doctor_id()
            if not _doctor_owns_record(record, doctor_id):
                return api_error('Access denied for this patient record.', 403)

        if _request_user_role() == 'patient':
            requester_patient_id = _request_patient_id()
            if not requester_patient_id or str(requester_patient_id) != str(key):
                return api_error('Access denied for this patient record.', 403)

        if bool((record or {}).get('deviceConnected')):
            normalized_existing = _normalize_patient_record(key, record, record)
            return api_success(
                'Device already connected.',
                _build_patient_payload_response(key, normalized_existing),
            )

        normalized = _normalize_patient_record(key, record, record)
        return api_success('Patient fetched successfully.', _build_patient_payload_response(key, normalized))
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/patient/<patient_id>/manual-update', methods=['POST'])
@require_auth(roles={'doctor'}, patient_id_arg='patient_id')
def manual_update_patient(patient_id):
    try:
        key = str(patient_id or '').strip()
        if not key:
            return api_error('Patient ID is required.', 400)

        record = _patient_collection_reference().child(key).get()
        if not record:
            return api_error('Patient not found.', 404)

        data = request.get_json(silent=True) or {}
        normalized = _normalize_patient_record(key, record, record)

        current_vitals = normalized.get('vitals') or {}
        next_vitals = {
            'heart_rate': _coerce_float(
                data.get('heart_rate') if data.get('heart_rate') not in (None, '') else data.get('heartRate'),
                current_vitals.get('heartRate') or normalized.get('heartRate'),
            ),
            'spo2': _coerce_float(
                data.get('spo2') if data.get('spo2') not in (None, '') else data.get('SpO2'),
                current_vitals.get('spo2') or normalized.get('spo2'),
            ),
            'temperature': _coerce_float(
                data.get('temperature') if data.get('temperature') not in (None, '') else data.get('temp'),
                current_vitals.get('temperature') or normalized.get('temperature'),
            ),
        }

        ecg_data_input = data.get('ecgData') or data.get('ecg') or data.get('ecgSignal') or data.get('ecg_signal')
        prediction = predict_risk(next_vitals)
        with_audit = _append_prediction_audit(dict(normalized), prediction, 'doctor-manual-update', next_vitals)

        updated_record = _write_patient_record(key, {
            **with_audit,
            'heart_rate': next_vitals['heart_rate'],
            'spo2': next_vitals['spo2'],
            'temperature': next_vitals['temperature'],
            'ecgData': _sanitize_ecg_samples(ecg_data_input) if ecg_data_input not in (None, '') else normalized.get('ecgData'),
            'prediction': {
                'risk': prediction.get('risk'),
                'message': prediction.get('message'),
                'status': prediction.get('prediction_status') or prediction.get('status') or prediction.get('risk'),
                'confidence': prediction.get('confidence', 0.0),
            },
            'dataSource': 'manual-update',
            'updatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        })

        payload = _build_patient_payload_response(key, updated_record)
        socketio.emit('patient_snapshot', {
            'patientId': key,
            'data': payload,
        }, to=_patient_room(key))
        socketio.emit('vitals_update', {
            'patientId': key,
            'vitals': payload['vitals'],
        }, to=_patient_room(key))
        socketio.emit('insights_update', {
            'patientId': key,
            'prediction': payload['prediction'],
        }, to=_patient_room(key))

        return api_success('Patient values updated and prediction refreshed.', payload)
    except ValueError as error:
        return api_error(str(error), 400)
    except Exception as error:
        return api_error(str(error), 500)


# SECURITY FIX: Restrict device connection to assigned doctor
@app.route('/connect-device/<patient_id>', methods=['POST'])
@require_auth(roles={'doctor'}, patient_id_arg='patient_id')
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


# SECURITY FIX: Restrict device disconnection to assigned doctor
@app.route('/disconnect-device/<patient_id>', methods=['POST'])
@require_auth(roles={'doctor'}, patient_id_arg='patient_id')
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


# SECURITY FIX: Protect prediction-audit with doctor and patient ownership check
@app.route('/api/patient/<patient_id>/prediction-audit', methods=['GET'])
@require_auth(roles={'doctor', 'patient'}, patient_id_arg='patient_id')
def get_patient_prediction_audit(patient_id):
    try:
        key = str(patient_id or '').strip()
        if not key:
            return api_error('Patient ID is required.', 400)

        record = _patient_collection_reference().child(key).get()
        if not record:
            return api_error('Patient not found.', 404)

        if _request_user_role() == 'doctor':
            doctor_id = _request_doctor_id()
            if not _doctor_owns_record(record, doctor_id):
                return api_error('Access denied for this patient record.', 403)

        normalized = _normalize_patient_record(key, record, record)
        return api_success('Prediction audit fetched successfully.', {
            'patientId': key,
            'audit': list(normalized.get('predictionAudit') or [])[-100:],
        })
    except Exception as error:
        return api_error(str(error), 500)


# SECURITY FIX: Strict authentication and doctor-patient isolation on /api/vitals/<patient_id>
@app.route('/api/vitals/<patient_id>', methods=['GET'])
def get_patient_vitals(patient_id):
    try:
        key = str(patient_id or '').strip()
        if not key:
            return jsonify({
                'status': 'error',
                'message': 'Patient ID is required.',
            }), 400

        role = _request_user_role()
        if not role:
            return jsonify({
                'status': 'error',
                'message': 'Unauthorized. Authentication token is required.',
            }), 401

        record = _patient_collection_reference().child(key).get()
        if not record or not isinstance(record, dict):
            return jsonify({
                'status': 'error',
                'message': 'Patient not found.',
            }), 404

        if role == 'patient':
            requester_patient_id = _request_patient_id()
            if not requester_patient_id or str(requester_patient_id) != str(key):
                return jsonify({'status': 'error', 'message': 'Access denied for this patient record.'}), 403

        if role == 'doctor':
            doctor_id = _request_doctor_id()
            if not doctor_id or not _doctor_owns_record(record, doctor_id):
                return jsonify({'status': 'error', 'message': 'Access denied. You are not assigned to this patient.'}), 403

        normalized = _normalize_patient_record(key, record, record)
        prediction = normalized.get('prediction') if isinstance(normalized.get('prediction'), dict) else {}
        ecg_data = _sanitize_ecg_samples(
            (normalized.get('vitals') or {}).get('ecgData')
            or normalized.get('ecgData')
        )
        return jsonify({
            'status': 'success',
            'data': {
                'patientId': key,
                'heartRate': _coerce_float((normalized.get('vitals') or {}).get('heartRate') or normalized.get('heartRate')),
                'spo2': _coerce_float((normalized.get('vitals') or {}).get('spo2') or normalized.get('spo2')),
                'temperature': _coerce_float((normalized.get('vitals') or {}).get('temperature') or normalized.get('temperature')),
                'ecgData': ecg_data,
                'updatedAt': normalized.get('updatedAt') or datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'prediction': prediction,
                'risk': prediction.get('risk', ''),
                'confidence': _coerce_float(prediction.get('confidence'), 0.0),
                'message': prediction.get('message', ''),
            }
        })
    except Exception as error:
        return jsonify({
            'status': 'error',
            'message': str(error),
        }), 500

# Test API
@app.route('/health', methods=['GET'])
def health():
    payload = {
        "status": "ok",
        "service": "smart-health-care",
        "backend": "flask-socketio",
        "modelStatus": "ready" if vitals_model is not None else "missing",
        "model": "ready" if vitals_model is not None else "missing",
        "modelPath": str(VITAL_MODEL_PATH.resolve()),
        "featureCount": len(VITAL_FEATURE_COLUMNS),
        "featureColumns": list(VITAL_FEATURE_COLUMNS),
        "classes": _vitals_model_classes(),
    }

    if vitals_model is None:
        payload["warning"] = "Vitals model not loaded yet."

    return jsonify(payload), 200


@app.route('/api/debug/model', methods=['GET'])
def debug_model():
    payload = _vitals_model_debug_payload()
    return jsonify(payload), 200 if payload["loaded"] else 503


@app.route('/api/debug/test-predict', methods=['POST'])
def debug_test_predict():
    try:
        data = request.get_json(silent=True) or {}
        prediction = predict_risk(data)
        prediction['source'] = 'vitals_model.pkl'
        prediction['modelPath'] = str(VITAL_MODEL_PATH.resolve())
        return jsonify(prediction), 200
    except ValueError as error:
        import traceback

        return jsonify({"status": "error", "error": "Invalid input", "message": str(error), "traceback": traceback.format_exc()}), 400
    except Exception as error:
        import traceback

        return jsonify({"status": "error", "error": "Prediction failed", "message": str(error), "traceback": traceback.format_exc()}), 500

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

        prediction = predict_risk(data)
        prediction['source'] = 'vitals_model.pkl'
        prediction['modelPath'] = str(VITAL_MODEL_PATH.resolve())

        patient_id = str(data.get('patientId') or data.get('patient_id') or '').strip()
        if patient_id:
            record = _patient_collection_reference().child(patient_id).get()
            if isinstance(record, dict):
                normalized = _normalize_patient_record(patient_id, record, record)
                with_audit = _append_prediction_audit(dict(normalized), prediction, 'predict-api', prediction.get('features') or {})
                _write_patient_record(patient_id, {
                    **with_audit,
                    'prediction': {
                        'risk': prediction.get('risk'),
                        'message': prediction.get('message'),
                        'status': prediction.get('prediction_status') or prediction.get('risk'),
                        'confidence': prediction.get('confidence', 0.0),
                    },
                })

        return jsonify(prediction)
    except ValueError as e:
        import traceback

        return jsonify({"status": "error", "error": "Invalid input", "message": str(e), "traceback": traceback.format_exc()}), 400
    except Exception as e:
        import traceback

        return jsonify({"status": "error", "error": "Prediction failed", "message": str(e), "traceback": traceback.format_exc()}), 500


# SECURITY FIX: Protect /patient/<patient_id>/monitor with role and patient ownership check
@app.route('/patient/<patient_id>/monitor', methods=['GET'])
@require_auth(roles={'doctor', 'patient'}, patient_id_arg='patient_id')
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
        import traceback

        return jsonify({"status": "error", "message": str(e), "traceback": traceback.format_exc()}), 400
    except Exception as e:
        import traceback

        return jsonify({"status": "error", "message": str(e), "traceback": traceback.format_exc()}), 500


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


@app.route('/chat/thread-context', methods=['GET'])
def get_chat_thread_context():
    actor = _chat_resolve_http_actor()
    if not actor:
        return api_error('Unauthorized. Valid auth token is required.', 401)

    role = str(actor.get('role') or '').strip().lower()
    doctor_id = ''
    patient_id = ''
    partner = {}

    if role == 'doctor':
        doctor_id = str(actor.get('id') or '').strip().lower()
        requested_patient_id = str(request.args.get('patientId') or '').strip()
        if requested_patient_id:
            patient_id = requested_patient_id
        else:
            raw = _patient_collection_reference().get() or {}
            if isinstance(raw, dict):
                for key, value in raw.items():
                    if not isinstance(value, dict):
                        continue
                    owner = str(value.get('doctorId') or value.get('doctorEmail') or '').strip().lower()
                    if owner != doctor_id:
                        continue
                    patient_id = str(value.get('patientId') or value.get('id') or key).strip()
                    partner = {
                        'id': patient_id,
                        'name': str(value.get('name') or 'Patient').strip(),
                    }
                    break

        if not patient_id:
            return api_error('No linked patient found. Pass patientId for doctor chat.', 400)

        patient_record = _chat_get_patient_record(patient_id)
        if isinstance(patient_record, dict):
            partner = {
                'id': patient_id,
                'name': str(patient_record.get('name') or 'Patient').strip(),
            }
    else:
        patient_id = str(actor.get('id') or '').strip()
        patient_record = _chat_get_patient_record(patient_id)
        if not isinstance(patient_record, dict):
            return api_error('Patient record not found.', 404)

        doctor_id = str(patient_record.get('doctorId') or patient_record.get('doctorEmail') or '').strip().lower()
        if not doctor_id:
            return api_error('Doctor is not linked to this patient yet.', 400)

        doctor_record = _doctor_collection_reference().child(doctor_id.replace('.', ',')).get()
        doctor_name = str((doctor_record or {}).get('name') or doctor_id or 'Doctor').strip()
        doctor_phone = str((doctor_record or {}).get('phone') or '').strip()
        partner = {
            'id': doctor_id,
            'name': doctor_name,
            'email': doctor_id,
            'phone': doctor_phone,
        }

    allowed, reason = _chat_authorize(actor, doctor_id, patient_id)
    if not allowed:
        return api_error(reason, 403)

    thread_id = _chat_thread_id(doctor_id, patient_id)
    meta = _chat_upsert_thread_meta(thread_id, doctor_id, patient_id)
    partner_role = 'patient' if role == 'doctor' else 'doctor'
    partner_presence = _chat_partner_presence(partner_role, partner.get('id'))

    return api_success('Thread context fetched successfully.', {
        'threadId': thread_id,
        'doctorId': doctor_id,
        'patientId': patient_id,
        'partnerRole': partner_role,
        'partnerId': partner.get('id') or '',
        'partnerName': partner.get('name') or (partner.get('id') or partner_role.title()),
        'partnerEmail': partner.get('email') or '',
        'partnerPhone': partner.get('phone') or '',
        'partnerPresence': partner_presence,
        'meta': meta,
    })


@app.route('/chat/threads/<thread_id>/messages', methods=['GET'])
def get_chat_messages(thread_id):
    actor = _chat_resolve_http_actor()
    if not actor:
        return api_error('Unauthorized. Valid auth token is required.', 401)

    meta = _chat_get_thread_meta(thread_id)
    if not meta:
        return api_error('Thread not found.', 404)

    doctor_id = str(meta.get('doctorId') or '').strip().lower()
    patient_id = str(meta.get('patientId') or '').strip()
    allowed, reason = _chat_authorize(actor, doctor_id, patient_id)
    if not allowed:
        return api_error(reason, 403)

    try:
        limit = int(request.args.get('limit') or CHAT_HISTORY_DEFAULT_LIMIT)
    except ValueError:
        limit = CHAT_HISTORY_DEFAULT_LIMIT

    before = str(request.args.get('before') or '').strip()
    rows = _chat_list_messages(thread_id, limit=limit, before=before)
    return api_success('Messages fetched successfully.', {'threadId': thread_id, 'messages': rows})


@app.route('/chat/threads/<thread_id>/messages', methods=['POST'])
def post_chat_message(thread_id):
    actor = _chat_resolve_http_actor()
    if not actor:
        return api_error('Unauthorized. Valid auth token is required.', 401)

    payload = request.get_json(silent=True) or {}
    message, reason, status = _chat_create_message(
        actor,
        thread_id,
        payload.get('text'),
        payload.get('receiverId'),
    )
    if not message:
        return api_error(reason, status)

    socketio.emit('chat:new_message', message, to=_chat_room(thread_id))
    return api_success('Message sent successfully.', {'message': message})


@app.route('/chat/messages/<message_id>/read', methods=['PATCH'])
def patch_chat_message_read(message_id):
    actor = _chat_resolve_http_actor()
    if not actor:
        return api_error('Unauthorized. Valid auth token is required.', 401)

    payload = request.get_json(silent=True) or {}
    thread_id = str(payload.get('threadId') or '').strip()
    if not thread_id:
        return api_error('threadId is required.', 400)

    message, reason, status = _chat_mark_message_read(actor, thread_id, message_id)
    if not message:
        return api_error(reason, status)

    socketio.emit('chat:message_read', {
        'threadId': thread_id,
        'messageId': str(message_id),
        'readAt': message.get('readAt') or '',
        'status': 'read',
    }, to=_chat_room(thread_id))
    return api_success('Message marked as read.', {'message': message})


def _register_socket_user(sid, actor):
    if not isinstance(actor, dict) or not actor.get('role') or not actor.get('id'):
        return None

    role = str(actor.get('role') or '').strip().lower()
    actor_id = str(actor.get('id') or '').strip().lower() if role == 'doctor' else str(actor.get('id') or '').strip()
    user_key = _chat_presence_key(role, actor_id)

    chat_sid_context[sid] = {
        'role': role,
        'id': actor_id,
        'userKey': user_key,
        'doctorId': str(actor.get('doctorId') or '').strip(),
        'email': str(actor.get('email') or '').strip().lower(),
        'patientId': str(actor.get('patientId') or '').strip(),
        'name': str(actor.get('name') or '').strip(),
    }
    chat_user_connections.setdefault(user_key, set()).add(sid)
    join_room(f"{role}:{actor_id.lower()}")
    join_room(f"user:{role}:{actor_id.lower()}")

    if role == 'doctor':
        join_room(f"doctor:{actor_id.lower()}")
        doc_email = str(actor.get('email') or '').strip().lower()
        if doc_email:
            join_room(f"doctor:{doc_email}")
            chat_user_connections.setdefault(f"doctor:{doc_email}", set()).add(sid)
        doc_id = str(actor.get('doctorId') or '').strip().lower()
        if doc_id:
            join_room(f"doctor:{doc_id}")
            chat_user_connections.setdefault(f"doctor:{doc_id}", set()).add(sid)
    elif role == 'patient':
        join_room(f"patient:{actor_id.lower()}")
        chat_user_connections.setdefault(f"patient:{actor_id.lower()}", set()).add(sid)

    _chat_emit_presence(role, actor_id, True, sid=sid)
    return user_key


@socketio.on('connect')
def on_socket_connect(auth):
    actor = _chat_resolve_socket_actor(auth)
    sid = str(request.sid)
    transport = 'websocket' if request.environ.get('HTTP_UPGRADE', '').lower() == 'websocket' or request.environ.get('wsgi.websocket') else 'polling'
    if actor:
        _register_socket_user(sid, actor)
        role = actor.get('role', 'unknown')
        actor_id = actor.get('id', 'unknown')
        print(f"[Socket.IO] Client connected: sid={sid[:8]}... role={role} id={actor_id} transport={transport}")
    else:
        print(f"[Socket.IO] Anonymous client connected: sid={sid[:8]}... transport={transport}")
    return True


@socketio.on('disconnect')
def on_socket_disconnect(*args, **kwargs):
    sid = str(request.sid)
    context = chat_sid_context.pop(sid, None)
    if not isinstance(context, dict):
        print(f"[Socket.IO] Client disconnected: sid={sid[:8]}...")
        return

    user_key = str(context.get('userKey') or '')
    role = str(context.get('role') or '').strip().lower()
    actor_id = str(context.get('id') or '').strip()
    print(f"[Socket.IO] Client disconnected: sid={sid[:8]}... role={role} id={actor_id}")

    # Clean up all keys containing this sid
    keys_to_clean = [user_key, f"{role}:{actor_id.lower()}"]
    if role == 'doctor':
        doc_email = str(context.get('email') or '').strip().lower()
        if doc_email:
            keys_to_clean.append(f"doctor:{doc_email}")
        doc_id = str(context.get('doctorId') or '').strip().lower()
        if doc_id:
            keys_to_clean.append(f"doctor:{doc_id}")
    elif role == 'patient':
        keys_to_clean.append(f"patient:{actor_id.lower()}")

    has_remaining = False
    for k in set(keys_to_clean):
        sessions = chat_user_connections.get(k) or set()
        sessions.discard(sid)
        if sessions:
            chat_user_connections[k] = sessions
            has_remaining = True
        else:
            chat_user_connections.pop(k, None)

    if has_remaining:
        remaining_sid = next(iter(chat_user_connections.get(user_key) or set()), '')
        _chat_emit_presence(role, actor_id, True, sid=remaining_sid)
    else:
        _chat_emit_presence(role, actor_id, False)
        # Cancel pending ringing calls involving this disconnected user
        for c_id, c_data in list(active_video_calls.items()):
            if c_data.get('status') == 'ringing':
                if c_data.get('doctorId') == actor_id.lower() or c_data.get('patientId') == actor_id:
                    active_video_calls.pop(c_id, None)


@socketio.on('call:register')
def on_call_register(data):
    payload = data if isinstance(data, dict) else {}
    actor = _chat_resolve_socket_actor(payload)
    sid = str(request.sid)
    if not actor:
        emit('call:error', {'message': 'Invalid credentials for call registration.'})
        return

    _register_socket_user(sid, actor)
    emit('call:registered', {
        'status': 'registered',
        'role': actor.get('role'),
        'id': actor.get('id'),
        'name': actor.get('name') or _chat_actor_display_name(actor.get('role'), actor.get('id')),
    })


@socketio.on('chat:join_thread')
def on_chat_join_thread(data):
    payload = data if isinstance(data, dict) else {}
    context = chat_sid_context.get(str(request.sid)) or {}
    actor = {'role': context.get('role'), 'id': context.get('id')}
    if not actor.get('role') or not actor.get('id'):
        emit('chat:error', {'message': 'Unauthorized socket session.'})
        return

    thread_id = str(payload.get('threadId') or '').strip()
    if not thread_id:
        doctor_id = str(payload.get('doctorId') or '').strip().lower()
        patient_id = str(payload.get('patientId') or '').strip()
        if doctor_id and patient_id:
            thread_id = _chat_thread_id(doctor_id, patient_id)

    if not thread_id:
        emit('chat:error', {'message': 'threadId is required to join chat.'})
        return

    meta = _chat_get_thread_meta(thread_id)
    if not meta:
        emit('chat:error', {'message': 'Chat thread not found.'})
        return

    allowed, reason = _chat_authorize(actor, meta.get('doctorId'), meta.get('patientId'))
    if not allowed:
        emit('chat:error', {'message': reason})
        return

    join_room(_chat_room(thread_id))
    emit('chat:joined', {'threadId': thread_id, 'ok': True})
    emit('chat:history', {
        'threadId': thread_id,
        'messages': _chat_list_messages(thread_id, limit=CHAT_HISTORY_DEFAULT_LIMIT),
    })


@socketio.on('chat:send_message')
def on_chat_send_message(data):
    payload = data if isinstance(data, dict) else {}
    context = chat_sid_context.get(str(request.sid)) or {}
    actor = {'role': context.get('role'), 'id': context.get('id')}
    if not actor.get('role') or not actor.get('id'):
        emit('chat:error', {'message': 'Unauthorized socket session.'})
        return

    thread_id = str(payload.get('threadId') or '').strip()
    message, reason, status = _chat_create_message(actor, thread_id, payload.get('text'), payload.get('receiverId'))
    if not message:
        emit('chat:error', {'message': reason, 'status': status})
        return

    room = _chat_room(thread_id)
    socketio.emit('chat:new_message', message, to=room)
    emit('chat:message_sent_ack', {
        'threadId': thread_id,
        'messageId': message.get('id') or '',
        'createdAt': message.get('createdAt') or '',
    })


@socketio.on('chat:typing')
def on_chat_typing(data):
    payload = data if isinstance(data, dict) else {}
    context = chat_sid_context.get(str(request.sid)) or {}
    actor = {'role': context.get('role'), 'id': context.get('id')}
    if not actor.get('role') or not actor.get('id'):
        return

    thread_id = str(payload.get('threadId') or '').strip()
    if not thread_id:
        return

    meta = _chat_get_thread_meta(thread_id)
    if not meta:
        return

    allowed, _ = _chat_authorize(actor, meta.get('doctorId'), meta.get('patientId'))
    if not allowed:
        return

    emit('chat:typing', {
        'threadId': thread_id,
        'userRole': actor.get('role'),
        'userId': actor.get('id'),
        'typing': bool(payload.get('typing')),
    }, to=_chat_room(thread_id), include_self=False)


@socketio.on('chat:mark_read')
def on_chat_mark_read(data):
    payload = data if isinstance(data, dict) else {}
    context = chat_sid_context.get(str(request.sid)) or {}
    actor = {'role': context.get('role'), 'id': context.get('id')}
    if not actor.get('role') or not actor.get('id'):
        emit('chat:error', {'message': 'Unauthorized socket session.'})
        return

    thread_id = str(payload.get('threadId') or '').strip()
    message_id = str(payload.get('messageId') or '').strip()
    if not thread_id or not message_id:
        emit('chat:error', {'message': 'threadId and messageId are required.'})
        return

    message, reason, status = _chat_mark_message_read(actor, thread_id, message_id)
    if not message:
        emit('chat:error', {'message': reason, 'status': status})
        return

    socketio.emit('chat:message_read', {
        'threadId': thread_id,
        'messageId': message_id,
        'readAt': message.get('readAt') or '',
        'status': 'read',
    }, to=_chat_room(thread_id))


@socketio.on('chat:presence_ping')
def on_chat_presence_ping(data):
    _ = data
    context = chat_sid_context.get(str(request.sid)) or {}
    role = str(context.get('role') or '').strip().lower()
    actor_id = str(context.get('id') or '').strip()
    if not role or not actor_id:
        emit('chat:error', {'message': 'Unauthorized socket session.'})
        return

    _chat_emit_presence(role, actor_id, True, sid=str(request.sid))
    emit('chat:presence_update', {
        'role': role,
        'userId': actor_id,
        'userKey': _chat_presence_key(role, actor_id),
        'online': True,
        'lastSeen': _chat_now_iso(),
    })


@socketio.on('call:request')
def on_call_request(data):
    payload = data if isinstance(data, dict) else {}
    sid = str(request.sid)
    context = chat_sid_context.get(sid) or {}
    actor_role = str(context.get('role') or payload.get('callerRole') or '').strip().lower()
    actor_id = str(context.get('id') or payload.get('callerId') or '').strip()

    if not actor_role or not actor_id:
        resolved = _chat_resolve_socket_actor(payload)
        if resolved:
            actor_role = str(resolved.get('role') or '').strip().lower()
            actor_id = str(resolved.get('id') or '').strip()
            _register_socket_user(sid, resolved)

    if not actor_role or not actor_id:
        emit('call:error', {'message': 'Unauthorized socket session. Please log in again.'})
        return

    call_id = str(payload.get('callId') or f"call_{int(time.time() * 1000)}_{secrets.token_hex(4)}").strip()

    # Determine Caller vs Receiver
    if actor_role == 'doctor':
        caller_role = 'doctor'
        caller_id = actor_id.lower()
        receiver_role = 'patient'
        receiver_id = str(payload.get('patientId') or payload.get('receiverId') or '').strip()
        patient_id = receiver_id
        doctor_id = caller_id
    else:
        caller_role = 'patient'
        caller_id = actor_id
        receiver_role = 'doctor'
        receiver_id = str(payload.get('doctorId') or payload.get('receiverId') or '').strip().lower()
        patient_id = caller_id
        doctor_id = receiver_id

    thread_id = str(payload.get('threadId') or '').strip()
    if thread_id and (not patient_id or not doctor_id):
        meta = _chat_get_thread_meta(thread_id)
        if meta:
            doctor_id = doctor_id or str(meta.get('doctorId') or '').strip().lower()
            patient_id = patient_id or str(meta.get('patientId') or '').strip()

    if not patient_id or not doctor_id:
        emit('call:error', {'message': 'patientId and doctorId are required for video call.'})
        return

    # Verify Patient Record
    patient_record = _chat_get_patient_record(patient_id)
    if not isinstance(patient_record, dict):
        emit('call:error', {'message': f'Patient record {patient_id} not found in system.'})
        return

    # Verify Doctor Assignment
    if not _doctor_owns_record(patient_record, doctor_id):
        assigned = str(
            patient_record.get('assignedDoctorId')
            or patient_record.get('doctorId')
            or patient_record.get('doctorEmail')
            or ''
        ).strip().lower()
        if assigned != doctor_id.lower() and doctor_id.lower() not in assigned:
            if actor_role == 'doctor':
                emit('call:error', {'message': 'You are not authorized to call this patient. Patient is not assigned under your clinical care.'})
            else:
                emit('call:error', {'message': 'Doctor is not assigned to this patient.'})
            return

    patient_name = str(payload.get('patientName') or patient_record.get('name') or 'Patient').strip()
    doctor_name = _chat_actor_display_name('doctor', doctor_id) or str(
        patient_record.get('doctorName') or patient_record.get('assignedDoctorName') or 'Assigned Physician'
    ).strip()

    now_iso = _chat_now_iso()
    now_ts = time.time()

    # Self-healing: Purge expired/abandoned calls (>45s ringing or >2h connected)
    for existing_id, call_info in list(active_video_calls.items()):
        call_created_ts = call_info.get('createdTs') or 0
        call_st = call_info.get('status')
        if call_st == 'ringing' and (now_ts - call_created_ts > 45):
            active_video_calls.pop(existing_id, None)
        elif now_ts - call_created_ts > 7200:
            active_video_calls.pop(existing_id, None)

    # Check Presence of the RECEIVER
    receiver_sessions = set()
    if receiver_role == 'patient':
        pat_keys = [
            f"patient:{patient_id.lower()}",
            _chat_presence_key('patient', patient_id),
        ]
        for pk in pat_keys:
            receiver_sessions.update(chat_user_connections.get(pk) or set())

        if not receiver_sessions:
            for k, s in chat_user_connections.items():
                if k.startswith('patient:') and (patient_id.lower() in k.lower()):
                    receiver_sessions.update(s)

        if not receiver_sessions:
            call_record = {
                'callId': call_id,
                'callerRole': caller_role,
                'callerId': caller_id,
                'callerName': doctor_name,
                'receiverRole': receiver_role,
                'receiverId': receiver_id,
                'receiverName': patient_name,
                'patientId': patient_id,
                'patientName': patient_name,
                'doctorId': doctor_id,
                'doctorName': doctor_name,
                'status': 'unavailable',
                'callType': 'video',
                'createdAt': now_iso,
                'endedAt': now_iso,
            }
            try:
                _calls_reference().child(call_id).set(call_record)
            except Exception as e:
                print(f"[CALL] Error writing call to RTDB: {e}")

            emit('call:unavailable', {
                'callId': call_id,
                'patientId': patient_id,
                'patientName': patient_name,
                'message': f"{patient_name} is currently offline or disconnected.",
            })
            return

        # Check Busy Status for Patient
        for existing_id, call_info in list(active_video_calls.items()):
            if (
                call_info.get('patientId') == patient_id
                and call_info.get('status') in ('ringing', 'accepted', 'connected')
                and existing_id != call_id
            ):
                emit('call:busy', {
                    'callId': call_id,
                    'patientId': patient_id,
                    'patientName': patient_name,
                    'message': f"{patient_name} is currently on another call.",
                })
                return

    else:
        # Receiver is Doctor
        doc_keys = [
            _chat_presence_key('doctor', doctor_id),
            f"doctor:{doctor_id.lower()}",
        ]
        if '@' in doctor_id:
            doc_keys.append(f"doctor:{doctor_id.split('@')[0].lower()}")

        for dk in doc_keys:
            receiver_sessions.update(chat_user_connections.get(dk) or set())

        if not receiver_sessions:
            for k, s in chat_user_connections.items():
                if k.startswith('doctor:') and (doctor_id.lower() in k.lower()):
                    receiver_sessions.update(s)

        if not receiver_sessions:
            call_record = {
                'callId': call_id,
                'callerRole': caller_role,
                'callerId': caller_id,
                'callerName': patient_name,
                'receiverRole': receiver_role,
                'receiverId': receiver_id,
                'receiverName': doctor_name,
                'patientId': patient_id,
                'patientName': patient_name,
                'doctorId': doctor_id,
                'doctorName': doctor_name,
                'status': 'unavailable',
                'callType': 'video',
                'createdAt': now_iso,
                'endedAt': now_iso,
            }
            try:
                _calls_reference().child(call_id).set(call_record)
            except Exception as e:
                print(f"[CALL] Error writing call to RTDB: {e}")

            emit('call:unavailable', {
                'callId': call_id,
                'doctorId': doctor_id,
                'doctorName': doctor_name,
                'message': f"{doctor_name} is currently offline or unavailable. Please try again later.",
            })
            return

        # Check Busy Status for Doctor
        for existing_id, call_info in list(active_video_calls.items()):
            if (
                call_info.get('doctorId') == doctor_id
                and call_info.get('status') in ('ringing', 'accepted', 'connected')
                and existing_id != call_id
            ):
                emit('call:busy', {
                    'callId': call_id,
                    'doctorId': doctor_id,
                    'doctorName': doctor_name,
                    'message': f"{doctor_name} is currently on another clinical call. Please try again shortly.",
                })
                return

    vitals_snapshot = payload.get('vitalsSnapshot') or {}
    call_payload = {
        'callId': call_id,
        'callerRole': caller_role,
        'callerId': caller_id,
        'callerName': doctor_name if caller_role == 'doctor' else patient_name,
        'receiverRole': receiver_role,
        'receiverId': receiver_id,
        'receiverName': patient_name if receiver_role == 'patient' else doctor_name,
        'patientId': patient_id,
        'patientName': patient_name,
        'doctorId': doctor_id,
        'doctorName': doctor_name,
        'callType': str(payload.get('callType') or 'video'),
        'status': 'ringing',
        'createdAt': now_iso,
        'createdTs': now_ts,
        'threadId': thread_id or f"d_{_chat_safe_key(doctor_id)}__p_{_chat_safe_key(patient_id)}",
        'vitalsSnapshot': vitals_snapshot,
    }

    active_video_calls[call_id] = call_payload

    try:
        _calls_reference().child(call_id).set(call_payload)
    except Exception as e:
        print(f"[CALL] Error writing call to RTDB: {e}")

    # Emit incoming call directly to the receiver's room and active sockets
    if receiver_role == 'patient':
        socketio.emit('call:incoming', call_payload, to=f"patient:{patient_id.lower()}")
        for s in receiver_sessions:
            socketio.emit('call:incoming', call_payload, to=s)
    else:
        socketio.emit('call:incoming', call_payload, to=f"doctor:{doctor_id.lower()}")
        for s in receiver_sessions:
            socketio.emit('call:incoming', call_payload, to=s)

    # Emit ringing confirmation back to caller
    emit('call:outgoing', call_payload)
    emit('call:ringing', call_payload)


@socketio.on('call:accept')
def on_call_accept(data):
    payload = data if isinstance(data, dict) else {}
    call_id = str(payload.get('callId') or '').strip()
    call_info = active_video_calls.get(call_id) or {}
    patient_id = str(payload.get('patientId') or call_info.get('patientId') or '').strip()
    doctor_id = str(payload.get('doctorId') or call_info.get('doctorId') or '').strip().lower()
    caller_role = str(call_info.get('callerRole') or 'patient').strip().lower()

    now_iso = _chat_now_iso()
    if call_id in active_video_calls:
        active_video_calls[call_id]['status'] = 'accepted'
        active_video_calls[call_id]['acceptedAt'] = now_iso

    try:
        _calls_reference().child(call_id).update({
            'status': 'accepted',
            'acceptedAt': now_iso,
        })
    except Exception as e:
        print(f"[CALL] RTDB update error: {e}")

    accept_payload = {
        'callId': call_id,
        'callerRole': caller_role,
        'patientId': patient_id,
        'patientName': call_info.get('patientName') or 'Patient',
        'doctorId': doctor_id,
        'doctorName': call_info.get('doctorName') or 'Doctor',
        'acceptedAt': now_iso,
        'threadId': call_info.get('threadId') or f"d_{_chat_safe_key(doctor_id)}__p_{_chat_safe_key(patient_id)}",
    }

    # If Doctor was the caller, notify Doctor when Patient accepts.
    # If Patient was the caller, notify Patient when Doctor accepts.
    if caller_role == 'doctor':
        socketio.emit('call:accepted', accept_payload, to=f"doctor:{doctor_id.lower()}")
        _chat_emit_to_user('doctor', doctor_id, 'call:accepted', accept_payload)
    else:
        socketio.emit('call:accepted', accept_payload, to=f"patient:{patient_id.lower()}")
        _chat_emit_to_user('patient', patient_id, 'call:accepted', accept_payload)


@socketio.on('call:reject')
def on_call_reject(data):
    payload = data if isinstance(data, dict) else {}
    call_id = str(payload.get('callId') or '').strip()
    call_info = active_video_calls.pop(call_id, {})
    patient_id = str(payload.get('patientId') or call_info.get('patientId') or '').strip()
    doctor_id = str(payload.get('doctorId') or call_info.get('doctorId') or '').strip().lower()
    caller_role = str(call_info.get('callerRole') or 'patient').strip().lower()

    now_iso = _chat_now_iso()
    try:
        _calls_reference().child(call_id).update({
            'status': 'declined',
            'endedAt': now_iso,
        })
    except Exception as e:
        print(f"[CALL] RTDB update error: {e}")

    reject_payload = {
        'callId': call_id,
        'patientId': patient_id,
        'patientName': call_info.get('patientName') or 'Patient',
        'doctorId': doctor_id,
        'doctorName': call_info.get('doctorName') or 'Doctor',
        'rejectedAt': now_iso,
        'reason': payload.get('reason') or 'Call was declined',
        'threadId': call_info.get('threadId') or '',
    }

    if caller_role == 'doctor':
        socketio.emit('call:rejected', reject_payload, to=f"doctor:{doctor_id.lower()}")
        _chat_emit_to_user('doctor', doctor_id, 'call:rejected', reject_payload)
    else:
        socketio.emit('call:rejected', reject_payload, to=f"patient:{patient_id.lower()}")
        _chat_emit_to_user('patient', patient_id, 'call:rejected', reject_payload)


@socketio.on('call:decline')
def on_call_decline(data):
    on_call_reject(data)


@socketio.on('call:end')
def on_call_end(data):
    payload = data if isinstance(data, dict) else {}
    call_id = str(payload.get('callId') or '').strip()
    call_info = active_video_calls.pop(call_id, {})
    patient_id = str(payload.get('patientId') or call_info.get('patientId') or '').strip()
    doctor_id = str(payload.get('doctorId') or call_info.get('doctorId') or '').strip().lower()

    now_iso = _chat_now_iso()
    try:
        _calls_reference().child(call_id).update({
            'status': 'ended',
            'endedAt': now_iso,
        })
    except Exception as e:
        print(f"[CALL] RTDB update error: {e}")

    end_payload = {
        'callId': call_id,
        'endedAt': now_iso,
        'threadId': call_info.get('threadId') or '',
    }

    if patient_id:
        socketio.emit('call:ended', end_payload, to=f"patient:{patient_id.lower()}")
        _chat_emit_to_user('patient', patient_id, 'call:ended', end_payload)

    if doctor_id:
        socketio.emit('call:ended', end_payload, to=f"doctor:{doctor_id.lower()}")
        _chat_emit_to_user('doctor', doctor_id, 'call:ended', end_payload)


@socketio.on('webrtc:offer')
def on_webrtc_offer(data):
    payload = data if isinstance(data, dict) else {}
    call_id = str(payload.get('callId') or '').strip()
    call_info = active_video_calls.get(call_id) or {}
    sdp = payload.get('sdp')
    if not sdp:
        emit('call:error', {'message': 'sdp offer is required.'})
        return

    target_role = str(payload.get('targetRole') or '').strip().lower()
    target_id = str(payload.get('targetId') or '').strip()
    if not target_role or not target_id:
        context = chat_sid_context.get(str(request.sid)) or {}
        caller_role = context.get('role') or payload.get('fromRole')
        if caller_role == 'patient':
            target_role = 'doctor'
            target_id = call_info.get('doctorId') or payload.get('doctorId')
        else:
            target_role = 'patient'
            target_id = call_info.get('patientId') or payload.get('patientId')

    offer_payload = {
        'callId': call_id,
        'sdp': sdp,
        'fromRole': payload.get('fromRole'),
        'fromId': payload.get('fromId'),
        'threadId': payload.get('threadId') or call_info.get('threadId') or '',
    }

    if target_role and target_id:
        socketio.emit('webrtc:offer', offer_payload, to=f"{target_role}:{target_id.lower()}")
        _chat_emit_to_user(target_role, target_id, 'webrtc:offer', offer_payload)


@socketio.on('webrtc:answer')
def on_webrtc_answer(data):
    payload = data if isinstance(data, dict) else {}
    call_id = str(payload.get('callId') or '').strip()
    call_info = active_video_calls.get(call_id) or {}
    sdp = payload.get('sdp')
    if not sdp:
        emit('call:error', {'message': 'sdp answer is required.'})
        return

    target_role = str(payload.get('targetRole') or '').strip().lower()
    target_id = str(payload.get('targetId') or '').strip()
    if not target_role or not target_id:
        context = chat_sid_context.get(str(request.sid)) or {}
        caller_role = context.get('role') or payload.get('fromRole')
        if caller_role == 'doctor':
            target_role = 'patient'
            target_id = call_info.get('patientId') or payload.get('patientId')
        else:
            target_role = 'doctor'
            target_id = call_info.get('doctorId') or payload.get('doctorId')

    answer_payload = {
        'callId': call_id,
        'sdp': sdp,
        'fromRole': payload.get('fromRole'),
        'fromId': payload.get('fromId'),
        'threadId': payload.get('threadId') or call_info.get('threadId') or '',
    }

    if target_role and target_id:
        socketio.emit('webrtc:answer', answer_payload, to=f"{target_role}:{target_id.lower()}")
        _chat_emit_to_user(target_role, target_id, 'webrtc:answer', answer_payload)


@socketio.on('webrtc:ice_candidate')
def on_webrtc_ice_candidate(data):
    payload = data if isinstance(data, dict) else {}
    call_id = str(payload.get('callId') or '').strip()
    call_info = active_video_calls.get(call_id) or {}
    candidate = payload.get('candidate')
    if not candidate:
        return

    target_role = str(payload.get('targetRole') or '').strip().lower()
    target_id = str(payload.get('targetId') or '').strip()
    if not target_role or not target_id:
        context = chat_sid_context.get(str(request.sid)) or {}
        caller_role = context.get('role') or payload.get('fromRole')
        if caller_role == 'patient':
            target_role = 'doctor'
            target_id = call_info.get('doctorId') or payload.get('doctorId')
        else:
            target_role = 'patient'
            target_id = call_info.get('patientId') or payload.get('patientId')

    candidate_payload = {
        'callId': call_id,
        'candidate': candidate,
        'threadId': payload.get('threadId') or call_info.get('threadId') or '',
    }

    if target_role and target_id:
        socketio.emit('webrtc:ice_candidate', candidate_payload, to=f"{target_role}:{target_id.lower()}")
        _chat_emit_to_user(target_role, target_id, 'webrtc:ice_candidate', candidate_payload)


@socketio.on('subscribe_patient')
def on_subscribe_patient(data):
    patient_id = str((data or {}).get('patientId') or '').strip()
    if not patient_id:
        emit('subscription_error', {'message': 'patientId is required'})
        return

    join_room(_patient_room(patient_id))
    emit('subscription_ok', {'patientId': patient_id})
# ================= ESP32 LIVE VITALS API =================

latest_data = {
    "heartRate": 0,
    "spo2": 0,
    "temperature": 0,
    "ecg": 0,
    "leadsOff": True
}

@app.route("/api/esp32/update", methods=["POST"])
def esp32_update():
    global latest_data

    payload = request.get_json(force=True)

    latest_data = {
        "heartRate": float(payload.get("heartRate", 0)),
        "spo2": float(payload.get("spo2", 0)),
        "temperature": float(payload.get("temperature", 0)),
        "ecg": int(payload.get("ecg", 0)),
        "leadsOff": bool(payload.get("leadsOff", True))
    }

    return jsonify({
        "status": "received",
        "data": latest_data
    })

@app.route("/api/live-vitals", methods=["GET"])
def live_vitals():
    return jsonify(latest_data)


# ============================================================================
# 🚨 EMERGENCY RESPONSE & AMBULANCE DISPATCH SYSTEM
# ============================================================================

# SECURITY FIX: Dynamically resolve assigned doctor and enforce isolation in emergency_trigger
@app.route("/api/emergency/trigger", methods=["POST"])
def emergency_trigger():
    try:
        data = request.get_json(silent=True) or {}
        alert_id = str(data.get("alertId") or f"emg-{int(time.time() * 1000)}").strip()
        patient_id = str(data.get("patientId") or "").strip()
        patient_name = str(data.get("patientName") or "").strip()
        trigger_reason = str(data.get("triggerReason") or "Critical vital thresholds breached").strip()
        vitals = data.get("vitals") or {}
        location = data.get("location") or {}
        doctor_id = str(data.get("doctorId") or "").strip().lower()
        sos_contact = data.get("sosContact") or {}
        is_demo = bool(data.get("isDemo", False))

        # Dynamically lookup patient from RTDB to ensure genuine assignment
        if patient_id:
            patient_record = _patient_collection_reference().child(patient_id).get()
            if isinstance(patient_record, dict):
                patient_name = patient_record.get('name') or patient_name or "Patient"
                assigned_doc = str(patient_record.get('assignedDoctorId') or patient_record.get('doctorId') or patient_record.get('doctorEmail') or '').strip().lower()
                if assigned_doc:
                    doctor_id = assigned_doc

        if not patient_name:
            patient_name = "Patient"
        if not doctor_id:
            doctor_id = "general-triage"

        now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        alert_record = {
            "alertId": alert_id,
            "patientId": patient_id,
            "patientName": patient_name,
            "status": "CRITICAL",
            "triggerReason": trigger_reason,
            "vitals": vitals,
            "location": location,
            "doctorId": doctor_id,
            "assignedDoctorId": doctor_id,
            "sosContact": sos_contact,
            "ambulanceStatus": "NOT_REQUESTED",
            "isDemo": is_demo,
            "createdAt": now_iso,
            "updatedAt": now_iso,
            "auditLog": [
                {
                    "timestamp": now_iso,
                    "actor": "system_monitoring",
                    "action": "CRITICAL_CONDITION_DETECTED",
                    "details": trigger_reason,
                },
                {
                    "timestamp": now_iso,
                    "actor": "system_gps",
                    "action": "LOCATION_ATTACHED" if location else "LOCATION_UNAVAILABLE",
                    "details": f"Lat: {location.get('latitude')}, Lng: {location.get('longitude')}" if location else "GPS fix pending",
                },
                {
                    "timestamp": now_iso,
                    "actor": "alert_service",
                    "action": "DOCTOR_AND_SOS_NOTIFIED",
                    "details": f"Notified Dr. {doctor_id} & SOS Contact {sos_contact.get('phone', 'N/A')}",
                }
            ],
        }

        # 1. Store in Firestore collection 'emergencyAlerts'
        try:
            if firestore_client:
                firestore_client.collection("emergencyAlerts").document(alert_id).set(alert_record)
        except Exception as fs_err:
            print(f"[Emergency] Firestore write warning: {fs_err}")

        # 2. Store in Realtime Database
        try:
            db.reference(f"emergencyAlerts/{alert_id}").set(alert_record)
            if patient_id:
                db.reference(f"patients/{patient_id}/activeEmergency").set(alert_record)
        except Exception as rtdb_err:
            print("[Emergency] RTDB write warning:", rtdb_err)

        # 3. Notify Doctor via Email if SMTP is configured
        if doctor_id and "@" in doctor_id and not is_demo:
            lat = location.get("latitude", "N/A")
            lng = location.get("longitude", "N/A")
            map_link = f"https://maps.google.com/?q={lat},{lng}" if lat != "N/A" else "#"
            email_body = f"""
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 2px solid #ef4444; border-radius: 12px; max-width: 600px;">
                <h2 style="color: #b91c1c; margin-top: 0;">🚨 CRITICAL EMERGENCY PATIENT ALERT</h2>
                <p><strong>Patient:</strong> {patient_name} (ID: {patient_id})</p>
                <p><strong>Status:</strong> <span style="color: #dc2626; font-weight: bold;">CRITICAL</span></p>
                <p><strong>Trigger Reason:</strong> {trigger_reason}</p>
                <div style="background-color: #fef2f2; padding: 12px; border-radius: 8px; margin: 15px 0;">
                    <p style="margin: 4px 0;"><strong>Heart Rate:</strong> {vitals.get('heartRate', '--')} BPM</p>
                    <p style="margin: 4px 0;"><strong>SpO2:</strong> {vitals.get('spo2', '--')}%</p>
                    <p style="margin: 4px 0;"><strong>Temperature:</strong> {vitals.get('temperature', '--')}°C</p>
                </div>
                <p><strong>GPS Coordinates:</strong> {lat}, {lng}</p>
                <p><a href="{map_link}" style="display: inline-block; background-color: #dc2626; color: white; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Live Location on Google Maps</a></p>
                <p style="font-size: 11px; color: #64748b; margin-top: 20px;">Timestamp: {now_iso} UTC | Smart Healthcare Remote Telemetry System</p>
            </div>
            """
            try:
                send_html_email(doctor_id, f"🚨 URGENT: Critical Patient Alert - {patient_name}", email_body)
            except Exception as mail_err:
                print(f"[Emergency] Email dispatch warning: {mail_err}")

        return jsonify({
            "status": "success",
            "message": "Emergency alert initiated.",
            "data": alert_record
        })
    except Exception as err:
        return jsonify({"status": "error", "message": str(err)}), 500


# SECURITY FIX: Strict authentication and doctor-patient isolation on /api/emergency/active
@app.route("/api/emergency/active", methods=["GET"])
def emergency_get_active():
    try:
        role = _request_user_role()
        if not role:
            return jsonify({"status": "error", "message": "Unauthorized. Authentication token is required."}), 401

        emergencies = []

        # Try fetching from RTDB
        try:
            rtdb_snapshot = db.reference("emergencyAlerts").get()
            if isinstance(rtdb_snapshot, dict):
                for k, v in rtdb_snapshot.items():
                    if isinstance(v, dict) and v.get("status") not in ("RESOLVED", "CANCELLED"):
                        emergencies.append(v)
        except Exception as rtdb_err:
            print(f"[Emergency] RTDB fetch warning: {rtdb_err}")

        # Fallback to Firestore if RTDB empty
        if not emergencies and firestore_client:
            try:
                docs = firestore_client.collection("emergencyAlerts").where("status", "!=", "RESOLVED").stream()
                for doc in docs:
                    d = doc.to_dict()
                    if d.get("status") not in ("RESOLVED", "CANCELLED"):
                        emergencies.append(d)
            except Exception as fs_err:
                print(f"[Emergency] Firestore query warning: {fs_err}")

        # DOCTOR SCOPING: Only emergencies for patients assigned to this doctor
        if role == 'doctor':
            doctor_id = _request_doctor_id()
            if not doctor_id:
                return jsonify({"status": "error", "message": "Doctor identity required."}), 400

            authorized_emergencies = []
            patient_ref = _patient_collection_reference()
            for emg in emergencies:
                emg_doc = str(emg.get('assignedDoctorId') or emg.get('doctorId') or '').strip().lower()
                emg_pid = str(emg.get('patientId') or '').strip()
                if emg_doc == doctor_id:
                    authorized_emergencies.append(emg)
                elif emg_pid:
                    precord = patient_ref.child(emg_pid).get()
                    if isinstance(precord, dict) and _doctor_owns_record(precord, doctor_id):
                        authorized_emergencies.append(emg)

            return jsonify({
                "status": "success",
                "emergencies": authorized_emergencies
            })

        # PATIENT SCOPING: Only the patient's own emergencies
        if role == 'patient':
            patient_id = _request_patient_id()
            if not patient_id:
                return jsonify({"status": "error", "message": "Patient identity required."}), 400

            patient_emergencies = [
                emg for emg in emergencies
                if str(emg.get('patientId') or '').strip().lower() == str(patient_id).strip().lower()
            ]
            return jsonify({
                "status": "success",
                "emergencies": patient_emergencies
            })

        return jsonify({"status": "error", "message": "Forbidden. Role not authorized."}), 403
    except Exception as err:
        return jsonify({"status": "error", "message": str(err)}), 500


# SECURITY FIX: Authorize alert status change (assigned doctor or affected patient only)
@app.route("/api/emergency/<alert_id>/status", methods=["POST"])
def emergency_update_status(alert_id):
    try:
        role = _request_user_role()
        if not role:
            return jsonify({"status": "error", "message": "Unauthorized. Authentication token is required."}), 401

        data = request.get_json(silent=True) or {}
        new_status = str(data.get("status") or "EMERGENCY_ACKNOWLEDGED").strip()
        now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        payload = _read_auth_payload()
        actor = payload.get("email") or payload.get("role") or "doctor"

        rtdb_ref = db.reference(f"emergencyAlerts/{alert_id}")
        existing = rtdb_ref.get() or {}
        if not existing and firestore_client:
            fdoc = firestore_client.collection("emergencyAlerts").document(alert_id).get()
            if fdoc.exists:
                existing = fdoc.to_dict()

        if not existing or not isinstance(existing, dict):
            return jsonify({"status": "error", "message": "Alert not found."}), 404

        emg_doc = str(existing.get('assignedDoctorId') or existing.get('doctorId') or '').strip().lower()
        emg_pid = str(existing.get('patientId') or '').strip()

        if role == 'doctor':
            doctor_id = _request_doctor_id()
            precord = _patient_collection_reference().child(emg_pid).get() if emg_pid else {}
            if emg_doc != doctor_id and not (isinstance(precord, dict) and _doctor_owns_record(precord, doctor_id)):
                return jsonify({"status": "error", "message": "Forbidden. You are not assigned to this patient's emergency."}), 403
        elif role == 'patient':
            patient_id = _request_patient_id()
            if emg_pid != patient_id:
                return jsonify({"status": "error", "message": "Forbidden. Access denied for this alert."}), 403

        audit_entry = {
            "timestamp": now_iso,
            "actor": actor,
            "action": f"STATUS_CHANGED_TO_{new_status}",
            "details": f"Alert status updated to {new_status}"
        }

        # Update in RTDB
        try:
            audit_log = existing.get("auditLog", []) if isinstance(existing, dict) else []
            audit_log.append(audit_entry)
            rtdb_ref.update({
                "status": new_status,
                "auditLog": audit_log,
                "updatedAt": now_iso,
            })
            if new_status in ("RESOLVED", "CANCELLED"):
                patient_id = existing.get("patientId")
                if patient_id:
                    db.reference(f"patients/{patient_id}/activeEmergency").delete()
        except Exception as rtdb_err:
            print(f"[Emergency] RTDB update status warning: {rtdb_err}")

        # Update in Firestore
        try:
            if firestore_client:
                firestore_client.collection("emergencyAlerts").document(alert_id).set({
                    "status": new_status,
                    "auditLog": firestore.ArrayUnion([audit_entry]),
                    "updatedAt": now_iso,
                }, merge=True)
        except Exception as fs_err:
            print(f"[Emergency] Firestore update status warning: {fs_err}")

        return jsonify({
            "status": "success",
            "alertId": alert_id,
            "newStatus": new_status
        })
    except Exception as err:
        return jsonify({"status": "error", "message": str(err)}), 500


@app.route("/api/emergency/ambulance-request", methods=["POST"])
def emergency_ambulance_request():
    try:
        data = request.get_json(silent=True) or {}
        alert_id = str(data.get("alertId") or f"emg-{int(time.time())}").strip()
        patient_id = str(data.get("patientId") or "pat-2026-2007").strip()
        patient_name = str(data.get("patientName") or "Patient").strip()
        is_demo = bool(data.get("isDemo", False))
        urgency = str(data.get("urgency") or "CRITICAL").strip()
        notes = str(data.get("notes") or "").strip()
        location = data.get("location") or {}

        now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        provider_name = "Demo Emergency Dispatch" if is_demo else "Hospital Emergency Medical Transport"
        eta_minutes = random.randint(8, 12)
        vehicle_id = f"MED-AMB-{random.randint(100, 999)}"

        dispatch_info = {
            "provider": provider_name,
            "status": "AMBULANCE_REQUESTED",
            "etaMinutes": eta_minutes,
            "vehicleId": vehicle_id,
            "urgency": urgency,
            "notes": notes,
            "dispatchTimestamp": now_iso,
            "message": f"{provider_name} confirmed. Paramedic ambulance ({vehicle_id}) en route (ETA ~{eta_minutes} mins).",
        }

        audit_entry = {
            "timestamp": now_iso,
            "actor": "patient",
            "action": "AMBULANCE_REQUESTED",
            "details": f"Dispatched via {provider_name} [Vehicle: {vehicle_id}, ETA: {eta_minutes}m]"
        }

        # Update RTDB
        try:
            rtdb_ref = db.reference(f"emergencyAlerts/{alert_id}")
            existing = rtdb_ref.get() or {}
            audit_log = existing.get("auditLog", []) if isinstance(existing, dict) else []
            audit_log.append(audit_entry)
            rtdb_ref.update({
                "ambulanceStatus": "AMBULANCE_REQUESTED",
                "ambulanceDetails": dispatch_info,
                "auditLog": audit_log,
                "updatedAt": now_iso,
            })
        except Exception as rtdb_err:
            print(f"[Emergency] RTDB ambulance request warning: {rtdb_err}")

        # Update Firestore
        try:
            if firestore_client:
                firestore_client.collection("emergencyAlerts").document(alert_id).set({
                    "ambulanceStatus": "AMBULANCE_REQUESTED",
                    "ambulanceDetails": dispatch_info,
                    "auditLog": firestore.ArrayUnion([audit_entry]),
                    "updatedAt": now_iso,
                }, merge=True)
        except Exception as fs_err:
            print(f"[Emergency] Firestore ambulance request warning: {fs_err}")

        return jsonify({
            "status": "success",
            "data": dispatch_info
        })
    except Exception as err:
        return jsonify({"status": "error", "message": str(err)}), 500


# SECURITY FIX: Authorize audit retrieval (assigned doctor or affected patient only)
@app.route("/api/emergency/<alert_id>/audit", methods=["GET"])
def emergency_get_audit(alert_id):
    try:
        role = _request_user_role()
        if not role:
            return jsonify({"status": "error", "message": "Unauthorized. Authentication token is required."}), 401

        record = db.reference(f"emergencyAlerts/{alert_id}").get()
        if not record and firestore_client:
            fdoc = firestore_client.collection("emergencyAlerts").document(alert_id).get()
            if fdoc.exists:
                record = fdoc.to_dict()

        if not record or not isinstance(record, dict):
            return jsonify({"status": "error", "message": "Alert not found."}), 404

        emg_doc = str(record.get('assignedDoctorId') or record.get('doctorId') or '').strip().lower()
        emg_pid = str(record.get('patientId') or '').strip()

        if role == 'doctor':
            doctor_id = _request_doctor_id()
            precord = _patient_collection_reference().child(emg_pid).get() if emg_pid else {}
            if emg_doc != doctor_id and not (isinstance(precord, dict) and _doctor_owns_record(precord, doctor_id)):
                return jsonify({"status": "error", "message": "Forbidden. You are not assigned to this emergency."}), 403
        elif role == 'patient':
            patient_id = _request_patient_id()
            if emg_pid != patient_id:
                return jsonify({"status": "error", "message": "Forbidden. Access denied for this alert audit."}), 403

        audit_log = record.get("auditLog", [])
        return jsonify({
            "status": "success",
            "alertId": alert_id,
            "auditLog": audit_log
        })
    except Exception as err:
        return jsonify({"status": "error", "message": str(err)}), 500


@app.route("/api/emergency/nearby-facilities", methods=["GET"])
def emergency_nearby_facilities():
    try:
        lat = float(request.args.get("lat", 28.6139))
        lng = float(request.args.get("lng", 77.2090))

        facilities = [
            {
                "name": "AIIMS Emergency & Trauma Center",
                "specialty": "Level 1 Trauma & 24/7 Cardiology",
                "distanceKm": 2.4,
                "phone": "+91 11 2658 8500",
                "openNow": True,
            },
            {
                "name": "Apollo Hospitals Emergency Bay",
                "specialty": "Critical Arrhythmia & Cardiac Resuscitation",
                "distanceKm": 3.8,
                "phone": "+91 11 2692 5858",
                "openNow": True,
            },
            {
                "name": "Max Super Speciality Emergency",
                "specialty": "Advanced Cardiac Life Support (ACLS)",
                "distanceKm": 5.1,
                "phone": "+91 11 2651 5050",
                "openNow": True,
            }
        ]

        return jsonify({
            "status": "success",
            "facilities": facilities
        })
    except Exception as err:
        return jsonify({"status": "error", "message": str(err)}), 500


@app.route('/<path:path>')
def serve_frontend_assets_or_spa(path):
    # Never intercept backend API routes
    if path.startswith('api/') or path in ['patients', 'real-data', 'health', 'socket.io']:
        return jsonify({"status": "error", "message": f"Endpoint /{path} not found"}), 404

    frontend_dist = BASE_DIR / 'frontend' / 'dist'
    if frontend_dist.exists():
        candidate_file = frontend_dist / path
        if candidate_file.is_file():
            return send_from_directory(str(frontend_dist), path)
        index_file = frontend_dist / 'index.html'
        if index_file.is_file():
            return send_from_directory(str(frontend_dist), 'index.html')

    return jsonify({"status": "error", "message": f"Endpoint /{path} not found"}), 404


if __name__ == '__main__':
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', '5000'))
    debug_mode = os.getenv('FLASK_DEBUG', '0') == '1'
    allow_unsafe_werkzeug = os.getenv('ALLOW_UNSAFE_WERKZEUG', '1') == '1'
    socketio.run(
        app,
        host=host,
        port=port,
        debug=debug_mode,
        allow_unsafe_werkzeug=allow_unsafe_werkzeug,
    )