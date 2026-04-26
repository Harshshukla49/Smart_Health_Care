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
