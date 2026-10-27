import pytest
import sys
import time
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
                "name": "City General Admin",
                "role": "hospital_admin",
                "hospitalId": "HOSP-CITY-01",
                "hospitalName": "City General Medical Center",
                "passwordHash": generate_password_hash("CityAdminPass123!"),
                "isActive": True,
            },
            "ADMIN-METRO-02": {
                "id": "ADMIN-METRO-02",
                "email": "admin@metroapex.org",
                "name": "Metro Apex Admin",
                "role": "hospital_admin",
                "hospitalId": "HOSP-METRO-02",
                "hospitalName": "Metro Apex Superspeciality Hospital",
                "passwordHash": generate_password_hash("MetroAdminPass123!"),
                "isActive": True,
            },
        },
        "hospitals": {
            "HOSP-CITY-01": {
                "id": "HOSP-CITY-01",
                "name": "City General Medical Center",
                "contactEmail": "desk@citygeneral.org",
                "phone": "+911122334455",
            },
            "HOSP-METRO-02": {
                "id": "HOSP-METRO-02",
                "name": "Metro Apex Superspeciality Hospital",
                "contactEmail": "desk@metroapex.org",
                "phone": "+911199887766",
            },
        },
        "doctor": {
            "dr,rao@citygeneral,org": {
                "id": "DOC-CITY-01",
                "email": "dr.rao@citygeneral.org",
                "name": "Dr. Ananya Rao",
                "specialization": "Cardiology",
                "hospitalId": "HOSP-CITY-01",
                "hospitalName": "City General Medical Center",
                "department": "Cardiology Ward",
                "status": "active",
            },
            "dr,sharma@metroapex,org": {
                "id": "DOC-METRO-02",
                "email": "dr.sharma@metroapex.org",
                "name": "Dr. Vikram Sharma",
                "specialization": "Internal Medicine",
                "hospitalId": "HOSP-METRO-02",
                "hospitalName": "Metro Apex Superspeciality Hospital",
                "department": "Critical Care",
                "status": "active",
            },
        },
        "patient": {
            "PT-CITY-01": {
                "id": "PT-CITY-01",
                "patientId": "PT-CITY-01",
                "name": "Aarav Gupta",
                "email": "aarav@patient.org",
                "phone": "+919811122233",
                "hospitalId": "HOSP-CITY-01",
                "assignedDoctorId": "DOC-CITY-01",
                "doctorEmail": "dr.rao@citygeneral.org",
                "status": "admitted",
            },
            "PT-METRO-02": {
                "id": "PT-METRO-02",
                "patientId": "PT-METRO-02",
                "name": "Meera Patel",
                "email": "meera@patient.org",
                "phone": "+919822233344",
                "hospitalId": "HOSP-METRO-02",
                "assignedDoctorId": "DOC-METRO-02",
                "doctorEmail": "dr.sharma@metroapex.org",
                "status": "admitted",
            },
        },
        "devices": {},
        "deviceTelemetry": {},
        "emergencyAlerts": {},
        "securityAuditLogs": {},
    }
    store["patients"] = store["patient"]
    return store


@pytest.fixture()
def client(monkeypatch, db_store):
    monkeypatch.setattr(backend_app, "_admin_collection_reference", lambda: FakeRef(db_store).child("admins"))
    monkeypatch.setattr(backend_app, "_hospitals_collection_reference", lambda: FakeRef(db_store).child("hospitals"))
    monkeypatch.setattr(backend_app, "_doctor_collection_reference", lambda: FakeRef(db_store).child("doctor"))
    monkeypatch.setattr(backend_app, "_patient_collection_reference", lambda: FakeRef(db_store).child("patient"))
    monkeypatch.setattr(backend_app, "_devices_collection_reference", lambda: FakeRef(db_store).child("devices"))
    monkeypatch.setattr(backend_app, "_device_telemetry_reference", lambda pid: FakeRef(db_store).child("deviceTelemetry").child(pid))

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
# 1. HARDWARE DEVICE PROVISIONING & REGISTRY
# ============================================================================
def test_device_registration_by_admin(client, db_store):
    """Hospital admin or doctor can register a wearable device into inventory."""
    headers = auth_header({
        "id": "ADMIN-CITY-01",
        "email": "admin@citygeneral.org",
        "role": "hospital_admin",
        "hospitalId": "HOSP-CITY-01",
    })

    payload = {
        "deviceId": "DEV-WB-CITY-001",
        "deviceModel": "SmartHealth-Biomonitor-Pro",
        "name": "Ward 4 Continuous ECG & SpO2 Monitor",
        "firmwareVersion": "2.1.0",
        "hospitalId": "HOSP-CITY-01",
    }

    resp = client.post("/api/devices/register", json=payload, headers=headers)
    assert resp.status_code in (200, 201), resp.get_json()
    data = resp.get_json()
    assert data["status"] == "success"
    dev_info = data["data"]

    assert dev_info["deviceId"] == "DEV-WB-CITY-001"
    assert dev_info["deviceModel"] == "SmartHealth-Biomonitor-Pro"
    assert dev_info["hospitalId"] == "HOSP-CITY-01"
    assert dev_info["status"] == "UNPAIRED"
    assert "deviceToken" in dev_info
    assert len(dev_info["deviceToken"]) > 10

    # Ensure device token is hashed in registry (never plaintext)
    saved_dev = db_store["devices"]["DEV-WB-CITY-001"]
    assert "tokenHash" in saved_dev
    assert saved_dev["tokenHash"] != dev_info["deviceToken"]
    assert saved_dev["active"] is True


# ============================================================================
# 2. PATIENT-DEVICE SECURE PAIRING & UNPAIRING WORKFLOW
# ============================================================================
def test_patient_device_pairing_and_unpairing(client, db_store):
    """Doctor or patient pairs device to patient record, verifies assignment, then unpairs."""
    # Pre-register device
    dev_token = "hw_sec_city_aarav_001"
    token_hash = backend_app._hash_device_token(dev_token)
    db_store["devices"]["DEV-AARAV-01"] = {
        "deviceId": "DEV-AARAV-01",
        "deviceModel": "Wearable-Biomonitor-v1",
        "hospitalId": "HOSP-CITY-01",
        "tokenHash": token_hash,
        "active": True,
        "status": "UNPAIRED",
    }

    doc_headers = auth_header({
        "id": "DOC-CITY-01",
        "doctorId": "dr.rao@citygeneral.org",
        "email": "dr.rao@citygeneral.org",
        "role": "doctor",
        "hospitalId": "HOSP-CITY-01",
    })

    # Pair device to patient
    pair_payload = {
        "deviceId": "DEV-AARAV-01",
        "patientId": "PT-CITY-01",
    }
    resp = client.post("/api/devices/pair", json=pair_payload, headers=doc_headers)
    assert resp.status_code == 200, resp.get_json()
    pair_data = resp.get_json()["data"]
    assert pair_data["status"] == "PAIRED"
    assert pair_data["patientId"] == "PT-CITY-01"

    # Verify patient record now reflects the paired device
    patient = db_store["patient"]["PT-CITY-01"]
    assert patient["deviceId"] == "DEV-AARAV-01"
    assert patient["pairedDeviceId"] == "DEV-AARAV-01"
    assert patient["deviceConnected"] is True

    # Query patient device endpoint
    pat_headers = auth_header({
        "id": "PT-CITY-01",
        "patientId": "PT-CITY-01",
        "role": "patient",
        "email": "aarav@patient.org",
    })
    resp_pat_dev = client.get("/api/patient/PT-CITY-01/device", headers=pat_headers)
    assert resp_pat_dev.status_code == 200
    pat_dev_data = resp_pat_dev.get_json()["data"]
    assert pat_dev_data["linked"] is True
    assert pat_dev_data["deviceId"] == "DEV-AARAV-01"
    assert "tokenHash" not in pat_dev_data  # Secret hash not leaked

    # Unpair device
    resp_unpair = client.post("/api/devices/unpair", json={"patientId": "PT-CITY-01", "deviceId": "DEV-AARAV-01"}, headers=doc_headers)
    assert resp_unpair.status_code == 200
    assert resp_unpair.get_json()["data"]["status"] == "UNPAIRED"

    # Patient record reflects disconnection
    patient_after = db_store["patient"]["PT-CITY-01"]
    assert patient_after["deviceId"] is None
    assert patient_after["deviceConnected"] is False


# ============================================================================
# 3. CROSS-HOSPITAL DEVICE ISOLATION (ZERO CROSS-HOSPITAL HIJACKING)
# ============================================================================
def test_cross_hospital_device_isolation(client, db_store):
    """Doctor or admin from Hospital B cannot pair a device belonging to Hospital A."""
    db_store["devices"]["DEV-HOSP-A-EXCLUSIVE"] = {
        "deviceId": "DEV-HOSP-A-EXCLUSIVE",
        "hospitalId": "HOSP-CITY-01",
        "tokenHash": "dummy_hash",
        "active": True,
        "status": "UNPAIRED",
    }

    doc_metro_headers = auth_header({
        "id": "DOC-METRO-02",
        "doctorId": "dr.sharma@metroapex.org",
        "email": "dr.sharma@metroapex.org",
        "role": "doctor",
        "hospitalId": "HOSP-METRO-02",
    })

    # Attempt to pair City General's device to Metro Apex patient
    payload = {
        "deviceId": "DEV-HOSP-A-EXCLUSIVE",
        "patientId": "PT-METRO-02",
    }
    resp = client.post("/api/devices/pair", json=payload, headers=doc_metro_headers)
    assert resp.status_code == 403
    assert "Access denied" in resp.get_json()["message"]


# ============================================================================
# 4. AUTHENTICATED TELEMETRY INGESTION (HARDWARE WEARABLE / BLE GATEWAY)
# ============================================================================
def test_authenticated_telemetry_ingestion(client, db_store):
    """Device transmits multi-parameter vitals authenticated via X-Device-ID & X-Device-Token."""
    raw_token = "valid_secure_device_secret_token_123"
    token_hash = backend_app._hash_device_token(raw_token)
    db_store["devices"]["DEV-SENS-01"] = {
        "deviceId": "DEV-SENS-01",
        "patientId": "PT-CITY-01",
        "tokenHash": token_hash,
        "active": True,
        "hospitalId": "HOSP-CITY-01",
    }
    db_store["patient"]["PT-CITY-01"]["deviceId"] = "DEV-SENS-01"

    device_headers = {
        "X-Device-Id": "DEV-SENS-01",
        "X-Device-Token": raw_token,
        "Content-Type": "application/json",
    }

    telemetry_payload = {
        "heartRate": 74.0,
        "spo2": 98.5,
        "temperature": 36.8,
        "unit": "C",
        "batteryLevel": 88,
        "isCharging": False,
        "signalQuality": "EXCELLENT",
        "sequenceNumber": 101,
        "ecgSamples": [512, 514, 520, 528, 512, 490, 750, 380, 512, 520],
        "leadsOff": False,
        "source": "HARDWARE_DEVICE",
    }

    resp = client.post("/api/devices/telemetry", json=telemetry_payload, headers=device_headers)
    assert resp.status_code == 200, resp.get_json()
    res_data = resp.get_json()
    assert res_data["status"] == "success"
    assert res_data["patientId"] == "PT-CITY-01"
    assert res_data["isSimulated"] is False

    measurements = res_data["measurements"]
    assert measurements["heartRate"]["value"] == 74.0
    assert measurements["heartRate"]["unit"] == "BPM"
    assert measurements["heartRate"]["status"] == "NORMAL"
    assert measurements["spo2"]["value"] == 98.5
    assert measurements["temperature"]["value"] == 36.8
    assert measurements["temperature"]["unit"] == "C"

    # Verify timestamped historical storage in database
    pat_telemetry = db_store["deviceTelemetry"]["PT-CITY-01"]
    assert len(pat_telemetry) >= 1
    latest_record = list(pat_telemetry.values())[-1]
    assert latest_record["deviceId"] == "DEV-SENS-01"
    assert latest_record["battery"]["level"] == 88

    # Verify device registry lastSeen updated
    dev_record = db_store["devices"]["DEV-SENS-01"]
    assert dev_record["lastSeen"] is not None
    assert dev_record["batteryLevel"] == 88


# ============================================================================
# 5. DEVICE CREDENTIAL AUTHENTICATION REJECTION
# ============================================================================
def test_device_auth_failure_rejected(client, db_store):
    """Incoming sensor measurement with bad or missing device token is rejected with 401."""
    db_store["devices"]["DEV-AUTH-CHECK"] = {
        "deviceId": "DEV-AUTH-CHECK",
        "patientId": "PT-CITY-01",
        "tokenHash": backend_app._hash_device_token("secret_token_correct"),
        "active": True,
    }

    # Wrong token
    bad_headers = {
        "X-Device-Id": "DEV-AUTH-CHECK",
        "X-Device-Token": "wrong_invalid_secret_token",
    }
    resp = client.post("/api/devices/telemetry", json={"heartRate": 72}, headers=bad_headers)
    assert resp.status_code == 401
    assert "Invalid device authentication token" in resp.get_json()["message"]

    # Missing token
    resp_missing = client.post("/api/devices/telemetry", json={"heartRate": 72})
    assert resp_missing.status_code == 401


# ============================================================================
# 6. RATE LIMITING & DUPLICATE TELEMETRY SUPPRESSION
# ============================================================================
def test_telemetry_rate_limiting_and_duplicates(client, db_store):
    """Device sending duplicate sequence numbers or flooding requests is throttled."""
    raw_token = "token_rate_limit_001"
    token_hash = backend_app._hash_device_token(raw_token)
    db_store["devices"]["DEV-RATE-01"] = {
        "deviceId": "DEV-RATE-01",
        "patientId": "PT-CITY-01",
        "tokenHash": token_hash,
        "active": True,
    }

    device_headers = {
        "X-Device-Id": "DEV-RATE-01",
        "X-Device-Token": raw_token,
    }

    payload = {
        "heartRate": 80.0,
        "spo2": 97.0,
        "temperature": 36.6,
        "sequenceNumber": 5055,
    }

    # First send succeeds
    resp1 = client.post("/api/devices/telemetry", json=payload, headers=device_headers)
    assert resp1.status_code == 200

    # Immediate second send (< 100ms) with SAME sequenceNumber: rejected as rate limit or duplicate
    resp2 = client.post("/api/devices/telemetry", json=payload, headers=device_headers)
    assert resp2.status_code in (409, 429)


# ============================================================================
# 7. PHYSIOLOGICAL RANGE VALIDATION & UNIT CONVERSION
# ============================================================================
def test_physiological_range_validation_and_units(client, db_store):
    """Server validates acceptable physiological values and supports Celsius & Fahrenheit."""
    raw_token = "token_physio_001"
    token_hash = backend_app._hash_device_token(raw_token)
    db_store["devices"]["DEV-PHYSIO-01"] = {
        "deviceId": "DEV-PHYSIO-01",
        "patientId": "PT-CITY-01",
        "tokenHash": token_hash,
        "active": True,
    }

    device_headers = {
        "X-Device-Id": "DEV-PHYSIO-01",
        "X-Device-Token": raw_token,
    }

    # Reject absurd heart rate (e.g. 400 BPM)
    resp_bad_hr = client.post("/api/devices/telemetry", json={"heartRate": 400, "spo2": 98, "temperature": 36.6}, headers=device_headers)
    assert resp_bad_hr.status_code == 400
    assert "Heart rate value out of physiological range" in resp_bad_hr.get_json()["message"]

    time.sleep(0.15)
    # Reject invalid SpO2 (e.g. 115%)
    resp_bad_spo2 = client.post("/api/devices/telemetry", json={"heartRate": 75, "spo2": 115, "temperature": 36.6}, headers=device_headers)
    assert resp_bad_spo2.status_code == 400
    assert "SpO2 value out of physiological range" in resp_bad_spo2.get_json()["message"]

    time.sleep(0.15)
    # Support Fahrenheit temperature: 98.6°F -> normalized to 37.0°C
    resp_f = client.post("/api/devices/telemetry", json={
        "heartRate": 72,
        "spo2": 98,
        "temperature": 98.6,
        "unit": "F",
        "sequenceNumber": 801,
    }, headers=device_headers)
    assert resp_f.status_code == 200
    temp_measure = resp_f.get_json()["measurements"]["temperature"]
    assert temp_measure["unit"] == "C"
    assert abs(temp_measure["value"] - 37.0) < 0.2


# ============================================================================
# 8. HISTORICAL TELEMETRY API & CLINICAL CHARTS ACCESS CONTROL
# ============================================================================
def test_historical_telemetry_api(client, db_store):
    """Patients and assigned doctors can fetch historical telemetry; cross-patient access forbidden."""
    db_store["deviceTelemetry"]["PT-CITY-01"] = {
        "1700000000000": {
            "recordId": "tel-1",
            "patientId": "PT-CITY-01",
            "timestamp": "2026-10-22 10:00:00",
            "measurements": {
                "heartRate": {"value": 72, "unit": "BPM"},
                "spo2": {"value": 98, "unit": "%"},
                "temperature": {"value": 36.6, "unit": "C"},
            },
            "quality": {"signalQuality": "EXCELLENT"},
        },
        "1700000010000": {
            "recordId": "tel-2",
            "patientId": "PT-CITY-01",
            "timestamp": "2026-10-22 10:05:00",
            "measurements": {
                "heartRate": {"value": 78, "unit": "BPM"},
                "spo2": {"value": 97, "unit": "%"},
                "temperature": {"value": 36.7, "unit": "C"},
            },
            "quality": {"signalQuality": "EXCELLENT"},
        },
    }

    # Patient Aarav queries own telemetry history
    pat_headers = auth_header({
        "id": "PT-CITY-01",
        "patientId": "PT-CITY-01",
        "role": "patient",
        "email": "aarav@patient.org",
    })
    resp = client.get("/api/patient/PT-CITY-01/device-telemetry?metric=heartRate", headers=pat_headers)
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert data["count"] == 2
    assert data["metric"] == "heartrate"
    assert data["history"][0]["heartRate"] == 72
    assert data["history"][1]["heartRate"] == 78

    # Doctor Rao (assigned) queries Aarav's telemetry history
    doc_headers = auth_header({
        "id": "DOC-CITY-01",
        "doctorId": "dr.rao@citygeneral.org",
        "email": "dr.rao@citygeneral.org",
        "role": "doctor",
        "hospitalId": "HOSP-CITY-01",
    })
    resp_doc = client.get("/api/patient/PT-CITY-01/device-telemetry", headers=doc_headers)
    assert resp_doc.status_code == 200
    assert resp_doc.get_json()["data"]["count"] == 2

    # Doctor Sharma (Metro Apex) cannot access Aarav's telemetry history
    doc_other_headers = auth_header({
        "id": "DOC-METRO-02",
        "doctorId": "dr.sharma@metroapex.org",
        "email": "dr.sharma@metroapex.org",
        "role": "doctor",
        "hospitalId": "HOSP-METRO-02",
    })
    resp_forbidden = client.get("/api/patient/PT-CITY-01/device-telemetry", headers=doc_other_headers)
    assert resp_forbidden.status_code == 403


# ============================================================================
# 9. DEVELOPMENT SYNTHETIC SIMULATOR SAFETY (NO FALSE EMERGENCY ALERTS)
# ============================================================================
def test_synthetic_simulator_safety(client, db_store):
    """Simulator produces synthetic telemetry labeled as such and never triggers emergency dispatches."""
    pat_headers = auth_header({
        "id": "PT-CITY-01",
        "patientId": "PT-CITY-01",
        "role": "patient",
        "email": "aarav@patient.org",
    })

    sim_payload = {
        "patientId": "PT-CITY-01",
        "scenario": "CRITICAL_CRISIS",  # Extreme vitals (HR > 160, SpO2 < 80)
    }

    resp = client.post("/api/devices/simulate", json=sim_payload, headers=pat_headers)
    assert resp.status_code == 200
    sim_data = resp.get_json()["data"]

    assert sim_data["isSimulated"] is True
    assert sim_data["source"] == "SYNTHETIC_SIMULATOR"
    assert "Development-only" in sim_data["syntheticNotice"]
    assert sim_data["measurements"]["heartRate"]["value"] > 140
    assert sim_data["measurements"]["spo2"]["value"] < 88

    # CRITICAL VERIFICATION: No false emergency alert created in emergencyAlerts
    assert len(db_store["emergencyAlerts"]) == 0
    # Patient activeEmergency must NOT be set
    assert "activeEmergency" not in db_store["patient"]["PT-CITY-01"]


# ============================================================================
# 10. DEVICE HEALTH & STATUS ENDPOINT
# ============================================================================
def test_device_status_endpoint(client, db_store):
    """Retrieve comprehensive device connection state, battery, and sensor diagnostics."""
    now_iso = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    db_store["devices"]["DEV-HEALTH-01"] = {
        "deviceId": "DEV-HEALTH-01",
        "deviceModel": "SmartHealth-Band-X1",
        "hospitalId": "HOSP-CITY-01",
        "patientId": "PT-CITY-01",
        "batteryLevel": 92,
        "batteryCharging": True,
        "lastSeen": now_iso,
        "status": "PAIRED",
        "active": True,
        "sensorStatus": {
            "heartRate": "OK",
            "spo2": "OK",
            "temperature": "OK",
            "ecg": "OK",
        },
    }

    doc_headers = auth_header({
        "id": "DOC-CITY-01",
        "doctorId": "dr.rao@citygeneral.org",
        "email": "dr.rao@citygeneral.org",
        "role": "doctor",
        "hospitalId": "HOSP-CITY-01",
    })

    resp = client.get("/api/devices/DEV-HEALTH-01/status", headers=doc_headers)
    assert resp.status_code == 200
    status_data = resp.get_json()["data"]

    assert status_data["deviceId"] == "DEV-HEALTH-01"
    assert status_data["connectionState"] == "ONLINE"
    assert status_data["isOnline"] is True
    assert status_data["battery"]["level"] == 92
    assert status_data["battery"]["isCharging"] is True
    assert status_data["sensorStatus"]["heartRate"] == "OK"


# ============================================================================
# 11. ANTI-SPOOFING: DEVICE CANNOT SUBMIT DATA FOR UNAUTHORIZED PATIENTS
# ============================================================================
def test_device_cannot_submit_to_unauthorized_patient(client, db_store):
    """Device paired to Patient A cannot submit sensor data under Patient B's ID."""
    raw_token = "token_anti_spoof_01"
    token_hash = backend_app._hash_device_token(raw_token)
    db_store["devices"]["DEV-SPOOF-01"] = {
        "deviceId": "DEV-SPOOF-01",
        "patientId": "PT-CITY-01",  # Legitimate owner is PT-CITY-01
        "tokenHash": token_hash,
        "active": True,
        "hospitalId": "HOSP-CITY-01",
    }

    device_headers = {
        "X-Device-Id": "DEV-SPOOF-01",
        "X-Device-Token": raw_token,
    }

    # Attempt to submit telemetry on behalf of PT-METRO-02
    spoof_payload = {
        "patientId": "PT-METRO-02",
        "heartRate": 82.0,
        "spo2": 97.0,
        "temperature": 36.6,
    }

    resp = client.post("/api/devices/telemetry", json=spoof_payload, headers=device_headers)
    assert resp.status_code == 403
    assert "Access denied" in resp.get_json()["message"]
    assert "unauthorized patient" in resp.get_json()["message"]


# ============================================================================
# 12. RECONNECTION DUPLICATE SUPPRESSION & BUFFERED DATA HANDLING
# ============================================================================
def test_reconnection_duplicate_safe_suppression(client, db_store):
    """Buffered telemetry retransmitted after Wi-Fi reconnect suppresses duplicates safely."""
    raw_token = "token_reconnect_01"
    token_hash = backend_app._hash_device_token(raw_token)
    db_store["devices"]["DEV-RECON-01"] = {
        "deviceId": "DEV-RECON-01",
        "patientId": "PT-CITY-01",
        "tokenHash": token_hash,
        "active": True,
    }

    device_headers = {
        "X-Device-Id": "DEV-RECON-01",
        "X-Device-Token": raw_token,
    }

    packet = {
        "heartRate": 76.0,
        "spo2": 98.0,
        "temperature": 36.7,
        "sequenceNumber": 9901,
        "timestamp": "2026-10-22 14:00:00",
        "isReconnect": False,
    }

    # First transmission
    resp1 = client.post("/api/devices/telemetry", json=packet, headers=device_headers)
    assert resp1.status_code == 200

    # Device reconnects and flushes same packet marked with isReconnect=True
    packet_reconnect = dict(packet)
    packet_reconnect["isReconnect"] = True

    resp2 = client.post("/api/devices/telemetry", json=packet_reconnect, headers=device_headers)
    assert resp2.status_code == 200
    assert resp2.get_json().get("duplicate") is True
    assert "suppressed during reconnection" in resp2.get_json().get("message", "")


# ============================================================================
# 13. HEALTH MONITORING: STALENESS & CONNECTION STATE DETECTION
# ============================================================================
def test_health_monitoring_staleness_and_connection_state(client, db_store):
    """Platform detects live vs stale device telemetry and includes prototype notice."""
    # 1. Live device reading (updated just now)
    now_iso = datetime.now(timezone.utc).isoformat()
    db_store["patient"]["PT-CITY-01"]["deviceConnected"] = True
    db_store["patient"]["PT-CITY-01"]["updatedAt"] = now_iso

    pat_headers = auth_header({
        "id": "PT-CITY-01",
        "patientId": "PT-CITY-01",
        "role": "patient",
        "email": "aarav@patient.org",
    })

    resp_live = client.get("/api/patient/PT-CITY-01/health-monitoring", headers=pat_headers)
    assert resp_live.status_code == 200
    current_live = resp_live.get_json()["data"]["current"]
    assert current_live["connectionState"] == "LIVE"
    assert current_live["isStale"] is False
    assert current_live["sensorTier"] == "PROTOTYPE_INVESTIGATIONAL"
    assert current_live["isClinicalGrade"] is False

    # 2. Stale device reading (updated 5 minutes ago)
    old_time = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    db_store["patient"]["PT-CITY-01"]["updatedAt"] = old_time

    resp_stale = client.get("/api/patient/PT-CITY-01/health-monitoring", headers=pat_headers)
    assert resp_stale.status_code == 200
    current_stale = resp_stale.get_json()["data"]["current"]
    assert current_stale["connectionState"] == "STALE"
    assert current_stale["isStale"] is True

