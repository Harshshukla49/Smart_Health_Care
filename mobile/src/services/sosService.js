import { sosApiClient } from './apiClient';

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

export async function triggerSosAlert({ patientId, heartRate, spo2, temperature, locationLink = '' }) {
  const response = await sosApiClient.post('/api/sos/trigger', {
    patientId: toText(patientId).trim(),
    heartRate: toNumber(heartRate),
    spo2: toNumber(spo2),
    temperature: toNumber(temperature),
    locationLink: toText(locationLink),
  });

  return response?.data || {};
}

export async function resetSosAlert({ patientId }) {
  const response = await sosApiClient.post('/api/sos/reset', {
    patientId: toText(patientId).trim(),
  });

  return response?.data || {};
}
