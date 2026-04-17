# Feature-wise Execution Backlog

Date: 2026-04-16
Source baseline: [PHASE1_CONTRACT_FREEZE_AND_PARITY.md](PHASE1_CONTRACT_FREEZE_AND_PARITY.md)

## Priority and sequencing
- P0: Auth and session foundation
- P0: Core patient flow (dashboard, list, details, add patient)
- P1: Live vitals and prediction
- P1: Chat and video call
- P2: SOS and profile hardening
- P2: Observability and release quality gates

## Epic 1: Auth and Session Parity (P0)
### Backend tasks
- [ ] Keep token payload and expiry behavior stable for doctor and patient auth.
- [ ] Standardize auth error responses across login/signup/reset routes.
- [ ] Add explicit 401/403 response schema documentation.

### Website tasks
- [ ] Validate doctor login/signup flow against frozen contract.
- [ ] Validate patient login flow and token persistence.
- [ ] Normalize reset-password UX across all entry points.

### Mobile tasks
- [ ] Create auth module with token storage and refresh strategy.
- [ ] Build login/signup/reset screens for doctor and patient.
- [ ] Implement request interceptor with frozen headers.

### Test tasks
- [ ] Auth happy path tests for both roles.
- [ ] Invalid credentials and expired token tests.
- [ ] Header propagation tests for protected endpoints.

## Epic 2: Dashboard and Core Patient Flows (P0)
### Backend tasks
- [ ] Keep /patients and /api/patient/<patient_id> response shape stable.
- [ ] Ensure doctor ownership checks are consistently enforced.

### Website tasks
- [ ] Validate /dashboard for doctor and patient role routing.
- [ ] Validate /add-patient create flow and credential display.
- [ ] Validate /patients/:patientId detail rendering.

### Mobile tasks
- [ ] Build Dashboard screen with role-based sections.
- [ ] Build Patient List and Patient Details screens.
- [ ] Build Add Patient flow with required field validation.

### Test tasks
- [ ] Cross-role UI access tests.
- [ ] Patient record create/read tests.
- [ ] Offline/fallback behavior tests where applicable.

## Epic 3: Live Vitals, Device, and Prediction (P1)
### Backend tasks
- [ ] Keep /api/vitals, /patient/<patient_id>/monitor, /predict stable.
- [ ] Keep device connect/disconnect events and statuses stable.
- [ ] Maintain prediction audit append behavior.

### Website tasks
- [ ] Validate LiveVitalsContext websocket + poll fallback.
- [ ] Validate manual update + auto predict flow in patient details.
- [ ] Validate chart rendering and latest vitals sync.

### Mobile tasks
- [ ] Implement live vitals stream subscription and fallback polling.
- [ ] Implement manual override and re-predict flow.
- [ ] Implement prediction audit timeline UI.

### Test tasks
- [ ] Realtime latency and reconnect tests.
- [ ] Predict endpoint payload mode tests (vitals and ECG).
- [ ] Device connect/disconnect state transition tests.

## Epic 4: Chat and Video Call Parity (P1)
### Backend tasks
- [ ] Keep chat thread auth and ownership checks stable.
- [ ] Keep call signaling and WebRTC event forwarding stable.
- [ ] Document all chat and call socket event payloads.

### Website tasks
- [ ] Validate message history, send, read, typing, presence.
- [ ] Validate outgoing/incoming call lifecycle.
- [ ] Validate WebRTC offer/answer/candidate handling.

### Mobile tasks
- [ ] Build chat thread list and messages screen.
- [ ] Implement socket auth handshake and room join behavior.
- [ ] Implement mobile call signaling and media controls.

### Test tasks
- [ ] Thread authorization tests.
- [ ] Message delivery and read receipt tests.
- [ ] Call setup, reject, end, and recovery tests.

## Epic 5: SOS, Profile, and Safety Flows (P2)
### Backend tasks
- [ ] Keep SOS trigger/reset integration contract stable across services.
- [ ] Keep profile update sync behavior stable for doctor/patient.

### Website tasks
- [ ] Validate SOS trigger integration path from UI.
- [ ] Validate doctor/patient profile update UX and session refresh.

### Mobile tasks
- [ ] Implement SOS trigger flow and confirmation state.
- [ ] Implement profile update screens and auth session update.

### Test tasks
- [ ] SOS recipient and duplicate-trigger prevention tests.
- [ ] Profile update and token continuity tests.

## Epic 6: Quality Gates and Release Ops (P2)
### Cross-platform tasks
- [ ] Add parity checklist to PR template.
- [ ] Define release checklist requiring backend + web + mobile sign-off.
- [ ] Add smoke test script for critical routes and socket connectivity.

### Test tasks
- [ ] End-to-end regression pack for top 10 user journeys.
- [ ] Error-path and timeout tests.
- [ ] Final parity matrix pass before release.

## Sprint-ready first slice recommendation
- [x] Slice 0 (selected start): M1 foundation + auth module. (completed)
- [x] Slice A: Auth + dashboard shell + patient list for mobile. (completed)
- [x] Slice B: Patient details + live vitals + prediction. (completed)
- [x] Slice C: Chat + call + SOS. (completed)
- [ ] Slice D: Hardening and release.
