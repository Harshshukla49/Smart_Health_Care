import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { firebaseAuth, missingFirebaseConfigKeys } from './firebase';

const DEFAULT_COUNTRY_CODE = '+91';

let recaptchaVerifier = null;
let confirmationResult = null;
let recaptchaContainerIdRef = '';

const normalizePhoneNumber = (input, defaultCountryCode = DEFAULT_COUNTRY_CODE) => {
  const raw = String(input || '').trim();
  if (!raw) {
    throw new Error('Phone number is required.');
  }

  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (!digits) {
    throw new Error('Phone number is invalid.');
  }

  if (hasPlus) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    const countryDigits = String(defaultCountryCode || DEFAULT_COUNTRY_CODE).replace(/\D/g, '');
    return `+${countryDigits}${digits}`;
  }

  if (digits.length >= 11) {
    return `+${digits}`;
  }

  throw new Error('Enter a valid phone number with country code, e.g. +919876543210.');
};

const maskPhoneNumber = (phone) => {
  const normalized = String(phone || '').trim();
  if (normalized.length < 5) {
    return normalized;
  }

  const suffix = normalized.slice(-4);
  const prefix = normalized.startsWith('+') ? '+' : '';
  return `${prefix}${'*'.repeat(Math.max(2, normalized.length - suffix.length - prefix.length))}${suffix}`;
};

const mapFirebasePhoneError = (error, phase = 'send') => {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();

  if (code.includes('invalid-phone-number')) {
    return 'Invalid phone number. Use format +919876543210.';
  }

  if (code.includes('too-many-requests')) {
    return 'Too many attempts. Please try again after some time.';
  }

  if (code.includes('captcha-check-failed') || code.includes('recaptcha') || message.includes('client element has been removed')) {
    return 'reCAPTCHA verification failed. Refresh and try again.';
  }

  if (phase === 'verify' && (code.includes('invalid-verification-code') || code.includes('code-expired'))) {
    return code.includes('code-expired')
      ? 'OTP has expired. Please request a new OTP.'
      : 'Invalid OTP. Please try again.';
  }

  return error?.message || (phase === 'verify' ? 'OTP verification failed.' : 'OTP send failed.');
};

const assertFirebaseReady = () => {
  if (!firebaseAuth) {
    const missing = Array.isArray(missingFirebaseConfigKeys) && missingFirebaseConfigKeys.length > 0
      ? `Missing: ${missingFirebaseConfigKeys.join(', ')}.`
      : 'Firebase config is invalid.';
    throw new Error(`Firebase phone authentication is not configured. ${missing} Update frontend/.env and restart the frontend server.`);
  }
};

const resetRecaptchaVerifier = () => {
  try {
    recaptchaVerifier?.clear();
  } catch {
    // Ignore cleanup errors from stale verifier references.
  }

  recaptchaVerifier = null;
  recaptchaContainerIdRef = '';
};

const ensureRecaptcha = async (containerId = 'recaptcha-container') => {
  assertFirebaseReady();

  const container = typeof document !== 'undefined' ? document.getElementById(containerId) : null;
  if (!container) {
    throw new Error('reCAPTCHA container is not available. Please reopen reset panel and try again.');
  }

  if (recaptchaVerifier && recaptchaContainerIdRef !== containerId) {
    resetRecaptchaVerifier();
  }

  if (recaptchaVerifier && recaptchaContainerIdRef === containerId && !document.getElementById(recaptchaContainerIdRef)) {
    resetRecaptchaVerifier();
  }

  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, containerId, {
      size: 'invisible',
      callback: () => {
        // Auto callback from invisible reCAPTCHA.
      },
      'expired-callback': () => {
        resetRecaptchaVerifier();
      },
    });
    recaptchaContainerIdRef = containerId;
  }

  await recaptchaVerifier.render();
  return recaptchaVerifier;
};

export const sendOTP = async ({ phoneNumber, role, recaptchaContainerId = 'recaptcha-container' }) => {
  assertFirebaseReady();
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  try {
    const appVerifier = await ensureRecaptcha(recaptchaContainerId);
    confirmationResult = await signInWithPhoneNumber(firebaseAuth, normalizedPhone, appVerifier);

    return {
      phone: normalizedPhone,
      maskedPhone: maskPhoneNumber(normalizedPhone),
      role,
    };
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('client element has been removed')) {
      resetRecaptchaVerifier();
    }
    throw new Error(mapFirebasePhoneError(error, 'send'));
  }
};

export const verifyOTP = async ({ otpCode }) => {
  assertFirebaseReady();
  if (!confirmationResult) {
    throw new Error('Request OTP first before verification.');
  }

  const cleanOtp = String(otpCode || '').trim();
  if (!/^\d{6}$/.test(cleanOtp)) {
    throw new Error('Enter a valid 6-digit OTP.');
  }

  try {
    const credential = await confirmationResult.confirm(cleanOtp);
    const user = credential.user;
    const idToken = await user.getIdToken(true);

    return {
      user,
      idToken,
      phoneNumber: user?.phoneNumber || '',
    };
  } catch (error) {
    throw new Error(mapFirebasePhoneError(error, 'verify'));
  }
};

export const clearPhoneOtpSession = () => {
  confirmationResult = null;
  resetRecaptchaVerifier();
};
