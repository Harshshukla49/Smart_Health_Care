# Phone OTP Password Reset System - Setup Guide

## Overview
The password reset system has been converted from **email-based** to **Phone OTP-based** using Firebase Authentication. This provides a more secure and modern reset flow.

## Architecture

### New Functions Added

#### 1. **`sendOTP(phoneNumber, recaptchaContainerId)`**
- Sends a 6-digit OTP to the user's phone
- Uses Firebase Phone Authentication with RecaptchaVerifier
- Returns a `confirmationResult` object for OTP verification
- **Parameters:**
  - `phoneNumber`: User's phone (e.g., `+919876543210`)
  - `recaptchaContainerId`: DOM element ID for reCAPTCHA (default: `'recaptcha-container'`)

#### 2. **`verifyOTP(confirmationResult, otpCode)`**
- Verifies the 6-digit OTP entered by user
- Returns Firebase user object with phone authentication session
- **Parameters:**
  - `confirmationResult`: Result from `sendOTP()`
  - `otpCode`: 6-digit code from user

#### 3. **`resetPasswordWithOTP(verifiedUser, newPassword, uid)`**
- Updates password in Firebase Authentication
- Also updates password in Realtime Database under `users/{uid}/password`
- **Parameters:**
  - `verifiedUser`: User from `verifyOTP()`
  - `newPassword`: New password (minimum 6 characters)
  - `uid`: User ID (optional, for database update)

## Setup Instructions

### Step 1: Enable Phone Authentication in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`smart-health-care-cd723`)
3. Navigate to **Authentication** → **Sign-in method**
4. Click **Phone** and toggle it **ON**
5. Under "Phone numbers for testing (optional)", you can add test numbers for development

### Step 2: Configure Web reCAPTCHA

1. In Firebase Console → **Authentication** → **Settings**
2. Under **Authorized domains**, ensure your domain is listed:
   - `localhost` (development)
   - Your production domain

3. For reCAPTCHA (automatic from Firebase):
   - Firebase uses reCAPTCHA v3 automatically
   - No additional configuration needed if you're using the Firebase SDK

### Step 3: File Locations and What Changed

#### Updated Files:
- **`frontend/src/services/auth.js`**
  - Added 3 new OTP functions
  - Imported Firebase Auth modules: `RecaptchaVerifier`, `signInWithPhoneNumber`, `updatePassword`
  - Imported Database update: `update`

- **`frontend/src/pages/LoginPage.jsx`**
  - Added OTP flow state management
  - Replaced email-based reset with phone OTP form
  - UI shows 3 steps: phone input → OTP verification → password reset
  - Minimal layout changes - same styling as before

#### New State Variables Added:
```javascript
const [otpPhoneNumber, setOtpPhoneNumber] = useState('');
const [otpCode, setOtpCode] = useState('');
const [newPassword, setNewPassword] = useState('');
const [confirmNewPassword, setConfirmNewPassword] = useState('');
const [otpStep, setOtpStep] = useState('phone'); // 'phone' | 'otp' | 'password'
const [confirmationResult, setConfirmationResult] = useState(null);
const [verifiedUser, setVerifiedUser] = useState(null);
```

## Usage Flow

### For Users (Doctor/Patient):

1. **Click "Forgot password?"** button on login page
2. **Enter phone number** (e.g., `+919876543210`)
3. **Click "Send OTP"**
   - reCAPTCHA verification happens automatically
   - OTP sent to their phone
4. **Enter 6-digit OTP** received on phone
5. **Click "Verify OTP"**
6. **Set new password**
   - Enter password (min 6 chars)
   - Confirm password
7. **Click "Reset Password"**
   - Password updated in Firebase Auth
   - Password saved in Database

### For Developers (Testing):

#### Test with Real Phone Numbers:
```javascript
// Format: +{country_code}{phone_number}
// Example: +919876543210 (India)
//          +16175551234 (USA)
//          +442071838750 (UK)
```

#### Test with Firebase Test Numbers (Free):
1. In Firebase Console → **Authentication** → **Phone**
2. Add test numbers under "Phone numbers for testing"
3. Example test setup:
   ```
   Phone: +1 555-0123
   OTP: 123456
   ```
4. When you use a test number, Firebase doesn't actually send SMS
   - Use the configured OTP (like `123456`)

## Database Structure

### Users Collection Update:
```
users/
  {userId}/
    password: "hashed_or_plain"  // Added/Updated
    passwordUpdatedAt: 1709000000000  // Timestamp
    phone: "+919876543210"  // Optional - can be added
```

### Database Path for Password Update:
- Before: Backend email service handled it
- Now: `users/{userId}/password` in Firebase Realtime Database

## Error Handling

The system handles these errors gracefully:

| Error | Message | Solution |
|-------|---------|----------|
| Invalid phone | "Please enter a valid phone number (10+ digits...)" | Use E.164 format: +{code}{number} |
| reCAPTCHA failed | "reCAPTCHA verification failed" | Refresh page and try again |
| Invalid OTP | "Invalid OTP. Please try again." | Check the code sent to phone |
| OTP expired | "OTP has expired. Please request a new one." | Click back and send OTP again |
| Weak password | "Password is too weak. Use at least 6 characters." | Use stronger password |
| Password mismatch | "Passwords do not match." | Ensure both passwords are identical |

## Security Features

✅ **reCAPTCHA Protection** - Prevents bot attacks on OTP requests  
✅ **Phone Verification** - OTP sent to actual phone number  
✅ **OTP Expiry** - Firebase automatically expires OTP after 5 minutes  
✅ **Rate Limiting** - Firebase limits failed OTP attempts  
✅ **No Email Credentials** - Removed dependency on email credentials  

## Frontend to Backend Integration

### Old Flow (Email):
- Frontend → Send email request to backend
- Backend → SMTP to Gmail with credentials
- Issue: Email credentials in .env, SMTP failures

### New Flow (Phone OTP):
- Frontend → Direct Firebase Phone Auth (no backend needed)
- Firebase → SMS to phone
- Benefit: No backend email service required

## Troubleshooting

### OTP Not Received?
1. Check phone number format: `+{country_code}{number}`
2. Disable SMS blocking on phone
3. Check spam/messages app
4. Verify phone auth is enabled in Firebase Console

### reCAPTCHA Widget Not Appearing?
1. Check browser console for errors
2. Verify Firebase config is correct in `src/services/firebase.js`
3. Clear browser cache and reload

### Password Not Updating?
1. Check Firebase Database rules allow writing to `users/{uid}/password`
2. Verify user has proper authentication session
3. Check browser console for error details

## Next Steps (Optional Enhancements)

1. **Store Phone Numbers** - Add phone field to patient/doctor profiles
2. **Biometric Verification** - Combine with fingerprint on mobile
3. **SMS Templates** - Customize OTP message text
4. **Backup Codes** - Generate backup codes if phone lost
5. **2FA Integration** - Make OTP permanent two-factor authentication

## Testing Checklist

- [ ] Login page shows "Forgot Password?" button
- [ ] Click shows phone input field
- [ ] Enter phone number and send OTP
- [ ] reCAPTCHA widget appears (may be invisible)
- [ ] OTP code input appears
- [ ] Enter valid OTP and verify
- [ ] Password reset form appears
- [ ] Enter and confirm new password
- [ ] Password updates successfully
- [ ] Success message shown
- [ ] Can login with new password

## Code Examples

### Manual Usage of Functions (if needed):

```javascript
import { sendOTP, verifyOTP, resetPasswordWithOTP } from './services/auth';

// Step 1: Send OTP
const confirmationResult = await sendOTP('+919876543210');

// Step 2: Verify OTP
const verifiedUser = await verifyOTP(confirmationResult, '123456');

// Step 3: Reset Password
await resetPasswordWithOTP(verifiedUser, 'newPassword123', userUID);
```

## Support

For issues or questions:
1. Check Firebase Console logs
2. Review browser console errors
3. Verify database rules in Firebase
4. Test with Firebase UI to debug auth issues
