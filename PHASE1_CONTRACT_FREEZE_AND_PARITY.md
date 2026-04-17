# Phase 1: Contract Freeze + Web/Mobile Parity

Date: 2026-04-16
Scope: Foundation only. No feature rewrite in this phase.

## 1) Objective
This phase locks API and realtime contracts so every next update can be shipped for both website and mobile in one flow.

## 2) Locked Architecture
- One backend for both clients: Flask API + Socket.IO in [app.py](app.py)
- Separate SOS backend remains service-only: [sos-backend/server.js](sos-backend/server.js)
- Website client remains in [frontend/src](frontend/src)
- Mobile app will be added as a separate client (next phase)

## 3) API Contract Freeze (v1)
These routes are now baseline and must remain backward compatible.

### Auth and profile
- POST /doctor/signup
- POST /doctor/login
- POST /login-patient
- POST /doctor/profile/update
- POST /patient/profile/update
- POST /doctor/reset-password/request
- POST /doctor/reset-password/confirm
- POST /patient/reset-password/request
- POST /patient/reset-password/confirm
- POST /auth/firebase/verify-phone-token
- POST /reset-password/firebase-phone

### Patient and vitals
- GET /patients
- POST /add-patient
- GET /patient/<patient_id>
- GET /api/patient/<patient_id>
- POST /api/patient/<patient_id>/manual-update
- POST /connect-device/<patient_id>
- POST /disconnect-device/<patient_id>
- GET /api/patient/<patient_id>/prediction-audit
- GET /api/vitals/<patient_id>
- GET /patient/<patient_id>/monitor

### Prediction and health
- POST /predict
- POST /predict_spo2
- POST /predict-spo2
- GET /health
- GET /test
- GET /

### Chat HTTP
- GET /chat/thread-context
- GET /chat/threads/<thread_id>/messages
- POST /chat/threads/<thread_id>/messages
- PATCH /chat/messages/<message_id>/read

### Admin
- POST /admin/migrate-patient-ownership

## 4) Realtime Contract Freeze (Socket.IO v1)
Event names must stay stable unless versioned.

### Client to server
- connect
- disconnect
- subscribe_patient
- chat:join_thread
- chat:send_message
- chat:typing
- chat:mark_read
- chat:presence_ping
- call:request
- call:accept
- call:reject
- call:end
- webrtc:offer
- webrtc:answer
- webrtc:ice_candidate

### Server to client (observed in web flow)
- patient_snapshot
- vitals_update
- insights_update
- device_status_update
- chat:joined
- chat:history
- chat:new_message
- chat:message_sent_ack
- chat:message_read
- chat:presence_update
- chat:typing
- chat:error
- call:error
- call:incoming
- call:outgoing
- call:accepted
- call:rejected
- call:ended
- call:missed
- webrtc:offer
- webrtc:answer
- webrtc:ice_candidate
- subscription_ok
- subscription_error

## 5) Auth/Header Standard (freeze)
For protected APIs, clients should send:
- Authorization: Bearer <token>
- X-User-Role: doctor | patient
- X-User-Email: <email> (if available)
- X-Patient-Id: <patientId> (patient session)
- X-Doctor-Email: <doctorEmail> (doctor session)
- X-Doctor-Phone: <doctorPhone> (optional)

Source reference: frontend request interceptor in [frontend/src/services/api.js](frontend/src/services/api.js)

## 6) Definition of Done (DoD) for every future feature
A feature is complete only when all are done:
- Backend: endpoint/event and validation completed
- Website: UI + integration completed
- Mobile: UI + integration completed
- Tests: happy-path tested on backend, website, and mobile
- Docs: contract or behavior updates documented

## 7) Feature Parity Tracker (master checklist)
Use this before merging any update.

- [ ] Auth flows parity (doctor and patient login/signup)
- [ ] Password reset parity (email/phone OTP related flows)
- [ ] Dashboard parity (doctor and patient views)
- [ ] Add patient parity
- [ ] Patient details parity
- [ ] Live vitals parity (socket + poll fallback)
- [ ] Prediction parity (vitals and ECG path)
- [ ] Device connect/disconnect parity
- [ ] Chat parity (threads, send, read)
- [ ] Video call parity (signaling and call states)
- [ ] SOS trigger/reset parity
- [ ] Profile update parity

## 8) Change Rules (effective now)
- Do not break existing route names or socket event names.
- If payload shape must change, add backward compatibility first.
- Any new backend feature must include both website and mobile task lines.
- Any platform-only feature requires explicit note in this file.

## 9) Phase 2 entry criteria
Phase 2 starts when:
- This file is accepted as baseline.
- Mobile client stack is chosen (recommended: React Native for current React web stack).
- First mobile milestone scope is fixed (Auth + Dashboard + Patient list).

---
Owner workflow: You give command first, then implementation starts.
