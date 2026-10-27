import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app as backend_app


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
def client(monkeypatch):
    data = {
        "patient": {
            "P1": {
                "id": "P1",
                "patientId": "P1",
                "doctorId": "doc@example.com",
                "doctorEmail": "doc@example.com",
                "medicines": [{"id": "m1", "name": "Aspirin", "taken": False}],
                "predictionAudit": [
                    {
                        "timestamp": "2026-01-01T00:00:00+00:00",
                        "source": "seed",
                        "risk": "Low",
                        "status": "Normal",
                        "confidence": 0.93,
                        "message": "Stable",
                        "vitals": {"heartRate": 80, "spo2": 98, "temperature": 36.5},
                    }
                ],
            }
        }
    }

    monkeypatch.setattr(backend_app, "_patient_collection_reference", lambda: FakeRef(data).child("patient"))
    return backend_app.app.test_client()


def _auth_header(role, **kwargs):
    payload = {"role": role, **kwargs}
    token = backend_app._issue_auth_token(payload)["token"]
    return {"Authorization": f"Bearer {token}"}


def test_rejects_missing_token_for_patient_medicines(client):
    response = client.get("/api/patient/P1/medicines")
    assert response.status_code == 401
    payload = response.get_json()
    assert payload["status"] == "error"
    assert "requestId" in payload["meta"]


def test_rejects_invalid_token_for_patient_medicines(client):
    response = client.get("/api/patient/P1/medicines", headers={"Authorization": "Bearer invalid-token"})
    assert response.status_code == 401
    payload = response.get_json()
    assert payload["status"] == "error"
    assert "meta" in payload and "requestId" in payload["meta"]


def test_enforces_doctor_patient_ownership(client):
    headers = _auth_header("doctor", email="another-doctor@example.com")
    response = client.get("/api/patient/P1/medicines", headers=headers)
    assert response.status_code == 403
    assert response.get_json()["status"] == "error"


def test_allows_owned_doctor_access_for_patient_medicines(client):
    headers = _auth_header("doctor", email="doc@example.com")
    response = client.get("/api/patient/P1/medicines", headers=headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] == "success"
    assert "medicines" in payload["data"]


def test_updates_medicine_taken_with_canonical_route(client):
    headers = _auth_header("patient", patientId="P1")
    response = client.post("/api/patient/P1/medicines/m1/taken", json={"taken": True}, headers=headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] == "success"
    assert payload["data"]["medicines"][0]["taken"] is True


def test_rejects_non_boolean_taken_field(client):
    headers = _auth_header("patient", patientId="P1")
    response = client.post("/api/patient/P1/medicines/m1/taken", json={"taken": "yes"}, headers=headers)
    assert response.status_code == 400
    payload = response.get_json()
    assert payload["status"] == "error"


def test_prediction_audit_returns_enveloped_payload(client):
    headers = _auth_header("doctor", email="doc@example.com")
    response = client.get("/api/patient/P1/prediction-audit", headers=headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] == "success"
    assert payload["data"]["patientId"] == "P1"
    assert isinstance(payload["data"]["audit"], list)


def test_prediction_audit_blocks_unowned_doctor(client):
    headers = _auth_header("doctor", email="other-doctor@example.com")
    response = client.get("/api/patient/P1/prediction-audit", headers=headers)
    assert response.status_code == 403
    assert response.get_json()["status"] == "error"


# ==============================================================================
# REMEDIATION TESTS: CORS, AUTH SECRET FAIL-SAFE, SPA ROUTING
# ==============================================================================

def test_cors_approved_origin_allowed(client):
    """Verifies that approved frontend origins receive CORS allow headers with credentials."""
    approved_origin = "https://smart-health-rontend.onrender.com"
    response = client.get("/health", headers={"Origin": approved_origin})
    assert response.headers.get("Access-Control-Allow-Origin") == approved_origin
    assert response.headers.get("Access-Control-Allow-Credentials") == "true"


def test_cors_unapproved_origin_rejected(client):
    """Verifies that untrusted third-party origins do NOT receive an allow header."""
    untrusted_origin = "https://malicious-attacker-domain.com"
    response = client.get("/health", headers={"Origin": untrusted_origin})
    assert response.headers.get("Access-Control-Allow-Origin") != untrusted_origin


def test_resolve_allowed_origins_production_rejects_wildcard():
    """Verifies wildcard CORS is strictly rejected in production environments."""
    with pytest.raises(RuntimeError, match="Wildcard CORS"):
        backend_app.resolve_allowed_origins(cors_env="*", is_prod=True)


def test_resolve_allowed_origins_production_separates_dev_origins():
    """Verifies production defaults isolate to production domains, excluding localhost."""
    prod_origins = backend_app.resolve_allowed_origins(cors_env="", is_prod=True)
    assert "https://smart-health-rontend.onrender.com" in prod_origins
    assert not any("localhost" in o for o in prod_origins)

    dev_origins = backend_app.resolve_allowed_origins(cors_env="", is_prod=False)
    assert any("localhost" in o for o in dev_origins)


def test_auth_secret_production_fails_safe_on_missing_or_short_secret():
    """Verifies production startup fails safe if secret is missing, short, or default."""
    # Missing / empty
    with pytest.raises(RuntimeError, match="FATAL \\[SECURITY\\]"):
        backend_app.resolve_auth_secret(secret_candidate="", is_prod=True)

    # Insecure known dev default
    with pytest.raises(RuntimeError, match="FATAL \\[SECURITY\\]"):
        backend_app.resolve_auth_secret(secret_candidate="smart-health-dev-secret", is_prod=True)

    # Shorter than 32 characters
    with pytest.raises(RuntimeError, match="FATAL \\[SECURITY\\]"):
        backend_app.resolve_auth_secret(secret_candidate="short-secret-less-than-32-chars", is_prod=True)


def test_auth_secret_production_accepts_valid_secret():
    """Verifies production accepts explicit cryptographically strong 32+ char secret."""
    strong_secret = "a_very_strong_production_secret_key_1234567890"
    resolved = backend_app.resolve_auth_secret(secret_candidate=strong_secret, is_prod=True)
    assert resolved == strong_secret


def test_spa_fallback_serves_index_html_for_client_routes(client, tmp_path, monkeypatch):
    """Verifies client routes (like /login or /dashboard) serve index.html when dist exists."""
    dist_dir = tmp_path / "dist"
    dist_dir.mkdir()
    index_file = dist_dir / "index.html"
    index_file.write_text("<!DOCTYPE html><html><body><div id='root'>SPA</div></body></html>", encoding="utf-8")

    monkeypatch.setattr(backend_app, "BASE_DIR", tmp_path.parent)
    # create frontend/dist structure
    frontend_dist = tmp_path.parent / "frontend" / "dist"
    frontend_dist.mkdir(parents=True, exist_ok=True)
    (frontend_dist / "index.html").write_text("<!DOCTYPE html><html><body><div id='root'>SPA</div></body></html>", encoding="utf-8")

    response = client.get("/login")
    assert response.status_code == 200
    assert b"SPA" in response.data

    response = client.get("/dashboard")
    assert response.status_code == 200
    assert b"SPA" in response.data


def test_spa_fallback_does_not_intercept_api_routes(client):
    """Verifies backend API routes return 404 JSON and are never hijacked by SPA HTML fallback."""
    response = client.get("/api/nonexistent-endpoint-test")
    assert response.status_code == 404
    payload = response.get_json()
    assert payload["status"] == "error"

