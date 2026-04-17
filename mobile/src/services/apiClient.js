import axios from 'axios';
import { API_BASE_URL, SOS_API_BASE_URL } from '../config/env';

let getSession = () => null;

export function configureSessionResolver(resolver) {
  getSession = resolver;
}

function attachSessionHeaders(config) {
  const session = getSession?.();
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

  if (session.role === 'doctor') {
    if (session.email) {
      config.headers['X-Doctor-Email'] = session.email;
    }
    if (session.phone) {
      config.headers['X-Doctor-Phone'] = session.phone;
    }
  }

  return config;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
});

export const sosApiClient = axios.create({
  baseURL: SOS_API_BASE_URL,
  timeout: 12000,
});

apiClient.interceptors.request.use(attachSessionHeaders);
sosApiClient.interceptors.request.use(attachSessionHeaders);
