# Smart Health Care — Comprehensive Architectural & Security Audit Report

**Audit Date:** October 21, 2026  
**Auditor:** Senior Software Architect & Healthcare Application Security Expert  
**Repository:** [Harshshukla49/Smart_Health_Care](https://github.com/Harshshukla49/Smart_Health_Care)  
**Live Production URL:** [https://smart-health-rontend.onrender.com](https://smart-health-rontend.onrender.com)  
**Live Backend URL:** [https://smart-health-backend-2idf.onrender.com](https://smart-health-backend-2idf.onrender.com)  

---

## 1. Executive Summary

This audit assesses the Smart Health Care platform across its full stack: web frontend, mobile application, backend API services, real-time telemetry, machine learning inference engines, database access control, and deployment pipelines. 

The goal of this audit is to formulate a zero-regression, production-readiness roadmap that preserves all functioning database records, authentication flows, hardware integrations, and user interfaces while upgrading cross-platform capabilities, security, and resiliency.

---

## 2. Architecture & Technology Stack Matrix

| Component | Technology | Version | Location / Config |
| :--- | :--- | :--- | :--- |
| **Web Frontend** | React, Vite, Tailwind CSS, Framer Motion | React 18.3.1, Vite 5.4.19 | `frontend/` (`frontend/package.json`) |
| **Mobile App** | React Native, Expo | SDK 52, RN 0.76.1 | `mobile/` (`mobile/package.json`) |
| **Backend API & WebSockets** | Python Flask, Flask-SocketIO | Flask 3.0.3, SocketIO 5.4.1 | `app.py`, `render.yaml` |
| **Database** | Firebase RTDB & Cloud Firestore | Firebase Admin 6.5.0 | `smart-health-care-cd723` |
| **Authentication** | URLSafeTimedSerializer + PBKDF2 / Phone OTP | Custom token + bcrypt/hash | `app.py` (`@require_auth`) |
| **Telemetry & Hardware** | ESP32, MAX30102 / Pulse Sensor | C++ / Arduino | `hardware/esp32_smart_health_telemetry.ino` |
| **Machine Learning** | Scikit-learn, Joblib | Scikit-learn 1.5.1 | `heart_model.pkl`, `vitals_model.pkl` |
| **Deployment / Hosting** | Render Web Service & Static Site | Python 3.11 / Node 20 | `render.yaml` |

---

## 3. Detailed Feature Status Breakdown

### 3.1 Verified & Fully Working Features
1. **Authentication & Session Management:**
   - Dual-role authentication (Doctor and Patient).
   - Password hashing with salt (PBKDF2) and Phone OTP via Twilio SMS.
   - Strict scoping of patient records (`_doctor_owns_record` check enforced on `/api/patient/<id>/medicines` and `/api/patient/<id>/prediction-audit`).
2. **Real-World Nearby Hospital Discovery (`places_service.py`):**
   - Live OpenStreetMap Nominatim & Overpass query engine.
   - Calculates real geodesic distances via Haversine formula from browser Geolocation API.
   - Dynamic Google Maps directions links, amenity filtering (Hospital, Clinic, Emergency, Diagnostic), and zero fictional data generation.
3. **Clinical PDF Report Generation:**
   - Vector-based PDF generation via `jspdf` and `jspdf-autotable`.
   - Clean 2-page pagination, aligned vitals tables, prescription matrices, and doctor digital signature verification block.
4. **PWA Installation & Manifest:**
   - Manifest configuration (`frontend/public/manifest.webmanifest`).
   - Service worker registration with update detection (`frontend/src/serviceWorkerRegistration.js`).
   - Cross-platform install modals and iOS "Add to Home Screen" instructions.
5. **Basic Vitals Risk Prediction:**
   - `/predict` endpoint successfully classifies heart rate, SpO2, and temperature into `Normal` vs `Critical` states. Verified with automated unittest (`test_predict_api.py`).

### 3.2 Partially Implemented & Simulated Features
1. **Ambulance Emergency Dispatch:**
   - In `frontend/src/services/api.js` (`postAmbulanceRequestApi`), when the backend dispatch service is unavailable or in demo mode, the app falls back to a simulated paramedic unit (`MED-AMB-409`, ETA ~9 mins).
2. **Teleconsultation & Video Calling:**
   - WebRTC signaling logic is wired via Socket.IO events (`call-user`, `answer-call`, `ice-candidate`).
   - However, doctor presence currently defaults to static hospital staff records (`HOSPITAL_PHYSICIANS`) if dynamic doctor socket presence is not active.
3. **IoT Sensor Ingestion (`sensor_adapter.py`):**
   - Supports real ESP32 WiFi push to Firebase RTDB `/telemetry/vitals`.
   - In offline/demo environments, falls back to `SimulatedSensorAdapter` or `DatasetReplaySensorAdapter` replaying `datasetheartrate/vitals_dataset.csv`.

### 3.3 Broken or Disconnected Features
1. **ECG Prediction API Contract Mismatch:**
   - `test_ecg_predict_api.py` sends a 13-feature clinical ECG payload (`age`, `sex`, `cp`, `trestbps`, `chol`, `fbs`, `restecg`, `thalach`, `exang`, `oldpeak`, `slope`, `ca`, `thal`).
   - The primary `/predict` endpoint expects `{heart_rate, spo2, temperature}` and returns a 400 error when receiving ECG-only payloads.
   - **Resolution:** Implement intelligent dual-payload detection in `/predict` and introduce a dedicated `/predict/ecg` endpoint delegating to `heart_model.pkl`.
2. **Legacy Test Assertions Drift (`test_predict_api.py`):**
   - `test_predict_api.py` expects a legacy minimal dictionary (`{'status': 'Normal'}`), whereas the live `/predict` API has been enriched to return a comprehensive diagnostic object containing `confidence`, `risk`, `prediction`, `status`, `message`, `source`, and `vitals`.
   - **Resolution:** Update `test_predict_api.py` to assert against the enriched schema without breaking backward compatibility.

---

## 4. Security, Credentials & Privacy Audit

| Threat / Risk | Severity | Current Status | Remediation Required |
| :--- | :--- | :--- | :--- |
| **Token Storage in LocalStorage** | Medium | Auth tokens stored in `localStorage` under `smart-health-auth-session` | Vulnerable to XSS. Recommend adding strict Content Security Policy (CSP) headers and transitioning sensitive mutations to HttpOnly secure cookies. |
| **Credentials in Local Files** | Low (Workspace) | Live Twilio & Gmail App secrets exist in `.env`, Google Service Account in `firebase_key.json`. | Both files are excluded via `.gitignore` and untracked in Git. However, Render deployment must rely strictly on encrypted dashboard environment variables. |
| **Database Rules (RTDB & Firestore)** | Medium | `firebase.rules.json` and `firestore.rules` exist with auth requirements. | Needs audit against patient-specific path isolation to ensure a patient can never read another patient's raw telemetry stream. |
| **Socket.IO Threading under Gunicorn** | Medium | `render.yaml` uses `gunicorn --worker-class gthread -w 1 --threads 100` | Thread-based workers can struggle with persistent WebRTC WebSocket connections under load. Recommend migrating to an async worker (e.g. `geventwebsocket` or `eventlet`). |

---

## 5. Deployment & Infrastructure Review

- **Frontend Hosting (Render Static Site `smart-health-frontend`):**
  - Build command: `npm --prefix frontend install && npm --prefix frontend run build`
  - Output directory: `frontend/dist`
  - SPA Rewrite: Configured correctly (`/* -> /index.html`), preventing direct-route 404 errors on `/login` or `/dashboard`.
- **Backend Hosting (Render Web Service `smart-health-backend`):**
  - Build command: `pip install -r requirements.txt`
  - Start command: `gunicorn --worker-class gthread -w 1 --threads 100 -b 0.0.0.0:$PORT app:app`
  - Python Version: Explicitly pinned to 3.11.11 via `runtime.txt` and `render.yaml`.

---

## 6. Prioritized Implementation Roadmap

### Phase 1: API Stabilization & Test Suite Alignment
- Update `/predict` in `app.py` to auto-detect whether payload is vitals-based (`heart_rate`, `spo2`, `temp`) or clinical ECG features (`age`, `chol`, `thalach`, etc.), routing to the corresponding scikit-learn model.
- Ensure both `test_predict_api.py` and `test_ecg_predict_api.py` pass 100%.

### Phase 2: Production Security Hardening & Headers
- Configure security headers (CSP, X-Frame-Options, X-Content-Type-Options) in Flask.
- Audit Firebase rules to enforce path-level data separation for patient records.

### Phase 3: Real-Time WebRTC Teleconsultation Dynamic Roster
- Connect active doctor socket registrations to the consultation room lookup, eliminating reliance on static physician fallbacks.

### Phase 4: Cross-Platform PWA & Mobile Polish
- Validate offline caching policies (ensure zero caching of PHI/auth tokens in CacheStorage).
- Validate Expo mobile client endpoints against the canonical backend contract.

### Phase 5: Verification & Production Release Checklist
- Run end-to-end user journeys (registration -> login -> vitals monitoring -> hospital discovery -> PDF report generation).
- Sync all modifications to GitHub repository (`origin main`).
