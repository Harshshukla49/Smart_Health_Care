const AUTH_STORAGE_KEY = 'smart-health-auth-session';

export const DASHBOARD_ROUTES = {
  patient: '/dashboard',
  doctor: '/dashboard',
  hospital_admin: '/dashboard',
  super_admin: '/dashboard',
};

export function normalizeRole(role) {
  const clean = String(role || '').trim().toLowerCase();
  if (clean === 'super_admin') return 'super_admin';
  if (clean === 'hospital_admin') return 'hospital_admin';
  if (clean === 'doctor') return 'doctor';
  return 'patient';
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

export function clearClientClinicalState() {
  if (typeof window === 'undefined') return;

  // 1. Wipe in-memory caches
  try {
    if (window.__clearPatientsCache) {
      window.__clearPatientsCache();
    }
  } catch {}

  // 2. Remove sensitive clinical keys from localStorage while preserving harmless preferences
  try {
    const preserveKeys = new Set([
      'smart-health-theme',
      'smart-health-language',
      'smart-health-language-global',
      'pwa_dismissed_time',
      'spa_redirect_path',
      'location_sharing_pref',
      'emergency_location_pref',
    ]);

    const sensitivePrefixes = [
      'smart-health-patients',
      'medical_reports_hist',
      'patient_sos_contacts',
      'patient_sos_contact',
      'clinical_settings',
    ];

    const keysToRemove = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || preserveKeys.has(k)) continue;
      if (sensitivePrefixes.some((prefix) => k.startsWith(prefix))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {}

  // 3. Clear all sessionStorage to eliminate tab-isolated clinical persistence
  try {
    window.sessionStorage.clear();
  } catch {}
}

export function setAuthSession(session) {
  if (typeof window === 'undefined') {
    return;
  }

  const existing = getAuthSession();
  const existingUserId = existing?.id || existing?.patientId || existing?.email;
  const newUserId = session?.id || session?.patientId || session?.email;

  // When switching accounts, immediately clear previous user's client-side clinical cache
  if (existingUserId && newUserId && existingUserId !== newUserId) {
    clearClientClinicalState();
  }

  window.localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      ...session,
      role: normalizeRole(session.role),
      loggedInAt: new Date().toISOString(),
    })
  );

  try {
    window.dispatchEvent(new CustomEvent('smart-health-auth-change', { detail: session }));
  } catch {}
}

export function clearAuthSession() {
  if (typeof window === 'undefined') {
    return;
  }

  clearClientClinicalState();
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  try {
    window.dispatchEvent(new CustomEvent('smart-health-auth-change', { detail: null }));
  } catch {}
}
