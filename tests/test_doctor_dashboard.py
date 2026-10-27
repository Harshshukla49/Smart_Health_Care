import pytest
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app as backend_app
from werkzeug.security import generate_password_hash


class FakeRef:
    def __init__(self, store, path=()):
        self.store = store
        self.path = tuple(path)

    def child(self, key):
        parts = [p for p in str(key).split('/') if p]
        return FakeRef(self.store, self.path + tuple(parts))

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
            "ADMIN-CITY-01": {
                "id": "ADMIN-CITY-01",
                "email": "admin@citygeneral.org",
                "name": "City Admin",
                "role": "hospital_admin",
                "hospitalId": "HOSP-CITY-01",
                "passwordHash": generate_password_hash("AdminPass123!"),
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
            "HOSP-METRO-02": {
                "id": "HOSP-METRO-02",
                "hospitalId": "HOSP-METRO-02",
                "name": "Metro Apex Healthcare",
                "city": "Mumbai",
                "phone": "+912250002000",
                "email": "support@metroapex.org",
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
                "department": "Cardiology & Intensive Care",
                "phone": "+919876543210",
                "passwordHash": generate_password_hash("DoctorPass123!"),
                "isActive": True,
            },
            "dr,sharma@citygeneral,org": {
                "id": "DOC-CITY-02",
                "doctorId": "DOC-CITY-02",
                "email": "dr.sharma@citygeneral.org",
                "name": "Dr. Neha Sharma",
                "role": "doctor",
                "hospitalId": "HOSP-CITY-01",
                "specialty": "Neurology",
                "department": "Neurology Outpatient",
                "phone": "+919876543211",
                "passwordHash": generate_password_hash("DoctorPass123!"),
                "isActive": True,
            },
            "dr,patel@metro,org": {
                "id": "DOC-METRO-01",
                "doctorId": "DOC-METRO-01",
                "email": "dr.patel@metro.org",
                "name": "Dr. Suresh Patel",
                "role": "doctor",
                "hospitalId": "HOSP-METRO-02",
                "specialty": "General Medicine",
                "department": "Internal Medicine",
                "phone": "+919876543212",
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
                "age": 28,
                "gender": "male",
                "hospitalId": "HOSP-CITY-01",
                "assignedDoctorId": "DOC-CITY-01",
                "assignedDoctorName": "Dr. Ramesh Rao",
                "doctorId": "dr.rao@citygeneral.org",
                "bloodGroup": "B+",
                "allergies": "Penicillin",
                "isActive": True,
                "vitals": {
                    "heart_rate": 78.0,
                    "spo2": 98.2,
                    "temperature": 36.9,
                },
                "consultations": [
                    {
                        "id": "CONS-101",
                        "doctorName": "Dr. Ramesh Rao",
                        "doctorId": "dr.rao@citygeneral.org",
                        "date": "2026-10-10",
                        "symptoms": "Occasional palpitations post-exertion",
                        "diagnosis": "Mild sinus tachycardia",
                        "treatmentPlan": "Hydration and stress reduction",
                    }
                ],
                "medicines": [
                    {
                        "id": "MED-001",
                        "medicineName": "Metoprolol",
                        "dosage": "25mg",
                        "frequency": "Once daily",
                        "duration": "30 Days",
                        "instructions": "Take in morning after breakfast",
                        "status": "Active",
                        "revisionNumber": 1,
                        "revisionHistory": [],
                    }
                ],
                "testReports": [
                    {
                        "id": "REP-201",
                        "title": "Lipid Panel",
                        "status": "Released",
                        "date": "2026-10-12",
                    }
                ],
            },
            "PAT-002": {
                "id": "PAT-002",
                "patientId": "PAT-002",
                "name": "Diya Verma",
                "email": "diya.verma@example.com",
                "phone": "+919888877777",
                "age": 34,
                "gender": "female",
                "hospitalId": "HOSP-CITY-01",
                "assignedDoctorId": "DOC-CITY-02",
                "assignedDoctorName": "Dr. Neha Sharma",
                "doctorId": "dr.sharma@citygeneral.org",
                "bloodGroup": "O+",
                "isActive": True,
                "consultations": [
                    {
                        "id": "CONS-202",
                        "doctorName": "Dr. Neha Sharma",
                        "doctorId": "dr.sharma@citygeneral.org",
                        "symptoms": "Frequent migraine attacks",
                        "diagnosis": "Migraine without aura",
                    }
                ],
            },
            "PAT-003": {
                "id": "PAT-003",
                "patientId": "PAT-003",
                "name": "Karan Malhotra",
                "email": "karan.m@example.com",
                "phone": "+919777766666",
                "age": 45,
                "gender": "male",
                "hospitalId": "HOSP-METRO-02",
                "assignedDoctorId": "DOC-METRO-01",
                "assignedDoctorName": "Dr. Suresh Patel",
                "doctorId": "dr.patel@metro.org",
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
                "appointmentDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "appointmentTime": "11:00 AM",
                "status": "scheduled",
                "department": "Cardiology",
            }
        },
        "emergencyAlerts": {
            "ALT-001": {
                "id": "ALT-001",
                "alertId": "ALT-001",
                "patientId": "PAT-001",
                "patientName": "Aarav Sharma",
                "hospitalId": "HOSP-CITY-01",
                "type": "ARRHYTHMIA",
                "severity": "CRITICAL",
                "status": "TRIGGERED",
                "triageStatus": "PENDING_REVIEW",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "vitals": {"heartRate": 142, "spo2": 93},
            }
        },
        "emergencyAccessGrants": {},
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
            parts = [p for p in str(path).split('/') if p]
            return FakeRef(db_store, parts)

    monkeypatch.setattr(backend_app, "db", FakeDB)

    backend_app.app.config["TESTING"] = True
    return backend_app.app.test_client()


def _auth_header(role, **kwargs):
    payload = {"role": role, **kwargs}
    token = backend_app._issue_auth_token(payload)["token"]
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# 1. DOCTOR OVERVIEW
# ==============================================================================

def test_doctor_overview_endpoint(client):
    headers = _auth_header(
        "doctor",
        doctorId="DOC-CITY-01",
        email="dr.rao@citygeneral.org",
        name="Dr. Ramesh Rao",
        hospitalId="HOSP-CITY-01"
    )

    resp = client.get("/api/doctor/overview", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "success"
    doctor_data = data["data"]

    # Verify doctor profile & hospital metadata
    assert doctor_data["doctor"]["id"] == "DOC-CITY-01"
    assert doctor_data["hospital"]["id"] == "HOSP-CITY-01"
    assert doctor_data["hospital"]["name"] == "City General Medical Center"

    # Verify stats
    stats = doctor_data["stats"]
    assert stats["assignedPatients"] == 1
    assert stats["todayAppointments"] == 1
    assert "triageAlertsCount" in stats


def test_doctor_overview_unauthorized(client):
    resp = client.get("/api/doctor/overview")
    assert resp.status_code == 401


# ==============================================================================
# 2. PATIENT VISIBILITY - ACCESS LEVEL A (HOSPITAL DIRECTORY)
# ==============================================================================

def test_hospital_directory_level_a_privacy(client):
    headers = _auth_header(
        "doctor",
        doctorId="DOC-CITY-01",
        email="dr.rao@citygeneral.org",
        hospitalId="HOSP-CITY-01"
    )

    resp = client.get("/api/doctor/hospital-directory", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "success"
    patients = data["data"]["patients"]

    # Both PAT-001 and PAT-002 belong to HOSP-CITY-01
    patient_ids = [p["id"] for p in patients]
    assert "PAT-001" in patient_ids
    assert "PAT-002" in patient_ids

    # PAT-003 belongs to HOSP-METRO-02 and must NOT be in the directory
    assert "PAT-003" not in patient_ids

    # Verify Access Level A fields and privacy enforcement
    for p in patients:
        assert "id" in p
        assert "name" in p
        assert "age" in p
        assert "gender" in p
        assert "assignedDoctorName" in p
        assert "isAssignedToRequester" in p
        assert "canOpenClinicalRecord" in p

        # CRITICAL PRIVACY RULE: Strict exclusion of clinical records in Level A directory
        assert "consultations" not in p
        assert "symptoms" not in p
        assert "diagnosis" not in p
        assert "medicines" not in p
        assert "prescriptions" not in p
        assert "testReports" not in p
        assert "vitals" not in p


# ==============================================================================
# 3. PATIENT VISIBILITY - ACCESS LEVEL B (ASSIGNED CLINICAL RECORD)
# ==============================================================================

def test_assigned_doctor_can_access_clinical_record(client):
    headers = _auth_header(
        "doctor",
        doctorId="DOC-CITY-01",
        email="dr.rao@citygeneral.org",
        hospitalId="HOSP-CITY-01"
    )

    resp = client.get("/api/doctor/patient/PAT-001/clinical-record", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "success"
    record = data["data"]

    # Full clinical dossier access
    assert record["patient"]["id"] == "PAT-001"
    assert record["isAssignedDoctor"] is True
    assert record["isEmergencyGrant"] is False
    assert len(record["consultations"]) == 1
    assert record["consultations"][0]["diagnosis"] == "Mild sinus tachycardia"
    assert len(record["prescriptions"]) == 1
    assert record["prescriptions"][0]["medicineName"] == "Metoprolol"
    assert record["vitals"]["heart_rate"] == 78.0


def test_cross_doctor_access_blocked_same_hospital(client):
    # Dr. Sharma belongs to the same hospital (HOSP-CITY-01), but is NOT assigned to PAT-001
    headers = _auth_header(
        "doctor",
        doctorId="DOC-CITY-02",
        email="dr.sharma@citygeneral.org",
        hospitalId="HOSP-CITY-01"
    )

    resp = client.get("/api/doctor/patient/PAT-001/clinical-record", headers=headers)
    # Must be rejected with 403 Forbidden
    assert resp.status_code == 403


def test_cross_hospital_access_blocked(client):
    # Dr. Patel belongs to a completely different hospital (HOSP-METRO-02)
    headers = _auth_header(
        "doctor",
        doctorId="DOC-METRO-01",
        email="dr.patel@metro.org",
        hospitalId="HOSP-METRO-02"
    )

    resp = client.get("/api/doctor/patient/PAT-001/clinical-record", headers=headers)
    # Must be strictly rejected with 403 Forbidden
    assert resp.status_code == 403


# ==============================================================================
# 4. EMERGENCY BREAK-GLASS ACCESS
# ==============================================================================

def test_break_glass_emergency_access_lifecycle(client, db_store):
    # Dr. Sharma (unassigned, same hospital) needs emergency access to PAT-001
    headers = _auth_header(
        "doctor",
        doctorId="DOC-CITY-02",
        email="dr.sharma@citygeneral.org",
        name="Dr. Neha Sharma",
        hospitalId="HOSP-CITY-01"
    )

    # 1. Insufficient clinical justification (< 8 characters) -> 400 Bad Request
    invalid_req = client.post(
        "/api/doctor/patient/PAT-001/emergency-access",
        headers=headers,
        json={"reason": "urgent", "clinicalUrgency": "CRITICAL"}
    )
    assert invalid_req.status_code == 400

    # 2. Valid emergency justification -> 201 Created
    grant_req = client.post(
        "/api/doctor/patient/PAT-001/emergency-access",
        headers=headers,
        json={
            "reason": "Acute cardiac dysrhythmia reported in emergency bay, attending doctor unreachable",
            "clinicalUrgency": "CRITICAL"
        }
    )
    assert grant_req.status_code == 201
    grant_data = grant_req.get_json()
    assert grant_data["status"] == "success"
    assert grant_data["data"]["grant"]["active"] is True

    # 3. Security audit event logged
    audit_events = db_store.get("security_audit_logs", {})
    assert any(
        isinstance(event, dict) and event.get("action") == "BREAK_GLASS_EMERGENCY_ACCESS"
        for event in audit_events.values()
    )

    # 4. Dr. Sharma can now access Level B clinical dossier under active emergency grant
    clinical_resp = client.get("/api/doctor/patient/PAT-001/clinical-record", headers=headers)
    assert clinical_resp.status_code == 200
    assert clinical_resp.get_json()["data"]["isEmergencyGrant"] is True


def test_cross_hospital_break_glass_prohibited(client):
    # Dr. Patel from HOSP-METRO-02 attempts break-glass for PAT-001 in HOSP-CITY-01
    headers = _auth_header(
        "doctor",
        doctorId="DOC-METRO-01",
        email="dr.patel@metro.org",
        name="Dr. Suresh Patel",
        hospitalId="HOSP-METRO-02"
    )

    resp = client.post(
        "/api/doctor/patient/PAT-001/emergency-access",
        headers=headers,
        json={
            "reason": "Attempting cross hospital emergency break glass access",
            "clinicalUrgency": "CRITICAL"
        }
    )
    assert resp.status_code == 403
    assert "Cross-hospital" in resp.get_json()["message"]


# ==============================================================================
# 5. AUDITABLE PRESCRIPTION REVISIONS
# ==============================================================================

def test_auditable_prescription_revision_workflow(client, db_store):
    headers = _auth_header(
        "doctor",
        doctorId="DOC-CITY-01",
        email="dr.rao@citygeneral.org",
        name="Dr. Ramesh Rao",
        hospitalId="HOSP-CITY-01"
    )

    # 1. Update without clinical justification -> 400 Bad Request
    missing_reason_resp = client.put(
        "/api/patient/PAT-001/prescriptions/MED-001",
        headers=headers,
        json={
            "dosage": "50mg",
            "instructions": "Increase dosage to 50mg",
        }
    )
    assert missing_reason_resp.status_code == 400
    err_msg = missing_reason_resp.get_json()["message"].lower()
    assert "clinical" in err_msg and "correction" in err_msg

    # 2. Update with valid reasonForCorrection -> 200 OK
    valid_update_resp = client.put(
        "/api/patient/PAT-001/prescriptions/MED-001",
        headers=headers,
        json={
            "medicineName": "Metoprolol Succinate",
            "dosage": "50mg",
            "frequency": "Once daily",
            "duration": "60 Days",
            "instructions": "Take in morning after breakfast with warm water",
            "reasonForCorrection": "Titrating dosage due to persistent resting heart rate > 85 bpm",
        }
    )
    assert valid_update_resp.status_code == 200
    data = valid_update_resp.get_json()
    assert data["status"] == "success"
    updated_med = data["data"]["prescription"]

    # Verify versioning & revision history
    assert updated_med["dosage"] == "50mg"
    assert updated_med["revisionNumber"] == 2
    assert len(updated_med["revisionHistory"]) == 1

    archived = updated_med["revisionHistory"][0]
    assert archived["dosage"] == "25mg"
    assert archived["reasonForCorrection"] == "Titrating dosage due to persistent resting heart rate > 85 bpm"
    assert archived["revisedBy"] == "Dr. Ramesh Rao"

    # 3. Verify security audit log entry
    audit_events = db_store.get("security_audit_logs", {})
    assert any(
        isinstance(event, dict) and event.get("action") == "PRESCRIPTION_AUDITED_REVISION"
        for event in audit_events.values()
    )


def test_cross_doctor_prescription_edit_rejected(client):
    # Dr. Sharma (unassigned) tries to alter PAT-001 prescription without emergency grant
    headers = _auth_header(
        "doctor",
        doctorId="DOC-CITY-02",
        email="dr.sharma@citygeneral.org",
        name="Dr. Neha Sharma",
        hospitalId="HOSP-CITY-01"
    )

    resp = client.put(
        "/api/patient/PAT-001/prescriptions/MED-001",
        headers=headers,
        json={
            "dosage": "100mg",
            "reasonForCorrection": "Unauthorized attempt",
        }
    )
    assert resp.status_code == 403


# ==============================================================================
# 6. PATIENT REASSIGNMENT AUTHORIZATION TRANSFER
# ==============================================================================

def test_patient_reassignment_updates_authorization(client, db_store):
    doc1_headers = _auth_header(
        "doctor",
        doctorId="DOC-CITY-01",
        email="dr.rao@citygeneral.org",
        hospitalId="HOSP-CITY-01"
    )
    doc2_headers = _auth_header(
        "doctor",
        doctorId="DOC-CITY-02",
        email="dr.sharma@citygeneral.org",
        hospitalId="HOSP-CITY-01"
    )

    # Initial state: Doc 1 can read PAT-001, Doc 2 cannot
    assert client.get("/api/doctor/patient/PAT-001/clinical-record", headers=doc1_headers).status_code == 200
    assert client.get("/api/doctor/patient/PAT-001/clinical-record", headers=doc2_headers).status_code == 403

    # Hospital admin reassigns patient PAT-001 to Dr. Sharma (DOC-CITY-02)
    db_store["patient"]["PAT-001"]["assignedDoctorId"] = "DOC-CITY-02"
    db_store["patient"]["PAT-001"]["assignedDoctorName"] = "Dr. Neha Sharma"
    db_store["patient"]["PAT-001"]["doctorId"] = "dr.sharma@citygeneral.org"

    # Authorization transfer verified:
    # Doc 2 now has access
    assert client.get("/api/doctor/patient/PAT-001/clinical-record", headers=doc2_headers).status_code == 200

    # Doc 1 has lost direct access
    assert client.get("/api/doctor/patient/PAT-001/clinical-record", headers=doc1_headers).status_code == 403


# ==============================================================================
# 7. SENSOR & SOS ALERT TRIAGE
# ==============================================================================

def test_doctor_alerts_and_triage_flow(client, db_store):
    headers = _auth_header(
        "doctor",
        doctorId="DOC-CITY-01",
        email="dr.rao@citygeneral.org",
        name="Dr. Ramesh Rao",
        hospitalId="HOSP-CITY-01"
    )

    # 1. Doctor retrieves alerts for hospital / assigned patients
    alerts_resp = client.get("/api/doctor/alerts", headers=headers)
    assert alerts_resp.status_code == 200
    alerts_list = alerts_resp.get_json()["data"]["alerts"]
    assert len(alerts_list) >= 1
    assert alerts_list[0]["id"] == "ALT-001"

    # 2. Triage alert with clinical action
    triage_resp = client.post(
        "/api/doctor/alerts/ALT-001/triage",
        headers=headers,
        json={
            "action": "TAKE_ACTION",
            "doctorNotes": "Contacted emergency ward nurse to administer IV Beta-blocker and perform 12-lead ECG",
        }
    )
    assert triage_resp.status_code == 200
    triaged_alert = triage_resp.get_json()["data"]["alert"]
    assert triaged_alert["triageStatus"] == "CLINICAL_ACTION_TAKEN"
    assert triaged_alert["status"] == "IN_PROGRESS"
    assert triaged_alert["lastTriagedBy"] == "Dr. Ramesh Rao"
    assert len(triaged_alert["auditLog"]) >= 1


# ==============================================================================
# 8. PRINTABLE CLINICAL DOCUMENT GENERATION
# ==============================================================================

def test_certified_clinical_document(client):
    headers = _auth_header(
        "doctor",
        doctorId="DOC-CITY-01",
        email="dr.rao@citygeneral.org",
        name="Dr. Ramesh Rao",
        hospitalId="HOSP-CITY-01"
    )

    resp = client.get("/api/doctor/patient/PAT-001/clinical-document", headers=headers)
    assert resp.status_code == 200
    doc = resp.get_json()["data"]["document"]

    # Verify document authenticity metadata
    assert "verificationHash" in doc
    assert doc["verificationHash"].startswith("SHA256-")
    assert doc["hospital"]["name"] == "City General Medical Center"
    assert doc["doctor"]["name"] == "Dr. Ramesh Rao"
    assert doc["patient"]["name"] == "Aarav Sharma"
    assert len(doc["activePrescriptions"]) == 1
