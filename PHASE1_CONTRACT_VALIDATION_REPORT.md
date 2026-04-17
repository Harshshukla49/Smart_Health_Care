# Phase 1 Contract Validation Report

Date: 2026-04-16
Validation target: [PHASE1_CONTRACT_FREEZE_AND_PARITY.md](PHASE1_CONTRACT_FREEZE_AND_PARITY.md)

## Summary
- API contract validation: PASS
- Socket client-to-server contract validation: PASS
- Socket server-to-client contract validation: PASS WITH NOTES
- Auth/header contract validation: PASS

Overall status: PASS WITH NOTES

## 1) API Contract Validation
Checked all frozen routes against [app.py](app.py).

Result: All frozen API routes are present.

Evidence:
- Auth/profile routes found at [app.py](app.py#L742), [app.py](app.py#L792), [app.py](app.py#L1805), [app.py](app.py#L1853), [app.py](app.py#L1894), [app.py](app.py#L1968), [app.py](app.py#L2021), [app.py](app.py#L2046), [app.py](app.py#L2069), [app.py](app.py#L2099)
- Patient/vitals routes found at [app.py](app.py#L2237), [app.py](app.py#L2257), [app.py](app.py#L2419), [app.py](app.py#L2464), [app.py](app.py#L2502), [app.py](app.py#L2584), [app.py](app.py#L2617), [app.py](app.py#L2654), [app.py](app.py#L2680), [app.py](app.py#L2797)
- Prediction/health routes found at [app.py](app.py#L2194), [app.py](app.py#L2735), [app.py](app.py#L2745), [app.py](app.py#L2758), [app.py](app.py#L2884), [app.py](app.py#L2885)
- Chat HTTP routes found at [app.py](app.py#L3101), [app.py](app.py#L3188), [app.py](app.py#L3214), [app.py](app.py#L3234)
- Admin route found at [app.py](app.py#L1692)

## 2) Socket Contract Validation

### 2.1 Client to server events
Checked frozen C2S events against socket handlers in [app.py](app.py).

Result: All frozen C2S events are present.

Evidence:
- Handlers found at [app.py](app.py#L3258), [app.py](app.py#L3278), [app.py](app.py#L3299), [app.py](app.py#L3337), [app.py](app.py#L3361), [app.py](app.py#L3389), [app.py](app.py#L3417), [app.py](app.py#L3437), [app.py](app.py#L3496), [app.py](app.py#L3530), [app.py](app.py#L3564), [app.py](app.py#L3598), [app.py](app.py#L3632), [app.py](app.py#L3666), [app.py](app.py#L3700)

### 2.2 Server to client events
Checked frozen S2C events against emits in [app.py](app.py) and listeners in website client files.

Result: Frozen S2C event list is valid in runtime.

Evidence:
- Vitals stream events emitted in [app.py](app.py#L1671), [app.py](app.py#L1675), [app.py](app.py#L1679), [app.py](app.py#L1683) and listened in [frontend/src/pages/PatientDetails.jsx](frontend/src/pages/PatientDetails.jsx#L100), [frontend/src/pages/PatientDetails.jsx](frontend/src/pages/PatientDetails.jsx#L109), [frontend/src/pages/PatientDetails.jsx](frontend/src/pages/PatientDetails.jsx#L127), [frontend/src/pages/PatientDetails.jsx](frontend/src/pages/PatientDetails.jsx#L161), [frontend/src/context/LiveVitalsContext.jsx](frontend/src/context/LiveVitalsContext.jsx#L243), [frontend/src/context/LiveVitalsContext.jsx](frontend/src/context/LiveVitalsContext.jsx#L247)
- Call and chat status events handled in [frontend/src/pages/Chat.jsx](frontend/src/pages/Chat.jsx#L314), [frontend/src/pages/Chat.jsx](frontend/src/pages/Chat.jsx#L320), [frontend/src/pages/Chat.jsx](frontend/src/pages/Chat.jsx#L326), [frontend/src/pages/Chat.jsx](frontend/src/pages/Chat.jsx#L334), [frontend/src/pages/Chat.jsx](frontend/src/pages/Chat.jsx#L342), [frontend/src/pages/Chat.jsx](frontend/src/pages/Chat.jsx#L367), [frontend/src/pages/Chat.jsx](frontend/src/pages/Chat.jsx#L376), [frontend/src/pages/Chat.jsx](frontend/src/pages/Chat.jsx#L384), [frontend/src/pages/Chat.jsx](frontend/src/pages/Chat.jsx#L392), [frontend/src/pages/Chat.jsx](frontend/src/pages/Chat.jsx#L417), [frontend/src/pages/Chat.jsx](frontend/src/pages/Chat.jsx#L429), [frontend/src/pages/Chat.jsx](frontend/src/pages/Chat.jsx#L483), [frontend/src/pages/Chat.jsx](frontend/src/pages/Chat.jsx#L492)

Notes:
- Additional runtime events exist that are not listed in freeze file. These are not conflicts, but should be documented for completeness:
  - chat:joined
  - chat:history
  - chat:new_message
  - chat:message_sent_ack
  - chat:message_read
  - chat:presence_update
  - subscription_ok
  - subscription_error

## 3) Auth/Header Validation
Checked frontend request headers vs backend readers.

Result: Header contract is aligned.

Evidence:
- Frontend sends headers in [frontend/src/services/api.js](frontend/src/services/api.js#L41), [frontend/src/services/api.js](frontend/src/services/api.js#L44), [frontend/src/services/api.js](frontend/src/services/api.js#L47), [frontend/src/services/api.js](frontend/src/services/api.js#L50), [frontend/src/services/api.js](frontend/src/services/api.js#L53), [frontend/src/services/api.js](frontend/src/services/api.js#L55)
- Backend reads headers in [app.py](app.py#L853), [app.py](app.py#L873), [app.py](app.py#L881), [app.py](app.py#L894), [app.py](app.py#L912), [app.py](app.py#L1039)

## 4) Action from this validation
- Keep current frozen contract as baseline.
- Add missing runtime S2C event names to freeze doc in next doc update to avoid ambiguity for mobile implementation.
