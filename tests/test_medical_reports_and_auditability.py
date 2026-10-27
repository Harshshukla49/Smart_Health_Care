import io
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
                "isActive": True,
            },
            "ADMIN-HOSP-01": {
                "id": "ADMIN-HOSP-01",
                "email": "admin@citygeneral.org",
                "name": "City Admin",
                "role": "hospital_admin",
                "hospitalId": "HOSP-CITY-01",
                "isActive": True,
            },
            "ADMIN-HOSP-FOREIGN": {
                "id": "ADMIN-HOSP-FOREIGN",
                "email": "admin@foreignmetro.org",
                "name": "Foreign Admin",
                "role": "hospital_admin",
                "hospitalId": "HOSP-FOREIGN-99",
                "isActive": True,
            },
        },
        "hospitals": {
            "HOSP-CITY-01": {
                "id": "HOSP-CITY-01",
                "hospitalId": "HOSP-CITY-01",
                "name": "City General Medical Center",
                "city": "New Delhi",
                "isActive": True,
            },
            "HOSP-FOREIGN-99": {
                "id": "HOSP-FOREIGN-99",
                "hospitalId": "HOSP-FOREIGN-99",
                "name": "Foreign Metro Health",
                "city": "Mumbai",
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
                "isActive": True,
            },
            "dr,unassigned@citygeneral,org": {
                "id": "DOC-CITY-02",
                "doctorId": "DOC-CITY-02",
                "email": "dr.unassigned@citygeneral.org",
                "name": "Dr. Unassigned Physician",
                "role": "doctor",
                "hospitalId": "HOSP-CITY-01",
                "specialty": "General Medicine",
                "isActive": True,
            },
            "dr,foreign@foreignmetro,org": {
                "id": "DOC-FOREIGN-01",
                "doctorId": "DOC-FOREIGN-01",
                "email": "dr.foreign@foreignmetro.org",
                "name": "Dr. Foreign Doctor",
                "role": "doctor",
                "hospitalId": "HOSP-FOREIGN-99",
                "specialty": "Neurology",
                "isActive": True,
            },
        },
        "patient": {
            "PAT-001": {
                "id": "PAT-001",
                "patientId": "PAT-001",
                "name": "Aarav Sharma",
                "email": "aarav.sharma@example.com",
                "hospitalId": "HOSP-CITY-01",
                "assignedDoctorId": "DOC-CITY-01",
                "assignedDoctorName": "Dr. Ramesh Rao",
                "doctorId": "dr.rao@citygeneral.org",
                "isActive": True,
                "vitals": {
                    "heart_rate": 72.0,
                    "spo2": 98.0,
                    "temperature": 36.8,
                },
                "medicines": [
                    {
                        "id": "MED-1",
                        "medicineName": "Metformin",
                        "dosage": "500mg",
                        "status": "Active",
                    }
                ],
            },
            "PAT-002": {
                "id": "PAT-002",
                "patientId": "PAT-002",
                "name": "Diya Verma",
                "email": "diya.verma@example.com",
                "hospitalId": "HOSP-CITY-01",
                "assignedDoctorId": "DOC-CITY-02",
                "doctorId": "dr.unassigned@citygeneral.org",
                "isActive": True,
            },
            "PAT-FOREIGN": {
                "id": "PAT-FOREIGN",
                "patientId": "PAT-FOREIGN",
                "name": "Foreign Patient",
                "email": "foreign.pat@example.com",
                "hospitalId": "HOSP-FOREIGN-99",
                "assignedDoctorId": "DOC-FOREIGN-01",
                "doctorId": "dr.foreign@foreignmetro.org",
                "isActive": True,
            },
        },
        "medicalReports": {},
        "patientHistory": {},
        "security_audit_logs": {},
    }


@pytest.fixture()
def client(monkeypatch, db_store):
    monkeypatch.setattr(backend_app, "_admin_collection_reference", lambda: FakeRef(db_store).child("admins"))
    monkeypatch.setattr(backend_app, "_hospitals_collection_reference", lambda: FakeRef(db_store).child("hospitals"))
    monkeypatch.setattr(backend_app, "_doctor_collection_reference", lambda: FakeRef(db_store).child("doctor"))
    monkeypatch.setattr(backend_app, "_patient_collection_reference", lambda: FakeRef(db_store).child("patient"))
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
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


# =========================================================================
# 1. AUTHORIZED REPORT ACCESS TESTS
# =========================================================================

def test_authorized_patient_can_view_own_medical_report(client, db_store):
    """Patient can view their own aggregated medical report."""
    headers = _auth_header("patient", id="PAT-001", patientId="PAT-001", hospitalId="HOSP-CITY-01")
    resp = client.get("/api/patient/PAT-001/medical-report", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert data["patient"]["id"] == "PAT-001"
    assert data["patient"]["name"] == "Aarav Sharma"
    assert len(data["medicines"]) >= 1
    assert data["medicines"][0]["medicineName"] == "Metformin"


def test_assigned_doctor_can_view_patient_medical_report(client, db_store):
    """Assigned doctor can view patient's aggregated report."""
    headers = _auth_header("doctor", email="dr.rao@citygeneral.org", doctorId="DOC-CITY-01", hospitalId="HOSP-CITY-01")
    resp = client.get("/api/patient/PAT-001/medical-report", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert data["patient"]["id"] == "PAT-001"


# =========================================================================
# 2. UNAUTHORIZED REPORT ACCESS TESTS
# =========================================================================

def test_unauthenticated_report_access_blocked(client):
    """Unauthenticated requests must be rejected with 401."""
    resp = client.get("/api/patient/PAT-001/medical-report")
    assert resp.status_code == 401
    assert resp.get_json()["status"] == "error"


def test_cross_patient_report_access_blocked(client):
    """Patient 2 cannot access Patient 1's report."""
    headers_pat2 = _auth_header("patient", id="PAT-002", patientId="PAT-002", hospitalId="HOSP-CITY-01")
    resp = client.get("/api/patient/PAT-001/medical-report", headers=headers_pat2)
    assert resp.status_code == 403
    assert resp.get_json()["status"] == "error"
    assert "Access denied" in resp.get_json()["message"]


def test_unassigned_doctor_report_access_blocked(client):
    """Unassigned doctor in the same hospital cannot view report without break-glass."""
    headers_unassigned = _auth_header("doctor", email="dr.unassigned@citygeneral.org", doctorId="DOC-CITY-02", hospitalId="HOSP-CITY-01")
    resp = client.get("/api/patient/PAT-001/medical-report", headers=headers_unassigned)
    assert resp.status_code == 403
    assert resp.get_json()["status"] == "error"
    assert "not assigned" in resp.get_json()["message"]


# =========================================================================
# 3. CROSS-HOSPITAL DATA ISOLATION TESTS
# =========================================================================

def test_foreign_hospital_doctor_report_access_blocked(client):
    """Doctor from Foreign Hospital cannot access City Hospital patient report."""
    headers_foreign_doc = _auth_header("doctor", email="dr.foreign@foreignmetro.org", doctorId="DOC-FOREIGN-01", hospitalId="HOSP-FOREIGN-99")
    resp = client.get("/api/patient/PAT-001/medical-report", headers=headers_foreign_doc)
    assert resp.status_code == 403
    assert "another hospital" in resp.get_json()["message"]


def test_foreign_hospital_admin_report_access_blocked(client):
    """Admin from Foreign Hospital cannot access City Hospital patient report."""
    headers_foreign_admin = _auth_header("hospital_admin", email="admin@foreignmetro.org", id="ADMIN-HOSP-FOREIGN", hospitalId="HOSP-FOREIGN-99")
    resp = client.get("/api/patient/PAT-001/medical-report", headers=headers_foreign_admin)
    assert resp.status_code == 403
    assert "Access denied" in resp.get_json()["message"]


# =========================================================================
# 4. REPORT GENERATION & FAILURE MODES
# =========================================================================

def test_patient_cannot_generate_or_certify_medical_report(client):
    """Patients cannot certify or generate medical reports (clinical role enforcement)."""
    headers = _auth_header("patient", id="PAT-001", patientId="PAT-001", hospitalId="HOSP-CITY-01")
    resp = client.post("/api/patient/PAT-001/medical-report/generate", headers=headers, json={"reportType": "FINAL_CERTIFIED"})
    assert resp.status_code == 403


def test_authorized_doctor_generates_certified_report(client, db_store):
    """Assigned doctor can generate and certify report with hospital tagging and audit trail."""
    headers = _auth_header("doctor", email="dr.rao@citygeneral.org", doctorId="DOC-CITY-01", name="Dr. Ramesh Rao", hospitalId="HOSP-CITY-01")
    payload = {
        "reportType": "FINAL_CERTIFIED",
        "status": "Verified",
        "doctorSpecialty": "Cardiology",
        "clinicalDiagnosis": {
            "provisional": "Sinus Tachycardia",
            "final": "Normotensive Sinus Rhythm",
        },
        "vitals": {"heartRate": 74, "spo2": 98.5},
    }
    resp = client.post("/api/patient/PAT-001/medical-report/generate", headers=headers, json=payload)
    assert resp.status_code == 200
    data = resp.get_json()["data"]["report"]
    assert data["reportId"].startswith("RPT-")
    assert data["patientId"] == "PAT-001"
    assert data["hospitalId"] == "HOSP-CITY-01"
    assert data["doctorName"] == "Dr. Ramesh Rao"
    assert data["status"] == "Verified"

    # Verify history recorded in fake DB
    hist = db_store.get("patientHistory", {}).get("PAT-001", {})
    assert len(hist) > 0


def test_report_generation_nonexistent_patient_fails(client):
    """Report generation for non-existent patient returns 404."""
    headers = _auth_header("doctor", email="dr.rao@citygeneral.org", doctorId="DOC-CITY-01", hospitalId="HOSP-CITY-01")
    resp = client.post("/api/patient/PAT-NONEXISTENT-999/medical-report/generate", headers=headers, json={})
    assert resp.status_code == 404
    assert resp.get_json()["status"] == "error"


# =========================================================================
# 5. DOCUMENT VALIDATION & FILE UPLOAD TESTS
# =========================================================================

def test_document_validation_valid_pdf(client):
    """Valid static PDF document passes validation."""
    from medical_document_validator import validate_medical_document
    valid_pdf_bytes = b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    is_valid, err, meta = validate_medical_document(valid_pdf_bytes, "discharge_summary.pdf", "application/pdf")
    assert is_valid is True
    assert err is None
    assert meta["mimetype"] == "application/pdf"
    assert meta["isStatic"] is True


def test_document_validation_valid_png_and_dicom(client):
    """Valid PNG and DICOM Part 10 files pass validation."""
    from medical_document_validator import validate_medical_document
    valid_png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    is_valid, err, meta = validate_medical_document(valid_png_bytes, "chest_xray.png", "image/png")
    assert is_valid is True
    assert meta["mimetype"] == "image/png"

    # Valid DICOM Part 10: 128 bytes preamble + b"DICM"
    valid_dicom_bytes = (b"\x00" * 128) + b"DICM\x00\x01\x02\x03"
    is_valid, err, meta = validate_medical_document(valid_dicom_bytes, "cardiac_mri.dcm", "application/dicom")
    assert is_valid is True
    assert meta["mimetype"] == "application/dicom"


def test_document_validation_invalid_extension_rejected():
    """Unapproved executable and script extensions are rejected."""
    from medical_document_validator import validate_medical_document
    is_valid, err, _ = validate_medical_document(b"echo 1", "malware.exe")
    assert is_valid is False
    assert "Unsupported document format" in err


def test_document_validation_mime_spoofing_rejected():
    """File disguised as PDF but containing non-PDF bytes is rejected."""
    from medical_document_validator import validate_medical_document
    fake_pdf = b"MZ\x90\x00\x03\x00\x00\x00This is an executable disguised as PDF"
    is_valid, err, _ = validate_medical_document(fake_pdf, "report.pdf", "application/pdf")
    assert is_valid is False
    assert "Invalid file structure" in err or "mismatch" in err


def test_document_validation_active_javascript_in_pdf_rejected():
    """PDF containing active /JavaScript or /Launch scripts is rejected."""
    from medical_document_validator import validate_medical_document
    malicious_pdf = b"%PDF-1.4\n1 0 obj\n<< /Type /Action /S /JavaScript /JS (app.alert('XSS')) >>\nendobj"
    is_valid, err, _ = validate_medical_document(malicious_pdf, "interactive_report.pdf", "application/pdf")
    assert is_valid is False
    assert "forbidden active content" in err


def test_document_validation_oversized_file_rejected():
    """File exceeding the 10MB limit is rejected."""
    from medical_document_validator import validate_medical_document
    # 11 MB simulated PDF
    oversized_bytes = b"%PDF-" + (b"0" * (11 * 1024 * 1024))
    is_valid, err, _ = validate_medical_document(oversized_bytes, "giant_scan.pdf", "application/pdf")
    assert is_valid is False
    assert "exceeds maximum allowed limit" in err


def test_document_upload_attachment_api_endpoint(client):
    """API endpoint /api/patient/<id>/documents/validate-attachment validates binary payload."""
    headers = _auth_header("doctor", email="dr.rao@citygeneral.org", doctorId="DOC-CITY-01", hospitalId="HOSP-CITY-01")
    headers["Content-Type"] = "application/pdf"
    headers["X-File-Name"] = "lab_report.pdf"

    valid_pdf_bytes = b"%PDF-1.7\nTest Hospital Laboratory Results\n%%EOF"
    resp = client.post(
        "/api/patient/PAT-001/documents/validate-attachment",
        headers=headers,
        data=valid_pdf_bytes,
    )
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "success"
    assert resp.get_json()["data"]["metadata"]["mimetype"] == "application/pdf"


# =========================================================================
# 6. SECURE PRE-SIGNED OBJECT STORAGE UPLOAD WORKFLOW
# =========================================================================

def test_presign_document_upload_authorized(client):
    """Authorized doctor or patient can request a secure pre-signed upload URL."""
    headers = _auth_header("doctor", email="dr.rao@citygeneral.org", doctorId="DOC-CITY-01", hospitalId="HOSP-CITY-01")
    payload = {
        "filename": "echocardiogram.pdf",
        "mimetype": "application/pdf",
        "sizeBytes": 1024 * 500, # 500 KB
    }
    resp = client.post("/api/patient/PAT-001/documents/presign-upload", headers=headers, json=payload)
    assert resp.status_code == 200
    upload = resp.get_json()["data"]["upload"]
    assert upload["documentId"].startswith("DOC-")
    assert upload["hospitalId"] == "HOSP-CITY-01"
    assert "token=" in upload["uploadUrl"]
    assert upload["requiredHeaders"]["x-amz-server-side-encryption"] == "aws:kms"


def test_presign_document_upload_unauthorized_cross_patient_blocked(client):
    """Patient 2 cannot request upload descriptor for Patient 1."""
    headers_pat2 = _auth_header("patient", id="PAT-002", patientId="PAT-002", hospitalId="HOSP-CITY-01")
    payload = {
        "filename": "blood_panel.pdf",
        "mimetype": "application/pdf",
        "sizeBytes": 2048,
    }
    resp = client.post("/api/patient/PAT-001/documents/presign-upload", headers=headers_pat2, json=payload)
    assert resp.status_code == 403


# =========================================================================
# 7. AUDIT LOG INTEGRITY & CREDENTIAL SANITIZATION
# =========================================================================

def test_audit_log_credential_and_token_sanitization():
    """Audit logging must sanitize passwords and tokens, never storing them in plaintext."""
    from app import _sanitize_audit_details

    leak_candidate_1 = "User login attempt with password=SecretPassword123! from IP"
    sanitized_1 = _sanitize_audit_details(leak_candidate_1)
    assert "SecretPassword123!" not in sanitized_1
    assert "password=[REDACTED]" in sanitized_1

    leak_candidate_2 = "Failed API request with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid"
    sanitized_2 = _sanitize_audit_details(leak_candidate_2)
    assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" not in sanitized_2
    assert "Bearer=[REDACTED]" in sanitized_2 or "Bearer [REDACTED]" in sanitized_2 or "[REDACTED]" in sanitized_2


def test_audit_logs_endpoint_hospital_isolation(client, db_store):
    """Hospital admin can only view audit logs from their own hospital."""
    # Seed audit logs
    sec_ref = FakeRef(db_store).child("security_audit_logs")
    sec_ref.child("sec-1").set({
        "id": "sec-1",
        "action": "MEDICAL_REPORT_ACCESSED",
        "hospitalId": "HOSP-CITY-01",
        "actorEmail": "dr.rao@citygeneral.org",
        "details": "Viewed report for PAT-001",
        "timestamp": "2026-10-27T10:00:00Z",
    })
    sec_ref.child("sec-2").set({
        "id": "sec-2",
        "action": "MEDICAL_REPORT_ACCESSED",
        "hospitalId": "HOSP-FOREIGN-99",
        "actorEmail": "dr.foreign@foreignmetro.org",
        "details": "Viewed foreign report",
        "timestamp": "2026-10-27T10:05:00Z",
    })

    headers_city_admin = _auth_header("hospital_admin", email="admin@citygeneral.org", hospitalId="HOSP-CITY-01")
    resp = client.get("/api/admin/audit-logs", headers=headers_city_admin)
    assert resp.status_code == 200
    logs = resp.get_json()["data"]["logs"]
    assert len(logs) == 1
    assert logs[0]["hospitalId"] == "HOSP-CITY-01"
    assert logs[0]["id"] == "sec-1"
