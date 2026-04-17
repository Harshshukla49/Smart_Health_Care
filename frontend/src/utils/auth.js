const AUTH_STORAGE_KEY = 'smart-health-auth-session';

export const DASHBOARD_ROUTES = {
  patient: '/dashboard',
  doctor: '/dashboard',
};

export function normalizeRole(role) {
  return role === 'doctor' ? 'doctor' : 'patient';
}

export function getDashboardPathForRole(role) {
  return DASHBOARD_ROUTES[normalizeRole(role)];
}

export function getAuthSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(session) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      ...session,
      role: normalizeRole(session.role),
      loggedInAt: new Date().toISOString(),
    })
  );
}

export function clearAuthSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}
