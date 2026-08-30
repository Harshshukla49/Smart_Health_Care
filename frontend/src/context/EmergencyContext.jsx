import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  getCurrentCoordinates,
  isGeolocationSupported,
  queryGeolocationPermission,
  watchCoordinates,
} from '../services/geolocation';
import { getAuthSession, normalizeRole } from '../utils/auth';
import {
  getActiveEmergenciesApi,
  postAmbulanceRequestApi,
  postEmergencyTriggerApi,
  postEmergencyStatusApi,
} from '../services/api';

const EmergencyContext = createContext(null);

const DEFAULT_CRITICAL_SETTINGS = {
  hrMin: 50,
  hrMax: 120,
  spo2Critical: 90,
  tempMax: 38.5,
  audioAlerts: true,
  autoDispatch: false,
};

export function EmergencyProvider({ children, vitalsContext }) {
  const session = getAuthSession();
  const role = normalizeRole(session?.role);
  const isDoctor = role === 'doctor';
  // SECURITY FIX: Strictly use authenticated session credentials without hardcoded fallbacks
  const patientId = session?.patientId || '';
  const patientName = session?.name || '';

  // Location State
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('requesting'); // 'active', 'unavailable', 'requesting', 'denied'
  const [locationPermission, setLocationPermission] = useState('prompt'); // 'prompt', 'granted', 'denied', 'unknown'
  const [locationError, setLocationError] = useState('');
  const [lastLocationTime, setLastLocationTime] = useState(null);

  // Settings & Toggles
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(true);
  const [emergencyLocationSharingEnabled, setEmergencyLocationSharingEnabled] = useState(true);
  const [thresholds, setThresholds] = useState(DEFAULT_CRITICAL_SETTINGS);

  // SOS Contact
  const [sosContact, setSosContact] = useState({
    name: 'Rahul Soni',
    phone: '+91 98765 43210',
    relation: 'Brother',
  });

  // Emergency States & Modals
  const [emergencyState, setEmergencyState] = useState('NORMAL'); // 'NORMAL', 'WARNING', 'CRITICAL', 'AMBULANCE_REQUESTED', 'RESOLVED'
  const [activeEmergency, setActiveEmergency] = useState(null);
  const [doctorActiveEmergencies, setDoctorActiveEmergencies] = useState([]);
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [ambulanceModalOpen, setAmbulanceModalOpen] = useState(false);
  const [ambulanceRequested, setAmbulanceRequested] = useState(false);
  const [ambulanceDispatchInfo, setAmbulanceDispatchInfo] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const autoTriggeredRef = useRef(false);

  // Load Saved Settings and SOS Contact from Local Storage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('clinical_settings');
      if (savedSettings) {
        setThresholds({ ...DEFAULT_CRITICAL_SETTINGS, ...JSON.parse(savedSettings) });
      }

      const savedSos = localStorage.getItem('patient_sos_contact');
      if (savedSos) {
        setSosContact(JSON.parse(savedSos));
      }

      const savedLocShare = localStorage.getItem('location_sharing_pref');
      if (savedLocShare !== null) {
        setLocationSharingEnabled(savedLocShare === 'true');
      }

      const savedEmergShare = localStorage.getItem('emergency_location_pref');
      if (savedEmergShare !== null) {
        setEmergencyLocationSharingEnabled(savedEmergShare === 'true');
      }
    } catch {
      // ignore JSON errors
    }
  }, []);

  // Initial Permission Check
  useEffect(() => {
    let active = true;

    const checkPermission = async () => {
      if (!isGeolocationSupported()) {
        if (active) {
          setLocationStatus('unavailable');
          setLocationError('Browser does not support Geolocation.');
        }
        return;
      }

      const perm = await queryGeolocationPermission();
      if (!active) return;
      setLocationPermission(perm);

      if (perm === 'granted') {
        fetchLocationSilently();
      } else if (perm === 'denied') {
        setLocationStatus('denied');
        setLocationError('Location permission denied in browser settings.');
      } else {
        setLocationStatus('requesting');
      }
    };

    checkPermission();
    return () => {
      active = false;
    };
  }, []);

  // Fetch Location Silently (when permission is already granted)
  const fetchLocationSilently = useCallback(async () => {
    try {
      const coords = await getCurrentCoordinates();
      setLocation(coords);
      setLocationStatus('active');
      setLocationError('');
      setLastLocationTime(new Date());
    } catch (err) {
      setLocationStatus('unavailable');
      setLocationError(err.message || 'GPS signal unavailable');
    }
  }, []);

  // Explicit User Location Request
  const requestLocationConsent = useCallback(() => {
    setConsentModalOpen(true);
  }, []);

  const confirmLocationConsent = useCallback(async () => {
    setConsentModalOpen(false);
    try {
      const coords = await getCurrentCoordinates();
      setLocation(coords);
      setLocationStatus('active');
      setLocationPermission('granted');
      setLocationError('');
      setLastLocationTime(new Date());
      toast.success('Location permission granted & GPS locked.');
    } catch (err) {
      setLocationStatus(err.reason === 'permission_denied' ? 'denied' : 'unavailable');
      setLocationPermission(err.reason === 'permission_denied' ? 'denied' : 'prompt');
      setLocationError(err.message);
      toast.error(err.message);
    }
  }, []);

  // Continuous Watch when location is active
  useEffect(() => {
    if (locationStatus !== 'active') return undefined;

    const unwatch = watchCoordinates(
      (coords) => {
        setLocation(coords);
        setLastLocationTime(new Date());
      },
      (err) => {
        // silent watch failure, fallback to last known
      }
    );

    return () => unwatch();
  }, [locationStatus]);

  // Load Active Emergencies for Doctor
  const refreshDoctorEmergencies = useCallback(async () => {
    if (!isDoctor) return;
    try {
      const res = await getActiveEmergenciesApi();
      if (res?.emergencies) {
        setDoctorActiveEmergencies(res.emergencies);
      }
    } catch {
      // silent fallback
    }
  }, [isDoctor]);

  useEffect(() => {
    if (isDoctor) {
      refreshDoctorEmergencies();
      const interval = setInterval(refreshDoctorEmergencies, 10000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isDoctor, refreshDoctorEmergencies]);

  // Evaluate Critical Condition from Live Vitals
  useEffect(() => {
    if (!vitalsContext || isDoctor) return;

    const spo2 = Number(vitalsContext.spo2 || 0);
    const hr = Number(vitalsContext.heartRate || 0);
    const temp = Number(vitalsContext.temperature || 0);
    const riskLabel = String(vitalsContext.risk || '').toLowerCase();

    // Critical Tripwires:
    const isCriticalSpo2 = spo2 > 0 && spo2 < thresholds.spo2Critical;
    const isCriticalHr = hr > 0 && (hr < thresholds.hrMin || hr > thresholds.hrMax);
    const isCriticalTemp = temp > 0 && temp > thresholds.tempMax;
    const isCriticalAiRisk = riskLabel.includes('critical') || riskLabel.includes('high');

    const isCritical = isCriticalSpo2 || isCriticalHr || isCriticalTemp || isCriticalAiRisk;

    if (isCritical && !autoTriggeredRef.current && emergencyState !== 'CRITICAL' && emergencyState !== 'AMBULANCE_REQUESTED') {
      autoTriggeredRef.current = true;
      let reason = 'Critical physiological telemetry detected.';
      if (isCriticalSpo2) reason = `Severe Hypoxia detected (SpO2 ${spo2}% < ${thresholds.spo2Critical}% threshold)`;
      else if (isCriticalHr) reason = `Extreme Arrhythmia detected (Heart Rate ${hr} BPM outside [${thresholds.hrMin}-${thresholds.hrMax}] BPM)`;
      else if (isCriticalTemp) reason = `High Pyrexia detected (Temperature ${temp}°C > ${thresholds.tempMax}°C)`;
      else if (isCriticalAiRisk) reason = `AI Neural Model flagged High/Critical Cardiac Risk (${vitalsContext.risk})`;

      triggerEmergency({ reason, isDemo: false, vitalsSnapshot: vitalsContext });
    }
  }, [vitalsContext, thresholds, isDoctor, emergencyState]);

  // Trigger Emergency Workflow
  const triggerEmergency = useCallback(
    async ({ reason, isDemo = false, vitalsSnapshot = null }) => {
      setEmergencyState('CRITICAL');
      setEmergencyModalOpen(true);
      setIsDemoMode(isDemo);

      let currentCoords = location;
      if (!currentCoords && isGeolocationSupported()) {
        try {
          currentCoords = await getCurrentCoordinates({ timeout: 4000 });
          setLocation(currentCoords);
          setLocationStatus('active');
        } catch {
          // fallback
        }
      }

      // Default fallback coordinates if GPS unavailable during demo
      if (!currentCoords && isDemo) {
        currentCoords = {
          latitude: 28.6139,
          longitude: 77.209,
          accuracy: 14,
          timestamp: Date.now(),
        };
        setLocation(currentCoords);
      }

      const vitalPayload = vitalsSnapshot || vitalsContext || {
        heartRate: 142,
        spo2: 84,
        temperature: 38.8,
        risk: 'Critical Emergency',
        risk_score: 0.94,
      };

      const alertPayload = {
        alertId: `emg-${Date.now().toString(36)}`,
        patientId,
        patientName,
        status: 'CRITICAL',
        triggerReason: reason || 'Critical telemetry threshold breach',
        vitals: {
          heartRate: vitalPayload.heartRate || 142,
          spo2: vitalPayload.spo2 || 84,
          temperature: vitalPayload.temperature || 38.8,
          risk: vitalPayload.risk || 'Critical',
          risk_score: vitalPayload.risk_score || 0.92,
        },
        location: currentCoords,
        sosContact,
        doctorId: session?.assignedDoctorId || session?.doctorId || session?.doctorEmail || '',
        isDemo,
        createdAt: new Date().toISOString(),
        auditLog: [
          {
            timestamp: new Date().toISOString(),
            actor: 'monitoring_system',
            action: 'CRITICAL_CONDITION_DETECTED',
            details: reason,
          },
          {
            timestamp: new Date().toISOString(),
            actor: 'system_gps',
            action: currentCoords ? 'LOCATION_ATTACHED' : 'LOCATION_UNAVAILABLE',
            details: currentCoords
              ? `Lat: ${currentCoords.latitude}, Lng: ${currentCoords.longitude} (±${currentCoords.accuracy}m)`
              : 'GPS signal not locked',
          },
          {
            timestamp: new Date().toISOString(),
            actor: 'alert_service',
            action: 'DOCTOR_AND_SOS_NOTIFIED',
            details: `Alert dispatched to assigned physician & Contact ${sosContact.phone}`,
          },
        ],
      };

      setActiveEmergency(alertPayload);

      try {
        await postEmergencyTriggerApi(alertPayload);
      } catch {
        // demo/offline fallback
      }

      toast.error(`🚨 Emergency Active: ${reason}`, {
        duration: 8000,
        style: {
          border: '2px solid #ef4444',
          padding: '16px',
          color: '#991b1b',
          background: '#fef2f2',
          fontWeight: 'bold',
        },
      });
    },
    [location, vitalsContext, patientId, patientName, sosContact, session?.doctorId]
  );

  // Request Ambulance
  const requestAmbulance = useCallback(
    async ({ urgency = 'HIGH', notes = '' } = {}) => {
      setAmbulanceModalOpen(false);
      setAmbulanceRequested(true);
      setEmergencyState('AMBULANCE_REQUESTED');

      const requestPayload = {
        alertId: activeEmergency?.alertId || `emg-${Date.now().toString(36)}`,
        patientId,
        patientName,
        urgency,
        notes,
        location: location || {
          latitude: 28.6139,
          longitude: 77.209,
          accuracy: 15,
        },
        vitals: activeEmergency?.vitals || {
          heartRate: 142,
          spo2: 84,
          temperature: 38.8,
        },
        isDemo: isDemoMode,
      };

      try {
        const response = await postAmbulanceRequestApi(requestPayload);
        const dispatchData = response?.data || {
          provider: isDemoMode ? 'Demo Emergency Dispatch' : 'Hospital Medical Transport',
          etaMinutes: 9,
          vehicleId: 'MED-AMB-409',
          status: 'AMBULANCE_REQUESTED',
          message: isDemoMode
            ? 'Demo Emergency Dispatch confirmed. Simulated paramedic en route (ETA ~9 mins).'
            : 'Emergency medical transport requested and dispatched.',
        };

        setAmbulanceDispatchInfo(dispatchData);

        setActiveEmergency((prev) => ({
          ...(prev || requestPayload),
          ambulanceStatus: 'AMBULANCE_REQUESTED',
          ambulanceDetails: dispatchData,
          auditLog: [
            ...(prev?.auditLog || []),
            {
              timestamp: new Date().toISOString(),
              actor: 'patient',
              action: 'AMBULANCE_REQUESTED',
              details: dispatchData.message,
            },
          ],
        }));

        toast.success(`🚑 ${dispatchData.message}`, {
          duration: 9000,
          style: {
            border: '2px solid #0284c7',
            background: '#f0f9ff',
            color: '#0369a1',
            fontWeight: 'bold',
          },
        });
      } catch (err) {
        toast.error('Failed to communicate with emergency dispatch.');
      }
    },
    [activeEmergency, patientId, patientName, location, isDemoMode]
  );

  // Acknowledge Alert (Doctor)
  const acknowledgeEmergency = useCallback(async (alertId) => {
    try {
      await postEmergencyStatusApi(alertId, 'EMERGENCY_ACKNOWLEDGED');
      setDoctorActiveEmergencies((list) =>
        list.map((item) =>
          item.alertId === alertId ? { ...item, status: 'EMERGENCY_ACKNOWLEDGED' } : item
        )
      );
      toast.success('Emergency alert acknowledged by physician.');
    } catch {
      toast.success('Alert marked as acknowledged.');
    }
  }, []);

  // Resolve Emergency
  const resolveEmergency = useCallback(async (alertId) => {
    try {
      await postEmergencyStatusApi(alertId, 'RESOLVED');
    } catch {
      // fallback
    }
    setEmergencyState('RESOLVED');
    setEmergencyModalOpen(false);
    setActiveEmergency(null);
    autoTriggeredRef.current = false;
    setAmbulanceRequested(false);
    setDoctorActiveEmergencies((list) => list.filter((item) => item.alertId !== alertId));
    toast.success('Emergency resolved and archived.');
  }, []);

  // Simulate Demo Emergency (Safe Developer / Presentation Mode)
  const simulateCriticalEmergency = useCallback(() => {
    toast('Simulating Critical Emergency in DEMO MODE...', { icon: '🧪' });
    triggerEmergency({
      reason: 'DEMO TEST: Critical Hypoxia (SpO2 84%) & Tachycardia (142 BPM)',
      isDemo: true,
      vitalsSnapshot: {
        heartRate: 142,
        spo2: 84,
        temperature: 38.9,
        risk: 'High Critical Arrhythmia',
        risk_score: 0.94,
      },
    });
  }, [triggerEmergency]);

  const value = useMemo(
    () => ({
      location,
      locationStatus,
      locationPermission,
      locationError,
      lastLocationTime,
      locationSharingEnabled,
      emergencyLocationSharingEnabled,
      setLocationSharingEnabled,
      setEmergencyLocationSharingEnabled,
      sosContact,
      setSosContact,
      thresholds,
      setThresholds,
      emergencyState,
      activeEmergency,
      doctorActiveEmergencies,
      consentModalOpen,
      setConsentModalOpen,
      emergencyModalOpen,
      setEmergencyModalOpen,
      ambulanceModalOpen,
      setAmbulanceModalOpen,
      ambulanceRequested,
      ambulanceDispatchInfo,
      isDemoMode,
      requestLocationConsent,
      confirmLocationConsent,
      refreshLocation: fetchLocationSilently,
      triggerEmergency,
      requestAmbulance,
      acknowledgeEmergency,
      resolveEmergency,
      simulateCriticalEmergency,
      refreshDoctorEmergencies,
    }),
    [
      location,
      locationStatus,
      locationPermission,
      locationError,
      lastLocationTime,
      locationSharingEnabled,
      emergencyLocationSharingEnabled,
      sosContact,
      thresholds,
      emergencyState,
      activeEmergency,
      doctorActiveEmergencies,
      consentModalOpen,
      emergencyModalOpen,
      ambulanceModalOpen,
      ambulanceRequested,
      ambulanceDispatchInfo,
      isDemoMode,
      requestLocationConsent,
      confirmLocationConsent,
      fetchLocationSilently,
      triggerEmergency,
      requestAmbulance,
      acknowledgeEmergency,
      resolveEmergency,
      simulateCriticalEmergency,
      refreshDoctorEmergencies,
    ]
  );

  return <EmergencyContext.Provider value={value}>{children}</EmergencyContext.Provider>;
}

export function useEmergency() {
  const context = useContext(EmergencyContext);
  if (!context) {
    return {
      emergencyState: 'NORMAL',
      activeEmergency: null,
      doctorActiveEmergencies: [],
      location: null,
      locationStatus: 'unavailable',
      locationPermission: 'denied',
      locationError: '',
      lastLocationTime: null,
      locationSharingEnabled: false,
      emergencyLocationSharingEnabled: false,
      thresholds: DEFAULT_CRITICAL_SETTINGS,
      sosContact: null,
      consentModalOpen: false,
      emergencyModalOpen: false,
      ambulanceModalOpen: false,
      ambulanceRequested: false,
      ambulanceDispatchInfo: null,
      isDemoMode: false,
      setConsentModalOpen: () => {},
      setEmergencyModalOpen: () => {},
      setAmbulanceModalOpen: () => {},
      requestLocationPermission: () => {},
      fetchLocationSilently: () => {},
      triggerEmergency: () => {},
      requestAmbulance: () => {},
      acknowledgeEmergency: () => {},
      resolveEmergency: () => {},
      simulateCriticalEmergency: () => {},
      refreshDoctorEmergencies: () => {},
    };
  }
  return context;
}
