import { apiClient } from './apiClient';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value, fallback = '') {
  if (value === undefined || value === null) {
    return fallback;
  }
  return String(value);
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizePatient(patient = {}) {
  return {
    id: toText(patient.id || patient.patientId || patient._id, ''),
    patientId: toText(patient.patientId || patient.id || patient._id, ''),
    name: toText(patient.name || patient.fullName, 'Unnamed Patient'),
    age: toNumber(patient.age),
    gender: toText(patient.gender),
    phone: toText(patient.phone),
    email: toText(patient.email),
    symptoms: toText(patient.symptoms),
    status: toText(patient.status || patient.prediction?.status || 'Normal'),
    prediction: toText(patient.prediction?.risk || patient.prediction || ''),
    heartRate: toNumber(patient.heartRate ?? patient.heart_rate ?? patient.vitals?.heartRate),
    spo2: toNumber(patient.spo2 ?? patient.vitals?.spo2),
    temperature: toNumber(patient.temperature ?? patient.temp ?? patient.vitals?.temperature),
    updatedAt: toText(patient.updatedAt || patient.timestamp || patient.vitals?.updatedAt),
    ecgData: toArray(patient.ecgData || patient.vitals?.ecgData),
  };
}

function extractPatientArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.patients)) {
    return payload.patients;
  }

  if (payload?.data) {
    return extractPatientArray(payload.data);
  }

  if (payload && typeof payload === 'object') {
    return Object.entries(payload).map(([id, value]) => ({ id, ...(value || {}) }));
  }

  return [];
}

export async function getPatients() {
  const response = await apiClient.get('/patients');
  const rows = extractPatientArray(response?.data);
  return rows.map(normalizePatient);
}

export async function getPatientById(patientId) {
  const response = await apiClient.get(`/api/patient/${encodeURIComponent(String(patientId || '').trim())}`);
  return normalizePatient(response?.data?.data || response?.data?.patient || response?.data || {});
}
