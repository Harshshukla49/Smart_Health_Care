import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingConfig = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingConfig.length > 0) {
  // eslint-disable-next-line no-console
  console.warn(`Missing Firebase config keys: ${missingConfig.join(', ')}`);
}

let firebaseApp = null;
let firebaseAuth = null;

try {
  if (missingConfig.length === 0) {
    firebaseApp = initializeApp(firebaseConfig);
    firebaseAuth = getAuth(firebaseApp);
  }
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('Firebase initialization failed:', error);
}

const missingFirebaseConfigKeys = missingConfig;

export { firebaseApp, firebaseAuth, missingFirebaseConfigKeys };
