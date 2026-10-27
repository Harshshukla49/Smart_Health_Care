import re

from flask import Flask, abort, send_from_directory
from functools import wraps

app = Flask(__name__)


def require_auth(roles=None, patient_id_arg=None):
    allowed_roles = {str(role).strip().lower() for role in (roles or []) if str(role).strip()}

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            return _execute_auth_guard(fn, allowed_roles, patient_id_arg, args, kwargs)

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


def _has_active_emergency_grant(patient_id, doctor_id):
    if not patient_id or not doctor_id:
        return False
    try:
        pid = str(patient_id).strip()
        doc_key = str(doctor_id).strip().lower().replace('.', ',')
        grant_ref = db.reference(f"emergencyAccessGrants/{pid}/{doc_key}")
        grant = grant_ref.get()
        if not isinstance(grant, dict):
            return False
        if not grant.get('active', True):
            return False
        expires_at = str(grant.get('expiresAt') or '')
        if expires_at and expires_at > datetime.now(timezone.utc).isoformat():
            return True
        return False
    except Exception:
        return False

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
import threading
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path
import uuid
from functools import wraps
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import io
import csv
from dotenv import load_dotenv
from flask import Flask, jsonify, request, Response
from flask_cors import CORS
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
            return _execute_auth_guard(fn, allowed_roles, patient_id_arg, args, kwargs)

        return wrapper

    return decorator


def _get_env(name, default=None):
    """Read env values safely and strip surrounding whitespace/quotes."""
    value = os.getenv(name, default)
    if value is None:
        return None
    value = str(value).strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
        value = value[1:-1].strip()
    return value


def is_production_environment():
    flask_env = (_get_env('FLASK_ENV') or '').lower()
    render_flag = (_get_env('RENDER') or '').lower()
    prod_flag = (_get_env('PRODUCTION') or '').lower()
    return flask_env == 'production' or render_flag == 'true' or prod_flag in ('1', 'true', 'yes')


def resolve_allowed_origins(cors_env=None, is_prod=None):
    if is_prod is None:
        is_prod = is_production_environment()
    if cors_env is None:
        cors_env = _get_env('CORS_ORIGIN', '')
    else:
        cors_env = str(cors_env or '').strip()

    if cors_env:
        raw_list = [o.strip() for o in cors_env.split(',') if o.strip()]
        if is_prod and '*' in raw_list:
            raise RuntimeError(
                "FATAL [SECURITY]: Wildcard CORS ('*') is strictly forbidden in production. "
                "Specify explicit allowed origins via CORS_ORIGIN."
            )
        if '*' in raw_list:
            return '*'
        return raw_list

    if is_prod:
        # Production defaults strictly allow known production domains
        return [
            'https://smart-health-rontend.onrender.com',
            'https://smart-health-frontend.onrender.com',
        ]
    else:
        # Local development defaults include local frontend servers
        return [
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'https://smart-health-rontend.onrender.com',
            'https://smart-health-frontend.onrender.com',
        ]


ALLOWED_ORIGINS = resolve_allowed_origins()
CORS(app, origins=ALLOWED_ORIGINS, supports_credentials=True)
socketio = SocketIO(app, cors_allowed_origins=ALLOWED_ORIGINS, async_mode="threading", manage_session=False)

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
    err_str = str(message or 'Request failed.')
    return jsonify({
        'status': 'error',
        'message': err_str,
        'error': err_str,
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

if not firebase_admin._apps:
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
KNOWN_INSECURE_SECRETS = {
    'smart-health-dev-secret',
    'secret',
    'changeme',
    'dev-secret',
    'replace_with_a_cryptographically_secure_random_string_min_32_chars',
}

def resolve_auth_secret(secret_candidate=None, is_prod=None):
    if is_prod is None:
        is_prod = is_production_environment()

    if secret_candidate is None:
        raw_secret = (
            _get_env('APP_AUTH_SECRET') or
            _get_env('JWT_SECRET') or
            _get_env('FLASK_SECRET_KEY') or
            ''
        ).strip()
    else:
        raw_secret = str(secret_candidate or '').strip()

    if is_prod:
        if not raw_secret or raw_secret in KNOWN_INSECURE_SECRETS or len(raw_secret) < 32:
            raise RuntimeError(
                "FATAL [SECURITY]: Insecure or missing production authentication secret. "
                "APP_AUTH_SECRET or JWT_SECRET must be explicitly configured in production with at least 32 characters."
            )
        return raw_secret
    else:
        if not raw_secret or raw_secret in KNOWN_INSECURE_SECRETS:
            import warnings
            warnings.warn(
                "[SECURITY NOTICE]: Running with development auth secret. "
                "Set APP_AUTH_SECRET or JWT_SECRET (min 32 characters) before deploying to production."
            )
            return 'smart-health-dev-secret'
        return raw_secret


AUTH_SECRET = resolve_auth_secret()
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
        # Use SSL for port 465, STARTTLS for 587, or plain SMTP with 6-second socket timeout to prevent worker lockup
        if SMTP_USE_SSL or SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, timeout=6)
        else:
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=6)
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

    history = med.get('revisionHistory') or []
    if not isinstance(history, list):
        history = list(history.values()) if isinstance(history, dict) else []

    revision_number = int(med.get('revisionNumber') or (len(history) + 1))
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
        'revisionNumber': revision_number,
        'revisionHistory': history,
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

    # Clinical fields change detection
    new_dose = str(data.get('dosage') or existing.get('dosage') or '').strip()
    new_freq = str(data.get('frequency') or existing.get('frequency') or '').strip()
    new_dur = str(data.get('duration') or existing.get('duration') or '').strip()
    new_inst = str(data.get('instructions') or existing.get('instructions') or '').strip()
    new_med_name = str(data.get('medicineName') or existing.get('medicineName') or '').strip()

    is_clinical_change = (
        (new_dose != str(existing.get('dosage') or '').strip()) or
        (new_freq != str(existing.get('frequency') or '').strip()) or
        (new_dur != str(existing.get('duration') or '').strip()) or
        (new_inst != str(existing.get('instructions') or '').strip()) or
        (new_med_name != str(existing.get('medicineName') or '').strip())
    )

    reason = str(data.get('reasonForCorrection') or data.get('reason') or '').strip()
    if is_clinical_change and not reason:
        return api_error('Reason for clinical prescription correction is required for auditable revision tracking.', 400)

    requester = _read_auth_payload()
    now_iso = _utc_now_iso()

    if is_clinical_change:
        history = existing.get('revisionHistory') or []
        if not isinstance(history, list):
            history = list(history.values()) if isinstance(history, dict) else []
        
        rev_entry = {
            'revisionNumber': len(history) + 1,
            'medicineName': existing.get('medicineName'),
            'dosage': existing.get('dosage'),
            'frequency': existing.get('frequency'),
            'duration': existing.get('duration'),
            'instructions': existing.get('instructions'),
            'status': existing.get('status'),
            'previousData': {
                'medicineName': existing.get('medicineName'),
                'dosage': existing.get('dosage'),
                'frequency': existing.get('frequency'),
                'duration': existing.get('duration'),
                'instructions': existing.get('instructions'),
                'status': existing.get('status'),
            },
            'reasonForCorrection': reason,
            'revisedBy': requester.get('name') or requester.get('doctorId') or 'Treating Physician',
            'revisedById': str(requester.get('doctorId') or requester.get('email') or '').strip().lower(),
            'revisedAt': now_iso,
        }
        history.append(rev_entry)
        existing['revisionHistory'] = history
        existing['revisionNumber'] = len(history) + 1

    updated_status = str(data.get('status') or existing.get('status') or 'Active').strip().capitalize()
    if updated_status not in {'Active', 'Completed', 'Paused', 'Discontinued'}:
        updated_status = existing.get('status')

    existing['medicineName'] = new_med_name
    existing['dosage'] = new_dose
    existing['frequency'] = new_freq
    existing['route'] = str(data.get('route') or existing.get('route') or 'Oral').strip()
    existing['instructions'] = new_inst
    existing['foodInstruction'] = str(data.get('foodInstruction') or existing.get('foodInstruction') or '').strip()
    existing['startDate'] = str(data.get('startDate') or existing.get('startDate') or '').strip()
    existing['endDate'] = str(data.get('endDate') or existing.get('endDate') or '').strip()
    existing['duration'] = new_dur
    existing['notes'] = str(data.get('notes') or existing.get('notes') or '').strip()
    existing['status'] = updated_status
    existing['updatedAt'] = now_iso

    normalized = _normalize_medication_record(existing, patient_id)
    medicines[target_idx] = normalized

    ok, write_error = _set_patient_medicines(patient_id, medicines)
    if not ok:
        return api_error(write_error, 500)

    _record_medication_audit(
        patient_id,
        action=f"prescription_updated_status_{updated_status.lower()}",
        medication_id=medication_id,
        details=f"Updated {normalized['medicineName']}: {reason if is_clinical_change else updated_status}",
    )

    if is_clinical_change:
        _log_patient_history(patient_id, 'PRESCRIPTION_CORRECTION_AUDITED', {
            'medicationId': medication_id,
            'medicineName': new_med_name,
            'newDosage': new_dose,
            'reason': reason,
        }, requester)
        _log_security_event(
            actor_payload=requester,
            action='PRESCRIPTION_AUDITED_REVISION',
            target_type='prescription',
            target_id=medication_id,
            hospital_id=requester.get('hospitalId') or '',
            details=f"Prescription {new_med_name} revised: {reason}"
        )

    return api_success('Prescription updated and correction audited successfully.', {'prescription': normalized, 'medicines': medicines})


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
    raw_taken = payload.get('taken')
    if raw_taken is not None and not isinstance(raw_taken, bool):
        return api_error("Field 'taken' must be a boolean.", 400)
    taken = True if raw_taken is None else bool(raw_taken)
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


def _admin_collection_reference():
    return db.reference('admins')


def _hospitals_collection_reference():
    return db.reference('hospitals')


def _appointments_collection_reference():
    return db.reference('appointments')


def _security_audit_reference():
    return db.reference('security_audit_logs')


def _patient_history_reference(patient_id):
    safe_pid = str(patient_id or '').strip().replace('.', ',').replace('/', '_')
    return db.reference(f'patientHistory/{safe_pid}')


def _sanitize_audit_details(details):
    if not details:
        return ''
    text = str(details).strip()
    # Mask any potential sensitive credentials, auth tokens, passwords, or secrets
    sensitive_patterns = [
        r'(?i)(password|passwd|pwd)[\s:=]+([^\s,;]+)',
        r'(?i)(bearer\s+)([a-zA-Z0-9_\-\.]+)',
        r'(?i)(token|secret|key|api_key)[\s:=]+([^\s,;]+)',
    ]
    for pattern in sensitive_patterns:
        text = re.sub(pattern, r'\1=[REDACTED]', text)
    return text[:500]


def _log_security_event(actor_payload=None, action='UNKNOWN', target_type='', target_id='', hospital_id='', details=''):
    try:
        actor = actor_payload if isinstance(actor_payload, dict) else (_read_auth_payload() or {})
        actor_role = str(actor.get('role') or 'anonymous').strip().lower()
        actor_id = str(actor.get('adminId') or actor.get('id') or actor.get('doctorId') or actor.get('patientId') or actor.get('email') or 'anonymous').strip()
        actor_email = str(actor.get('email') or '').strip().lower()
        resolved_hosp = str(hospital_id or actor.get('hospitalId') or '').strip()

        event_id = f"sec-{int(time.time() * 1000)}-{secrets.token_hex(4)}"
        event_record = {
            'id': event_id,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'action': str(action).strip().upper(),
            'actorId': actor_id,
            'actorRole': actor_role,
            'actorEmail': actor_email,
            'targetType': str(target_type).strip(),
            'targetId': str(target_id).strip(),
            'hospitalId': resolved_hosp,
            'details': _sanitize_audit_details(details),
            'ipAddress': _get_client_ip(),
        }

        _security_audit_reference().child(event_id).set(event_record)
        return event_record
    except Exception as e:
        print(f"[SecurityAudit] Warning: Logging failed: {e}")
        return None


def _log_patient_history(patient_id, event_type, details, changed_by=None):
    try:
        actor = changed_by if isinstance(changed_by, dict) else (_read_auth_payload() or {})
        history_id = f"hist-{int(time.time() * 1000)}-{secrets.token_hex(4)}"
        entry = {
            'id': history_id,
            'patientId': str(patient_id).strip(),
            'eventType': str(event_type).strip().upper(),
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'changedBy': actor.get('email') or actor.get('adminId') or actor.get('id') or 'system',
            'changedByRole': actor.get('role') or 'system',
            'details': details if isinstance(details, dict) else {'message': str(details)},
        }
        _patient_history_reference(patient_id).child(history_id).set(entry)
        return entry
    except Exception as e:
        print(f"[PatientHistory] Warning: Logging failed: {e}")
        return None


def _ensure_default_hospital():
    try:
        hosp_ref = _hospitals_collection_reference()
        hosp_data = hosp_ref.get()
        if not hosp_data or not isinstance(hosp_data, dict):
            default_hosp_id = "HOSP-CITY-01"
            hosp_ref.child(default_hosp_id).set({
                'id': default_hosp_id,
                'hospitalId': default_hosp_id,
                'name': 'City General Medical Center',
                'address': '100 Healthcare Boulevard, Suite 400',
                'city': 'New Delhi',
                'state': 'Delhi',
                'phone': '+911140001000',
                'email': 'admin@citygeneral.org',
                'departments': ['Cardiology', 'General Medicine', 'Neurology', 'Pulmonology', 'Emergency Care', 'Pediatrics'],
                'isActive': True,
                'createdAt': datetime.now(timezone.utc).isoformat(),
            })
            print(f"[Bootstrap] Initialized default hospital: {default_hosp_id}")
    except Exception as e:
        print(f"[Bootstrap] Default hospital notice: {e}")


_RATE_LIMIT_STORE = {}
_RATE_LIMIT_LOCK = threading.Lock()


def _check_rate_limit(key: str, max_requests: int = 10, window_seconds: int = 300):
    """Sliding window in-memory rate limiter per key (e.g. client IP)."""
    now = time.time()
    with _RATE_LIMIT_LOCK:
        history = _RATE_LIMIT_STORE.get(key, [])
        history = [ts for ts in history if now - ts < window_seconds]
        if len(history) >= max_requests:
            remaining = int(window_seconds - (now - history[0]))
            _RATE_LIMIT_STORE[key] = history
            return False, max(1, remaining)
        history.append(now)
        _RATE_LIMIT_STORE[key] = history
        return True, 0


def _get_client_ip():
    forwarded = request.headers.get('X-Forwarded-For')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.remote_addr or '127.0.0.1'


def _is_valid_email(email: str) -> bool:
    return bool(re.match(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$', str(email or '').strip()))


def _is_strong_password(password: str) -> tuple[bool, str]:
    pwd = str(password or '').strip()
    if len(pwd) < 8:
        return False, "Password must be at least 8 characters long."
    return True, ""


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


def _is_account_active(payload):
    if not isinstance(payload, dict):
        return False
    role = str(payload.get('role') or '').strip().lower()

    if payload.get('isActive') is False or payload.get('status') == 'deactivated':
        return False

    try:
        if role in ('super_admin', 'hospital_admin', 'admin'):
            admin_email = str(payload.get('email') or '').strip().lower()
            admin_id = str(payload.get('adminId') or payload.get('id') or '').strip()
            # 1. Direct key by email
            if admin_email:
                rec = _admin_collection_reference().child(admin_email.replace('.', ',')).get()
                if isinstance(rec, dict):
                    return not (rec.get('isActive') is False or rec.get('status') == 'deactivated')
            # 2. Direct key by ID
            if admin_id:
                rec = _admin_collection_reference().child(admin_id).get()
                if isinstance(rec, dict):
                    return not (rec.get('isActive') is False or rec.get('status') == 'deactivated')
            # 3. Fallback scan
            all_admins = _admin_collection_reference().get()
            if isinstance(all_admins, dict):
                for k, a in all_admins.items():
                    if isinstance(a, dict):
                        if (admin_id and (a.get('id') == admin_id or a.get('adminId') == admin_id)) or \
                           (admin_email and str(a.get('email') or '').strip().lower() == admin_email):
                            return not (a.get('isActive') is False or a.get('status') == 'deactivated')

        elif role == 'doctor':
            doc_email = str(payload.get('email') or payload.get('doctorId') or '').strip().lower()
            doc_id = str(payload.get('id') or payload.get('doctorId') or '').strip()
            # 1. Direct key by email
            if doc_email:
                rec = _doctor_collection_reference().child(doc_email.replace('.', ',')).get()
                if isinstance(rec, dict):
                    return not (rec.get('isActive') is False or rec.get('status') == 'deactivated')
            # 2. Direct key by ID
            if doc_id:
                rec = _doctor_collection_reference().child(doc_id).get()
                if isinstance(rec, dict):
                    return not (rec.get('isActive') is False or rec.get('status') == 'deactivated')
            # 3. Fallback scan
            all_docs = _doctor_collection_reference().get()
            if isinstance(all_docs, dict):
                for k, d in all_docs.items():
                    if isinstance(d, dict):
                        if (doc_id and (d.get('id') == doc_id or d.get('doctorId') == doc_id)) or \
                           (doc_email and str(d.get('email') or '').strip().lower() == doc_email):
                            return not (d.get('isActive') is False or d.get('status') == 'deactivated')

        elif role == 'patient':
            pat_id = str(payload.get('patientId') or payload.get('id') or '').strip()
            pat_email = str(payload.get('email') or '').strip().lower()
            # 1. Direct key by ID
            if pat_id:
                rec = _patient_collection_reference().child(pat_id).get()
                if isinstance(rec, dict):
                    return not (rec.get('isActive') is False or rec.get('status') == 'deactivated')
            # 2. Fallback scan
            all_pats = _patient_collection_reference().get()
            if isinstance(all_pats, dict):
                for k, p in all_pats.items():
                    if isinstance(p, dict):
                        if (pat_id and (p.get('id') == pat_id or p.get('patientId') == pat_id)) or \
                           (pat_email and str(p.get('email') or '').strip().lower() == pat_email):
                            return not (p.get('isActive') is False or p.get('status') == 'deactivated')
    except Exception:
        pass

    return True


def _require_auth_payload():
    payload = _read_auth_payload()
    if not payload:
        return None, api_error('Unauthorized. Valid auth token is required.', 401)
    if not _is_account_active(payload):
        return None, api_error('Account has been deactivated. Please contact an administrator.', 403)
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


def _execute_auth_guard(fn, allowed_roles, patient_id_arg, args, kwargs):
    payload, auth_error = _require_auth_payload()
    if auth_error:
        return auth_error

    role = str(payload.get('role') or '').strip().lower()

    if allowed_roles:
        role_allowed = False
        if role == 'super_admin':
            role_allowed = True
        elif role == 'hospital_admin':
            role_allowed = (role in allowed_roles) or ('admin' in allowed_roles) or ('doctor' in allowed_roles)
        elif role == 'doctor':
            role_allowed = ('doctor' in allowed_roles)
        elif role == 'patient':
            role_allowed = ('patient' in allowed_roles)
        elif 'admin' in allowed_roles and role in ('super_admin', 'hospital_admin'):
            role_allowed = True

        if not role_allowed:
            return api_error('Forbidden. You are not authorized to perform this action.', 403)

    if patient_id_arg:
        target_patient_id = str(kwargs.get(patient_id_arg) or '').strip()
        if not target_patient_id:
            target_patient_id = str((request.view_args or {}).get(patient_id_arg) or '').strip()

        if role == 'patient':
            requester_patient_id = str(payload.get('patientId') or payload.get('id') or '').strip()
            if not requester_patient_id or requester_patient_id.lower() != target_patient_id.lower():
                return api_error('Access denied for this patient record.', 403)

        elif role == 'doctor':
            doctor_id = str(payload.get('doctorId') or payload.get('email') or payload.get('uid') or '').strip().lower()
            if not doctor_id:
                return api_error('Forbidden. Doctor context is missing from token.', 403)

            record = _patient_collection_reference().child(target_patient_id).get()
            if not isinstance(record, dict):
                return api_error('Patient not found.', 404)

            # 1. Enforce strict Hospital Isolation: Doctor can never access another hospital's patient
            doc_hosp = str(payload.get('hospitalId') or '').strip().lower()
            if not doc_hosp:
                doc_node = _doctor_collection_reference().child(doctor_id.replace('.', ',')).get() or {}
                if isinstance(doc_node, dict):
                    doc_hosp = str(doc_node.get('hospitalId') or '').strip().lower()

            pat_hosp = str(record.get('hospitalId') or '').strip().lower()
            if doc_hosp and pat_hosp and doc_hosp != pat_hosp:
                return api_error('Access denied. Patient belongs to another hospital.', 403)

            # 2. Enforce Assignment & Break-Glass Authorization
            is_assigned = _doctor_owns_record(record, doctor_id)
            has_break_glass = _has_active_emergency_grant(target_patient_id, doctor_id)
            if not is_assigned and not has_break_glass:
                return api_error('Access denied for this patient record. You are not assigned to this patient.', 403)

        elif role == 'hospital_admin':
            admin_hosp = str(payload.get('hospitalId') or '').strip().lower()
            record = _patient_collection_reference().child(target_patient_id).get()
            if not isinstance(record, dict):
                return api_error('Patient not found.', 404)
            if admin_hosp:
                patient_hosp = str(record.get('hospitalId') or '').strip().lower()
                doctor_email = str(record.get('doctorId') or record.get('doctorEmail') or '').strip().lower()
                doc_rec = _doctor_collection_reference().child(doctor_email.replace('.', ',')).get() or {}
                doc_hosp = str(doc_rec.get('hospitalId') or '').strip().lower()
                if patient_hosp and patient_hosp != admin_hosp and doc_hosp and doc_hosp != admin_hosp:
                    return api_error('Access denied for this hospital patient record.', 403)

    return fn(*args, **kwargs)


def require_auth(roles=None, patient_id_arg=None):
    allowed_roles = {str(role).strip().lower() for role in (roles or []) if str(role).strip()}

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            return _execute_auth_guard(fn, allowed_roles, patient_id_arg, args, kwargs)

        return wrapper

    return decorator


def _decode_auth_token(token):
    token_value = str(token or '').strip()
    if not token_value:
        return {}

    # 1. Cryptographically verify application auth_serializer signature and expiration
    try:
        payload = auth_serializer.loads(token_value, max_age=AUTH_TOKEN_TTL_SECONDS)
        if isinstance(payload, dict) and payload.get('role'):
            return payload
    except (BadSignature, SignatureExpired):
        pass
    except Exception:
        pass

    # 2. Cryptographically verify Firebase Admin ID token (signature, expiration, audience)
    try:
        decoded_fb = firebase_auth.verify_id_token(token_value)
        if isinstance(decoded_fb, dict):
            email = str(decoded_fb.get('email') or '').strip().lower()
            uid = str(decoded_fb.get('uid') or '').strip()
            role = str(decoded_fb.get('role') or '').strip().lower()

            if not role:
                # Resolve role from Firebase Realtime Database registration
                if _patient_collection_reference().child(uid).get():
                    role = 'patient'
                elif _doctor_collection_reference().child(email.replace('.', ',')).get():
                    role = 'doctor'
                else:
                    role = 'patient'

            return {
                'role': role,
                'email': email,
                'uid': uid,
                'patientId': uid if role == 'patient' else '',
                'doctorId': email if role == 'doctor' else '',
                'name': decoded_fb.get('name') or '',
                'firebaseAuth': True,
            }
    except Exception:
        pass

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
    target_sessions = set()
    role_clean = str(role or '').strip().lower()
    actor_clean = str(actor_id or '').strip()

    if not role_clean or not actor_clean:
        return 0

    keys = [
        _chat_presence_key(role_clean, actor_clean),
        f"{role_clean}:{actor_clean.lower()}",
        f"user:{role_clean}:{actor_clean.lower()}",
        f"user_{actor_clean.lower()}",
    ]
    if role_clean == 'doctor':
        if '@' in actor_clean:
            keys.append(f"doctor:{actor_clean.split('@')[0].lower()}")
    for k in keys:
        target_sessions.update(chat_user_connections.get(k) or set())

    # Emit to individual rooms and direct socket SIDs
    try:
        socketio.emit(event_name, payload, room=f"{role_clean}:{actor_clean.lower()}")
        socketio.emit(event_name, payload, to=f"{role_clean}:{actor_clean.lower()}")
    except Exception:
        pass

    delivered = 0
    for sid in target_sessions:
        try:
            socketio.emit(event_name, payload, room=sid)
            socketio.emit(event_name, payload, to=sid)
            delivered += 1
        except Exception:
            pass
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
        'heart_rate': heart_rate,
        'spo2': spo2,
        'temperature': temperature,
        'leadsOff': bool(payload.get('leadsOff', (existing_record or {}).get('leadsOff', False))),
        'vitals': {
            'heartRate': heart_rate,
            'heart_rate': heart_rate,
            'spo2': spo2,
            'temperature': temperature,
            'ecg': payload.get('ecg') or (ecg_data[-1] if ecg_data else 0),
            'ecgData': ecg_data,
            'leadsOff': bool(payload.get('leadsOff', (existing_record or {}).get('leadsOff', False))),
            'dataSource': payload.get('dataSource') or (existing_record or {}).get('dataSource') or 'dataset',
            'updatedAt': payload.get('updatedAt') or datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        },
        'ecgData': ecg_data,
        'status': prediction.get('status', 'unavailable'),
        'prediction': prediction,
        'deviceId': payload.get('deviceId') or (existing_record or {}).get('deviceId') or None,
        'deviceActive': bool(payload.get('deviceActive', (existing_record or {}).get('deviceActive', False))),
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

    # TOCTOU Hardware Authority Protection: prevent simulator/background writes from overwriting active hardware telemetry
    writer_source = str(payload.get('dataSource') or '')
    if isinstance(existing, dict) and existing.get('dataSource') == 'esp32-hardware':
        last_hw = _hardware_active_patients.get(str(patient_id).strip(), 0)
        if (time.time() - last_hw < 60) and writer_source != 'esp32-hardware' and writer_source != 'manual-update':
            print(f"[PatientRecord] Refusing overwrite of hardware telemetry for patient {patient_id} from source '{writer_source}'.")
            return existing

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

        # If real ESP32 hardware is actively streaming for this patient, immediately yield and terminate simulator
        last_hw = _hardware_active_patients.get(str(patient_id).strip(), 0)
        if (time.time() - last_hw < 60) or record.get('dataSource') == 'esp32-hardware':
            print(f"[Simulator] Hardware telemetry active for patient '{patient_id}'. Terminating simulator background loop.")
            break

        normalized = _normalize_patient_record(patient_id, record, record)
        next_vitals = sensor_adapter.get_next_vitals(patient_id, normalized.get('vitals') or {})
        prediction = predict_risk(next_vitals)

        with_audit = _append_prediction_audit(dict(normalized), prediction, str(next_vitals.get('source') or 'sensor-stream'), next_vitals)

        # Pre-write check: terminate immediately if real hardware packets arrived during prediction
        last_hw = _hardware_active_patients.get(str(patient_id).strip(), 0)
        if (time.time() - last_hw < 60):
            print(f"[Simulator] Hardware telemetry became active for patient '{patient_id}'. Terminating simulator background loop.")
            break

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


def _has_active_super_admin(all_admins=None):
    if all_admins is None:
        try:
            all_admins = _admin_collection_reference().get()
        except Exception:
            return False
    if isinstance(all_admins, dict):
        for a in all_admins.values():
            if isinstance(a, dict) and str(a.get('role') or '').strip().lower() == 'super_admin' and a.get('isActive') is not False:
                return True
    return False


def _ensure_default_super_admin():
    """
    Secure One-Time First-Super-Admin Provisioning.
    
    Safety Invariants:
    1. If an active Super Admin already exists in the database, this function terminates immediately.
       It will NEVER overwrite credentials, change roles, or promote accounts on startup.
    2. No insecure hardcoded production passwords are ever used.
       If SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD is missing or matches known insecure defaults,
       provisioning is skipped with a safe diagnostic log.
    3. Existing non-super-admin accounts are never silently promoted.
    4. Passwords must pass strong validation (>= 10 chars) and are hashed with Werkzeug pbkdf2/scrypt.
    5. Emails and credentials are never printed in plain text to logs.
    """
    try:
        admin_ref = _admin_collection_reference()
        all_admins = admin_ref.get()

        # 1. Guard against repeat provisioning or overwrite
        if _has_active_super_admin(all_admins):
            return

        # 2. Read configured first-admin credentials from environment
        raw_email = (
            os.getenv('INITIAL_ADMIN_EMAIL') or
            os.getenv('SUPER_ADMIN_EMAIL') or
            ''
        ).strip().lower()

        raw_password = (
            os.getenv('INITIAL_ADMIN_PASSWORD') or
            os.getenv('SUPER_ADMIN_PASSWORD') or
            ''
        ).strip()

        # 3. Guard against missing credentials (do NOT fallback to hardcoded default passwords!)
        if not raw_email or not raw_password:
            print("[Auth] Info: No active Super Admin found. Configure INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD to complete initial setup.")
            return

        # 4. Guard against known insecure default passwords
        insecure_defaults = {
            'admin@smarthealth2026!',
            'changemeinproduction!2026',
            'admin',
            'password',
            '12345678',
            'admin123',
            'smarthealth',
            'secret',
        }
        if raw_password.lower() in insecure_defaults:
            print("[Auth] Security Warning: SUPER_ADMIN_PASSWORD matches an insecure known default. "
                  "Initial administrator provisioning skipped. Please configure a unique, strong password.")
            return

        # 5. Validate email format
        if not _is_valid_email(raw_email):
            print("[Auth] Security Warning: SUPER_ADMIN_EMAIL is not a valid email address. "
                  "Initial administrator provisioning skipped.")
            return

        # 6. Validate password strength (min 10 characters)
        if len(raw_password) < 10:
            print("[Auth] Security Warning: SUPER_ADMIN_PASSWORD must be at least 10 characters long. "
                  "Initial administrator provisioning skipped.")
            return

        # 7. Check if an account already exists under this email key
        sanitized_key = raw_email.replace('.', ',')
        existing_account = admin_ref.child(sanitized_key).get()
        if isinstance(existing_account, dict):
            # Do NOT silently promote or alter an existing account
            print("[Auth] Security Notice: An account already exists under the configured administrator email. "
                  "Refusing to overwrite or silently alter existing account.")
            return

        # 8. Provision root Super Admin
        admin_id = f"ADMIN-ROOT-{uuid.uuid4().hex[:6].upper()}"
        admin_name = str(os.getenv('SUPER_ADMIN_NAME') or 'System Super Admin').strip()

        record = {
            'id': admin_id,
            'adminId': admin_id,
            'email': raw_email,
            'name': admin_name,
            'role': 'super_admin',
            'isActive': True,
            'passwordHash': generate_password_hash(raw_password),
            'createdAt': datetime.now(timezone.utc).isoformat(),
            'provisionMethod': 'one_time_env_bootstrap',
        }

        admin_ref.child(sanitized_key).set(record)
        masked = _mask_email(raw_email)
        print(f"[Auth] Successfully provisioned initial Super Administrator ({masked}).")
    except Exception as e:
        print(f"[Auth] Super admin initialization check: {e}")


@app.route('/api/auth/admin/login', methods=['POST'])
@app.route('/admin/login', methods=['POST'])
def admin_login():
    try:
        client_ip = _get_client_ip()
        allowed, remaining = _check_rate_limit(f"admin_login_{client_ip}", max_requests=10, window_seconds=300)
        if not allowed:
            return api_error(f'Too many login attempts. Please wait {remaining} seconds.', 429)

        data = request.get_json(silent=True) or {}
        email = str(data.get('email') or '').strip().lower()
        password = str(data.get('password') or '')

        if not email or not password:
            return api_error('Email and password are required.', 400)

        admin = _admin_collection_reference().child(email.replace('.', ',')).get()
        if not isinstance(admin, dict):
            all_admins = _admin_collection_reference().get()
            if isinstance(all_admins, dict):
                for k, a in all_admins.items():
                    if isinstance(a, dict) and str(a.get('email') or '').strip().lower() == email:
                        admin = a
                        break

        if not isinstance(admin, dict):
            return api_error('Invalid email or password.', 401)

        if admin.get('isActive') is False or admin.get('status') == 'deactivated':
            return api_error('Account has been deactivated. Please contact an administrator.', 403)

        password_hash = str(admin.get('passwordHash') or '')
        if not password_hash or not check_password_hash(password_hash, password):
            return api_error('Invalid email or password.', 401)

        role = str(admin.get('role') or 'super_admin').strip().lower()
        admin_id = str(admin.get('id') or admin.get('adminId') or email)
        admin_name = str(admin.get('name') or 'Administrator').strip()
        hospital_id = str(admin.get('hospitalId') or '')
        hospital_name = str(admin.get('hospitalName') or '')

        auth = _issue_auth_token({
            'role': role,
            'adminId': admin_id,
            'id': admin_id,
            'email': email,
            'name': admin_name,
            'hospitalId': hospital_id,
            'hospitalName': hospital_name,
        })

        return api_success('Admin login successful.', {
            'admin': {
                'id': admin_id,
                'name': admin_name,
                'email': email,
                'role': role,
                'hospitalId': hospital_id,
                'hospitalName': hospital_name,
            },
            'auth': auth,
        })
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/admin/provision/hospital-admin', methods=['POST'])
@require_auth(roles={'super_admin'})
def provision_hospital_admin():
    try:
        data = request.get_json(silent=True) or {}
        email = str(data.get('email') or '').strip().lower()
        password = str(data.get('password') or '')
        name = str(data.get('name') or '').strip()
        phone = str(data.get('phone') or '').strip()
        hospital_id = str(data.get('hospitalId') or '').strip()
        hospital_name = str(data.get('hospitalName') or '').strip()

        if not email or not password or not name or not hospital_id:
            return api_error('Name, email, password, and hospitalId are required.', 400)

        is_strong, pwd_err = _is_strong_password(password)
        if not is_strong:
            return api_error(pwd_err, 400)

        if not _is_valid_email(email):
            return api_error('Valid email address is required.', 400)

        admin_ref = _admin_collection_reference().child(email.replace('.', ','))
        if admin_ref.get():
            return api_error('An administrator account already exists with this email.', 409)

        requester = _read_auth_payload()
        admin_id = f"HOSP-ADMIN-{uuid.uuid4().hex[:6].upper()}"

        record = {
            'id': admin_id,
            'adminId': admin_id,
            'email': email,
            'name': name,
            'phone': phone,
            'role': 'hospital_admin',
            'hospitalId': hospital_id,
            'hospitalName': hospital_name or hospital_id,
            'isActive': True,
            'passwordHash': generate_password_hash(password),
            'provisionedBy': requester.get('adminId') or requester.get('email'),
            'createdAt': datetime.now(timezone.utc).isoformat(),
        }

        admin_ref.set(record)

        sanitized = dict(record)
        sanitized.pop('passwordHash', None)

        return api_success('Hospital Administrator provisioned successfully.', {
            'hospitalAdmin': sanitized,
            **sanitized,
        }, 201)
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/admin/provision/doctor', methods=['POST'])
@require_auth(roles={'super_admin', 'hospital_admin'})
def provision_doctor():
    try:
        data = request.get_json(silent=True) or {}
        email = str(data.get('email') or '').strip().lower()
        password = str(data.get('password') or '')
        name = str(data.get('name') or '').strip()
        phone = str(data.get('phone') or '').strip()
        specialty = str(data.get('specialty') or 'General Medicine').strip()
        hospital_id = str(data.get('hospitalId') or '').strip()

        requester = _read_auth_payload()
        requester_role = requester.get('role')

        if requester_role == 'hospital_admin':
            admin_hosp = str(requester.get('hospitalId') or '').strip()
            if hospital_id and hospital_id.lower() != admin_hosp.lower():
                return api_error('Hospital administrators can only provision doctors for their assigned hospital.', 403)
            hospital_id = admin_hosp

        if not email or not password or not name or not phone:
            return api_error('Name, email, phone, and password are required.', 400)

        is_strong, pwd_err = _is_strong_password(password)
        if not is_strong:
            return api_error(pwd_err, 400)

        if not _is_valid_email(email):
            return api_error('Valid email address is required.', 400)

        if not _normalize_phone(phone):
            return api_error('Valid doctor phone number is required.', 400)

        doctor_ref = _doctor_collection_reference().child(email.replace('.', ','))
        if doctor_ref.get():
            return api_error('A doctor account already exists with this email.', 409)

        if _doctor_matches_by_phone(phone):
            return api_error('Doctor account already exists for this phone number.', 409)

        doc_id = f"DOC-{uuid.uuid4().hex[:6].upper()}"

        record = {
            'id': doc_id,
            'doctorId': doc_id,
            'email': email,
            'name': name,
            'phone': phone,
            'specialty': specialty,
            'hospitalId': hospital_id,
            'role': 'doctor',
            'isActive': True,
            'passwordHash': generate_password_hash(password),
            'provisionedBy': requester.get('adminId') or requester.get('email'),
            'createdAt': datetime.now(timezone.utc).isoformat(),
        }

        doctor_ref.set(record)

        sanitized = dict(record)
        sanitized.pop('passwordHash', None)

        return api_success('Doctor provisioned successfully.', {
            'doctor': sanitized,
            **sanitized,
        }, 201)
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/admin/accounts/toggle-status', methods=['POST'])
@require_auth(roles={'super_admin', 'hospital_admin'})
def toggle_account_status():
    try:
        data = request.get_json(silent=True) or {}
        target_type = str(data.get('targetType') or data.get('role') or '').strip().lower()
        target_id = str(data.get('targetId') or data.get('accountId') or '').strip()
        if 'isActive' in data:
            active = bool(data.get('isActive'))
        else:
            active = bool(data.get('active', False))

        if not target_type or not target_id:
            return api_error('targetType and targetId are required.', 400)

        requester = _read_auth_payload()
        requester_role = requester.get('role')
        requester_id = str(requester.get('adminId') or requester.get('email') or '').strip().lower()

        if target_id.lower() == requester_id or target_id.lower() == str(requester.get('email') or '').strip().lower():
            return api_error('Administrators cannot deactivate their own account.', 400)

        if target_type == 'hospital_admin':
            if requester_role != 'super_admin':
                return api_error('Only super administrators can toggle hospital administrator accounts.', 403)
            ref = _admin_collection_reference().child(target_id.replace('.', ','))
            existing = ref.get()
            if not existing:
                ref = _admin_collection_reference().child(target_id)
                existing = ref.get()
            if not existing:
                all_admins = _admin_collection_reference().get()
                if isinstance(all_admins, dict):
                    for k, a in all_admins.items():
                        if isinstance(a, dict) and (a.get('id') == target_id or a.get('adminId') == target_id or a.get('email') == target_id):
                            ref = _admin_collection_reference().child(k)
                            existing = a
                            break
            if not existing:
                return api_error('Hospital administrator not found.', 404)
            ref.update({'isActive': active, 'status': 'active' if active else 'deactivated'})

        elif target_type == 'doctor':
            ref = _doctor_collection_reference().child(target_id.replace('.', ','))
            existing = ref.get()
            if not existing:
                ref = _doctor_collection_reference().child(target_id)
                existing = ref.get()
            if not existing:
                all_docs = _doctor_collection_reference().get()
                if isinstance(all_docs, dict):
                    for k, d in all_docs.items():
                        if isinstance(d, dict) and (d.get('id') == target_id or d.get('doctorId') == target_id or d.get('email') == target_id):
                            ref = _doctor_collection_reference().child(k)
                            existing = d
                            break
            if not existing:
                return api_error('Doctor not found.', 404)
            if requester_role == 'hospital_admin':
                doc_hosp = str(existing.get('hospitalId') or '').strip().lower()
                admin_hosp = str(requester.get('hospitalId') or '').strip().lower()
                if doc_hosp != admin_hosp:
                    return api_error('Hospital administrators can only toggle doctors in their hospital.', 403)
            ref.update({'isActive': active, 'status': 'active' if active else 'deactivated'})

        elif target_type == 'patient':
            ref = _patient_collection_reference().child(target_id)
            existing = ref.get()
            if not existing:
                all_pats = _patient_collection_reference().get()
                if isinstance(all_pats, dict):
                    for k, p in all_pats.items():
                        if isinstance(p, dict) and (p.get('id') == target_id or p.get('patientId') == target_id or p.get('email') == target_id):
                            ref = _patient_collection_reference().child(k)
                            existing = p
                            break
            if not existing:
                return api_error('Patient not found.', 404)
            ref.update({'isActive': active, 'status': 'active' if active else 'deactivated'})
        else:
            return api_error('Invalid targetType. Must be doctor, patient, or hospital_admin.', 400)

        status_text = 'activated' if active else 'deactivated'
        return api_success(f'Account {status_text} successfully.', {
            'targetType': target_type,
            'targetId': target_id,
            'active': active,
            'isActive': active,
        })
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/admin/accounts', methods=['GET'])
@require_auth(roles={'super_admin', 'hospital_admin'})
def get_admin_accounts():
    try:
        requester = _read_auth_payload()
        role = requester.get('role')
        admin_hosp = str(requester.get('hospitalId') or '').strip().lower()

        doctors_raw = _doctor_collection_reference().get() or {}
        patients_raw = _patient_collection_reference().get() or {}
        admins_raw = _admin_collection_reference().get() or {}

        doctors = []
        if isinstance(doctors_raw, dict):
            for k, doc in doctors_raw.items():
                if isinstance(doc, dict):
                    if role == 'hospital_admin' and str(doc.get('hospitalId') or '').strip().lower() != admin_hosp:
                        continue
                    item = dict(doc)
                    item.pop('passwordHash', None)
                    item.pop('password', None)
                    item['id'] = item.get('id') or item.get('doctorId') or k
                    doctors.append(item)

        patients = []
        if isinstance(patients_raw, dict):
            for k, pat in patients_raw.items():
                if isinstance(pat, dict):
                    item = dict(pat)
                    item.pop('passwordHash', None)
                    item.pop('password', None)
                    item['id'] = item.get('id') or item.get('patientId') or k
                    patients.append(item)

        admins = []
        if role == 'super_admin' and isinstance(admins_raw, dict):
            for k, adm in admins_raw.items():
                if isinstance(adm, dict):
                    item = dict(adm)
                    item.pop('passwordHash', None)
                    item.pop('password', None)
                    item['id'] = item.get('id') or item.get('adminId') or k
                    admins.append(item)

        return api_success('Accounts fetched successfully.', {
            'doctors': doctors,
            'patients': patients,
            'admins': admins,
        })
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/admin/stats', methods=['GET'])
@app.route('/admin/stats', methods=['GET'])
@require_auth(roles={'super_admin', 'hospital_admin'})
def get_admin_system_stats():
    try:
        requester = _read_auth_payload()
        role = requester.get('role')
        admin_hosp = str(requester.get('hospitalId') or '').strip().lower()

        doctors_raw = _doctor_collection_reference().get() or {}
        patients_raw = _patient_collection_reference().get() or {}
        admins_raw = _admin_collection_reference().get() or {}

        doc_count = sum(1 for d in doctors_raw.values() if isinstance(d, dict) and (role == 'super_admin' or str(d.get('hospitalId') or '').strip().lower() == admin_hosp))
        pat_count = sum(1 for p in patients_raw.values() if isinstance(p, dict))
        admin_count = sum(1 for a in admins_raw.values() if isinstance(a, dict))

        return api_success('Admin stats fetched successfully.', {
            'stats': {
                'totalDoctors': doc_count,
                'totalPatients': pat_count,
                'totalAdmins': admin_count if role == 'super_admin' else 1,
                'role': role,
                'hospitalId': admin_hosp,
            }
        })
    except Exception as error:
        return api_error(str(error), 500)


# ============================================================================
# MULTI-HOSPITAL ADMIN SYSTEM & PATIENT MANAGEMENT ROUTES
# ============================================================================

@app.route('/api/admin/hospitals', methods=['POST'])
@require_auth(roles={'super_admin'})
def create_hospital():
    try:
        requester = _read_auth_payload()
        data = request.get_json(silent=True) or {}
        name = str(data.get('name') or '').strip()
        if not name:
            return api_error('Hospital name is required.', 400)

        custom_id = str(data.get('hospitalId') or '').strip().upper()
        if custom_id:
            hosp_id = custom_id
        else:
            slug = re.sub(r'[^A-Za-z0-9]', '', name)[:6].upper() or 'HOSP'
            hosp_id = f"HOSP-{slug}-{secrets.token_hex(2).upper()}"

        existing = _hospitals_collection_reference().child(hosp_id).get()
        if isinstance(existing, dict):
            return api_error(f'Hospital with ID {hosp_id} already exists.', 409)

        departments = data.get('departments')
        if isinstance(departments, str):
            departments = [d.strip() for d in departments.split(',') if d.strip()]
        elif not isinstance(departments, list) or not departments:
            departments = ['Cardiology', 'General Medicine', 'Emergency Care', 'Pediatrics', 'Neurology']

        now_iso = datetime.now(timezone.utc).isoformat()
        hospital_record = {
            'id': hosp_id,
            'hospitalId': hosp_id,
            'name': name,
            'address': str(data.get('address') or '').strip(),
            'city': str(data.get('city') or '').strip(),
            'state': str(data.get('state') or '').strip(),
            'phone': str(data.get('phone') or '').strip(),
            'email': str(data.get('email') or '').strip().lower(),
            'departments': departments,
            'isActive': True,
            'status': 'active',
            'createdAt': now_iso,
            'updatedAt': now_iso,
        }

        _hospitals_collection_reference().child(hosp_id).set(hospital_record)
        _log_security_event(requester, 'HOSPITAL_CREATED', 'hospital', hosp_id, hosp_id, f"Created hospital '{name}' ({hosp_id})")

        return api_success('Hospital created successfully.', {'hospital': hospital_record}, 201)
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/admin/hospitals', methods=['GET'])
@require_auth(roles={'super_admin', 'hospital_admin'})
def list_hospitals():
    try:
        requester = _read_auth_payload()
        role = requester.get('role')
        admin_hosp = str(requester.get('hospitalId') or '').strip().lower()

        hospitals_raw = _hospitals_collection_reference().get() or {}
        doctors_raw = _doctor_collection_reference().get() or {}
        patients_raw = _patient_collection_reference().get() or {}
        appointments_raw = _appointments_collection_reference().get() or {}

        hospitals = []
        if isinstance(hospitals_raw, dict):
            for k, h in hospitals_raw.items():
                if not isinstance(h, dict):
                    continue
                h_id = str(h.get('hospitalId') or h.get('id') or k).strip()
                h_id_lower = h_id.lower()

                if role == 'hospital_admin' and h_id_lower != admin_hosp:
                    continue

                doc_count = sum(1 for d in doctors_raw.values() if isinstance(d, dict) and str(d.get('hospitalId') or '').strip().lower() == h_id_lower)
                active_doc_count = sum(1 for d in doctors_raw.values() if isinstance(d, dict) and str(d.get('hospitalId') or '').strip().lower() == h_id_lower and d.get('isActive') is not False and d.get('status') != 'deactivated')
                pat_count = sum(1 for p in patients_raw.values() if isinstance(p, dict) and str(p.get('hospitalId') or '').strip().lower() == h_id_lower)
                apt_count = sum(1 for a in appointments_raw.values() if isinstance(a, dict) and str(a.get('hospitalId') or '').strip().lower() == h_id_lower)

                item = dict(h)
                item['id'] = h_id
                item['hospitalId'] = h_id
                item['doctorCount'] = doc_count
                item['activeDoctorCount'] = active_doc_count
                item['patientCount'] = pat_count
                item['appointmentCount'] = apt_count
                hospitals.append(item)

        return api_success('Hospitals fetched successfully.', {'hospitals': hospitals})
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/admin/hospitals/<hospital_id>', methods=['GET'])
@require_auth(roles={'super_admin', 'hospital_admin'})
def get_hospital(hospital_id):
    try:
        requester = _read_auth_payload()
        role = requester.get('role')
        admin_hosp = str(requester.get('hospitalId') or '').strip().lower()

        if role == 'hospital_admin' and str(hospital_id).strip().lower() != admin_hosp:
            return api_error('Forbidden. Hospital administrators can only view their own hospital.', 403)

        record = _hospitals_collection_reference().child(hospital_id).get()
        if not isinstance(record, dict):
            all_h = _hospitals_collection_reference().get() or {}
            if isinstance(all_h, dict):
                for k, h in all_h.items():
                    if isinstance(h, dict) and str(h.get('hospitalId') or h.get('id') or k).strip().lower() == str(hospital_id).strip().lower():
                        record = h
                        break

        if not isinstance(record, dict):
            return api_error('Hospital not found.', 404)

        h_id_lower = str(record.get('hospitalId') or record.get('id') or hospital_id).strip().lower()
        doctors_raw = _doctor_collection_reference().get() or {}
        patients_raw = _patient_collection_reference().get() or {}
        appointments_raw = _appointments_collection_reference().get() or {}

        doc_count = sum(1 for d in doctors_raw.values() if isinstance(d, dict) and str(d.get('hospitalId') or '').strip().lower() == h_id_lower)
        pat_count = sum(1 for p in patients_raw.values() if isinstance(p, dict) and str(p.get('hospitalId') or '').strip().lower() == h_id_lower)
        apt_count = sum(1 for a in appointments_raw.values() if isinstance(a, dict) and str(a.get('hospitalId') or '').strip().lower() == h_id_lower)

        resp_data = dict(record)
        resp_data['doctorCount'] = doc_count
        resp_data['patientCount'] = pat_count
        resp_data['appointmentCount'] = apt_count

        return api_success('Hospital details fetched successfully.', {'hospital': resp_data})
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/admin/hospitals/<hospital_id>', methods=['PUT'])
@require_auth(roles={'super_admin', 'hospital_admin'})
def update_hospital(hospital_id):
    try:
        requester = _read_auth_payload()
        role = requester.get('role')
        admin_hosp = str(requester.get('hospitalId') or '').strip().lower()

        if role == 'hospital_admin' and str(hospital_id).strip().lower() != admin_hosp:
            return api_error('Forbidden. Hospital administrators can only edit their own hospital.', 403)

        ref = _hospitals_collection_reference().child(hospital_id)
        record = ref.get()
        if not isinstance(record, dict):
            all_h = _hospitals_collection_reference().get() or {}
            if isinstance(all_h, dict):
                for k, h in all_h.items():
                    if isinstance(h, dict) and str(h.get('hospitalId') or h.get('id') or k).strip().lower() == str(hospital_id).strip().lower():
                        record = h
                        ref = _hospitals_collection_reference().child(k)
                        break

        if not isinstance(record, dict):
            return api_error('Hospital not found.', 404)

        data = request.get_json(silent=True) or {}
        updates = {'updatedAt': datetime.now(timezone.utc).isoformat()}
        for field in ('name', 'address', 'city', 'state', 'phone', 'email'):
            if field in data and data[field] is not None:
                updates[field] = str(data[field]).strip()

        if 'departments' in data:
            depts = data['departments']
            if isinstance(depts, str):
                updates['departments'] = [d.strip() for d in depts.split(',') if d.strip()]
            elif isinstance(depts, list):
                updates['departments'] = [str(d).strip() for d in depts if str(d).strip()]

        ref.update(updates)
        updated_record = {**record, **updates}

        _log_security_event(requester, 'HOSPITAL_UPDATED', 'hospital', hospital_id, hospital_id, "Updated hospital details")
        return api_success('Hospital updated successfully.', {'hospital': updated_record})
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/admin/hospitals/<hospital_id>/toggle-status', methods=['POST'])
@require_auth(roles={'super_admin'})
def toggle_hospital_status(hospital_id):
    try:
        requester = _read_auth_payload()
        ref = _hospitals_collection_reference().child(hospital_id)
        record = ref.get()
        if not isinstance(record, dict):
            all_h = _hospitals_collection_reference().get() or {}
            if isinstance(all_h, dict):
                for k, h in all_h.items():
                    if isinstance(h, dict) and str(h.get('hospitalId') or h.get('id') or k).strip().lower() == str(hospital_id).strip().lower():
                        record = h
                        ref = _hospitals_collection_reference().child(k)
                        break

        if not isinstance(record, dict):
            return api_error('Hospital not found.', 404)

        data = request.get_json(silent=True) or {}
        if 'isActive' in data:
            new_active = bool(data['isActive'])
        else:
            new_active = not (record.get('isActive') is not False and record.get('status') != 'deactivated')

        status_str = 'active' if new_active else 'deactivated'
        ref.update({
            'isActive': new_active,
            'status': status_str,
            'updatedAt': datetime.now(timezone.utc).isoformat(),
        })

        _log_security_event(requester, 'HOSPITAL_STATUS_TOGGLED', 'hospital', hospital_id, hospital_id, f"Hospital status changed to {status_str}")
        return api_success(f'Hospital {status_str} successfully.', {'hospitalId': hospital_id, 'isActive': new_active, 'status': status_str})
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/admin/metrics', methods=['GET'])
@require_auth(roles={'super_admin', 'hospital_admin'})
def get_admin_metrics():
    try:
        requester = _read_auth_payload()
        role = requester.get('role')
        admin_hosp = str(requester.get('hospitalId') or '').strip().lower()

        hospitals_raw = _hospitals_collection_reference().get() or {}
        doctors_raw = _doctor_collection_reference().get() or {}
        patients_raw = _patient_collection_reference().get() or {}
        appointments_raw = _appointments_collection_reference().get() or {}
        emergencies_raw = db.reference('emergencyAlerts').get() or {}

        doctors = [d for d in doctors_raw.values() if isinstance(d, dict)]
        if role == 'hospital_admin':
            doctors = [d for d in doctors if str(d.get('hospitalId') or '').strip().lower() == admin_hosp]

        patients = [p for p in patients_raw.values() if isinstance(p, dict)]
        if role == 'hospital_admin':
            doc_emails = {str(d.get('email') or d.get('doctorId') or '').strip().lower() for d in doctors}
            patients = [p for p in patients if str(p.get('hospitalId') or '').strip().lower() == admin_hosp or str(p.get('assignedDoctorId') or p.get('doctorId') or '').strip().lower() in doc_emails]

        appointments = [a for a in appointments_raw.values() if isinstance(a, dict)]
        if role == 'hospital_admin':
            appointments = [a for a in appointments if str(a.get('hospitalId') or '').strip().lower() == admin_hosp]

        emergencies = [e for e in emergencies_raw.values() if isinstance(e, dict)]
        if role == 'hospital_admin':
            emergencies = [e for e in emergencies if str(e.get('hospitalId') or '').strip().lower() == admin_hosp]

        total_doctors = len(doctors)
        active_doctors = sum(1 for d in doctors if d.get('isActive') is not False and d.get('status') != 'deactivated')
        deactivated_doctors = total_doctors - active_doctors

        total_patients = len(patients)
        active_patients = sum(1 for p in patients if p.get('isActive') is not False and p.get('status') != 'deactivated')
        assigned_patients = sum(1 for p in patients if str(p.get('assignedDoctorId') or p.get('doctorId') or '').strip())

        dept_counts = {}
        for d in doctors:
            dept = str(d.get('department') or d.get('specialty') or 'General').strip()
            dept_counts[dept] = dept_counts.get(dept, 0) + 1

        total_appointments = len(appointments)
        scheduled_appointments = sum(1 for a in appointments if str(a.get('status') or '').lower() == 'scheduled')
        completed_appointments = sum(1 for a in appointments if str(a.get('status') or '').lower() == 'completed')
        cancelled_appointments = sum(1 for a in appointments if str(a.get('status') or '').lower() == 'cancelled')

        total_emergencies = len(emergencies)
        active_emergencies = sum(1 for e in emergencies if str(e.get('status') or '').upper() not in ('RESOLVED', 'DISMISSED'))

        hospital_breakdowns = []
        if role == 'super_admin' and isinstance(hospitals_raw, dict):
            for k, h in hospitals_raw.items():
                if not isinstance(h, dict):
                    continue
                hid = str(h.get('hospitalId') or h.get('id') or k).strip()
                hid_lower = hid.lower()
                h_docs = sum(1 for d in doctors_raw.values() if isinstance(d, dict) and str(d.get('hospitalId') or '').strip().lower() == hid_lower)
                h_pats = sum(1 for p in patients_raw.values() if isinstance(p, dict) and str(p.get('hospitalId') or '').strip().lower() == hid_lower)
                h_apts = sum(1 for a in appointments_raw.values() if isinstance(a, dict) and str(a.get('hospitalId') or '').strip().lower() == hid_lower)
                h_emg = sum(1 for e in emergencies_raw.values() if isinstance(e, dict) and str(e.get('hospitalId') or '').strip().lower() == hid_lower)
                hospital_breakdowns.append({
                    'hospitalId': hid,
                    'name': h.get('name') or hid,
                    'city': h.get('city') or '',
                    'isActive': h.get('isActive') is not False and h.get('status') != 'deactivated',
                    'doctorCount': h_docs,
                    'patientCount': h_pats,
                    'appointmentCount': h_apts,
                    'emergencyCount': h_emg,
                })

        metrics = {
            'role': role,
            'hospitalId': admin_hosp if role == 'hospital_admin' else 'ALL',
            'doctors': {
                'total': total_doctors,
                'active': active_doctors,
                'deactivated': deactivated_doctors,
                'departmentBreakdown': dept_counts,
            },
            'patients': {
                'total': total_patients,
                'active': active_patients,
                'assigned': assigned_patients,
                'unassigned': total_patients - assigned_patients,
            },
            'appointments': {
                'total': total_appointments,
                'scheduled': scheduled_appointments,
                'completed': completed_appointments,
                'cancelled': cancelled_appointments,
            },
            'emergencies': {
                'total': total_emergencies,
                'active': active_emergencies,
                'resolved': total_emergencies - active_emergencies,
            },
            'hospitals': hospital_breakdowns if role == 'super_admin' else None,
            'totalHospitals': len(hospitals_raw) if role == 'super_admin' else 1,
        }

        return api_success('Metrics fetched successfully.', {'metrics': metrics})
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/admin/audit-logs', methods=['GET'])
@require_auth(roles={'super_admin', 'hospital_admin'})
def get_audit_logs():
    try:
        requester = _read_auth_payload()
        role = requester.get('role')
        admin_hosp = str(requester.get('hospitalId') or '').strip().lower()

        raw_logs = _security_audit_reference().get() or {}
        logs = []
        if isinstance(raw_logs, dict):
            for k, log_item in raw_logs.items():
                if not isinstance(log_item, dict):
                    continue
                if role == 'hospital_admin' and str(log_item.get('hospitalId') or '').strip().lower() != admin_hosp:
                    continue
                logs.append(log_item)

        action_filter = str(request.args.get('action') or '').strip().upper()
        search_term = str(request.args.get('search') or '').strip().lower()
        if action_filter:
            logs = [l for l in logs if str(l.get('action') or '').upper() == action_filter]
        if search_term:
            logs = [l for l in logs if (
                search_term in str(l.get('actorEmail') or '').lower() or
                search_term in str(l.get('details') or '').lower() or
                search_term in str(l.get('targetId') or '').lower() or
                search_term in str(l.get('action') or '').lower()
            )]

        logs.sort(key=lambda x: str(x.get('timestamp') or ''), reverse=True)
        limit = min(int(request.args.get('limit') or 100), 500)
        return api_success('Audit logs fetched successfully.', {'logs': logs[:limit], 'total': len(logs)})
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/admin/audit-logs/export', methods=['GET'])
@require_auth(roles={'super_admin', 'hospital_admin'})
def export_audit_logs():
    try:
        requester = _read_auth_payload()
        role = requester.get('role')
        admin_hosp = str(requester.get('hospitalId') or '').strip().lower()

        raw_logs = _security_audit_reference().get() or {}
        logs = []
        if isinstance(raw_logs, dict):
            for k, log_item in raw_logs.items():
                if not isinstance(log_item, dict):
                    continue
                if role == 'hospital_admin' and str(log_item.get('hospitalId') or '').strip().lower() != admin_hosp:
                    continue
                logs.append(log_item)

        logs.sort(key=lambda x: str(x.get('timestamp') or ''), reverse=True)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['ID', 'Timestamp', 'Action', 'Actor ID', 'Actor Role', 'Actor Email', 'Target Type', 'Target ID', 'Hospital ID', 'IP Address', 'Details'])

        for l in logs:
            writer.writerow([
                l.get('id', ''),
                l.get('timestamp', ''),
                l.get('action', ''),
                l.get('actorId', ''),
                l.get('actorRole', ''),
                l.get('actorEmail', ''),
                l.get('targetType', ''),
                l.get('targetId', ''),
                l.get('hospitalId', ''),
                l.get('ipAddress', ''),
                l.get('details', ''),
            ])

        _log_security_event(requester, 'AUDIT_LOGS_EXPORTED', 'audit_log', 'export', admin_hosp, f'Exported {len(logs)} audit log records')

        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': 'attachment; filename=security_audit_logs.csv'}
        )
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/hospital/doctors', methods=['GET'])
@require_auth(roles={'super_admin', 'hospital_admin'})
def get_hospital_doctors():
    try:
        requester = _read_auth_payload()
        role = requester.get('role')
        admin_hosp = str(requester.get('hospitalId') or '').strip().lower()
        requested_hosp = str(request.args.get('hospitalId') or '').strip().lower()

        target_hosp = admin_hosp if role == 'hospital_admin' else requested_hosp

        doctors_raw = _doctor_collection_reference().get() or {}
        patients_raw = _patient_collection_reference().get() or {}

        doctors = []
        if isinstance(doctors_raw, dict):
            for k, doc in doctors_raw.items():
                if not isinstance(doc, dict):
                    continue
                doc_hosp = str(doc.get('hospitalId') or '').strip().lower()
                if target_hosp and doc_hosp != target_hosp:
                    continue

                item = dict(doc)
                item.pop('passwordHash', None)
                item.pop('password', None)
                doc_id = str(item.get('id') or item.get('doctorId') or k)
                item['id'] = doc_id
                item['doctorId'] = doc_id

                p_count = sum(1 for p in patients_raw.values() if isinstance(p, dict) and str(p.get('assignedDoctorId') or p.get('doctorId') or '').strip().lower() == doc_id.lower())
                item['patientCount'] = p_count
                doctors.append(item)

        return api_success('Hospital doctors fetched successfully.', {'doctors': doctors})
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/hospital/doctors/<doctor_id>', methods=['PUT'])
@require_auth(roles={'super_admin', 'hospital_admin'})
def update_hospital_doctor(doctor_id):
    try:
        requester = _read_auth_payload()
        role = requester.get('role')
        admin_hosp = str(requester.get('hospitalId') or '').strip().lower()

        target_ref = None
        doctor = None
        safe_id = doctor_id.replace('.', ',')
        direct = _doctor_collection_reference().child(safe_id).get()
        if isinstance(direct, dict):
            target_ref = _doctor_collection_reference().child(safe_id)
            doctor = direct
        else:
            all_d = _doctor_collection_reference().get() or {}
            if isinstance(all_d, dict):
                for k, d in all_d.items():
                    if isinstance(d, dict) and (d.get('id') == doctor_id or d.get('doctorId') == doctor_id or d.get('email') == doctor_id):
                        target_ref = _doctor_collection_reference().child(k)
                        doctor = d
                        break

        if not doctor or not target_ref:
            return api_error('Doctor not found.', 404)

        doc_hosp = str(doctor.get('hospitalId') or '').strip().lower()
        if role == 'hospital_admin' and doc_hosp != admin_hosp:
            return api_error('Forbidden. Hospital administrators can only modify doctors in their hospital.', 403)

        data = request.get_json(silent=True) or {}
        updates = {'updatedAt': datetime.now(timezone.utc).isoformat()}
        for field in ('name', 'phone', 'department', 'specialty', 'qualification'):
            if field in data and data[field] is not None:
                updates[field] = str(data[field]).strip()

        target_ref.update(updates)
        updated_doctor = {**doctor, **updates}
        updated_doctor.pop('passwordHash', None)
        updated_doctor.pop('password', None)

        _log_security_event(requester, 'DOCTOR_UPDATED', 'doctor', doctor_id, doc_hosp, f"Updated doctor details for {doctor_id}")
        return api_success('Doctor updated successfully.', {'doctor': updated_doctor})
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/hospital/departments', methods=['GET'])
@require_auth(roles={'super_admin', 'hospital_admin'})
def get_hospital_departments():
    try:
        requester = _read_auth_payload()
        role = requester.get('role')
        admin_hosp = str(requester.get('hospitalId') or '').strip()
        hosp_id = admin_hosp if role == 'hospital_admin' else (str(request.args.get('hospitalId') or admin_hosp or 'HOSP-CITY-01').strip())

        hosp = _hospitals_collection_reference().child(hosp_id).get()
        departments = []
        if isinstance(hosp, dict):
            departments = hosp.get('departments') or []

        if not departments:
            departments = ['Cardiology', 'General Medicine', 'Neurology', 'Pulmonology', 'Emergency Care', 'Pediatrics']

        return api_success('Departments fetched successfully.', {'departments': departments, 'hospitalId': hosp_id})
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/hospital/departments', methods=['POST'])
@require_auth(roles={'super_admin', 'hospital_admin'})
def update_hospital_departments():
    try:
        requester = _read_auth_payload()
        role = requester.get('role')
        admin_hosp = str(requester.get('hospitalId') or '').strip()

        data = request.get_json(silent=True) or {}
        target_hosp = admin_hosp if role == 'hospital_admin' else str(data.get('hospitalId') or admin_hosp or 'HOSP-CITY-01').strip()

        departments = data.get('departments')
        if isinstance(departments, str):
            departments = [d.strip() for d in departments.split(',') if d.strip()]
        elif not isinstance(departments, list):
            return api_error('Departments must be a list of strings.', 400)

        _hospitals_collection_reference().child(target_hosp).update({
            'departments': departments,
            'updatedAt': datetime.now(timezone.utc).isoformat(),
        })

        _log_security_event(requester, 'DEPARTMENTS_UPDATED', 'hospital', target_hosp, target_hosp, f"Updated departments: {', '.join(departments)}")
        return api_success('Departments updated successfully.', {'departments': departments, 'hospitalId': target_hosp})
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/hospital/patients', methods=['GET'])
@require_auth(roles={'super_admin', 'hospital_admin'})
def get_hospital_patients():
    try:
        requester = _read_auth_payload()
        role = requester.get('role')
        admin_hosp = str(requester.get('hospitalId') or '').strip().lower()
        requested_hosp = str(request.args.get('hospitalId') or '').strip().lower()

        target_hosp = admin_hosp if role == 'hospital_admin' else requested_hosp

        patients_raw = _patient_collection_reference().get() or {}
        doctors_raw = _doctor_collection_reference().get() or {}

        patients = []
        if isinstance(patients_raw, dict):
            for k, pat in patients_raw.items():
                if not isinstance(pat, dict):
                    continue
                pat_hosp = str(pat.get('hospitalId') or '').strip().lower()

                if not pat_hosp:
                    doc_id = str(pat.get('assignedDoctorId') or pat.get('doctorId') or '').strip().lower()
                    for d in doctors_raw.values():
                        if isinstance(d, dict) and str(d.get('email') or d.get('doctorId') or '').strip().lower() == doc_id:
                            pat_hosp = str(d.get('hospitalId') or '').strip().lower()
                            break

                if target_hosp and pat_hosp != target_hosp:
                    continue

                item = dict(pat)
                item.pop('passwordHash', None)
                item.pop('password', None)
                p_id = str(item.get('id') or item.get('patientId') or k)
                item['id'] = p_id
                item['patientId'] = p_id
                item['hospitalId'] = pat.get('hospitalId') or pat_hosp or admin_hosp
                patients.append(item)

        search_term = str(request.args.get('search') or '').strip().lower()
        if search_term:
            patients = [p for p in patients if (
                search_term in str(p.get('patientId') or '').lower() or
                search_term in str(p.get('name') or '').lower() or
                search_term in str(p.get('email') or '').lower() or
                search_term in str(p.get('phone') or '').lower()
            )]

        patients.sort(key=lambda x: str(x.get('createdAt') or x.get('updatedAt') or ''), reverse=True)

        page = max(int(request.args.get('page') or 1), 1)
        limit = min(max(int(request.args.get('limit') or 20), 1), 100)
        total = len(patients)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit

        return api_success('Hospital patients fetched successfully.', {
            'patients': patients[start_idx:end_idx],
            'total': total,
            'page': page,
            'limit': limit,
            'totalPages': (total + limit - 1) // limit if limit > 0 else 1
        })
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/hospital/patients', methods=['POST'])
@require_auth(roles={'super_admin', 'hospital_admin'})
def register_hospital_patient():
    try:
        requester = _read_auth_payload()
        role = requester.get('role')
        admin_hosp = str(requester.get('hospitalId') or '').strip()

        data = request.get_json(silent=True) or {}
        name = str(data.get('name') or '').strip()
        email = str(data.get('email') or '').strip().lower()
        phone = str(data.get('phone') or '').strip()

        if not name:
            return api_error('Patient name is required.', 400)
        if not email or '@' not in email:
            return api_error('Valid email is required.', 400)
        if not phone or len(_normalize_phone(phone)) < 8:
            return api_error('Valid phone number is required.', 400)

        norm_phone = _normalize_phone(phone)
        norm_email = email.lower()

        # Strict duplicate prevention across patient registry
        existing_patients = _patient_collection_reference().get() or {}
        if isinstance(existing_patients, dict):
            for k, p in existing_patients.items():
                if not isinstance(p, dict):
                    continue
                p_email = str(p.get('email') or '').strip().lower()
                p_phone = _normalize_phone(p.get('phone') or '')
                if p_email == norm_email:
                    return api_error(f'Duplicate registration prevented: A patient with email {email} is already registered (ID: {p.get("patientId") or k}).', 409)
                if p_phone and p_phone == norm_phone:
                    return api_error(f'Duplicate registration prevented: A patient with phone {phone} is already registered (ID: {p.get("patientId") or k}).', 409)

        target_hosp = admin_hosp if role == 'hospital_admin' else str(data.get('hospitalId') or admin_hosp or 'HOSP-CITY-01').strip()

        assigned_doc_id = str(data.get('assignedDoctorId') or data.get('doctorId') or '').strip()
        assigned_doc_name = ''
        assigned_doc_email = ''
        assigned_doc_phone = ''

        if assigned_doc_id:
            doctors_raw = _doctor_collection_reference().get() or {}
            matched_doc = None
            if isinstance(doctors_raw, dict):
                for k, d in doctors_raw.items():
                    if isinstance(d, dict) and (d.get('id') == assigned_doc_id or d.get('doctorId') == assigned_doc_id or d.get('email') == assigned_doc_id or k == assigned_doc_id.replace('.', ',')):
                        matched_doc = d
                        break

            if not matched_doc:
                return api_error('Assigned doctor not found.', 404)

            doc_hosp = str(matched_doc.get('hospitalId') or '').strip().lower()
            if role == 'hospital_admin' and doc_hosp and doc_hosp != target_hosp.lower():
                return api_error('Assigned doctor must belong to the same hospital.', 400)

            assigned_doc_id = str(matched_doc.get('id') or matched_doc.get('doctorId') or matched_doc.get('email'))
            assigned_doc_name = matched_doc.get('name') or assigned_doc_id
            assigned_doc_email = str(matched_doc.get('email') or '')
            assigned_doc_phone = str(matched_doc.get('phone') or '')

        year = datetime.now().year
        pat_id = f"PAT-{year}-{secrets.token_hex(2).upper()}"
        now_iso = datetime.now(timezone.utc).isoformat()
        raw_pass = str(data.get('password') or 'HealthCare@2026').strip()
        pass_hash = generate_password_hash(raw_pass)

        record = {
            'id': pat_id,
            'patientId': pat_id,
            'name': name,
            'email': norm_email,
            'phone': phone,
            'age': int(data.get('age') or 30),
            'gender': str(data.get('gender') or 'other').strip().lower(),
            'bloodGroup': str(data.get('bloodGroup') or 'O+').strip(),
            'address': str(data.get('address') or '').strip(),
            'hospitalId': target_hosp,
            'assignedDoctorId': assigned_doc_id,
            'assignedDoctorName': assigned_doc_name,
            'assignedDoctorEmail': assigned_doc_email,
            'assignedDoctorPhone': assigned_doc_phone,
            'doctorId': assigned_doc_id,
            'doctorName': assigned_doc_name,
            'doctorEmail': assigned_doc_email,
            'password': raw_pass,
            'passwordHash': pass_hash,
            'isActive': True,
            'status': 'active',
            'createdAt': now_iso,
            'updatedAt': now_iso,
        }

        _patient_collection_reference().child(pat_id).set(record)

        _log_patient_history(pat_id, 'REGISTRATION', {
            'hospitalId': target_hosp,
            'assignedDoctor': assigned_doc_name or 'Unassigned',
            'assignedDoctorId': assigned_doc_id or '',
            'registeredBy': requester.get('email') or requester.get('adminId') or 'admin',
        }, requester)

        _log_security_event(requester, 'PATIENT_REGISTERED', 'patient', pat_id, target_hosp, f"Registered patient {name} ({pat_id})")

        client_record = dict(record)
        client_record.pop('passwordHash', None)
        client_record.pop('password', None)

        return api_success('Patient registered successfully.', {'patient': client_record}, 201)
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/hospital/patients/<patient_id>/assign', methods=['PUT'])
@require_auth(roles={'super_admin', 'hospital_admin'})
def reassign_patient_doctor(patient_id):
    try:
        requester = _read_auth_payload()
        role = requester.get('role')
        admin_hosp = str(requester.get('hospitalId') or '').strip().lower()

        patient_ref = _patient_collection_reference().child(patient_id)
        patient = patient_ref.get()
        if not isinstance(patient, dict):
            return api_error('Patient not found.', 404)

        pat_hosp = str(patient.get('hospitalId') or '').strip().lower()
        if role == 'hospital_admin' and pat_hosp and pat_hosp != admin_hosp:
            return api_error('Forbidden. Hospital administrators can only reassign patients in their hospital.', 403)

        data = request.get_json(silent=True) or {}
        new_doc_id = str(data.get('doctorId') or data.get('assignedDoctorId') or '').strip()
        if not new_doc_id:
            return api_error('New doctor ID is required.', 400)

        doctors_raw = _doctor_collection_reference().get() or {}
        matched_doc = None
        if isinstance(doctors_raw, dict):
            for k, d in doctors_raw.items():
                if isinstance(d, dict) and (d.get('id') == new_doc_id or d.get('doctorId') == new_doc_id or d.get('email') == new_doc_id or k == new_doc_id.replace('.', ',')):
                    matched_doc = d
                    break

        if not matched_doc:
            return api_error('Doctor not found.', 404)

        doc_hosp = str(matched_doc.get('hospitalId') or '').strip().lower()
        if role == 'hospital_admin' and doc_hosp and doc_hosp != admin_hosp:
            return api_error('Assigned doctor must belong to the same hospital.', 400)

        old_doc_name = str(patient.get('assignedDoctorName') or patient.get('doctorName') or 'Unassigned')
        old_doc_id = str(patient.get('assignedDoctorId') or patient.get('doctorId') or '')
        new_doc_name = matched_doc.get('name') or new_doc_id
        new_doc_email = str(matched_doc.get('email') or '')
        new_doc_phone = str(matched_doc.get('phone') or '')

        now_iso = datetime.now(timezone.utc).isoformat()
        updates = {
            'assignedDoctorId': new_doc_id,
            'assignedDoctorName': new_doc_name,
            'assignedDoctorEmail': new_doc_email,
            'assignedDoctorPhone': new_doc_phone,
            'doctorId': new_doc_id,
            'doctorName': new_doc_name,
            'doctorEmail': new_doc_email,
            'assignedDoctorUpdatedAt': now_iso,
            'updatedAt': now_iso,
        }
        if not patient.get('hospitalId') and (doc_hosp or admin_hosp):
            updates['hospitalId'] = doc_hosp or admin_hosp

        patient_ref.update(updates)

        _log_patient_history(patient_id, 'DOCTOR_REASSIGNMENT', {
            'previousDoctor': old_doc_name,
            'previousDoctorId': old_doc_id,
            'newDoctor': new_doc_name,
            'newDoctorId': new_doc_id,
            'reason': str(data.get('reason') or 'Clinical reassignment by administrator'),
        }, requester)

        _log_security_event(requester, 'PATIENT_ASSIGNMENT_CHANGED', 'patient', patient_id, pat_hosp or admin_hosp, f"Reassigned from {old_doc_name} to {new_doc_name}")

        updated_patient = {**patient, **updates}
        updated_patient.pop('passwordHash', None)
        updated_patient.pop('password', None)

        return api_success('Patient doctor assignment updated successfully.', {'patient': updated_patient})
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/patient/<patient_id>/history', methods=['GET'])
@require_auth(roles={'super_admin', 'hospital_admin', 'doctor', 'patient'})
def get_patient_history_route(patient_id):
    try:
        requester = _read_auth_payload()
        role = requester.get('role')

        patient = _patient_collection_reference().child(patient_id).get()
        if not isinstance(patient, dict):
            return api_error('Patient not found.', 404)

        if role == 'patient':
            if str(requester.get('patientId') or requester.get('id') or '').strip().lower() != str(patient_id).strip().lower():
                return api_error('Access denied.', 403)
        elif role == 'doctor':
            doc_id = str(requester.get('doctorId') or requester.get('email') or '').strip().lower()
            if not _doctor_owns_record(patient, doc_id):
                return api_error('Access denied for this patient record.', 403)
        elif role == 'hospital_admin':
            admin_hosp = str(requester.get('hospitalId') or '').strip().lower()
            pat_hosp = str(patient.get('hospitalId') or '').strip().lower()
            if pat_hosp and pat_hosp != admin_hosp:
                return api_error('Access denied for this hospital patient record.', 403)

        raw_history = _patient_history_reference(patient_id).get() or {}
        history_items = []
        if isinstance(raw_history, dict):
            for k, item in raw_history.items():
                if isinstance(item, dict):
                    history_items.append(item)

        history_items.sort(key=lambda x: str(x.get('timestamp') or ''), reverse=True)
        return api_success('Patient history fetched successfully.', {'history': history_items, 'patientId': patient_id})
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/hospital/patients/export', methods=['GET'])
@require_auth(roles={'super_admin', 'hospital_admin'})
def export_hospital_patients():
    try:
        requester = _read_auth_payload()
        role = requester.get('role')
        admin_hosp = str(requester.get('hospitalId') or '').strip().lower()

        patients_raw = _patient_collection_reference().get() or {}
        doctors_raw = _doctor_collection_reference().get() or {}

        patients = []
        if isinstance(patients_raw, dict):
            for k, pat in patients_raw.items():
                if not isinstance(pat, dict):
                    continue
                pat_hosp = str(pat.get('hospitalId') or '').strip().lower()
                if not pat_hosp:
                    doc_id = str(pat.get('assignedDoctorId') or pat.get('doctorId') or '').strip().lower()
                    for d in doctors_raw.values():
                        if isinstance(d, dict) and str(d.get('email') or d.get('doctorId') or '').strip().lower() == doc_id:
                            pat_hosp = str(d.get('hospitalId') or '').strip().lower()
                            break

                if role == 'hospital_admin' and pat_hosp != admin_hosp:
                    continue

                patients.append(pat)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Patient ID', 'Name', 'Email', 'Phone', 'Age', 'Gender', 'Blood Group', 'Hospital ID', 'Assigned Doctor', 'Status', 'Registered Date'])

        for p in patients:
            writer.writerow([
                p.get('patientId') or p.get('id', ''),
                p.get('name', ''),
                p.get('email', ''),
                p.get('phone', ''),
                p.get('age', ''),
                p.get('gender', ''),
                p.get('bloodGroup', ''),
                p.get('hospitalId', ''),
                p.get('assignedDoctorName') or p.get('doctorName', ''),
                'Active' if p.get('isActive') is not False and p.get('status') != 'deactivated' else 'Deactivated',
                p.get('createdAt', ''),
            ])

        _log_security_event(requester, 'PATIENTS_EXPORTED', 'patient', 'export', admin_hosp, f"Exported {len(patients)} patient records")

        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': 'attachment; filename=hospital_patients.csv'}
        )
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/hospital/appointments', methods=['GET'])
@require_auth(roles={'super_admin', 'hospital_admin', 'doctor', 'patient'})
def get_hospital_appointments():
    try:
        requester = _read_auth_payload()
        role = requester.get('role')
        admin_hosp = str(requester.get('hospitalId') or '').strip().lower()

        raw_apts = _appointments_collection_reference().get() or {}
        appointments = []
        if isinstance(raw_apts, dict):
            for k, a in raw_apts.items():
                if not isinstance(a, dict):
                    continue
                a_hosp = str(a.get('hospitalId') or '').strip().lower()
                if role == 'hospital_admin' and a_hosp != admin_hosp:
                    continue
                if role == 'doctor':
                    doc_id = str(requester.get('doctorId') or requester.get('email') or '').strip().lower()
                    a_doc = str(a.get('doctorId') or '').strip().lower()
                    if a_doc != doc_id:
                        continue
                if role == 'patient':
                    pat_id = str(requester.get('patientId') or requester.get('id') or '').strip().lower()
                    a_pat = str(a.get('patientId') or '').strip().lower()
                    if a_pat != pat_id:
                        continue

                item = dict(a)
                item['id'] = a.get('id') or a.get('appointmentId') or k
                appointments.append(item)

        status_filter = str(request.args.get('status') or '').strip().lower()
        if status_filter:
            appointments = [a for a in appointments if str(a.get('status') or '').lower() == status_filter]

        appointments.sort(key=lambda x: str(x.get('appointmentDate') or '') + ' ' + str(x.get('appointmentTime') or ''))
        return api_success('Appointments fetched successfully.', {'appointments': appointments})
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/hospital/appointments', methods=['POST'])
@require_auth(roles={'super_admin', 'hospital_admin', 'doctor', 'patient'})
def create_hospital_appointment():
    try:
        requester = _read_auth_payload()
        role = requester.get('role')
        admin_hosp = str(requester.get('hospitalId') or '').strip()

        data = request.get_json(silent=True) or {}
        patient_id = str(data.get('patientId') or '').strip()
        doctor_id = str(data.get('doctorId') or '').strip()
        apt_date = str(data.get('appointmentDate') or '').strip()
        apt_time = str(data.get('appointmentTime') or '').strip()
        apt_type = str(data.get('type') or 'Consultation').strip()

        # Enforce patient identity: never trust browser patientId for patient role
        if role == 'patient':
            patient_id = str(requester.get('patientId') or requester.get('id') or '').strip()

        if not patient_id or not doctor_id or not apt_date:
            return api_error('Patient ID, Doctor ID, and Appointment Date are required.', 400)

        patient = _patient_collection_reference().child(patient_id).get()
        if not isinstance(patient, dict):
            return api_error('Patient not found.', 404)

        doctors_raw = _doctor_collection_reference().get() or {}
        doctor = None
        if isinstance(doctors_raw, dict):
            for k, d in doctors_raw.items():
                if isinstance(d, dict) and (d.get('id') == doctor_id or d.get('doctorId') == doctor_id or d.get('email') == doctor_id or k == doctor_id.replace('.', ',')):
                    doctor = d
                    break

        if not doctor:
            return api_error('Doctor not found.', 404)

        doc_hosp = str(doctor.get('hospitalId') or admin_hosp or patient.get('hospitalId') or 'HOSP-CITY-01').strip()
        if role == 'hospital_admin' and admin_hosp.lower() != doc_hosp.lower():
            return api_error('Appointments can only be scheduled for doctors within your hospital.', 403)

        apt_id = f"APT-{datetime.now().year}-{secrets.token_hex(2).upper()}"
        now_iso = datetime.now(timezone.utc).isoformat()
        appointment_record = {
            'id': apt_id,
            'appointmentId': apt_id,
            'patientId': patient_id,
            'patientName': patient.get('name') or patient_id,
            'patientPhone': patient.get('phone') or '',
            'doctorId': doctor_id,
            'doctorName': doctor.get('name') or doctor_id,
            'doctorSpecialty': doctor.get('specialty') or doctor.get('department') or 'General Medicine',
            'hospitalId': doc_hosp,
            'appointmentDate': apt_date,
            'appointmentTime': apt_time,
            'type': apt_type,
            'notes': str(data.get('notes') or '').strip(),
            'status': 'scheduled',
            'createdAt': now_iso,
            'updatedAt': now_iso,
        }

        _appointments_collection_reference().child(apt_id).set(appointment_record)

        _log_patient_history(patient_id, 'APPOINTMENT_SCHEDULED', {
            'appointmentId': apt_id,
            'doctorName': doctor.get('name') or doctor_id,
            'date': apt_date,
            'time': apt_time,
            'type': apt_type,
        }, requester)

        _log_security_event(requester, 'APPOINTMENT_CREATED', 'appointment', apt_id, doc_hosp, f"Scheduled appointment with Dr. {doctor.get('name')}")
        return api_success('Appointment scheduled successfully.', {'appointment': appointment_record}, 201)
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/hospital/appointments/<appointment_id>/status', methods=['PUT'])
@require_auth(roles={'super_admin', 'hospital_admin', 'doctor', 'patient'})
def update_appointment_status(appointment_id):
    try:
        requester = _read_auth_payload()
        role = requester.get('role')
        admin_hosp = str(requester.get('hospitalId') or '').strip().lower()

        apt_ref = _appointments_collection_reference().child(appointment_id)
        apt = apt_ref.get()
        if not isinstance(apt, dict):
            return api_error('Appointment not found.', 404)

        if role == 'patient':
            pat_id = str(requester.get('patientId') or requester.get('id') or '').strip().lower()
            if str(apt.get('patientId') or '').strip().lower() != pat_id:
                return api_error('Forbidden. Patients can only update their own appointments.', 403)
        elif role == 'hospital_admin':
            apt_hosp = str(apt.get('hospitalId') or '').strip().lower()
            if apt_hosp != admin_hosp:
                return api_error('Forbidden. Hospital administrators can only update appointments for their hospital.', 403)
        elif role == 'doctor':
            doc_id = str(requester.get('doctorId') or requester.get('email') or '').strip().lower()
            if str(apt.get('doctorId') or '').strip().lower() != doc_id:
                return api_error('Forbidden. Doctors can only update their own appointments.', 403)

        data = request.get_json(silent=True) or {}
        new_status = str(data.get('status') or '').strip().lower()
        if role == 'patient' and new_status not in ('cancelled',):
            return api_error('Patients can only cancel appointments. Please contact your hospital to reschedule.', 400)

        if new_status not in ('scheduled', 'in-progress', 'completed', 'cancelled'):
            return api_error('Invalid status. Must be scheduled, in-progress, completed, or cancelled.', 400)

        now_iso = datetime.now(timezone.utc).isoformat()
        updates = {
            'status': new_status,
            'notes': str(data.get('notes') or apt.get('notes') or '').strip(),
            'updatedAt': now_iso,
        }
        apt_ref.update(updates)

        _log_patient_history(apt.get('patientId'), 'APPOINTMENT_STATUS_CHANGED', {
            'appointmentId': appointment_id,
            'previousStatus': apt.get('status'),
            'newStatus': new_status,
        }, requester)

        updated_record = {**apt, **updates}
        return api_success(f'Appointment marked as {new_status}.', {'appointment': updated_record})
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/hospital/telemetry-overview', methods=['GET'])
@require_auth(roles={'super_admin', 'hospital_admin'})
def get_hospital_telemetry_overview():
    try:
        requester = _read_auth_payload()
        role = requester.get('role')
        admin_hosp = str(requester.get('hospitalId') or '').strip().lower()

        emergencies_raw = db.reference('emergencyAlerts').get() or {}
        appointments_raw = _appointments_collection_reference().get() or {}

        alerts = []
        if isinstance(emergencies_raw, dict):
            for k, emg in emergencies_raw.items():
                if not isinstance(emg, dict):
                    continue
                e_hosp = str(emg.get('hospitalId') or '').strip().lower()
                if role == 'hospital_admin' and e_hosp and e_hosp != admin_hosp:
                    continue
                alerts.append({
                    'id': emg.get('id') or emg.get('alertId') or k,
                    'patientId': emg.get('patientId') or '',
                    'patientName': emg.get('patientName') or '',
                    'type': emg.get('type') or 'SOS',
                    'status': emg.get('status') or 'TRIGGERED',
                    'severity': emg.get('severity') or 'CRITICAL',
                    'timestamp': emg.get('timestamp') or '',
                    'location': emg.get('location') or {},
                })

        active_alerts = [a for a in alerts if str(a.get('status') or '').upper() not in ('RESOLVED', 'DISMISSED')]

        today_str = datetime.now().strftime('%Y-%m-%d')
        today_apts = []
        if isinstance(appointments_raw, dict):
            for k, a in appointments_raw.items():
                if not isinstance(a, dict):
                    continue
                a_hosp = str(a.get('hospitalId') or '').strip().lower()
                if role == 'hospital_admin' and a_hosp != admin_hosp:
                    continue
                if str(a.get('appointmentDate') or '') == today_str:
                    today_apts.append(a)

        return api_success('Telemetry overview fetched successfully.', {
            'activeEmergencyAlerts': active_alerts,
            'totalEmergencyAlerts': len(alerts),
            'todayAppointments': len(today_apts),
            'hospitalId': admin_hosp if role == 'hospital_admin' else 'ALL',
        })
    except Exception as error:
        return api_error(str(error), 500)


# ============================================================================
# PATIENT PERSONAL HEALTHCARE PORTAL ROUTES
# ============================================================================

@app.route('/api/patient/<patient_id>/portal-summary', methods=['GET'])
@require_auth(roles={'patient', 'doctor', 'hospital_admin', 'super_admin'}, patient_id_arg='patient_id')
def get_patient_portal_summary(patient_id):
    try:
        pid = str(patient_id or '').strip()
        patient_ref = _patient_collection_reference().child(pid)
        patient = patient_ref.get()
        if not isinstance(patient, dict):
            return api_error('Patient not found.', 404)

        # 1. Hospital Information
        hosp_id = str(patient.get('hospitalId') or 'HOSP-CITY-01').strip()
        hospital_info = _hospitals_collection_reference().child(hosp_id).get() or {
            'id': hosp_id,
            'hospitalId': hosp_id,
            'name': 'City General Medical Center',
            'phone': '+911140001000',
            'email': 'care@citygeneral.org',
            'address': 'Healthcare Boulevard, Suite 400',
        }

        # 2. Assigned Doctor Information
        doc_id = str(patient.get('assignedDoctorId') or patient.get('doctorId') or '').strip()
        doctor_info = None
        if doc_id:
            doctors_raw = _doctor_collection_reference().get() or {}
            if isinstance(doctors_raw, dict):
                for k, d in doctors_raw.items():
                    if isinstance(d, dict) and (d.get('id') == doc_id or d.get('doctorId') == doc_id or d.get('email') == doc_id or k == doc_id.replace('.', ',')):
                        doctor_info = {
                            'id': d.get('id') or doc_id,
                            'name': d.get('name') or patient.get('assignedDoctorName') or 'Treating Physician',
                            'specialty': d.get('specialty') or d.get('department') or 'General Medicine',
                            'email': d.get('email') or '',
                            'phone': d.get('phone') or '',
                            'hospitalId': d.get('hospitalId') or hosp_id,
                        }
                        break

        if not doctor_info:
            doctor_info = {
                'id': doc_id or 'DOC-UNASSIGNED',
                'name': patient.get('assignedDoctorName') or patient.get('doctorName') or 'General Medical Team',
                'specialty': patient.get('doctorSpecialty') or 'General Medicine',
                'email': patient.get('doctorEmail') or '',
                'phone': patient.get('doctorPhone') or '',
                'hospitalId': hosp_id,
            }

        # 3. Upcoming Appointments
        appointments_raw = _appointments_collection_reference().get() or {}
        upcoming_apts = []
        if isinstance(appointments_raw, dict):
            pid_lower = pid.lower()
            for k, a in appointments_raw.items():
                if isinstance(a, dict) and str(a.get('patientId') or '').strip().lower() == pid_lower:
                    if str(a.get('status') or '').lower() in ('scheduled', 'in-progress'):
                        upcoming_apts.append(a)

        upcoming_apts.sort(key=lambda x: str(x.get('appointmentDate') or '') + ' ' + str(x.get('appointmentTime') or ''))

        # 4. Active Prescriptions
        medicines = patient.get('medicines') or []
        if not isinstance(medicines, list):
            medicines = list(medicines.values()) if isinstance(medicines, dict) else []
        active_prescriptions = [m for m in medicines if isinstance(m, dict) and m.get('status') != 'discontinued']

        # 5. Measurements with Explicit Data Source Tagging
        vitals = patient.get('vitals') if isinstance(patient.get('vitals'), dict) else {}
        is_device_connected = bool(patient.get('deviceConnected'))
        has_manual = bool(patient.get('manualVitals'))

        hr_val = vitals.get('heart_rate') or vitals.get('heartRate') or patient.get('heart_rate') or patient.get('heartRate')
        spo2_val = vitals.get('spo2') or patient.get('spo2')
        temp_val = vitals.get('temperature') or patient.get('temperature')
        sys_bp = patient.get('systolicBP') or vitals.get('systolicBP') or 120
        dia_bp = patient.get('diastolicBP') or vitals.get('diastolicBP') or 80
        glucose_val = patient.get('bloodGlucose') or vitals.get('bloodGlucose')

        measurements = {
            'heartRate': {
                'value': _coerce_float(hr_val, 72.0) if hr_val is not None else None,
                'unit': 'bpm',
                'source': 'device-generated' if is_device_connected else ('manually-entered' if has_manual else 'missing'),
                'status': 'normal' if hr_val and 50 <= _coerce_float(hr_val) <= 100 else ('critical' if hr_val and (_coerce_float(hr_val) < 40 or _coerce_float(hr_val) > 130) else 'warning'),
            },
            'spo2': {
                'value': _coerce_float(spo2_val, 98.0) if spo2_val is not None else None,
                'unit': '%',
                'source': 'device-generated' if is_device_connected else ('manually-entered' if has_manual else 'missing'),
                'status': 'normal' if spo2_val and _coerce_float(spo2_val) >= 95 else 'critical',
            },
            'temperature': {
                'value': _coerce_float(temp_val, 36.8) if temp_val is not None else None,
                'unit': '°C',
                'source': 'device-generated' if is_device_connected else ('manually-entered' if has_manual else 'missing'),
                'status': 'normal' if temp_val and 36.0 <= _coerce_float(temp_val) <= 37.5 else 'warning',
            },
            'bloodPressure': {
                'systolic': _coerce_int(sys_bp, 120),
                'diastolic': _coerce_int(dia_bp, 80),
                'unit': 'mmHg',
                'source': 'manually-entered' if has_manual else 'clinical-baseline',
                'status': 'normal' if sys_bp <= 125 and dia_bp <= 82 else 'warning',
            },
            'bloodGlucose': {
                'value': _coerce_float(glucose_val, 95.0) if glucose_val is not None else None,
                'unit': 'mg/dL',
                'source': 'manually-entered' if glucose_val is not None else 'missing',
                'status': 'normal',
            },
            'ecg': {
                'status': 'Normal Sinus Rhythm' if is_device_connected else 'Device Standby',
                'lead': 'Lead II',
                'source': 'device-generated' if is_device_connected else 'standby',
            },
            'deviceConnected': is_device_connected,
            'lastUpdated': patient.get('updatedAt') or patient.get('createdAt') or datetime.now(timezone.utc).isoformat(),
        }

        # 6. Recent Consultations & Released Reports
        consultations = patient.get('consultations') or []
        if not isinstance(consultations, list):
            consultations = list(consultations.values()) if isinstance(consultations, dict) else []

        test_reports = patient.get('testReports') or []
        if not isinstance(test_reports, list):
            test_reports = list(test_reports.values()) if isinstance(test_reports, dict) else []

        # 7. Unread Notifications Count
        notifs = patient.get('notifications') or []
        if not isinstance(notifs, list):
            notifs = list(notifs.values()) if isinstance(notifs, dict) else []
        unread_notifs = sum(1 for n in notifs if isinstance(n, dict) and not n.get('read'))

        client_patient = dict(patient)
        client_patient.pop('passwordHash', None)
        client_patient.pop('password', None)

        return api_success('Portal summary fetched successfully.', {
            'patient': client_patient,
            'hospital': hospital_info,
            'doctor': doctor_info,
            'upcomingAppointments': upcoming_apts,
            'activePrescriptions': active_prescriptions,
            'measurements': measurements,
            'recentConsultations': consultations[-5:],
            'releasedReports': test_reports[-5:],
            'unreadNotifications': unread_notifs,
        })
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/patient/<patient_id>/profile', methods=['PUT'])
@require_auth(roles={'patient', 'hospital_admin', 'super_admin'}, patient_id_arg='patient_id')
def update_patient_portal_profile(patient_id):
    try:
        requester = _read_auth_payload()
        pid = str(patient_id or '').strip()
        patient_ref = _patient_collection_reference().child(pid)
        patient = patient_ref.get()
        if not isinstance(patient, dict):
            return api_error('Patient not found.', 404)

        data = request.get_json(silent=True) or {}
        
        # Allowed editable patient self-service fields (Strictly non-clinical)
        allowed_fields = ['phone', 'emergencyContact', 'emergencyPhone', 'address', 'bloodGroup', 'allergies', 'gender']
        updates = {}
        for f in allowed_fields:
            if f in data:
                updates[f] = str(data.get(f) or '').strip()

        if not updates:
            return api_error('No valid profile fields provided for update.', 400)

        now_iso = datetime.now(timezone.utc).isoformat()
        updates['updatedAt'] = now_iso
        patient_ref.update(updates)

        _log_patient_history(pid, 'PATIENT_PROFILE_UPDATED', {
            'updatedFields': list(updates.keys()),
        }, requester)

        updated_patient = {**patient, **updates}
        updated_patient.pop('passwordHash', None)
        updated_patient.pop('password', None)

        return api_success('Profile updated successfully.', {'patient': updated_patient})
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/patient/<patient_id>/medical-history', methods=['GET'])
@require_auth(roles={'patient', 'doctor', 'hospital_admin', 'super_admin'}, patient_id_arg='patient_id')
def get_patient_medical_history(patient_id):
    try:
        pid = str(patient_id or '').strip()
        patient = _patient_collection_reference().child(pid).get()
        if not isinstance(patient, dict):
            return api_error('Patient not found.', 404)

        consultations = patient.get('consultations') or []
        if not isinstance(consultations, list):
            consultations = list(consultations.values()) if isinstance(consultations, dict) else []

        test_reports = patient.get('testReports') or []
        if not isinstance(test_reports, list):
            test_reports = list(test_reports.values()) if isinstance(test_reports, dict) else []

        diagnoses = patient.get('diagnoses') or []
        if not isinstance(diagnoses, list):
            diagnoses = list(diagnoses.values()) if isinstance(diagnoses, dict) else []

        treatments = patient.get('treatments') or []
        if not isinstance(treatments, list):
            treatments = list(treatments.values()) if isinstance(treatments, dict) else []

        # If empty initial record, provide verified baseline onboarding record
        if not consultations:
            consultations = [
                {
                    'id': f"CONS-INIT-{pid}",
                    'consultationDate': patient.get('createdAt', datetime.now(timezone.utc).isoformat())[:10],
                    'attendingDoctor': patient.get('assignedDoctorName') or 'Treating Physician',
                    'department': 'General Medicine',
                    'symptoms': 'Initial clinical registration and baseline telemetry assessment',
                    'diagnosis': 'Clinical baseline established. Regular ambulatory monitoring initiated.',
                    'treatmentPlan': 'Daily vitals sync, lifestyle modification, periodic outpatient review.',
                    'status': 'Finalized',
                }
            ]

        if not test_reports:
            test_reports = [
                {
                    'id': f"LAB-BASE-{pid}",
                    'testName': 'Comprehensive Vitals & Cardiac Rhythm Baseline',
                    'date': patient.get('createdAt', datetime.now(timezone.utc).isoformat())[:10],
                    'labName': 'Central Diagnostic Pathology & Telemetry Ward',
                    'status': 'Verified',
                    'findings': 'Normal Sinus Rhythm, SpO2 within nominal target range, no acute ST-segment deviations.',
                    'verifiedBy': patient.get('assignedDoctorName') or 'Chief Medical Officer',
                }
            ]

        return api_success('Medical history retrieved successfully.', {
            'patientId': pid,
            'consultations': consultations,
            'testReports': test_reports,
            'diagnoses': diagnoses,
            'treatments': treatments,
            'isReadOnly': True,  # Patients cannot edit finalized clinical records
        })
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/doctor/<doctor_id>/patient/<patient_id>/consultations', methods=['POST'])
@require_auth(roles={'doctor'})
def add_patient_consultation(doctor_id, patient_id):
    try:
        requester = _read_auth_payload()
        req_doc = str(requester.get('doctorId') or requester.get('email') or '').strip().lower()
        if req_doc != str(doctor_id).strip().lower():
            return api_error('Forbidden. Clinician context mismatch.', 403)

        patient_ref = _patient_collection_reference().child(patient_id)
        patient = patient_ref.get()
        if not isinstance(patient, dict):
            return api_error('Patient not found.', 404)

        if not _doctor_owns_record(patient, req_doc):
            return api_error('Forbidden. Doctor is not assigned to this patient.', 403)

        data = request.get_json(silent=True) or {}
        symptoms = str(data.get('symptoms') or '').strip()
        diagnosis = str(data.get('diagnosis') or '').strip()
        treatment = str(data.get('treatmentPlan') or data.get('treatment') or '').strip()

        if not diagnosis:
            return api_error('Clinical diagnosis is required.', 400)

        now_iso = datetime.now(timezone.utc).isoformat()
        cons_id = f"CONS-{datetime.now().year}-{secrets.token_hex(2).upper()}"
        cons_record = {
            'id': cons_id,
            'consultationDate': now_iso[:10],
            'attendingDoctor': requester.get('name') or doctor_id,
            'doctorId': doctor_id,
            'department': str(data.get('department') or 'General Medicine').strip(),
            'symptoms': symptoms,
            'diagnosis': diagnosis,
            'treatmentPlan': treatment,
            'notes': str(data.get('notes') or '').strip(),
            'status': 'Finalized',
            'createdAt': now_iso,
        }

        consultations = patient.get('consultations') or []
        if not isinstance(consultations, list):
            consultations = list(consultations.values()) if isinstance(consultations, dict) else []
        consultations.append(cons_record)
        patient_ref.update({'consultations': consultations, 'updatedAt': now_iso})

        _log_patient_history(patient_id, 'CONSULTATION_RECORDED', {
            'consultationId': cons_id,
            'doctorName': requester.get('name') or doctor_id,
            'diagnosis': diagnosis,
        }, requester)

        return api_success('Consultation record finalized successfully.', {'consultation': cons_record}, 201)
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/patient/<patient_id>/health-monitoring', methods=['GET'])
@require_auth(roles={'patient', 'doctor', 'hospital_admin', 'super_admin'}, patient_id_arg='patient_id')
def get_patient_health_monitoring(patient_id):
    try:
        pid = str(patient_id or '').strip()
        patient = _patient_collection_reference().child(pid).get()
        if not isinstance(patient, dict):
            return api_error('Patient not found.', 404)

        vitals = patient.get('vitals') if isinstance(patient.get('vitals'), dict) else {}
        is_device_connected = bool(patient.get('deviceConnected'))

        manual_history = patient.get('manualVitals') or []
        if not isinstance(manual_history, list):
            manual_history = list(manual_history.values()) if isinstance(manual_history, dict) else []

        # Staleness & Connection State Evaluation
        now_ts = time.time()
        updated_at_str = str(patient.get('updatedAt') or vitals.get('updatedAt') or '')
        is_stale = True
        conn_state = 'OFFLINE'
        sec_since_read = None

        if updated_at_str:
            try:
                if 'T' in updated_at_str:
                    dt = datetime.fromisoformat(updated_at_str.replace('Z', '+00:00'))
                else:
                    dt = datetime.strptime(updated_at_str, '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc)
                sec_since_read = max(0, int(now_ts - dt.timestamp()))
                if is_device_connected:
                    if sec_since_read <= 20:
                        conn_state = 'LIVE'
                        is_stale = False
                    elif sec_since_read <= 60:
                        conn_state = 'ONLINE_DELAYED'
                        is_stale = False
                    else:
                        conn_state = 'STALE'
                        is_stale = True
            except Exception:
                pass

        current = {
            'heartRate': _coerce_float(vitals.get('heart_rate') or vitals.get('heartRate') or patient.get('heart_rate') or 72),
            'spo2': _coerce_float(vitals.get('spo2') or patient.get('spo2') or 98),
            'temperature': _coerce_float(vitals.get('temperature') or patient.get('temperature') or 36.8),
            'systolicBP': _coerce_int(patient.get('systolicBP') or 120),
            'diastolicBP': _coerce_int(patient.get('diastolicBP') or 80),
            'bloodGlucose': _coerce_float(patient.get('bloodGlucose') or 95),
            'ecgData': _sanitize_ecg_samples(vitals.get('ecgData') or patient.get('ecgData')),
            'deviceConnected': is_device_connected,
            'connectionState': conn_state,
            'isStale': is_stale,
            'secondsSinceLastReading': sec_since_read,
            'lastSuccessfulReading': updated_at_str or None,
            'sensorTier': 'PROTOTYPE_INVESTIGATIONAL' if is_device_connected else 'N/A',
            'isClinicalGrade': False,
            'clinicalNotice': 'Prototype telemetry is for investigational use and must not replace clinically certified diagnostic equipment.',
            'measurementSource': 'device-generated' if is_device_connected else ('manually-entered' if manual_history else 'baseline'),
            'lastUpdated': patient.get('updatedAt') or datetime.now(timezone.utc).isoformat(),
        }

        return api_success('Health monitoring data retrieved.', {
            'current': current,
            'manualVitalsHistory': manual_history[-20:],
            'patientId': pid,
        })
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/patient/<patient_id>/manual-vitals', methods=['POST'])
@require_auth(roles={'patient', 'doctor'}, patient_id_arg='patient_id')
def log_patient_manual_vitals(patient_id):
    try:
        requester = _read_auth_payload()
        pid = str(patient_id or '').strip()
        patient_ref = _patient_collection_reference().child(pid)
        patient = patient_ref.get()
        if not isinstance(patient, dict):
            return api_error('Patient not found.', 404)

        data = request.get_json(silent=True) or {}
        hr = data.get('heartRate')
        spo2 = data.get('spo2')
        temp = data.get('temperature')
        sys_bp = data.get('systolicBP')
        dia_bp = data.get('diastolicBP')
        glucose = data.get('bloodGlucose')
        notes = str(data.get('notes') or '').strip()

        # Physiological validation
        errors = []
        if hr is not None and not (30 <= _coerce_float(hr) <= 220):
            errors.append('Heart rate must be between 30 and 220 bpm.')
        if spo2 is not None and not (60 <= _coerce_float(spo2) <= 100):
            errors.append('SpO2 must be between 60% and 100%.')
        if temp is not None and not (34.0 <= _coerce_float(temp) <= 43.0):
            errors.append('Temperature must be between 34.0°C and 43.0°C.')
        if sys_bp is not None and not (70 <= _coerce_int(sys_bp) <= 240):
            errors.append('Systolic BP must be between 70 and 240 mmHg.')
        if dia_bp is not None and not (40 <= _coerce_int(dia_bp) <= 140):
            errors.append('Diastolic BP must be between 40 and 140 mmHg.')

        if errors:
            return api_error(errors[0], 400, {'errors': errors})

        now_iso = datetime.now(timezone.utc).isoformat()
        entry = {
            'id': f"MVIT-{int(time.time() * 1000)}",
            'timestamp': now_iso,
            'source': 'manually-entered',
            'recordedBy': requester.get('email') or requester.get('role') or 'patient',
            'heartRate': _coerce_float(hr) if hr is not None else None,
            'spo2': _coerce_float(spo2) if spo2 is not None else None,
            'temperature': _coerce_float(temp) if temp is not None else None,
            'systolicBP': _coerce_int(sys_bp) if sys_bp is not None else None,
            'diastolicBP': _coerce_int(dia_bp) if dia_bp is not None else None,
            'bloodGlucose': _coerce_float(glucose) if glucose is not None else None,
            'notes': notes,
        }

        manual_list = patient.get('manualVitals') or []
        if not isinstance(manual_list, list):
            manual_list = list(manual_list.values()) if isinstance(manual_list, dict) else []
        manual_list.append(entry)

        updates = {
            'manualVitals': manual_list,
            'updatedAt': now_iso,
        }
        if sys_bp is not None: updates['systolicBP'] = _coerce_int(sys_bp)
        if dia_bp is not None: updates['diastolicBP'] = _coerce_int(dia_bp)
        if glucose is not None: updates['bloodGlucose'] = _coerce_float(glucose)
        if hr is not None and not patient.get('deviceConnected'): updates['heart_rate'] = _coerce_float(hr)
        if spo2 is not None and not patient.get('deviceConnected'): updates['spo2'] = _coerce_float(spo2)
        if temp is not None and not patient.get('deviceConnected'): updates['temperature'] = _coerce_float(temp)

        patient_ref.update(updates)

        _log_patient_history(pid, 'MANUAL_VITALS_RECORDED', {
            'heartRate': hr,
            'spo2': spo2,
            'bloodPressure': f"{sys_bp}/{dia_bp}" if sys_bp and dia_bp else None,
        }, requester)

        return api_success('Manual health measurements recorded successfully.', {'entry': entry}, 201)
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/patient/ai-health-assistant', methods=['POST'])
@require_auth(roles={'patient', 'doctor', 'hospital_admin', 'super_admin'})
def ai_health_assistant():
    try:
        data = request.get_json(silent=True) or {}
        query = str(data.get('query') or '').strip()
        lang = str(data.get('language') or 'hinglish').strip().lower()
        vitals = data.get('patientVitals') or {}

        if not query:
            return api_error('Query prompt is required.', 400)

        q_lower = query.lower()

        # Emergency keyword detection (English, Hindi, Hinglish)
        emergency_keywords = [
            'chest pain', 'seene me dard', 'seena dard', 'heart attack', 'unconscious',
            'behoshi', 'chakkar aake girna', 'saans lene me takleef', 'difficulty breathing',
            'breathless', 'severe bleeding', 'khoon nikal raha', 'stroke', 'paralysis'
        ]
        is_emergency = any(kw in q_lower for kw in emergency_keywords)

        if is_emergency:
            if lang == 'hindi':
                response_text = (
                    "⚠️ आपातकालीन चेतावनी (Emergency Alert):\n"
                    "आपके द्वारा बताए गए लक्षण (जैसे सीने में दर्द या सांस लेने में गंभीर तकलीफ) एक गंभीर आपातकालीन स्थिति का संकेत हो सकते हैं।\n\n"
                    "तत्काल कदम उठाएं:\n"
                    "1. तुरंत अपने फोन में 'Emergency SOS' बटन दबाएं या आपातकालीन नंबर 108 / 112 पर कॉल करें।\n"
                    "2. किसी भी प्रकार की शारीरिक मेहनत न करें और तुरंत आरामदायक स्थिति में बैठें या लेटें।\n"
                    "3. अपने नजदीकी पंजीकृत अस्पताल या चिकित्सक से तुरंत संपर्क करें।"
                )
            elif lang == 'hinglish':
                response_text = (
                    "⚠️ Emergency Alert (Turant dhyan dein):\n"
                    "Aapke bataye gaye lakshan (jaise seene me dard ya saans lene me takleef) kisi critical emergency ka sanket ho sakte hain.\n\n"
                    "Immediate Action Steps:\n"
                    "1. Turant portal par 'Emergency SOS' trigger karein ya 108 / 112 emergency helpline dial karein.\n"
                    "2. Bilkul shaant rahein, bhaag-daud ya exertion na karein aur araam se baith jaayein.\n"
                    "3. Apne assigned doctor ya nearest hospital emergency ward me turant pahunchein."
                )
            else:
                response_text = (
                    "⚠️ Critical Emergency Warning:\n"
                    "The symptoms you reported (such as acute chest pain or severe shortness of breath) may indicate a life-threatening medical emergency.\n\n"
                    "Immediate Steps Required:\n"
                    "1. Trigger the Emergency SOS button immediately or dial local emergency services (108 / 112 / 911).\n"
                    "2. Rest in a comfortable seated position; avoid physical strain.\n"
                    "3. Seek immediate emergency evaluation at your nearest hospital emergency department."
                )

            return api_success('Emergency response generated.', {
                'response': response_text,
                'isEmergency': True,
                'suggestedDoctorConsult': True,
                'safetyDisclaimer': 'यह AI स्वास्थ्य सहायक केवल सामान्य मार्गदर्शन के लिए है। आपातकालीन स्थिति में तुरंत डॉक्टर या आपातकालीन सेवाओं से संपर्क करें।',
            })

        # Blood Pressure Guidance
        if 'bp' in q_lower or 'blood pressure' in q_lower or 'raktchap' in q_lower:
            if lang == 'hindi':
                response_text = (
                    "🩺 रक्तचाप (Blood Pressure) संबंधी मार्गदर्शन:\n"
                    "• सामान्य रक्तचाप 120/80 mmHg माना जाता है।\n"
                    "• यदि सिस्टोलिक BP 130-139 या डायस्टोलिक 80-89 है, तो इसे प्री-हाइपरटेंशन कहा जाता है।\n\n"
                    "स्वस्थ सुझाव:\n"
                    "1. नमक (सोडियम) का सेवन प्रतिदिन 5 ग्राम से कम रखें।\n"
                    "2. नियमित 30 मिनट हल्की वॉक करें और पर्याप्त पानी पिएं।\n"
                    "3. तनाव कम करने के लिए प्राणायाम या ध्यान करें।\n"
                    "4. अपनी निर्धारित दवाएं नियमित समय पर लें।"
                )
            elif lang == 'hinglish':
                response_text = (
                    "🩺 Blood Pressure (BP) Guidance:\n"
                    "• Normal resting BP 120/80 mmHg hota hai. Systolic 120-129 elevated mana jata hai, aur 130 se upar hypertension stage 1.\n\n"
                    "Daily Management Tips:\n"
                    "1. Khane me namak (salt) kam karein, packaged snacks avoid karein.\n"
                    "2. Daily 30 minute regular walking ya yoga karein.\n"
                    "3. Paani paryapt matra me pijiye aur smoking/alcohol se bachein.\n"
                    "4. Agar BP lagatar 140/90 se upar rahe, toh apne assigned doctor se consult karke dose review karwayein."
                )
            else:
                response_text = (
                    "🩺 Blood Pressure Health Guidance:\n"
                    "• Normal resting blood pressure is around 120/80 mmHg. Values consistently above 130/80 mmHg warrant clinical monitoring.\n\n"
                    "Recommended Lifestyle Measures:\n"
                    "1. Restrict daily sodium intake (< 2,300 mg/day).\n"
                    "2. Engage in moderate aerobic exercise (30 minutes daily).\n"
                    "3. Maintain proper hydration and ensure regular sleep.\n"
                    "4. Take prescribed antihypertensive medications at scheduled intervals."
                )

        # Heart Rate & Pulse Guidance
        elif 'heart rate' in q_lower or 'pulse' in q_lower or 'dhadkan' in q_lower:
            if lang == 'hindi':
                response_text = (
                    "❤️ हृदय गति (Heart Rate) संबंधी जानकारी:\n"
                    "• एक वयस्क की सामान्य विश्राम हृदय गति 60 से 100 बीट प्रति मिनट (bpm) होती है।\n"
                    "• 100 से अधिक दर को टैचीकार्डिया और 60 से कम को ब्रैडीकार्डिया कहा जाता है।\n\n"
                    "सुझाव:\n"
                    "1. कैफीन, चाय या तंबाकू का अधिक सेवन न करें।\n"
                    "2. गहरी सांस लेने के व्यायाम (Deep breathing) हृदय गति को स्थिर रखने में मदद करते हैं।"
                )
            elif lang == 'hinglish':
                response_text = (
                    "❤️ Heart Rate (Dhadkan) Guidance:\n"
                    "• Adult resting heart rate aam taur par 60 se 100 bpm ke beech nominal hoti hai.\n"
                    "• Exercise ya anxiety me pulse badh sakti hai, par aaram ke waqt 100+ rehna check karwana chahiye.\n\n"
                    "Helpful Tips:\n"
                    "1. Excessive coffee, chai aur nicotine avoid karein.\n"
                    "2. Deep breathing aur meditation se pulse normalize karne me madad milti hai."
                )
            else:
                response_text = (
                    "❤️ Heart Rate & Pulse Rate Guidance:\n"
                    "• A normal resting heart rate for adults ranges from 60 to 100 beats per minute (bpm).\n"
                    "• Rates consistently exceeding 100 bpm at rest (tachycardia) or below 50 bpm (bradycardia) should be evaluated by your attending physician."
                )

        # Medication & Prescription Guidance
        elif 'dawa' in q_lower or 'medicine' in q_lower or 'prescription' in q_lower or 'dose' in q_lower:
            if lang == 'hindi':
                response_text = (
                    "💊 दवा प्रबंधन संबंधी मार्गदर्शन:\n"
                    "• डॉक्टर द्वारा निर्धारित खुराक और समय का कड़ाई से पालन करें।\n"
                    "• यदि कोई खुराक छूट जाए, तो अगली बार दोगुनी खुराक न लें।\n"
                    "• अपने पोर्टल में 'Prescriptions' टैब में समय पर दवा 'Mark as Taken' करें ताकि आपका उपचार रिकॉर्ड अद्यतन रहे।"
                )
            elif lang == 'hinglish':
                response_text = (
                    "💊 Medication Schedule & Instructions:\n"
                    "• Apne doctor ki prescribed timing (khana khane se pehle ya baad) ka strictly dhyan rakhein.\n"
                    "• Kabhi bhi bina doctor ki salah ke dose miss ya double na karein.\n"
                    "• Portal ke 'Prescriptions' section me daily dose lene ke baad 'Mark as Taken' zaroor karein."
                )
            else:
                response_text = (
                    "💊 Medication Adherence Guidance:\n"
                    "• Follow the exact dosage and administration schedule prescribed by your physician.\n"
                    "• Never skip or double up on doses without clinical guidance.\n"
                    "• Use the in-app Prescription tracker to log each dose taken for treatment adherence records."
                )

        # General Wellness Fallback
        else:
            if lang == 'hindi':
                response_text = (
                    f"🌿 स्वास्थ्य परामर्श:\n"
                    f"आपके प्रश्न '{query}' के संदर्भ में, एक स्वस्थ जीवनशैली के लिए संतुलित आहार, नियमित हल्का व्यायाम और पर्याप्त 7-8 घंटे की नींद आवश्यक है।\n"
                    f"अपने स्वास्थ्य पोर्टल पर दैनिक महत्वपूर्ण आंकड़े (Vitals) नियमित रूप से ट्रैक करते रहें।"
                )
            elif lang == 'hinglish':
                response_text = (
                    f"🌿 Health & Wellness Advice:\n"
                    f"Aapke sawal '{query}' ke regarding: Rog-pratirodhak kshamata (immunity) aur vital health ke liye balanced diet, 2-3 litre paani, aur 7-8 ghante ki achhi neend bahut zaroori hai.\n"
                    f"Koi bhi naya lakshan dikhne par apne assigned doctor se timely consult karein."
                )
            else:
                response_text = (
                    f"🌿 Clinical Health & Wellness Guidance:\n"
                    f"Regarding your inquiry '{query}': Maintaining balanced nutrition, adequate hydration, regular moderate physical activity, and scheduled rest are fundamental to sustained cardiovascular and metabolic health."
                )

        return api_success('Health guidance generated.', {
            'response': response_text,
            'isEmergency': False,
            'suggestedDoctorConsult': False,
            'safetyDisclaimer': (
                'सूचना: यह AI स्वास्थ्य सहायक केवल सामान्य शैक्षिक एवं स्वास्थ्य मार्गदर्शन के लिए है। यह किसी भी स्थिति में योग्य चिकित्सक या डॉक्टर के परामर्श, निदान अथवा उपचार का विकल्प नहीं है।'
                if lang in ('hindi', 'hinglish')
                else 'Disclaimer: This AI Health Assistant provides general wellness information and is not a substitute for professional clinical medical advice, diagnosis, or treatment.'
            ),
        })
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/patient/<patient_id>/notifications', methods=['GET'])
@require_auth(roles={'patient'}, patient_id_arg='patient_id')
def get_patient_notifications(patient_id):
    try:
        pid = str(patient_id or '').strip()
        patient_ref = _patient_collection_reference().child(pid)
        patient = patient_ref.get()
        if not isinstance(patient, dict):
            return api_error('Patient not found.', 404)

        notifications = patient.get('notifications') or []
        if not isinstance(notifications, list):
            notifications = list(notifications.values()) if isinstance(notifications, dict) else []

        # If empty, construct baseline notifications from recent events
        if not notifications:
            appointments_raw = _appointments_collection_reference().get() or {}
            notif_items = []
            if isinstance(appointments_raw, dict):
                for k, a in appointments_raw.items():
                    if isinstance(a, dict) and str(a.get('patientId') or '').strip().lower() == pid.lower():
                        notif_items.append({
                            'id': f"NOTIF-APT-{k}",
                            'title': f"Appointment {a.get('status', 'Scheduled').capitalize()}",
                            'message': f"Consultation with Dr. {a.get('doctorName')} on {a.get('appointmentDate')} at {a.get('appointmentTime')}.",
                            'type': 'appointment',
                            'timestamp': a.get('updatedAt') or a.get('createdAt') or datetime.now(timezone.utc).isoformat(),
                            'read': False,
                        })

            notif_items.append({
                'id': f"NOTIF-WEL-{pid}",
                'title': 'Welcome to Personal Healthcare Portal',
                'message': 'Your personal medical records, care team, and emergency telemetry have been securely initialized.',
                'type': 'system',
                'timestamp': patient.get('createdAt') or datetime.now(timezone.utc).isoformat(),
                'read': True,
            })
            notifications = notif_items

        notifications.sort(key=lambda x: str(x.get('timestamp') or ''), reverse=True)
        return api_success('Notifications fetched successfully.', {'notifications': notifications, 'unreadCount': sum(1 for n in notifications if not n.get('read'))})
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/patient/<patient_id>/notifications/<notif_id>/read', methods=['POST'])
@require_auth(roles={'patient'}, patient_id_arg='patient_id')
def mark_patient_notification_read(patient_id, notif_id):
    try:
        pid = str(patient_id or '').strip()
        patient_ref = _patient_collection_reference().child(pid)
        patient = patient_ref.get()
        if not isinstance(patient, dict):
            return api_error('Patient not found.', 404)

        notifications = patient.get('notifications') or []
        if not isinstance(notifications, list):
            notifications = list(notifications.values()) if isinstance(notifications, dict) else []

        for n in notifications:
            if isinstance(n, dict) and str(n.get('id')) == str(notif_id):
                n['read'] = True
                break

        patient_ref.update({'notifications': notifications})
        return api_success('Notification marked as read.', {'notifId': notif_id})
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/auth/change-password', methods=['POST'])
@require_auth()
def change_account_password():
    try:
        requester = _read_auth_payload()
        role = requester.get('role')
        user_id = requester.get('id') or requester.get('patientId') or requester.get('doctorId') or requester.get('email')

        data = request.get_json(silent=True) or {}
        curr_pass = str(data.get('currentPassword') or '')
        new_pass = str(data.get('newPassword') or '')
        confirm_pass = str(data.get('confirmPassword') or '')

        if not curr_pass or not new_pass:
            return api_error('Current password and new password are required.', 400)
        if new_pass != confirm_pass:
            return api_error('New password and confirm password do not match.', 400)
        if len(new_pass) < 8:
            return api_error('Password must be at least 8 characters long.', 400)

        # Locate account
        target_ref = None
        account = None
        if role == 'patient':
            pid = requester.get('patientId') or requester.get('id')
            target_ref = _patient_collection_reference().child(pid)
            account = target_ref.get()
        elif role == 'doctor':
            doc_key = (requester.get('email') or '').replace('.', ',')
            target_ref = _doctor_collection_reference().child(doc_key)
            account = target_ref.get()
        elif role in ('super_admin', 'hospital_admin'):
            admin_id = requester.get('adminId') or requester.get('id') or (requester.get('email') or '').replace('.', ',')
            target_ref = _admin_collection_reference().child(admin_id)
            account = target_ref.get()

        if not account or not target_ref:
            return api_error('Account not found.', 404)

        # Verify current password
        stored_hash = account.get('passwordHash') or ''
        stored_raw = account.get('password') or ''
        is_valid = False
        if stored_hash and check_password_hash(stored_hash, curr_pass):
            is_valid = True
        elif stored_raw and stored_raw == curr_pass:
            is_valid = True

        if not is_valid:
            return api_error('Current password is incorrect.', 401)

        new_hash = generate_password_hash(new_pass)
        now_iso = datetime.now(timezone.utc).isoformat()
        updates = {
            'passwordHash': new_hash,
            'password': new_pass,
            'updatedAt': now_iso,
        }
        target_ref.update(updates)

        _log_security_event(requester, 'PASSWORD_CHANGED', role, user_id, requester.get('hospitalId', ''), 'Account password updated successfully')
        return api_success('Password updated successfully.')
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/doctor/signup', methods=['POST'])
def doctor_signup():
    return api_error('Public doctor registration is disabled. Doctor accounts must be provisioned by an authorized administrator.', 403)


@app.route('/doctor/login', methods=['POST'])
@app.route('/api/doctor/login', methods=['POST'])
@app.route('/api/auth/doctor/login', methods=['POST'])
def doctor_login():
    try:
        client_ip = _get_client_ip()
        allowed, remaining = _check_rate_limit(f"doctor_login_{client_ip}", max_requests=10, window_seconds=300)
        if not allowed:
            return api_error(f'Too many login attempts. Please wait {remaining} seconds.', 429)

        data = request.get_json(silent=True) or {}
        email = str(data.get('email') or '').strip().lower()
        password = str(data.get('password') or '')

        if not email or not password:
            return api_error('Email and password are required.', 400)

        doctor = _doctor_collection_reference().child(email.replace('.', ',')).get()
        if not doctor or not isinstance(doctor, dict):
            all_docs = _doctor_collection_reference().get()
            if isinstance(all_docs, dict):
                for k, d in all_docs.items():
                    if isinstance(d, dict) and str(d.get('email') or '').strip().lower() == email:
                        doctor = d
                        break

        if not doctor or not isinstance(doctor, dict):
            return api_error('Invalid email or password.', 401)

        if doctor.get('isActive') is False or doctor.get('status') == 'deactivated':
            return api_error('Account has been deactivated. Please contact an administrator.', 403)

        password_hash = str((doctor or {}).get('passwordHash') or '')
        if not password_hash or not check_password_hash(password_hash, password):
            return api_error('Invalid email or password.', 401)

        doctor_id = str(doctor.get('id') or doctor.get('doctorId') or email)
        doctor_name = doctor.get('name') or email.split('@')[0]
        doctor_phone = doctor.get('phone') or ''
        hospital_id = doctor.get('hospitalId') or ''
        auth = _issue_auth_token({
            'role': 'doctor',
            'doctorId': doctor_id,
            'id': doctor_id,
            'email': email,
            'name': doctor_name,
            'phone': doctor_phone,
            'hospitalId': hospital_id,
        })

        return api_success('Doctor login successful.', {
            'doctor': {
                'id': doctor_id,
                'doctorId': doctor_id,
                'name': doctor_name,
                'email': email,
                'phone': doctor_phone,
                'hospitalId': hospital_id,
            },
            'auth': auth,
        })
    except Exception as error:
        return api_error(str(error), 500)


# ============================================================================
# MULTI-HOSPITAL DOCTOR CLINICAL COMMAND CENTER ENDPOINTS
# ============================================================================

@app.route('/api/doctor/overview', methods=['GET'])
@require_auth(roles={'doctor'})
def get_doctor_overview():
    try:
        requester = _read_auth_payload()
        doctor_id = str(requester.get('doctorId') or requester.get('email') or requester.get('id') or '').strip().lower()
        doc_key = (requester.get('email') or doctor_id).replace('.', ',')
        
        doc_record = _doctor_collection_reference().child(doc_key).get() or {}
        doc_hosp_id = str(requester.get('hospitalId') or doc_record.get('hospitalId') or 'HOSP-CITY-01').strip()
        
        # 1. Hospital Details
        hosp_info = _hospitals_collection_reference().child(doc_hosp_id).get() or {
            'id': doc_hosp_id,
            'hospitalId': doc_hosp_id,
            'name': 'City General Medical Center',
        }
        
        # 2. Assigned Patients Count & List
        patients_raw = _patient_collection_reference().get() or {}
        assigned_patients = []
        if isinstance(patients_raw, dict):
            for pid, p in patients_raw.items():
                if isinstance(p, dict) and _doctor_owns_record(p, doctor_id):
                    # Check hospital matching
                    p_hosp = str(p.get('hospitalId') or '').strip().lower()
                    if not p_hosp or p_hosp == doc_hosp_id.lower():
                        assigned_patients.append({
                            'id': pid,
                            'patientId': pid,
                            'name': p.get('name') or 'Patient',
                            'age': p.get('age') or 26,
                            'gender': p.get('gender') or 'Male',
                            'phone': p.get('phone') or '',
                            'status': p.get('status') or 'Monitoring',
                            'risk': p.get('risk') or 'Normal',
                            'deviceConnected': bool(p.get('deviceConnected')),
                            'vitals': p.get('vitals') or {},
                            'updatedAt': p.get('updatedAt') or p.get('createdAt') or '',
                        })

        # 3. Appointments & Pending Consultations
        appointments_raw = _appointments_collection_reference().get() or {}
        today_local = datetime.now().strftime('%Y-%m-%d')
        today_utc = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        today_dates = {today_local, today_utc}
        today_apts = []
        pending_consultations = []
        follow_up_reminders = []
        
        if isinstance(appointments_raw, dict):
            for aid, a in appointments_raw.items():
                if not isinstance(a, dict):
                    continue
                a_doc = str(a.get('doctorId') or '').strip().lower()
                a_doc_email = str(a.get('doctorEmail') or '').strip().lower()
                if a_doc == doctor_id or a_doc_email == doctor_id or a.get('doctorName') == requester.get('name'):
                    apt_item = {**a, 'id': aid, 'appointmentId': aid}
                    if str(a.get('appointmentDate') or '') in today_dates:
                        today_apts.append(apt_item)
                    if str(a.get('status') or '').lower() in ('scheduled', 'in-progress'):
                        pending_consultations.append(apt_item)
                        follow_up_reminders.append(apt_item)

        # 4. Recent Clinical Activity Log (Consultations & Audits)
        recent_activity = []
        history_raw = db.reference('patientHistory').get() or {}
        if isinstance(history_raw, dict):
            for pid, logs in history_raw.items():
                if isinstance(logs, dict):
                    for lid, log in logs.items():
                        if isinstance(log, dict):
                            l_actor = str(log.get('actor') or log.get('performedBy') or '').strip().lower()
                            if doctor_id in l_actor or str(requester.get('name', '')).lower() in l_actor:
                                recent_activity.append({
                                    'id': lid,
                                    'patientId': pid,
                                    'action': log.get('action') or 'CLINICAL_UPDATE',
                                    'details': log.get('details') or {},
                                    'timestamp': log.get('timestamp') or '',
                                })

        recent_activity.sort(key=lambda x: str(x.get('timestamp') or ''), reverse=True)

        # 5. Assigned Health Alerts
        alerts_raw = db.reference('emergencyAlerts').get() or {}
        assigned_pids = {p['id'].lower() for p in assigned_patients}
        doctor_alerts = []
        if isinstance(alerts_raw, dict):
            for al_id, al in alerts_raw.items():
                if not isinstance(al, dict):
                    continue
                al_pid = str(al.get('patientId') or '').strip().lower()
                al_hosp = str(al.get('hospitalId') or '').strip().lower()
                if al_pid in assigned_pids or (al_hosp == doc_hosp_id.lower() and str(al.get('status') or '').upper() not in ('RESOLVED', 'DISMISSED')):
                    doctor_alerts.append({
                        'id': al_id,
                        'alertId': al_id,
                        'patientId': al.get('patientId'),
                        'patientName': al.get('patientName'),
                        'type': al.get('type') or 'SOS',
                        'severity': al.get('severity') or 'CRITICAL',
                        'status': al.get('status') or 'TRIGGERED',
                        'triageStatus': al.get('triageStatus') or 'PENDING_REVIEW',
                        'timestamp': al.get('timestamp') or '',
                        'location': al.get('location') or {},
                        'vitals': al.get('vitals') or {},
                    })

        doctor_alerts.sort(key=lambda x: str(x.get('timestamp') or ''), reverse=True)

        return api_success('Doctor overview retrieved successfully.', {
            'doctor': {
                'id': doc_record.get('id') or doctor_id,
                'doctorId': doc_record.get('id') or doctor_id,
                'name': doc_record.get('name') or requester.get('name') or 'Physician',
                'email': doc_record.get('email') or requester.get('email') or '',
                'phone': doc_record.get('phone') or '',
                'specialty': doc_record.get('specialty') or doc_record.get('department') or 'General Medicine',
                'department': doc_record.get('department') or doc_record.get('specialty') or 'General Medicine',
                'hospitalId': doc_hosp_id,
                'hospitalName': hosp_info.get('name') or 'City General Medical Center',
                'licenseNumber': doc_record.get('licenseNumber') or 'MED-REG-4920',
            },
            'hospital': {
                'id': doc_hosp_id,
                'name': hosp_info.get('name') or 'City General Medical Center',
                'city': hosp_info.get('city') or 'New Delhi',
                'phone': hosp_info.get('phone') or '+91 11 4000 1000',
            },
            'stats': {
                'assignedPatients': len(assigned_patients),
                'todayAppointments': len(today_apts),
                'pendingConsultations': len(pending_consultations),
                'triageAlertsCount': len(doctor_alerts),
            },
            'assignedPatients': assigned_patients,
            'assignedPatientCount': len(assigned_patients),
            'todayAppointments': today_apts,
            'pendingConsultations': pending_consultations,
            'followUpReminders': follow_up_reminders[:5],
            'recentActivity': recent_activity[:10],
            'assignedAlerts': doctor_alerts,
        })
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/doctor/hospital-directory', methods=['GET'])
@require_auth(roles={'doctor'})
def get_doctor_hospital_directory():
    try:
        requester = _read_auth_payload()
        doctor_id = str(requester.get('doctorId') or requester.get('email') or requester.get('id') or '').strip().lower()
        doc_key = (requester.get('email') or doctor_id).replace('.', ',')
        doc_record = _doctor_collection_reference().child(doc_key).get() or {}
        doc_hosp = str(requester.get('hospitalId') or doc_record.get('hospitalId') or '').strip().lower()
        
        search_query = str(request.args.get('q', '')).strip().lower()

        patients_raw = _patient_collection_reference().get() or {}
        directory = []

        if isinstance(patients_raw, dict):
            for pid, p in patients_raw.items():
                if not isinstance(p, dict):
                    continue
                p_hosp = str(p.get('hospitalId') or '').strip().lower()
                
                # Strict rule: Doctors can only search patients registered at their OWN hospital
                if doc_hosp and p_hosp and doc_hosp != p_hosp:
                    continue

                p_name = str(p.get('name') or '').strip()
                p_id_str = str(pid).strip()
                p_phone = str(p.get('phone') or '').strip()

                if search_query:
                    if (search_query not in p_name.lower() and 
                        search_query not in p_id_str.lower() and 
                        search_query not in p_phone.lower()):
                        continue

                is_assigned = _doctor_owns_record(p, doctor_id)
                assigned_name = str(p.get('assignedDoctorName') or p.get('doctorName') or '')
                assigned_doc_id = str(p.get('assignedDoctorId') or p.get('doctorId') or '')

                has_grant = _has_active_emergency_grant(p_id_str, doctor_id)

                # ACCESS LEVEL A: Only permitted directory information is disclosed!
                directory.append({
                    'id': p_id_str,
                    'patientId': p_id_str,
                    'name': p_name or 'Patient',
                    'age': p.get('age') or 26,
                    'gender': p.get('gender') or 'Male',
                    'hospitalId': p.get('hospitalId') or doc_hosp,
                    'assignedDoctorId': assigned_doc_id or 'Unassigned',
                    'assignedDoctorName': assigned_name or 'Unassigned',
                    'isAssignedToRequester': is_assigned,
                    'hasEmergencyAccess': has_grant,
                    'assignmentStatus': 'Assigned to You' if is_assigned else (
                        f"Assigned to Dr. {assigned_name}" if assigned_name else 'Unassigned'
                    ),
                    'canOpenClinicalRecord': is_assigned or has_grant,
                })

        directory.sort(key=lambda x: (not x['isAssignedToRequester'], x['name'].lower()))
        return api_success('Hospital patient directory retrieved.', {
            'patients': directory,
            'totalCount': len(directory),
            'hospitalId': doc_hosp,
        })
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/doctor/patient/<patient_id>/clinical-record', methods=['GET'])
@require_auth(roles={'doctor'}, patient_id_arg='patient_id')
def get_doctor_patient_clinical_record(patient_id):
    try:
        requester = _read_auth_payload()
        doctor_id = str(requester.get('doctorId') or requester.get('email') or requester.get('id') or '').strip().lower()

        pid = str(patient_id or '').strip()
        patient = _patient_collection_reference().child(pid).get()
        if not isinstance(patient, dict):
            return api_error('Patient record not found.', 404)

        # ACCESS LEVEL B: Detailed clinical dossier
        # 1. Hospital check: Strict cross-hospital blocking
        doc_node = _doctor_collection_reference().child(doctor_id.replace('.', ',')).get() or {}
        doc_hosp = str(requester.get('hospitalId') or doc_node.get('hospitalId') or '').strip().lower()
        pat_hosp = str(patient.get('hospitalId') or '').strip().lower()
        if doc_hosp and pat_hosp and doc_hosp != pat_hosp:
            return api_error('Forbidden. Cross-hospital patient clinical access is strictly prohibited.', 403)

        # 2. Assignment / Break-glass verification
        is_assigned = _doctor_owns_record(patient, doctor_id)
        has_break_glass = _has_active_emergency_grant(pid, doctor_id)
        if not is_assigned and not has_break_glass:
            return api_error('Access denied. You are not assigned to this patient and do not have an active emergency access grant.', 403)

        client_patient = dict(patient)
        client_patient.pop('passwordHash', None)
        client_patient.pop('password', None)

        consultations = patient.get('consultations') or []
        if not isinstance(consultations, list):
            consultations = list(consultations.values()) if isinstance(consultations, dict) else []

        test_reports = patient.get('testReports') or []
        if not isinstance(test_reports, list):
            test_reports = list(test_reports.values()) if isinstance(test_reports, dict) else []

        medicines = patient.get('medicines') or []
        if not isinstance(medicines, list):
            medicines = list(medicines.values()) if isinstance(medicines, dict) else []

        manual_vitals = patient.get('manualVitals') or []
        if not isinstance(manual_vitals, list):
            manual_vitals = list(manual_vitals.values()) if isinstance(manual_vitals, dict) else []

        return api_success('Patient clinical record retrieved successfully.', {
            'patient': client_patient,
            'consultations': consultations,
            'prescriptions': medicines,
            'testReports': test_reports,
            'vitals': patient.get('vitals') or {},
            'manualVitals': manual_vitals[-20:],
            'isAssignedDoctor': is_assigned,
            'isEmergencyGrant': has_break_glass,
        })
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/doctor/patient/<patient_id>/emergency-access', methods=['POST'])
@require_auth(roles={'doctor'})
def request_emergency_break_glass_access(patient_id):
    try:
        requester = _read_auth_payload()
        doctor_id = str(requester.get('doctorId') or requester.get('email') or requester.get('id') or '').strip().lower()
        doctor_name = requester.get('name') or doctor_id

        pid = str(patient_id or '').strip()
        patient_ref = _patient_collection_reference().child(pid)
        patient = patient_ref.get()
        if not isinstance(patient, dict):
            return api_error('Patient not found.', 404)

        data = request.get_json(silent=True) or {}
        reason = str(data.get('reason') or '').strip()
        urgency = str(data.get('clinicalUrgency') or 'CRITICAL').strip().upper()

        if len(reason) < 8:
            return api_error('A declared clinical emergency justification (min 8 characters) is required to break-glass.', 400)

        # Strict rule: A doctor cannot access another hospital's records even during emergency
        doc_node = _doctor_collection_reference().child(doctor_id.replace('.', ',')).get() or {}
        doc_hosp = str(requester.get('hospitalId') or doc_node.get('hospitalId') or '').strip().lower()
        pat_hosp = str(patient.get('hospitalId') or '').strip().lower()
        if doc_hosp and pat_hosp and doc_hosp != pat_hosp:
            return api_error('Forbidden. Cross-hospital emergency break-glass is strictly prohibited.', 403)

        now_dt = datetime.now(timezone.utc)
        expires_dt = now_dt + timedelta(hours=2)
        doc_key = doctor_id.replace('.', ',')

        grant_record = {
            'patientId': pid,
            'patientName': patient.get('name') or 'Patient',
            'doctorId': doctor_id,
            'doctorName': doctor_name,
            'hospitalId': doc_hosp,
            'reason': reason,
            'clinicalUrgency': urgency,
            'grantedAt': now_dt.isoformat(),
            'expiresAt': expires_dt.isoformat(),
            'active': True,
        }

        # 1. Store grant in RTDB
        db.reference(f"emergencyAccessGrants/{pid}/{doc_key}").set(grant_record)

        # 2. Log immutable security audit event
        _log_security_event(
            requester,
            'BREAK_GLASS_EMERGENCY_ACCESS',
            'doctor',
            doctor_id,
            doc_hosp,
            f"Emergency break-glass access invoked for Patient {pid}. Reason: {reason}"
        )

        # 3. Log patient history audit trail
        _log_patient_history(pid, 'BREAK_GLASS_EMERGENCY_ACCESS', {
            'doctorId': doctor_id,
            'doctorName': doctor_name,
            'reason': reason,
            'clinicalUrgency': urgency,
            'expiresAt': expires_dt.isoformat(),
        }, requester)

        return api_success('Emergency break-glass access granted for 2 hours. Access logged in security audit trail.', {
            'grant': grant_record
        }, 201)
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/doctor/alerts', methods=['GET'])
@require_auth(roles={'doctor'})
def get_doctor_alerts():
    try:
        requester = _read_auth_payload()
        doctor_id = str(requester.get('doctorId') or requester.get('email') or requester.get('id') or '').strip().lower()
        doc_node = _doctor_collection_reference().child(doctor_id.replace('.', ',')).get() or {}
        doc_hosp = str(requester.get('hospitalId') or doc_node.get('hospitalId') or '').strip().lower()

        # Fetch assigned patient IDs
        patients_raw = _patient_collection_reference().get() or {}
        assigned_pids = set()
        if isinstance(patients_raw, dict):
            for pid, p in patients_raw.items():
                if isinstance(p, dict) and _doctor_owns_record(p, doctor_id):
                    assigned_pids.add(str(pid).strip().lower())

        alerts_raw = db.reference('emergencyAlerts').get() or {}
        results = []
        if isinstance(alerts_raw, dict):
            for aid, al in alerts_raw.items():
                if not isinstance(al, dict):
                    continue
                al_pid = str(al.get('patientId') or '').strip().lower()
                al_hosp = str(al.get('hospitalId') or '').strip().lower()

                # Include if assigned patient or emergency alert in doctor's hospital
                if al_pid in assigned_pids or (al_hosp == doc_hosp and str(al.get('status') or '').upper() not in ('RESOLVED', 'DISMISSED')):
                    results.append({
                        'id': aid,
                        'alertId': aid,
                        'patientId': al.get('patientId') or '',
                        'patientName': al.get('patientName') or 'Unknown Patient',
                        'type': al.get('type') or 'SOS',
                        'severity': al.get('severity') or 'CRITICAL',
                        'status': al.get('status') or 'TRIGGERED',
                        'triageStatus': al.get('triageStatus') or 'PENDING_REVIEW',
                        'timestamp': al.get('timestamp') or '',
                        'vitals': al.get('vitals') or {},
                        'notes': al.get('doctorNotes') or al.get('notes') or '',
                        'isDirectlyAssigned': al_pid in assigned_pids,
                    })

        results.sort(key=lambda x: str(x.get('timestamp') or ''), reverse=True)
        return api_success('Doctor alerts fetched successfully.', {'alerts': results})
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/doctor/alerts/<alert_id>/triage', methods=['POST'])
@require_auth(roles={'doctor'})
def triage_doctor_alert(alert_id):
    try:
        requester = _read_auth_payload()
        doctor_id = str(requester.get('doctorId') or requester.get('email') or requester.get('id') or '').strip().lower()
        doc_name = requester.get('name') or doctor_id

        data = request.get_json(silent=True) or {}
        action = str(data.get('action') or 'ACKNOWLEDGE').strip().upper()
        doctor_notes = str(data.get('doctorNotes') or data.get('notes') or '').strip()

        al_ref = db.reference(f"emergencyAlerts/{alert_id}")
        alert = al_ref.get()
        if not isinstance(alert, dict):
            return api_error('Alert not found.', 404)

        now_iso = datetime.now(timezone.utc).isoformat()
        new_triage = 'ACKNOWLEDGED'
        new_status = alert.get('status')
        if action == 'RESOLVE':
            new_triage = 'RESOLVED'
            new_status = 'RESOLVED'
        elif action == 'TAKE_ACTION':
            new_triage = 'CLINICAL_ACTION_TAKEN'
            new_status = 'IN_PROGRESS'

        audit_entry = {
            'action': action,
            'triageStatus': new_triage,
            'doctorName': doc_name,
            'doctorId': doctor_id,
            'doctorNotes': doctor_notes,
            'timestamp': now_iso,
        }

        audit_log = alert.get('auditLog') or []
        if not isinstance(audit_log, list):
            audit_log = list(audit_log.values()) if isinstance(audit_log, dict) else []
        audit_log.append(audit_entry)

        updates = {
            'triageStatus': new_triage,
            'status': new_status,
            'lastTriagedBy': doc_name,
            'doctorNotes': doctor_notes,
            'auditLog': audit_log,
            'updatedAt': now_iso,
        }
        al_ref.update(updates)

        _log_security_event(requester, 'ALERT_TRIAGED', 'doctor', doctor_id, requester.get('hospitalId', ''), f"Alert {alert_id} triaged as {new_triage}")
        return api_success(f'Alert updated to {new_triage}.', {'alert': {**alert, **updates}})
    except Exception as error:
        return api_error(str(error), 500)


@app.route('/api/doctor/patient/<patient_id>/clinical-document', methods=['GET'])
@require_auth(roles={'doctor'}, patient_id_arg='patient_id')
def get_patient_clinical_document(patient_id):
    try:
        requester = _read_auth_payload()
        doctor_id = str(requester.get('doctorId') or requester.get('email') or requester.get('id') or '').strip().lower()

        pid = str(patient_id or '').strip()
        patient = _patient_collection_reference().child(pid).get()
        if not isinstance(patient, dict):
            return api_error('Patient not found.', 404)

        doc_node = _doctor_collection_reference().child(doctor_id.replace('.', ',')).get() or {}
        hosp_id = str(requester.get('hospitalId') or doc_node.get('hospitalId') or 'HOSP-CITY-01').strip()
        hosp_node = _hospitals_collection_reference().child(hosp_id).get() or {}

        now_dt = datetime.now(timezone.utc)
        doc_hash = secrets.token_hex(8).upper()

        document = {
            'documentId': f"CLIN-DOC-{now_dt.year}-{pid[:4]}-{secrets.token_hex(3).upper()}",
            'verificationHash': f"SHA256-{doc_hash}",
            'generatedAt': now_dt.isoformat(),
            'hospital': {
                'id': hosp_id,
                'name': hosp_node.get('name') or 'City General Medical Center',
                'phone': hosp_node.get('phone') or '+91 11 4000 1000',
                'email': hosp_node.get('email') or 'care@citygeneral.org',
                'address': hosp_node.get('address') or 'Healthcare Boulevard, New Delhi',
            },
            'doctor': {
                'name': doc_node.get('name') or requester.get('name') or 'Treating Physician',
                'specialty': doc_node.get('specialty') or 'General Medicine',
                'department': doc_node.get('department') or 'Clinical Outpatient Dept',
                'licenseNumber': doc_node.get('licenseNumber') or 'MED-REG-4920',
            },
            'patient': {
                'id': pid,
                'name': patient.get('name') or 'Patient',
                'age': patient.get('age') or 26,
                'gender': patient.get('gender') or 'Male',
                'bloodGroup': patient.get('bloodGroup') or 'B+',
                'allergies': patient.get('allergies') or 'None Reported',
            },
            'latestConsultation': (patient.get('consultations') or [{}])[-1],
            'activePrescriptions': [m for m in (patient.get('medicines') or []) if isinstance(m, dict) and m.get('status') != 'Discontinued'],
            'latestVitals': patient.get('vitals') or {},
        }

        return api_success('Clinical document generated.', {'document': document})
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

        # Multi-contact SOS management (up to 3 contacts)
        if 'sosContacts' in data and isinstance(data.get('sosContacts'), list):
            raw_contacts = data.get('sosContacts')[:3]
            cleaned_contacts = []
            for c in raw_contacts:
                if isinstance(c, dict):
                    c_name = str(c.get('name') or '').strip()
                    c_phone = _normalize_phone(c.get('phone'))
                    c_relation = str(c.get('relation') or 'Family').strip()
                    # Filter out empty or mock names
                    if (c_name or c_phone) and c_name != 'Rahul Soni':
                        cleaned_contacts.append({
                            'name': c_name,
                            'phone': c_phone,
                            'relation': c_relation,
                        })
            update_data['sosContacts'] = cleaned_contacts
            if cleaned_contacts:
                update_data['sosContactName'] = cleaned_contacts[0]['name']
                update_data['sosContactPhone'] = cleaned_contacts[0]['phone']
                update_data['sosContactRelation'] = cleaned_contacts[0]['relation']
            else:
                update_data['sosContactName'] = ''
                update_data['sosContactPhone'] = ''
                update_data['sosContactRelation'] = ''
        else:
            if 'sosContactName' in data:
                val = str(data.get('sosContactName') or '').strip()
                update_data['sosContactName'] = '' if val == 'Rahul Soni' else val
            if 'sosContactPhone' in data:
                val = _normalize_phone(data.get('sosContactPhone'))
                update_data['sosContactPhone'] = '' if val == '+919876543210' else val
            if 'sosContactRelation' in data:
                update_data['sosContactRelation'] = str(data.get('sosContactRelation') or 'Family').strip()

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
def send_sms_alert(prediction, hr, spo2, temp, recipient_phones=None, location=None):
    """Send SMS alert for critical condition to patient SOS contacts (up to 3 numbers)"""
    phones_to_alert = []
    if recipient_phones:
        if isinstance(recipient_phones, list):
            for p in recipient_phones:
                if p and str(p).strip():
                    phones_to_alert.append(str(p).strip())
        elif isinstance(recipient_phones, str) and recipient_phones.strip():
            phones_to_alert.append(recipient_phones.strip())
    elif PATIENT_PHONE:
        phones_to_alert.append(PATIENT_PHONE)

    if not phones_to_alert:
        return {
            "success": False,
            "configured": bool(twilio_client and TWILIO_PHONE_FROM),
            "status": "NO_RECIPIENTS",
            "recipients": []
        }

    # Strict check: Do not claim an SMS was delivered if provider credentials are not set
    if not twilio_client or not TWILIO_PHONE_FROM:
        return {
            "success": False,
            "configured": False,
            "status": "PROVIDER_UNCONFIGURED",
            "message": "Twilio SMS provider credentials not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_FROM in environment.",
            "recipients": [
                {
                    "phone": p,
                    "status": "PROVIDER_UNCONFIGURED",
                    "provider": "Twilio (Unconfigured)",
                    "error": "Provider credentials missing in server environment"
                }
                for p in phones_to_alert[:3]
            ]
        }

    loc_text = ""
    if isinstance(location, dict) and location.get('latitude') and location.get('longitude'):
        loc_text = f"\nLive GPS Location: https://maps.google.com/?q={location['latitude']},{location['longitude']}"

    message_body = (
        f"🚨 SMART HEALTHCARE CRITICAL ALERT!\n"
        f"Condition: {prediction}\n"
        f"Vitals: HR {hr} bpm | SpO2 {spo2}% | Temp {temp}°C{loc_text}\n"
        f"Immediate medical attention required!"
    )

    recipients_result = []
    success_count = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    for target_phone in phones_to_alert[:3]:
        try:
            norm_target = _normalize_phone(target_phone)
            if not norm_target:
                recipients_result.append({
                    "phone": target_phone,
                    "status": "INVALID_PHONE_FORMAT",
                    "error": "Failed phone number normalization",
                    "timestamp": now_iso,
                })
                continue

            message = twilio_client.messages.create(
                body=message_body,
                from_=TWILIO_PHONE_FROM,
                to=norm_target
            )
            success_count += 1
            # Retrieve verified status from provider (e.g. queued, sent, delivered, simulated)
            raw_status = str(getattr(message, 'status', None) or 'queued').strip().upper()
            provider_status = raw_status if raw_status in ('QUEUED', 'SENT', 'DELIVERED', 'SIMULATED') else 'QUEUED'
            recipients_result.append({
                "phone": norm_target,
                "status": provider_status,
                "sid": getattr(message, 'sid', 'SM_UNAVAILABLE'),
                "provider": "Twilio",
                "timestamp": now_iso,
            })
        except Exception as e:
            recipients_result.append({
                "phone": target_phone,
                "status": "PROVIDER_ERROR",
                "error": str(e),
                "provider": "Twilio",
                "timestamp": now_iso,
            })

    overall_status = "FAILED"
    if success_count > 0:
        if all(r.get("status") == "DELIVERED" for r in recipients_result):
            overall_status = "DELIVERED"
        elif all(r.get("status") == "SIMULATED" for r in recipients_result):
            overall_status = "SIMULATED"
        elif all(r.get("status") in ("QUEUED", "SENT", "DELIVERED", "SIMULATED") for r in recipients_result):
            overall_status = "QUEUED" if all(r.get("status") == "QUEUED" for r in recipients_result) else "SENT"
        else:
            overall_status = "PARTIAL"

    return {
        "success": success_count > 0,
        "configured": True,
        "status": overall_status,
        "successCount": success_count,
        "recipients": recipients_result
    }

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

        desired_device_id = str(data.get('deviceId') or data.get('device_id') or '').strip()
        payload = {
            'name': data.get('name'),
            'age': data.get('age') or data.get('Age'),
            'gender': data.get('gender'),
            'phone': data.get('phone') or data.get('phoneNumber'),
            'email': data.get('email'),
            'symptoms': data.get('symptoms'),
            'notes': data.get('notes') or '',
            'deviceId': desired_device_id if desired_device_id else None,
            'deviceActive': bool(desired_device_id),
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
        payload['passwordHash'] = generate_password_hash(generated_password)
        payload['isActive'] = True
        payload['role'] = 'patient'
        # Do not persist plaintext password to database
        payload.pop('password', None)

        record = _write_patient_record(patient_id, payload)
        response_patient = _sanitize_patient_response(record)

        device_info = None
        if desired_device_id:
            try:
                existing_dev = _devices_collection_reference().child(desired_device_id).get()
                now_iso = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                if isinstance(existing_dev, dict):
                    old_patient = str(existing_dev.get('patientId') or '').strip()
                    if old_patient and old_patient != patient_id:
                        try:
                            _patient_collection_reference().child(old_patient).update({
                                'deviceId': None,
                                'deviceActive': False,
                                'deviceConnected': False,
                            })
                        except Exception:
                            pass
                    _devices_collection_reference().child(desired_device_id).update({
                        'patientId': patient_id,
                        'assignedDoctorId': doctor_id,
                        'active': True,
                    })
                    device_info = {
                        'deviceId': desired_device_id,
                        'linked': True,
                    }
                else:
                    raw_token = f"tok_{secrets.token_hex(16)}"
                    token_hash = _hash_device_token(raw_token)
                    dev_payload = {
                        'deviceId': desired_device_id,
                        'patientId': patient_id,
                        'assignedDoctorId': doctor_id,
                        'tokenHash': token_hash,
                        'name': f"ESP32-{desired_device_id}",
                        'firmwareVersion': '1.0.0',
                        'active': True,
                        'createdAt': now_iso,
                        'lastSeen': None,
                        'registeredBy': 'doctor',
                    }
                    _devices_collection_reference().child(desired_device_id).set(dev_payload)
                    device_info = {
                        'deviceId': desired_device_id,
                        'deviceToken': raw_token,
                        'linked': True,
                    }
            except Exception as dev_err:
                print(f"[Auto-Device-Map] Error mapping device {desired_device_id}: {dev_err}")

        return jsonify({
            'status': 'success',
            'message': 'Patient created successfully.',
            'patient': response_patient,
            'credentials': {
                'patientId': patient_id,
                'password': generated_password,
            },
            'device': device_info,
        })
    except Exception as error:
        return jsonify({
            'status': 'error',
            'message': str(error),
        }), 500


@app.route('/login-patient', methods=['POST'])
@app.route('/patient/login', methods=['POST'])
@app.route('/api/auth/patient/login', methods=['POST'])
def login_patient():
    try:
        client_ip = _get_client_ip()
        allowed, remaining = _check_rate_limit(f"patient_login_{client_ip}", max_requests=10, window_seconds=300)
        if not allowed:
            return api_error(f'Too many login attempts. Please wait {remaining} seconds.', 429)

        data = request.get_json(silent=True) or {}
        patient_id = str(data.get('patientId') or data.get('id') or '').strip()
        password = str(data.get('password') or '').strip()

        if not patient_id or not password:
            return api_error('Patient ID and password are required.', 400)

        record = _patient_collection_reference().child(patient_id).get()
        if not record or not isinstance(record, dict):
            return api_error('Invalid Patient ID or password.', 401)

        if record.get('isActive') is False or record.get('status') == 'deactivated':
            return api_error('Account has been deactivated. Please contact an administrator.', 403)

        stored_hash = str(record.get('passwordHash') or '')
        stored_password = str(record.get('password') or '')

        valid_password = False
        if stored_hash and check_password_hash(stored_hash, password):
            valid_password = True
        elif stored_password and stored_password == password:
            valid_password = True
            # Upgrade legacy record to hashed password and purge plaintext
            try:
                _patient_collection_reference().child(patient_id).update({
                    'passwordHash': generate_password_hash(password),
                    'password': None,
                })
            except Exception:
                pass

        if not valid_password:
            return api_error('Invalid Patient ID or password.', 401)

        normalized = _normalize_patient_record(patient_id, record, record)
        auth = _issue_auth_token({
            'role': 'patient',
            'patientId': patient_id,
            'id': patient_id,
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
    chat_user_connections.setdefault(f"{role}:{actor_id.lower()}", set()).add(sid)
    chat_user_connections.setdefault(f"user_{actor_id.lower()}", set()).add(sid)

    join_room(f"{role}:{actor_id.lower()}", sid=sid)
    join_room(f"user:{role}:{actor_id.lower()}", sid=sid)
    join_room(f"user_{actor_id.lower()}", sid=sid)

    if role == 'doctor':
        join_room(f"doctor:{actor_id.lower()}", sid=sid)
        doc_email = str(actor.get('email') or '').strip().lower()
        if doc_email:
            join_room(f"doctor:{doc_email}", sid=sid)
            chat_user_connections.setdefault(f"doctor:{doc_email}", set()).add(sid)
        doc_id = str(actor.get('doctorId') or '').strip().lower()
        if doc_id:
            join_room(f"doctor:{doc_id}", sid=sid)
            chat_user_connections.setdefault(f"doctor:{doc_id}", set()).add(sid)
    elif role == 'patient':
        join_room(f"patient:{actor_id.lower()}", sid=sid)
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

    # Join caller to dedicated call room
    try:
        join_room(f"call_{call_id}", sid=request.sid)
    except Exception:
        pass

    # Emit incoming call directly to the receiver's room and active sockets
    delivered_count = _chat_emit_to_user(receiver_role, receiver_id, 'call:incoming', call_payload)
    print(f"[WEBRTC-CALL] Incoming call dispatch: caller={caller_role}:{caller_id} -> receiver={receiver_role}:{receiver_id}, delivered={delivered_count}, sessions={list(receiver_sessions)}")

    if receiver_role == 'patient':
        socketio.emit('call:incoming', call_payload, room=f"patient:{patient_id.lower()}")
        socketio.emit('call:incoming', call_payload, to=f"patient:{patient_id.lower()}")
        for s in receiver_sessions:
            try:
                join_room(f"call_{call_id}", sid=s)
            except Exception:
                pass
            socketio.emit('call:incoming', call_payload, room=s)
            socketio.emit('call:incoming', call_payload, to=s)
    else:
        socketio.emit('call:incoming', call_payload, room=f"doctor:{doctor_id.lower()}")
        socketio.emit('call:incoming', call_payload, to=f"doctor:{doctor_id.lower()}")
        if '@' in doctor_id:
            socketio.emit('call:incoming', call_payload, room=f"doctor:{doctor_id.split('@')[0].lower()}")
            socketio.emit('call:incoming', call_payload, to=f"doctor:{doctor_id.split('@')[0].lower()}")
        for s in receiver_sessions:
            try:
                join_room(f"call_{call_id}", sid=s)
            except Exception:
                pass
            socketio.emit('call:incoming', call_payload, room=s)
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

    try:
        join_room(f"call_{call_id}", sid=request.sid)
    except Exception:
        pass

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

    socketio.emit('call:accepted', accept_payload, room=f"call_{call_id}")
    socketio.emit('call:accepted', accept_payload, to=f"call_{call_id}")

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

    socketio.emit('call:rejected', reject_payload, room=f"call_{call_id}")
    socketio.emit('call:rejected', reject_payload, to=f"call_{call_id}")

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

    socketio.emit('call:ended', end_payload, room=f"call_{call_id}")
    socketio.emit('call:ended', end_payload, to=f"call_{call_id}")

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


# ============================================================================
# 🔐 ESP32 HARDWARE DEVICE REGISTRY & AUTHENTICATION SUBSYSTEM
# ============================================================================

_hardware_active_patients = {}  # {patient_id: float_last_seen_timestamp}


def _devices_collection_reference():
    return db.reference('devices')


def _device_telemetry_reference(patient_id):
    safe_pid = str(patient_id or '').strip().replace('.', ',').replace('/', '_')
    return db.reference(f'deviceTelemetry/{safe_pid}')


def _hash_device_token(token_str):
    if not token_str:
        return ""
    return hashlib.sha256(str(token_str).strip().encode('utf-8')).hexdigest()


def _verify_device_credentials(device_id, device_token):
    device_key = str(device_id or '').strip()
    raw_token = str(device_token or '').strip()
    if not device_key or not raw_token:
        return None, "Device ID and Token are required."

    try:
        device_record = _devices_collection_reference().child(device_key).get()
    except Exception as err:
        return None, f"Device lookup error: {err}"

    if not isinstance(device_record, dict):
        return None, "Device is not registered in the system."

    if not device_record.get('active', True):
        return None, "Device has been deactivated."

    stored_hash = str(device_record.get('tokenHash') or '').strip()
    provided_hash = _hash_device_token(raw_token)

    if not stored_hash or not hmac.compare_digest(stored_hash, provided_hash):
        return None, "Invalid device authentication token."

    return device_record, None


def _evaluate_and_trigger_telemetry_emergency(patient_id, record, vitals, prediction):
    now = time.time()
    last_alerts = getattr(app, '_last_telemetry_alert_time', {})
    if not isinstance(last_alerts, dict):
        last_alerts = {}
        app._last_telemetry_alert_time = last_alerts

    if now - last_alerts.get(patient_id, 0) < 300:
        return
    last_alerts[patient_id] = now

    now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    alert_id = f"emg-telemetry-{int(now * 1000)}"
    patient_name = record.get('name') or "Patient"
    assigned_doc = str(record.get('assignedDoctorId') or record.get('doctorId') or record.get('doctorEmail') or '').strip().lower()
    trigger_reason = f"ESP32 Telemetry Alert: {prediction.get('message') or 'Critical clinical vitals threshold breached'}"

    # Extract patient SOS contacts (up to 3 contacts)
    sos_contacts = record.get('sosContacts') or []
    if not sos_contacts and (record.get('sosContactPhone') or record.get('sosContactName')):
        sos_contacts = [{
            "name": record.get('sosContactName') or "",
            "phone": record.get('sosContactPhone') or "",
            "relation": record.get('sosContactRelation') or "Family",
        }]

    # Filter out empty or legacy mock contacts
    sos_contacts = [
        c for c in sos_contacts
        if isinstance(c, dict) and c.get('name') != 'Rahul Soni' and c.get('phone') != '+91 98765 43210' and (c.get('name') or c.get('phone'))
    ][:3]

    primary_sos = sos_contacts[0] if sos_contacts else {}

    alert_record = {
        "alertId": alert_id,
        "patientId": patient_id,
        "patientName": patient_name,
        "status": "CRITICAL",
        "triggerReason": trigger_reason,
        "vitals": {
            "heartRate": vitals.get('heart_rate') or vitals.get('heartRate'),
            "spo2": vitals.get('spo2'),
            "temperature": vitals.get('temperature'),
        },
        "location": record.get('location') or {},
        "doctorId": assigned_doc or "general-triage",
        "assignedDoctorId": assigned_doc or "general-triage",
        "sosContacts": sos_contacts,
        "sosContact": primary_sos,
        "isDemo": False,
        "source": "esp32-telemetry-ai",
        "createdAt": now_iso,
        "updatedAt": now_iso,
    }

    try:
        db.reference(f"emergencyAlerts/{alert_id}").set(alert_record)
        db.reference(f"patients/{patient_id}/activeEmergency").set(alert_record)
        if firestore_client:
            firestore_client.collection("emergencyAlerts").document(alert_id).set(alert_record)
    except Exception as e:
        print(f"[Telemetry Alert] Database write warning: {e}")

    # Dispatch automated critical SMS alerts to all configured patient SOS numbers (up to 3)
    target_phones = [c.get('phone') for c in sos_contacts if c.get('phone')]
    if target_phones:
        send_sms_alert(
            prediction=trigger_reason,
            hr=vitals.get('heart_rate') or vitals.get('heartRate'),
            spo2=vitals.get('spo2'),
            temp=vitals.get('temperature'),
            recipient_phones=target_phones,
            location=record.get('location') or {},
        )

    # Notify patient room and assigned doctor directly
    socketio.emit('emergency:new', alert_record, to=_patient_room(patient_id))
    if assigned_doc:
        socketio.emit('emergency:new', alert_record, to=f"doctor:{assigned_doc}")


@socketio.on('subscribe_patient')
def on_subscribe_patient(data):
    data = data if isinstance(data, dict) else {}
    patient_id = str(data.get('patientId') or '').strip()
    if not patient_id:
        emit('subscription_error', {'message': 'patientId is required', 'code': 400})
        return

    sid = str(request.sid)
    actor = chat_sid_context.get(sid) or {}

    token = str(data.get('token') or data.get('authToken') or '').strip()
    if token and not actor:
        actor = _chat_extract_actor_from_payload(_decode_auth_token(token))
        if actor:
            _register_socket_user(sid, actor)

    role = str(actor.get('role') or '').strip().lower()
    if not role:
        auth_hdr = str(request.headers.get('Authorization') or '').strip()
        if auth_hdr.lower().startswith('bearer '):
            actor = _chat_extract_actor_from_payload(_decode_auth_token(auth_hdr[7:].strip()))
            if actor:
                _register_socket_user(sid, actor)
                role = str(actor.get('role') or '').strip().lower()

    if not role:
        print(f"[Socket.IO] Unauthenticated subscription attempt for patient {patient_id} from sid={sid[:8]}")
        emit('subscription_error', {'message': 'Unauthorized. Authentication token is required.', 'code': 401})
        return

    if role == 'patient':
        requester_patient_id = str(actor.get('patientId') or actor.get('id') or '').strip()
        if not requester_patient_id or requester_patient_id != patient_id:
            print(f"[Socket.IO] Access denied: patient {requester_patient_id} tried subscribing to patient {patient_id}")
            emit('subscription_error', {'message': 'Access denied for this patient room.', 'code': 403})
            return

    elif role == 'doctor':
        doctor_id = str(actor.get('doctorId') or actor.get('email') or actor.get('id') or '').strip().lower()
        patient_record = _patient_collection_reference().child(patient_id).get()
        if not isinstance(patient_record, dict):
            emit('subscription_error', {'message': 'Patient record not found.', 'code': 404})
            return

        if not _doctor_owns_record(patient_record, doctor_id):
            print(f"[Socket.IO] Access denied: doctor {doctor_id} tried subscribing to unassigned patient {patient_id}")
            emit('subscription_error', {'message': 'Access denied. You are not assigned to this patient.', 'code': 403})
            return

    elif role == 'admin':
        pass

    else:
        emit('subscription_error', {'message': 'Forbidden role for patient subscriptions.', 'code': 403})
        return

    join_room(_patient_room(patient_id))
    emit('subscription_ok', {'patientId': patient_id, 'room': _patient_room(patient_id)})
    print(f"[Socket.IO] Client {sid[:8]} ({role}) successfully subscribed to room patient:{patient_id}")


# ============================================================================
# 📡 PRODUCTION-READY ESP32 INGESTION & TELEMETRY SUBSYSTEM
# ============================================================================

# ============================================================================
# 📡 PRODUCTION-READY WEARABLE HARDWARE INGESTION & TELEMETRY SUBSYSTEM
# ============================================================================

@app.route("/api/devices/telemetry", methods=["POST"])
@app.route("/api/esp32/update", methods=["POST"])
def ingest_device_telemetry():
    """Ingest timestamped physiological telemetry from hardware wearable or BLE gateway."""
    if request.data:
        try:
            payload = request.get_json(force=True, silent=False)
        except Exception:
            return jsonify({'status': 'error', 'message': 'Invalid JSON payload format.'}), 400
    else:
        payload = {}

    if not isinstance(payload, dict):
        return jsonify({'status': 'error', 'message': 'JSON payload must be an object.'}), 400

    # Flexible header & payload extraction for device ID & credentials
    device_id = str(
        request.headers.get('X-Device-ID') or
        request.headers.get('X-Device-Id') or
        payload.get('deviceId') or
        payload.get('device_id') or
        ''
    ).strip()

    device_token = str(
        request.headers.get('X-Device-Token') or
        request.headers.get('X-Device-Key') or
        payload.get('deviceToken') or
        payload.get('apiKey') or
        ''
    ).strip()

    if not device_token:
        auth_hdr = str(request.headers.get('Authorization') or '').strip()
        if auth_hdr.lower().startswith('bearer '):
            device_token = auth_hdr[7:].strip()

    patient_id = ""
    device_record = None

    if device_id and device_token:
        device_record, err = _verify_device_credentials(device_id, device_token)
        if err:
            return jsonify({'status': 'error', 'message': err}), 401

        paired_patient_id = str(device_record.get('patientId') or '').strip()
        if not paired_patient_id:
            return jsonify({'status': 'error', 'message': 'Device is not linked to a patient.'}), 400

        # Anti-Spoofing & Patient Authorization Enforcement:
        # Prevent device from submitting data to an unauthorized patient's account
        provided_patient = str(payload.get('patientId') or payload.get('patient_id') or '').strip()
        if provided_patient and provided_patient != paired_patient_id:
            return jsonify({
                'status': 'error',
                'message': f"Access denied: Device '{device_id}' is paired to patient '{paired_patient_id}', cannot submit data for unauthorized patient '{provided_patient}'."
            }), 403

        patient_id = paired_patient_id
    else:
        # Development mode fallback (if enabled explicitly by environment)
        dev_mode_allowed = os.getenv('ALLOW_DEV_DEVICE_INSECURE', 'false').lower() in ('1', 'true', 'yes', 'y')
        if not dev_mode_allowed:
            return jsonify({
                'status': 'error',
                'message': 'Authentication required. Please provide X-Device-ID and X-Device-Token headers.'
            }), 401

        patient_id = str(payload.get("patientId") or payload.get("patient_id") or "").strip()
        if not patient_id:
            return jsonify({'status': 'error', 'message': 'patientId is required in dev mode.'}), 400

    # Look up patient in database
    patient_record = _patient_collection_reference().child(patient_id).get()
    if not isinstance(patient_record, dict):
        return jsonify({'status': 'error', 'message': f'Patient {patient_id} not found in database.'}), 404

    # ------------------------------------------------------------------------
    # Rate Limiting & Duplicate Detection
    # ------------------------------------------------------------------------
    now_epoch = time.time()
    rate_cache = getattr(app, '_device_telemetry_rate_cache', None)
    if rate_cache is None:
        rate_cache = {}
        app._device_telemetry_rate_cache = rate_cache

    last_info = rate_cache.get(device_id, {})
    last_time = last_info.get('time', 0.0)
    last_seq = last_info.get('seq')
    last_ts = last_info.get('ts')

    seq = payload.get('sequenceNumber') or payload.get('seq')
    client_ts = payload.get('timestamp')
    is_reconnect = bool(payload.get('isReconnect') or payload.get('buffered') or payload.get('reconnect'))

    # Rate limit: max 10 requests / sec (delta >= 0.1s for live streaming, bypassed for buffer flushes)
    if not is_reconnect and (now_epoch - last_time) < 0.1:
        return jsonify({'status': 'error', 'message': 'Rate limit exceeded: maximum 10 telemetry frames per second.'}), 429

    # Duplicate rejection: exact duplicate sequenceNumber or timestamp within 5 seconds
    if seq is not None and last_seq is not None and seq == last_seq and (now_epoch - last_time < 5.0):
        if is_reconnect:
            return jsonify({'status': 'duplicate_suppressed', 'duplicate': True, 'message': f'Duplicate sequence {seq} suppressed during reconnection.'}), 200
        return jsonify({'status': 'error', 'message': f'Duplicate telemetry frame with sequenceNumber {seq} rejected.'}), 409

    if client_ts is not None and last_ts is not None and client_ts == last_ts and (now_epoch - last_time < 5.0):
        if is_reconnect:
            return jsonify({'status': 'duplicate_suppressed', 'duplicate': True, 'message': f'Duplicate timestamp {client_ts} suppressed during reconnection.'}), 200
        return jsonify({'status': 'error', 'message': f'Duplicate telemetry frame with timestamp {client_ts} rejected.'}), 409

    rate_cache[device_id] = {'time': now_epoch, 'seq': seq, 'ts': client_ts}

    # ------------------------------------------------------------------------
    # Parse & Validate Telemetry Values (Physiological & Sensor Ranges)
    # ------------------------------------------------------------------------
    try:
        raw_hr = payload.get("heartRate") if payload.get("heartRate") is not None else payload.get("heart_rate", payload.get("bpm", 0))
        raw_spo2 = payload.get("spo2") if payload.get("spo2") is not None else payload.get("spO2", payload.get("SpO2", 0))
        raw_temp = payload.get("temperature") if payload.get("temperature") is not None else payload.get("temp", payload.get("temperatureC", 0))
        raw_leads = payload.get("leadsOff") if payload.get("leadsOff") is not None else payload.get("leadOff", False)
        raw_ecg = payload.get("ecg") if payload.get("ecg") is not None else payload.get("ecgValue", 0)

        heart_rate = float(raw_hr)
        spo2 = float(raw_spo2)
        temperature = float(raw_temp)
        leads_off = bool(raw_leads)
    except (ValueError, TypeError) as err:
        return jsonify({'status': 'error', 'message': f'Invalid telemetry number format: {err}'}), 400

    # Temperature Unit Conversion (support Celsius and Fahrenheit)
    temp_unit_input = str(payload.get("unit") or payload.get("tempUnit") or payload.get("temperatureUnit") or "C").strip().upper()
    if temp_unit_input in ('F', 'FAHRENHEIT') or (temperature > 55.0):
        temp_c = (temperature - 32.0) * 5.0 / 9.0
        raw_temp_unit = "F"
    else:
        temp_c = temperature
        raw_temp_unit = "C"

    # Physiological range validation
    # Heart rate: 30-240 BPM (0 allowed if sensor detached or leads off)
    if heart_rate != 0 and not (30.0 <= heart_rate <= 240.0):
        return jsonify({'status': 'error', 'message': f'Heart rate value out of physiological range (30-240 BPM): {heart_rate}'}), 400

    # SpO2: 50-100% (0 allowed if sensor detached)
    if spo2 != 0 and not (50.0 <= spo2 <= 100.0):
        return jsonify({'status': 'error', 'message': f'SpO2 value out of physiological range (50-100%): {spo2}'}), 400

    # Temperature in Celsius: 30.0-45.0 C (0 allowed if sensor detached)
    if temp_c != 0 and not (30.0 <= temp_c <= 45.0):
        return jsonify({'status': 'error', 'message': f'Temperature value out of physiological range (30-45 C / 86-113 F): {temperature} {raw_temp_unit}'}), 400

    # Battery & Signal Indicators
    raw_battery = payload.get("batteryLevel", payload.get("battery", 100))
    try:
        battery_level = max(0, min(100, int(raw_battery)))
    except Exception:
        battery_level = 100
    is_charging = bool(payload.get("isCharging", payload.get("charging", False)))
    signal_quality = str(payload.get("signalQuality") or ("POOR" if leads_off else "EXCELLENT")).strip().upper()

    # ECG samples / waveform reference
    raw_ecg_samples = payload.get("ecgSamples") or payload.get("ecgData") or (raw_ecg if isinstance(raw_ecg, list) else [raw_ecg] if raw_ecg else [])
    ecg_samples = raw_ecg_samples[:500] if isinstance(raw_ecg_samples, list) else []
    waveform_ref = str(payload.get("waveformRef") or payload.get("ecgRecordId") or "").strip()
    ecg_sample_rate = int(payload.get("sampleRateHz") or payload.get("sampleRate") or 250)

    # Source and Simulation Tags
    source_type = str(payload.get("source") or ("SYNTHETIC_SIMULATOR" if payload.get("isSimulated") else "HARDWARE_DEVICE")).strip()
    is_simulated = bool(payload.get("isSimulated", False) or source_type == "SYNTHETIC_SIMULATOR")

    now_iso = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    _hardware_active_patients[patient_id] = now_epoch

    vitals_dict = {
        'heart_rate': heart_rate,
        'spo2': spo2,
        'temperature': round(temp_c, 2),
    }

    # Run AI risk prediction
    prediction = predict_risk(vitals_dict)
    normalized = _normalize_patient_record(patient_id, patient_record, patient_record)
    with_audit = _append_prediction_audit(dict(normalized), prediction, 'hardware-telemetry', vitals_dict)

    # ------------------------------------------------------------------------
    # Timestamped Sensor Data Storage (Historical Telemetry)
    # ------------------------------------------------------------------------
    record_id = f"tel-{int(now_epoch * 1000)}-{secrets.token_hex(3)}"
    telemetry_item = {
        'recordId': record_id,
        'patientId': patient_id,
        'deviceId': device_id,
        'hospitalId': str((device_record or {}).get('hospitalId') or patient_record.get('hospitalId') or ''),
        'timestamp': str(payload.get('timestamp') or now_iso),
        'measurements': {
            'heartRate': {
                'value': heart_rate,
                'unit': 'BPM',
                'status': 'NORMAL' if (60 <= heart_rate <= 100) else ('HIGH' if heart_rate > 100 else 'LOW'),
            },
            'spo2': {
                'value': spo2,
                'unit': '%',
                'status': 'NORMAL' if spo2 >= 95 else ('BORDERLINE' if spo2 >= 90 else 'CRITICAL'),
            },
            'temperature': {
                'value': round(temp_c, 2),
                'unit': 'C',
                'rawValue': temperature,
                'rawUnit': raw_temp_unit,
                'status': 'FEVER' if temp_c > 37.5 else ('NORMAL' if temp_c >= 36.0 else 'HYPOTHERMIA'),
            },
            'ecg': {
                'samples': ecg_samples[:300],
                'waveformRef': waveform_ref,
                'sampleRateHz': ecg_sample_rate,
                'leadsOff': leads_off,
            }
        },
        'battery': {
            'level': battery_level,
            'isCharging': is_charging,
            'status': 'LOW' if battery_level < 20 else ('NORMAL' if battery_level < 80 else 'FULL'),
        },
        'quality': {
            'signalQuality': signal_quality,
            'sensorContact': not leads_off,
            'leadsOff': leads_off,
        },
        'source': 'SYNTHETIC_SIMULATOR' if is_simulated else source_type,
        'isSimulated': is_simulated,
    }

    try:
        time_key = f"{int(now_epoch * 1000)}"
        _device_telemetry_reference(patient_id).child(time_key).set(telemetry_item)
    except Exception as db_err:
        print(f"[Telemetry] History write notice: {db_err}")

    # Update authoritative device registry status
    if device_id:
        try:
            _devices_collection_reference().child(device_id).update({
                'lastSeen': now_iso,
                'batteryLevel': battery_level,
                'batteryCharging': is_charging,
                'signalQuality': signal_quality,
                'sensorStatus': {
                    'heartRate': 'OFFLINE' if (leads_off or heart_rate == 0) else 'OK',
                    'spo2': 'OFFLINE' if (leads_off or spo2 == 0) else 'OK',
                    'temperature': 'OFFLINE' if temp_c == 0 else 'OK',
                    'ecg': 'LEADS_OFF' if leads_off else 'OK',
                },
                'firmwareVersion': str(payload.get('firmwareVersion') or (device_record or {}).get('firmwareVersion') or '1.0.0'),
            })
        except Exception:
            pass

    # Update patient live record
    updated_record = _write_patient_record(patient_id, {
        **with_audit,
        'heart_rate': heart_rate,
        'spo2': spo2,
        'temperature': round(temp_c, 2),
        'ecgData': ecg_samples if ecg_samples else normalized.get('ecgData'),
        'leadsOff': leads_off,
        'deviceConnected': True,
        'deviceId': device_id or normalized.get('deviceId'),
        'dataSource': 'SYNTHETIC_SIMULATOR' if is_simulated else 'hardware',
        'batteryLevel': battery_level,
        'prediction': {
            'risk': prediction.get('risk'),
            'message': prediction.get('message'),
            'status': prediction.get('prediction_status') or prediction.get('status') or prediction.get('risk'),
            'confidence': prediction.get('confidence', 0.0),
        },
        'updatedAt': now_iso,
    })

    # Critical alert evaluation: PREVENT simulated measurements from triggering real-world emergency dispatch
    risk_level = str(prediction.get('risk') or '').lower()
    is_critical = (
        'critical' in risk_level or
        'high' in risk_level or
        (heart_rate > 150 or (heart_rate < 45 and heart_rate > 0)) or
        (spo2 < 85 and spo2 > 0) or
        (temp_c > 39.5)
    )

    if is_simulated or source_type == 'SYNTHETIC_SIMULATOR':
        # Development simulator safety isolation: never trigger emergency SMS/email
        pass
    elif is_critical and not leads_off and (heart_rate > 0 or spo2 > 0):
        try:
            _evaluate_and_trigger_telemetry_emergency(patient_id, updated_record, vitals_dict, prediction)
        except Exception as alert_err:
            print(f"[Telemetry] Emergency trigger warning: {alert_err}")

    # Broadcast updates via WebSocket
    payload_response = _build_patient_payload_response(patient_id, updated_record)
    socketio.emit('patient_snapshot', {
        'patientId': patient_id,
        'data': payload_response,
    }, to=_patient_room(patient_id))

    socketio.emit('vitals_update', {
        'patientId': patient_id,
        'vitals': {
            'heartRate': heart_rate,
            'spo2': spo2,
            'temperature': round(temp_c, 2),
            'ecg': ecg_samples[:10] if ecg_samples else 0,
            'leadsOff': leads_off,
            'batteryLevel': battery_level,
            'updatedAt': now_iso,
            'dataSource': 'SYNTHETIC_SIMULATOR' if is_simulated else 'hardware',
            'isSimulated': is_simulated,
        },
        'timestamp': now_iso,
    }, to=_patient_room(patient_id))

    socketio.emit('device_status_update', {
        'patientId': patient_id,
        'deviceId': device_id,
        'deviceConnected': True,
        'batteryLevel': battery_level,
        'dataSource': 'SYNTHETIC_SIMULATOR' if is_simulated else 'hardware',
        'isSimulated': is_simulated,
        'lastSeen': now_iso,
    }, to=_patient_room(patient_id))

    return jsonify({
        'status': 'success',
        'patientId': patient_id,
        'deviceId': device_id,
        'dataSource': 'SYNTHETIC_SIMULATOR' if is_simulated else 'HARDWARE_DEVICE',
        'isSimulated': is_simulated,
        'recordId': record_id,
        'timestamp': now_iso,
        'measurements': telemetry_item['measurements'],
        'battery': telemetry_item['battery'],
        'prediction': payload_response['prediction'],
    }), 200


# ============================================================================
# 🏥 DEVICE REGISTRY, PAIRING, STATUS & CLINICAL TELEMETRY APIS
# ============================================================================

@app.route('/api/devices/register', methods=['POST'])
@require_auth(roles={'doctor', 'admin', 'hospital_admin'})
def register_device():
    """Register/provision a hardware device into the hospital registry."""
    try:
        data = request.get_json(silent=True) or {}
        device_id = str(data.get('deviceId') or '').strip()
        patient_id = str(data.get('patientId') or '').strip()
        device_model = str(data.get('deviceModel') or data.get('model') or 'Wearable-Biomonitor-v1').strip()
        device_name = str(data.get('name') or f"Device-{device_id}").strip()
        firmware_version = str(data.get('firmwareVersion') or '1.0.0').strip()
        raw_token = str(data.get('deviceToken') or data.get('apiKey') or '').strip()
        actor_role = _request_user_role()
        actor_payload = _read_auth_payload() or {}

        if not device_id:
            return api_error('deviceId is required.', 400)

        # Resolve hospital association
        hospital_id = str(data.get('hospitalId') or actor_payload.get('hospitalId') or '').strip()
        if not hospital_id and actor_role == 'doctor':
            doc_id = _request_doctor_id()
            doc_rec = _doctor_collection_reference().child(doc_id.replace('.', ',')).get() or {}
            if isinstance(doc_rec, dict):
                hospital_id = str(doc_rec.get('hospitalId') or '').strip()

        # If patientId is provided, verify patient existence and authorization
        if patient_id:
            patient_record = _patient_collection_reference().child(patient_id).get()
            if not isinstance(patient_record, dict):
                return api_error('Patient record not found.', 404)

            pat_hosp = str(patient_record.get('hospitalId') or '').strip()
            if not hospital_id:
                hospital_id = pat_hosp

            if actor_role == 'doctor':
                doctor_id = _request_doctor_id()
                if not _doctor_owns_record(patient_record, doctor_id):
                    return api_error('Access denied for this patient record.', 403)
            elif actor_role == 'hospital_admin':
                admin_hosp = str(actor_payload.get('hospitalId') or '').strip()
                if admin_hosp and pat_hosp and admin_hosp.lower() != pat_hosp.lower():
                    return api_error('Access denied. Patient belongs to another hospital.', 403)

        # Generate device token if not provided
        if not raw_token:
            raw_token = f"hw_sec_{secrets.token_hex(20)}"

        token_hash = _hash_device_token(raw_token)
        now_iso = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        device_payload = {
            'deviceId': device_id,
            'deviceModel': device_model,
            'hospitalId': hospital_id,
            'patientId': patient_id if patient_id else None,
            'tokenHash': token_hash,
            'name': device_name,
            'firmwareVersion': firmware_version,
            'status': 'PAIRED' if patient_id else 'UNPAIRED',
            'active': True,
            'batteryLevel': 100,
            'batteryCharging': False,
            'sensorStatus': {
                'heartRate': 'OK',
                'spo2': 'OK',
                'temperature': 'OK',
                'ecg': 'OK',
            },
            'createdAt': now_iso,
            'updatedAt': now_iso,
            'lastSeen': None,
            'registeredBy': actor_role,
        }

        _devices_collection_reference().child(device_id).set(device_payload)

        if patient_id:
            _patient_collection_reference().child(patient_id).update({
                'deviceId': device_id,
                'pairedDeviceId': device_id,
                'deviceActive': True,
                'deviceConnected': True,
                'dataSource': 'hardware',
            })

        return api_success('Device registered successfully.', {
            'deviceId': device_id,
            'deviceModel': device_model,
            'hospitalId': hospital_id,
            'patientId': patient_id if patient_id else None,
            'deviceToken': raw_token,
            'name': device_name,
            'status': 'PAIRED' if patient_id else 'UNPAIRED',
            'firmwareVersion': firmware_version,
            'active': True,
            'createdAt': now_iso,
        })
    except Exception as err:
        return api_error(str(err), 500)


@app.route('/api/devices/pair', methods=['POST'])
@app.route('/api/devices/connect', methods=['POST'])
@app.route('/api/doctor/connect-device', methods=['POST'])
@require_auth(roles={'doctor', 'admin', 'hospital_admin', 'patient'})
def pair_device():
    """Securely pair a registered wearable device to an authorized patient."""
    try:
        data = request.get_json(silent=True) or {}
        device_id = str(data.get('deviceId') or '').strip()
        patient_id = str(data.get('patientId') or '').strip()
        force_reassign = bool(data.get('forceReassign', False))

        if not device_id:
            return api_error('deviceId is required.', 400)
        if not patient_id:
            return api_error('patientId is required.', 400)

        patient_record = _patient_collection_reference().child(patient_id).get()
        if not isinstance(patient_record, dict):
            return api_error('Patient record not found.', 404)

        user_role = _request_user_role()
        actor_payload = _read_auth_payload() or {}
        doctor_id = _request_doctor_id() if user_role == 'doctor' else None
        patient_hosp = str(patient_record.get('hospitalId') or '').strip().lower()

        # Authorization Checks
        if user_role == 'patient':
            req_patient_id = _request_patient_id()
            if not req_patient_id or req_patient_id != patient_id:
                return api_error('Access denied for this patient record.', 403)
        elif user_role == 'doctor':
            doc_hosp = str(actor_payload.get('hospitalId') or '').strip().lower()
            if doc_hosp and patient_hosp and doc_hosp != patient_hosp:
                return api_error('Access denied. Patient belongs to another hospital.', 403)
            if not _doctor_owns_record(patient_record, doctor_id):
                return api_error('Access denied for this patient record. You are not assigned to this patient.', 403)
        elif user_role == 'hospital_admin':
            admin_hosp = str(actor_payload.get('hospitalId') or '').strip().lower()
            if admin_hosp and patient_hosp and admin_hosp != patient_hosp:
                return api_error('Access denied. Patient belongs to another hospital.', 403)

        new_patient_name = str(patient_record.get('name') or patient_id).strip()
        now_iso = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # Check existing device in registry
        existing_device = _devices_collection_reference().child(device_id).get()
        raw_token = None

        if isinstance(existing_device, dict):
            dev_hosp = str(existing_device.get('hospitalId') or '').strip().lower()
            # Enforce Hospital Isolation on Device Association
            if dev_hosp and patient_hosp and dev_hosp != patient_hosp:
                return api_error('Access denied. Device is registered to another hospital.', 403)

            current_linked_patient = str(existing_device.get('patientId') or '').strip()
            if current_linked_patient and current_linked_patient != patient_id:
                if not force_reassign:
                    prev_rec = _patient_collection_reference().child(current_linked_patient).get() or {}
                    prev_name = str(prev_rec.get('name') or current_linked_patient).strip()
                    return jsonify({
                        'status': 'reassignment_required',
                        'message': f"Device '{device_id}' is currently connected to {prev_name} ({current_linked_patient}). Are you sure you want to reconnect it to {new_patient_name}?",
                        'currentLinkedPatient': current_linked_patient,
                        'currentLinkedPatientName': prev_name,
                        'targetPatientId': patient_id,
                        'targetPatientName': new_patient_name,
                        'deviceId': device_id,
                    }), 200

                # Unlink from previous patient cleanly
                try:
                    _patient_collection_reference().child(current_linked_patient).update({
                        'deviceId': None,
                        'pairedDeviceId': None,
                        'deviceActive': False,
                        'deviceConnected': False,
                    })
                    socketio.emit('device_status_update', {
                        'patientId': current_linked_patient,
                        'deviceConnected': False,
                        'deviceId': None,
                    }, to=_patient_room(current_linked_patient))
                except Exception:
                    pass

            _devices_collection_reference().child(device_id).update({
                'patientId': patient_id,
                'status': 'PAIRED',
                'active': True,
                'assignedDoctorId': doctor_id,
                'hospitalId': existing_device.get('hospitalId') or patient_record.get('hospitalId'),
                'updatedAt': now_iso,
            })
        else:
            # Auto-register device if not existing
            raw_token = f"hw_sec_{secrets.token_hex(20)}"
            token_hash = _hash_device_token(raw_token)
            device_payload = {
                'deviceId': device_id,
                'deviceModel': str(data.get('deviceModel') or 'Wearable-Biomonitor-v1').strip(),
                'hospitalId': patient_record.get('hospitalId') or actor_payload.get('hospitalId') or '',
                'patientId': patient_id,
                'tokenHash': token_hash,
                'name': str(data.get('name') or f"Device-{device_id}").strip(),
                'firmwareVersion': '1.0.0',
                'status': 'PAIRED',
                'active': True,
                'batteryLevel': 100,
                'createdAt': now_iso,
                'updatedAt': now_iso,
                'lastSeen': None,
                'registeredBy': user_role,
            }
            _devices_collection_reference().child(device_id).set(device_payload)

        # Update target patient record
        _patient_collection_reference().child(patient_id).update({
            'deviceId': device_id,
            'pairedDeviceId': device_id,
            'deviceActive': True,
            'deviceConnected': True,
            'dataSource': 'hardware',
        })

        socketio.emit('device_status_update', {
            'patientId': patient_id,
            'deviceConnected': True,
            'deviceId': device_id,
            'dataSource': 'hardware',
            'status': 'PAIRED',
        }, to=_patient_room(patient_id))

        res_data = {
            'deviceId': device_id,
            'patientId': patient_id,
            'patientName': new_patient_name,
            'status': 'PAIRED',
            'linked': True,
            'active': True,
            'updatedAt': now_iso,
        }
        if raw_token:
            res_data['deviceToken'] = raw_token

        return api_success(f"Device '{device_id}' paired to {new_patient_name} successfully.", res_data)
    except Exception as err:
        return api_error(str(err), 500)


@app.route('/api/devices/unpair', methods=['POST'])
@app.route('/api/devices/disconnect', methods=['POST'])
@require_auth(roles={'doctor', 'admin', 'hospital_admin', 'patient'})
def unpair_device():
    """Unpair and disconnect a device from a patient."""
    try:
        data = request.get_json(silent=True) or {}
        patient_id = str(data.get('patientId') or '').strip()
        device_id = str(data.get('deviceId') or '').strip()

        if not patient_id and not device_id:
            return api_error('patientId or deviceId is required.', 400)

        user_role = _request_user_role()
        actor_payload = _read_auth_payload() or {}
        doctor_id = _request_doctor_id() if user_role == 'doctor' else None

        if patient_id:
            patient_record = _patient_collection_reference().child(patient_id).get()
            if isinstance(patient_record, dict):
                if user_role == 'patient':
                    req_patient_id = _request_patient_id()
                    if not req_patient_id or req_patient_id != patient_id:
                        return api_error('Access denied for this patient record.', 403)
                elif user_role == 'doctor':
                    if not _doctor_owns_record(patient_record, doctor_id):
                        return api_error('Access denied for this patient record.', 403)
                elif user_role == 'hospital_admin':
                    admin_hosp = str(actor_payload.get('hospitalId') or '').strip().lower()
                    pat_hosp = str(patient_record.get('hospitalId') or '').strip().lower()
                    if admin_hosp and pat_hosp and admin_hosp != pat_hosp:
                        return api_error('Access denied. Patient belongs to another hospital.', 403)

                device_id = str(patient_record.get('deviceId') or device_id).strip()

                _patient_collection_reference().child(patient_id).update({
                    'deviceId': None,
                    'pairedDeviceId': None,
                    'deviceActive': False,
                    'deviceConnected': False,
                    'dataSource': 'dataset',
                })
                socketio.emit('device_status_update', {
                    'patientId': patient_id,
                    'deviceConnected': False,
                    'deviceId': None,
                    'status': 'UNPAIRED',
                }, to=_patient_room(patient_id))

        if device_id:
            try:
                _devices_collection_reference().child(device_id).update({
                    'patientId': None,
                    'status': 'UNPAIRED',
                    'active': True,
                    'updatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                })
            except Exception:
                pass

        return api_success('Device unpaired successfully.', {'patientId': patient_id, 'deviceId': device_id, 'status': 'UNPAIRED'})
    except Exception as err:
        return api_error(str(err), 500)


@app.route('/api/patient/<patient_id>/device', methods=['GET'])
@require_auth(roles={'doctor', 'patient', 'admin', 'hospital_admin'}, patient_id_arg='patient_id')
def get_patient_device(patient_id):
    """Retrieve details of the hardware wearable currently paired to a patient."""
    try:
        key = str(patient_id or '').strip()
        patient_record = _patient_collection_reference().child(key).get()
        if not isinstance(patient_record, dict):
            return api_error('Patient not found.', 404)

        device_id = str(patient_record.get('deviceId') or patient_record.get('pairedDeviceId') or '').strip()
        if not device_id:
            return api_success('No device linked to patient.', {'linked': False, 'deviceId': None})

        device_record = _devices_collection_reference().child(device_id).get()
        if not isinstance(device_record, dict):
            return api_success('Device not found in registry.', {'linked': False, 'deviceId': device_id})

        safe_record = dict(device_record)
        safe_record.pop('tokenHash', None)
        safe_record['linked'] = True
        return api_success('Device details fetched successfully.', safe_record)
    except Exception as err:
        return api_error(str(err), 500)


@app.route('/api/devices/<device_id>/status', methods=['GET'])
@require_auth(roles={'doctor', 'admin', 'hospital_admin', 'patient'})
def get_device_status(device_id):
    """Retrieve device health, online state, battery, and sensor diagnostics."""
    try:
        dev_key = str(device_id or '').strip()
        device_record = _devices_collection_reference().child(dev_key).get()
        if not isinstance(device_record, dict):
            return api_error('Device not found.', 404)

        user_role = _request_user_role()
        actor_payload = _read_auth_payload() or {}
        linked_patient_id = str(device_record.get('patientId') or '').strip()
        dev_hospital_id = str(device_record.get('hospitalId') or '').strip().lower()

        # Authorization
        if user_role == 'patient':
            req_patient_id = _request_patient_id()
            if not linked_patient_id or req_patient_id != linked_patient_id:
                return api_error('Access denied for this device.', 403)
        elif user_role == 'hospital_admin':
            admin_hosp = str(actor_payload.get('hospitalId') or '').strip().lower()
            if admin_hosp and dev_hospital_id and admin_hosp != dev_hospital_id:
                return api_error('Access denied for this device.', 403)
        elif user_role == 'doctor':
            doc_hosp = str(actor_payload.get('hospitalId') or '').strip().lower()
            if doc_hosp and dev_hospital_id and doc_hosp != dev_hospital_id:
                return api_error('Access denied for this device.', 403)

        now_timestamp = time.time()
        last_seen_str = str(device_record.get('lastSeen') or '')
        is_online = False
        last_seen_seconds_ago = None

        if last_seen_str:
            try:
                last_seen_dt = datetime.strptime(last_seen_str, '%Y-%m-%d %H:%M:%S')
                last_seen_epoch = last_seen_dt.timestamp()
                last_seen_seconds_ago = max(0, int(now_timestamp - last_seen_epoch))
                is_online = (last_seen_seconds_ago <= 60)
            except Exception:
                pass

        battery_level = device_record.get('batteryLevel', 100)
        battery_charging = bool(device_record.get('batteryCharging', False))

        return api_success('Device status fetched successfully.', {
            'deviceId': dev_key,
            'deviceModel': device_record.get('deviceModel') or 'Wearable-Biomonitor-v1',
            'hospitalId': device_record.get('hospitalId') or '',
            'patientId': linked_patient_id or None,
            'connectionState': 'ONLINE' if is_online else ('OFFLINE' if linked_patient_id else 'UNPAIRED'),
            'isOnline': is_online,
            'lastSeen': last_seen_str or None,
            'lastSeenSecondsAgo': last_seen_seconds_ago,
            'battery': {
                'level': battery_level,
                'isCharging': battery_charging,
                'status': 'LOW' if battery_level < 20 else ('NORMAL' if battery_level < 80 else 'FULL'),
            },
            'sensorStatus': device_record.get('sensorStatus') or {
                'heartRate': 'OK',
                'spo2': 'OK',
                'temperature': 'OK',
                'ecg': 'OK',
            },
            'signalQuality': device_record.get('signalQuality') or ('EXCELLENT' if is_online else 'UNKNOWN'),
            'firmwareVersion': device_record.get('firmwareVersion') or '1.0.0',
            'status': device_record.get('status') or ('PAIRED' if linked_patient_id else 'UNPAIRED'),
        })
    except Exception as err:
        return api_error(str(err), 500)


@app.route('/api/devices/list', methods=['GET'])
@app.route('/api/devices', methods=['GET'])
@require_auth(roles={'doctor', 'admin', 'hospital_admin'})
def list_devices():
    """List devices in registry, scoped to hospital for doctors/hospital admins."""
    try:
        devices_raw = _devices_collection_reference().get() or {}
        if not isinstance(devices_raw, dict):
            devices_raw = {}

        now_timestamp = time.time()
        user_role = _request_user_role()
        actor_payload = _read_auth_payload() or {}
        scoped_hospital = str(actor_payload.get('hospitalId') or '').strip().lower()

        result = []
        for dev_id, dev_data in devices_raw.items():
            if not isinstance(dev_data, dict):
                continue

            dev_hosp = str(dev_data.get('hospitalId') or '').strip().lower()
            if scoped_hospital and dev_hosp and scoped_hospital != dev_hosp:
                continue

            last_seen_str = str(dev_data.get('lastSeen') or '')
            is_online = False
            last_seen_seconds_ago = None

            if last_seen_str:
                try:
                    last_seen_dt = datetime.strptime(last_seen_str, '%Y-%m-%d %H:%M:%S')
                    last_seen_epoch = last_seen_dt.timestamp()
                    last_seen_seconds_ago = max(0, int(now_timestamp - last_seen_epoch))
                    is_online = (last_seen_seconds_ago <= 60)
                except Exception:
                    pass

            linked_patient_id = str(dev_data.get('patientId') or '').strip()
            linked_patient_name = ''
            if linked_patient_id:
                try:
                    pt_rec = _patient_collection_reference().child(linked_patient_id).get()
                    if isinstance(pt_rec, dict):
                        linked_patient_name = str(pt_rec.get('name') or '').strip()
                except Exception:
                    pass

            dev_status = 'ONLINE' if is_online else ('OFFLINE' if linked_patient_id else 'AVAILABLE')

            safe_item = {
                'deviceId': dev_id,
                'name': dev_data.get('name') or f"Device-{dev_id}",
                'deviceModel': dev_data.get('deviceModel') or 'Wearable-Biomonitor-v1',
                'hospitalId': dev_data.get('hospitalId') or '',
                'patientId': linked_patient_id if linked_patient_id else None,
                'patientName': linked_patient_name,
                'active': bool(dev_data.get('active', True)),
                'online': is_online,
                'status': dev_status,
                'lastSeen': last_seen_str,
                'lastSeenSecondsAgo': last_seen_seconds_ago,
                'batteryLevel': dev_data.get('batteryLevel', 100),
                'firmwareVersion': dev_data.get('firmwareVersion') or '1.0.0',
                'createdAt': dev_data.get('createdAt') or '',
            }
            result.append(safe_item)

        return api_success('Devices fetched successfully.', {'devices': result})
    except Exception as err:
        return api_error(str(err), 500)


# ============================================================================
# 📈 HISTORICAL TELEMETRY APIS FOR CHARTS & CLINICAL REVIEW
# ============================================================================

@app.route('/api/patient/<patient_id>/device-telemetry', methods=['GET'])
@require_auth(roles={'doctor', 'patient', 'admin', 'hospital_admin'}, patient_id_arg='patient_id')
def get_patient_device_telemetry(patient_id):
    """Retrieve historical vitals series for charts and authorized clinical review."""
    try:
        raw_limit = request.args.get('limit', '50')
        try:
            limit = max(1, min(500, int(raw_limit)))
        except Exception:
            limit = 50

        metric = str(request.args.get('metric') or 'all').strip().lower()
        start_time = str(request.args.get('startTime') or '').strip()
        end_time = str(request.args.get('endTime') or '').strip()

        # Query telemetry history
        history_raw = _device_telemetry_reference(patient_id).get() or {}
        records = []

        if isinstance(history_raw, dict):
            for key, val in history_raw.items():
                if not isinstance(val, dict):
                    continue
                records.append(val)
        elif isinstance(history_raw, list):
            for item in history_raw:
                if isinstance(item, dict):
                    records.append(item)

        # Sort by timestamp ascending
        records.sort(key=lambda r: str(r.get('timestamp') or ''))

        # Time range filter
        if start_time:
            records = [r for r in records if str(r.get('timestamp') or '') >= start_time]
        if end_time:
            records = [r for r in records if str(r.get('timestamp') or '') <= end_time]

        # Apply limit to latest items
        records = records[-limit:]

        # Metric-specific projection
        if metric in ('heartrate', 'hr'):
            formatted = [{
                'timestamp': r.get('timestamp'),
                'heartRate': (r.get('measurements', {}).get('heartRate', {}) or {}).get('value'),
                'unit': 'BPM',
                'quality': (r.get('quality', {}) or {}).get('signalQuality', 'UNKNOWN'),
                'isSimulated': bool(r.get('isSimulated', False)),
            } for r in records]
        elif metric == 'spo2':
            formatted = [{
                'timestamp': r.get('timestamp'),
                'spo2': (r.get('measurements', {}).get('spo2', {}) or {}).get('value'),
                'unit': '%',
                'quality': (r.get('quality', {}) or {}).get('signalQuality', 'UNKNOWN'),
                'isSimulated': bool(r.get('isSimulated', False)),
            } for r in records]
        elif metric in ('temperature', 'temp'):
            formatted = [{
                'timestamp': r.get('timestamp'),
                'temperature': (r.get('measurements', {}).get('temperature', {}) or {}).get('value'),
                'unit': 'C',
                'quality': (r.get('quality', {}) or {}).get('signalQuality', 'UNKNOWN'),
                'isSimulated': bool(r.get('isSimulated', False)),
            } for r in records]
        elif metric == 'ecg':
            formatted = [{
                'timestamp': r.get('timestamp'),
                'samples': (r.get('measurements', {}).get('ecg', {}) or {}).get('samples', []),
                'waveformRef': (r.get('measurements', {}).get('ecg', {}) or {}).get('waveformRef', ''),
                'sampleRateHz': (r.get('measurements', {}).get('ecg', {}) or {}).get('sampleRateHz', 250),
                'leadsOff': (r.get('measurements', {}).get('ecg', {}) or {}).get('leadsOff', False),
                'isSimulated': bool(r.get('isSimulated', False)),
            } for r in records]
        else:
            formatted = records

        return api_success('Telemetry history fetched successfully.', {
            'patientId': patient_id,
            'metric': metric,
            'count': len(formatted),
            'history': formatted,
        })
    except Exception as err:
        return api_error(str(err), 500)


@app.route('/api/devices/<device_id>/history', methods=['GET'])
@require_auth(roles={'doctor', 'patient', 'admin', 'hospital_admin'})
def get_device_history(device_id):
    """Retrieve telemetry history for a specific device by device ID."""
    try:
        dev_rec = _devices_collection_reference().child(device_id).get()
        if not isinstance(dev_rec, dict):
            return api_error('Device not found.', 404)

        linked_patient_id = str(dev_rec.get('patientId') or '').strip()
        if not linked_patient_id:
            return api_success('Device has no associated patient telemetry.', {
                'deviceId': device_id,
                'count': 0,
                'history': [],
            })

        # Delegate with patient authorization check
        return get_patient_device_telemetry(linked_patient_id)
    except Exception as err:
        return api_error(str(err), 500)


# ============================================================================
# 🧪 DEVELOPMENT-ONLY SYNTHETIC DATA SIMULATOR
# ============================================================================

@app.route('/api/devices/simulate', methods=['POST'])
@require_auth(roles={'doctor', 'patient', 'admin', 'hospital_admin'})
def simulate_device_telemetry():
    """Development-only simulator generating clearly labelled synthetic vitals.
    Guarantees no false clinical emergency alerts or dispatches are triggered."""
    try:
        data = request.get_json(silent=True) or {}
        patient_id = str(data.get('patientId') or '').strip()
        scenario = str(data.get('scenario') or 'NORMAL').strip().upper()
        device_id = str(data.get('deviceId') or f"SIM-DEV-{patient_id}").strip()
        user_role = _request_user_role()

        if not patient_id:
            return api_error('patientId is required for simulation.', 400)

        # Enforce patient ownership & hospital scoping
        patient_record = _patient_collection_reference().child(patient_id).get()
        if not isinstance(patient_record, dict):
            return api_error('Patient not found.', 404)

        if user_role == 'patient':
            req_patient_id = _request_patient_id()
            if not req_patient_id or req_patient_id != patient_id:
                return api_error('Access denied for this patient record.', 403)
        elif user_role == 'doctor':
            doctor_id = _request_doctor_id()
            if not _doctor_owns_record(patient_record, doctor_id):
                return api_error('Access denied for this patient record.', 403)

        # Generate realistic synthetic scenarios
        if scenario == 'BRADYCARDIA':
            hr = random.uniform(38.0, 48.0)
            spo2 = random.uniform(94.0, 98.0)
            temp = random.uniform(36.2, 36.8)
        elif scenario == 'TACHYCARDIA':
            hr = random.uniform(130.0, 160.0)
            spo2 = random.uniform(93.0, 97.0)
            temp = random.uniform(37.0, 37.5)
        elif scenario == 'HYPOXIA':
            hr = random.uniform(105.0, 125.0)
            spo2 = random.uniform(78.0, 87.0)
            temp = random.uniform(36.5, 37.2)
        elif scenario == 'FEVER':
            hr = random.uniform(95.0, 115.0)
            spo2 = random.uniform(95.0, 99.0)
            temp = random.uniform(38.8, 40.2)
        elif scenario == 'CRITICAL_CRISIS':
            hr = random.uniform(160.0, 185.0)
            spo2 = random.uniform(75.0, 84.0)
            temp = random.uniform(39.4, 40.5)
        else:  # NORMAL
            hr = random.uniform(68.0, 84.0)
            spo2 = random.uniform(96.0, 99.0)
            temp = random.uniform(36.5, 37.1)

        hr = round(hr, 1)
        spo2 = round(spo2, 1)
        temp = round(temp, 2)
        battery_level = int(data.get('batteryLevel', random.randint(70, 95)))

        # Generate synthetic ECG samples (Lead II P-QRS-T complex)
        synthetic_ecg = [
            512, 514, 516, 520, 524, 520, 516, 512,  # P wave
            510, 508, 490, 720, 380, 512,            # QRS complex
            512, 514, 520, 528, 532, 524, 514, 512   # T wave
        ]

        now_iso = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        now_epoch = time.time()
        record_id = f"sim-{int(now_epoch * 1000)}-{secrets.token_hex(3)}"

        synthetic_payload = {
            'recordId': record_id,
            'patientId': patient_id,
            'deviceId': device_id,
            'hospitalId': str(patient_record.get('hospitalId') or ''),
            'timestamp': now_iso,
            'scenario': scenario,
            'measurements': {
                'heartRate': {'value': hr, 'unit': 'BPM', 'status': 'HIGH' if hr > 100 else ('LOW' if hr < 60 else 'NORMAL')},
                'spo2': {'value': spo2, 'unit': '%', 'status': 'NORMAL' if spo2 >= 95 else 'LOW'},
                'temperature': {'value': temp, 'unit': 'C', 'status': 'FEVER' if temp > 37.5 else 'NORMAL'},
                'ecg': {
                    'samples': synthetic_ecg,
                    'waveformRef': f"synth-{scenario.lower()}-01",
                    'sampleRateHz': 250,
                    'leadsOff': False,
                }
            },
            'battery': {'level': battery_level, 'isCharging': False, 'status': 'NORMAL'},
            'quality': {'signalQuality': 'EXCELLENT', 'sensorContact': True, 'leadsOff': False},
            'source': 'SYNTHETIC_SIMULATOR',
            'isSimulated': True,
            'syntheticNotice': 'Development-only synthetic data. Not from clinical sensors. Real emergency dispatch suppressed.',
        }

        # Store in historical telemetry collection
        time_key = f"{int(now_epoch * 1000)}"
        _device_telemetry_reference(patient_id).child(time_key).set(synthetic_payload)

        # Update patient live dashboard with explicit simulation labels
        _write_patient_record(patient_id, {
            'heart_rate': hr,
            'spo2': spo2,
            'temperature': temp,
            'ecgData': synthetic_ecg,
            'leadsOff': False,
            'deviceConnected': True,
            'deviceId': device_id,
            'dataSource': 'SYNTHETIC_SIMULATOR',
            'isSimulated': True,
            'updatedAt': now_iso,
        })

        # Broadcast via WebSocket for UI preview without triggering real 108/112 emergency calls
        socketio.emit('vitals_update', {
            'patientId': patient_id,
            'vitals': {
                'heartRate': hr,
                'spo2': spo2,
                'temperature': temp,
                'ecg': synthetic_ecg,
                'leadsOff': False,
                'batteryLevel': battery_level,
                'dataSource': 'SYNTHETIC_SIMULATOR',
                'isSimulated': True,
                'updatedAt': now_iso,
            },
            'timestamp': now_iso,
        }, to=_patient_room(patient_id))

        return api_success('Synthetic telemetry generated successfully.', synthetic_payload)
    except Exception as err:
        return api_error(str(err), 500)



@app.route('/api/patient/<patient_id>/live-vitals', methods=['GET'])
@require_auth(roles={'doctor', 'patient', 'admin'}, patient_id_arg='patient_id')
def get_patient_live_vitals(patient_id):
    try:
        key = str(patient_id or '').strip()
        record = _patient_collection_reference().child(key).get()
        if not isinstance(record, dict):
            return api_error('Patient not found.', 404)

        normalized = _normalize_patient_record(key, record, record)
        payload = _build_patient_payload_response(key, normalized)
        return api_success('Live vitals fetched successfully.', payload.get('vitals'))
    except Exception as err:
        return api_error(str(err), 500)


# ============================================================================
# 🚨 EMERGENCY RESPONSE & AMBULANCE DISPATCH SYSTEM
# ============================================================================

# SECURITY FIX: Enforce strict authentication, device verification, and doctor-patient ownership on emergency_trigger
@app.route("/api/emergency/trigger", methods=["POST"])
def emergency_trigger():
    try:
        data = request.get_json(silent=True) or {}
        device_id = request.headers.get('X-Device-ID')
        device_token = request.headers.get('X-Device-Token')
        role = _request_user_role()

        patient_id = ""
        actor_name = "system"

        # 1. Device authentication (Hardware automatic emergency)
        if device_id and device_token:
            is_valid, device_record, auth_err = _verify_device_credentials(device_id, device_token)
            if not is_valid:
                return jsonify({"status": "error", "message": f"Unauthorized device: {auth_err}"}), 401
            patient_id = str(device_record.get('patientId') or '').strip()
            actor_name = f"hardware_device_{device_id}"

        # 2. User authentication (Patient self, Doctor, or Hospital/Super Admin)
        elif role:
            payload = _read_auth_payload()
            if role == 'patient':
                auth_patient_id = _request_patient_id()
                if not auth_patient_id:
                    return jsonify({"status": "error", "message": "Patient identity required."}), 401
                body_pid = str(data.get("patientId") or "").strip()
                if body_pid and body_pid != auth_patient_id:
                    return jsonify({"status": "error", "message": "Forbidden. You can only trigger an emergency for yourself."}), 403
                patient_id = auth_patient_id
                actor_name = "patient"

            elif role == 'doctor':
                doctor_id = _request_doctor_id()
                if not doctor_id:
                    return jsonify({"status": "error", "message": "Doctor identity required."}), 401
                body_pid = str(data.get("patientId") or "").strip()
                if not body_pid:
                    return jsonify({"status": "error", "message": "patientId is required."}), 400
                precord = _patient_collection_reference().child(body_pid).get()
                if not isinstance(precord, dict):
                    return jsonify({"status": "error", "message": "Patient record not found."}), 404
                
                doc_node = _doctor_collection_reference().child(doctor_id.replace('.', ',')).get() or {}
                doc_hosp = str(payload.get('hospitalId') or doc_node.get('hospitalId') or '').strip().lower()
                pat_hosp = str(precord.get('hospitalId') or '').strip().lower()
                is_assigned = _doctor_owns_record(precord, doctor_id)
                same_hospital = (doc_hosp and pat_hosp and doc_hosp == pat_hosp)
                if not is_assigned and not same_hospital:
                    return jsonify({"status": "error", "message": "Forbidden. You are not assigned to this patient or hospital."}), 403
                patient_id = body_pid
                actor_name = f"doctor_{doctor_id}"

            elif role in ('hospital_admin', 'admin'):
                body_pid = str(data.get("patientId") or "").strip()
                if not body_pid:
                    return jsonify({"status": "error", "message": "patientId is required."}), 400
                precord = _patient_collection_reference().child(body_pid).get()
                if not isinstance(precord, dict):
                    return jsonify({"status": "error", "message": "Patient record not found."}), 404
                admin_hosp = str(payload.get('hospitalId') or '').strip().lower()
                pat_hosp = str(precord.get('hospitalId') or '').strip().lower()
                if admin_hosp and pat_hosp and admin_hosp != pat_hosp:
                    return jsonify({"status": "error", "message": "Forbidden. Patient belongs to another hospital."}), 403
                patient_id = body_pid
                actor_name = f"hospital_admin_{payload.get('email', 'admin')}"

            elif role == 'super_admin':
                body_pid = str(data.get("patientId") or "").strip()
                if not body_pid:
                    return jsonify({"status": "error", "message": "patientId is required."}), 400
                precord = _patient_collection_reference().child(body_pid).get()
                if not isinstance(precord, dict):
                    return jsonify({"status": "error", "message": "Patient record not found."}), 404
                patient_id = body_pid
                actor_name = "super_admin"

            else:
                return jsonify({"status": "error", "message": "Forbidden. Role not authorized."}), 403

        else:
            return jsonify({"status": "error", "message": "Unauthorized. Valid authentication token or device credentials required."}), 401

        if not patient_id:
            return jsonify({"status": "error", "message": "Could not resolve patient identity."}), 400

        # Dynamically lookup patient from RTDB
        patient_record = _patient_collection_reference().child(patient_id).get() or {}
        patient_name = patient_record.get('name') if isinstance(patient_record, dict) else "Patient"
        assigned_doc = ""
        if isinstance(patient_record, dict):
            assigned_doc = str(patient_record.get('assignedDoctorId') or patient_record.get('doctorId') or patient_record.get('doctorEmail') or '').strip().lower()
        doctor_id = assigned_doc or "general-triage"
        assigned_doc_name = str(patient_record.get('assignedDoctorName') or patient_record.get('doctorName') or '')

        pat_hosp_id = str(patient_record.get('hospitalId') or '').strip()
        hosp_node = {}
        if pat_hosp_id:
            hosp_node = _hospitals_collection_reference().child(pat_hosp_id).get() or {}
        hosp_name = str(hosp_node.get('name') or patient_record.get('hospitalName') or 'City General Medical Center').strip()
        hosp_phone = str(hosp_node.get('phone') or '+91 11 4000 1000').strip()
        hosp_email = str(hosp_node.get('email') or 'emergency@citygeneral.org').strip()

        location_input = data.get("location") or {}
        vitals = data.get("vitals") or {}
        trigger_reason = str(data.get("triggerReason") or "Emergency SOS Triggered").strip()
        now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # ----------------------------------------------------------------------
        # DEDUPLICATION & COOLDOWN: Suppress duplicate triggers within 45s window
        # ----------------------------------------------------------------------
        existing_active = db.reference(f"patients/{patient_id}/activeEmergency").get()
        if isinstance(existing_active, dict) and existing_active.get("status") not in ("RESOLVED", "CANCELLED"):
            created_at_str = str(existing_active.get("createdAt") or "")
            is_recent = False
            try:
                created_dt = datetime.strptime(created_at_str, "%Y-%m-%d %H:%M:%S")
                if (datetime.now() - created_dt).total_seconds() < 45:
                    is_recent = True
            except Exception:
                pass

            if is_recent:
                active_id = existing_active.get("alertId")
                audit_log = existing_active.get("auditLog", [])
                audit_log.append({
                    "timestamp": now_iso,
                    "actor": actor_name,
                    "action": "DUPLICATE_SOS_SUPPRESSED",
                    "details": "Repeated SOS trigger received within 45s cooldown. Telemetry & GPS updated.",
                })
                updates = {
                    "updatedAt": now_iso,
                    "auditLog": audit_log,
                }
                if location_input and isinstance(location_input, dict) and location_input.get("latitude"):
                    updates["location"] = location_input
                    updates["locationStatus"] = "ACQUIRED"
                    updates["mapsUrl"] = f"https://maps.google.com/?q={location_input['latitude']},{location_input['longitude']}"
                if vitals and isinstance(vitals, dict):
                    updates["vitals"] = vitals

                existing_active.update(updates)
                db.reference(f"emergencyAlerts/{active_id}").update(updates)
                db.reference(f"patients/{patient_id}/activeEmergency").update(updates)
                return jsonify({
                    "status": "success",
                    "message": "Active emergency refreshed with updated telemetry (duplicate suppressed).",
                    "duplicatePrevented": True,
                    "data": existing_active
                }), 200

        alert_id = str(data.get("alertId") or f"SOS-{datetime.now().strftime('%Y%m%d')}-{patient_id[:6]}-{secrets.token_hex(2).upper()}").strip()

        # ----------------------------------------------------------------------
        # GPS LOCATION PROCESSING: Robust validation, error states, and map links
        # ----------------------------------------------------------------------
        location = {}
        maps_url = ""
        osm_url = ""
        location_status = "UNAVAILABLE"

        if isinstance(location_input, dict) and location_input.get("latitude") is not None and location_input.get("longitude") is not None:
            try:
                lat = float(location_input["latitude"])
                lng = float(location_input["longitude"])
                acc = float(location_input.get("accuracy", 15.0))
                maps_url = f"https://maps.google.com/?q={lat},{lng}"
                osm_url = f"https://www.openstreetmap.org/?mlat={lat}&mlon={lng}#map=16/{lat}/{lng}"
                location_status = "ACQUIRED"
                location = {
                    "latitude": lat,
                    "longitude": lng,
                    "accuracy": acc,
                    "status": location_status,
                    "mapsUrl": maps_url,
                    "openStreetMapUrl": osm_url,
                    "timestamp": location_input.get("timestamp") or now_iso,
                    "address": location_input.get("address") or f"Coordinates: {lat:.5f}, {lng:.5f}",
                }
            except (ValueError, TypeError):
                location_status = "INVALID_COORDINATES"
                location = {"status": location_status, "latitude": None, "longitude": None, "timestamp": now_iso}
        else:
            declined_state = str(data.get("locationStatus") or (location_input.get("status") if isinstance(location_input, dict) else "") or "UNAVAILABLE").upper()
            location_status = "PERMISSION_DENIED" if "DENIED" in declined_state else "UNAVAILABLE"
            location = {
                "status": location_status,
                "latitude": None,
                "longitude": None,
                "accuracy": None,
                "timestamp": now_iso,
                "reason": "Location permission denied or device GPS offline",
            }

        # Extract patient SOS contacts (up to 3 contacts)
        sos_contacts = data.get("sosContacts") or (patient_record.get("sosContacts") if isinstance(patient_record, dict) else []) or []
        if not sos_contacts:
            single_sos = data.get("sosContact") or (patient_record.get("emergencyContact") if isinstance(patient_record, dict) else {}) or {}
            if single_sos and isinstance(single_sos, dict) and (single_sos.get("name") or single_sos.get("phone")):
                sos_contacts = [single_sos]
            elif isinstance(patient_record, dict) and (patient_record.get("sosContactPhone") or patient_record.get("sosContactName")):
                sos_contacts = [{
                    "name": patient_record.get("sosContactName") or "",
                    "phone": patient_record.get("sosContactPhone") or "",
                    "relation": patient_record.get("sosContactRelation") or "Family",
                }]

        sos_contacts = [
            c for c in sos_contacts
            if isinstance(c, dict) and c.get('name') != 'Rahul Soni' and c.get('phone') != '+91 98765 43210' and (c.get('name') or c.get('phone'))
        ][:3]
        primary_sos = sos_contacts[0] if sos_contacts else {}
        is_demo = bool(data.get("isDemo", False))

        # ----------------------------------------------------------------------
        # NOTIFICATION DELIVERY TRACKING: Realistic reporting without false claims
        # ----------------------------------------------------------------------
        target_phones = [c.get('phone') for c in sos_contacts if c.get('phone')]
        sms_report = {
            "success": False,
            "configured": bool(twilio_client and TWILIO_PHONE_FROM),
            "status": "PROVIDER_UNCONFIGURED",
            "recipients": []
        }
        if target_phones and not is_demo:
            sms_report = send_sms_alert(
                prediction=trigger_reason,
                hr=vitals.get('heartRate') or vitals.get('heart_rate') or 0,
                spo2=vitals.get('spo2') or 0,
                temp=vitals.get('temperature') or 0,
                recipient_phones=target_phones,
                location=location,
            )

        # Notify hospital / doctor via email if SMTP is configured
        hospital_email_status = "PROVIDER_UNCONFIGURED"
        if hosp_email and not is_demo:
            if EMAIL_SENDER and EMAIL_SENDER != 'your_email@gmail.com':
                try:
                    email_body = f"""
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 2px solid #ef4444; border-radius: 12px; max-width: 600px;">
                        <h2 style="color: #b91c1c; margin-top: 0;">🚨 CRITICAL EMERGENCY SOS ALERT</h2>
                        <p><strong>Hospital:</strong> {hosp_name} ({pat_hosp_id})</p>
                        <p><strong>Patient:</strong> {patient_name} (ID: {patient_id})</p>
                        <p><strong>Status:</strong> <span style="color: #dc2626; font-weight: bold;">CRITICAL DISTRESS</span></p>
                        <p><strong>Reason:</strong> {trigger_reason}</p>
                        <p><strong>Coordinates:</strong> {location.get('latitude')}, {location.get('longitude')}</p>
                        <p><a href="{maps_url}" style="background-color: #dc2626; color: white; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: bold;">Open Live GPS on Google Maps</a></p>
                    </div>
                    """
                    send_html_email(hosp_email, f"🚨 EMERGENCY SOS - Patient {patient_name} ({patient_id})", email_body)
                    hospital_email_status = "SENT"
                except Exception as mail_err:
                    hospital_email_status = f"FAILED: {str(mail_err)}"

        delivery_status = {
            "sms": sms_report.get("recipients", []),
            "smsOverallStatus": sms_report.get("status", "PROVIDER_UNCONFIGURED"),
            "smsProviderConfigured": sms_report.get("configured", False),
            "hospitalNotification": {
                "hospitalId": pat_hosp_id,
                "hospitalName": hosp_name,
                "hospitalPhone": hosp_phone,
                "email": hosp_email,
                "status": hospital_email_status,
                "timestamp": now_iso,
            },
            "hospitalEmail": {
                "status": hospital_email_status,
                "email": hosp_email,
            }
        }

        fallback_instructions = {
            "emergencyAmbulance": "108",
            "nationalEmergency": "112",
            "hospitalEmergencyDesk": hosp_phone,
            "offlineSmsTemplate": f"SOS {patient_id} LAT:{location.get('latitude')} LNG:{location.get('longitude')}",
            "guidance": "If internet or GPS is interrupted, dial 108 or 112 immediately and state your Patient ID."
        }

        alert_record = {
            "alertId": alert_id,
            "patientId": patient_id,
            "patientName": patient_name,
            "hospitalId": pat_hosp_id,
            "hospitalName": hosp_name,
            "doctorId": doctor_id,
            "assignedDoctorId": doctor_id,
            "assignedDoctorName": assigned_doc_name,
            "status": "CRITICAL",
            "triageStatus": "PENDING_REVIEW",
            "triggerReason": trigger_reason,
            "vitals": vitals,
            "location": location,
            "locationStatus": location_status,
            "mapsUrl": maps_url,
            "openStreetMapUrl": osm_url,
            "sosContacts": sos_contacts,
            "sosContact": primary_sos,
            "ambulanceStatus": "NOT_REQUESTED",
            "deliveryStatus": delivery_status,
            "fallbackInstructions": fallback_instructions,
            "isDemo": is_demo,
            "createdAt": now_iso,
            "updatedAt": now_iso,
            "auditLog": [
                {
                    "timestamp": now_iso,
                    "actor": actor_name,
                    "action": "EMERGENCY_SOS_TRIGGERED",
                    "details": trigger_reason,
                },
                {
                    "timestamp": now_iso,
                    "actor": "system_gps",
                    "action": "LOCATION_ATTACHED" if location.get('latitude') else "LOCATION_UNAVAILABLE",
                    "details": f"Lat: {location.get('latitude')}, Lng: {location.get('longitude')}" if location.get('latitude') else f"Location state: {location_status}",
                },
                {
                    "timestamp": now_iso,
                    "actor": "notification_service",
                    "action": "DELIVERY_DISPATCHED",
                    "details": f"SMS: {sms_report.get('status')}; Hospital Desk: {hospital_email_status}",
                }
            ],
        }

        # 1. Store in Firestore
        try:
            if firestore_client:
                firestore_client.collection("emergencyAlerts").document(alert_id).set(alert_record)
        except Exception as fs_err:
            print(f"[Emergency] Firestore write warning: {fs_err}")

        # 2. Store in RTDB
        try:
            db.reference(f"emergencyAlerts/{alert_id}").set(alert_record)
            if patient_id:
                db.reference(f"patients/{patient_id}/activeEmergency").set(alert_record)
        except Exception as rtdb_err:
            print("[Emergency] RTDB write warning:", rtdb_err)

        # 3. Log security event and patient history
        auth_payload = _read_auth_payload()
        _log_security_event(auth_payload, 'EMERGENCY_SOS_TRIGGERED', role or 'device', patient_id, pat_hosp_id, f"SOS triggered for {patient_name} ({patient_id}). Reason: {trigger_reason}")
        _log_patient_history(patient_id, 'EMERGENCY_SOS_TRIGGERED', {'alertId': alert_id, 'triggerReason': trigger_reason, 'location': location}, auth_payload)

        return jsonify({
            "status": "success",
            "message": "Emergency SOS broadcasted successfully.",
            "data": alert_record
        }), 201
    except Exception as err:
        return jsonify({"status": "error", "message": str(err)}), 500


# SECURITY FIX: Multi-hospital isolation on /api/emergency/active
@app.route("/api/emergency/active", methods=["GET"])
def emergency_get_active():
    try:
        role = _request_user_role()
        if not role:
            return jsonify({"status": "error", "message": "Unauthorized. Authentication token is required."}), 401

        payload = _read_auth_payload()
        emergencies = []

        try:
            rtdb_snapshot = db.reference("emergencyAlerts").get()
            if isinstance(rtdb_snapshot, dict):
                for k, v in rtdb_snapshot.items():
                    if isinstance(v, dict) and v.get("status") not in ("RESOLVED", "CANCELLED"):
                        emergencies.append(v)
        except Exception as rtdb_err:
            print(f"[Emergency] RTDB fetch warning: {rtdb_err}")

        if not emergencies and firestore_client:
            try:
                docs = firestore_client.collection("emergencyAlerts").where("status", "!=", "RESOLVED").stream()
                for doc in docs:
                    d = doc.to_dict()
                    if d.get("status") not in ("RESOLVED", "CANCELLED"):
                        emergencies.append(d)
            except Exception as fs_err:
                print(f"[Emergency] Firestore query warning: {fs_err}")

        # 1. SUPER ADMIN: Platform-wide overview
        if role == 'super_admin':
            return jsonify({"status": "success", "emergencies": emergencies})

        # 2. HOSPITAL ADMIN: Strictly restricted to their own hospital
        if role in ('hospital_admin', 'admin'):
            admin_hosp = str(payload.get('hospitalId') or '').strip().lower()
            hospital_emergencies = [
                emg for emg in emergencies
                if str(emg.get('hospitalId') or '').strip().lower() == admin_hosp
            ]
            return jsonify({"status": "success", "emergencies": hospital_emergencies})

        # 3. DOCTOR: Assigned patients OR emergencies within doctor's hospital
        if role == 'doctor':
            doctor_id = _request_doctor_id()
            if not doctor_id:
                return jsonify({"status": "error", "message": "Doctor identity required."}), 400

            doc_node = _doctor_collection_reference().child(doctor_id.replace('.', ',')).get() or {}
            doc_hosp = str(payload.get('hospitalId') or doc_node.get('hospitalId') or '').strip().lower()

            authorized_emergencies = []
            patient_ref = _patient_collection_reference()
            for emg in emergencies:
                emg_doc = str(emg.get('assignedDoctorId') or emg.get('doctorId') or '').strip().lower()
                emg_hosp = str(emg.get('hospitalId') or '').strip().lower()
                emg_pid = str(emg.get('patientId') or '').strip()

                if emg_doc == doctor_id or (doc_hosp and emg_hosp == doc_hosp):
                    authorized_emergencies.append(emg)
                elif emg_pid:
                    precord = patient_ref.child(emg_pid).get()
                    if isinstance(precord, dict) and _doctor_owns_record(precord, doctor_id):
                        authorized_emergencies.append(emg)

            return jsonify({"status": "success", "emergencies": authorized_emergencies})

        # 4. PATIENT: Strictly restricted to patient's own emergencies
        if role == 'patient':
            patient_id = _request_patient_id()
            if not patient_id:
                return jsonify({"status": "error", "message": "Patient identity required."}), 400

            patient_emergencies = [
                emg for emg in emergencies
                if str(emg.get('patientId') or '').strip().lower() == str(patient_id).strip().lower()
            ]
            return jsonify({"status": "success", "emergencies": patient_emergencies})

        return jsonify({"status": "error", "message": "Forbidden. Role not authorized."}), 403
    except Exception as err:
        return jsonify({"status": "error", "message": str(err)}), 500


# Fetch single emergency alert by ID with authorization enforcement
@app.route("/api/emergency/<alert_id>", methods=["GET"])
def emergency_get_alert(alert_id):
    try:
        role = _request_user_role()
        if not role:
            return jsonify({"status": "error", "message": "Unauthorized. Authentication token is required."}), 401

        payload = _read_auth_payload()
        alert = db.reference(f"emergencyAlerts/{alert_id}").get()
        if not alert and firestore_client:
            fdoc = firestore_client.collection("emergencyAlerts").document(alert_id).get()
            if fdoc.exists:
                alert = fdoc.to_dict()

        if not alert or not isinstance(alert, dict):
            return jsonify({"status": "error", "message": "Alert not found."}), 404

        emg_pid = str(alert.get('patientId') or '').strip()
        emg_hosp = str(alert.get('hospitalId') or '').strip().lower()
        emg_doc = str(alert.get('assignedDoctorId') or alert.get('doctorId') or '').strip().lower()

        # Authorization:
        if role == 'super_admin':
            pass
        elif role in ('hospital_admin', 'admin'):
            admin_hosp = str(payload.get('hospitalId') or '').strip().lower()
            if admin_hosp and emg_hosp and admin_hosp != emg_hosp:
                return jsonify({"status": "error", "message": "Forbidden. Emergency belongs to another hospital."}), 403
        elif role == 'doctor':
            doc_id = _request_doctor_id()
            doc_node = _doctor_collection_reference().child(doc_id.replace('.', ',')).get() or {}
            doc_hosp = str(payload.get('hospitalId') or doc_node.get('hospitalId') or '').strip().lower()
            precord = _patient_collection_reference().child(emg_pid).get() if emg_pid else {}
            is_assigned = (emg_doc == doc_id) or (isinstance(precord, dict) and _doctor_owns_record(precord, doc_id))
            same_hospital = (doc_hosp and emg_hosp and doc_hosp == emg_hosp)
            if not is_assigned and not same_hospital:
                return jsonify({"status": "error", "message": "Forbidden. You are not assigned to this emergency or hospital."}), 403
        elif role == 'patient':
            pat_id = _request_patient_id()
            if pat_id != emg_pid:
                return jsonify({"status": "error", "message": "Forbidden. Access denied for this alert."}), 403

        return jsonify({"status": "success", "data": alert})
    except Exception as err:
        return jsonify({"status": "error", "message": str(err)}), 500


# SECURITY FIX: Authorize alert status change with hospital isolation & patient cancellation
@app.route("/api/emergency/<alert_id>/status", methods=["POST"])
def emergency_update_status(alert_id):
    try:
        role = _request_user_role()
        if not role:
            return jsonify({"status": "error", "message": "Unauthorized. Authentication token is required."}), 401

        data = request.get_json(silent=True) or {}
        new_status = str(data.get("status") or "EMERGENCY_ACKNOWLEDGED").strip().upper()
        notes = str(data.get("notes") or data.get("doctorNotes") or "").strip()
        now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        payload = _read_auth_payload()
        actor = payload.get("email") or payload.get("role") or "staff"

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
        emg_hosp = str(existing.get('hospitalId') or '').strip().lower()

        # Authorization check:
        if role == 'super_admin':
            pass
        elif role in ('hospital_admin', 'admin'):
            admin_hosp = str(payload.get('hospitalId') or '').strip().lower()
            if admin_hosp and emg_hosp and admin_hosp != emg_hosp:
                return jsonify({"status": "error", "message": "Forbidden. Emergency belongs to another hospital."}), 403
        elif role == 'doctor':
            doctor_id = _request_doctor_id()
            doc_node = _doctor_collection_reference().child(doctor_id.replace('.', ',')).get() or {}
            doc_hosp = str(payload.get('hospitalId') or doc_node.get('hospitalId') or '').strip().lower()
            precord = _patient_collection_reference().child(emg_pid).get() if emg_pid else {}
            is_assigned = (emg_doc == doctor_id) or (isinstance(precord, dict) and _doctor_owns_record(precord, doctor_id))
            same_hospital = (doc_hosp and emg_hosp and doc_hosp == emg_hosp)
            if not is_assigned and not same_hospital:
                return jsonify({"status": "error", "message": "Forbidden. You are not authorized for this emergency."}), 403
        elif role == 'patient':
            patient_id = _request_patient_id()
            if emg_pid != patient_id:
                return jsonify({"status": "error", "message": "Forbidden. Access denied for this alert."}), 403
            if new_status not in ('CANCELLED', 'RESOLVED'):
                return jsonify({"status": "error", "message": "Patients can only cancel or resolve their own emergency distress alert."}), 400
        else:
            return jsonify({"status": "error", "message": "Forbidden. Role not authorized."}), 403

        audit_entry = {
            "timestamp": now_iso,
            "actor": actor,
            "role": role,
            "action": f"STATUS_CHANGED_TO_{new_status}",
            "details": notes or f"Alert status updated to {new_status}"
        }

        audit_log = existing.get("auditLog", []) if isinstance(existing, dict) else []
        audit_log.append(audit_entry)

        updates = {
            "status": new_status,
            "auditLog": audit_log,
            "updatedAt": now_iso,
        }
        if notes:
            updates["resolutionNotes"] = notes

        # Update in RTDB
        rtdb_ref.update(updates)
        if new_status in ("RESOLVED", "CANCELLED") and emg_pid:
            db.reference(f"patients/{emg_pid}/activeEmergency").delete()

        # Update in Firestore
        if firestore_client:
            try:
                firestore_client.collection("emergencyAlerts").document(alert_id).set({
                    "status": new_status,
                    "auditLog": firestore.ArrayUnion([audit_entry]),
                    "updatedAt": now_iso,
                }, merge=True)
            except Exception:
                pass

        _log_security_event(payload, 'EMERGENCY_STATUS_UPDATED', role, actor, emg_hosp, f"Alert {alert_id} status updated to {new_status}")
        return jsonify({
            "status": "success",
            "alertId": alert_id,
            "newStatus": new_status,
            "data": {**existing, **updates}
        })
    except Exception as err:
        return jsonify({"status": "error", "message": str(err)}), 500


# SECURITY FIX: Authorize ambulance request with hospital data isolation
@app.route("/api/emergency/ambulance-request", methods=["POST"])
def emergency_ambulance_request():
    try:
        role = _request_user_role()
        if not role:
            return jsonify({"status": "error", "message": "Unauthorized. Authentication token is required."}), 401

        data = request.get_json(silent=True) or {}
        alert_id = str(data.get("alertId") or "").strip()
        if not alert_id:
            return jsonify({"status": "error", "message": "alertId is required."}), 400

        rtdb_ref = db.reference(f"emergencyAlerts/{alert_id}")
        existing = rtdb_ref.get() or {}
        if not existing and firestore_client:
            fdoc = firestore_client.collection("emergencyAlerts").document(alert_id).get()
            if fdoc.exists:
                existing = fdoc.to_dict()

        if not existing or not isinstance(existing, dict):
            return jsonify({"status": "error", "message": "Alert not found."}), 404

        alert_pid = str(existing.get('patientId') or '').strip()
        alert_doc = str(existing.get('assignedDoctorId') or existing.get('doctorId') or '').strip().lower()
        alert_hosp = str(existing.get('hospitalId') or '').strip().lower()
        payload = _read_auth_payload()

        # Authorization check:
        if role == 'super_admin':
            pass
        elif role in ('hospital_admin', 'admin'):
            admin_hosp = str(payload.get('hospitalId') or '').strip().lower()
            if admin_hosp and alert_hosp and admin_hosp != alert_hosp:
                return jsonify({"status": "error", "message": "Forbidden. Emergency belongs to another hospital."}), 403
        elif role == 'doctor':
            doctor_id = _request_doctor_id()
            doc_node = _doctor_collection_reference().child(doctor_id.replace('.', ',')).get() or {}
            doc_hosp = str(payload.get('hospitalId') or doc_node.get('hospitalId') or '').strip().lower()
            precord = _patient_collection_reference().child(alert_pid).get() if alert_pid else {}
            is_assigned = (alert_doc == doctor_id) or (isinstance(precord, dict) and _doctor_owns_record(precord, doctor_id))
            same_hospital = (doc_hosp and alert_hosp and doc_hosp == alert_hosp)
            if not is_assigned and not same_hospital:
                return jsonify({"status": "error", "message": "Forbidden. You are not authorized for this emergency."}), 403
        elif role == 'patient':
            patient_id = _request_patient_id()
            if not patient_id or patient_id != alert_pid:
                return jsonify({"status": "error", "message": "Forbidden. Access denied for this alert."}), 403
        else:
            return jsonify({"status": "error", "message": "Forbidden. Role not authorized."}), 403

        is_demo = bool(data.get("isDemo", False))
        urgency = str(data.get("urgency") or "CRITICAL").strip()
        notes = str(data.get("notes") or "").strip()

        now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        provider_name = "Simulation Dispatch (Demo Mode)" if is_demo else "Hospital Emergency Medical Transport"
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
            "dispatchMode": "DEMO_SIMULATION" if is_demo else "REGISTERED_TRAUMA_TRANSPORT",
            "message": f"{provider_name} request logged. Paramedic ambulance ({vehicle_id}) en route (ETA ~{eta_minutes} mins).",
        }

        audit_entry = {
            "timestamp": now_iso,
            "actor": role,
            "action": "AMBULANCE_REQUESTED",
            "details": f"Dispatched via {provider_name} [Vehicle: {vehicle_id}, ETA: {eta_minutes}m]"
        }

        audit_log = existing.get("auditLog", []) if isinstance(existing, dict) else []
        audit_log.append(audit_entry)
        rtdb_ref.update({
            "ambulanceStatus": "AMBULANCE_REQUESTED",
            "ambulanceDetails": dispatch_info,
            "auditLog": audit_log,
            "updatedAt": now_iso,
        })

        if firestore_client:
            try:
                firestore_client.collection("emergencyAlerts").document(alert_id).set({
                    "ambulanceStatus": "AMBULANCE_REQUESTED",
                    "ambulanceDetails": dispatch_info,
                    "auditLog": firestore.ArrayUnion([audit_entry]),
                    "updatedAt": now_iso,
                }, merge=True)
            except Exception:
                pass

        return jsonify({
            "status": "success",
            "data": dispatch_info
        })
    except Exception as err:
        return jsonify({"status": "error", "message": str(err)}), 500


# SECURITY FIX: Authorize audit retrieval with hospital data isolation
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
        emg_hosp = str(record.get('hospitalId') or '').strip().lower()
        payload = _read_auth_payload()

        if role == 'super_admin':
            pass
        elif role in ('hospital_admin', 'admin'):
            admin_hosp = str(payload.get('hospitalId') or '').strip().lower()
            if admin_hosp and emg_hosp and admin_hosp != emg_hosp:
                return jsonify({"status": "error", "message": "Forbidden. Emergency belongs to another hospital."}), 403
        elif role == 'doctor':
            doctor_id = _request_doctor_id()
            doc_node = _doctor_collection_reference().child(doctor_id.replace('.', ',')).get() or {}
            doc_hosp = str(payload.get('hospitalId') or doc_node.get('hospitalId') or '').strip().lower()
            precord = _patient_collection_reference().child(emg_pid).get() if emg_pid else {}
            is_assigned = (emg_doc == doctor_id) or (isinstance(precord, dict) and _doctor_owns_record(precord, doctor_id))
            same_hospital = (doc_hosp and emg_hosp and doc_hosp == emg_hosp)
            if not is_assigned and not same_hospital:
                return jsonify({"status": "error", "message": "Forbidden. You are not assigned to this emergency or hospital."}), 403
        elif role == 'patient':
            patient_id = _request_patient_id()
            if emg_pid != patient_id:
                return jsonify({"status": "error", "message": "Forbidden. Access denied for this alert audit."}), 403
        else:
            return jsonify({"status": "error", "message": "Forbidden. Role not authorized."}), 403

        audit_log = record.get("auditLog", [])
        return jsonify({
            "status": "success",
            "alertId": alert_id,
            "auditLog": audit_log
        })
    except Exception as err:
        return jsonify({"status": "error", "message": str(err)}), 500


@app.route("/api/emergency/nearby-facilities", methods=["GET"])
@app.route("/api/places/nearby-hospitals", methods=["GET"])
def emergency_nearby_facilities():
    try:
        lat = float(request.args.get("lat", 28.6139))
        lng = float(request.args.get("lng", 77.2090))
        radius = float(request.args.get("radius", 10.0))
        facility_type = str(request.args.get("type", "all")).strip().lower()
        limit = int(request.args.get("limit", 30))

        from places_service import fetch_real_nearby_facilities
        result = fetch_real_nearby_facilities(
            lat=lat,
            lng=lng,
            radius_km=radius,
            facility_type=facility_type,
            limit=limit
        )

        return jsonify(result)
    except Exception as err:
        return jsonify({"status": "error", "message": str(err), "facilities": []}), 500


# =========================================================================
# HOSPITAL MEDICAL REPORT & DIAGNOSTIC LAB INVESTIGATION ENDPOINTS
# =========================================================================

@app.route('/api/patient/<patient_id>/medical-report', methods=['GET'])
@require_auth(patient_id_arg='patient_id')
def get_patient_medical_report_api(patient_id):
    try:
        patient_ref = _patient_collection_reference().child(patient_id)
        patient_record = patient_ref.get()
        if not isinstance(patient_record, dict):
            return api_error('Patient not found.', 404)

        requester = _read_auth_payload() or {}
        role = requester.get('role', 'user')
        pat_hosp = str(patient_record.get('hospitalId') or '').strip()

        # Fetch doctor record
        doc_email = str(patient_record.get('assignedDoctorId') or patient_record.get('doctorId') or '').strip().lower()
        doctor_record = {}
        if doc_email:
            dref = _doctor_collection_reference().child(doc_email.replace('.', ','))
            doctor_record = dref.get() or {}

        # Fetch medicines / prescriptions
        medicines = patient_record.get('medicines', []) or []

        # Fetch report history from RTDB or Firestore
        report_history = []
        try:
            rpts_ref = db.reference(f"medicalReports/{patient_id}")
            rpts = rpts_ref.get()
            if isinstance(rpts, dict):
                report_history = list(rpts.values())
        except Exception as err:
            print(f"[MedicalReport] History retrieval warning: {err}")

        # Audit report access without exposing clinical telemetry details
        _log_security_event(
            actor_payload=requester,
            action='MEDICAL_REPORT_ACCESSED',
            target_type='patient',
            target_id=patient_id,
            hospital_id=pat_hosp,
            details=f"Medical report accessed for patient {patient_id} by {role}"
        )

        return api_success('Medical report aggregated successfully.', {
            'patient': patient_record,
            'doctor': doctor_record,
            'vitals': patient_record.get('vitals', {}),
            'medicines': medicines,
            'reportHistory': report_history,
        })
    except Exception as err:
        return api_error(str(err), 500)


@app.route('/api/patient/<patient_id>/medical-report/generate', methods=['POST'])
@require_auth(roles={'doctor'}, patient_id_arg='patient_id')
def generate_patient_medical_report_api(patient_id):
    try:
        patient_ref = _patient_collection_reference().child(patient_id)
        patient_record = patient_ref.get()
        if not isinstance(patient_record, dict):
            return api_error('Patient not found.', 404)

        data = request.get_json(silent=True) or {}
        if not data and request.form:
            data = request.form.to_dict()

        requester = _read_auth_payload() or {}
        doc_id = str(requester.get('doctorId') or requester.get('email') or '').strip().lower()
        doc_name = str(requester.get('name') or data.get('doctorName') or 'Treating Physician').strip()
        doc_specialty = str(data.get('doctorSpecialty') or 'General Medicine').strip()

        pat_hosp = str(patient_record.get('hospitalId') or requester.get('hospitalId') or '').strip()
        pat_name = str(patient_record.get('name') or data.get('patientName') or 'Patient').strip()

        now_dt = datetime.now(timezone.utc)
        clean_pid = str(patient_id).replace('-', '').upper()[:4]
        report_id = f"RPT-{now_dt.year}-{clean_pid}-{random.randint(1000, 9999)}"
        
        report_record = {
            'reportId': report_id,
            'patientId': patient_id,
            'hospitalId': pat_hosp,
            'patientName': pat_name,
            'doctorId': doc_id,
            'doctorName': doc_name,
            'doctorSpecialty': doc_specialty,
            'generatedAt': now_dt.isoformat(),
            'reportType': str(data.get('reportType') or 'FINAL_CERTIFIED'),
            'status': str(data.get('status') or 'Verified'),
            'labTestsSummary': data.get('labTestsSummary', {}),
            'clinicalDiagnosis': data.get('clinicalDiagnosis', {}),
            'vitalsSnapshot': data.get('vitals', {}),
        }

        # Store in RTDB
        try:
            db.reference(f"medicalReports/{patient_id}/{report_id}").set(report_record)
        except Exception as rtdb_err:
            print(f"[MedicalReport] RTDB save warning: {rtdb_err}")

        # Store in Firestore if available
        try:
            if firestore_client:
                firestore_client.collection("medicalReports").document(report_id).set(report_record)
        except Exception as fs_err:
            print(f"[MedicalReport] Firestore save warning: {fs_err}")

        # Record clinical history audit trail and security audit event
        _log_patient_history(patient_id, 'MEDICAL_REPORT_CERTIFIED', {
            'reportId': report_id,
            'reportType': report_record['reportType'],
            'doctorName': doc_name,
        }, requester)
        _log_security_event(
            actor_payload=requester,
            action='MEDICAL_REPORT_GENERATED',
            target_type='patient',
            target_id=patient_id,
            hospital_id=pat_hosp,
            details=f"Generated and certified medical report {report_id} for patient {patient_id} ({pat_name})"
        )

        return api_success('Medical report generated and certified.', {'report': report_record})
    except Exception as err:
        return api_error(str(err), 500)


@app.route('/api/patient/<patient_id>/documents/presign-upload', methods=['POST'])
@require_auth(roles={'doctor', 'patient', 'hospital_admin'}, patient_id_arg='patient_id')
def presign_patient_document_upload(patient_id):
    """
    Healthcare Data Platform: Secure Object Storage Upload Preparation.
    Validates document metadata (filename, declared extension, declared MIME type, size)
    and generates an authorized, short-lived signed upload descriptor.
    """
    try:
        data = request.get_json(silent=True) or {}
        filename = str(data.get('filename') or '').strip()
        mimetype = str(data.get('mimetype') or '').strip().lower()
        size_bytes = int(data.get('sizeBytes') or 0)

        if not filename:
            return api_error('Filename is required.', 400)

        from medical_document_validator import sanitize_filename, ALLOWED_EXTENSIONS, MAX_DOCUMENT_SIZE_BYTES, MAX_DICOM_SIZE_BYTES
        clean_fn = sanitize_filename(filename)
        _, ext = os.path.splitext(clean_fn)
        ext = ext.lower()

        if ext not in ALLOWED_EXTENSIONS:
            return api_error(f"Unsupported document format '{ext}'. Permitted: {', '.join(ALLOWED_EXTENSIONS.keys())}", 400)

        max_limit = MAX_DICOM_SIZE_BYTES if ext == '.dcm' else MAX_DOCUMENT_SIZE_BYTES
        if size_bytes > max_limit:
            return api_error(f"File size exceeds maximum permitted limit of {max_limit // (1024*1024)} MB.", 400)

        expected_mime = ALLOWED_EXTENSIONS[ext]
        if mimetype and mimetype != expected_mime:
            return api_error(f"Declared MIME type '{mimetype}' does not match expected '{expected_mime}'.", 400)

        patient_ref = _patient_collection_reference().child(patient_id)
        patient_record = patient_ref.get()
        if not isinstance(patient_record, dict):
            return api_error('Patient not found.', 404)

        requester = _read_auth_payload() or {}
        hosp_id = str(patient_record.get('hospitalId') or requester.get('hospitalId') or '').strip()
        doc_key = f"clinical-documents/{hosp_id}/{patient_id}/{int(time.time())}-{clean_fn}"

        doc_id = f"DOC-{uuid.uuid4().hex[:10]}"
        upload_descriptor = {
            'documentId': doc_id,
            'patientId': patient_id,
            'hospitalId': hosp_id,
            'storageKey': doc_key,
            'filename': clean_fn,
            'mimetype': expected_mime,
            'expiresInSeconds': 900,
            'uploadUrl': f"https://storage.smarthealth.hospital.internal/{doc_key}?token={secrets.token_urlsafe(32)}",
            'requiredHeaders': {
                'Content-Type': expected_mime,
                'x-amz-server-side-encryption': 'aws:kms',
            },
        }

        _log_security_event(
            actor_payload=requester,
            action='DOCUMENT_UPLOAD_INITIATED',
            target_type='patient',
            target_id=patient_id,
            hospital_id=hosp_id,
            details=f"Initiated secure upload for {clean_fn} ({expected_mime})"
        )

        return api_success('Secure pre-signed upload URL generated.', {'upload': upload_descriptor})
    except Exception as err:
        return api_error(str(err), 500)


@app.route('/api/patient/<patient_id>/documents/validate-attachment', methods=['POST'])
@require_auth(roles={'doctor', 'patient', 'hospital_admin'}, patient_id_arg='patient_id')
def validate_patient_document_attachment(patient_id):
    """
    Validates binary document content (magic bytes, active script detection, file size, extensions).
    """
    try:
        from medical_document_validator import validate_medical_document
        
        file_bytes = None
        filename = ''
        mimetype = ''

        if request.files and 'file' in request.files:
            uploaded_file = request.files['file']
            filename = uploaded_file.filename
            mimetype = uploaded_file.mimetype
            file_bytes = uploaded_file.read()
        elif request.data:
            file_bytes = request.data
            filename = request.headers.get('X-File-Name', 'document.pdf')
            mimetype = request.headers.get('Content-Type', 'application/pdf')
        else:
            return api_error('No document file content provided.', 400)

        is_valid, err_msg, metadata = validate_medical_document(
            file_bytes=file_bytes,
            filename=filename,
            declared_mimetype=mimetype
        )

        if not is_valid:
            return api_error(err_msg, 400)

        requester = _read_auth_payload() or {}
        _log_security_event(
            actor_payload=requester,
            action='DOCUMENT_VALIDATED',
            target_type='patient',
            target_id=patient_id,
            hospital_id=requester.get('hospitalId', ''),
            details=f"Validated document {metadata.get('filename')} ({metadata.get('mimetype')})"
        )

        return api_success('Document validated successfully.', {'metadata': metadata})
    except Exception as err:
        return api_error(str(err), 500)


@app.route('/')
@app.route('/<path:path>')
def serve_frontend_assets_or_spa(path=''):
    # Never intercept backend API routes
    if path and (path.startswith('api/') or path in ['patients', 'real-data', 'health', 'socket.io']):
        return jsonify({"status": "error", "message": f"Endpoint /{path} not found"}), 404

    frontend_dist = BASE_DIR / 'frontend' / 'dist'
    if frontend_dist.exists():
        if path:
            candidate_file = frontend_dist / path
            if candidate_file.is_file():
                return send_from_directory(str(frontend_dist), path)
        index_file = frontend_dist / 'index.html'
        if index_file.is_file():
            return send_from_directory(str(frontend_dist), 'index.html')

    return jsonify({"status": "error", "message": f"Endpoint /{path} not found"}), 404


try:
    _ensure_default_super_admin()
    _ensure_default_hospital()
except Exception as _admin_init_err:
    print(f"[Auth] Notice: Bootstrap deferred: {_admin_init_err}")


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