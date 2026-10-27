import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app as backend_app
from werkzeug.security import generate_password_hash


class FakeRef:
    def __init__(self, store, path=()):
        self.store = store
        self.path = tuple(path)

    def child(self, key):
        return FakeRef(self.store, self.path + (str(key),))

    def get(self):
        node = self.store
        for segment in self.path:
            if not isinstance(node, dict) or segment not in node:
                return None
            node = node[segment]
        return node

    def set(self, value):
        if not self.path:
            raise ValueError("Root set is not supported in this fake.")
        node = self.store
        for segment in self.path[:-1]:
            node = node.setdefault(segment, {})
        node[self.path[-1]] = value

    def update(self, payload):
        existing = self.get()
        if not isinstance(existing, dict):
            existing = {}
            self.set(existing)
        existing.update(payload or {})


@pytest.fixture()
def db_store():
    return {
        "admins": {
            "ADMIN-ROOT-001": {
                "id": "ADMIN-ROOT-001",
                "email": "superadmin@smarthealth.io",
                "name": "Super Admin",
                "role": "super_admin",
                "passwordHash": generate_password_hash("SuperAdminPass123!"),
                "isActive": True,
            },
        },
        "hospitals": {
            "HOSP-CITY-01": {
                "id": "HOSP-CITY-01",
                "hospitalId": "HOSP-CITY-01",
                "name": "City General Medical Center",
                "city": "New Delhi",
                "phone": "+911140001000",
                "email": "care@citygeneral.org",
                "isActive": True,
            },
        },
        "doctor": {
            "dr,rao@citygeneral,org": {
                "id": "DOC-CITY-01",
                "doctorId": "DOC-CITY-01",
                "email": "dr.rao@citygeneral.org",
                "name": "Dr. Ramesh Rao",
                "role": "doctor",
                "hospitalId": "HOSP-CITY-01",
                "specialty": "Cardiology",
                "phone": "+919876543210",
                "passwordHash": generate_password_hash("DoctorPass123!"),
                "isActive": True,
            },
        },
        "patient": {
            "PAT-001": {
                "id": "PAT-001",
                "patientId": "PAT-001",
                "name": "Aarav Sharma",
                "email": "aarav.sharma@example.com",
                "phone": "+919123456789",
                "hospitalId": "HOSP-CITY-01",
                "assignedDoctorId": "DOC-CITY-01",
                "assignedDoctorName": "Dr. Ramesh Rao",
                "doctorId": "dr.rao@citygeneral.org",
                "emergencyContact": "Sunita Sharma",
                "emergencyPhone": "+919876543210",
                "bloodGroup": "B+",
                "allergies": "Penicillin",
                "address": "Civil Lines, Delhi",
                "passwordHash": generate_password_hash("PatientPass123!"),
                "isActive": True,
                "deviceConnected": True,
                "vitals": {
                    "heart_rate": 74.0,
                    "spo2": 98.5,
                    "temperature": 36.8,
                },
                "systolicBP": 120,
                "diastolicBP": 80,
                "medicines": [
                    {
                        "id": "MED-1",
                        "medicineName": "Amlodipine",
                        "dosage": "5mg",
                        "frequency": "Once daily",
                        "status": "active",
                    }
                ],
                "notifications": [
                    {
                        "id": "NOTIF-1",
                        "title": "Cardiology Follow-up",
                        "message": "Routine OPD visit on Monday",
                        "read": False,
                    }
                ],
            },
            "PAT-002": {
                "id": "PAT-002",
                "patientId": "PAT-002",
                "name": "Diya Verma",
                "email": "diya.verma@example.com",
                "phone": "+919888877777",
                "hospitalId": "HOSP-CITY-01",
                "assignedDoctorId": "DOC-CITY-01",
                "passwordHash": generate_password_hash("PatientPass123!"),
                "isActive": True,
            },
        },
        "appointments": {
            "APT-001": {
                "id": "APT-001",
                "appointmentId": "APT-001",
                "patientId": "PAT-001",
                "patientName": "Aarav Sharma",
                "hospitalId": "HOSP-CITY-01",
                "doctorId": "DOC-CITY-01",
                "doctorName": "Dr. Ramesh Rao",
                "appointmentDate": "2026-11-15",
                "appointmentTime": "10:30 AM",
                "status": "scheduled",
                "department": "Cardiology",
            }
        },
        "patientHistory": {},
        "security_audit_logs": {},
    }


@pytest.fixture()
def client(monkeypatch, db_store):
    monkeypatch.setattr(backend_app, "_admin_collection_reference", lambda: FakeRef(db_store).child("admins"))
    monkeypatch.setattr(backend_app, "_hospitals_collection_reference", lambda: FakeRef(db_store).child("hospitals"))
    monkeypatch.setattr(backend_app, "_doctor_collection_reference", lambda: FakeRef(db_store).child("doctor"))
    monkeypatch.setattr(backend_app, "_patient_collection_reference", lambda: FakeRef(db_store).child("patient"))
    monkeypatch.setattr(backend_app, "_appointments_collection_reference", lambda: FakeRef(db_store).child("appointments"))
    monkeypatch.setattr(backend_app, "_security_audit_reference", lambda: FakeRef(db_store).child("security_audit_logs"))
    monkeypatch.setattr(backend_app, "_patient_history_reference", lambda pid: FakeRef(db_store).child("patientHistory").child(pid))

    class FakeDB:
        @staticmethod
        def reference(path):
            return FakeRef(db_store).child(path)

    monkeypatch.setattr(backend_app, "db", FakeDB)

    backend_app.app.config["TESTING"] = True
    return backend_app.app.test_client()


def _auth_header(role, **kwargs):
    payload = {"role": role, **kwargs}
    token = backend_app._issue_auth_token(payload)["token"]
    return {"Authorization": f"Bearer {token}"}


def test_patient_portal_summary_access(client):
    headers = _auth_header("patient", id="PAT-001", patientId="PAT-001", email="aarav.sharma@example.com")

    resp = client.get("/api/patient/PAT-001/portal-summary", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "success"
    payload = data["data"]

    # Verify summary contents
    assert payload["patient"]["id"] == "PAT-001"
    assert "passwordHash" not in payload["patient"]
    assert payload["hospital"]["name"] == "City General Medical Center"
    assert payload["doctor"]["name"] == "Dr. Ramesh Rao"
    assert len(payload["upcomingAppointments"]) == 1
    assert len(payload["activePrescriptions"]) == 1
    assert payload["measurements"]["heartRate"]["value"] == 74.0
    assert payload["measurements"]["heartRate"]["source"] == "device-generated"


def test_cross_patient_access_forbidden(client):
    # Patient PAT-001 trying to access PAT-002 summary
    headers = _auth_header("patient", id="PAT-001", patientId="PAT-001", email="aarav.sharma@example.com")

    resp = client.get("/api/patient/PAT-002/portal-summary", headers=headers)
    assert resp.status_code == 403
    assert "access denied" in resp.get_json()["message"].lower() or "forbidden" in resp.get_json()["message"].lower()


def test_patient_profile_update(client, db_store):
    headers = _auth_header("patient", id="PAT-001", patientId="PAT-001", email="aarav.sharma@example.com")

    update_payload = {
        "emergencyContact": "Sunita Sharma (Mother)",
        "emergencyPhone": "+919876543299",
        "allergies": "Penicillin and Sulfa Drugs",
        "address": "Model Town, New Delhi",
    }

    resp = client.put("/api/patient/PAT-001/profile", json=update_payload, headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "success"

    # Verify updated in store
    patient_record = db_store["patient"]["PAT-001"]
    assert patient_record["emergencyContact"] == "Sunita Sharma (Mother)"
    assert patient_record["emergencyPhone"] == "+919876543299"
    assert patient_record["allergies"] == "Penicillin and Sulfa Drugs"


def test_patient_medical_history_read_only(client):
    headers = _auth_header("patient", id="PAT-001", patientId="PAT-001", email="aarav.sharma@example.com")

    resp = client.get("/api/patient/PAT-001/medical-history", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["data"]["isReadOnly"] is True

    # Patient trying to record consultation fails with 403
    cons_payload = {
        "diagnosis": "Self-diagnosed condition",
        "symptoms": "Headache",
    }
    resp_mutate = client.post("/api/doctor/DOC-CITY-01/patient/PAT-001/consultations", json=cons_payload, headers=headers)
    assert resp_mutate.status_code == 403


def test_patient_book_and_cancel_appointment(client, db_store):
    headers = _auth_header("patient", id="PAT-001", patientId="PAT-001", email="aarav.sharma@example.com")

    # Book appointment
    book_payload = {
        "patientId": "PAT-001",
        "patientName": "Aarav Sharma",
        "hospitalId": "HOSP-CITY-01",
        "doctorId": "DOC-CITY-01",
        "appointmentDate": "2026-11-20",
        "appointmentTime": "02:00 PM",
        "department": "Cardiology",
        "notes": "Follow-up ECG check",
    }
    resp_book = client.post("/api/hospital/appointments", json=book_payload, headers=headers)
    assert resp_book.status_code == 201
    apt_data = resp_book.get_json()["data"]["appointment"]
    apt_id = apt_data["id"]

    # Cancel the appointment
    resp_cancel = client.put(f"/api/hospital/appointments/{apt_id}/status", json={"status": "cancelled"}, headers=headers)
    assert resp_cancel.status_code == 200
    assert db_store["appointments"][apt_id]["status"] == "cancelled"


def test_manual_vitals_logging_validation(client, db_store):
    headers = _auth_header("patient", id="PAT-001", patientId="PAT-001", email="aarav.sharma@example.com")

    # Invalid vitals (Heart rate out of range)
    invalid_payload = {
        "heartRate": 290,  # exceeds 220 bpm limit
        "spo2": 98,
        "temperature": 37.0,
    }
    resp_bad = client.post("/api/patient/PAT-001/manual-vitals", json=invalid_payload, headers=headers)
    assert resp_bad.status_code == 400

    # Valid vitals
    valid_payload = {
        "heartRate": 78,
        "spo2": 99,
        "temperature": 36.9,
        "systolicBP": 118,
        "diastolicBP": 78,
        "bloodGlucose": 92,
        "notes": "Post morning brisk walk",
    }
    resp_good = client.post("/api/patient/PAT-001/manual-vitals", json=valid_payload, headers=headers)
    assert resp_good.status_code == 201
    assert len(db_store["patient"]["PAT-001"]["manualVitals"]) == 1


def test_bilingual_ai_health_assistant(client):
    headers = _auth_header("patient", id="PAT-001", patientId="PAT-001", email="aarav.sharma@example.com")

    # Test emergency detection in Hinglish
    emg_payload = {
        "query": "Mujhe bohot tezz seene me dard ho raha hai aur saans lene me takleef hai",
        "language": "hinglish",
    }
    resp_emg = client.post("/api/patient/ai-health-assistant", json=emg_payload, headers=headers)
    assert resp_emg.status_code == 200
    data_emg = resp_emg.get_json()["data"]
    assert data_emg["isEmergency"] is True
    assert "108" in data_emg["response"]

    # Test BP guidance in Hindi
    bp_payload = {
        "query": "Normal blood pressure kitna hota hai?",
        "language": "hindi",
    }
    resp_bp = client.post("/api/patient/ai-health-assistant", json=bp_payload, headers=headers)
    assert resp_bp.status_code == 200
    data_bp = resp_bp.get_json()["data"]
    assert data_bp["isEmergency"] is False
    assert "120/80" in data_bp["response"]
    assert "safetyDisclaimer" in data_bp


def test_patient_notifications(client, db_store):
    headers = _auth_header("patient", id="PAT-001", patientId="PAT-001", email="aarav.sharma@example.com")

    resp = client.get("/api/patient/PAT-001/notifications", headers=headers)
    assert resp.status_code == 200
    assert len(resp.get_json()["data"]["notifications"]) == 1

    resp_read = client.post("/api/patient/PAT-001/notifications/NOTIF-1/read", headers=headers)
    assert resp_read.status_code == 200
    assert db_store["patient"]["PAT-001"]["notifications"][0]["read"] is True


def test_change_account_password(client):
    headers = _auth_header("patient", id="PAT-001", patientId="PAT-001", email="aarav.sharma@example.com")

    # Wrong current password
    resp_wrong = client.post("/api/auth/change-password", json={
        "currentPassword": "WrongPass123!",
        "newPassword": "NewStrongPass999!",
        "confirmPassword": "NewStrongPass999!",
    }, headers=headers)
    assert resp_wrong.status_code == 401

    # Successful change
    resp_correct = client.post("/api/auth/change-password", json={
        "currentPassword": "PatientPass123!",
        "newPassword": "NewStrongPass999!",
        "confirmPassword": "NewStrongPass999!",
    }, headers=headers)
    assert resp_correct.status_code == 200


# ==============================================================================
# PRIVACY & DATA ISOLATION REGRESSION TESTS
# ==============================================================================

def test_patient_to_patient_vitals_isolation(client):
    """Verifies Patient 1 cannot inject vitals into Patient 2's medical record."""
    headers_pat1 = _auth_header("patient", id="PAT-001", patientId="PAT-001", email="aarav.sharma@example.com")
    resp = client.post("/api/patient/PAT-002/manual-vitals", json={
        "heartRate": 75,
        "spo2": 98,
        "temperature": 37.0,
    }, headers=headers_pat1)
    assert resp.status_code == 403
    assert resp.get_json()["status"] == "error"


def test_patient_to_patient_medicines_isolation(client):
    """Verifies Patient 1 cannot access or view Patient 2's prescriptions/medications."""
    headers_pat1 = _auth_header("patient", id="PAT-001", patientId="PAT-001", email="aarav.sharma@example.com")
    resp = client.get("/api/patient/PAT-002/medicines", headers=headers_pat1)
    assert resp.status_code == 403
    assert resp.get_json()["status"] == "error"


def test_patient_to_patient_profile_update_blocked(client):
    """Verifies Patient 1 cannot tamper with or modify Patient 2's profile or emergency contacts."""
    headers_pat1 = _auth_header("patient", id="PAT-001", patientId="PAT-001", email="aarav.sharma@example.com")
    resp = client.put("/api/patient/PAT-002/profile", json={
        "emergencyContact": "Attacker (Malicious)",
        "emergencyPhone": "+919999900000",
        "allergies": "Malicious Tampering",
    }, headers=headers_pat1)
    assert resp.status_code == 403
    assert resp.get_json()["status"] == "error"


def test_unassigned_doctor_cannot_view_patient_medical_history(client):
    """Verifies unassigned doctor cannot access patient longitudinal medical history."""
    headers_unassigned_doc = _auth_header("doctor", email="dr.unassigned@example.com", doctorId="DOC-UNASSIGNED")
    resp = client.get("/api/patient/PAT-001/history", headers=headers_unassigned_doc)
    assert resp.status_code == 403
    assert resp.get_json()["status"] == "error"


def test_patient_medical_report_privacy_isolation(client):
    """Verifies Patient 2 cannot access Patient 1's aggregated medical report."""
    headers_pat2 = _auth_header("patient", id="PAT-002", patientId="PAT-002", email="priya.patel@example.com")
    resp = client.get("/api/patient/PAT-001/medical-report", headers=headers_pat2)
    assert resp.status_code == 403
    assert resp.get_json()["status"] == "error"

