import { apiClient } from './apiClient';

function toText(value) {
  return String(value || '').trim();
}

function unwrapEnvelope(response) {
  const payload = response?.data || {};
  return payload?.data && typeof payload.data === 'object' ? payload.data : payload;
}

export async function loginDoctor({ email, password }) {
  const response = await apiClient.post('/doctor/login', {
    email: toText(email).toLowerCase(),
    password: toText(password),
  });

  const payload = unwrapEnvelope(response);
  return {
    role: 'doctor',
    token: payload?.auth?.token || '',
    tokenExpiresIn: payload?.auth?.expiresIn || 0,
    name: payload?.doctor?.name || 'Doctor',
    email: payload?.doctor?.email || toText(email).toLowerCase(),
    phone: payload?.doctor?.phone || '',
    doctorId: payload?.doctor?.email || toText(email).toLowerCase(),
  };
}

export async function loginPatient({ patientId, password }) {
  const response = await apiClient.post('/login-patient', {
    patientId: toText(patientId),
    password: toText(password),
  });

  const payload = unwrapEnvelope(response);
  return {
    role: 'patient',
    token: payload?.auth?.token || '',
    tokenExpiresIn: payload?.auth?.expiresIn || 0,
    name: payload?.patient?.name || 'Patient',
    email: payload?.patient?.email || '',
    phone: payload?.patient?.phone || '',
    patientId: payload?.patient?.patientId || toText(patientId),
  };
}

export async function signupDoctor({ name, email, phone, password }) {
  const response = await apiClient.post('/doctor/signup', {
    name: toText(name),
    email: toText(email).toLowerCase(),
    phone: toText(phone),
    password: toText(password),
  });

  const payload = unwrapEnvelope(response);
  return {
    role: 'doctor',
    token: payload?.auth?.token || '',
    tokenExpiresIn: payload?.auth?.expiresIn || 0,
    name: payload?.doctor?.name || toText(name),
    email: payload?.doctor?.email || toText(email).toLowerCase(),
    phone: payload?.doctor?.phone || toText(phone),
    doctorId: payload?.doctor?.email || toText(email).toLowerCase(),
  };
}

export async function verifyFirebasePhoneToken({ idToken, role }) {
  const response = await apiClient.post('/auth/firebase/verify-phone-token', {
    idToken: toText(idToken),
    role: toText(role).toLowerCase(),
  });
  const payload = unwrapEnvelope(response);
  return {
    uid: toText(payload?.uid),
    phone: toText(payload?.phone),
    role: toText(payload?.role),
    auth: payload?.auth || null,
    user: payload?.user || null,
  };
}

export async function resetPasswordWithFirebasePhone({ idToken, role, newPassword, confirmPassword }) {
  const response = await apiClient.post('/reset-password/firebase-phone', {
    idToken: toText(idToken),
    role: toText(role).toLowerCase(),
    newPassword: toText(newPassword),
    confirmPassword: toText(confirmPassword),
  });
  return unwrapEnvelope(response);
}
