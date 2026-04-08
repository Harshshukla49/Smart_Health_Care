# Patient Login System - Updated Guide

## Overview
Patients now login using a **Patient ID** only - no email or password required. Doctors create patient accounts and assign unique patient IDs.

---

## How It Works

### **For Doctors:**
1. **Sign Up**: Create a doctor account with email and password
   - Go to `/signup` 
   - Enter: Full Name, Email, and Password
   - Account is created as "doctor" role

2. **Add Patients**: Create patient records from the doctor dashboard
   - Click "Add Patient"
   - System auto-generates a unique Patient ID (e.g., `p123`, `p456`)
   - Enter patient details: name, address, symptoms, vitals
   - Share the Patient ID with the patient

3. **Login**: Use email + password
   - Go to `/login`
   - Select "Doctor (Email + Password)"
   - Enter email and password

---

### **For Patients:**
1. **No Signup Needed**: Patients don't create accounts
   - Doctors create patient records and assign IDs
   - No need for email or password registration

2. **Login with Patient ID**: Access health records using ID only
   - Go to `/login`
   - Select "Patient (Patient ID Only)"
   - Enter the Patient ID provided by their doctor (e.g., `p123`)
   - Click "Login" - instant access to their health dashboard

3. **View Data**: Patients can see:
   - Their health vitals (heart rate, SpO2, temperature)
   - Symptoms and medical info
   - Download health reports (JSON, CSV, PDF)

4. **Logout**: Click logout button in the dashboard

---

## Patient ID Format
- **Format**: `p` followed by 3 random digits (e.g., `p100`, `p999`)
- **Unique**: Each patient gets a unique ID
- **Auto-generated**: IDs are created automatically by the system when doctors add patients

---

## Login Page
The login page now has a **role selector**:

```
Login As: [Patient (Patient ID Only)] ▼
                    or
        [Doctor (Email + Password)] ▼
```

### Patient Login Section:
- **Input**: Patient ID field (uppercase)
- **Hint**: "Ask your doctor for your patient ID"
- **Action**: Click "Login"

### Doctor Login Section:
- **Inputs**: Email address and Password
- **Action**: Click "Login"
- **Link**: Create account option for new doctors

---

## Signup Page
Now **Doctor-only**:
- Full Name, Email, and Password
- Creates a doctor account with patient management capabilities
- Directed patients to use the patient login option

---

## Database Changes

### Users Table (`users/{uid}`)
```json
{
  "uid": "firebase_uid",
  "name": "John Smith",
  "email": "john@example.com",
  "role": "doctor" or "patient",
  "patientId": "p123",
  "createdAt": 1234567890
}
```

### Patients Table (`patients/{patientId}`)
```json
{
  "patientId": "p123",
  "name": "Jane Doe",
  "address": "123 Main St",
  "symptoms": "Flu",
  "heart_rate": 72,
  "spo2": 98,
  "temperature": 37.5,
  "ownerId": "doctor_uid",
  "patientAuthId": "patient_firebase_uid",
  "createdAt": 1234567890,
  "updatedAt": 1234567890
}
```

---

## Authentication Flow

### Doctor Login:
1. User enters email + password
2. Firebase authenticates email/password
3. Fetch user profile from `users/{uid}`
4. Verify role is "doctor"
5. Redirect to `/dashboard`

### Patient Login:
1. User enters Patient ID
2. Look up patient record in `patients/{patientId}`
3. Verify patient exists
4. Sign in anonymously with Firebase
5. Store patient profile in `users/{uid}`
6. Redirect to `/patient-dashboard`

---

## Security

### Patient Access Control:
- Patients can only see their own health data
- Patient record lookup by ID prevents unauthorized access
- Anonymous Firebase auth session isolates patient data
- Database rules ensure patients can't modify or delete records

### Doctor Access Control:
- Email + password authentication
- Doctors can create, read, update, delete patient records
- All patient modifications require doctor authentication

---

## Example Workflow

### 1. Doctor Creates Account:
```
Go to /signup
Enter: "Dr. Smith", "drsmith@hospital.com", "password123"
Submit → Redirected to /dashboard
```

### 2. Doctor Adds Patient:
```
Click "Add Patient"
Generate ID → "p456"
Enter: "Jane Doe", "123 Main St", symptoms, vitals
Submit → Patient created with ID p456
```

### 3. Doctor Shares ID:
```
Doctor tells patient: "Your patient ID is p456"
Patient keeps this ID safe
```

### 4. Patient Logs In:
```
Go to /login
Select "Patient (Patient ID Only)"
Enter: "p456"
Click "Login" → Access patient dashboard
```

### 5. Patient Views Data:
```
See health vitals displayed
Download reports as JSON/CSV/PDF
View symptoms and medical info
Logout when done
```

---

## Benefits of This System

✅ **No Patient Registration**: Patients don't need to remember passwords
✅ **Doctor Control**: Only doctors can create patient accounts
✅ **Secure Access**: Patient ID-based access with database verification
✅ **Simple UX**: Patients just enter their ID to login
✅ **Paper Friendly**: Doctors can write/print patient IDs for patients
✅ **Flexible**: Works with paper records, physical ID cards, email, text, etc.

---

## Troubleshooting

### Patient Can't Login:
- ✓ Verify Patient ID is correct (ask doctor)
- ✓ Patient ID must exist in the system
- ✓ Check for typos (e.g., "p123" vs "P123")

### Doctor Gets "Role Mismatch" Error:
- ✓ Account was created as "patient" role
- ✓ Create new doctor account on /signup
- ✓ Contact admin if existing account needs role change

### Patient Lost Their ID:
- ✓ Contact their doctor
- ✓ Doctor can check /dashboard for patient ID
- ✓ Doctor can share ID again

---

**Questions?** Check the application help or contact your system administrator.
