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
            "HOSP-ADMIN-H1": {
                "id": "HOSP-ADMIN-H1",
                "email": "admin@citygeneral.org",
                "name": "City General Admin",
                "role": "hospital_admin",
                "hospitalId": "HOSP-CITY-01",
                "passwordHash": generate_password_hash("CityAdminPass123!"),
                "isActive": True,
            },
            "HOSP-ADMIN-H2": {
                "id": "HOSP-ADMIN-H2",
                "email": "admin@metrocare.org",
                "name": "Metro Care Admin",
                "role": "hospital_admin",
                "hospitalId": "HOSP-METRO-02",
                "passwordHash": generate_password_hash("MetroAdminPass123!"),
                "isActive": True,
            },
        },
        "hospitals": {
            "HOSP-CITY-01": {
                "id": "HOSP-CITY-01",
                "hospitalId": "HOSP-CITY-01",
                "name": "City General Medical Center",
                "city": "New Delhi",
                "state": "Delhi",
                "phone": "+911140001000",
                "email": "admin@citygeneral.org",
                "departments": ["Cardiology", "General Medicine", "Emergency Care"],
                "isActive": True,
                "status": "active",
            },
            "HOSP-METRO-02": {
                "id": "HOSP-METRO-02",
                "hospitalId": "HOSP-METRO-02",
                "name": "Metro Care Hospital",
                "city": "Mumbai",
                "state": "Maharashtra",
                "phone": "+912240002000",
                "email": "admin@metrocare.org",
                "departments": ["Neurology", "Pediatrics", "Orthopedics"],
                "isActive": True,
                "status": "active",
            },
        },
        "doctor": {
            "DOC-CITY-01": {
                "id": "DOC-CITY-01",
                "doctorId": "DOC-CITY-01",
                "email": "dr.rao@citygeneral.org",
                "name": "Dr. Ramesh Rao",
                "role": "doctor",
                "hospitalId": "HOSP-CITY-01",
                "department": "Cardiology",
                "specialty": "Cardiologist",
                "phone": "+919876543210",
                "passwordHash": generate_password_hash("DoctorPass123!"),
                "isActive": True,
                "status": "active",
            },
            "DOC-METRO-01": {
                "id": "DOC-METRO-01",
                "doctorId": "DOC-METRO-01",
                "email": "dr.patel@metrocare.org",
                "name": "Dr. Priya Patel",
                "role": "doctor",
                "hospitalId": "HOSP-METRO-02",
                "department": "Neurology",
                "specialty": "Neurologist",
                "phone": "+919876543211",
                "passwordHash": generate_password_hash("DoctorPass123!"),
                "isActive": True,
                "status": "active",
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
                "isActive": True,
                "status": "active",
            },
            "PAT-002": {
                "id": "PAT-002",
                "patientId": "PAT-002",
                "name": "Meera Joshi",
                "email": "meera.joshi@example.com",
                "phone": "+919123456790",
                "hospitalId": "HOSP-METRO-02",
                "assignedDoctorId": "DOC-METRO-01",
                "assignedDoctorName": "Dr. Priya Patel",
                "doctorId": "dr.patel@metrocare.org",
                "isActive": True,
                "status": "active",
            },
        },
        "appointments": {
            "APT-001": {
                "id": "APT-001",
                "appointmentId": "APT-001",
                "patientId": "PAT-001",
                "patientName": "Aarav Sharma",
                "doctorId": "DOC-CITY-01",
                "doctorName": "Dr. Ramesh Rao",
                "hospitalId": "HOSP-CITY-01",
                "appointmentDate": "2026-10-25",
                "appointmentTime": "10:00 AM",
                "type": "Consultation",
                "status": "scheduled",
            }
        },
        "security_audit_logs": {},
        "patientHistory": {},
        "emergencyAlerts": {
            "EMG-001": {
                "id": "EMG-001",
                "alertId": "EMG-001",
                "patientId": "PAT-001",
                "patientName": "Aarav Sharma",
                "hospitalId": "HOSP-CITY-01",
                "type": "SOS",
                "status": "TRIGGERED",
                "severity": "CRITICAL",
                "timestamp": "2026-10-21T01:00:00Z",
            }
        },
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

    # Realtime DB fake for emergencyAlerts
    class FakeDB:
        @staticmethod
        def reference(path):
            return FakeRef(db_store).child(path)

    monkeypatch.setattr(backend_app, "db", FakeDB)

    return backend_app.app.test_client()


def _auth_header(role, **kwargs):
    payload = {"role": role, **kwargs}
    token = backend_app._issue_auth_token(payload)["token"]
    return {"Authorization": f"Bearer {token}"}


# ============================================================================
# 1. SUPER ADMIN HOSPITAL CRUD & CROSS-HOSPITAL ISOLATION
# ============================================================================

def test_super_admin_create_hospital(client, db_store):
    headers = _auth_header("super_admin", email="superadmin@smarthealth.io", id="ADMIN-ROOT-001")
    res = client.post("/api/admin/hospitals", headers=headers, json={
        "hospitalId": "HOSP-APOLLO-03",
        "name": "Apollo Prime Hospital",
        "city": "Bengaluru",
        "state": "Karnataka",
        "phone": "+918040003000",
        "email": "admin@apolloprime.org",
        "departments": ["Cardiology", "Oncology"],
    })
    assert res.status_code == 201
    data = res.get_json()
    assert data["status"] == "success"
    assert data["data"]["hospital"]["hospitalId"] == "HOSP-APOLLO-03"
    assert "HOSP-APOLLO-03" in db_store["hospitals"]

    # Verify security audit log recorded
    logs = db_store["security_audit_logs"]
    assert any(l.get("action") == "HOSPITAL_CREATED" for l in logs.values())


def test_hospital_admin_cannot_create_hospital(client):
    headers = _auth_header("hospital_admin", email="admin@citygeneral.org", hospitalId="HOSP-CITY-01")
    res = client.post("/api/admin/hospitals", headers=headers, json={
        "name": "Unauthorized Hospital",
    })
    assert res.status_code == 403


def test_duplicate_hospital_id_rejected(client):
    headers = _auth_header("super_admin", email="superadmin@smarthealth.io")
    res = client.post("/api/admin/hospitals", headers=headers, json={
        "hospitalId": "HOSP-CITY-01",
        "name": "City General Clone",
    })
    assert res.status_code == 409


def test_hospital_admin_isolation_on_view_and_update(client, db_store):
    headers_h1 = _auth_header("hospital_admin", email="admin@citygeneral.org", hospitalId="HOSP-CITY-01")

    # Hospital Admin 1 can view their own hospital
    res_own = client.get("/api/admin/hospitals/HOSP-CITY-01", headers=headers_h1)
    assert res_own.status_code == 200
    assert res_own.get_json()["data"]["hospital"]["name"] == "City General Medical Center"

    # Hospital Admin 1 CANNOT view Hospital 2 (403 Forbidden)
    res_other = client.get("/api/admin/hospitals/HOSP-METRO-02", headers=headers_h1)
    assert res_other.status_code == 403

    # Hospital Admin 1 CANNOT edit Hospital 2 (403 Forbidden)
    res_edit_other = client.put("/api/admin/hospitals/HOSP-METRO-02", headers=headers_h1, json={
        "name": "Malicious Update",
    })
    assert res_edit_other.status_code == 403

    # Hospital Admin 1 CAN update their own hospital
    res_edit_own = client.put("/api/admin/hospitals/HOSP-CITY-01", headers=headers_h1, json={
        "phone": "+911140009999",
    })
    assert res_edit_own.status_code == 200
    assert db_store["hospitals"]["HOSP-CITY-01"]["phone"] == "+911140009999"


def test_super_admin_toggle_hospital_status(client, db_store):
    headers_super = _auth_header("super_admin", email="superadmin@smarthealth.io")
    headers_hosp = _auth_header("hospital_admin", email="admin@citygeneral.org", hospitalId="HOSP-CITY-01")

    # Hospital admin cannot toggle hospital status
    res_unauth = client.post("/api/admin/hospitals/HOSP-CITY-01/toggle-status", headers=headers_hosp)
    assert res_unauth.status_code == 403

    # Super admin toggles to deactivated
    res = client.post("/api/admin/hospitals/HOSP-CITY-01/toggle-status", headers=headers_super, json={"isActive": False})
    assert res.status_code == 200
    assert db_store["hospitals"]["HOSP-CITY-01"]["isActive"] is False
    assert db_store["hospitals"]["HOSP-CITY-01"]["status"] == "deactivated"


# ============================================================================
# 2. REAL METRICS (PLATFORM-WIDE & HOSPITAL-SCOPED)
# ============================================================================

def test_real_admin_metrics(client):
    headers_super = _auth_header("super_admin", email="superadmin@smarthealth.io")
    res_super = client.get("/api/admin/metrics", headers=headers_super)
    assert res_super.status_code == 200
    super_metrics = res_super.get_json()["data"]["metrics"]

    assert super_metrics["doctors"]["total"] == 2
    assert super_metrics["patients"]["total"] == 2
    assert super_metrics["appointments"]["total"] == 1
    assert super_metrics["emergencies"]["total"] == 1
    assert len(super_metrics["hospitals"]) == 2

    # Scoped hospital admin metrics
    headers_h1 = _auth_header("hospital_admin", email="admin@citygeneral.org", hospitalId="HOSP-CITY-01")
    res_h1 = client.get("/api/admin/metrics", headers=headers_h1)
    assert res_h1.status_code == 200
    h1_metrics = res_h1.get_json()["data"]["metrics"]

    assert h1_metrics["doctors"]["total"] == 1
    assert h1_metrics["patients"]["total"] == 1
    assert h1_metrics["appointments"]["total"] == 1
    assert h1_metrics["emergencies"]["total"] == 1
    assert h1_metrics["hospitals"] is None  # Breakdown only for Super Admin


# ============================================================================
# 3. SECURITY AUDIT LOGS & CSV EXPORT
# ============================================================================

def test_audit_logs_query_and_export(client, db_store):
    headers_super = _auth_header("super_admin", email="superadmin@smarthealth.io")
    # Trigger an audited event
    client.post("/api/admin/hospitals", headers=headers_super, json={"name": "Log Test Clinic"})

    res_logs = client.get("/api/admin/audit-logs", headers=headers_super)
    assert res_logs.status_code == 200
    logs = res_logs.get_json()["data"]["logs"]
    assert len(logs) >= 1

    # Test CSV export
    res_csv = client.get("/api/admin/audit-logs/export", headers=headers_super)
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.content_type
    assert "security_audit_logs.csv" in res_csv.headers.get("Content-Disposition", "")
    assert b"ID,Timestamp,Action" in res_csv.data


# ============================================================================
# 4. PATIENT REGISTRATION, DUPLICATE PREVENTION & REASSIGNMENT
# ============================================================================

def test_patient_registration_with_duplicate_prevention(client, db_store):
    headers_h1 = _auth_header("hospital_admin", email="admin@citygeneral.org", hospitalId="HOSP-CITY-01")

    # Duplicate email prevention
    res_dup_email = client.post("/api/hospital/patients", headers=headers_h1, json={
        "name": "Imposter Aarav",
        "email": "aarav.sharma@example.com",  # Already exists!
        "phone": "+919999999999",
    })
    assert res_dup_email.status_code == 409
    assert "duplicate" in res_dup_email.get_json()["error"].lower()

    # Duplicate phone prevention
    res_dup_phone = client.post("/api/hospital/patients", headers=headers_h1, json={
        "name": "Different Name",
        "email": "brandnew@example.com",
        "phone": "+919123456789",  # Phone matches PAT-001!
    })
    assert res_dup_phone.status_code == 409
    assert "duplicate" in res_dup_phone.get_json()["error"].lower()

    # Valid registration
    res_success = client.post("/api/hospital/patients", headers=headers_h1, json={
        "name": "Deepak Verma",
        "email": "deepak.verma@example.com",
        "phone": "+919811122233",
        "age": 42,
        "gender": "male",
        "assignedDoctorId": "DOC-CITY-01",
    })
    assert res_success.status_code == 201
    created_pat = res_success.get_json()["data"]["patient"]
    new_pid = created_pat["patientId"]
    assert new_pid.startswith("PAT-")
    assert created_pat["hospitalId"] == "HOSP-CITY-01"
    assert created_pat["assignedDoctorName"] == "Dr. Ramesh Rao"

    # Verify patient history log initialized
    history = db_store["patientHistory"].get(new_pid, {})
    assert any(h.get("eventType") == "REGISTRATION" for h in history.values())


def test_patient_doctor_reassignment(client, db_store):
    headers_h1 = _auth_header("hospital_admin", email="admin@citygeneral.org", hospitalId="HOSP-CITY-01")

    # Attempt cross-hospital doctor assignment (DOC-METRO-01 belongs to Hospital 2)
    res_cross = client.put("/api/hospital/patients/PAT-001/assign", headers=headers_h1, json={
        "doctorId": "DOC-METRO-01",
    })
    assert res_cross.status_code == 400
    assert "same hospital" in res_cross.get_json()["error"].lower()

    # Reassignment to doctor in Hospital 1
    res_reassign = client.put("/api/hospital/patients/PAT-001/assign", headers=headers_h1, json={
        "doctorId": "DOC-CITY-01",
        "reason": "Routine specialist transfer",
    })
    assert res_reassign.status_code == 200

    # Verify patient history recorded
    hist = db_store["patientHistory"].get("PAT-001", {})
    assert any(h.get("eventType") == "DOCTOR_REASSIGNMENT" for h in hist.values())


def test_patient_history_route_access(client):
    headers_h1 = _auth_header("hospital_admin", email="admin@citygeneral.org", hospitalId="HOSP-CITY-01")
    res = client.get("/api/patient/PAT-001/history", headers=headers_h1)
    assert res.status_code == 200

    # Cross-hospital access to patient history is forbidden
    res_other = client.get("/api/patient/PAT-002/history", headers=headers_h1)
    assert res_other.status_code == 403


# ============================================================================
# 5. APPOINTMENTS MANAGEMENT & STATUS UPDATES
# ============================================================================

def test_hospital_appointments_flow(client, db_store):
    headers_h1 = _auth_header("hospital_admin", email="admin@citygeneral.org", hospitalId="HOSP-CITY-01")

    # Create appointment
    res_create = client.post("/api/hospital/appointments", headers=headers_h1, json={
        "patientId": "PAT-001",
        "doctorId": "DOC-CITY-01",
        "appointmentDate": "2026-10-30",
        "appointmentTime": "11:30 AM",
        "type": "Follow-up",
        "notes": "Post-cardiac medication evaluation",
    })
    assert res_create.status_code == 201
    apt = res_create.get_json()["data"]["appointment"]
    apt_id = apt["appointmentId"]

    # Update appointment status
    res_update = client.put(f"/api/hospital/appointments/{apt_id}/status", headers=headers_h1, json={
        "status": "completed",
        "notes": "Patient stable, continuation of therapy advised",
    })
    assert res_update.status_code == 200
    assert db_store["appointments"][apt_id]["status"] == "completed"

    # Cross-hospital appointment status update rejected
    headers_h2 = _auth_header("hospital_admin", email="admin@metrocare.org", hospitalId="HOSP-METRO-02")
    res_unauth = client.put(f"/api/hospital/appointments/{apt_id}/status", headers=headers_h2, json={
        "status": "cancelled",
    })
    assert res_unauth.status_code == 403


# ============================================================================
# 6. TELEMETRY & EMERGENCY OVERVIEW
# ============================================================================

def test_telemetry_overview(client):
    headers_h1 = _auth_header("hospital_admin", email="admin@citygeneral.org", hospitalId="HOSP-CITY-01")
    res = client.get("/api/hospital/telemetry-overview", headers=headers_h1)
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["totalEmergencyAlerts"] >= 1
    assert len(data["activeEmergencyAlerts"]) >= 1
