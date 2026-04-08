# Phone Features - Progress Tracker

## Plan Overview
**ADD** phone support (no existing changes):
1. Doctor signup: phone field → `users/{uid}/phone`
2. Add patient: patientPhone field → `patients/{id}/phone`
3. Dashboards: display/update phone
4. OTP reset: verify entered phone == stored phone before OTP

## Current Status
- [ ] patients.js: createPatient() + normalizePatient() add phone support
- [ ] AddPatientPage.jsx: add patientPhone input → createPatient()
- [ ] SignupPage.jsx: add doctorPhone input → signup()
- [ ] DashboardPage.jsx: show patient/doctor phone in list/profile
- [ ] PatientDashboard.jsx: show + update phone field
- [ ] LoginPage.jsx: OTP reset verify phone == stored phone (before sendOTP)
- [ ] Test all flows

## Testing
```
1. Doctor signup with phone → check users/{uid}/phone
2. Add patient with phone → check patients/{id}/phone  
3. Dashboards show phone, update works
4. OTP reset: wrong phone blocked, correct phone → OTP flow
