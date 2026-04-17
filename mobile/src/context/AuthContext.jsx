import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { configureSessionResolver } from '../services/apiClient';
import { clearSession, getStoredSession, saveSession } from '../services/secureStore';
import { loginDoctor, loginPatient, signupDoctor } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;

    getStoredSession()
      .then((stored) => {
        if (mounted && stored) {
          setSession(stored);
        }
      })
      .finally(() => {
        if (mounted) {
          setInitializing(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    configureSessionResolver(() => session);
  }, [session]);

  const signInDoctor = useCallback(async (credentials) => {
    const nextSession = await loginDoctor(credentials);
    setSession(nextSession);
    await saveSession(nextSession);
    return nextSession;
  }, []);

  const signInPatient = useCallback(async (credentials) => {
    const nextSession = await loginPatient(credentials);
    setSession(nextSession);
    await saveSession(nextSession);
    return nextSession;
  }, []);

  const registerDoctor = useCallback(async (payload) => {
    const nextSession = await signupDoctor(payload);
    setSession(nextSession);
    await saveSession(nextSession);
    return nextSession;
  }, []);

  const signOut = useCallback(async () => {
    setSession(null);
    await clearSession();
  }, []);

  const value = useMemo(
    () => ({
      session,
      initializing,
      signInDoctor,
      signInPatient,
      registerDoctor,
      signOut,
    }),
    [initializing, registerDoctor, session, signInDoctor, signInPatient, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
