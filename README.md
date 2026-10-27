# 🏥 Smart Health Care: Enterprise Multi-Hospital & IoT Remote Monitoring Platform

[![Flask](https://img.shields.io/badge/Backend-Flask%20%7C%20Python%203.13-black?logo=flask)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/Frontend-React%20%7C%20Vite%205-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/Database-Firebase%20RTDB-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![IoT Hardware](https://img.shields.io/badge/Firmware-ESP32%20%7C%20C%2B%2B%20Arduino-E7352C?logo=espressif)](hardware/esp32_smart_health_telemetry.ino)
[![Testing](https://img.shields.io/badge/Tests-78%2F78%20Passed%20(100%25)-brightgreen?logo=pytest)](tests/)
[![Security](https://img.shields.io/badge/RBAC-Multi--Hospital%20Isolated-blueviolet)](tests/test_rbac.py)

An enterprise-grade, multi-hospital smart healthcare and remote vitals monitoring ecosystem. Built with strict HIPAA-aligned data isolation, role-based access control, dual-level clinical privacy safeguards, real-time GPS Emergency SOS workflows, and physical ESP32 wearable sensor integration.

---

## 📑 Table of Contents

1. [Architecture Overview](#-architecture-overview)
2. [Verified Features](#-verified-features)
   - [Super Admin & Hospital Multi-Tenancy](#1-super-admin--hospital-multi-tenancy)
   - [Doctor Dashboard & Clinical Privacy (Level A vs Level B)](#2-doctor-dashboard--clinical-privacy-level-a-vs-level-b)
   - [Patient Portal (10 Modules)](#3-patient-portal-10-modules)
   - [GPS Emergency SOS Module](#4-gps-emergency-sos-module)
   - [Wearable IoT Architecture & ESP32 Firmware](#5-wearable-iot-architecture--esp32-firmware)
3. [Hardware Specifications & Limitations](#-hardware-specifications--limitations)
4. [API Contract & Documentation](#-api-contract--documentation)
5. [Local Development & Setup](#-local-development--setup)
6. [Automated Verification & Test Suite](#-automated-verification--test-suite)
7. [Production Deployment & Rollback Guide](#-production-deployment--rollback-guide)
8. [Environment Configuration](#-environment-configuration)
9. [Release Readiness Audit Report](#-release-readiness-audit-report)

---

## 🏗 Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLIENT LAYER (Vite / React)                     │
│  ┌──────────────────────┐ ┌──────────────────────┐ ┌─────────────────────┐  │
│  │     Super Admin      │ │   Doctor Dashboard   │ │   Patient Portal    │  │
│  │   Multi-Hospital     │ │ Level A / B Privacy  │ │     10 Modules      │  │
│  │   Tenant Controls    │ │ Break-Glass Audits   │ │   GPS SOS Center    │  │
│  └──────────┬───────────┘ └──────────┬───────────┘ └──────────┬──────────┘  │
└─────────────┼────────────────────────┼────────────────────────┼─────────────┘
              │                        │                        │
              ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY & SECURITY LAYER                        │
│  - JWT Bearer Token Authentication (HS256)                                  │
│  - Multi-Hospital Tenant Partitioning (`HOSP-XXX` scoping)                  │
│  - Rate Limiting (10 req/s live ingestion, duplicate suppression)           │
│  - Strict Role-Based Access Control (Admin / Doctor / Patient / Hardware)   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
     ┌─────────────────────────────────┼────────────────────────────────┐
     ▼                                 ▼                                ▼
┌───────────────────────┐   ┌───────────────────────┐   ┌─────────────────────┐
│   BACKEND REST APIS   │   │  NOTIFICATION ENGINE  │   │  WEARABLE TELEMETRY │
│ - Flask Application   │   │ - Truthful Provider   │   │ - ESP32 Firmware    │
│ - Emergency SOS Flow  │   │   Reporting           │   │ - MAX30102 / DS18B20│
│ - Prescription Audits │   │ - Twilio SMS          │   │ - AD8232 ECG Wave   │
│ - Patient Triage/Logs │   │ - SMTP / Gmail Relay  │   │ - Anti-Spoofing &   │
│ - Break-Glass Auth    │   │ - Emergency 108 / 112 │   │   Buffer Flush Ring │
└───────────┬───────────┘   └───────────┬───────────┘   └──────────┬──────────┘
            │                           │                          │
            ▼                           ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             PERSISTENCE LAYER                               │
│  - Firebase Realtime Database (Scoped Collections)                          │
│  - `hospitals/` `admins/` `doctors/` `patients/` `emergencyAlerts/`         │
│  - `deviceTelemetry/` `security_audit_logs/` `patientHistory/`              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🌟 Verified Features

### 1. Super Admin & Hospital Multi-Tenancy
- **Hospital Lifecycle:** Super Admins can provision, view, update, deactivate, or reactivate hospitals (`HOSP-CITY-01`, `HOSP-METRO-02`).
- **Administrative Isolation:** Hospital Admins can only view and manage staff, patients, devices, and metrics within their assigned facility.
- **Audit Logging:** System security events (`HOSPITAL_PROVISIONED`, `DOCTOR_PROVISIONED`, `PRESCRIPTION_AUDITED_REVISION`, `BREAK_GLASS_ACCESS`) write immutable logs with actor details and timestamps to `security_audit_logs`.

### 2. Doctor Dashboard & Clinical Privacy (Level A vs Level B)
- **Level A (Hospital Directory):** Attending physicians see all admitted patients in their hospital with privacy protections (phone numbers and home addresses are cryptographically masked).
- **Level B (Assigned Clinical Records):** Full medical histories, lab reports, unmasked contact details, and vital trends are restricted strictly to the assigned doctor.
- **Emergency Break-Glass:** In acute medical crises, unassigned doctors within the same hospital can request immediate temporary access with a mandatory clinical justification, which generates an immutable security audit event. Cross-hospital break-glass is strictly forbidden.
- **Auditable Prescription Workflow:** Doctors cannot silently overwrite medications. Every modification requires a clinical justification (`reasonForCorrection`), auto-increments the `revisionNumber`, logs the previous state to `revisionHistory`, and registers an audit trail.

### 3. Patient Portal (10 Modules)
1. **Overview:** Live health status card, quick-action emergency trigger, recent vital sparklines, and notifications.
2. **Profile:** Patient demographics, emergency contacts, blood group, allergies, and address.
3. **Appointments:** Real-time scheduling, pending/confirmed status badges, and cancellation.
4. **Medical History:** Read-only clinical diagnoses, attending physician notes, and laboratory test archives.
5. **Prescriptions:** Active and historical medications, dosage instructions, food timing, and compliance logging (`taken: true`).
6. **Health Monitoring:** Live vitals dashboard, connection state indicators (`LIVE`, `ONLINE_DELAYED`, `STALE`, `OFFLINE`), and interactive charts.
7. **Emergency SOS:** High-visibility trigger with 5-second accidental cancel countdown, GPS coordinate display, map links, and real-time dispatch progress.
8. **AI Health Assistant:** Bilingual (English & Hindi) conversational assistant for triage and health FAQs.
9. **Notifications:** System alerts, appointment reminders, and medication schedule notifications.
10. **Settings:** Profile security, password changes, notification preferences, and session controls.

### 4. GPS Emergency SOS Module
- **Accidental-Trigger Protection:** 5-second animated countdown modal allowing patients to abort unintentional presses before alerting teams.
- **GPS Location Capture:** High-accuracy HTML5 geolocation retrieval (`latitude`, `longitude`, `accuracy`), generating direct Google Maps navigation links for first responders.
- **Truthful Delivery Status:** Reports exact provider delivery states (`sent`, `failed`, `simulated_no_credentials`) without falsely claiming SMS delivery or ambulance dispatches when credentials are not configured.
- **Multi-Channel Dispatch:** Dispatches alerts to configured emergency contacts (SMS), attending hospital triage queues, and displays national emergency hotline fallbacks (108 - Ambulance, 112 - National Emergency, 102 - Maternity).
- **Incident Lifecycle:** Doctors and hospital administrators can acknowledge (`ACKNOWLEDGED`), dispatch support (`DISPATCHED`), or resolve (`RESOLVED`) emergency events with resolution notes.

### 5. Wearable IoT Architecture & ESP32 Firmware
- **Microcontroller:** ESP32 Dev Module (Dual-Core 240MHz, 2.4GHz Wi-Fi).
- **Sensor Telemetry Pipeline:** MAX30102 (Heart Rate & SpO2), DS18B20 (Skin Temperature), and AD8232 (Lead-I ECG).
- **Cryptographic Authentication:** Devices authenticate with `X-Device-Id` and `X-Device-Token` headers verified against salted SHA-256 hashes.
- **Anti-Spoofing Protection:** Rejects telemetry submissions with `403 Forbidden` if a device attempts to push data for any patient other than its registered pairing.
- **Reconnection & Deduplication:** Offline 30-packet FIFO ring buffer on ESP32 flash buffers vitals during Wi-Fi drops. Reconnection flushes carry `isReconnect: true` and are deduplicated safely without triggering rate-limits.
- **Staleness Tracking:** Automatically marks telemetry as `LIVE` (<20s), `ONLINE_DELAYED` (20-60s), `STALE` (>60s), or `OFFLINE`.
- **Synthetic Simulator:** Development simulator (`POST /api/devices/simulate`) explicitly marks data as `SYNTHETIC_SIMULATOR` and suppresses false emergency alerts.

---

## 🔬 Hardware Specifications & Limitations

### Verified Hardware Inventory (In-Repo Firmware)
Located in [`hardware/esp32_smart_health_telemetry.ino`](file:///hardware/esp32_smart_health_telemetry.ino):

| Component | Interface / Pin | Function | Library Dependency |
| :--- | :--- | :--- | :--- |
| **ESP32 Dev Module** | On-board Wi-Fi | Ingestion & Telemetry Buffer | `WiFi.h`, `HTTPClient.h` |
| **MAX30102** | I2C (SDA: GPIO 21, SCL: GPIO 22) | Optical PPG: HR (BPM) & SpO2 (%) | `SparkFun_MAX3010x.h` |
| **DS18B20** | OneWire (GPIO 4) | Body / Skin Temperature (°C) | `OneWire.h`, `DallasTemperature.h` |
| **AD8232** | ADC (GPIO 34), LO+ (GPIO 18), LO- (GPIO 19) | Single-lead ECG Waveform | Native ESP32 ADC |

### Important Investigational Prototype Notice
> [!WARNING]
> **NOT A CERTIFIED MEDICAL DEVICE:** The sensors used in this prototype (MAX30102, DS18B20, AD8232) are hobbyist- and development-grade components intended solely for investigational prototyping, educational demonstration, and software pipeline validation. They have **not** received FDA 510(k), CE-IVD, or CDSCO medical diagnostic clearances.
> 
> The platform automatically flags all hardware telemetry payloads with:
> ```json
> {
>   "sensorTier": "PROTOTYPE_INVESTIGATIONAL",
>   "isClinicalGrade": false,
>   "regulatoryNotice": "Investigational prototype. Not for primary clinical diagnostics or life-critical monitoring."
> }
> ```

### Outstanding Physical Verification Requirements
- **Physical Bench Testing:** Full analog signal tuning, baseline wander filtering, and motion artifact rejection for the AD8232 ECG require physical hardware connected to an oscilloscope and placed on skin.
- **Battery Management:** ESP32 battery level reporting (`batteryLevel`) currently estimates voltage via resistive divider on GPIO 35; final calibration requires battery chemistry curves.

---

## 📡 API Contract & Documentation

### Authentication & Tenant Scoping
All requests require header: `Authorization: Bearer <JWT_TOKEN>`.

### Key Endpoints

| Category | Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/login` | Public | Role-based login (Super Admin, Hospital Admin, Doctor, Patient) |
| **Hospitals** | `GET` | `/api/admin/hospitals` | Super Admin | List all registered hospitals |
| **Hospitals** | `POST` | `/api/admin/hospitals` | Super Admin | Provision a new hospital facility |
| **Doctor** | `GET` | `/api/doctor/overview` | Doctor | Doctor dashboard metrics & emergency queue |
| **Doctor** | `GET` | `/api/doctor/patients` | Doctor | Level A hospital directory (redacted PII) |
| **Doctor** | `GET` | `/api/patient/<id>/clinical` | Doctor | Level B clinical records (assigned or break-glass) |
| **Doctor** | `POST` | `/api/doctor/break-glass` | Doctor | Emergency break-glass access request |
| **Prescriptions**| `POST` | `/api/patient/<id>/prescriptions` | Doctor | Create new patient prescription |
| **Prescriptions**| `PUT` | `/api/patient/<id>/prescriptions/<id>` | Doctor | Audited prescription revision (requires justification) |
| **Patient** | `GET` | `/api/patient/<id>/portal-summary` | Patient | Patient portal summary & health cards |
| **Emergency** | `POST` | `/api/emergency/trigger` | Patient | Trigger GPS Emergency SOS event |
| **Emergency** | `GET` | `/api/emergency/active` | Staff / Patient| Get active emergency status and provider delivery |
| **Emergency** | `POST` | `/api/emergency/<id>/status` | Doctor / Admin | Update incident triage state (ACKNOWLEDGED / RESOLVED) |
| **Wearable** | `POST` | `/api/devices/register` | Admin | Register new hardware device in hospital |
| **Wearable** | `POST` | `/api/devices/pair` | Admin / Patient| Securely pair device to a patient |
| **Wearable** | `POST` | `/api/devices/telemetry` | Device Token | Authenticated sensor data ingestion |
| **Wearable** | `GET` | `/api/devices/<id>/history` | Clinician | Historical sensor vitals & waveforms |
| **Wearable** | `POST` | `/api/devices/simulate` | Dev / Admin | Inject labeled synthetic simulator readings |

---

## 💻 Local Development & Setup

### Prerequisites
- Python 3.11+ (Python 3.13 recommended)
- Node.js 18+ & npm 9+
- Firebase Realtime Database account or local emulator

### Backend Setup
```bash
# 1. Clone repository
git clone https://github.com/Harshshukla49/Smart_Health_Care.git
cd Smart_Health_Care

# 2. Create and activate virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env with your Firebase and JWT settings

# 5. Run the Flask backend
python app.py
# Backend runs on http://localhost:5000
```

### Frontend Setup
```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
# Frontend runs on http://localhost:5173

# 4. Build for production
npm run build
```

---

## 🧪 Automated Verification & Test Suite

The project includes an exhaustive automated test suite with **78 passing tests** covering multi-hospital tenant isolation, role-based access control, prescription revisions, emergency SOS workflows, and wearable hardware ingestion:

```bash
# Run the complete test suite
.\venv\Scripts\pytest.exe tests/ -v
```

### Test Results Summary

| Test File | Total Tests | Passed | Coverage Area |
| :--- | :---: | :---: | :--- |
| [`test_rbac.py`](file:///tests/test_rbac.py) | 13 | 13 | Role boundaries, unauthorized rejections, deactivation, token expiry |
| [`test_multi_hospital.py`](file:///tests/test_multi_hospital.py) | 12 | 12 | Hospital CRUD, tenant isolation, cross-hospital access denials |
| [`test_doctor_dashboard.py`](file:///tests/test_doctor_dashboard.py) | 13 | 13 | Level A vs B privacy, break-glass lifecycles, prescription revisions |
| [`test_emergency_sos.py`](file:///tests/test_emergency_sos.py) | 10 | 10 | GPS trigger, accidental abort, truthful provider reports, staff queues |
| [`test_wearable_hardware.py`](file:///tests/test_wearable_hardware.py) | 13 | 13 | Device pairing, token auth, rate limits, anti-spoofing, buffer flushes |
| [`test_patient_portal.py`](file:///tests/test_patient_portal.py) | 9 | 9 | Patient modules, medical history read-only, vitals logging, AI assistant |
| [`test_api_contract.py`](file:///tests/test_api_contract.py) | 8 | 8 | Backward compatibility, schema validation, route contracts |
| **Total** | **78** | **78 (100%)** | **Zero failures** |

---

## 🚀 Production Deployment & Rollback Guide

### Staging-to-Production Protocol
1. **Never commit secrets or real patient data:** Always verify `.env` is ignored by git (`git status`).
2. **Deploy Backend to Staging:**
   - Deploy backend to staging environment (e.g., Render staging branch).
   - Set environment variables via the hosting provider dashboard.
   - Run health check: `GET https://staging-api.yourdomain.com/health`.
3. **Deploy Frontend to Staging:**
   - Set `VITE_API_URL` to the staging backend URL.
   - Run `npm run build` and deploy to hosting service (e.g., Vercel / Render SPA).
   - Verify all 10 Patient Portal tabs and Doctor Emergency Center.
4. **Promote to Production:**
   - Run full regression suite (`pytest tests/ -v`).
   - Merge staging branch to `main`.
   - Update production environment secrets.
   - Ensure HTTPS is enforced on both frontend and backend.

### Rollback Procedure
If production issues arise:
1. **Frontend Rollback:** In Vercel or hosting platform, instantly revert to the previous deployment alias.
2. **Backend Rollback:**
   ```bash
   git revert HEAD -m 1
   git push origin main
   ```
3. **Data Integrity:** The database schema is backward-compatible; previous releases continue reading patient records without data corruption.

---

## 📋 Release Readiness Audit Report

### Files Modified & Added
- `app.py`: Wearable telemetry endpoints, anti-spoofing validation, auditable prescription revisions, emergency SOS workflows, and multi-hospital scoping.
- `frontend/src/components/emergency/DoctorEmergencyCenter.jsx`: Real-time emergency queue with patient/hospital associations, GPS links, and triage resolution.
- `frontend/src/components/patient/PatientPortal.jsx`: Complete 10-module patient portal with countdown-protected GPS SOS trigger and health monitoring.
- `frontend/src/context/EmergencyContext.jsx`: Emergency alert state management and real-time polling.
- `frontend/src/services/geolocation.js`: High-precision browser GPS coordinate extraction with fallback error handling.
- `hardware/esp32_smart_health_telemetry.ino`: Enhanced ESP32 firmware with 30-packet offline FIFO buffer, reconnection flushing, and prototype metadata.
- `tests/`: 78 automated test cases covering RBAC, Multi-Hospital, Doctor Dashboard, Emergency SOS, and Wearables.
- `.env.example`: Updated environment configuration template with zero secret exposure.

### Audit Checklist

- [x] **Production Frontend Build:** `npm run build` completed successfully (exit code 0), generating optimized assets and `dist/404.html` SPA fallback.
- [x] **Backend Health & Startup:** Verified endpoints, health checks, and API routes.
- [x] **Multi-Hospital Data Isolation:** 100% verified via automated tests.
- [x] **Role-Based Access Control:** All 13 RBAC tests pass without privilege leakage.
- [x] **Auditable Prescription History:** Clinical modifications require justification and generate immutable revision logs.
- [x] **Truthful Emergency Reporting:** Twilio and SMTP delivery statuses truthfully state provider conditions without false dispatch claims.
- [x] **Wearable Device Security:** Constant-time token verification, anti-spoofing rejection, buffer flushing, and synthetic simulator isolation.
- [x] **Secrets & Configuration:** No real credentials committed; comprehensive `.env.example` provided.
- [x] **Investigational Prototype Disclaimers:** Visible regulatory notices attached to all prototype sensor readings.

---

## 📄 License
This project is licensed under the MIT License. See `LICENSE` for details.
