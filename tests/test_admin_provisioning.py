import os
import pytest
from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
import app as backend_app


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
        "admins": {},
        "hospitals": {},
        "doctor": {},
        "patient": {},
        "appointments": {},
        "security_audit_logs": {},
    }


@pytest.fixture(autouse=True)
def mock_db(monkeypatch, db_store):
    def fake_reference(path=""):
        cleaned = [p for p in str(path).split('/') if p]
        return FakeRef(db_store, cleaned)

    monkeypatch.setattr(backend_app.db, "reference", fake_reference)


@pytest.fixture()
def client(db_store):
    backend_app.app.config["TESTING"] = True
    with backend_app.app.test_client() as c:
        yield c


def _auth_header(role="super_admin", email="superadmin@smarthealth.io", admin_id="ADMIN-ROOT-001", hospital_id=""):
    token = backend_app._issue_auth_token({
        "role": role,
        "adminId": admin_id,
        "id": admin_id,
        "email": email,
        "name": "Super Administrator",
        "hospitalId": hospital_id,
    })["token"]
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# 1. FIRST-ADMIN PROVISIONING TESTS
# ==============================================================================

def test_first_admin_provisioning_success(monkeypatch, db_store):
    """When no super admin exists, valid environment variables provision root super admin."""
    monkeypatch.setenv("SUPER_ADMIN_EMAIL", "lead.director@smarthealth.io")
    monkeypatch.setenv("SUPER_ADMIN_PASSWORD", "SuperSecureHealth2026!")
    monkeypatch.setenv("SUPER_ADMIN_NAME", "Dr. Jane Doe")

    backend_app._ensure_default_super_admin()

    admins = db_store.get("admins", {})
    assert len(admins) == 1
    key = "lead,director@smarthealth,io"
    assert key in admins

    admin = admins[key]
    assert admin["role"] == "super_admin"
    assert admin["email"] == "lead.director@smarthealth.io"
    assert admin["name"] == "Dr. Jane Doe"
    assert admin["isActive"] is True
    assert admin["provisionMethod"] == "one_time_env_bootstrap"
    assert check_password_hash(admin["passwordHash"], "SuperSecureHealth2026!")


def test_first_admin_skipped_without_credentials(monkeypatch, db_store):
    """If no environment credentials are provided, NO default account with hardcoded password is created."""
    monkeypatch.delenv("SUPER_ADMIN_EMAIL", raising=False)
    monkeypatch.delenv("SUPER_ADMIN_PASSWORD", raising=False)
    monkeypatch.delenv("INITIAL_ADMIN_EMAIL", raising=False)
    monkeypatch.delenv("INITIAL_ADMIN_PASSWORD", raising=False)

    backend_app._ensure_default_super_admin()

    admins = db_store.get("admins", {})
    assert len(admins) == 0


def test_first_admin_skipped_on_insecure_default_password(monkeypatch, db_store):
    """Refuses to provision if the password matches an insecure known default."""
    monkeypatch.setenv("SUPER_ADMIN_EMAIL", "admin@smarthealth.io")
    monkeypatch.setenv("SUPER_ADMIN_PASSWORD", "Admin@SmartHealth2026!")

    backend_app._ensure_default_super_admin()

    admins = db_store.get("admins", {})
    assert len(admins) == 0


def test_first_admin_skipped_on_short_password(monkeypatch, db_store):
    """Refuses to provision if the password is shorter than 10 characters."""
    monkeypatch.setenv("SUPER_ADMIN_EMAIL", "admin@smarthealth.io")
    monkeypatch.setenv("SUPER_ADMIN_PASSWORD", "Short9!")

    backend_app._ensure_default_super_admin()

    admins = db_store.get("admins", {})
    assert len(admins) == 0


# ==============================================================================
# 2. EXISTING ADMIN PROTECTION & REPEAT STARTUP IDEMPOTENCY
# ==============================================================================

def test_existing_super_admin_not_overwritten_on_restart(monkeypatch, db_store):
    """An existing Super Admin must never be overwritten, modified, or re-hashed on repeated startup."""
    # Pre-seed an existing super admin
    original_hash = generate_password_hash("LegitimatePass2026!Secure")
    db_store["admins"]["legit,admin@smarthealth,io"] = {
        "id": "ADMIN-ROOT-EXISTING",
        "email": "legit.admin@smarthealth.io",
        "name": "Original Super Admin",
        "role": "super_admin",
        "isActive": True,
        "passwordHash": original_hash,
        "createdAt": "2026-01-01T00:00:00Z",
    }

    # An attacker or operator attempts to inject a new admin via env
    monkeypatch.setenv("SUPER_ADMIN_EMAIL", "new.attacker@smarthealth.io")
    monkeypatch.setenv("SUPER_ADMIN_PASSWORD", "NewAttackerPass2026!")

    backend_app._ensure_default_super_admin()

    admins = db_store["admins"]
    # Verify ONLY the original admin exists
    assert len(admins) == 1
    assert "legit,admin@smarthealth,io" in admins
    assert "new,attacker@smarthealth,io" not in admins
    assert admins["legit,admin@smarthealth,io"]["passwordHash"] == original_hash


def test_repeated_startup_idempotency(monkeypatch, db_store):
    """Calling _ensure_default_super_admin multiple times produces the exact same state without duplicate writes."""
    monkeypatch.setenv("SUPER_ADMIN_EMAIL", "first.super@smarthealth.io")
    monkeypatch.setenv("SUPER_ADMIN_PASSWORD", "FirstSuperPassword2026!")

    backend_app._ensure_default_super_admin()
    admins_first = dict(db_store["admins"])
    first_hash = admins_first["first,super@smarthealth,io"]["passwordHash"]

    # Subsequent startup
    backend_app._ensure_default_super_admin()
    backend_app._ensure_default_super_admin()

    admins_later = dict(db_store["admins"])
    assert len(admins_later) == 1
    assert admins_later["first,super@smarthealth,io"]["passwordHash"] == first_hash


def test_existing_non_super_admin_not_silently_promoted(monkeypatch, db_store):
    """An existing hospital admin must not be silently promoted or have their password overwritten by env vars."""
    hosp_admin_hash = generate_password_hash("HospAdminPass2026!")
    db_store["admins"]["hosp,dir@smarthealth,io"] = {
        "id": "HOSP-ADMIN-01",
        "email": "hosp.dir@smarthealth.io",
        "name": "Hospital Director",
        "role": "hospital_admin",
        "hospitalId": "HOSP-01",
        "isActive": True,
        "passwordHash": hosp_admin_hash,
        "createdAt": "2026-01-01T00:00:00Z",
    }

    # Attempt to bootstrap with the hospital admin's email
    monkeypatch.setenv("SUPER_ADMIN_EMAIL", "hosp.dir@smarthealth.io")
    monkeypatch.setenv("SUPER_ADMIN_PASSWORD", "NewSuperPass2026!")

    backend_app._ensure_default_super_admin()

    record = db_store["admins"]["hosp,dir@smarthealth,io"]
    assert record["role"] == "hospital_admin"
    assert record["passwordHash"] == hosp_admin_hash


# ==============================================================================
# 3. AUTHENTICATION & LOGIN FLOW TESTS
# ==============================================================================

def test_admin_login_success(client, db_store):
    """Valid credentials successfully authenticate and return JWT token with super_admin role."""
    pwd_hash = generate_password_hash("ValidPass2026!Unique")
    db_store["admins"]["admin,super@smarthealth,io"] = {
        "id": "ADMIN-SUPER-01",
        "email": "admin.super@smarthealth.io",
        "name": "Super Admin Test",
        "role": "super_admin",
        "isActive": True,
        "passwordHash": pwd_hash,
    }

    resp = client.post("/api/auth/admin/login", json={
        "email": "admin.super@smarthealth.io",
        "password": "ValidPass2026!Unique",
    })

    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "success"
    assert data["data"]["admin"]["role"] == "super_admin"
    assert "token" in data["data"]["auth"]


def test_admin_login_wrong_password(client, db_store):
    """Incorrect password returns 401 Unauthorized."""
    pwd_hash = generate_password_hash("ValidPass2026!Unique")
    db_store["admins"]["admin,super@smarthealth,io"] = {
        "id": "ADMIN-SUPER-01",
        "email": "admin.super@smarthealth.io",
        "role": "super_admin",
        "isActive": True,
        "passwordHash": pwd_hash,
    }

    resp = client.post("/api/auth/admin/login", json={
        "email": "admin.super@smarthealth.io",
        "password": "WrongPassword123!",
    })

    assert resp.status_code == 401


def test_admin_login_deactivated_account(client, db_store):
    """Deactivated admin account returns 403 Forbidden."""
    pwd_hash = generate_password_hash("ValidPass2026!Unique")
    db_store["admins"]["admin,super@smarthealth,io"] = {
        "id": "ADMIN-SUPER-01",
        "email": "admin.super@smarthealth.io",
        "role": "super_admin",
        "isActive": False,
        "passwordHash": pwd_hash,
    }

    resp = client.post("/api/auth/admin/login", json={
        "email": "admin.super@smarthealth.io",
        "password": "ValidPass2026!Unique",
    })

    assert resp.status_code == 403


def test_unauthorized_access_to_super_admin_endpoint(client):
    """Unauthenticated and non-admin requests are blocked from super-admin endpoints."""
    # Unauthenticated
    resp = client.get("/api/admin/metrics")
    assert resp.status_code == 401

    # Doctor trying to provision hospital admin
    doc_token = backend_app._issue_auth_token({
        "role": "doctor",
        "doctorId": "DOC-01",
        "email": "doc@hospital.org",
    })["token"]
    resp = client.post(
        "/api/admin/provision/hospital-admin",
        headers={"Authorization": f"Bearer {doc_token}"},
        json={"name": "Hosp Admin", "email": "admin@hosp.org", "password": "Pass2026!Secure", "hospitalId": "HOSP-01"}
    )
    assert resp.status_code == 403
