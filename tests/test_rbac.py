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
                "email": "hospadmin@citygeneral.org",
                "name": "Hospital Admin",
                "role": "hospital_admin",
                "hospitalId": "HOSP-01",
                "hospitalName": "City General Hospital",
                "passwordHash": generate_password_hash("HospAdminPass123!"),
                "isActive": True,
            },
            "HOSP-ADMIN-DEACT": {
                "id": "HOSP-ADMIN-DEACT",
                "email": "deactivated@hospital.org",
                "name": "Deactivated Admin",
                "role": "hospital_admin",
                "hospitalId": "HOSP-02",
                "passwordHash": generate_password_hash("DeactPass123!"),
                "isActive": False,
            },
        },
        "doctor": {
            "DOC-001": {
                "id": "DOC-001",
                "email": "dr.smith@citygeneral.org",
                "name": "Dr. Smith",
                "role": "doctor",
                "hospitalId": "HOSP-01",
                "passwordHash": generate_password_hash("DoctorPass123!"),
                "isActive": True,
            },
            "DOC-DEACT": {
                "id": "DOC-DEACT",
                "email": "dr.disabled@citygeneral.org",
                "name": "Dr. Disabled",
                "role": "doctor",
                "hospitalId": "HOSP-01",
                "passwordHash": generate_password_hash("DisabledPass123!"),
                "isActive": False,
            },
        },
        "patient": {
            "P1": {
                "id": "P1",
                "patientId": "P1",
                "name": "Alice Patient",
                "email": "alice@example.com",
                "doctorId": "dr.smith@citygeneral.org",
                "doctorEmail": "dr.smith@citygeneral.org",
                "passwordHash": generate_password_hash("AlicePass123!"),
                "isActive": True,
                "medicines": [{"id": "m1", "name": "Aspirin", "taken": False}],
                "predictionAudit": [],
            },
            "P2": {
                "id": "P2",
                "patientId": "P2",
                "name": "Bob Patient",
                "email": "bob@example.com",
                "doctorId": "dr.other@hospital.org",
                "doctorEmail": "dr.other@hospital.org",
                "passwordHash": generate_password_hash("BobPass123!"),
                "isActive": True,
                "medicines": [{"id": "m2", "name": "Metformin", "taken": False}],
                "predictionAudit": [],
            },
            "P-DEACT": {
                "id": "P-DEACT",
                "patientId": "P-DEACT",
                "name": "Charlie Deactivated",
                "email": "charlie@example.com",
                "passwordHash": generate_password_hash("CharliePass123!"),
                "isActive": False,
            },
        },
    }


@pytest.fixture()
def client(monkeypatch, db_store):
    monkeypatch.setattr(backend_app, "_admin_collection_reference", lambda: FakeRef(db_store).child("admins"))
    monkeypatch.setattr(backend_app, "_doctor_collection_reference", lambda: FakeRef(db_store).child("doctor"))
    monkeypatch.setattr(backend_app, "_patient_collection_reference", lambda: FakeRef(db_store).child("patient"))
    return backend_app.app.test_client()


def _auth_header(role, **kwargs):
    payload = {"role": role, **kwargs}
    token = backend_app._issue_auth_token(payload)["token"]
    return {"Authorization": f"Bearer {token}"}


# 1. Unauthenticated users cannot access protected APIs
def test_unauthenticated_requests_blocked(client):
    assert client.get("/api/admin/accounts").status_code == 401
    assert client.get("/api/admin/stats").status_code == 401
    assert client.post("/api/admin/provision/hospital-admin", json={}).status_code == 401
    assert client.post("/api/admin/provision/doctor", json={}).status_code == 401
    assert client.get("/api/patient/P1/medicines").status_code == 401


# 2. Public doctor signup is closed and forbidden
def test_public_doctor_signup_rejected(client):
    res = client.post("/doctor/signup", json={"email": "newdoc@test.com", "password": "password123"})
    assert res.status_code == 403
    data = res.get_json()
    assert "provisioned by an administrator" in data.get("error", "").lower() or data.get("status") == "error"


# 3. Super admin can provision hospital admin
def test_super_admin_provision_hospital_admin(client, db_store):
    headers = _auth_header("super_admin", email="superadmin@smarthealth.io", id="ADMIN-ROOT-001")
    res = client.post(
        "/api/admin/provision/hospital-admin",
        headers=headers,
        json={
            "email": "metro.admin@metrohealth.org",
            "name": "Metro Admin",
            "password": "SecurePassword123!",
            "hospitalId": "HOSP-METRO-01",
            "hospitalName": "Metro General Hospital",
        },
    )
    assert res.status_code == 201
    data = res.get_json()
    assert data["status"] == "success"
    assert data["data"]["email"] == "metro.admin@metrohealth.org"
    assert data["data"]["role"] == "hospital_admin"
    assert "HOSP-ADMIN-" in data["data"]["id"]


# 4. Hospital admin CANNOT provision another hospital admin (privilege escalation blocked)
def test_hospital_admin_cannot_provision_hospital_admin(client):
    headers = _auth_header("hospital_admin", email="hospadmin@citygeneral.org", hospitalId="HOSP-01")
    res = client.post(
        "/api/admin/provision/hospital-admin",
        headers=headers,
        json={
            "email": "another.admin@citygeneral.org",
            "name": "Another Admin",
            "password": "SecurePassword123!",
            "hospitalId": "HOSP-01",
        },
    )
    assert res.status_code == 403


# 5. Doctor CANNOT provision doctors or administrators
def test_doctor_cannot_provision_accounts(client):
    headers = _auth_header("doctor", email="dr.smith@citygeneral.org")
    res_admin = client.post("/api/admin/provision/hospital-admin", headers=headers, json={})
    assert res_admin.status_code == 403

    res_doc = client.post("/api/admin/provision/doctor", headers=headers, json={})
    assert res_doc.status_code == 403

    res_accounts = client.get("/api/admin/accounts", headers=headers)
    assert res_accounts.status_code == 403


# 6. Hospital admin can provision a doctor for their assigned hospital
def test_hospital_admin_provisions_doctor_for_own_hospital(client, db_store):
    headers = _auth_header("hospital_admin", email="hospadmin@citygeneral.org", hospitalId="HOSP-01")
    res = client.post(
        "/api/admin/provision/doctor",
        headers=headers,
        json={
            "email": "dr.johnson@citygeneral.org",
            "name": "Dr. Johnson",
            "phone": "+919876543210",
            "password": "DoctorPassword123!",
            "hospitalId": "HOSP-01",
            "specialty": "Cardiology",
        },
    )
    assert res.status_code == 201
    data = res.get_json()
    assert data["status"] == "success"
    assert data["data"]["email"] == "dr.johnson@citygeneral.org"
    assert data["data"]["role"] == "doctor"
    assert data["data"]["hospitalId"] == "HOSP-01"


# 7. Hospital admin CANNOT provision a doctor for a foreign hospital
def test_hospital_admin_blocked_from_provisioning_foreign_hospital(client):
    headers = _auth_header("hospital_admin", email="hospadmin@citygeneral.org", hospitalId="HOSP-01")
    res = client.post(
        "/api/admin/provision/doctor",
        headers=headers,
        json={
            "email": "dr.rogue@otherhospital.org",
            "name": "Dr. Rogue",
            "password": "DoctorPassword123!",
            "hospitalId": "HOSP-FOREIGN-99",
        },
    )
    assert res.status_code == 403


# 8. Patients cannot read another patient's records
def test_patient_cannot_access_other_patient_data(client):
    # Alice (P1) attempts to read Bob's (P2) medicines
    headers_alice = _auth_header("patient", patientId="P1", id="P1", email="alice@example.com")
    res = client.get("/api/patient/P2/medicines", headers=headers_alice)
    assert res.status_code == 403
    assert res.get_json()["status"] == "error"

    # Alice (P1) attempts to update Bob's (P2) medicine
    res_update = client.post(
        "/api/patient/P2/medicines/m2/taken",
        headers=headers_alice,
        json={"taken": True},
    )
    assert res_update.status_code == 403


# 9. Patients can access their own records
def test_patient_can_access_own_data(client):
    headers_alice = _auth_header("patient", patientId="P1", id="P1", email="alice@example.com")
    res = client.get("/api/patient/P1/medicines", headers=headers_alice)
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    assert len(data["data"]["medicines"]) == 1


# 10. Deactivated accounts lose access immediately
def test_deactivated_account_blocked(client):
    # Deactivated hospital admin
    headers_deact_admin = _auth_header("hospital_admin", email="deactivated@hospital.org", id="HOSP-ADMIN-DEACT")
    assert client.get("/api/admin/accounts", headers=headers_deact_admin).status_code == 403

    # Deactivated doctor
    headers_deact_doc = _auth_header("doctor", email="dr.disabled@citygeneral.org", id="DOC-DEACT")
    assert client.get("/api/patient/P1/medicines", headers=headers_deact_doc).status_code == 403

    # Deactivated patient
    headers_deact_pat = _auth_header("patient", patientId="P-DEACT", id="P-DEACT", email="charlie@example.com")
    assert client.get("/api/patient/P-DEACT/medicines", headers=headers_deact_pat).status_code == 403


# 11. Deactivated accounts cannot log in
def test_deactivated_account_login_rejected(client):
    res_admin = client.post(
        "/api/auth/admin/login",
        json={"email": "deactivated@hospital.org", "password": "DeactPass123!"},
    )
    assert res_admin.status_code == 403

    res_doc = client.post(
        "/api/doctor/login",
        json={"email": "dr.disabled@citygeneral.org", "password": "DisabledPass123!"},
    )
    assert res_doc.status_code == 403


# 12. Super Admin can toggle account status (activate/deactivate)
def test_super_admin_toggle_account_status(client, db_store):
    headers = _auth_header("super_admin", email="superadmin@smarthealth.io", id="ADMIN-ROOT-001")
    # Deactivate Dr. Smith
    res = client.post(
        "/api/admin/accounts/toggle-status",
        headers=headers,
        json={"role": "doctor", "accountId": "DOC-001", "isActive": False},
    )
    assert res.status_code == 200
    assert res.get_json()["data"]["isActive"] is False
    assert db_store["doctor"]["DOC-001"]["isActive"] is False

    # Prevent self-deactivation
    res_self = client.post(
        "/api/admin/accounts/toggle-status",
        headers=headers,
        json={"role": "super_admin", "accountId": "ADMIN-ROOT-001", "isActive": False},
    )
    assert res_self.status_code == 400


# 13. Rate limiting triggers on repeated invalid logins
def test_rate_limiting_on_repeated_failed_logins(client):
    backend_app._RATE_LIMIT_STORE.clear()
    for _ in range(10):
        client.post(
            "/api/auth/admin/login",
            json={"email": "superadmin@smarthealth.io", "password": "wrong_password"},
        )
    # The 11th request should be rate-limited
    res_limited = client.post(
        "/api/auth/admin/login",
        json={"email": "superadmin@smarthealth.io", "password": "wrong_password"},
    )
    assert res_limited.status_code == 429
    assert "Too many login attempts" in res_limited.get_json()["error"]
