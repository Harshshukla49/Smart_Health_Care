import axios from 'axios';
import { fallbackPatients } from '../data/demoData';
import { getAuthSession } from '../utils/auth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://smart-health-backend-2idf.onrender.com',
  timeout: 60000,
});

const sosApi = axios.create({
  baseURL: import.meta.env.VITE_SOS_API_BASE_URL || 'http://localhost:5001',
  timeout: 60000,
});

const PATIENT_STORAGE_KEY = 'smart-health-patients';

const hasWindow = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const getPatientStorageKey = () => {
  const session = getAuthSession();

  if (session?.role === 'doctor' && session?.email) {
    return `${PATIENT_STORAGE_KEY}:${session.email.toLowerCase()}`;
  }

  if (session?.role === 'patient' && session?.patientId) {
    return `${PATIENT_STORAGE_KEY}:patient:${String(session.patientId).toLowerCase()}`;
  }

  return PATIENT_STORAGE_KEY;
};

const attachSessionHeaders = (config) => {
  const session = getAuthSession();
  if (!session) {
    return config;
  }

  config.headers = config.headers || {};
  if (session.token) {
    config.headers.Authorization = `Bearer ${session.token}`;
  }
  if (session.role) {
    config.headers['X-User-Role'] = session.role;
  }
  if (session.email) {
    config.headers['X-User-Email'] = session.email;
  }
  if (session.role === 'patient' && session.patientId) {
    config.headers['X-Patient-Id'] = session.patientId;
  }
  if (session.role === 'doctor' && session.email) {
    config.headers['X-Doctor-Email'] = session.email;
    if (session.phone) {
      config.headers['X-Doctor-Phone'] = session.phone;
    }
  }

  return config;
};

api.interceptors.request.use(attachSessionHeaders);
sosApi.interceptors.request.use(attachSessionHeaders);

const toNumber = (value, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const toText = (value, fallback = '') => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return String(value);
};

const toEcgArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item));
  }

  if (typeof value === 'string') {
    return value
      .split(/[\s,]+/)
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item));
  }

  return [];
};

const toPredictionStatus = (predictionValue) => {
  if (!predictionValue) {
    return '';
  }

  if (typeof predictionValue === 'object') {
    return toText(predictionValue.status || predictionValue.prediction || predictionValue.risk, '');
  }

  return toText(predictionValue, '');
};

const deriveStatus = ({ heartRate, spo2, temperature, status, prediction }) => {
  if (status) {
    return status;
  }

  const predictionStatus = toPredictionStatus(prediction);
  if (predictionStatus) {
    return predictionStatus;
  }

  const hr = toNumber(heartRate);
  const oxygen = toNumber(spo2);
  const temp = toNumber(temperature);

  if (oxygen < 90 || hr >= 120 || temp >= 39) {
    return 'Critical';
  }

  if (oxygen < 94 || hr >= 100 || temp >= 38) {
    return 'Warning';
  }

  return 'Normal';
};

const readLocalPatients = () => {
  if (!hasWindow) {
    return [];
  }

  try {
    const source = window.localStorage.getItem(getPatientStorageKey());
    if (!source) {
      return [];
    }

    const parsed = JSON.parse(source);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalPatients = (patients) => {
  if (!hasWindow) {
    return;
  }

  try {
    window.localStorage.setItem(getPatientStorageKey(), JSON.stringify(patients));
  } catch {
    // Ignore storage errors in restricted browsers.
  }
};

const normalizeReading = (reading) => ({
  timestamp: toText(reading.timestamp || reading.updatedAt, new Date().toISOString()),
  heartRate: toNumber(reading.heartRate ?? reading.heart_rate ?? reading.hr),
  spo2: toNumber(reading.spo2 ?? reading.SpO2),
  temperature: toNumber(reading.temperature ?? reading.temp),
});

export const normalizePatient = (patient = {}) => {
  const readings = Array.isArray(patient.readings) ? patient.readings.map(normalizeReading).slice(-10) : [];
  const ecgData = toEcgArray(patient.ecgData || patient.vitals?.ecgData || patient.ecg || patient.ecgSignal);

  return {
    id: toText(patient.id || patient.patientId || patient._id, `patient-${Math.random().toString(36).slice(2, 9)}`),
    patientId: toText(patient.patientId || patient.id || patient._id, ''),
    name: toText(patient.name || patient.fullName, 'Unnamed Patient'),
    age: toNumber(patient.age ?? patient.Age),
    gender: toText(patient.gender, ''),
    phone: toText(patient.phone || patient.phoneNumber, ''),
    email: toText(patient.email, ''),
    symptoms: toText(patient.symptoms, ''),
    heartRate: toNumber(patient.heartRate ?? patient.heart_rate ?? patient.hr),
    spo2: toNumber(patient.spo2 ?? patient.SpO2 ?? patient.predicted_spo2),
    temperature: toNumber(patient.temperature ?? patient.temp),
    status: deriveStatus(patient),
    prediction: toPredictionStatus(patient.prediction || patient.result || patient.status),
    updatedAt: toText(patient.updatedAt || patient.timestamp, new Date().toLocaleString()),
    createdAt: toText(patient.createdAt, ''),
    notes: toText(patient.notes, ''),
    ecgData,
    readings,
  };
};

export const getStoredPatients = () => readLocalPatients().map(normalizePatient);

export const savePatientLocally = (patient) => {
  const normalizedPatient = normalizePatient(patient);
  const localPatients = readLocalPatients();
  const nextPatients = [normalizedPatient, ...localPatients.filter((existing) => String(existing.id) !== String(normalizedPatient.id))];
  writeLocalPatients(nextPatients.slice(0, 50));
  return normalizedPatient;
};

const extractPatientArray = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.patients)) {
    return payload.patients;
  }

  if (payload && payload.data) {
    return extractPatientArray(payload.data);
  }

  if (payload && typeof payload === 'object') {
    return Object.entries(payload).map(([id, value]) => ({ id, ...(value || {}) }));
  }

  return [];
};

const getFallbackPatientList = () => fallbackPatients.map(normalizePatient);

const buildPatientPayload = ({ name, age, heartRate, spo2, temperature, notes = '' }) => ({
  name: toText(name, 'Unnamed Patient'),
  age: toNumber(age),
  heart_rate: toNumber(heartRate),
  spo2: toNumber(spo2),
  temperature: toNumber(temperature),
  notes: toText(notes, ''),
});

const buildPatientAccountPayload = ({
  name,
  age,
  gender,
  phone,
  email,
  symptoms,
  heartRate,
  spo2,
  temperature,
  ecgData,
}) => ({
  name: toText(name, 'Unnamed Patient'),
  age: toNumber(age),
  gender: toText(gender),
  phone: toText(phone),
  email: toText(email),
  symptoms: toText(symptoms),
  heart_rate: toNumber(heartRate),
  spo2: toNumber(spo2),
  temperature: toNumber(temperature),
  ecgData: toEcgArray(ecgData),
});

export const getPatients = async () => {
  try {
    const response = await api.get('/patients');
    const patients = extractPatientArray(response.data);

    const normalizedPatients = patients.map(normalizePatient);
    writeLocalPatients(normalizedPatients);
    return normalizedPatients;
  } catch {
    // Try alternate backend shape before falling back to cached or demo data.
  }

  try {
    const response = await api.get('/real-data');
    const patients = extractPatientArray(response.data?.data);

    if (patients.length > 0) {
      const normalizedPatients = patients.map(normalizePatient);
      writeLocalPatients(normalizedPatients);
      return normalizedPatients;
    }
  } catch {
    // Continue to local fallback.
  }

  const localPatients = readLocalPatients().map(normalizePatient);
  if (localPatients.length > 0) {
    return localPatients;
  }

  return getFallbackPatientList();
};

export const getPatientById = async (patientId) => {
  const patients = await getPatients();
  return patients.find((patient) => String(patient.id) === String(patientId)) || null;
};

export const addPatient = async (patientInput) => {
  const payload = buildPatientPayload(patientInput);

  try {
    const response = await api.post('/add-patient', payload);
    const savedPatient = normalizePatient(response.data?.patient || response.data?.data || response.data || payload);
    savePatientLocally(savedPatient);

    return {
      success: true,
      source: 'api',
      patient: savedPatient,
      message: response.data?.message || 'Patient saved successfully.',
      raw: response.data,
    };
  } catch (error) {
    const offlinePatient = savePatientLocally({
      ...payload,
      status: deriveStatus(payload),
      updatedAt: new Date().toLocaleString(),
    });

    return {
      success: true,
      source: 'local',
      patient: offlinePatient,
      message: error?.response?.data?.message || 'Backend unavailable. Patient saved locally.',
      raw: error?.response?.data || null,
    };
  }
};

export const createPatientAccount = async (patientInput) => {
  const payload = buildPatientAccountPayload(patientInput);
  const response = await api.post('/add-patient', payload);

  const patient = normalizePatient(response.data?.patient || payload);
  savePatientLocally(patient);

  return {
    patient,
    credentials: response.data?.credentials || null,
    message: response.data?.message || 'Patient created successfully.',
  };
};

export const loginPatient = async ({ patientId, password }) => {
  const response = await api.post('/login-patient', {
    patientId: toText(patientId),
    password: toText(password),
  });

  return {
    patient: normalizePatient(response.data?.patient || {}),
    auth: response.data?.auth || null,
  };
};

export const signupDoctor = async ({ name, email, phone, password }) => {
  const response = await api.post('/doctor/signup', {
    name: toText(name),
    email: toText(email).toLowerCase(),
    phone: toText(phone),
    password: toText(password),
  });
  return {
    doctor: response.data?.doctor || null,
    auth: response.data?.auth || null,
  };
};

export const loginDoctor = async ({ email, password }) => {
  const response = await api.post('/doctor/login', {
    email: toText(email).toLowerCase(),
    password: toText(password),
  });
  return {
    doctor: response.data?.doctor || null,
    auth: response.data?.auth || null,
  };
};

export const verifyFirebasePhoneToken = async ({ idToken, role }) => {
  const response = await api.post('/auth/firebase/verify-phone-token', {
    idToken: toText(idToken),
    role: toText(role).toLowerCase(),
  });

  return {
    uid: toText(response.data?.uid),
    phone: toText(response.data?.phone),
    role: toText(response.data?.role),
    auth: response.data?.auth || null,
    user: response.data?.user || null,
  };
};

export const resetPasswordWithFirebasePhone = async ({ idToken, role, newPassword, confirmPassword }) => {
  const response = await api.post('/reset-password/firebase-phone', {
    idToken: toText(idToken),
    role: toText(role).toLowerCase(),
    newPassword: toText(newPassword),
    confirmPassword: toText(confirmPassword),
  });
  return response.data;
};

export const updateDoctorProfile = async ({ name, email, phone }) => {
  const response = await api.post('/doctor/profile/update', {
    name: toText(name),
    email: toText(email).toLowerCase(),
    phone: toText(phone),
  });

  return {
    doctor: response.data?.doctor || null,
    auth: response.data?.auth || null,
    syncedPatients: toNumber(response.data?.syncedPatients, 0),
    message: response.data?.message || 'Doctor profile updated successfully.',
  };
};

export const updatePatientProfile = async ({ patientId, email, phone }) => {
  const response = await api.post('/patient/profile/update', {
    patientId: toText(patientId),
    email: toText(email).toLowerCase(),
    phone: toText(phone),
  });

  return {
    patient: normalizePatient(response.data?.patient || {}),
    auth: response.data?.auth || null,
    message: response.data?.message || 'Patient profile updated successfully.',
  };
};

export const getPatientProfile = async (patientId) => {
  const response = await api.get(`/patient/${encodeURIComponent(patientId)}`);
  return normalizePatient(response.data?.patient || {});
};

export const getApiPatientById = async (patientId) => {
  const response = await api.get(`/api/patient/${encodeURIComponent(patientId)}`);
  return response.data?.data || null;
};

export const connectPatientDevice = async (patientId) => {
  const response = await api.post(`/connect-device/${encodeURIComponent(patientId)}`);
  return response.data?.data || null;
};

export const disconnectPatientDevice = async (patientId) => {
  const response = await api.post(`/disconnect-device/${encodeURIComponent(patientId)}`);
  return response.data?.data || null;
};

export const getPatientPredictionAudit = async (patientId) => {
  const response = await api.get(`/api/patient/${encodeURIComponent(patientId)}/prediction-audit`);
  return Array.isArray(response.data?.audit) ? response.data.audit : [];
};

export const getPatientVitals = async (patientId) => {
  const response = await api.get(`/api/vitals/${encodeURIComponent(patientId)}`);
  const payload = response.data?.data || response.data || {};

  return {
    patientId: toText(payload.patientId || patientId),
    heartRate: toNumber(payload.heartRate ?? payload.heart_rate),
    spo2: toNumber(payload.spo2 ?? payload.SpO2),
    temperature: toNumber(payload.temperature ?? payload.temp),
    ecgData: toEcgArray(payload.ecgData || payload.ecg || payload.ecgSignal),
    updatedAt: toText(payload.updatedAt || payload.timestamp, new Date().toLocaleTimeString()),
  };
};

export const updatePatientManualValues = async (patientId, input) => {
  const parsedEcg = toEcgArray(input?.ecgData);
  const payload = {
    heart_rate: input?.heartRate,
    spo2: input?.spo2,
    temperature: input?.temperature,
  };

  if (parsedEcg.length) {
    payload.ecgData = parsedEcg;
  }

  const response = await api.post(`/api/patient/${encodeURIComponent(patientId)}/manual-update`, payload);
  return response.data?.data || null;
};

export const predictVitals = async ({ heartRate, spo2, temperature }) => {
  const payload = {
    heart_rate: toNumber(heartRate),
    spo2: toNumber(spo2),
    temperature: toNumber(temperature),
  };
  const response = await api.post('/predict', payload);
  const prediction = toText(response.data?.prediction || response.data?.status).toLowerCase();
  const confidence = toNumber(response.data?.confidence, 0);

  return {
    success: true,
    source: 'api',
    prediction,
    status: prediction,
    confidence,
    raw: response.data,
  };
};

export const predictPatientRisk = async ({ heartRate, spo2, temperature }) => {
  const payload = {
    heart_rate: toNumber(heartRate),
    spo2: toNumber(spo2),
    temperature: toNumber(temperature),
  };

  const response = await api.post('/predict', payload);

  return {
    risk: toText(response.data?.risk || response.data?.prediction || response.data?.status, 'Low'),
    message: toText(response.data?.message, 'Vitals are stable.'),
  };
};

export const getRealtimePatientMonitoring = async (patientId) => {
  const response = await api.get(`/patient/${encodeURIComponent(patientId)}/monitor`);
  return response.data;
};

export const triggerSosAlert = async ({ patientId, heartRate, spo2, temperature }) => {
  const response = await sosApi.post('/api/sos/trigger', {
    patientId,
    heartRate: toNumber(heartRate),
    spo2: toNumber(spo2),
    temperature: toNumber(temperature),
  });

  return response.data;
};

export const getChatThreadContext = async ({ patientId } = {}) => {
  const query = patientId ? `?patientId=${encodeURIComponent(toText(patientId))}` : '';
  const response = await api.get(`/chat/thread-context${query}`);
  return response.data?.data || null;
};

export const getChatMessages = async (threadId, { limit = 60, before = '' } = {}) => {
  const params = new URLSearchParams();
  if (limit) {
    params.set('limit', String(limit));
  }
  if (before) {
    params.set('before', String(before));
  }

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await api.get(`/chat/threads/${encodeURIComponent(toText(threadId))}/messages${query}`);
  return Array.isArray(response.data?.messages) ? response.data.messages : [];
};

export const sendChatMessage = async ({ threadId, text, receiverId = '' }) => {
  const response = await api.post(`/chat/threads/${encodeURIComponent(toText(threadId))}/messages`, {
    text: toText(text),
    receiverId: toText(receiverId),
  });
  return response.data?.message || null;
};

export const markChatMessageRead = async ({ messageId, threadId }) => {
  const response = await api.patch(`/chat/messages/${encodeURIComponent(toText(messageId))}/read`, {
    threadId: toText(threadId),
  });
  return response.data?.message || null;
};

export const submitContactMessage = async (formData) => {
  return {
    success: true,
    message: `Thanks ${formData.name || 'there'}. We received your message and will respond soon.`,
  };
};

export const getFallbackPatients = () => getFallbackPatientList();
