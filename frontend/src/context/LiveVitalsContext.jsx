import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getApiPatientById, getPatientVitals, getPatients } from '../services/api';
import { getAuthSession } from '../utils/auth';

const SOCKET_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://smart-health-backend-2idf.onrender.com';
const POLL_INTERVAL_MS = 3000;
const ECG_MAX_POINTS = 100;
const UPDATE_THROTTLE_MS = 350;

const LiveVitalsContext = createContext(null);

const toNumber = (value, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const toTimestamp = (value) => String(value || new Date().toLocaleTimeString());

const toVitals = (payload = {}) => {
  const readings = payload.vitals && typeof payload.vitals === 'object' ? payload.vitals : payload;
  const prediction = payload.prediction && typeof payload.prediction === 'object'
    ? payload.prediction
    : (readings.prediction && typeof readings.prediction === 'object' ? readings.prediction : {});

  return {
    heartRate: toNumber(readings.heartRate ?? readings.heart_rate ?? payload.heartRate ?? payload.heart_rate),
    spo2: toNumber(readings.spo2 ?? readings.SpO2 ?? payload.spo2 ?? payload.SpO2),
    temperature: toNumber(readings.temperature ?? readings.temp ?? payload.temperature ?? payload.temp),
    updatedAt: toTimestamp(readings.updatedAt || readings.timestamp || payload.updatedAt || payload.timestamp),
    risk: payload.risk || readings.risk || prediction.risk || '',
    risk_score: payload.risk_score ?? readings.risk_score ?? prediction.risk_score ?? undefined,
    confidence: payload.confidence ?? readings.confidence ?? prediction.confidence ?? undefined,
    alerts: Array.isArray(payload.alerts) ? payload.alerts : Array.isArray(readings.alerts) ? readings.alerts : Array.isArray(prediction.alerts) ? prediction.alerts : [],
    message: payload.message || readings.message || prediction.message || '',
  };
};

const sanitizeEcgArray = (input) => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => toNumber(item, Number.NaN))
    .filter((item) => Number.isFinite(item));
};

const extractEcgFromPayload = (payload) => {
  const candidates = [
    payload?.ecgData,
    payload?.ecg,
    payload?.ecgSignal,
    payload?.ecg_signal,
    payload?.vitals?.ecgData,
    payload?.vitals?.ecg,
    payload?.vitals?.ecgSignal,
    payload?.vitals?.ecg_signal,
    payload?.data?.ecgData,
    payload?.data?.ecg,
    payload?.data?.ecgSignal,
    payload?.data?.ecg_signal,
    payload?.data?.vitals?.ecgData,
    payload?.data?.vitals?.ecg,
    payload?.data?.vitals?.ecgSignal,
    payload?.data?.vitals?.ecg_signal,
  ];

  for (const item of candidates) {
    const parsed = sanitizeEcgArray(item);
    if (parsed.length) {
      return parsed;
    }
  }

  return [];
};

const appendAndTrim = (current, segment) => {
  if (!segment.length) {
    return current.slice(-ECG_MAX_POINTS);
  }

  return [...current, ...segment].slice(-ECG_MAX_POINTS);
};

export function LiveVitalsProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [vitals, setVitals] = useState({
    heartRate: 0,
    spo2: 0,
    temperature: 0,
    updatedAt: '',
    risk: '',
    risk_score: undefined,
    confidence: undefined,
    alerts: [],
    message: '',
  });
  const [ecgData, setEcgData] = useState([]);

  const socketRef = useRef(null);
  const pollRef = useRef(null);
  const flushTimerRef = useRef(null);
  const pendingRef = useRef(null);
  const lastAppliedAtRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const clearSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const applyIncomingState = useCallback((payload) => {
    if (!payload) {
      return;
    }

    const nextVitals = toVitals(payload.vitals || payload.data?.vitals || payload);
    const ecgFromBackend = extractEcgFromPayload(payload);

    setVitals((current) => ({
      ...nextVitals,
      risk: nextVitals.risk || current.risk,
      risk_score: nextVitals.risk_score ?? current.risk_score,
      confidence: nextVitals.confidence ?? current.confidence,
      alerts: nextVitals.alerts.length ? nextVitals.alerts : current.alerts,
      message: nextVitals.message || current.message,
    }));
    setEcgData((current) => {
      return ecgFromBackend.length ? appendAndTrim(current, ecgFromBackend) : current.slice(-ECG_MAX_POINTS);
    });
  }, []);

  const scheduleIncomingState = useCallback(
    (payload) => {
      const now = Date.now();
      const elapsed = now - lastAppliedAtRef.current;

      if (elapsed >= UPDATE_THROTTLE_MS) {
        lastAppliedAtRef.current = now;
        applyIncomingState(payload);
        return;
      }

      pendingRef.current = payload;
      if (flushTimerRef.current) {
        return;
      }

      flushTimerRef.current = window.setTimeout(() => {
        flushTimerRef.current = null;
        const queued = pendingRef.current;
        pendingRef.current = null;
        lastAppliedAtRef.current = Date.now();
        applyIncomingState(queued);
      }, UPDATE_THROTTLE_MS - elapsed);
    },
    [applyIncomingState]
  );

  // SECURITY FIX: Context initialization respecting doctor and patient role scoping
  useEffect(() => {
    let active = true;

    // Safety timeout: Never freeze the UI in an infinite loading state (e.g. Render cold start)
    const safetyUnblockTimer = window.setTimeout(() => {
      if (active) {
        setLoading(false);
      }
    }, 3500);

    const resolvePatientContext = async () => {
      setLoading(true);
      setError('');

      try {
        const session = getAuthSession();
        const role = session?.role;

        // Patient: Strictly resolve own profile
        if (role === 'patient' && session?.patientId) {
          const profile = await getApiPatientById(session.patientId);
          if (!active) {
            return;
          }

          setPatientId(String(session.patientId));
          setPatientName(String(profile?.name || session?.name || 'Patient'));
          applyIncomingState({
            ...(profile?.vitals || {}),
            ...(profile?.prediction || {}),
            prediction: profile?.prediction || {},
          });
          setEcgData((current) => {
            const ecg = extractEcgFromPayload(profile);
            return ecg.length ? ecg.slice(-ECG_MAX_POINTS) : current;
          });
          return;
        }

        // Doctor: Fetch only doctor's assigned patients
        if (role === 'doctor') {
          const patients = await getPatients();
          if (!active) {
            return;
          }

          const firstPatient = Array.isArray(patients) && patients.length ? patients[0] : null;

          // If doctor has NO assigned patients, do NOT fall back to Akash Soni or demo data
          if (!firstPatient?.id) {
            setPatientId('');
            setPatientName('');
            setError('No assigned patients under your care yet. Add a patient to begin live monitoring.');
            return;
          }

          setPatientId(String(firstPatient.id));
          setPatientName(String(firstPatient.name || 'Patient'));

          const profile = await getApiPatientById(firstPatient.id);
          if (!active) {
            return;
          }

          applyIncomingState({
            ...(profile?.vitals || firstPatient || {}),
            ...(profile?.prediction || firstPatient?.prediction || {}),
            prediction: profile?.prediction || firstPatient?.prediction || {},
          });
          setEcgData((current) => {
            const ecg = extractEcgFromPayload(profile || firstPatient);
            return ecg.length ? ecg.slice(-ECG_MAX_POINTS) : current;
          });
          return;
        }
      } catch (requestError) {
        if (!active) {
          return;
        }

        const message = requestError?.response?.data?.message || requestError?.message || 'Unable to initialize live vitals.';
        setError(message);
      } finally {
        window.clearTimeout(safetyUnblockTimer);
        if (active) {
          setLoading(false);
        }
      }
    };

    resolvePatientContext();

    return () => {
      active = false;
      window.clearTimeout(safetyUnblockTimer);
      clearTimers();
      clearSocket();
    };
  }, [applyIncomingState, clearSocket, clearTimers]);

  useEffect(() => {
    if (!patientId) {
      return undefined;
    }

    // Immediately clear previous patient state to prevent stale data leakage across patients
    setVitals(DEFAULT_VITALS);
    setEcgData([]);
    setError(null);
    clearSocket();
    clearTimers();

    const session = getAuthSession();
    const token = session?.token;

    const socket = io(SOCKET_BASE_URL, {
      transports: ['websocket', 'polling'],
      auth: {
        token: token,
        role: session?.role,
        patientId: session?.patientId,
        doctorId: session?.doctorId,
      },
    });

    socketRef.current = socket;
    socket.emit('subscribe_patient', { patientId, token });

    socket.on('vitals_update', (payload) => {
      scheduleIncomingState(payload);
    });

    socket.on('patient_snapshot', (payload) => {
      scheduleIncomingState(payload?.data || payload);
    });

    socket.on('subscription_error', (err) => {
      console.warn(`[LiveVitals] Socket subscription error for patient ${patientId}:`, err);
    });

    pollRef.current = window.setInterval(async () => {
      try {
        const latestVitals = await getPatientVitals(patientId);
        scheduleIncomingState(latestVitals);
      } catch {
        // Keep websocket as primary channel and ignore transient poll failures.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      clearSocket();
      clearTimers();
    };
  }, [clearSocket, clearTimers, patientId, scheduleIncomingState]);

  const value = useMemo(
    () => ({
      loading,
      error,
      patientId,
      patientName,
      heartRate: vitals.heartRate,
      spo2: vitals.spo2,
      temperature: vitals.temperature,
      updatedAt: vitals.updatedAt,
      ecgData,
      // ML prediction fields
      risk: vitals.risk,
      risk_score: vitals.risk_score,
      confidence: vitals.confidence,
      alerts: vitals.alerts,
      message: vitals.message,
    }),
    [ecgData, error, loading, patientId, patientName, vitals.heartRate, vitals.spo2, vitals.temperature, vitals.updatedAt, vitals.risk, vitals.risk_score, vitals.confidence, vitals.alerts, vitals.message]
  );

  return <LiveVitalsContext.Provider value={value}>{children}</LiveVitalsContext.Provider>;
}

export function useLiveVitals() {
  const context = useContext(LiveVitalsContext);
  if (!context) {
    throw new Error('useLiveVitals must be used within LiveVitalsProvider');
  }
  return context;
}
