# Phase 2 Mobile Bootstrap Plan

Date: 2026-04-16
Status: M1 scaffold implemented
Dependency: Phase 1 contract baseline and validation report

## 1) Goal
Bootstrap a production-ready mobile client that consumes the same backend and realtime contracts as website.

## 2) Recommended stack
- Framework: React Native with Expo
- Navigation: @react-navigation/native + native-stack + bottom-tabs
- API client: axios (same contract pattern as website)
- Realtime: socket.io-client
- State: React Context + reducer for auth/session and live vitals
- Storage: secure token storage with expo-secure-store
- Charts: react-native-chart-kit or victory-native
- Forms/validation: react-hook-form + zod

## 3) Mobile app location and structure
Proposed app path: mobile/

Proposed folders:
- mobile/src/app
- mobile/src/navigation
- mobile/src/screens
- mobile/src/components
- mobile/src/services
- mobile/src/context
- mobile/src/hooks
- mobile/src/utils
- mobile/src/theme
- mobile/src/types

## 4) Contract-first integration rules
- Reuse route names exactly from Phase 1 freeze.
- Reuse socket event names exactly from Phase 1 freeze.
- Reuse auth headers exactly from website interceptor behavior.
- Do not create mobile-only backend endpoints in Phase 2.

## 5) Bootstrap milestones
### Milestone M1: Foundation
- [x] Initialize Expo app in mobile/
- [x] Setup navigation skeleton
- [x] Setup env management for API base URLs
- [x] Setup auth/session context and secure token storage
- [x] Setup shared API client with interceptors

### Milestone M2: Core screens
- Build Login/Signup/Reset screens
- Build Dashboard shell for doctor and patient
- Build Patient list and patient details screens

### Milestone M3: Live monitoring and prediction
- Add live vitals websocket stream + poll fallback
- Add manual update and prediction view
- Add audit history timeline

### Milestone M4: Communication and SOS
- Add chat thread list + messages screen
- Add call signaling layer
- Add SOS trigger flow and status feedback

### Milestone M5: Hardening
- Error handling and retry strategy
- Offline-safe fallback behavior
- Smoke tests and parity verification

## 6) Initial route map for mobile
- Auth stack:
  - LoginSelection
  - PatientLogin
  - DoctorLogin
  - PatientSignup
  - DoctorSignup
  - PasswordReset
- App stack:
  - Dashboard
  - PatientList
  - PatientDetails
  - AddPatient
  - Chat
  - Profile

## 7) Data and service modules to create first
- mobile/src/services/apiClient.ts
- mobile/src/services/authService.ts
- mobile/src/services/patientService.ts
- mobile/src/services/chatService.ts
- mobile/src/services/socketService.ts
- mobile/src/services/sosService.ts

## 8) Risks and mitigations
- WebRTC differences on mobile:
  - Mitigation: isolate signaling and media setup into dedicated call service module.
- Browser APIs not available (localStorage, clipboard patterns):
  - Mitigation: use secure store and native clipboard alternatives.
- UI parity drift between web and mobile:
  - Mitigation: enforce feature DoD parity gate from Phase 1.

## 9) Entry checklist before coding mobile
- [x] Approve stack choice (React Native Expo).
- [x] Approve mobile folder path and module structure.
- [x] Approve M1-M5 milestone sequence.
- [x] Approve first coding slice: M1 foundation + auth module.

## 10) Locked implementation start slice
- Start slice: M1 foundation + auth module
- Includes:
  - Expo app initialization in mobile/
  - Navigation skeleton
  - Environment config for API URLs
  - Secure auth session storage
  - Shared API client and interceptor setup
  - Auth screens scaffold (doctor/patient)

## 11) Implemented output (M1)
- Mobile scaffold created under [mobile](mobile)
- Auth context implemented in [mobile/src/context/AuthContext.jsx](mobile/src/context/AuthContext.jsx)
- API interceptor implemented in [mobile/src/services/apiClient.js](mobile/src/services/apiClient.js)
- Auth services implemented in [mobile/src/services/authService.js](mobile/src/services/authService.js)
- Navigation skeleton implemented in [mobile/src/navigation/RootNavigator.jsx](mobile/src/navigation/RootNavigator.jsx)
- Auth screens scaffolded in [mobile/src/screens/auth/LoginSelectionScreen.jsx](mobile/src/screens/auth/LoginSelectionScreen.jsx), [mobile/src/screens/auth/DoctorLoginScreen.jsx](mobile/src/screens/auth/DoctorLoginScreen.jsx), [mobile/src/screens/auth/PatientLoginScreen.jsx](mobile/src/screens/auth/PatientLoginScreen.jsx), [mobile/src/screens/auth/DoctorSignupScreen.jsx](mobile/src/screens/auth/DoctorSignupScreen.jsx)

## 12) Implemented output (Slice A)
- Role-based app flow enabled in [mobile/src/navigation/RootNavigator.jsx](mobile/src/navigation/RootNavigator.jsx)
- Doctor patients list flow implemented in [mobile/src/screens/app/PatientListScreen.jsx](mobile/src/screens/app/PatientListScreen.jsx)
- Patient details screen implemented in [mobile/src/screens/app/PatientDetailsScreen.jsx](mobile/src/screens/app/PatientDetailsScreen.jsx)
- Dashboard shell connected to patient service in [mobile/src/screens/app/DashboardScreen.jsx](mobile/src/screens/app/DashboardScreen.jsx)
- Patient service integration added in [mobile/src/services/patientService.js](mobile/src/services/patientService.js)

## 13) Implemented output (Slice B)
- Live vitals websocket + poll fallback implemented in [mobile/src/screens/app/PatientDetailsScreen.jsx](mobile/src/screens/app/PatientDetailsScreen.jsx)
- Vitals/prediction service layer added in [mobile/src/services/vitalsService.js](mobile/src/services/vitalsService.js)
- Prediction trigger flow wired to /predict in [mobile/src/screens/app/PatientDetailsScreen.jsx](mobile/src/screens/app/PatientDetailsScreen.jsx)
- Prediction audit timeline UI implemented in [mobile/src/screens/app/PatientDetailsScreen.jsx](mobile/src/screens/app/PatientDetailsScreen.jsx)

## 14) Implemented output (Slice C)
- Chat HTTP service layer added in [mobile/src/services/chatService.js](mobile/src/services/chatService.js)
- SOS service layer added in [mobile/src/services/sosService.js](mobile/src/services/sosService.js)
- Mobile chat screen with realtime messaging and call signaling states implemented in [mobile/src/screens/app/ChatScreen.jsx](mobile/src/screens/app/ChatScreen.jsx)
- Full WebRTC media pipeline implemented in [mobile/src/screens/app/ChatScreen.jsx](mobile/src/screens/app/ChatScreen.jsx)
- Mobile SOS trigger/reset flow implemented in [mobile/src/screens/app/SosScreen.jsx](mobile/src/screens/app/SosScreen.jsx)
- Navigation wiring for Chat and SOS tabs added in [mobile/src/navigation/RootNavigator.jsx](mobile/src/navigation/RootNavigator.jsx)
- Expo WebRTC plugin + camera/mic permission config added in [mobile/app.json](mobile/app.json)

## 15) Exit criteria for bootstrap planning
Planning is complete when:
- Stack and architecture are approved.
- Milestones are accepted.
- First implementation command is issued by owner.
- M1 foundation scaffold is available.
