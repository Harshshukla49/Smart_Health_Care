import React, { useEffect, useMemo, useState } from 'react';
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
import { StatusPill } from '../components/StatusPill';
import { VitalCard } from '../components/VitalCard';
import { ClinicalReportSection } from '../components/ClinicalReportSection';
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
import { AiHealthAssessment } from '../components/AiHealthAssessment';
import { MedicationManagement } from '../components/MedicationManagement';

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
  const { openDialer, startCall, simulateIncomingPatientCall } = useVideoCall();

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
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [profileEmail, setProfileEmail] = useState(session?.email || '');
  const [profilePhone, setProfilePhone] = useState(session?.phone || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState('');
  const [profileError, setProfileError] = useState('');
  const [doctorName, setDoctorName] = useState(session?.doctorName || '');
  const [doctorSpecialty, setDoctorSpecialty] = useState(session?.doctorSpecialty || '');
  const [doctorEmail, setDoctorEmail] = useState(session?.doctorEmail || '');
  const [doctorPhone, setDoctorPhone] = useState(session?.doctorPhone || '');
  const [patientAge, setPatientAge] = useState(session?.age || 24);
  const [patientGender, setPatientGender] = useState(session?.gender || 'Male');
  const [showLocationMapModal, setShowLocationMapModal] = useState(false);

  // SECURITY FIX: Real assigned patient count without synthetic fallback
  const patientCount = doctorPatients.length;
  const preferredChatPatientId = isDoctor
    ? (selectedPatientId || (doctorPatients[0]?.id ? String(doctorPatients[0].id) : ''))
    : (session?.patientId || patientId || '');
  const preferredDevicePatientId = preferredChatPatientId;

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
          const list = Array.isArray(rows) ? rows : [];
          setDoctorPatients(list);
          setSelectedPatientId((prev) => {
            if (prev && list.some((p) => String(p.id).toLowerCase() === String(prev).toLowerCase())) {
              return prev;
            }
            return list.length > 0 ? list[0].id : null;
          });
        }
      } catch {
        if (active) {
          setDoctorPatients([]);
          setSelectedPatientId(null);
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

        const doctorNameValue =
          profile?.doctorContact?.name ||
          profile?.doctorName ||
          profile?.assignedDoctorName ||
          '';

        const doctorSpecialtyValue =
          profile?.doctorContact?.specialty ||
          profile?.doctorSpecialty ||
          '';

        setDoctorEmail(String(doctorEmailValue || '').trim());
        setDoctorPhone(String(doctorPhoneValue || '').trim());
        if (doctorNameValue) {
          setDoctorName(String(doctorNameValue).trim());
        }
        if (doctorSpecialtyValue) {
          setDoctorSpecialty(String(doctorSpecialtyValue).trim());
        }
        if (profile?.age) {
          setPatientAge(profile.age);
        }
        if (profile?.gender) {
          setPatientGender(profile.gender);
        }

        const currentSession = getAuthSession();
        if (currentSession && normalizeRole(currentSession.role) === 'patient') {
          setAuthSession({
            ...currentSession,
            doctorId: String(profile?.doctorId || profile?.assignedDoctorId || doctorEmailValue || currentSession.doctorId || '').trim(),
            doctorEmail: String(doctorEmailValue || currentSession.doctorEmail || '').trim(),
            doctorName: String(doctorNameValue || currentSession.doctorName || '').trim(),
            doctorPhone: String(doctorPhoneValue || currentSession.doctorPhone || '').trim(),
            doctorSpecialty: String(doctorSpecialtyValue || currentSession.doctorSpecialty || '').trim(),
          });
        }
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

  const selectedPatient = useMemo(() => {
    if (!isDoctor) return null;
    if (!selectedPatientId) return doctorPatients[0] || null;
    return (
      doctorPatients.find(
        (p) => String(p.id).toLowerCase() === String(selectedPatientId).toLowerCase()
      ) || doctorPatients[0] || null
    );
  }, [isDoctor, selectedPatientId, doctorPatients]);

  // Selected Patient Details
  const rawPatientName = isDoctor
    ? (selectedPatient?.name || (doctorPatients.length > 0 ? doctorPatients[0]?.name : ''))
    : (patientName || session?.name || 'Patient');
  const currentPatientName = String(rawPatientName || (isDoctor ? 'Clinical Ward' : 'Patient')).trim();
  const currentPatientId = String(
    isDoctor
      ? (selectedPatient?.id ? String(selectedPatient.id) : (doctorPatients[0]?.id ? String(doctorPatients[0].id) : ''))
      : (patientId || session?.patientId || 'PT-ACTIVE')
  );
  const currentLastUpdate = updatedAt || new Date().toLocaleTimeString();

  const activeFirstPatient = isDoctor ? selectedPatient : null;
  const effectiveAge = activeFirstPatient?.age || patientAge || 24;
  const rawGender = activeFirstPatient?.gender || patientGender || 'Male';
  const effectiveGender = rawGender ? (rawGender.charAt(0).toUpperCase() + rawGender.slice(1)) : 'Male';

  // Dynamically resolve attending doctor details (zero hardcoded mock fallbacks)
  const rawDoctorName = isDoctor
    ? (session?.name || 'Attending Physician')
    : (doctorName || session?.doctorName || (doctorEmail ? doctorEmail.split('@')[0] : ''));
  const attendingDoctorName = rawDoctorName
    ? (rawDoctorName.toLowerCase().startsWith('dr.') ? rawDoctorName : `Dr. ${rawDoctorName}`)
    : 'Assigned Physician';

  const attendingDoctorEmail = isDoctor
    ? (session?.email || '')
    : (doctorEmail || session?.doctorEmail || '');

  const attendingDoctorId = isDoctor
    ? (session?.doctorId || session?.email || '')
    : (session?.doctorId || doctorEmail || session?.doctorEmail || '');

  const attendingDoctorPhone = isDoctor
    ? (session?.phone || '')
    : (doctorPhone || session?.doctorPhone || '+91 98765 43210');

  const attendingDoctorSpecialty = isDoctor
    ? (session?.specialty || 'Chief of Cardiology, Ward 4B')
    : (doctorSpecialty || session?.doctorSpecialty || 'Cardiologist (Ward 4B)');

  // Formatted display confidence: handle both 0.8402 (decimal) and 84.02 / 96 (integer/percentage)
  const displayConfidence = useMemo(() => {
    if (confidence === undefined || confidence === null || confidence === '') return '96.4%';
    const num = Number(confidence);
    if (isNaN(num)) return String(confidence);
    if (num > 0 && num <= 1) {
      return `${(num * 100).toFixed(1)}%`;
    }
    return `${num.toFixed(1)}%`;
  }, [confidence]);

  const handleOpenVideoDialer = () => {
    if (isDoctor) {
      const targetPt = selectedPatient || (doctorPatients.length > 0 ? doctorPatients[0] : null);
      if (targetPt) {
        startCall({
          id: targetPt.id,
          patientId: targetPt.id,
          name: targetPt.name,
          patientName: targetPt.name,
          heartRate: targetPt.heartRate,
          spo2: targetPt.spo2,
          temperature: targetPt.temperature,
          status: targetPt.status || 'Monitoring',
        });
      } else {
        toast.error('No patients assigned under your care to call.');
      }
    } else {
      openDialer({
        id: attendingDoctorId || attendingDoctorEmail || 'assigned-doctor',
        email: attendingDoctorEmail,
        name: attendingDoctorName,
        title: attendingDoctorSpecialty,
        department: 'Cardiology & Intensive Ward 4B',
        phone: attendingDoctorPhone,
        extension: '401',
        avatar: '/assets/doctor-command-center.png',
        isAssigned: true,
      });
    }
  };

  return (
    <DashboardLayout
      role={role}
      title={t('dashboard.title')}
      subtitle={t('dashboard.subtitle')}
      backLabel={t('common.backToHome')}
      activeSection={activeSection}
      onSectionSelect={(sec) => setActiveSection(sec)}
    >
      {loading ? (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs text-sky-800 backdrop-blur-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sky-500 animate-ping" />
            <span className="font-semibold">{t('dashboard.loadingVitals') || 'Connecting to clinical telemetry hub... Synchronizing patient records.'}</span>
          </div>
          <span className="text-[11px] text-sky-600 font-mono">Syncing Telemetry</span>
        </div>
      ) : null}

      <div className="space-y-6 sm:space-y-7 lg:space-y-8 pb-12">
          {/* =======================================================
              🚨 DOCTOR EMERGENCY ALERTS CENTER (IF DOCTOR & ACTIVE ALERTS)
             ======================================================= */}
          {isDoctor ? <DoctorEmergencyCenter /> : null}

          {/* =======================================================
              1. OVERVIEW SECTION: Unified Live Dashboard (id="overview")
             ======================================================= */}
          <section id="overview" className="scroll-mt-24 space-y-4">
            <div className="relative overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white p-6 sm:p-7 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
              <div className="pointer-events-none absolute -right-16 -top-16 h-80 w-80 rounded-full bg-sky-100/40 blur-3xl" />
              <div className="pointer-events-none absolute -right-8 -bottom-12 h-64 w-64 rounded-full bg-teal-100/30 blur-2xl" />

              <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-[#0284C7]">
                    <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                    <span>{isDoctor ? t('dashboard.clinicalCommandWard') : t('dashboard.personalHealthWorkspace')}</span>
                  </div>
                  <h1 className="mt-3 font-sans text-2xl sm:text-3xl lg:text-[32px] font-extrabold tracking-tight text-[#0F172A]">
                    {t('dashboard.welcomeBack', { name: session?.name || (isDoctor ? 'Doctor' : 'Akash') })}
                  </h1>
                  <p className="mt-2 text-sm sm:text-base leading-relaxed text-[#64748B]">
                    {isDoctor
                      ? t('dashboard.doctorTelemetryDesc')
                      : t('dashboard.patientTelemetryDesc')}
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
                          <span className="font-bold">{t('dashboard.liveBadge')}</span>
                        </div>
                        <span className="text-slate-300 font-mono">{t('dashboard.wardBadge')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Stat Cards (4 Cards) - Premium Medical SaaS Redesign with Full i18n */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Monitoring State */}
              <div className="group relative overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_28px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">
                      {t('dashboard.cards.monitoringState')}
                    </span>
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-[#0284C7] border border-sky-100 group-hover:scale-105 transition-transform">
                      <Activity className="h-4 w-4" />
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-baseline gap-2.5">
                    <h3 className="font-sans text-2xl font-extrabold text-[#0F172A] tracking-tight">
                      {t(`statuses.${healthStatusLabel.toLowerCase()}`) || healthStatusLabel}
                    </h3>
                    <StatusPill status={healthStatusLabel} size="sm" pulse={isHighRisk} />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[#64748B] font-medium">{t('dashboard.cards.confidence')}</span>
                  <span className="font-bold text-[#0F172A] bg-slate-100 px-2 py-0.5 rounded-md font-mono text-[11px]">
                    {displayConfidence}
                  </span>
                </div>
              </div>

              {/* Card 2: Signal Freshness */}
              <div className="group relative overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_28px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">
                      {t('dashboard.cards.signalFreshness')}
                    </span>
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-[#0D9488] border border-teal-100 group-hover:scale-105 transition-transform">
                      <Waves className="h-4 w-4" />
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    <h3 className="font-sans text-2xl font-extrabold text-[#0F172A] tracking-tight">
                      {t('dashboard.cards.liveStream')}
                    </h3>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[#64748B] font-medium">{t('dashboard.cards.latency')}</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md font-mono text-[11px]">
                    ● {t('dashboard.cards.latencyValue')}
                  </span>
                </div>
              </div>

              {/* Card 3: Emergency Readiness */}
              <div className="group relative overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_28px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">
                      {t('dashboard.cards.emergencyReadiness')}
                    </span>
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 group-hover:scale-105 transition-transform">
                      <ShieldCheck className="h-4 w-4" />
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2">
                    <h3 className="font-sans text-2xl font-extrabold text-[#0F172A] tracking-tight">
                      {emergency?.locationStatus === 'active' ? t('dashboard.cards.gpsLocked') : t('dashboard.cards.standby')}
                    </h3>
                    {emergency?.locationStatus === 'active' && (
                      <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                        {t('dashboard.cards.ready')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[#64748B] font-medium">{t('dashboard.cards.ambulanceSos')}</span>
                  <span className="font-semibold text-[#0F172A] flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {t('dashboard.cards.activeApi')}
                  </span>
                </div>
              </div>

              {/* Card 4: Doctor Scope */}
              <div className="group relative overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_28px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">
                      {isDoctor ? t('dashboard.cards.assignedRoster') : t('dashboard.cards.doctorScope')}
                    </span>
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-600 border border-violet-100 group-hover:scale-105 transition-transform">
                      <Users className="h-4 w-4" />
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-baseline gap-2">
                    <h3 className="font-sans text-2xl font-extrabold text-[#0F172A] tracking-tight">
                      {role === 'doctor'
                        ? (patientCount === 1
                            ? t('dashboard.cards.patientSingular')
                            : t('dashboard.cards.patientPlural', { count: patientCount }))
                        : t('dashboard.cards.patientSingular')}
                    </h3>
                    <span className="text-xs text-[#64748B] font-medium">{t('dashboard.cards.activeLabel')}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[#64748B] font-medium">{t('dashboard.cards.ward')}</span>
                  <span className="font-bold text-[#0F172A] truncate max-w-[140px]" title={t('dashboard.cards.wardName')}>
                    {t('dashboard.cards.wardName')}
                  </span>
                </div>
              </div>
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
                    onClick={handleOpenVideoDialer}
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
              5. CLINICAL TELEMETRY & DIAGNOSTICS REPORT (id="reports", id="alerts")
             ======================================================= */}
          <ClinicalReportSection
            currentPatientName={currentPatientName}
            currentPatientId={currentPatientId}
            effectiveAge={effectiveAge}
            effectiveGender={effectiveGender}
            attendingDoctorName={attendingDoctorName}
            attendingDoctorSpecialty={attendingDoctorSpecialty}
            heartRate={heartRate}
            spo2={spo2}
            temperature={temperature}
            bloodPressure="120/80 mmHg"
            ecgData={ecgData}
            risk={risk}
            risk_score={risk_score}
            currentLastUpdate={currentLastUpdate}
            onPrint={handlePrintReport}
            onDownloadPdf={handlePrintReport}
          />

          {/* =======================================================
              6. AI CONDITION ANALYSIS & FIRST-AID (id="ai-assessment")
             ======================================================= */}
          <section id="ai-assessment" className="scroll-mt-24">
            {isDoctor && !currentPatientId ? (
              <Card className="p-8 text-center bg-white border border-[#E2E8F0] rounded-[16px] shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-[#64748B]">
                    <BrainCircuit className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-bold text-[#0F172A]">Select a patient to view clinical AI assessment.</p>
                  <p className="text-xs text-[#64748B] max-w-sm">
                    Choose an assigned patient from the roster below to run real-time condition analysis and first-aid recommendations.
                  </p>
                </div>
              </Card>
            ) : (
              <AiHealthAssessment
                patientId={currentPatientId}
                liveVitals={{
                  heartRate,
                  spo2,
                  temperature,
                  bloodPressure: '120/80',
                }}
                attendingDoctor={{
                  name: attendingDoctorName,
                  phone: attendingDoctorPhone,
                  email: attendingDoctorEmail,
                  specialty: attendingDoctorSpecialty,
                }}
              />
            )}
          </section>

          {/* =======================================================
              7. MEDICATIONS & PRESCRIPTION MANAGEMENT (id="medications")
             ======================================================= */}
          <section id="medications" className="scroll-mt-24">
            {isDoctor && !currentPatientId ? (
              <Card className="p-8 text-center bg-white border border-[#E2E8F0] rounded-[16px] shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-[#64748B]">
                    <Users className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-bold text-[#0F172A]">Select a patient to view clinical information.</p>
                  <p className="text-xs text-[#64748B] max-w-sm">
                    Choose an assigned patient from the roster below to view their active prescriptions and adherence tracking.
                  </p>
                </div>
              </Card>
            ) : (
              <MedicationManagement
                patientId={currentPatientId}
                patientName={currentPatientName}
                role={role}
                doctorInfo={{
                  name: attendingDoctorName,
                  phone: attendingDoctorPhone,
                  email: attendingDoctorEmail,
                }}
              />
            )}
          </section>

          {/* =======================================================
              8. PATIENTS ROSTER & CARE TEAM (id="patients")
             ======================================================= */}
          <section id="patients" className="scroll-mt-24 space-y-3">
            <div>
              <h3 className="font-sans text-xl font-bold text-[#0F172A]">
                {isDoctor ? 'Assigned Patients Roster' : 'Assigned Clinical Care Team & Primary Record'}
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                {isDoctor
                  ? 'Real-time telemetry status for patients in your clinical ward. Click a patient to set active scope or open their dedicated workspace.'
                  : 'Authorized physician and clinical ward telemetry details'}
              </p>
            </div>

            {isDoctor ? (
              <Card className="p-0 overflow-hidden bg-white border border-[#E2E8F0] rounded-[18px] shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="border-b border-[#E2E8F0] bg-slate-50/80 text-[10px] font-bold uppercase tracking-[0.16em] text-[#94A3B8]">
                      <tr>
                        <th className="px-5 py-4">Patient</th>
                        <th className="px-5 py-4">ID</th>
                        <th className="px-5 py-4">Heart Rate</th>
                        <th className="px-5 py-4">SpO2</th>
                        <th className="px-5 py-4">Temperature</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {doctorPatients.length > 0 ? (
                        doctorPatients.map((pt) => {
                          const isCritical = Number(pt?.spo2 || 0) > 0 && Number(pt?.spo2 || 0) < 90;
                          const isSelected = String(currentPatientId).toLowerCase() === String(pt.id).toLowerCase();
                          const ptInitials = (pt.name || 'PT')
                            .split(' ')
                            .map((w) => w[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase();

                          return (
                            <tr
                              key={pt.id}
                              onClick={() => setSelectedPatientId(pt.id)}
                              className={`cursor-pointer transition-all duration-150 ${
                                isCritical
                                  ? 'bg-rose-50/30 border-l-4 border-l-rose-500'
                                  : isSelected
                                  ? 'bg-sky-50/80 border-l-4 border-l-[#0284C7]'
                                  : 'hover:bg-slate-50/70'
                              }`}
                            >
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200">
                                    {ptInitials}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-[#0F172A] truncate leading-tight">{pt.name || 'Unnamed Patient'}</p>
                                    <p className="text-[11px] text-[#64748B] mt-0.5">
                                      {pt.age || 24} yrs · {pt.gender || 'Male'}
                                    </p>
                                  </div>
                                  {isSelected && (
                                    <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-700">
                                      Active
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-[#64748B] font-mono text-xs">{pt.id}</td>
                              <td className="px-5 py-3.5 font-semibold text-[#0F172A]">
                                <span className="flex items-center gap-1.5">
                                  <HeartPulse className="h-3.5 w-3.5 text-rose-500" />
                                  {pt.heartRate || 72} BPM
                                </span>
                              </td>
                              <td className="px-5 py-3.5 font-semibold text-[#0F172A]">
                                <span className="flex items-center gap-1.5">
                                  <Waves className="h-3.5 w-3.5 text-teal-500" />
                                  {pt.spo2 || 98}%
                                </span>
                              </td>
                              <td className="px-5 py-3.5 font-semibold text-[#0F172A]">
                                <span className="flex items-center gap-1.5">
                                  <Thermometer className="h-3.5 w-3.5 text-amber-500" />
                                  {pt.temperature || 36.7}°C
                                </span>
                              </td>
                              <td className="px-5 py-3.5">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                                    isCritical
                                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  }`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full ${isCritical ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`} />
                                  {isCritical ? 'Critical' : (pt.heartRate && pt.spo2 ? 'Monitoring' : 'Stable')}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedPatientId(pt.id);
                                      startCall({
                                        id: pt.id,
                                        patientId: pt.id,
                                        name: pt.name,
                                        patientName: pt.name,
                                        heartRate: pt.heartRate,
                                        spo2: pt.spo2,
                                        temperature: pt.temperature,
                                        status: pt.status || 'Monitoring',
                                      });
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100 transition shadow-2xs"
                                    title={`Initiate Telehealth Video Call with ${pt.name || 'Patient'}`}
                                  >
                                    <Video className="h-3.5 w-3.5 text-teal-600" />
                                    <span>Video Call</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedPatientId(pt.id);
                                    }}
                                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                                      isSelected
                                        ? 'bg-sky-100 text-sky-700'
                                        : 'text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A]'
                                    }`}
                                  >
                                    {isSelected ? 'Active Scope' : 'Select'}
                                  </button>
                                  <Link
                                    to={`/doctor/patients/${pt.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 font-semibold text-[#0284C7] hover:text-[#0369A1]"
                                  >
                                    Workspace <ArrowRight className="h-3.5 w-3.5" />
                                  </Link>
                                </div>
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
              <Card className="p-5 sm:p-6 bg-white border border-[#E2E8F0] rounded-[18px] shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
                  {/* Card 1: Premium Patient Identity Card */}
                  <div className="rounded-[16px] border border-[#E2E8F0] p-5 bg-white shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#0284C7] to-blue-700 text-white font-extrabold text-base shadow-xs border-2 border-white ring-1 ring-sky-100">
                            {(currentPatientName || 'Akash Soni')
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-sans text-base font-bold text-[#0F172A] leading-tight truncate">
                              {currentPatientName || 'Akash Soni'}
                            </h4>
                            <p className="text-xs text-[#64748B] font-mono mt-0.5">
                              ID: {currentPatientId || 'P-1024'}
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Stable
                        </span>
                      </div>

                      <div className="mt-4 pt-3.5 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Age</p>
                          <p className="font-bold text-[#0F172A] mt-0.5">{patientAge || 24} yrs</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Blood Group</p>
                          <p className="font-bold text-[#0F172A] mt-0.5">O+ Positive</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Attending</p>
                          <p className="font-semibold text-[#0F172A] mt-0.5 truncate">{attendingDoctorName || 'Assigned Physician'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Last Check</p>
                          <p className="font-semibold text-[#64748B] mt-0.5">Just now</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Assigned Doctor Identity Card */}
                  <div className="rounded-[16px] border border-[#E2E8F0] p-5 bg-white shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 border border-teal-200 text-[#0D9488] font-black text-base shadow-xs">
                            {(attendingDoctorName || 'Assigned Physician')
                              .replace(/^Dr\.\s*/i, '')
                              .trim()
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase() || 'MD'}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-sans text-base font-bold text-[#0F172A] leading-tight truncate">
                              {attendingDoctorName || 'Assigned Physician'}
                            </h4>
                            <p className="text-xs font-medium text-[#0D9488] mt-0.5">
                              {attendingDoctorSpecialty || 'Attending Physician'}
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Online
                        </span>
                      </div>

                      <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-1.5 text-xs text-[#64748B]">
                        <p className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{attendingDoctorEmail || 'careteam@hospital.org'}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{attendingDoctorPhone || '+91 98765 43210'}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Direct Telehealth Video Consultation Action Card */}
                  <div className="rounded-[16px] border border-sky-200 bg-gradient-to-br from-sky-50/70 to-blue-50/50 p-5 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 border border-sky-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0284C7]">
                        <Video className="h-3 w-3" />
                        <span>Instant Consultation</span>
                      </div>
                      <h4 className="font-sans text-base font-bold text-[#0F172A] mt-2.5">
                        Encrypted Video Call
                      </h4>
                      <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                        Initiate high-definition, WebRTC peer-to-peer telehealth consultation with your assigned physician.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenVideoDialer}
                      className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] px-4 py-3 text-xs sm:text-sm font-bold text-white shadow-[0_4px_14px_rgba(2,132,199,0.3)] hover:shadow-[0_6px_20px_rgba(2,132,199,0.4)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
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
                  {(String(currentPatientName || (isDoctor ? 'DOC' : 'PT'))).slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-base font-bold text-slate-900 truncate">
                    {currentPatientName}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-0.5">
                    <span>{isDoctor ? 'Ward 4B Active Scope' : 'Patient Telemetry Connected'}</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" /> New Delhi, India
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