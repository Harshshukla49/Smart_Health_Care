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

    def delete(self):
        if not self.path:
            return
        node = self.store
        for segment in self.path[:-1]:
            if not isinstance(node, dict) or segment not in node:
                return
            node = node[segment]
        if isinstance(node, dict) and self.path[-1] in node:
            del node[self.path[-1]]


@pytest.fixture()
def db_store():
    store = {
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
            "ADMIN-METRO-02": {
                "id": "ADMIN-METRO-02",
                "email": "admin@metroapex.org",
                "name": "Metro Admin",
                "role": "hospital_admin",
                "hospitalId": "HOSP-METRO-02",
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
            "dr,sharma@metroapex,org": {
                "id": "DOC-METRO-02",
                "doctorId": "DOC-METRO-02",
                "email": "dr.sharma@metroapex.org",
                "name": "Dr. Sunita Sharma",
                "role": "doctor",
                "hospitalId": "HOSP-METRO-02",
                "specialty": "Neurology",
                "department": "Neurology",
                "phone": "+919876543211",
                "passwordHash": generate_password_hash("DoctorPass123!"),
                "isActive": True,
            },
        },
        "patients": {
            "PT-CITY-01": {
                "id": "PT-CITY-01",
                "patientId": "PT-CITY-01",
                "name": "Aarav Gupta",
                "email": "aarav@patient.org",
                "phone": "+919811122233",
                "password": generate_password_hash("PatientPass123!"),
                "hospitalId": "HOSP-CITY-01",
                "assignedDoctorId": "DOC-CITY-01",
                "doctorEmail": "dr.rao@citygeneral.org",
                "emergencyContact": "Neha Gupta",
                "emergencyPhone": "+919811199988",
                "status": "admitted",
            },
            "PT-METRO-02": {
                "id": "PT-METRO-02",
                "patientId": "PT-METRO-02",
                "name": "Meera Patel",
                "email": "meera@patient.org",
                "phone": "+919822233344",
                "password": generate_password_hash("PatientPass123!"),
                "hospitalId": "HOSP-METRO-02",
                "assignedDoctorId": "DOC-METRO-02",
                "doctorEmail": "dr.sharma@metroapex.org",
                "emergencyContact": "Vikram Patel",
                "emergencyPhone": "+919822299977",
                "status": "admitted",
            },
        },
        "emergencyAlerts": {},
        "securityAuditLogs": {},
    }
    store["patient"] = store["patients"]
    store["emergencies"] = store["emergencyAlerts"]
    return store


@pytest.fixture()
def client(monkeypatch, db_store):
    monkeypatch.setattr(backend_app, "_admin_collection_reference", lambda: FakeRef(db_store).child("admins"))
    monkeypatch.setattr(backend_app, "_hospitals_collection_reference", lambda: FakeRef(db_store).child("hospitals"))
    monkeypatch.setattr(backend_app, "_doctor_collection_reference", lambda: FakeRef(db_store).child("doctor"))
    monkeypatch.setattr(backend_app, "_patient_collection_reference", lambda: FakeRef(db_store).child("patient"))
    monkeypatch.setattr(backend_app, "_security_audit_reference", lambda: FakeRef(db_store).child("securityAuditLogs"))

    class FakeDB:
        @staticmethod
        def reference(path=""):
            parts = [p for p in str(path).split('/') if p]
            return FakeRef(db_store, parts)

    monkeypatch.setattr(backend_app, "db", FakeDB)
    backend_app.app.config["TESTING"] = True
    with backend_app.app.test_client() as test_client:
        yield test_client


def make_token(payload):
    return backend_app._issue_auth_token(payload)["token"]


def auth_header(payload):
    token = make_token(payload)
    return {"Authorization": f"Bearer {token}"}


# ============================================================================
# 1. AUTHENTICATED PATIENT SOS TRIGGER WITH VALID GPS
# ============================================================================
def test_authenticated_patient_sos_trigger_with_gps(client, db_store):
    headers = auth_header({
        "id": "PT-CITY-01",
        "patientId": "PT-CITY-01",
        "role": "patient",
        "email": "aarav@patient.org",
        "name": "Aarav Gupta",
    })

    payload = {
        "patientId": "PT-CITY-01",
        "triggerReason": "Acute chest pain & severe shortness of breath",
        "location": {
            "latitude": 28.6139,
            "longitude": 77.2090,
            "accuracy": 12,
        },
        "vitals": {
            "heartRate": 138,
            "spo2": 88,
            "temperature": 38.2,
        },
    }

    resp = client.post("/api/emergency/trigger", json=payload, headers=headers)
    assert resp.status_code in (200, 201), resp.get_json()
    data = resp.get_json()
    assert data["status"] == "success"
    alert = data["data"]

    assert alert["patientId"] == "PT-CITY-01"
    assert alert["hospitalId"] == "HOSP-CITY-01"
    assert alert["hospitalName"] == "City General Medical Center"
    assert alert["locationStatus"] == "ACQUIRED"
    assert "28.6139" in alert["mapsUrl"]
    assert "77.209" in alert["openStreetMapUrl"]
    assert alert["status"] == "CRITICAL"
    assert "fallbackInstructions" in alert
    assert alert["fallbackInstructions"]["nationalEmergency"] == "112"

    # Verify saved in emergencyAlerts database
    alert_id = alert["alertId"]
    assert alert_id in db_store["emergencyAlerts"]
    assert db_store["emergencyAlerts"][alert_id]["status"] == "CRITICAL"

    # Verify registered in patient active emergency
    assert db_store["patients"]["PT-CITY-01"]["activeEmergency"]["alertId"] == alert_id


# ============================================================================
# 2. UNAUTHENTICATED SOS TRIGGER REJECTION
# ============================================================================
def test_unauthenticated_sos_trigger_rejected(client):
    payload = {
        "patientId": "PT-CITY-01",
        "triggerReason": "Testing unauthenticated trigger",
    }
    resp = client.post("/api/emergency/trigger", json=payload)
    assert resp.status_code == 401
    assert "token" in resp.get_json()["message"].lower() or "authorization" in resp.get_json()["message"].lower() or "unauthorized" in resp.get_json()["message"].lower()


# ============================================================================
# 3. CROSS-PATIENT SOS SPOOFING REJECTION (403 FORBIDDEN)
# ============================================================================
def test_cross_patient_sos_spoofing_rejected(client):
    # Patient PT-CITY-01 tries to trigger SOS claiming to be PT-METRO-02
    headers = auth_header({
        "id": "PT-CITY-01",
        "patientId": "PT-CITY-01",
        "role": "patient",
        "email": "aarav@patient.org",
    })

    payload = {
        "patientId": "PT-METRO-02",
        "triggerReason": "Spoofed distress call",
    }
    resp = client.post("/api/emergency/trigger", json=payload, headers=headers)
    assert resp.status_code == 403
    msg = resp.get_json()["message"].lower()
    assert "forbidden" in msg or "only trigger" in msg or "unauthorized" in msg


# ============================================================================
# 4. DUPLICATE SOS TRIGGER SUPPRESSION WITHIN COOLDOWN WINDOW
# ============================================================================
def test_duplicate_sos_trigger_suppression(client, db_store):
    headers = auth_header({
        "id": "PT-CITY-01",
        "patientId": "PT-CITY-01",
        "role": "patient",
        "email": "aarav@patient.org",
        "name": "Aarav Gupta",
    })

    first_payload = {
        "patientId": "PT-CITY-01",
        "triggerReason": "Initial distress trigger",
        "location": {"latitude": 28.6139, "longitude": 77.2090, "accuracy": 20},
        "vitals": {"heartRate": 120, "spo2": 92},
    }
    resp1 = client.post("/api/emergency/trigger", json=first_payload, headers=headers)
    assert resp1.status_code in (200, 201)
    data1 = resp1.get_json()
    first_alert_id = data1["data"]["alertId"]

    # Immediate second trigger (within 45s cooldown window) with updated GPS
    second_payload = {
        "patientId": "PT-CITY-01",
        "triggerReason": "Repeated panic button press",
        "location": {"latitude": 28.6145, "longitude": 77.2098, "accuracy": 8},
        "vitals": {"heartRate": 135, "spo2": 89},
    }
    resp2 = client.post("/api/emergency/trigger", json=second_payload, headers=headers)
    assert resp2.status_code in (200, 201)
    data2 = resp2.get_json()

    # Must suppress duplicate event creation and return duplicatePrevented
    assert data2.get("duplicatePrevented") is True
    assert data2["data"]["alertId"] == first_alert_id
    # Coordinates and vitals should be refreshed
    assert data2["data"]["location"]["accuracy"] == 8
    assert data2["data"]["vitals"]["heartRate"] == 135

    # Audit trail should contain duplicate suppression action
    audit_actions = [e.get("action") for e in data2["data"]["auditLog"]]
    assert "DUPLICATE_SOS_SUPPRESSED" in audit_actions


# ============================================================================
# 5. MISSING LOCATION AND PERMISSION DENIED HANDLING
# ============================================================================
def test_missing_location_and_permission_denied(client, db_store):
    headers = auth_header({
        "id": "PT-METRO-02",
        "patientId": "PT-METRO-02",
        "role": "patient",
        "email": "meera@patient.org",
        "name": "Meera Patel",
    })

    # Trigger with missing location / permission denied
    payload = {
        "patientId": "PT-METRO-02",
        "triggerReason": "Dizziness and syncope (Location permission denied)",
        "location": None,
    }
    resp = client.post("/api/emergency/trigger", json=payload, headers=headers)
    assert resp.status_code in (200, 201)
    data = resp.get_json()
    alert = data["data"]

    assert alert["locationStatus"] in ("PERMISSION_DENIED", "UNAVAILABLE")
    assert alert["fallbackInstructions"]["emergencyAmbulance"] == "108"
    assert alert["fallbackInstructions"]["nationalEmergency"] == "112"
    assert "offlineSmsTemplate" in alert["fallbackInstructions"]


# ============================================================================
# 6. TRUTHFUL NOTIFICATION TRACKING (NO FALSE DELIVERY CLAIMS)
# ============================================================================
def test_notification_delivery_tracking_truthfulness(client, monkeypatch):
    # Ensure environment does not have twilio credentials or email sender configured
    monkeypatch.delenv("TWILIO_ACCOUNT_SID", raising=False)
    monkeypatch.delenv("TWILIO_AUTH_TOKEN", raising=False)
    monkeypatch.delenv("EMAIL_SENDER", raising=False)
    monkeypatch.setattr(backend_app, "EMAIL_SENDER", None)
    monkeypatch.setattr(backend_app, "twilio_client", None)

    headers = auth_header({
        "id": "PT-CITY-01",
        "patientId": "PT-CITY-01",
        "role": "patient",
        "email": "aarav@patient.org",
        "name": "Aarav Gupta",
    })

    payload = {
        "patientId": "PT-CITY-01",
        "triggerReason": "Telemetry crisis",
        "sosContacts": [{"name": "Family Contact", "phone": "+919811199988"}],
    }

    resp = client.post("/api/emergency/trigger", json=payload, headers=headers)
    assert resp.status_code in (200, 201)
    data = resp.get_json()
    alert = data["data"]
    delivery = alert["deliveryStatus"]

    # Must report without claiming successful delivery when credentials are not configured
    sms_statuses = [s["status"] for s in delivery.get("sms", [])]
    assert "DELIVERED" not in sms_statuses
    assert all(s in ("PROVIDER_UNCONFIGURED", "PROVIDER_ERROR") for s in sms_statuses)

    hospital_email_status = delivery.get("hospitalEmail", {}).get("status")
    assert hospital_email_status in ("PROVIDER_UNCONFIGURED", "NOT_CONFIGURED") or "unconfigured" in str(hospital_email_status).lower()


# ============================================================================
# 7. HOSPITAL ADMIN ACCESS ISOLATION (CROSS-HOSPITAL ISOLATION)
# ============================================================================
def test_hospital_admin_access_isolation(client, db_store):
    # Setup two emergencies in different hospitals in emergencyAlerts
    db_store["emergencyAlerts"]["emg-city-1"] = {
        "alertId": "emg-city-1",
        "patientId": "PT-CITY-01",
        "hospitalId": "HOSP-CITY-01",
        "status": "CRITICAL",
        "triggerReason": "City emergency",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "auditLog": [],
    }
    db_store["emergencyAlerts"]["emg-metro-2"] = {
        "alertId": "emg-metro-2",
        "patientId": "PT-METRO-02",
        "hospitalId": "HOSP-METRO-02",
        "status": "CRITICAL",
        "triggerReason": "Metro emergency",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "auditLog": [],
    }

    city_admin_headers = auth_header({
        "id": "ADMIN-CITY-01",
        "role": "hospital_admin",
        "hospitalId": "HOSP-CITY-01",
        "email": "admin@citygeneral.org",
    })

    # 1. City Admin lists active emergencies -> only sees HOSP-CITY-01
    resp = client.get("/api/emergency/active", headers=city_admin_headers)
    assert resp.status_code == 200
    alert_ids = [a["alertId"] for a in resp.get_json()["emergencies"]]
    assert "emg-city-1" in alert_ids
    assert "emg-metro-2" not in alert_ids

    # 2. City Admin attempts to fetch emg-metro-2 directly -> 403 Forbidden
    resp_cross = client.get("/api/emergency/emg-metro-2", headers=city_admin_headers)
    assert resp_cross.status_code == 403

    # 3. City Admin attempts to update status of emg-metro-2 -> 403 Forbidden
    resp_update = client.post(
        "/api/emergency/emg-metro-2/status",
        json={"status": "EMERGENCY_ACKNOWLEDGED"},
        headers=city_admin_headers,
    )
    assert resp_update.status_code == 403


# ============================================================================
# 8. DOCTOR ACCESS ISOLATION (CROSS-HOSPITAL & CROSS-DOCTOR RULES)
# ============================================================================
def test_doctor_access_isolation(client, db_store):
    db_store["emergencyAlerts"]["emg-city-1"] = {
        "alertId": "emg-city-1",
        "patientId": "PT-CITY-01",
        "hospitalId": "HOSP-CITY-01",
        "doctorId": "DOC-CITY-01",
        "status": "CRITICAL",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "auditLog": [],
    }
    db_store["emergencyAlerts"]["emg-metro-2"] = {
        "alertId": "emg-metro-2",
        "patientId": "PT-METRO-02",
        "hospitalId": "HOSP-METRO-02",
        "doctorId": "DOC-METRO-02",
        "status": "CRITICAL",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "auditLog": [],
    }

    city_doc_headers = auth_header({
        "id": "DOC-CITY-01",
        "doctorId": "DOC-CITY-01",
        "role": "doctor",
        "hospitalId": "HOSP-CITY-01",
        "email": "dr.rao@citygeneral.org",
    })

    # Doctor in City hospital lists emergencies -> sees only City emergencies
    resp = client.get("/api/emergency/active", headers=city_doc_headers)
    assert resp.status_code == 200
    ids = [a["alertId"] for a in resp.get_json()["emergencies"]]
    assert "emg-city-1" in ids
    assert "emg-metro-2" not in ids

    # Doctor in City hospital attempts to update Metro emergency -> 403 Forbidden
    resp_cross = client.post(
        "/api/emergency/emg-metro-2/status",
        json={"status": "EMERGENCY_ACKNOWLEDGED"},
        headers=city_doc_headers,
    )
    assert resp_cross.status_code == 403


# ============================================================================
# 9. AUTHORIZED STATUS UPDATES AND IMMUTABLE AUDIT TRAIL
# ============================================================================
def test_authorized_status_updates_and_audit_trail(client, db_store):
    db_store["emergencyAlerts"]["emg-test-status"] = {
        "alertId": "emg-test-status",
        "patientId": "PT-CITY-01",
        "hospitalId": "HOSP-CITY-01",
        "doctorId": "DOC-CITY-01",
        "status": "CRITICAL",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "auditLog": [
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "actor": "system",
                "action": "EMERGENCY_SOS_TRIGGERED",
                "details": "Triggered by patient",
            }
        ],
    }
    db_store["patients"]["PT-CITY-01"]["activeEmergency"] = {"alertId": "emg-test-status"}

    city_doc_headers = auth_header({
        "id": "DOC-CITY-01",
        "doctorId": "DOC-CITY-01",
        "role": "doctor",
        "hospitalId": "HOSP-CITY-01",
        "email": "dr.rao@citygeneral.org",
        "name": "Dr. Ramesh Rao",
    })

    # 1. Acknowledge alert
    resp_ack = client.post(
        "/api/emergency/emg-test-status/status",
        json={"status": "EMERGENCY_ACKNOWLEDGED", "notes": "Attending physician triage initiated"},
        headers=city_doc_headers,
    )
    assert resp_ack.status_code == 200
    assert db_store["emergencyAlerts"]["emg-test-status"]["status"] == "EMERGENCY_ACKNOWLEDGED"

    # 2. Update to AMBULANCE_DISPATCHED
    resp_amb = client.post(
        "/api/emergency/emg-test-status/status",
        json={"status": "AMBULANCE_DISPATCHED", "notes": "Trauma team dispatched with paramedic MED-1"},
        headers=city_doc_headers,
    )
    assert resp_amb.status_code == 200
    assert db_store["emergencyAlerts"]["emg-test-status"]["status"] == "AMBULANCE_DISPATCHED"

    # 3. Resolve emergency
    resp_res = client.post(
        "/api/emergency/emg-test-status/status",
        json={"status": "RESOLVED", "notes": "Patient stabilized in cardiac care unit"},
        headers=city_doc_headers,
    )
    assert resp_res.status_code == 200
    assert db_store["emergencyAlerts"]["emg-test-status"]["status"] == "RESOLVED"
    # Patient activeEmergency must be cleared
    assert db_store["patients"]["PT-CITY-01"].get("activeEmergency") is None

    # 4. Fetch audit trail
    resp_audit = client.get("/api/emergency/emg-test-status/audit", headers=city_doc_headers)
    assert resp_audit.status_code == 200
    trail = resp_audit.get_json()["auditLog"]
    actions = [entry["action"] for entry in trail]
    assert "STATUS_CHANGED_TO_EMERGENCY_ACKNOWLEDGED" in actions
    assert "STATUS_CHANGED_TO_AMBULANCE_DISPATCHED" in actions
    assert "STATUS_CHANGED_TO_RESOLVED" in actions


# ============================================================================
# 10. PATIENT ACCIDENTAL SOS CANCELLATION
# ============================================================================
def test_patient_can_cancel_own_sos(client, db_store):
    db_store["emergencyAlerts"]["emg-cancel-me"] = {
        "alertId": "emg-cancel-me",
        "patientId": "PT-CITY-01",
        "hospitalId": "HOSP-CITY-01",
        "status": "CRITICAL",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "auditLog": [],
    }
    db_store["patients"]["PT-CITY-01"]["activeEmergency"] = {"alertId": "emg-cancel-me"}

    patient_headers = auth_header({
        "id": "PT-CITY-01",
        "patientId": "PT-CITY-01",
        "role": "patient",
        "email": "aarav@patient.org",
        "name": "Aarav Gupta",
    })

    # Patient cancels own alert
    resp = client.post(
        "/api/emergency/emg-cancel-me/status",
        json={"status": "CANCELLED", "notes": "Accidental button press, false alarm."},
        headers=patient_headers,
    )
    assert resp.status_code == 200
    assert db_store["emergencyAlerts"]["emg-cancel-me"]["status"] == "CANCELLED"
    assert db_store["patients"]["PT-CITY-01"].get("activeEmergency") is None

    # Patient from another hospital cannot cancel this alert
    other_patient_headers = auth_header({
        "id": "PT-METRO-02",
        "patientId": "PT-METRO-02",
        "role": "patient",
        "email": "meera@patient.org",
    })
    resp_unauth = client.post(
        "/api/emergency/emg-cancel-me/status",
        json={"status": "CANCELLED"},
        headers=other_patient_headers,
    )
    assert resp_unauth.status_code == 403


# ============================================================================
# 11. SIMULATED PROVIDER SUCCESS (TRUTHFUL QUEUED / SENT STATUS)
# ============================================================================
def test_simulated_provider_success(client, db_store, monkeypatch):
    """Verifies that when SMS provider accepts message, it reports QUEUED/SENT and NOT prematurely DELIVERED."""
    class MockMessage:
        sid = "SM_TEST_SUCCESS_999"
        status = "queued"

    class MockTwilioMessages:
        @staticmethod
        def create(**kwargs):
            return MockMessage()

    class MockTwilioClient:
        messages = MockTwilioMessages()

    monkeypatch.setattr(backend_app, "twilio_client", MockTwilioClient())
    monkeypatch.setattr(backend_app, "TWILIO_PHONE_FROM", "+15550001111")

    headers = auth_header({
        "id": "PT-CITY-01",
        "patientId": "PT-CITY-01",
        "role": "patient",
        "email": "aarav@patient.org",
        "name": "Aarav Gupta",
    })

    payload = {
        "patientId": "PT-CITY-01",
        "triggerReason": "Acute cardiac tachycardia",
        "sosContacts": [{"name": "Emergency Relative", "phone": "+919876543211"}],
    }

    resp = client.post("/api/emergency/trigger", json=payload, headers=headers)
    assert resp.status_code in (200, 201)
    data = resp.get_json()["data"]
    delivery = data["deliveryStatus"]

    # Must accurately report provider's status (QUEUED) and not claim false DELIVERED
    assert delivery["smsOverallStatus"] == "QUEUED"
    assert delivery["sms"][0]["status"] == "QUEUED"
    assert delivery["sms"][0]["sid"] == "SM_TEST_SUCCESS_999"


# ============================================================================
# 12. SIMULATED PROVIDER FAILURE
# ============================================================================
def test_simulated_provider_failure(client, db_store, monkeypatch):
    """Verifies that provider API failures do not fail the emergency broadcast or corrupt database records."""
    class FailingTwilioMessages:
        @staticmethod
        def create(**kwargs):
            raise RuntimeError("Twilio Gateway 503: Service Unavailable")

    class FailingTwilioClient:
        messages = FailingTwilioMessages()

    monkeypatch.setattr(backend_app, "twilio_client", FailingTwilioClient())
    monkeypatch.setattr(backend_app, "TWILIO_PHONE_FROM", "+15550001111")

    headers = auth_header({
        "id": "PT-CITY-01",
        "patientId": "PT-CITY-01",
        "role": "patient",
        "email": "aarav@patient.org",
        "name": "Aarav Gupta",
    })

    payload = {
        "patientId": "PT-CITY-01",
        "triggerReason": "Arrhythmia alarm",
        "sosContacts": [{"name": "Emergency Relative", "phone": "+919876543211"}],
    }

    resp = client.post("/api/emergency/trigger", json=payload, headers=headers)
    # The HTTP call succeeds: patient emergency record is created despite SMS vendor outage
    assert resp.status_code in (200, 201)
    data = resp.get_json()["data"]
    delivery = data["deliveryStatus"]

    assert delivery["smsOverallStatus"] == "FAILED"
    assert delivery["sms"][0]["status"] == "PROVIDER_ERROR"
    assert "Service Unavailable" in delivery["sms"][0]["error"]
    # Fallback instructions are present
    assert data["fallbackInstructions"]["emergencyAmbulance"] == "108"
    assert data["fallbackInstructions"]["nationalEmergency"] == "112"


# ============================================================================
# 13. NETWORK TIMEOUT DURING PROVIDER NOTIFICATION
# ============================================================================
def test_provider_network_timeout(client, db_store, monkeypatch):
    """Verifies that provider network socket timeouts fail gracefully without crashing emergency triage."""
    class TimingOutMessages:
        @staticmethod
        def create(**kwargs):
            raise TimeoutError("Socket connection to provider timed out after 5.0 seconds")

    class TimingOutTwilioClient:
        messages = TimingOutMessages()

    monkeypatch.setattr(backend_app, "twilio_client", TimingOutTwilioClient())
    monkeypatch.setattr(backend_app, "TWILIO_PHONE_FROM", "+15550001111")

    headers = auth_header({
        "id": "PT-CITY-01",
        "patientId": "PT-CITY-01",
        "role": "patient",
        "email": "aarav@patient.org",
        "name": "Aarav Gupta",
    })

    payload = {
        "patientId": "PT-CITY-01",
        "triggerReason": "Telemetry sync crisis",
        "sosContacts": [{"name": "Relative", "phone": "+919876543211"}],
    }

    resp = client.post("/api/emergency/trigger", json=payload, headers=headers)
    assert resp.status_code in (200, 201)
    data = resp.get_json()["data"]
    delivery = data["deliveryStatus"]

    assert delivery["smsOverallStatus"] == "FAILED"
    assert delivery["sms"][0]["status"] == "PROVIDER_ERROR"
    assert "timed out" in delivery["sms"][0]["error"].lower()


# ============================================================================
# 14. RETRY BEHAVIOR AND IDEMPOTENCY
# ============================================================================
def test_retry_behavior_idempotent(client, db_store):
    """Verifies that retrying an alert with the same alertId is idempotent and does not create duplicate alerts."""
    headers = auth_header({
        "id": "PT-CITY-01",
        "patientId": "PT-CITY-01",
        "role": "patient",
        "email": "aarav@patient.org",
        "name": "Aarav Gupta",
    })

    retry_alert_id = "SOS-RETRY-TEST-001"
    payload1 = {
        "alertId": retry_alert_id,
        "patientId": "PT-CITY-01",
        "triggerReason": "Severe dizziness and low pulse",
        "location": {"latitude": 28.6139, "longitude": 77.2090, "accuracy": 15},
    }

    # Initial transmission
    resp1 = client.post("/api/emergency/trigger", json=payload1, headers=headers)
    assert resp1.status_code in (200, 201)
    data1 = resp1.get_json()
    assert data1["data"]["alertId"] == retry_alert_id

    # Client retry with identical alertId
    payload2 = {
        "alertId": retry_alert_id,
        "patientId": "PT-CITY-01",
        "triggerReason": "Severe dizziness and low pulse (Client Retry)",
        "location": {"latitude": 28.6140, "longitude": 77.2092, "accuracy": 9},
    }
    resp2 = client.post("/api/emergency/trigger", json=payload2, headers=headers)
    assert resp2.status_code in (200, 201)
    data2 = resp2.get_json()

    # Deduplication must be acknowledged and existing record returned
    assert data2.get("duplicatePrevented") is True
    assert data2["data"]["alertId"] == retry_alert_id
    assert data2["data"]["location"]["accuracy"] == 9

    # Total emergency alerts count for this ID in db_store must remain 1
    matching_alerts = [k for k in db_store["emergencyAlerts"] if k == retry_alert_id]
    assert len(matching_alerts) == 1


# ============================================================================
# 15. BACKEND RESTART AND RECOVERY
# ============================================================================
def test_backend_restart_and_recovery(client, db_store):
    """Verifies that active emergencies persist and recover across simulated server restarts."""
    active_alert = {
        "alertId": "emg-recovery-persist-01",
        "patientId": "PT-CITY-01",
        "patientName": "Aarav Gupta",
        "hospitalId": "HOSP-CITY-01",
        "hospitalName": "City General Medical Center",
        "doctorId": "DOC-CITY-01",
        "status": "CRITICAL",
        "triageStatus": "PENDING_REVIEW",
        "triggerReason": "Post-restart recovery verification",
        "location": {"latitude": 28.6139, "longitude": 77.2090, "accuracy": 10},
        "createdAt": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
    }
    db_store["emergencyAlerts"]["emg-recovery-persist-01"] = active_alert
    db_store["patients"]["PT-CITY-01"]["activeEmergency"] = active_alert

    # Doctor queries active emergencies after restart
    doc_headers = auth_header({
        "id": "DOC-CITY-01",
        "doctorId": "DOC-CITY-01",
        "role": "doctor",
        "hospitalId": "HOSP-CITY-01",
        "email": "dr.rao@citygeneral.org",
    })

    resp = client.get("/api/emergency/active", headers=doc_headers)
    assert resp.status_code == 200
    json_data = resp.get_json()
    active_list = json_data.get("emergencies") or json_data.get("data") or []
    alert_ids = [a["alertId"] for a in active_list]
    assert "emg-recovery-persist-01" in alert_ids

    # Query specific alert
    resp_single = client.get("/api/emergency/emg-recovery-persist-01", headers=doc_headers)
    assert resp_single.status_code == 200
    assert resp_single.get_json()["data"]["triggerReason"] == "Post-restart recovery verification"

