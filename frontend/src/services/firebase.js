import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCqlojCmA8TFc5iXqMXXA5PQ5p1fi8um7o',
  authDomain: 'smart-health-care-cd723.firebaseapp.com',
  projectId: 'smart-health-care-cd723',
  appId: '1:607879480771:web:b4e19a21bf9be9b79e6976',
  databaseURL: 'https://smart-health-care-cd723-default-rtdb.asia-southeast1.firebasedatabase.app',
  storageBucket: 'smart-health-care-cd723.firebasestorage.app',
  messagingSenderId: '607879480771',
  measurementId: 'G-GWC7VP64LK',
};

const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey || '').trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain || '').trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId || '').trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId || '').trim(),
  databaseURL: (import.meta.env.VITE_FIREBASE_DATABASE_URL || DEFAULT_FIREBASE_CONFIG.databaseURL || '').trim(),
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket || '').trim(),
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId || '').trim(),
  measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || DEFAULT_FIREBASE_CONFIG.measurementId || '').trim(),
};

const missingConfig = ['apiKey', 'authDomain', 'projectId', 'appId']
  .filter((key) => !firebaseConfig[key]);

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
