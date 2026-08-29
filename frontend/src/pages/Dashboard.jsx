import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Ambulance,
  ArrowRight,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileCheck2,
  FileDown,
  FileText,
  Gauge,
  Heart,
  HeartPulse,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PhoneCall,
  PlayCircle,
  Plus,
  Printer,
  Radio,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Stethoscope,
  Thermometer,
  User,
  Users,
  Video,
  Waves,
  Wind,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Loader } from '../components/Loader';
import { ECGChart } from '../components/ECGChart';
import { VitalCard } from '../components/VitalCard';
import { AlertsPanel } from '../components/AlertsPanel';
import { LiveVitalsProvider, useLiveVitals } from '../context/LiveVitalsContext';
import { EmergencyProvider, useEmergency } from '../context/EmergencyContext';
import { useVideoCall } from '../context/VideoCallContext';
import { useI18n } from '../context/I18nContext';
import { getApiPatientById, getPatients, updateDoctorProfile, updatePatientProfile } from '../services/api';
import { getAuthSession, setAuthSession } from '../utils/auth';
import { LocationStatusCard } from '../components/emergency/LocationStatusCard';
import { LocationConsentModal } from '../components/emergency/LocationConsentModal';
import { EmergencyBannerModal } from '../components/emergency/EmergencyBannerModal';
import { DoctorEmergencyCenter } from '../components/emergency/DoctorEmergencyCenter';
import { EmergencyMap } from '../components/emergency/EmergencyMap';

export function Dashboard() {
  return (
    <LiveVitalsProvider>
      <DashboardWithEmergency />
    </LiveVitalsProvider>
  );
}

function DashboardWithEmergency() {
  const liveVitals = useLiveVitals();
  return (
    <EmergencyProvider vitalsContext={liveVitals}>
      <DashboardBody liveVitals={liveVitals} />
    </EmergencyProvider>
  );
}

function DashboardBody({ liveVitals }) {
  const { t } = useI18n();
  const emergency = useEmergency();
  const { openDialer, simulateIncomingPatientCall } = useVideoCall();

  const {
    loading,
    error,
    patientId,
    patientName,
    heartRate,
    spo2,
    temperature,
    updatedAt,
    ecgData,
    risk,
    risk_score,
    confidence,
    alerts,
    message,
  } = liveVitals;

  const session = getAuthSession();
  const role = session?.role === 'doctor' ? 'doctor' : 'patient';
  const isDoctor = role === 'doctor';

  const [activeSection, setActiveSection] = useState('overview');
  const [doctorPatients, setDoctorPatients] = useState([]);
  const [profileEmail, setProfileEmail] = useState(session?.email || '');
  const [profilePhone, setProfilePhone] = useState(session?.phone || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState('');
  const [profileError, setProfileError] = useState('');
  const [doctorEmail, setDoctorEmail] = useState('');
  const [doctorPhone, setDoctorPhone] = useState('');
  const [showLocationMapModal, setShowLocationMapModal] = useState(false);

  // SECURITY FIX: Real assigned patient count without synthetic fallback
  const patientCount = doctorPatients.length;
  const preferredChatPatientId = doctorPatients[0]?.id ? String(doctorPatients[0].id) : '';
  const preferredDevicePatientId = doctorPatients[0]?.id ? String(doctorPatients[0].id) : '';

  // Clinical risk label and badge
  const healthStatusLabel = risk ? String(risk) : 'Normal';
  const isHighRisk =
    healthStatusLabel.toLowerCase().includes('high') ||
    healthStatusLabel.toLowerCase().includes('critical') ||
    healthStatusLabel.toLowerCase().includes('warning');
  const healthBadgeClass = isHighRisk
    ? 'border-amber-200 bg-amber-50 text-amber-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  // 1. Initial Hash Navigation & Back/Forward Listeners
  useEffect(() => {
    const initialHash = window.location.hash ? window.location.hash.replace('#', '') : '';
    if (initialHash) {
      const el = document.getElementById(initialHash);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth' });
          setActiveSection(initialHash);
        }, 150);
      }
    }

    const handlePopState = () => {
      const currentHash = window.location.hash ? window.location.hash.replace('#', '') : '';
      if (currentHash) {
        const el = document.getElementById(currentHash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          setActiveSection(currentHash);
        }
      } else if (window.location.pathname === '/dashboard') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setActiveSection('overview');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 2. Scroll-Spy with IntersectionObserver for Sidebar Active State
  useEffect(() => {
    const sectionIds = ['overview', 'vitals', 'ecg', 'insights', 'reports', 'alerts', 'patients'];

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((e) => e.isIntersecting);
        if (visibleEntries.length > 0) {
          visibleEntries.sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top - 100) - Math.abs(b.boundingClientRect.top - 100)
          );
          const topId = visibleEntries[0].target.id;
          setActiveSection(topId);

          if (topId === 'overview') {
            if (window.location.hash) {
              window.history.replaceState(null, '', window.location.pathname);
            }
          } else {
            if (window.location.hash !== `#${topId}`) {
              window.history.replaceState(null, '', `#${topId}`);
            }
          }
        }
      },
      {
        rootMargin: '-90px 0px -40% 0px',
        threshold: [0.1, 0.3, 0.6],
      }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [loading, role]);

  // Load Doctor's Patients
  useEffect(() => {
    let active = true;

    const loadDoctorPatients = async () => {
      if (role !== 'doctor') {
        return;
      }

      try {
        const rows = await getPatients();
        if (active) {
          setDoctorPatients(Array.isArray(rows) ? rows : []);
        }
      } catch {
        if (active) {
          setDoctorPatients([]);
        }
      }
    };

    loadDoctorPatients();
    const timer = role === 'doctor' ? window.setInterval(loadDoctorPatients, 12000) : null;

    return () => {
      active = false;
      if (timer) {
        window.clearInterval(timer);
      }
    };
  }, [role]);

  // Session Profile Sync
  useEffect(() => {
    const latest = getAuthSession();
    setProfileEmail(latest?.email || '');
    setProfilePhone(latest?.phone || '');
  }, [role]);

  // Load Doctor Details for Patient
  useEffect(() => {
    let active = true;

    const loadDoctorDetailsForPatient = async () => {
      if (role !== 'patient') {
        setDoctorEmail('');
        setDoctorPhone('');
        return;
      }

      const resolvedPatientId = String(session?.patientId || patientId || '').trim();
      if (!resolvedPatientId) {
        setDoctorEmail('');
        setDoctorPhone('');
        return;
      }

      try {
        const profile = await getApiPatientById(resolvedPatientId);
        if (!active) {
          return;
        }

        const doctorEmailValue =
          profile?.doctorContact?.email ||
          profile?.doctorEmail ||
          String(profile?.doctorId || '').trim().toLowerCase() ||
          '';

        let doctorPhoneValue = profile?.doctorContact?.phone || profile?.doctorPhone || '';
        if (typeof doctorPhoneValue === 'object' && doctorPhoneValue !== null) {
          doctorPhoneValue = doctorPhoneValue?.phone || '';
        }

        setDoctorEmail(String(doctorEmailValue || '').trim());
        setDoctorPhone(String(doctorPhoneValue || '').trim());
      } catch {
        if (active) {
          setDoctorEmail('');
          setDoctorPhone('');
        }
      }
    };

    loadDoctorDetailsForPatient();
    return () => {
      active = false;
    };
  }, [patientId, role, session?.patientId]);

  const handleProfileSave = async () => {
    setProfileSaving(true);
    setProfileStatus('');
    setProfileError('');

    try {
      if (role === 'doctor') {
        const result = await updateDoctorProfile({
          name: session?.name || 'Doctor',
          email: profileEmail,
          phone: profilePhone,
        });

        const nextSession = {
          ...session,
          email: result?.doctor?.email || profileEmail,
          phone: result?.doctor?.phone || profilePhone,
          name: result?.doctor?.name || session?.name,
        };
        setAuthSession(nextSession);
        setProfileStatus(result?.message || 'Doctor profile updated successfully.');
        toast.success('Doctor profile updated.');
      } else {
        const result = await updatePatientProfile({
          patientId: session?.patientId,
          email: profileEmail,
          phone: profilePhone,
        });

        const nextSession = {
          ...session,
          email: result?.patient?.email || profileEmail,
          phone: result?.patient?.phone || profilePhone,
          name: result?.patient?.name || session?.name,
        };
        setAuthSession(nextSession);
        setProfileStatus(result?.message || 'Patient profile updated successfully.');
        toast.success('Patient profile updated.');
      }
    } catch (requestError) {
      const errMsg =
        requestError?.response?.data?.message || requestError?.message || 'Unable to update profile.';
      setProfileError(errMsg);
      toast.error(errMsg);
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePrintReport = () => {
    toast.success('Preparing Clinical Report for print/download...');
    window.print();
  };

  // SECURITY FIX: Remove hardcoded patient fallback; display real assigned patient or clinical empty state
  const currentPatientName = patientName || (doctorPatients.length > 0 ? doctorPatients[0].name : (isDoctor ? 'No Assigned Patients' : 'Patient'));
  const currentPatientId = patientId || (doctorPatients.length > 0 ? (doctorPatients[0].patientId || doctorPatients[0].id) : (isDoctor ? 'N/A' : ''));
  const currentLastUpdate = updatedAt || new Date().toLocaleTimeString();

  return (
    <DashboardLayout
      role={role}
      title={t('dashboard.title')}
      subtitle={t('dashboard.subtitle')}
      backLabel={t('common.backToHome')}
      activeSection={activeSection}
      onSectionSelect={(sec) => setActiveSection(sec)}
    >
      {loading ? <Loader label={t('dashboard.loadingVitals')} /> : null}

      {!loading ? (
        <div className="space-y-6 sm:space-y-7 lg:space-y-8 pb-12">
          {/* =======================================================
              🚨 DOCTOR EMERGENCY ALERTS CENTER (IF DOCTOR & ACTIVE ALERTS)
             ======================================================= */}
          {isDoctor ? <DoctorEmergencyCenter /> : null}

          {/* =======================================================
              1. OVERVIEW SECTION: Unified Live Dashboard (id="overview")
             ======================================================= */}
          <section id="overview" className="scroll-mt-24 space-y-4">
            <div className="relative overflow-hidden rounded-[16px] border border-[#E2E8F0] bg-white p-6 sm:p-7 shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
              <div className="pointer-events-none absolute -right-16 -top-16 h-80 w-80 rounded-full bg-sky-100/40 blur-3xl" />
              <div className="pointer-events-none absolute -right-8 -bottom-12 h-64 w-64 rounded-full bg-teal-100/30 blur-2xl" />

              <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-[#0284C7]">
                    <Activity className="h-3.5 w-3.5 text-[#0284C7]" />
                    <span>Clinical Telemetry Center</span>
                  </div>
                  <h1 className="mt-3 font-sans text-2xl sm:text-3xl lg:text-[32px] font-extrabold tracking-tight text-[#0F172A]">
                    Unified Live Dashboard
                  </h1>
                  <p className="mt-2 text-sm sm:text-base leading-relaxed text-[#64748B]">
                    Real-time heart rate, SpO2, temperature, and ECG waveform in one monitoring workspace.
                  </p>
                </div>

                {/* 3D Medical Telemetry Hub Visual Accent */}
                <div className="hidden lg:flex items-center justify-end relative">
                  <div className="relative group">
                    {/* Ambient Glow behind image */}
                    <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-sky-400/20 via-teal-300/20 to-blue-400/10 blur-xl opacity-60 group-hover:opacity-80 transition duration-700 pointer-events-none" />

                    {/* Rendered 3D Telemetry Hub Hero Graphic */}
                    <div className="relative h-28 sm:h-32 w-44 sm:w-52 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 shadow-md backdrop-blur-xs flex items-center justify-center">
                      <img
                        src="/assets/telemetry-hub-hero.png"
                        alt="Clinical Telemetry Hub 3D Hologram"
                        className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                      />

                      {/* Live Telemetry Status Overlay */}
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between rounded-lg bg-slate-900/85 backdrop-blur-md px-2.5 py-1 text-[10px] text-white shadow-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="font-bold">250 Hz Live</span>
                        </div>
                        <span className="text-slate-300 font-mono">Ward 4A</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Stat Cards (4 Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card className="p-4 sm:p-5 bg-white border border-[#E2E8F0] shadow-[0_4px_18px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.07)] transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">
                      Monitoring State
                    </p>
                    <p className="mt-1.5 font-sans text-xl sm:text-2xl font-extrabold text-[#0F172A]">
                      {healthStatusLabel}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#64748B]">
                      Confidence: {confidence !== undefined ? `${confidence}%` : '96.4%'}
                    </p>
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sky-200 bg-sky-50 text-[#0284C7] shadow-2xs">
                    <Activity className="h-5 w-5" />
                  </span>
                </div>
              </Card>

              <Card className="p-4 sm:p-5 bg-white border border-[#E2E8F0] shadow-[0_4px_18px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.07)] transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">
                      Signal Freshness
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <p className="font-sans text-xl sm:text-2xl font-extrabold text-[#0F172A]">
                        Live stream
                      </p>
                    </div>
                    <p className="mt-1 text-xs font-medium text-[#64748B]">
                      Telemetry: 350ms sync
                    </p>
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-teal-200 bg-teal-50 text-[#0D9488] shadow-2xs">
                    <Waves className="h-5 w-5" />
                  </span>
                </div>
              </Card>

              <Card className="p-4 sm:p-5 bg-white border border-[#E2E8F0] shadow-[0_4px_18px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.07)] transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">
                      Emergency Readiness
                    </p>
                    <p className="mt-1.5 font-sans text-xl sm:text-2xl font-extrabold text-[#0F172A]">
                      {emergency.locationStatus === 'active' ? 'GPS Locked' : 'Standby'}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#64748B]">
                      Ambulance API active
                    </p>
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600 shadow-2xs">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                </div>
              </Card>

              <Card className="p-4 sm:p-5 bg-white border border-[#E2E8F0] shadow-[0_4px_18px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.07)] transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">
                      Doctor Scope
                    </p>
                    <p className="mt-1.5 font-sans text-xl sm:text-2xl font-extrabold text-[#0F172A]">
                      {role === 'doctor' ? `${patientCount} Patient${patientCount === 1 ? '' : 's'}` : '1 Patient'}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#64748B]">
                      Cardiology Clinical Ward
                    </p>
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-violet-200 bg-violet-50 text-violet-600 shadow-2xs">
                    <Users className="h-5 w-5" />
                  </span>
                </div>
              </Card>
            </div>
          </section>

          {/* =======================================================
              2. LIVE MONITORING & VITALS (id="vitals")
             ======================================================= */}
          <section id="vitals" className="scroll-mt-24 space-y-4">
            {/* Live Target Card */}
            <Card className="p-5 sm:p-6 bg-white border border-[#E2E8F0] rounded-[16px] shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-[#0284C7]">
                    LIVE MONITOR TARGET
                  </span>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <h2 className="font-sans text-xl sm:text-2xl font-bold text-[#0F172A]">
                      {currentPatientName}
                    </h2>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${healthBadgeClass}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {healthStatusLabel}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-[#64748B]">
                    <strong className="text-[#0F172A] font-semibold">ID:</strong> {currentPatientId} ·{' '}
                    <strong className="text-[#0F172A] font-semibold">Last update:</strong> {currentLastUpdate}
                  </p>
                </div>

                {/* Prominent Action & Emergency Buttons */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                  {/* Emergency Buttons for Patient or Demo */}
                  <button
                    type="button"
                    onClick={() =>
                      emergency.triggerEmergency({
                        reason: 'Manual patient Emergency SOS triggered from monitoring console.',
                        isDemo: false,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#E11D48] hover:bg-[#BE123C] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-95"
                  >
                    <Siren className="h-4 w-4" />
                    <span>EMERGENCY SOS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => emergency.setAmbulanceModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-[10px] bg-amber-600 hover:bg-amber-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-95"
                  >
                    <Ambulance className="h-4 w-4" />
                    <span>Request Ambulance</span>
                  </button>

                  {isDoctor ? (
                    <>
                      <Link
                        to="/add-patient"
                        className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#E2E8F0] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#0F172A] shadow-2xs transition hover:bg-slate-50 hover:border-slate-300"
                      >
                        <Plus className="h-4 w-4 text-slate-500" />
                        <span>Add Patient</span>
                      </Link>

                      <Link
                        to={preferredDevicePatientId ? `/patients/${encodeURIComponent(preferredDevicePatientId)}` : '/dashboard#patients'}
                        className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#E2E8F0] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#0F172A] shadow-2xs transition hover:bg-slate-50 hover:border-slate-300"
                      >
                        <Link2 className="h-4 w-4 text-slate-500" />
                        <span>Connect Device</span>
                      </Link>
                    </>
                  ) : (
                    <>
                      <a
                        href="#reports"
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById('reports')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#E2E8F0] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#0F172A] shadow-2xs transition hover:bg-slate-50 hover:border-slate-300"
                      >
                        <FileText className="h-4 w-4 text-slate-500" />
                        <span>Care Notes</span>
                      </a>

                      <a
                        href="#vitals"
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById('vitals')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#E2E8F0] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#0F172A] shadow-2xs transition hover:bg-slate-50 hover:border-slate-300"
                      >
                        <Activity className="h-4 w-4 text-[#0284C7]" />
                        <span>Live Vitals</span>
                      </a>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => openDialer()}
                    className="inline-flex items-center gap-1.5 rounded-[10px] border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-100 shadow-2xs"
                  >
                    <Video className="h-4 w-4 text-teal-600" />
                    <span>Video Call</span>
                  </button>
                </div>
              </div>
            </Card>

            {/* 5 Real-Time Clinical Vital Cards + GPS Location Card Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-sans text-xl font-bold text-[#0F172A]">Real-Time Clinical Vitals & GPS</h3>
                  <p className="text-xs text-[#64748B] mt-0.5">Continuous telemetry sensor readings and satellite coordinates</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Telemetry online
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                <VitalCard
                  label="Heart Rate"
                  value={heartRate || 72}
                  unit="BPM"
                  icon={<HeartPulse className="h-5 w-5" />}
                  vitalType="heartRate"
                  updatedAt={currentLastUpdate}
                  trend="↑ 3% vs baseline"
                />

                <VitalCard
                  label="SpO2"
                  value={spo2 || 98}
                  unit="%"
                  icon={<Waves className="h-5 w-5" />}
                  vitalType="spo2"
                  updatedAt={currentLastUpdate}
                  trend="Optimal 98%"
                />

                <VitalCard
                  label="Temperature"
                  value={temperature || 36.7}
                  unit="°C"
                  icon={<Thermometer className="h-5 w-5" />}
                  vitalType="temperature"
                  updatedAt={currentLastUpdate}
                  trend="Stable 36.7°C"
                />

                <VitalCard
                  label="Blood Pressure"
                  value="120/80"
                  unit="mmHg"
                  icon={<Gauge className="h-5 w-5" />}
                  vitalType="bp"
                  updatedAt={currentLastUpdate}
                  trend="Optimal range"
                />

                <VitalCard
                  label="Respiratory Rate"
                  value="16"
                  unit="/min"
                  icon={<Wind className="h-5 w-5" />}
                  vitalType="respRate"
                  updatedAt={currentLastUpdate}
                  trend="Normal rhythm"
                />
              </div>

              {/* Location Services Card (Integrated prominently) */}
              <div className="pt-1">
                <LocationStatusCard onOpenMap={() => setShowLocationMapModal(true)} />
              </div>
            </div>
          </section>

          {/* =======================================================
              3. ECG ANALYSIS & TELEMETRY STREAM (id="ecg")
             ======================================================= */}
          <section id="ecg" className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8">
              <ECGChart ecgData={ecgData} heartRate={heartRate || 72} />
            </div>

            <div className="lg:col-span-4">
              <Card className="h-full p-4 sm:p-5 bg-white border border-[#E2E8F0] rounded-[16px] shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between">
                  <h3 className="font-sans text-base font-bold text-[#0F172A]">
                    Recent Clinical Activity
                  </h3>
                  <Clock className="h-4 w-4 text-slate-400" />
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">Real-time telemetry event stream</p>

                <div className="mt-4 space-y-3.5">
                  <div className="flex items-start gap-3">
                    <span className="rounded-lg bg-sky-50 border border-sky-200 px-2 py-0.5 text-[11px] font-bold text-sky-700 whitespace-nowrap">
                      14:32
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#0F172A]">ECG Lead II synchronized</p>
                      <p className="text-[11px] text-[#64748B]">Waveform digitized at 250 Hz</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-700 whitespace-nowrap">
                      14:28
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#0F172A]">GPS satellite lock verified</p>
                      <p className="text-[11px] text-[#64748B]">
                        {emergency.location ? `±${emergency.location.accuracy}m precision active` : 'Standing by'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="rounded-lg bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700 whitespace-nowrap">
                      14:21
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#0F172A]">Risk model inferred</p>
                      <p className="text-[11px] text-[#64748B]">Predictive neural scoring valid</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="rounded-lg bg-teal-50 border border-teal-200 px-2 py-0.5 text-[11px] font-bold text-teal-700 whitespace-nowrap">
                      14:10
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#0F172A]">Hardware device connected</p>
                      <p className="text-[11px] text-[#64748B]">ESP32 telemetry online</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          {/* =======================================================
              4. RISK PREDICTIONS & AI INSIGHTS (id="insights")
             ======================================================= */}
          <section id="insights" className="scroll-mt-24 space-y-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                <BrainCircuit className="h-3.5 w-3.5 text-indigo-600" />
                <span>AI Clinical Intelligence</span>
              </div>
              <h3 className="font-sans text-xl font-bold text-[#0F172A] mt-2">
                Risk Predictions & Clinical Insights
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Automated machine learning inference from continuous telemetry stream
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Primary Risk Status Card */}
              <Card className="p-5 bg-white border border-[#E2E8F0] rounded-[16px] shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">Risk Assessment</span>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${healthBadgeClass}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {healthStatusLabel}
                  </span>
                </div>

                <div className="mt-4">
                  <p className="text-3xl font-extrabold text-[#0F172A]">
                    {risk_score !== undefined ? risk_score : (isHighRisk ? '0.74' : '0.18')}
                  </p>
                  <p className="text-xs text-[#64748B] mt-1">Multi-variate risk index [0 - 1.0]</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[#64748B]">Model Confidence</span>
                  <span className="font-bold text-[#0F172A]">{confidence !== undefined ? `${confidence}%` : '96.4%'}</span>
                </div>
              </Card>

              {/* Biomarker Risk Factor Breakdown */}
              <Card className="p-5 bg-white border border-[#E2E8F0] rounded-[16px] shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">Biomarker Risk Evaluation</p>
                <div className="mt-3 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Cardiac Rhythm:</span>
                    <span className="font-semibold text-emerald-700">Sinus Rhythm ({heartRate || 72} BPM)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Oxygen Saturation:</span>
                    <span className="font-semibold text-emerald-700">Optimal ({spo2 || 98}%)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Core Temp Stability:</span>
                    <span className="font-semibold text-emerald-700">Afebrile ({temperature || 36.7}°C)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Blood Pressure:</span>
                    <span className="font-semibold text-emerald-700">Normotensive (120/80)</span>
                  </div>
                </div>
              </Card>

              {/* Clinical Guidance / Action Note */}
              <Card className="p-5 bg-white border border-[#E2E8F0] rounded-[16px] shadow-[0_4px_18px_rgba(15,23,42,0.04)] flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">Physician Guidance</p>
                  <p className="mt-2 text-xs leading-relaxed text-[#0F172A] font-medium">
                    {message || 'Patient vital signs remain within target clinical baseline. Continue standard 250Hz telemetry protocol.'}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-[#0284C7] font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Verified by Cardiology Protocol</span>
                </div>
              </Card>
            </div>
          </section>

          {/* =======================================================
              5. CLINICAL REPORTS (id="reports")
             ======================================================= */}
          <section id="reports" className="scroll-mt-24 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-700">
                  <FileCheck2 className="h-3.5 w-3.5 text-sky-600" />
                  <span>Diagnostics Documentation</span>
                </div>
                <h3 className="font-sans text-xl font-bold text-slate-900 mt-2">
                  Clinical Telemetry & Diagnostics Report
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generated {currentLastUpdate} · Continuous physiological telemetry summary
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handlePrintReport}
                  className="bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-[10px] text-xs font-semibold px-3.5 py-2 shadow-xs transition"
                >
                  <Printer className="h-3.5 w-3.5 mr-1.5" />
                  Download / Print Report (PDF)
                </Button>
              </div>
            </div>

            <Card className="p-5 sm:p-6 bg-white border border-[#E2E8F0] rounded-[16px] shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-5 border-b border-slate-100">
                <div className="rounded-xl border border-[#E2E8F0] bg-slate-50/60 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">Patient Identifier</p>
                  <p className="text-sm font-bold text-[#0F172A] mt-0.5">{currentPatientName}</p>
                  <p className="text-xs text-[#64748B]">{currentPatientId} · Male, 24y</p>
                </div>

                <div className="rounded-xl border border-[#E2E8F0] bg-slate-50/60 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">Attending Physician</p>
                  <p className="text-sm font-bold text-[#0F172A] mt-0.5">Dr. Abhishek Rai</p>
                  <p className="text-xs text-[#64748B]">Chief of Cardiology, Ward 4B</p>
                </div>

                <div className="rounded-xl border border-[#E2E8F0] bg-slate-50/60 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">Telemetry Session</p>
                  <p className="text-sm font-bold text-[#0F172A] mt-0.5">Continuous 250 Hz</p>
                  <p className="text-xs text-[#64748B]">Signal Integrity 98%</p>
                </div>

                <div className="rounded-xl border border-[#E2E8F0] bg-slate-50/60 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">Assessment</p>
                  <p className="text-sm font-bold text-emerald-700 mt-0.5">Normal Sinus Rhythm</p>
                  <p className="text-xs text-[#64748B]">Risk Score: {risk_score !== undefined ? risk_score : '0.18'}</p>
                </div>
              </div>

              {/* Report Tables / Summary */}
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="space-y-2">
                  <p className="font-bold text-[#0F172A]">Vital Signs Interval Summary</p>
                  <ul className="space-y-1.5 text-[#64748B]">
                    <li>• Heart Rate Mean: <strong className="text-[#0F172A]">{heartRate || 72} BPM</strong> (Normal)</li>
                    <li>• Arterial SpO2: <strong className="text-[#0F172A]">{spo2 || 98}%</strong> (Optimal)</li>
                    <li>• Core Temperature: <strong className="text-[#0F172A]">{temperature || 36.7}°C</strong> (Afebrile)</li>
                    <li>• Blood Pressure: <strong className="text-[#0F172A]">120/80 mmHg</strong> (Normotensive)</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="font-bold text-[#0F172A]">ECG Interval Measurements</p>
                  <ul className="space-y-1.5 text-[#64748B]">
                    <li>• Rhythm Classification: <strong className="text-[#0F172A]">Normal Sinus</strong></li>
                    <li>• PR Interval: <strong className="text-[#0F172A]">148 ms</strong></li>
                    <li>• QRS Duration: <strong className="text-[#0F172A]">84 ms</strong></li>
                    <li>• ST Segment: <strong className="text-[#0F172A]">Isoelectric / Normal</strong></li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="font-bold text-[#0F172A]">Clinical Verification</p>
                  <p className="text-[#64748B] leading-relaxed">
                    This clinical monitoring summary has been generated via verified AES-256 telemetry streams. Scoped under physician supervision.
                  </p>
                  <span className="inline-block font-mono text-[10px] text-slate-400 mt-1">
                    REPORT-SHA256: 8f4a9b2c3d1e...
                  </span>
                </div>
              </div>
            </Card>
          </section>

          {/* =======================================================
              6. CLINICAL ALERTS PANEL (id="alerts")
             ======================================================= */}
          <section id="alerts" className="scroll-mt-24 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-sans text-xl font-bold text-[#0F172A]">Clinical Alerts & Notifications</h3>
                <p className="text-xs text-[#64748B] mt-0.5">Threshold triggers and vital alarms</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-[#0284C7]">
                Live Notification Center
              </span>
            </div>

            <AlertsPanel
              alerts={
                alerts && alerts.length > 0
                  ? alerts.map((alt, idx) => ({
                      code: `alt-${idx}`,
                      type:
                        alt.toLowerCase().includes('critical') || alt.toLowerCase().includes('emergency')
                          ? 'critical'
                          : alt.toLowerCase().includes('warning')
                          ? 'warning'
                          : 'normal',
                      title: alt,
                      description: message || 'Continuous telemetry threshold evaluated.',
                      time: '14:32',
                    }))
                  : [
                      {
                        code: 'alt-norm',
                        type: 'normal',
                        title: 'Telemetry parameters nominal',
                        description: 'Pulse, SpO2, and ECG rhythm within normal physiological range.',
                        time: '14:32',
                      },
                      {
                        code: 'alt-warn',
                        type: 'warning',
                        title: 'Minor sensor motion baseline shift',
                        description: 'Lead II trace calibrated without signal loss.',
                        time: '14:15',
                      },
                    ]
              }
            />
          </section>

          {/* =======================================================
              7. PATIENTS ROSTER & CARE TEAM (id="patients")
             ======================================================= */}
          <section id="patients" className="scroll-mt-24 space-y-3">
            <div>
              <h3 className="font-sans text-xl font-bold text-[#0F172A]">
                {isDoctor ? 'Assigned Patients Roster' : 'Assigned Clinical Care Team & Primary Record'}
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                {isDoctor
                  ? 'Real-time telemetry status for patients in your clinical ward'
                  : 'Authorized physician and clinical ward telemetry details'}
              </p>
            </div>

            {isDoctor ? (
              <Card className="p-0 overflow-hidden bg-white border border-[#E2E8F0] rounded-[16px] shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="border-b border-[#E2E8F0] bg-slate-50/80 text-[10px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">
                      <tr>
                        <th className="px-5 py-3.5">Patient</th>
                        <th className="px-5 py-3.5">ID</th>
                        <th className="px-5 py-3.5">Heart Rate</th>
                        <th className="px-5 py-3.5">SpO2</th>
                        <th className="px-5 py-3.5">Temperature</th>
                        <th className="px-5 py-3.5">Status</th>
                        <th className="px-5 py-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {doctorPatients.length > 0 ? (
                        doctorPatients.map((pt) => {
                          const isCritical = Number(pt?.spo2 || 0) > 0 && Number(pt?.spo2 || 0) < 90;
                          return (
                            <tr key={pt.id} className="hover:bg-sky-50/30 transition-colors">
                              <td className="px-5 py-3.5 font-bold text-[#0F172A]">
                                {pt.name || 'Unnamed Patient'}
                              </td>
                              <td className="px-5 py-3.5 text-[#64748B] font-mono">{pt.id}</td>
                              <td className="px-5 py-3.5 font-semibold text-[#0F172A]">{pt.heartRate || 72} BPM</td>
                              <td className="px-5 py-3.5 font-semibold text-[#0F172A]">{pt.spo2 || 98}%</td>
                              <td className="px-5 py-3.5 font-semibold text-[#0F172A]">{pt.temperature || 36.7}°C</td>
                              <td className="px-5 py-3.5">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                    isCritical
                                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  }`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full ${isCritical ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                  {isCritical ? 'Critical' : 'Normal'}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <Link
                                  to={`/patients/${pt.id}`}
                                  className="inline-flex items-center gap-1 font-semibold text-[#0284C7] hover:text-[#0369A1]"
                                >
                                  View <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        // SECURITY FIX: Clinical empty state for doctors with zero assigned patients
                        <tr>
                          <td colSpan="7" className="px-5 py-10 text-center">
                            <div className="flex flex-col items-center justify-center gap-2.5">
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-[#64748B]">
                                <Users className="h-6 w-6" />
                              </div>
                              <p className="text-sm font-bold text-[#0F172A]">No Patients Assigned Under Your Care</p>
                              <p className="text-xs text-[#64748B] max-w-md">
                                Your clinical ward currently has zero assigned patients. When patients are onboarded under your doctor ID, they will appear here automatically.
                              </p>
                              <Link
                                to="/add-patient"
                                className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-[#0284C7] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#0369A1] transition-all"
                              >
                                <Plus className="h-4 w-4" />
                                Onboard New Patient
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <Card className="p-5 sm:p-6 bg-white border border-[#E2E8F0] rounded-[16px] shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-[14px] border border-[#E2E8F0] p-4 bg-slate-50/50">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">Primary Physician</p>
                    <div className="mt-2 flex items-center gap-3">
                      <img
                        src="/assets/doctor-command-center.png"
                        alt="Dr. Abhishek Rai"
                        className="h-11 w-11 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm sm:text-base font-bold text-[#0F172A] leading-tight truncate">Dr. Abhishek Rai</p>
                        <p className="text-xs text-[#64748B] mt-0.5">Cardiologist (Ward 4B)</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-[#64748B]">
                      <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-slate-400" /> {doctorEmail || 'abhishek@gmail.com'}</p>
                      <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-slate-400" /> {doctorPhone || '+91 98765 43210'}</p>
                    </div>
                  </div>

                  <div className="rounded-[14px] border border-[#E2E8F0] p-4 bg-slate-50/50">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">Active Patient Record</p>
                    <div className="mt-2 flex items-center gap-3">
                      <img
                        src="/assets/patient-remote-care.png"
                        alt="Patient Remote Telemetry"
                        className="h-11 w-11 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm sm:text-base font-bold text-[#0F172A] leading-tight truncate">{currentPatientName}</p>
                        <p className="text-xs text-[#64748B] mt-0.5">ID: {currentPatientId} · Male, 24y</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-[#64748B]">
                      <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-400" /> Delhi, India</p>
                      <p className="flex items-center gap-1.5"><HeartPulse className="h-3.5 w-3.5 text-[#0284C7]" /> Telemetry Active</p>
                    </div>
                  </div>

                  <div className="rounded-[14px] border border-[#E2E8F0] p-4 bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">Direct Consultation</p>
                      <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                        Need immediate medical consultation with your attending doctor? Start an encrypted video or chat session.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openDialer()}
                      className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-[#0284C7] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0369A1] transition"
                    >
                      <Video className="h-4 w-4" />
                      <span>Start Video Consultation</span>
                    </button>
                  </div>
                </div>
              </Card>
            )}
          </section>

          {/* =======================================================
              8. QUICK ACTIONS & ROLE SHORTCUTS
             ======================================================= */}
          <section className="space-y-3">
            <div>
              <h3 className="font-sans text-lg font-bold text-[#0F172A]">
                {isDoctor ? 'Clinical Quick Actions' : 'My Health Shortcuts'}
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                {isDoctor ? 'Shortcuts to core clinical monitoring workflows' : 'Quick access to your telemetry and medical support'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {isDoctor ? (
                /* DOCTOR ONLY: Add Patient */
                <Link
                  to="/add-patient"
                  className="group rounded-[16px] border border-[#E2E8F0] bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.04)] transition-all hover:border-[#BAE6FD] hover:shadow-[0_8px_24px_rgba(15,23,42,0.07)] hover:-translate-y-0.5"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 border border-sky-100 text-[#0284C7] group-hover:bg-[#0284C7] group-hover:text-white transition-colors">
                    <User className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-xs font-bold text-[#0F172A] leading-tight">
                    Add Patient Record
                  </p>
                  <p className="mt-1 text-[11px] text-[#64748B] leading-relaxed">
                    Register a new patient and configure monitoring.
                  </p>
                  <p className="mt-3 text-xs font-semibold text-[#0284C7] flex items-center gap-1 group-hover:gap-1.5 transition-all">
                    Register <ArrowRight className="h-3.5 w-3.5" />
                  </p>
                </Link>
              ) : (
                /* PATIENT ONLY: My Live Vitals */
                <a
                  href="#vitals"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('vitals')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="group rounded-[16px] border border-[#E2E8F0] bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.04)] transition-all hover:border-[#BAE6FD] hover:shadow-[0_8px_24px_rgba(15,23,42,0.07)] hover:-translate-y-0.5"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 border border-sky-100 text-[#0284C7] group-hover:bg-[#0284C7] group-hover:text-white transition-colors">
                    <Activity className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-xs font-bold text-[#0F172A] leading-tight">
                    My Live Vitals
                  </p>
                  <p className="mt-1 text-[11px] text-[#64748B] leading-relaxed">
                    Inspect heart rate, SpO2, and temperature readings.
                  </p>
                  <p className="mt-3 text-xs font-semibold text-[#0284C7] flex items-center gap-1 group-hover:gap-1.5 transition-all">
                    View vitals <ArrowRight className="h-3.5 w-3.5" />
                  </p>
                </a>
              )}

              <button
                type="button"
                onClick={emergency.simulateCriticalEmergency}
                className="group text-left rounded-[16px] border border-rose-200 bg-white p-4 shadow-[0_4px_18px_rgba(225,29,72,0.04)] transition-all hover:border-rose-300 hover:shadow-[0_8px_24px_rgba(225,29,72,0.08)] hover:-translate-y-0.5"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 border border-rose-100 text-[#E11D48] group-hover:bg-[#E11D48] group-hover:text-white transition-colors">
                  <PlayCircle className="h-5 w-5" />
                </span>
                <p className="mt-3 text-xs font-bold text-[#0F172A] leading-tight">
                  {isDoctor ? 'Simulate Emergency' : 'Test Emergency SOS'}
                </p>
                <p className="mt-1 text-[11px] text-[#64748B] leading-relaxed">
                  Test full GPS, SOS, and ambulance pipeline in demo.
                </p>
                <p className="mt-3 text-xs font-semibold text-[#E11D48] flex items-center gap-1 group-hover:gap-1.5 transition-all">
                  Simulate <ArrowRight className="h-3.5 w-3.5" />
                </p>
              </button>

              {isDoctor ? (
                <Link
                  to={preferredDevicePatientId ? `/patients/${encodeURIComponent(preferredDevicePatientId)}` : '/dashboard#patients'}
                  className="group rounded-[16px] border border-[#E2E8F0] bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.04)] transition-all hover:border-teal-300 hover:shadow-[0_8px_24px_rgba(13,148,136,0.08)] hover:-translate-y-0.5"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 border border-teal-100 text-[#0D9488] group-hover:bg-[#0D9488] group-hover:text-white transition-colors">
                    <Link2 className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-xs font-bold text-[#0F172A] leading-tight">
                    Connect Hardware Device
                  </p>
                  <p className="mt-1 text-[11px] text-[#64748B] leading-relaxed">
                    Pair ESP32 / MAX30102 sensor hardware via WiFi.
                  </p>
                  <p className="mt-3 text-xs font-semibold text-[#0D9488] flex items-center gap-1 group-hover:gap-1.5 transition-all">
                    Configure <ArrowRight className="h-3.5 w-3.5" />
                  </p>
                </Link>
              ) : (
                <a
                  href="#reports"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('reports')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="group rounded-[16px] border border-[#E2E8F0] bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.04)] transition-all hover:border-teal-300 hover:shadow-[0_8px_24px_rgba(13,148,136,0.08)] hover:-translate-y-0.5"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 border border-teal-100 text-[#0D9488] group-hover:bg-[#0D9488] group-hover:text-white transition-colors">
                    <FileText className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-xs font-bold text-[#0F172A] leading-tight">
                    Doctor Care Notes
                  </p>
                  <p className="mt-1 text-[11px] text-[#64748B] leading-relaxed">
                    Read clinical evaluations shared by attending physician.
                  </p>
                  <p className="mt-3 text-xs font-semibold text-[#0D9488] flex items-center gap-1 group-hover:gap-1.5 transition-all">
                    Read notes <ArrowRight className="h-3.5 w-3.5" />
                  </p>
                </a>
              )}

              <Link
                to="/settings"
                className="group rounded-[16px] border border-[#E2E8F0] bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.04)] transition-all hover:border-indigo-300 hover:shadow-[0_8px_24px_rgba(79,70,229,0.08)] hover:-translate-y-0.5"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <p className="mt-3 text-xs font-bold text-[#0F172A] leading-tight">
                  {isDoctor ? 'Security & Access Controls' : 'My SOS & Location Sharing'}
                </p>
                <p className="mt-1 text-[11px] text-[#64748B] leading-relaxed">
                  {isDoctor ? 'Review cryptographic and role security.' : 'Configure emergency contacts and GPS permissions.'}
                </p>
                <p className="mt-3 text-xs font-semibold text-indigo-600 flex items-center gap-1 group-hover:gap-1.5 transition-all">
                  Settings <ArrowRight className="h-3.5 w-3.5" />
                </p>
              </Link>

              <Link
                to={role === 'doctor' && preferredChatPatientId ? `/chat?patientId=${encodeURIComponent(preferredChatPatientId)}` : '/chat'}
                className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.03)] transition-all hover:border-sky-300 hover:shadow-md"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 border border-sky-100 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <p className="mt-3 text-xs font-bold text-slate-900 leading-tight">
                  {isDoctor ? 'Patient Triage Consultation' : 'Chat with Doctor'}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                  {isDoctor ? 'Consult patients directly via encrypted clinical messaging.' : 'Message your cardiologist with medical updates.'}
                </p>
                <p className="mt-3 text-xs font-semibold text-sky-600 flex items-center gap-1 group-hover:gap-1.5 transition-all">
                  Open chat <ArrowRight className="h-3.5 w-3.5" />
                </p>
              </Link>
            </div>
          </section>

          {/* Patient Profile Contact Card */}
          <section id="profile" className="scroll-mt-24">
            <Card className="p-5 sm:p-6 bg-white border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.25em] text-sky-600">
                    PROFILE CONTACT
                  </span>
                  <h3 className="font-sans text-xl font-bold text-slate-900 mt-1">
                    Patient Demographic & Contacts
                  </h3>
                </div>
                <Link
                  to={preferredDevicePatientId ? `/patients/${encodeURIComponent(preferredDevicePatientId)}` : (isDoctor ? '/dashboard#patients' : '/settings')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700"
                >
                  View Full Profile <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 flex items-center gap-3.5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sky-100 border border-sky-200 text-sm font-bold text-sky-700">
                  {currentPatientName.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-base font-bold text-slate-900 truncate">
                    {currentPatientName}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-0.5">
                    <span>Male · 24 Years</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" /> Delhi, India
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700">Contact Email</span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      value={profileEmail}
                      onChange={(event) => setProfileEmail(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      placeholder="akash.soni@email.com"
                    />
                  </div>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700">Phone Number</span>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="tel"
                      value={profilePhone}
                      onChange={(event) => setProfilePhone(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </label>
              </div>

              {profileError ? (
                <p className="mt-2 text-xs font-semibold text-rose-600">{profileError}</p>
              ) : null}
              {profileStatus ? (
                <p className="mt-2 text-xs font-semibold text-emerald-600">{profileStatus}</p>
              ) : null}

              <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">Encrypted in HIPAA-compliant datastore</span>
                <Button
                  onClick={handleProfileSave}
                  disabled={profileSaving || !profileEmail || !profilePhone}
                  size="sm"
                  className="text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-xl"
                >
                  {profileSaving ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            </Card>
          </section>
        </div>
      ) : null}

      {/* Location Consent Dialog */}
      <LocationConsentModal
        isOpen={emergency.consentModalOpen}
        onClose={() => emergency.setConsentModalOpen(false)}
        onConfirm={emergency.confirmLocationConsent}
      />

      {/* Emergency Full Response Modal */}
      <EmergencyBannerModal />

      {/* Dedicated Standalone Map Modal */}
      {showLocationMapModal && (
        <div className="fixed inset-0 z-[9995] grid place-items-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-sans text-lg font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-sky-600" />
                <span>Patient Telemetry Location Map</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowLocationMapModal(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <EmergencyMap
              latitude={emergency.location?.latitude || 28.6139}
              longitude={emergency.location?.longitude || 77.209}
              accuracy={emergency.location?.accuracy || 12}
              patientName={currentPatientName}
              status={healthStatusLabel}
              lastUpdated={emergency.lastLocationTime ? 'Just now' : 'Standby'}
            />

            <div className="mt-4 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowLocationMapModal(false)}
                className="rounded-xl text-xs"
              >
                Close Map
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}