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

  return config;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
});

export const sosApiClient = axios.create({
  baseURL: SOS_API_BASE_URL,
  timeout: 60000,
});

apiClient.interceptors.request.use(attachSessionHeaders);
sosApiClient.interceptors.request.use(attachSessionHeaders);
