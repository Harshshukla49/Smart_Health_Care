import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

// Safe development-only configuration check (never exposes private credentials)
if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.log('[Firebase Environment Check]', {
    'Firebase API Key': firebaseConfig.apiKey ? 'configured' : 'MISSING',
    'Firebase Auth Domain': firebaseConfig.authDomain ? 'configured' : 'MISSING',
    'Firebase Project ID': firebaseConfig.projectId ? 'configured' : 'MISSING',
    'Firebase App ID': firebaseConfig.appId ? 'configured' : 'MISSING',
    'Firebase Storage Bucket': firebaseConfig.storageBucket ? 'configured' : 'MISSING (optional)',
    'Firebase Messaging Sender ID': firebaseConfig.messagingSenderId ? 'configured' : 'MISSING (optional)',
    'Firebase Database URL': firebaseConfig.databaseURL ? 'configured' : 'MISSING (optional)',
  });
}

// Track required keys for phone authentication
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingFirebaseConfigKeys = requiredKeys.filter((key) => !firebaseConfig[key]);

if (missingFirebaseConfigKeys.length > 0) {
  // eslint-disable-next-line no-console
  console.warn(
    `[Firebase] Missing configuration keys for phone auth: ${missingFirebaseConfigKeys.join(', ')}. ` +
    'Ensure frontend/.env contains VITE_FIREBASE_* variables and restart the Vite server.'
  );
}

// Initialize Firebase only once
let app = null;
let auth = null;

try {
  if (missingFirebaseConfigKeys.length === 0) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
  }
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('[Firebase] Initialization error:', error);
}

// Standard exports
export const firebaseApp = app;
export const firebaseAuth = auth;
export { app, auth, firebaseConfig, missingFirebaseConfigKeys };
export default app;
