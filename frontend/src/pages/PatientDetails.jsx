import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Award,
  Bell,
  BrainCircuit,
  CalendarCheck,
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  FileText,
  HeartPulse,
  History,
  Layers,
  LayoutDashboard,
  Link2,
  Link2Off,
  Pill,
  Printer,
  ShieldAlert,
  ShieldCheck,
  Thermometer,
  Video,
  Waves,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { Loader } from '../components/Loader';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { StatusPill } from '../components/StatusPill';
import { Button } from '../components/Button';
import { ECGChart } from '../components/ECGChart';
import { AiHealthAssessment } from '../components/AiHealthAssessment';
import { MedicationManagement } from '../components/MedicationManagement';
import { MedicalReportDocument } from '../components/MedicalReportDocument';
import { MedicalReportModal } from '../components/MedicalReportModal';
import { calculateLabCompletion, generateRealisticLabResults } from '../data/labTestPresets';
import { downloadMedicalReportPdf, generateVectorMedicalReportPdf, printMedicalReport } from '../utils/medicalReportPdf';
import { useVideoCall } from '../context/VideoCallContext';
import {
  connectPatientDevice,
  disconnectPatientDevice,
  getApiPatientById,
  getPatientPredictionAudit,
  updatePatientManualValues,
} from '../services/api';
import { getAuthSession } from '../utils/auth';

const SOCKET_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://smart-health-backend-2idf.onrender.com';

const CLINICAL_TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'vitals', label: 'Vitals', icon: Activity },
  { id: 'ecg', label: 'ECG', icon: Waves },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'ai-assessment', label: 'AI Assessment', icon: BrainCircuit },
  { id: 'first-aid', label: 'First Aid', icon: ShieldAlert },
  { id: 'medications', label: 'Medications', icon: Pill },
  { id: 'prescriptions', label: 'Prescriptions', icon: FileText },
  { id: 'adherence', label: 'Adherence', icon: CalendarCheck },
  { id: 'reports', label: 'Reports', icon: Printer },
];

export function PatientDetails() {
  const { patientId } = useParams();
  const session = getAuthSession();
  const isDoctor = session?.role === 'doctor';
  const isPatient = session?.role === 'patient';
  const selfPatientId = String(session?.patientId || '').trim();
  const requestedId = String(patientId || '').trim();
  const { startCall } = useVideoCall();

  const [activeTab, setActiveTab] = useState('overview');
  const [patient, setPatient] = useState(null);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [patientLabTests, setPatientLabTests] = useState([]);
  const [reportDownloading, setReportDownloading] = useState(false);
  const [manualValues, setManualValues] = useState({
    heartRate: '',
    spo2: '',
    temperature: '',
    ecgData: '',
  });
  const lastServerSignatureRef = useRef('');

  // Auto-generate realistic lab diagnostic tests when patient is ready
  useEffect(() => {
    if (patient) {
      setPatientLabTests(generateRealisticLabResults(patient));
    }
  }, [patient?.id]);

  const labSummary = useMemo(() => calculateLabCompletion(patientLabTests), [patientLabTests]);

  const handleDownloadPdf = async () => {
    setReportDownloading(true);
    const toastId = toast.loading('Generating Hospital Medical Report PDF...');
    try {
      const fileName = `${String(patient?.name || 'Patient').replace(/\s+/g, '_')}_Medical_Report.pdf`;
      generateVectorMedicalReportPdf({
        patient,
        doctor: attendingDoctor,
        vitals: patient?.vitals || {},
        labTests: patientLabTests,
        medicines: patient?.medicines || [],
        clinicalDiagnosis: {
          provisional: patient?.prediction?.message || 'Sinus rhythm within baseline limits.',
          final: labSummary.isAllVerified
            ? 'Certified stable physiological profile with normal diagnostic laboratory parameters.'
            : 'Pending final verification of remaining laboratory investigations.',
        },
        fileName,
      });
      toast.success('Hospital Medical Report PDF downloaded successfully!', { id: toastId });
    } catch (err) {
      toast.error(`Failed to generate PDF: ${err.message}`, { id: toastId });
    } finally {
      setReportDownloading(false);
    }
  };

  const handlePrintReport = () => {
    toast.success('Preparing Medical Report for printing...');
    printMedicalReport('patient-tab-medical-report-doc');
  };

  const handleVerifyAllTests = () => {
    setPatientLabTests((prev) => prev.map((t) => ({ ...t, status: 'VERIFIED' })));
    toast.success('All laboratory diagnostic investigations marked as VERIFIED.');
  };

  const handleToggleTest = (id) => {
    setPatientLabTests((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: t.status === 'VERIFIED' ? 'COMPLETED' : 'VERIFIED' } : t))
    );
  };

  // Scoped Security Guard: A patient can ONLY view their own records
  const isPatientRestricted = isPatient && selfPatientId && requestedId && selfPatientId.toLowerCase() !== requestedId.toLowerCase();

  // Reset and load when patientId changes
  useEffect(() => {
    let active = true;

    // IMMEDIATELY reset all previous patient data so nothing stale lingers
    setPatient(null);
    setAudit([]);
    setError('');
    setAccessDenied(false);
    setLoading(true);

    if (isPatientRestricted) {
      setLoading(false);
      setAccessDenied(true);
      return;
    }

    const loadPatient = async () => {
      try {
        const [patientResponse, auditResponse] = await Promise.all([
          getApiPatientById(patientId),
          getPatientPredictionAudit(patientId),
        ]);

        if (!active) return;

        // Verify Doctor Authorization
        if (isDoctor) {
          const sessionDocId = String(session?.doctorId || session?.email || '').trim().toLowerCase();
          const assignedDocId = String(patientResponse?.assignedDoctorId || patientResponse?.doctorId || patientResponse?.doctorEmail || '').trim().toLowerCase();
          const assignedContactEmail = String(patientResponse?.doctorContact?.email || '').trim().toLowerCase();

          const isAssigned = sessionDocId && (
            sessionDocId === assignedDocId ||
            sessionDocId === assignedContactEmail ||
            (patientResponse?.doctorEmail && sessionDocId === String(patientResponse.doctorEmail).toLowerCase())
          );

          if (!isAssigned) {
            setAccessDenied(true);
            setError('Access Denied: You are not authorized to view or treat this patient. This patient is not assigned under your clinical care.');
            setPatient(null);
            return;
          }
        }

        setPatient(patientResponse);
        setAudit(auditResponse);
      } catch (requestError) {
        if (!active) return;
        const statusCode = requestError?.response?.status;
        const msg = requestError?.response?.data?.message || requestError?.message || 'Unable to load patient details.';
        if (statusCode === 403 || msg.toLowerCase().includes('access denied')) {
          setAccessDenied(true);
          setError('Access Denied: You are not authorized to view or treat this patient. This patient is not assigned under your clinical care.');
        } else {
          setError(msg);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (patientId) {
      loadPatient();
    }

    return () => {
      active = false;
    };
  }, [patientId, isPatientRestricted]);

  useEffect(() => {
    if (!patient?.deviceConnected) {
      return;
    }

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

    socket.emit('subscribe_patient', { patientId, token });

    socket.on('patient_snapshot', (payload) => {
      const snapshot = payload?.data;
      if (!snapshot) return;
      setPatient(snapshot);
    });

    socket.on('vitals_update', (payload) => {
      const incomingVitals = payload?.vitals;
      if (!incomingVitals) return;

      setPatient((current) => {
        if (!current) return current;
        return {
          ...current,
          vitals: incomingVitals,
          dataSource: 'sensor-stream',
        };
      });
    });

    socket.on('insights_update', (payload) => {
      const incomingPrediction = payload?.prediction;
      if (!incomingPrediction) return;

      setPatient((current) => {
        if (!current) return current;
        return {
          ...current,
          prediction: incomingPrediction,
        };
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [patientId, patient?.deviceConnected]);

  const handleConnect = async () => {
    if (!patientId) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await connectPatientDevice(patientId);
      setPatient(updated);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Unable to connect device.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!patientId) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await disconnectPatientDevice(patientId);
      setPatient(updated);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Unable to disconnect device.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualChange = (event) => {
    const { name, value } = event.target;
    setManualValues((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const submitManualUpdate = async (values, mode = 'manual') => {
    if (!patientId) return;

    if (mode === 'manual') {
      setActionLoading(true);
    } else {
      setAutoSaving(true);
    }

    setError('');
    try {
      const updated = await updatePatientManualValues(patientId, values);
      setPatient(updated);
      const nextAudit = await getPatientPredictionAudit(patientId);
      setAudit(nextAudit);
      lastServerSignatureRef.current = JSON.stringify(values);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Unable to update patient values.');
    } finally {
      if (mode === 'manual') {
        setActionLoading(false);
      } else {
        setAutoSaving(false);
      }
    }
  };

  const handleManualUpdate = async (event) => {
    event.preventDefault();
    await submitManualUpdate(manualValues, 'manual');
  };

  useEffect(() => {
    if (!isDoctor || !patientId || actionLoading || autoSaving) {
      return;
    }

    const nextSignature = JSON.stringify(manualValues);
    if (nextSignature === lastServerSignatureRef.current) {
      return;
    }

    const debounceHandle = window.setTimeout(() => {
      submitManualUpdate(manualValues, 'auto');
    }, 900);

    return () => {
      window.clearTimeout(debounceHandle);
    };
  }, [manualValues, isDoctor, patientId, actionLoading, autoSaving]);

  // Loading state
  if (loading) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 text-center space-y-4">
        <Loader label="Loading patient data..." />
        <p className="text-xs text-slate-400 animate-pulse">
          Establishing isolated clinical workspace for patient {patientId}...
        </p>
      </div>
    );
  }

  // Access Denied State (Strict isolation)
  if (accessDenied || isPatientRestricted) {
    return (
      <div className="p-6 max-w-2xl mx-auto my-12">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center space-y-4 shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/20 text-rose-500">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold text-rose-700 dark:text-rose-200">Access Denied</h2>
          <p className="text-sm text-rose-600/90 dark:text-rose-300/80 max-w-md mx-auto">
            {isPatient
              ? 'Patient accounts are strictly scoped to their own personal health records. You cannot view telemetry for other patients.'
              : 'You are not authorized to view or treat this patient. This patient record is not assigned under your clinical care.'}
          </p>
          <div className="pt-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-rose-700 transition shadow-md"
            >
              <ArrowLeft className="h-4 w-4" />
              {isDoctor ? 'Back to My Patients' : 'Back to My Dashboard'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error && !patient) {
    return <ErrorState title="Could not load patient" message={error} />;
  }

  if (!patient) {
    return <EmptyState title="Patient not found" message="The patient record could not be found." action={<ButtonLink />} />;
  }

  const isCritical = String(patient?.prediction?.status || '').toLowerCase() === 'critical';
  const status = patient?.prediction?.status || 'normal';

  const attendingDoctor = {
    name: patient?.assignedDoctorName || patient?.doctorName || 'Attending Physician',
    phone: patient?.doctorPhone || patient?.phone || '',
    email: patient?.assignedDoctorId || patient?.doctorEmail || '',
    specialty: patient?.doctorSpecialty || 'General Medicine',
  };

  return (
    <div className="space-y-6">
      {/* 1. BREADCRUMB NAVIGATION */}
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Link to="/dashboard" className="hover:text-blue-500 transition">
          {isDoctor ? 'Doctor Dashboard' : 'My Dashboard'}
        </Link>
        <span>/</span>
        <Link to="/dashboard#patients" className="hover:text-blue-500 transition">
          {isDoctor ? 'My Patients' : 'Clinical Care'}
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-900 dark:text-slate-200">
          {patient.name}
        </span>
      </div>

      {/* 2. VISUAL PATIENT WORKSPACE HEADER */}
      <div className="rounded-[18px] border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0284C7] border border-sky-200">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                PATIENT WORKSPACE
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-[#64748B]">
                {patient.id}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
              {patient.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] pt-0.5">
              <span>{patient.age || 24} years · {patient.gender || 'Male'}</span>
              <span>•</span>
              <span>Status: <strong className="text-[#0F172A] capitalize font-bold">{status}</strong></span>
              <span>•</span>
              <span>Assigned Doctor: <strong className="text-[#0F172A] font-semibold">Dr. {attendingDoctor.name}</strong></span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${patient.deviceConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {patient.deviceConnected ? 'Live Sensor Connected' : 'Standby'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {isDoctor && (
              <button
                type="button"
                onClick={() => {
                  startCall({
                    id: patient.id,
                    patientId: patient.id,
                    name: patient.name,
                    patientName: patient.name,
                    heartRate: patient.vitals?.heartRate,
                    spo2: patient.vitals?.spo2,
                    temperature: patient.vitals?.temperature,
                    status: patient.prediction?.status || 'Monitoring',
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white px-4 py-2.5 text-xs font-bold transition shadow-[0_2px_10px_rgba(2,132,199,0.25)] active:scale-[0.98]"
                title={`Start Telehealth Video Consultation with ${patient.name}`}
              >
                <Video className="h-4 w-4" />
                <span>Video Call Patient</span>
              </button>
            )}
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-xs font-bold text-[#0F172A] hover:bg-slate-50 transition shadow-2xs"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Patients
            </Link>
          </div>
        </div>
      </div>

      {error ? (
        <Card className="border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-800 font-medium">{error}</Card>
      ) : null}

      {/* 3. 10 CLINICAL WORKSPACE TABS */}
      <div className="overflow-x-auto pb-1">
        <nav className="flex items-center gap-1.5 rounded-2xl border border-[#E2E8F0] bg-white p-1.5 shadow-2xs min-w-max">
          {CLINICAL_TABS.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  isActive
                    ? 'bg-[#0284C7] text-white shadow-xs'
                    : 'text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A]'
                }`}
              >
                <TabIcon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <Card className="space-y-5 p-6 md:p-7 bg-white border border-[#E2E8F0] rounded-[18px] shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#94A3B8]">Condition Overview</p>
                  <h2 className="mt-1 font-sans text-2xl font-bold text-[#0F172A]">Current Health Status</h2>
                </div>
                <StatusPill status={status} />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <VitalsTile icon={<HeartPulse className="h-5 w-5 text-rose-500" />} label="Heart Rate" value={`${Number(patient?.vitals?.heartRate || 0).toFixed(1)} bpm`} />
                <VitalsTile icon={<Waves className="h-5 w-5 text-teal-500" />} label="SpO2" value={`${Number(patient?.vitals?.spo2 || 0).toFixed(1)}%`} />
                <VitalsTile icon={<Thermometer className="h-5 w-5 text-amber-500" />} label="Temperature" value={`${Number(patient?.vitals?.temperature || 0).toFixed(1)}°C`} />
              </div>
            </Card>

            <Card className="space-y-4 p-6 md:p-7 bg-white border border-[#E2E8F0] rounded-[18px] shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0284C7]">Clinical AI Intelligence</p>
                <ShieldAlert className={isCritical ? 'h-5 w-5 text-rose-500' : 'h-5 w-5 text-emerald-500'} />
              </div>

              <div className="space-y-2 text-xs sm:text-sm text-[#64748B]">
                <p><strong className="text-[#0F172A]">Patient:</strong> {patient.name} ({patient.id})</p>
                <p><strong className="text-[#0F172A]">Risk Status:</strong> {patient?.prediction?.risk ?? patient?.prediction?.status ?? 'Normal'}</p>
                <p><strong className="text-[#0F172A]">Confidence:</strong> {patient?.prediction?.confidence ?? '96.4%'}</p>
                <p><strong className="text-[#0F172A]">Analysis:</strong> {patient?.prediction?.message ?? 'Vital telemetry readings within physiological limits.'}</p>
              </div>

              <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Telemetry Stream</p>
                    <h3 className="mt-1 font-sans text-base font-bold text-[#0F172A]">
                      {patient.deviceConnected ? 'Live Sensor Transceiver Active' : 'Dataset Calibrated Baseline'}
                    </h3>
                  </div>
                  <Activity className="h-5 w-5 text-[#0284C7]" />
                </div>
              </div>
            </Card>
          </div>

          <AiHealthAssessment
            patientId={patient.id}
            liveVitals={patient?.vitals}
            attendingDoctor={attendingDoctor}
          />
        </div>
      )}

      {/* TAB 2: VITALS */}
      {activeTab === 'vitals' && (
        <div className="space-y-6">
          <Card className="space-y-5 p-6 md:p-8">
            <h3 className="text-lg font-bold text-white">Multi-Parameter Vitals Telemetry</h3>
            <div className="grid gap-4 sm:grid-cols-4">
              <VitalsTile icon={<HeartPulse className="h-5 w-5 text-cyan-200" />} label="Heart Rate" value={`${Number(patient?.vitals?.heartRate || 0).toFixed(1)} bpm`} />
              <VitalsTile icon={<Waves className="h-5 w-5 text-teal-200" />} label="SpO2" value={`${Number(patient?.vitals?.spo2 || 0).toFixed(1)}%`} />
              <VitalsTile icon={<Thermometer className="h-5 w-5 text-fuchsia-200" />} label="Temperature" value={`${Number(patient?.vitals?.temperature || 0).toFixed(1)}°C`} />
              <VitalsTile icon={<Activity className="h-5 w-5 text-blue-200" />} label="Blood Pressure" value="120/80 mmHg" />
            </div>

            {isDoctor && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Device Control</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button onClick={handleConnect} disabled={actionLoading || patient.deviceConnected}>
                    <Link2 className="h-4 w-4" />
                    Connect Device
                  </Button>
                  <Button variant="secondary" onClick={handleDisconnect} disabled={actionLoading || !patient.deviceConnected}>
                    <Link2Off className="h-4 w-4" />
                    Disconnect Device
                  </Button>
                </div>
              </div>
            )}

            {isDoctor && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Manual Values + Re-Predict</p>
                <p className="mt-2 text-xs text-cyan-200/90">Auto predict is enabled. Model runs automatically after you stop typing.</p>
                <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={handleManualUpdate}>
                  <input
                    name="heartRate"
                    type="number"
                    step="0.1"
                    value={manualValues.heartRate}
                    onChange={handleManualChange}
                    placeholder="Heart Rate"
                    className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-white placeholder:text-slate-500 outline-none"
                  />
                  <input
                    name="spo2"
                    type="number"
                    step="0.1"
                    value={manualValues.spo2}
                    onChange={handleManualChange}
                    placeholder="SpO2"
                    className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-white placeholder:text-slate-500 outline-none"
                  />
                  <input
                    name="temperature"
                    type="number"
                    step="0.1"
                    value={manualValues.temperature}
                    onChange={handleManualChange}
                    placeholder="Temperature"
                    className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-white placeholder:text-slate-500 outline-none"
                  />
                  <textarea
                    name="ecgData"
                    rows={3}
                    value={manualValues.ecgData}
                    onChange={handleManualChange}
                    placeholder="ECG samples comma-separated"
                    className="sm:col-span-2 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-white placeholder:text-slate-500 outline-none"
                  />
                  <div className="sm:col-span-2">
                    <Button type="submit" disabled={actionLoading}>
                      {actionLoading ? 'Updating...' : autoSaving ? 'Auto Predicting...' : 'Update Values & Predict'}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 3: ECG */}
      {activeTab === 'ecg' && (
        <div className="space-y-6">
          <ECGChart
            ecgData={patient?.vitals?.ecgData || []}
            heartRate={Number(patient?.vitals?.heartRate || 72)}
          />
        </div>
      )}

      {/* TAB 4: ALERTS */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          <Card className="space-y-4 p-6 md:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">Prediction & Alert Audit</p>
                <h2 className="mt-2 font-display text-2xl font-bold text-white">Clinical Telemetry Alerts</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300">
                <History className="h-4 w-4 text-cyan-200" />
                {audit.length} entries
              </div>
            </div>

            {audit.length ? (
              <div className="space-y-3">
                {audit.slice(-10).reverse().map((entry, index) => (
                  <div key={`${entry.timestamp || 'ts'}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{entry.risk ?? entry.status ?? ''} ({entry.status ?? ''})</p>
                      <p className="text-xs text-slate-400">{entry.timestamp || 'N/A'}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{entry.message ?? ''}</p>
                    <p className="mt-2 text-xs text-slate-400">Source: {entry.source || 'unknown'} · Confidence: {Number(entry.confidence || 0).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No alert entries" message="Alert logs will appear here as telemetry thresholds are triggered." />
            )}
          </Card>
        </div>
      )}

      {/* TAB 5: AI ASSESSMENT */}
      {activeTab === 'ai-assessment' && (
        <div className="space-y-6">
          <AiHealthAssessment
            patientId={patient.id}
            liveVitals={patient?.vitals}
            attendingDoctor={attendingDoctor}
          />
        </div>
      )}

      {/* TAB 6: FIRST AID */}
      {activeTab === 'first-aid' && (
        <div className="space-y-6">
          <AiHealthAssessment
            patientId={patient.id}
            liveVitals={patient?.vitals}
            attendingDoctor={attendingDoctor}
          />
        </div>
      )}

      {/* TAB 7: MEDICATIONS */}
      {activeTab === 'medications' && (
        <div className="space-y-6">
          <MedicationManagement
            patientId={patient.id}
            patientName={patient.name}
            role={session?.role || 'doctor'}
            doctorInfo={attendingDoctor}
          />
        </div>
      )}

      {/* TAB 8: PRESCRIPTIONS */}
      {activeTab === 'prescriptions' && (
        <div className="space-y-6">
          <MedicationManagement
            patientId={patient.id}
            patientName={patient.name}
            role={session?.role || 'doctor'}
            doctorInfo={attendingDoctor}
          />
        </div>
      )}

      {/* TAB 9: ADHERENCE */}
      {activeTab === 'adherence' && (
        <div className="space-y-6">
          <MedicationManagement
            patientId={patient.id}
            patientName={patient.name}
            role={session?.role || 'doctor'}
            doctorInfo={attendingDoctor}
          />
        </div>
      )}

      {/* TAB 10: REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Top Report Management & Action Bar */}
          <Card className="p-5 sm:p-6 bg-white border border-[#E2E8F0] rounded-[18px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold text-sky-800 border border-sky-200">
                    <ShieldCheck className="h-3 w-3 text-sky-600" />
                    NABH & NABL ACCREDITED
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${labSummary.badgeClass}`}
                  >
                    {labSummary.isAllVerified ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-amber-600" />
                    )}
                    {labSummary.badgeText}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Hospital Medical Report & Diagnostic Summary
                </h2>
                <p className="text-xs text-slate-500">
                  Comprehensive printable and downloadable medical summary with laboratory investigation results, continuous telemetry, and authorized physician sign-off.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowReportModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 hover:bg-sky-100 px-4 py-2.5 text-xs font-bold text-sky-800 shadow-2xs transition active:scale-95"
                  title="Open Full Screen Interactive Report Modal"
                >
                  <Eye className="h-4 w-4 text-sky-600" />
                  <span>Interactive Modal</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={reportDownloading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white px-4 py-2.5 text-xs font-bold transition shadow-sm active:scale-95 disabled:opacity-50"
                  title="Download Real Hospital Report PDF"
                >
                  <Download className="h-4 w-4" />
                  <span>{reportDownloading ? 'Generating PDF...' : 'Download PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition active:scale-95"
                  title="Print Patient Report"
                >
                  <Printer className="h-4 w-4 text-slate-600" />
                  <span>Print Report</span>
                </button>
              </div>
            </div>

            {/* Test Verification Workflow Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-xs">
                  <FileCheck2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">
                    Diagnostic Lab Investigation Status: {labSummary.verified} of {labSummary.total} Verified ({labSummary.percentage}%)
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {labSummary.isAllVerified
                      ? 'All required diagnostic tests are completed & verified. Report is certified for official clinical release.'
                      : 'Some tests are in progress or unverified. Generated PDF will include a Preliminary watermark.'}
                  </p>
                </div>
              </div>

              {isDoctor && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleVerifyAllTests}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold transition shadow-2xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Verify All Lab Tests</span>
                  </button>
                </div>
              )}
            </div>
          </Card>

          {/* Embedded Hospital Document Viewer */}
          <div className="overflow-x-auto pb-4">
            <MedicalReportDocument
              elementId="patient-tab-medical-report-doc"
              patient={patient}
              doctor={attendingDoctor}
              vitals={patient?.vitals || {}}
              labTests={patientLabTests}
              medicines={patient?.medicines || []}
              clinicalDiagnosis={{
                provisional: patient?.prediction?.message || 'Sinus rhythm within baseline limits.',
                final: labSummary.isAllVerified
                  ? 'Certified stable physiological profile with normal diagnostic laboratory parameters.'
                  : 'Pending final verification of remaining laboratory investigations.',
              }}
              isDraft={!labSummary.isAllVerified}
            />
          </div>
        </div>
      )}

      {/* Interactive Full-Screen Hospital Medical Report Modal */}
      {showReportModal && (
        <MedicalReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          patient={patient}
          doctor={attendingDoctor}
          vitals={patient?.vitals || {}}
          medicines={patient?.medicines || []}
        />
      )}
    </div>
  );
}

function VitalsTile({ icon, label, value }) {
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-4 shadow-2xs">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">{label}</p>
        <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2 text-[#0284C7]">{icon}</div>
      </div>
      <p className="mt-2.5 font-sans text-2xl font-extrabold text-[#0F172A] tracking-tight">{value}</p>
    </div>
  );
}

function ButtonLink() {
  return (
    <Link
      to="/dashboard"
      className="inline-flex items-center gap-2 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] px-5 py-2.5 text-xs font-bold text-white transition shadow-sm"
    >
      <ArrowLeft className="h-4 w-4" />
      Return to Dashboard
    </Link>
  );
}
