import { apiClient } from './apiClient';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value, fallback = '') {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value);
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeVitals(payload = {}) {
  return {
    patientId: toText(payload.patientId),
    heartRate: toNumber(payload.heartRate ?? payload.heart_rate),
    spo2: toNumber(payload.spo2 ?? payload.SpO2),
    temperature: toNumber(payload.temperature ?? payload.temp),
    ecgData: toArray(payload.ecgData || payload.ecg || payload.ecgSignal),
    updatedAt: toText(payload.updatedAt || payload.timestamp),
  };
}

export function normalizePrediction(payload = {}) {
  return {
    risk: toText(payload.risk, 'Unknown'),
    status: toText(payload.status || payload.prediction, 'Unknown'),
    confidence: toNumber(payload.confidence, 0),
    message: toText(payload.message, 'Prediction unavailable'),
    source: toText(payload.source, ''),
  };
}

export function normalizeAuditEntry(entry = {}) {
  return {
    timestamp: toText(entry.timestamp),
    source: toText(entry.source),
    risk: toText(entry.risk),
    status: toText(entry.status),
    confidence: toNumber(entry.confidence, 0),
    message: toText(entry.message),
    vitals: {
      heartRate: toNumber(entry?.vitals?.heartRate ?? entry?.vitals?.heart_rate),
      spo2: toNumber(entry?.vitals?.spo2),
      temperature: toNumber(entry?.vitals?.temperature),
    },
  };
}

export async function getPatientVitals(patientId) {
  const response = await apiClient.get(`/api/vitals/${encodeURIComponent(String(patientId || '').trim())}`);
  const payload = response?.data?.data || response?.data || {};
  return normalizeVitals(payload);
}

export async function getPatientPredictionAudit(patientId) {
  const response = await apiClient.get(`/api/patient/${encodeURIComponent(String(patientId || '').trim())}/prediction-audit`);
  const rows = Array.isArray(response?.data?.audit) ? response.data.audit : [];
  return rows.map(normalizeAuditEntry);
}

export async function predictRiskForVitals({ heartRate, spo2, temperature }) {
  const response = await apiClient.post('/predict', {
    heart_rate: toNumber(heartRate),
    spo2: toNumber(spo2),
    temperature: toNumber(temperature),
  });

  return normalizePrediction(response?.data || {});
}