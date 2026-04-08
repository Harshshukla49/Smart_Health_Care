import axios from 'axios';
import { fallbackPatients } from '../data/demoData';
import { getAuthSession } from '../utils/auth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  timeout: 12000,
});

const sosApi = axios.create({
  baseURL: import.meta.env.VITE_SOS_API_BASE_URL || 'http://localhost:5001',
  timeout: 12000,
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

export const requestDoctorPasswordReset = async ({ email }) => {
  const response = await api.post('/doctor/reset-password/request', {
    email: toText(email).toLowerCase(),
  });
  return response.data;
};

export const confirmDoctorPasswordReset = async ({ email, token, newPassword }) => {
  const response = await api.post('/doctor/reset-password/confirm', {
    email: toText(email).toLowerCase(),
    token: toText(token),
    newPassword: toText(newPassword),
  });
  return response.data;
};

export const requestPatientPasswordReset = async ({ patientId, email }) => {
  const response = await api.post('/patient/reset-password/request', {
    patientId: toText(patientId),
    email: toText(email).toLowerCase(),
  });
  return response.data;
};

export const confirmPatientPasswordReset = async ({ patientId, email, token, newPassword }) => {
  const response = await api.post('/patient/reset-password/confirm', {
    patientId: toText(patientId),
    email: toText(email).toLowerCase(),
    token: toText(token),
    newPassword: toText(newPassword),
  });
  return response.data;
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
    updatedAt: toText(payload.updatedAt || payload.timestamp, new Date().toLocaleTimeString()),
  };
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

export const submitContactMessage = async (formData) => {
  return {
    success: true,
    message: `Thanks ${formData.name || 'there'}. We received your message and will respond soon.`,
  };
};

export const getFallbackPatients = () => getFallbackPatientList();
