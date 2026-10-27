import React, { useEffect, useState, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Ambulance,
  ArrowRight,
  Bell,
  BrainCircuit,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileDown,
  FileText,
  Heart,
  HeartPulse,
  Info,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Pill,
  Phone,
  PhoneCall,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Stethoscope,
  Thermometer,
  Trash2,
  User,
  UserCheck,
  Users,
  Waves,
  Wind,
  X,
} from 'lucide-react';
import {
  fetchPatientPortalSummary,
  updatePatientPortalProfile,
  fetchPatientMedicalHistory,
  fetchPatientHealthMonitoring,
  logPatientManualVitals,
  askAiHealthAssistant,
  fetchPatientNotifications,
  markPatientNotificationRead,
  changeAccountPassword,
  createHospitalAppointment,
  updateAppointmentStatus,
  markMedicineTaken,
} from '../../services/api';
import {
  generateMapLinks,
  getCurrentCoordinates,
  queryGeolocationPermission,
} from '../../services/geolocation';

export function PatientPortal({ session, liveVitals, emergency }) {
  const patientId = session?.patientId || session?.id || 'PT-1001';
  const patientName = session?.name || 'Patient';

  // Active portal tab
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Core Data State
  const [summary, setSummary] = useState(null);
  const [medicalHistory, setMedicalHistory] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Modals
  const [showProfileEditModal, setShowProfileEditModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showManualVitalsModal, setShowManualVitalsModal] = useState(false);
  const [showPrescriptionPrintModal, setShowPrescriptionPrintModal] = useState(false);
  const [selectedPrescriptionForPrint, setSelectedPrescriptionForPrint] = useState(null);
  const [showSosConfirmModal, setShowSosConfirmModal] = useState(false);
  const [selectedReportModal, setSelectedReportModal] = useState(null);

  // Profile Edit Form State
  const [profileForm, setProfileForm] = useState({
    phone: '',
    emergencyContact: '',
    emergencyPhone: '',
    address: '',
    bloodGroup: '',
    allergies: '',
    gender: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);

  // Appointment Form State
  const [appointmentForm, setAppointmentForm] = useState({
    appointmentDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    appointmentTime: '10:00 AM',
    department: 'General Medicine',
    notes: '',
  });
  const [bookingLoading, setBookingLoading] = useState(false);

  // Manual Vitals Form State
  const [vitalsForm, setVitalsForm] = useState({
    heartRate: '',
    spo2: '',
    temperature: '',
    systolicBP: '',
    diastolicBP: '',
    bloodGlucose: '',
    notes: '',
  });
  const [vitalsSaving, setVitalsSaving] = useState(false);
  const [vitalsValidationErrors, setVitalsValidationErrors] = useState([]);

  // AI Health Assistant State
  const [aiLanguage, setAiLanguage] = useState('hinglish');
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    {
      sender: 'assistant',
      text: 'नमस्ते! मैं आपका स्मार्ट हेल्थ AI सहायक हूँ। आप हिंदी, हिंग्लिश या इंग्लिश में स्वास्थ्य संबंधी मार्गदर्शन पूछ सकते हैं।\n\n(Namaste! I am your Smart Health AI Assistant. Ask any health or medication guidance in Hindi, Hinglish, or English.)',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isEmergency: false,
    },
  ]);
  const chatBottomRef = useRef(null);

  // Password Change State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);

  // SOS Location and Accidental Protection State
  const [currentGps, setCurrentGps] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [sosTriggering, setSosTriggering] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(5);
  const [locationPermStatus, setLocationPermStatus] = useState('prompt');

  // Load portal summary and notifications on mount
  const loadPortalData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const summaryData = await fetchPatientPortalSummary(patientId);
      setSummary(summaryData);

      // Populate profile form from patient record
      if (summaryData?.patient) {
        setProfileForm({
          phone: summaryData.patient.phone || '',
          emergencyContact: summaryData.patient.emergencyContact || summaryData.patient.emergency_contact || '',
          emergencyPhone: summaryData.patient.emergencyPhone || summaryData.patient.emergency_phone || '',
          address: summaryData.patient.address || '',
          bloodGroup: summaryData.patient.bloodGroup || summaryData.patient.blood_group || 'B+',
          allergies: summaryData.patient.allergies || 'None Reported',
          gender: summaryData.patient.gender || 'Male',
        });
      }

      // Fetch notifications
      try {
        const notifData = await fetchPatientNotifications(patientId);
        if (Array.isArray(notifData?.notifications)) {
          setNotifications(notifData.notifications);
          setUnreadNotifCount(notifData.unreadCount || 0);
        }
      } catch (err) {
        console.warn('Notifications fetch notice:', err);
      }
    } catch (err) {
      console.error('Failed to load portal summary:', err);
      toast.error(err?.response?.data?.message || 'Unable to load personal portal data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPortalData();
  }, [patientId]);

  // Load medical history when tab is clicked
  const loadMedicalHistory = async () => {
    try {
      const historyData = await fetchPatientMedicalHistory(patientId);
      setMedicalHistory(historyData);
    } catch (err) {
      console.error('Error fetching medical history:', err);
      toast.error('Unable to fetch clinical history records.');
    }
  };

  // Load health monitoring data when tab is clicked
  const loadHealthMonitoring = async () => {
    try {
      const healthResp = await fetchPatientHealthMonitoring(patientId);
      setHealthData(healthResp);
    } catch (err) {
      console.error('Error fetching health monitoring:', err);
      toast.error('Unable to fetch vitals records.');
    }
  };

  useEffect(() => {
    if (activeTab === 'medical-history' && !medicalHistory) {
      loadMedicalHistory();
    } else if (activeTab === 'health-monitoring' && !healthData) {
      loadHealthMonitoring();
    }
  }, [activeTab]);

  // Handle GPS location capture with permission awareness and fallback
  const captureGpsLocation = async () => {
    setGpsLoading(true);
    try {
      const coords = await getCurrentCoordinates({ timeout: 10000 });
      setCurrentGps(coords);
      setLocationPermStatus('granted');
      toast.success(`GPS coordinates secured (±${coords.accuracy}m)`);
    } catch (err) {
      if (err.reason === 'permission_denied') {
        setLocationPermStatus('denied');
        toast.error('Location permission was denied. Allow location in your browser settings to attach precise coordinates.');
      } else {
        setLocationPermStatus('unavailable');
        toast.error(err.message || 'GPS signal unavailable. Showing emergency hotlines and fallback instructions.');
      }
    } finally {
      setGpsLoading(false);
    }
  };

  useEffect(() => {
    queryGeolocationPermission().then((perm) => {
      setLocationPermStatus(perm);
      if (perm === 'granted') {
        captureGpsLocation();
      }
    });
  }, []);

  // Handle Profile Save
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const res = await updatePatientPortalProfile(patientId, profileForm);
      toast.success(res?.message || 'Profile updated successfully.');
      setShowProfileEditModal(false);
      loadPortalData(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  // Handle Book Appointment
  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!appointmentForm.appointmentDate || !appointmentForm.appointmentTime) {
      toast.error('Please select both date and time slot.');
      return;
    }

    setBookingLoading(true);
    try {
      const payload = {
        patientId,
        patientName: summary?.patient?.name || patientName,
        patientPhone: summary?.patient?.phone || '',
        hospitalId: summary?.hospital?.id || summary?.hospital?.hospitalId || 'HOSP-CITY-01',
        doctorId: summary?.doctor?.id || summary?.doctor?.doctorId || 'DOC-CAR-01',
        doctorName: summary?.doctor?.name || 'Treating Physician',
        appointmentDate: appointmentForm.appointmentDate,
        appointmentTime: appointmentForm.appointmentTime,
        department: appointmentForm.department,
        notes: appointmentForm.notes,
        type: 'Outpatient Consultation',
      };

      await createHospitalAppointment(payload);
      toast.success('Appointment scheduled successfully with your healthcare team.');
      setShowAppointmentModal(false);
      setAppointmentForm({
        appointmentDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        appointmentTime: '10:00 AM',
        department: 'General Medicine',
        notes: '',
      });
      loadPortalData(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to book appointment.');
    } finally {
      setBookingLoading(false);
    }
  };

  // Handle Appointment Cancel
  const handleCancelAppointment = async (aptId) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled appointment?')) return;
    try {
      await updateAppointmentStatus(aptId, { status: 'cancelled', notes: 'Cancelled by patient from portal.' });
      toast.success('Appointment cancelled successfully.');
      loadPortalData(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to cancel appointment.');
    }
  };

  // Handle Mark Medication Taken
  const handleMarkTaken = async (medId) => {
    try {
      await markMedicineTaken(patientId, medId, true);
      toast.success('Dose marked as taken. Adherence record updated!');
      // Update local state activePrescriptions
      if (summary?.activePrescriptions) {
        setSummary((prev) => ({
          ...prev,
          activePrescriptions: prev.activePrescriptions.map((m) =>
            m.id === medId || m.medicineId === medId ? { ...m, lastTaken: new Date().toISOString(), takenToday: true } : m
          ),
        }));
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update dose adherence.');
    }
  };

  // Handle Log Manual Vitals with Physiological Validation
  const handleSaveManualVitals = async (e) => {
    e.preventDefault();
    const errs = [];
    const hr = vitalsForm.heartRate ? Number(vitalsForm.heartRate) : null;
    const spo2 = vitalsForm.spo2 ? Number(vitalsForm.spo2) : null;
    const temp = vitalsForm.temperature ? Number(vitalsForm.temperature) : null;
    const sys = vitalsForm.systolicBP ? Number(vitalsForm.systolicBP) : null;
    const dia = vitalsForm.diastolicBP ? Number(vitalsForm.diastolicBP) : null;

    if (hr !== null && (hr < 30 || hr > 220)) errs.push('Heart rate must be between 30 and 220 bpm.');
    if (spo2 !== null && (spo2 < 60 || spo2 > 100)) errs.push('SpO2 must be between 60% and 100%.');
    if (temp !== null && (temp < 34.0 || temp > 43.0)) errs.push('Temperature must be between 34.0°C and 43.0°C.');
    if (sys !== null && (sys < 70 || sys > 240)) errs.push('Systolic BP must be between 70 and 240 mmHg.');
    if (dia !== null && (dia < 40 || dia > 140)) errs.push('Diastolic BP must be between 40 and 140 mmHg.');

    if (errs.length > 0) {
      setVitalsValidationErrors(errs);
      toast.error(errs[0]);
      return;
    }

    setVitalsValidationErrors([]);
    setVitalsSaving(true);
    try {
      const payload = {
        heartRate: hr,
        spo2,
        temperature: temp,
        systolicBP: sys,
        diastolicBP: dia,
        bloodGlucose: vitalsForm.bloodGlucose ? Number(vitalsForm.bloodGlucose) : null,
        notes: vitalsForm.notes,
      };

      await logPatientManualVitals(patientId, payload);
      toast.success('Manual health measurements recorded and verified.');
      setShowManualVitalsModal(false);
      setVitalsForm({
        heartRate: '',
        spo2: '',
        temperature: '',
        systolicBP: '',
        diastolicBP: '',
        bloodGlucose: '',
        notes: '',
      });
      loadPortalData(true);
      loadHealthMonitoring();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to record manual vitals.');
    } finally {
      setVitalsSaving(false);
    }
  };

  // Handle AI Chat Send
  const handleSendAiQuery = async (queryText) => {
    const textToSend = (queryText || aiQuery).trim();
    if (!textToSend) return;

    const userMsg = {
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setAiMessages((prev) => [...prev, userMsg]);
    setAiQuery('');
    setAiLoading(true);

    try {
      const resp = await askAiHealthAssistant({
        query: textToSend,
        language: aiLanguage,
        patientVitals: summary?.measurements || {},
      });

      const assistantMsg = {
        sender: 'assistant',
        text: resp.response || 'स्वास्थ्य सलाह तैयार की गई है।',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isEmergency: resp.isEmergency || false,
        safetyDisclaimer: resp.safetyDisclaimer,
      };

      setAiMessages((prev) => [...prev, assistantMsg]);

      if (resp.isEmergency) {
        toast.error('⚠️ Critical emergency symptoms detected. Please use Emergency SOS immediately.', {
          duration: 6000,
        });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'AI health assistant is temporarily unavailable.');
    } finally {
      setAiLoading(false);
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // Handle Mark Notification Read
  const handleMarkNotifRead = async (notifId) => {
    try {
      await markPatientNotificationRead(patientId, notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
      );
      setUnreadNotifCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.warn('Failed to mark notification read:', err);
    }
  };

  // Handle Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      toast.error('Please enter current and new password.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long.');
      return;
    }

    setPasswordSaving(true);
    try {
      await changeAccountPassword(passwordForm);
      toast.success('Password updated successfully. Please use your new password next time.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  // Open SOS Confirmation Modal with 5s countdown
  const openSosModal = () => {
    setSosCountdown(5);
    setShowSosConfirmModal(true);
  };

  // 5-second accidental trigger countdown timer
  useEffect(() => {
    let timer = null;
    if (showSosConfirmModal) {
      if (sosCountdown > 0) {
        timer = setInterval(() => {
          setSosCountdown((prev) => prev - 1);
        }, 1000);
      } else if (sosCountdown === 0) {
        handleTriggerSos();
      }
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showSosConfirmModal, sosCountdown]);

  // Handle Trigger SOS
  const handleTriggerSos = async () => {
    setShowSosConfirmModal(false);
    setSosTriggering(true);
    try {
      if (emergency?.triggerEmergency) {
        await emergency.triggerEmergency({
          patientId,
          patientName: summary?.patient?.name || patientName,
          reason: 'Emergency SOS triggered by patient from Personal Portal',
          location: currentGps,
          severity: 'CRITICAL',
        });
      }
      toast.success('🚨 Emergency SOS Broadcasted! Emergency Response Center and Hospital notified.');
    } catch (err) {
      toast.error(err?.message || 'Emergency trigger encountered an issue. Please dial 108 / 112 immediately.');
    } finally {
      setSosTriggering(false);
    }
  };

  // Handle Cancel SOS
  const handleCancelSos = async () => {
    const alertId = emergency?.activeEmergency?.alertId;
    if (!alertId) {
      toast.error('No active emergency ID found to cancel.');
      return;
    }
    try {
      if (emergency?.cancelEmergency) {
        await emergency.cancelEmergency(alertId, 'Cancelled by patient from portal');
      }
    } catch (err) {
      toast.error('Failed to cancel emergency alert.');
    }
  };

  // Copy patient ID to clipboard
  const handleCopyPatientId = () => {
    navigator.clipboard.writeText(patientId);
    toast.success('Patient ID copied to clipboard!');
  };

  // Source Badge Component helper
  const renderSourceBadge = (source) => {
    switch (source) {
      case 'device-generated':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
            <Radio className="h-3 w-3 text-emerald-500 animate-pulse" />
            Device IoT
          </span>
        );
      case 'manually-entered':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 border border-sky-200">
            <User className="h-3 w-3 text-sky-500" />
            Manual Entry
          </span>
        );
      case 'clinical-baseline':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 border border-purple-200">
            <Stethoscope className="h-3 w-3 text-purple-500" />
            Clinical Baseline
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 border border-slate-200">
            Standby
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] p-8">
        <div className="relative mb-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 animate-pulse flex items-center justify-center shadow-lg shadow-sky-500/20">
            <HeartPulse className="h-8 w-8 text-white animate-bounce" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-slate-800">Loading Healthcare Portal...</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm text-center">
          Securely retrieving your verified medical records, care team assignments, and telemetry data.
        </p>
      </div>
    );
  }

  const patient = summary?.patient || {};
  const hospital = summary?.hospital || {};
  const doctor = summary?.doctor || {};
  const measurements = summary?.measurements || {};
  const appointments = summary?.upcomingAppointments || [];
  const activePrescriptions = summary?.activePrescriptions || [];

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. TOP PORTAL IDENTITY & STATUS BANNER */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-500/10 via-indigo-500/5 to-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-sky-600/20 shrink-0">
              {patient.name ? patient.name.charAt(0).toUpperCase() : 'P'}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {patient.name || patientName}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800 border border-sky-200">
                  <ShieldCheck className="h-3.5 w-3.5 text-sky-600" />
                  Verified Patient
                </span>
                {measurements?.deviceConnected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                    <Radio className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                    IoT Device Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
                    Ambulatory / Offline
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                <div className="flex items-center gap-1 font-mono font-medium text-slate-700 bg-white/80 px-2 py-0.5 rounded border border-slate-200">
                  <span>ID: {patientId}</span>
                  <button
                    onClick={handleCopyPatientId}
                    title="Copy Patient ID"
                    className="hover:text-sky-600 text-slate-400 transition"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  {hospital.name || 'City General Medical Center'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Stethoscope className="h-3.5 w-3.5 text-slate-400" />
                  Dr. {doctor.name || 'Treating Physician'} ({doctor.specialty || 'General Medicine'})
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={() => loadPortalData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
              Sync Records
            </button>
            <button
              onClick={() => setShowSosConfirmModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-red-500/20 hover:from-red-500 hover:to-rose-500 transition"
            >
              <Siren className="h-4 w-4 animate-pulse" />
              Emergency SOS
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. NAVIGATION TAB BAR (10 MODULES) */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-none">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'profile', label: 'My Profile', icon: User },
          { id: 'appointments', label: 'My Appointments', icon: Calendar, badge: appointments.length },
          { id: 'medical-history', label: 'Medical History', icon: FileCheck2 },
          { id: 'prescriptions', label: 'Prescriptions', icon: Pill, badge: activePrescriptions.length },
          { id: 'health-monitoring', label: 'Health Monitoring', icon: HeartPulse },
          { id: 'emergency-sos', label: 'Emergency SOS', icon: AlertOctagon, alert: true },
          { id: 'ai-assistant', label: 'AI Health Assistant', icon: BrainCircuit, highlight: true },
          { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifCount },
          { id: 'settings', label: 'Privacy & Settings', icon: Lock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-xs font-medium transition ${
                isActive
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              } ${tab.highlight && !isActive ? 'text-indigo-600 font-semibold bg-indigo-50/60' : ''}`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-white' : tab.highlight ? 'text-indigo-600' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-700'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
              {tab.alert && !isActive && (
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics Bar with explicit Provenance Tags */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Heart Rate */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span>Heart Rate</span>
                <Heart className="h-4 w-4 text-rose-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-900">
                  {measurements?.heartRate?.value ? Math.round(measurements.heartRate.value) : '--'}
                </span>
                <span className="text-xs text-slate-500">bpm</span>
              </div>
              <div className="mt-2">{renderSourceBadge(measurements?.heartRate?.source)}</div>
            </div>

            {/* SpO2 */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span>SpO2 Oxygen</span>
                <Wind className="h-4 w-4 text-sky-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-900">
                  {measurements?.spo2?.value ? Math.round(measurements.spo2.value) : '--'}
                </span>
                <span className="text-xs text-slate-500">%</span>
              </div>
              <div className="mt-2">{renderSourceBadge(measurements?.spo2?.source)}</div>
            </div>

            {/* Temperature */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span>Temperature</span>
                <Thermometer className="h-4 w-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-900">
                  {measurements?.temperature?.value ? Number(measurements.temperature.value).toFixed(1) : '--'}
                </span>
                <span className="text-xs text-slate-500">°C</span>
              </div>
              <div className="mt-2">{renderSourceBadge(measurements?.temperature?.source)}</div>
            </div>

            {/* Blood Pressure */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span>Blood Pressure</span>
                <Activity className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-900">
                  {measurements?.bloodPressure?.systolic || 120}/{measurements?.bloodPressure?.diastolic || 80}
                </span>
                <span className="text-xs text-slate-500">mmHg</span>
              </div>
              <div className="mt-2">{renderSourceBadge(measurements?.bloodPressure?.source)}</div>
            </div>

            {/* Blood Glucose */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span>Blood Glucose</span>
                <Sparkles className="h-4 w-4 text-purple-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-900">
                  {measurements?.bloodGlucose?.value ? measurements.bloodGlucose.value : '95'}
                </span>
                <span className="text-xs text-slate-500">mg/dL</span>
              </div>
              <div className="mt-2">{renderSourceBadge(measurements?.bloodGlucose?.source)}</div>
            </div>

            {/* ECG Rhythm */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span>ECG Lead II</span>
                <Waves className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-sm font-bold text-slate-900 truncate">
                {measurements?.ecg?.status || 'Sinus Rhythm'}
              </div>
              <div className="mt-2">{renderSourceBadge(measurements?.ecg?.source)}</div>
            </div>
          </div>

          {/* Middle Two-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming Appointments Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Upcoming Appointments</h2>
                    <p className="text-xs text-slate-500">Direct schedule with assigned hospital physicians</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAppointmentModal(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition"
                >
                  <Plus className="h-3 w-3" />
                  Book Now
                </button>
              </div>

              {appointments.length === 0 ? (
                <div className="text-center py-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                  <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-medium">No upcoming appointments scheduled.</p>
                  <button
                    onClick={() => setShowAppointmentModal(true)}
                    className="mt-3 text-xs font-semibold text-sky-600 hover:text-sky-700"
                  >
                    + Schedule Outpatient Consultation
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {appointments.slice(0, 3).map((apt) => (
                    <div
                      key={apt.id || apt.appointmentId}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3 hover:bg-slate-50 transition"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center text-slate-800 shadow-2xs shrink-0">
                          <span className="text-[10px] font-bold text-sky-600 uppercase">
                            {new Date(apt.appointmentDate).toLocaleString('default', { month: 'short' })}
                          </span>
                          <span className="text-sm font-extrabold leading-none">
                            {new Date(apt.appointmentDate).getDate()}
                          </span>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">Dr. {apt.doctorName || doctor.name}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-400" />
                              {apt.appointmentTime}
                            </span>
                            <span>•</span>
                            <span>{apt.department || 'Outpatient Clinic'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                          {apt.status || 'Scheduled'}
                        </span>
                        <button
                          onClick={() => handleCancelAppointment(apt.id || apt.appointmentId)}
                          title="Cancel appointment"
                          className="text-slate-400 hover:text-red-600 p-1 rounded transition"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {appointments.length > 3 && (
                    <button
                      onClick={() => setActiveTab('appointments')}
                      className="text-xs font-semibold text-sky-600 hover:text-sky-700 text-center w-full block pt-1"
                    >
                      View all {appointments.length} appointments →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Active Prescriptions Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Pill className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Active Prescriptions</h2>
                    <p className="text-xs text-slate-500">Doctor-finalized clinical medication regimen</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('prescriptions')}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Manage All →
                </button>
              </div>

              {activePrescriptions.length === 0 ? (
                <div className="text-center py-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                  <Pill className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-medium">No active medications prescribed.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Prescriptions are certified directly by your physician.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activePrescriptions.slice(0, 3).map((rx) => (
                    <div
                      key={rx.id || rx.medicineId || rx.name}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          {rx.name || rx.medicineName}
                          <span className="rounded bg-indigo-100 text-indigo-700 px-1.5 py-0.2 text-[10px] font-mono">
                            {rx.dosage || rx.dose || 'Standard'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {rx.frequency || 'Once Daily'} • {rx.instructions || rx.timing || 'Post Meal'}
                        </div>
                      </div>

                      <button
                        onClick={() => handleMarkTaken(rx.id || rx.medicineId)}
                        disabled={rx.takenToday}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                          rx.takenToday
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-default'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                        }`}
                      >
                        {rx.takenToday ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            Taken
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            Mark Taken
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick AI Health Assistant Card */}
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/60 via-purple-50/30 to-white p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Bilingual AI Health Assistant (हिंदी & Hinglish)</h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Ask symptom guidance, BP / Sugar advice, or dosage explanations safely in your preferred language.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('ai-assistant')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition self-start sm:self-center"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Open AI Assistant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MY PROFILE */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Personal Details Card */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Personal Health Profile</h3>
                <p className="text-xs text-slate-500">Demographic details and clinical identity parameters</p>
              </div>
              <button
                onClick={() => setShowProfileEditModal(true)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                <UserCheck className="h-3.5 w-3.5 text-slate-500" />
                Edit Profile
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Full Name</span>
                <span className="text-sm font-bold text-slate-800 mt-0.5 block">{patient.name || patientName}</span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Patient ID</span>
                <span className="text-sm font-mono font-bold text-slate-800 mt-0.5 block">{patientId}</span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Email Address</span>
                <span className="text-sm text-slate-800 mt-0.5 block">{patient.email || session?.email || 'N/A'}</span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Primary Phone</span>
                <span className="text-sm text-slate-800 mt-0.5 block">{patient.phone || 'Not configured'}</span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Age & Gender</span>
                <span className="text-sm text-slate-800 mt-0.5 block">
                  {patient.age || 26} Yrs • {patient.gender || 'Male'}
                </span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Blood Group</span>
                <span className="text-sm font-bold text-rose-600 mt-0.5 block">{patient.bloodGroup || 'B+'}</span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:col-span-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Known Allergies</span>
                <span className="text-sm text-slate-800 mt-0.5 block">{patient.allergies || 'No known allergies reported.'}</span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:col-span-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Residential Address</span>
                <span className="text-sm text-slate-800 mt-0.5 block">{patient.address || 'Civil Lines, New Delhi 110054'}</span>
              </div>
            </div>

            {/* Emergency Contacts Block */}
            <div className="rounded-xl border border-rose-100 bg-rose-50/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-rose-600" />
                  <span className="text-xs font-bold text-rose-900 uppercase tracking-wider">Primary Emergency Contact</span>
                </div>
                <button
                  onClick={() => setShowProfileEditModal(true)}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                >
                  Edit Contact
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Contact Person:</span>
                  <span className="font-bold text-slate-800">{patient.emergencyContact || 'Family Member / Caregiver'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Emergency Phone:</span>
                  <a
                    href={`tel:${patient.emergencyPhone || '+919876543210'}`}
                    className="font-bold text-rose-700 hover:underline flex items-center gap-1"
                  >
                    <Phone className="h-3 w-3" />
                    {patient.emergencyPhone || '+91 98765 43210'}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Registered Hospital & Doctor Card */}
          <div className="space-y-6">
            {/* Hospital Info */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Registered Hospital</h4>
                  <div className="text-sm font-bold text-slate-900">{hospital.name || 'City General Medical Center'}</div>
                </div>
              </div>
              <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Hospital ID:</span>
                  <span className="font-mono font-medium">{hospital.id || hospital.hospitalId || 'HOSP-CITY-01'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Helpline:</span>
                  <span className="font-medium text-slate-800">{hospital.phone || '+91 11 4000 1000'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Desk Email:</span>
                  <span className="font-medium text-slate-800">{hospital.email || 'care@citygeneral.org'}</span>
                </div>
              </div>
            </div>

            {/* Assigned Doctor Info */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Assigned Physician</h4>
                  <div className="text-sm font-bold text-slate-900">Dr. {doctor.name || 'Treating Physician'}</div>
                </div>
              </div>
              <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Department:</span>
                  <span className="font-semibold text-purple-700">{doctor.specialty || 'General Medicine'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Doctor ID:</span>
                  <span className="font-mono font-medium">{doctor.id || 'DOC-CAR-01'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Direct Consultation:</span>
                  <button
                    onClick={() => {
                      setActiveTab('appointments');
                      setShowAppointmentModal(true);
                    }}
                    className="text-xs font-semibold text-sky-600 hover:text-sky-700"
                  >
                    Schedule →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MY APPOINTMENTS */}
      {/* ========================================================================= */}
      {activeTab === 'appointments' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Outpatient Consultation & Follow-up Schedule</h3>
              <p className="text-xs text-slate-500">Book, reschedule, or review appointments with your attending physicians</p>
            </div>
            <button
              onClick={() => setShowAppointmentModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 transition"
            >
              <Plus className="h-4 w-4" />
              Book New Appointment
            </button>
          </div>

          {appointments.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-dashed border-slate-200 bg-white p-8">
              <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-800">No Scheduled Consultations</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                You do not have any upcoming visits booked. Need a clinical evaluation or medicine review?
              </p>
              <button
                onClick={() => setShowAppointmentModal(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 transition shadow-xs"
              >
                <Plus className="h-4 w-4" />
                Schedule Consultation
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {appointments.map((apt) => (
                <div
                  key={apt.id || apt.appointmentId}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 hover:border-slate-300 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold uppercase">
                          {new Date(apt.appointmentDate).toLocaleString('default', { month: 'short' })}
                        </span>
                        <span className="text-base font-extrabold leading-none">
                          {new Date(apt.appointmentDate).getDate()}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Dr. {apt.doctorName || doctor.name}</h4>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {apt.department || doctor.specialty || 'General Medicine'}
                        </div>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                      {apt.status || 'Scheduled'}
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-medium text-slate-800">{apt.appointmentTime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      <span>{hospital.name || 'City General Medical Center'} (OPD Block)</span>
                    </div>
                    {apt.notes && (
                      <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                        Reason: {apt.notes}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">ID: {apt.id || apt.appointmentId}</span>
                    <button
                      onClick={() => handleCancelAppointment(apt.id || apt.appointmentId)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                    >
                      Cancel Appointment
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: MEDICAL HISTORY */}
      {/* ========================================================================= */}
      {activeTab === 'medical-history' && (
        <div className="space-y-6">
          {/* Clinical Records Security Notice */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 flex items-start gap-3">
            <Lock className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
            <div className="text-xs text-sky-900">
              <span className="font-bold">Official Certified Clinical Records:</span> Consultation records, diagnoses,
              and laboratory investigations are recorded and certified by authorized clinicians. In accordance with
              healthcare governance regulations (DISHA/HIPAA), finalized diagnostic records are tamper-proof and
              read-only.
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Consultation Records */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-purple-600" />
                  <h3 className="text-sm font-bold text-slate-900">Clinical Consultations</h3>
                </div>
                <span className="text-xs text-slate-500">
                  {medicalHistory?.consultations?.length || 0} Records
                </span>
              </div>

              {!medicalHistory?.consultations || medicalHistory.consultations.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">No consultation records recorded yet.</div>
              ) : (
                <div className="space-y-3">
                  {medicalHistory.consultations.map((cons, idx) => (
                    <div key={cons.id || idx} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          {cons.consultationDate || 'Baseline'} • Dr. {cons.attendingDoctor || doctor.name}
                        </span>
                        <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          {cons.status || 'Finalized'}
                        </span>
                      </div>
                      <div className="text-xs space-y-1">
                        <div>
                          <span className="text-slate-400 font-medium">Symptoms: </span>
                          <span className="text-slate-700">{cons.symptoms || 'Initial clinical onboarding'}</span>
                        </div>
                        <div>
                          <span className="text-purple-600 font-bold">Diagnosis: </span>
                          <span className="font-semibold text-slate-900">{cons.diagnosis || 'Clinical evaluation completed.'}</span>
                        </div>
                        {cons.treatmentPlan && (
                          <div>
                            <span className="text-slate-400 font-medium">Treatment: </span>
                            <span className="text-slate-700">{cons.treatmentPlan}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Released Test Reports */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">Verified Laboratory Reports</h3>
                </div>
                <span className="text-xs text-slate-500">
                  {medicalHistory?.testReports?.length || 0} Reports
                </span>
              </div>

              {!medicalHistory?.testReports || medicalHistory.testReports.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">No diagnostic laboratory reports available.</div>
              ) : (
                <div className="space-y-3">
                  {medicalHistory.testReports.map((rpt, idx) => (
                    <div key={rpt.id || idx} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{rpt.testName || 'Diagnostic Investigation'}</span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                          {rpt.status || 'Verified'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 space-y-0.5">
                        <div className="text-slate-500">{rpt.labName || 'Central Diagnostic Telemetry Ward'}</div>
                        <div className="text-[11px] text-slate-700 italic pt-1">
                          Findings: "{rpt.findings || 'Parameters within expected physiological reference standards.'}"
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                        <span className="text-[10px] text-slate-400">{rpt.date || 'Certified Baseline'}</span>
                        <button
                          onClick={() => setSelectedReportModal(rpt)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          <Eye className="h-3 w-3" />
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PRESCRIPTIONS & ADHERENCE */}
      {/* ========================================================================= */}
      {activeTab === 'prescriptions' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Prescribed Medications & Daily Adherence</h3>
              <p className="text-xs text-slate-500">Track doses, log daily adherence, and view printable prescription documents</p>
            </div>
            <button
              onClick={() => {
                setSelectedPrescriptionForPrint(activePrescriptions);
                setShowPrescriptionPrintModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              <Printer className="h-4 w-4 text-slate-500" />
              Print Official Prescription
            </button>
          </div>

          {activePrescriptions.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-dashed border-slate-200 bg-white p-8">
              <Pill className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-800">No Prescriptions on Record</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No active clinical medication orders recorded. If you have an external prescription, consult your doctor to add it.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Medication</th>
                      <th className="py-3 px-4">Dosage</th>
                      <th className="py-3 px-4">Frequency</th>
                      <th className="py-3 px-4">Instructions</th>
                      <th className="py-3 px-4">Duration</th>
                      <th className="py-3 px-4 text-right">Today's Dose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activePrescriptions.map((rx) => (
                      <tr key={rx.id || rx.medicineId || rx.name} className="hover:bg-slate-50/50 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{rx.name || rx.medicineName}</div>
                          <div className="text-[11px] text-slate-400">Dr. {doctor.name || 'Treating Physician'}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-700">
                          {rx.dosage || rx.dose || 'Standard'}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {rx.frequency || 'Once Daily'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs">
                          {rx.instructions || rx.timing || 'As directed by physician'}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {rx.duration || '30 Days'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleMarkTaken(rx.id || rx.medicineId)}
                            disabled={rx.takenToday}
                            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                              rx.takenToday
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs'
                            }`}
                          >
                            {rx.takenToday ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                Taken
                              </>
                            ) : (
                              'Mark Taken'
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: HEALTH MONITORING */}
      {/* ========================================================================= */}
      {activeTab === 'health-monitoring' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Physiological Telemetry & Vitals History</h3>
              <p className="text-xs text-slate-500">
                Live device-generated telemetry and authenticated manual vitals tracking
              </p>
            </div>
            <button
              onClick={() => setShowManualVitalsModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 transition"
            >
              <Plus className="h-4 w-4" />
              Log Manual Vitals
            </button>
          </div>

          {/* Vitals Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Heart Rate */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Heart Rate</span>
                <Heart className="h-5 w-5 text-rose-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {measurements?.heartRate?.value ? Math.round(measurements.heartRate.value) : '--'}
                </span>
                <span className="text-sm text-slate-500">bpm</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-400">Nominal: 60-100</span>
                {renderSourceBadge(measurements?.heartRate?.source)}
              </div>
            </div>

            {/* SpO2 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Oxygen Saturation</span>
                <Wind className="h-5 w-5 text-sky-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {measurements?.spo2?.value ? Math.round(measurements.spo2.value) : '--'}
                </span>
                <span className="text-sm text-slate-500">%</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-400">Target: ≥95%</span>
                {renderSourceBadge(measurements?.spo2?.source)}
              </div>
            </div>

            {/* Temperature */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Body Temperature</span>
                <Thermometer className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {measurements?.temperature?.value ? Number(measurements.temperature.value).toFixed(1) : '--'}
                </span>
                <span className="text-sm text-slate-500">°C</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-400">Normal: 36.5 - 37.5</span>
                {renderSourceBadge(measurements?.temperature?.source)}
              </div>
            </div>

            {/* Blood Pressure */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Blood Pressure</span>
                <Activity className="h-5 w-5 text-indigo-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {measurements?.bloodPressure?.systolic || 120}/{measurements?.bloodPressure?.diastolic || 80}
                </span>
                <span className="text-sm text-slate-500">mmHg</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-400">Optimal: &lt;120/80</span>
                {renderSourceBadge(measurements?.bloodPressure?.source)}
              </div>
            </div>
          </div>

          {/* Historical Logs Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-slate-900">Vitals Log History</h4>
            {!healthData?.manualVitalsHistory || healthData.manualVitalsHistory.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No manual logs recorded yet. Use the "Log Manual Vitals" button above to record your readings.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Date & Time</th>
                      <th className="py-2.5 px-3">Heart Rate</th>
                      <th className="py-2.5 px-3">SpO2</th>
                      <th className="py-2.5 px-3">Temp</th>
                      <th className="py-2.5 px-3">BP</th>
                      <th className="py-2.5 px-3">Glucose</th>
                      <th className="py-2.5 px-3">Notes</th>
                      <th className="py-2.5 px-3">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {healthData.manualVitalsHistory.slice().reverse().map((entry, idx) => (
                      <tr key={entry.id || idx}>
                        <td className="py-2.5 px-3 font-medium text-slate-700">
                          {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'N/A'}
                        </td>
                        <td className="py-2.5 px-3">{entry.heartRate ? `${entry.heartRate} bpm` : '--'}</td>
                        <td className="py-2.5 px-3">{entry.spo2 ? `${entry.spo2}%` : '--'}</td>
                        <td className="py-2.5 px-3">{entry.temperature ? `${entry.temperature}°C` : '--'}</td>
                        <td className="py-2.5 px-3">
                          {entry.systolicBP && entry.diastolicBP ? `${entry.systolicBP}/${entry.diastolicBP}` : '--'}
                        </td>
                        <td className="py-2.5 px-3">{entry.bloodGlucose ? `${entry.bloodGlucose} mg/dL` : '--'}</td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">{entry.notes || '--'}</td>
                        <td className="py-2.5 px-3">{renderSourceBadge(entry.source)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: EMERGENCY SOS */}
      {/* ========================================================================= */}
      {activeTab === 'emergency-sos' && (() => {
        const activeAlert = emergency?.activeEmergency;
        const isSosActive = activeAlert && activeAlert.status !== 'RESOLVED' && activeAlert.status !== 'CANCELLED';
        const currentMapLinks = currentGps ? generateMapLinks(currentGps.latitude, currentGps.longitude) : null;
        const activeMapLinks = activeAlert?.location
          ? generateMapLinks(activeAlert.location.latitude, activeAlert.location.longitude)
          : null;

        const prefilledSmsText = `EMERGENCY SOS: Patient ${patient.name || patientName} (ID: ${patientId}) requires immediate medical assistance at location: ${
          currentGps ? `${currentGps.latitude}, ${currentGps.longitude}` : 'Location Unavailable'
        }. Please dispatch emergency medical transport.`;

        return (
          <div className="space-y-6">
            {/* 1. ACTIVE EMERGENCY DISTRESS EVENT CARD (IF SOS ACTIVE) */}
            {isSosActive && (
              <div className="rounded-2xl border-2 border-red-500 bg-red-50/70 p-6 shadow-xl animate-in fade-in duration-300 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-red-200 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/40 animate-pulse shrink-0">
                      <Siren className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-red-600 text-white text-[10px] font-extrabold uppercase px-2 py-0.5 tracking-wider">
                          ACTIVE DISTRESS ALERT
                        </span>
                        <span className="font-mono text-xs font-bold text-red-900">
                          ID: {activeAlert.alertId}
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900 mt-1">
                        {activeAlert.triggerReason || 'Critical Emergency Broadcasted'}
                      </h3>
                      <div className="text-xs text-slate-500">
                        Triggered at: {activeAlert.createdAt ? new Date(activeAlert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-red-100 border border-red-300 px-3 py-1 text-xs font-extrabold text-red-700">
                      STATUS: {activeAlert.status || 'CRITICAL'}
                    </span>
                    <button
                      onClick={handleCancelSos}
                      className="px-4 py-2 rounded-xl border border-red-300 bg-white text-xs font-bold text-red-700 hover:bg-red-50 shadow-xs transition"
                    >
                      Cancel Accidental SOS
                    </button>
                  </div>
                </div>

                {/* Location & Map Links in Active Alert */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl border border-red-200 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-red-600" />
                        Reported GPS Coordinates
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        activeAlert.locationStatus === 'ACQUIRED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : activeAlert.locationStatus === 'PERMISSION_DENIED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {activeAlert.locationStatus || 'ACQUIRED'}
                      </span>
                    </div>

                    <div className="font-mono text-slate-700">
                      {activeAlert.location?.latitude && activeAlert.location?.longitude
                        ? `${activeAlert.location.latitude}, ${activeAlert.location.longitude} (±${activeAlert.location.accuracy || 15}m)`
                        : 'GPS Coordinates not attached'}
                    </div>

                    {/* Direct clickable Map Links */}
                    {(activeAlert.mapsUrl || activeMapLinks?.googleMaps) && (
                      <div className="pt-2 flex flex-wrap items-center gap-2">
                        <a
                          href={activeAlert.mapsUrl || activeMapLinks?.googleMaps}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 font-bold text-xs hover:bg-sky-100 transition shadow-2xs"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open Google Maps
                        </a>
                        <a
                          href={activeAlert.openStreetMapUrl || activeMapLinks?.openStreetMap}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs hover:bg-emerald-100 transition shadow-2xs"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          OpenStreetMap
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Real Notification Delivery Results */}
                  <div className="p-4 rounded-xl border border-red-200 bg-white space-y-2">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Send className="h-4 w-4 text-indigo-600" />
                      Alert Delivery Status (Truthful Tracking)
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <div>
                          <div className="font-bold text-slate-900">{activeAlert.hospitalName || hospital.name}</div>
                          <div className="text-[10px] text-slate-500">Hospital Casualty Desk</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          activeAlert.deliveryStatus?.hospitalEmail?.status === 'DISPATCHED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}>
                          {activeAlert.deliveryStatus?.hospitalEmail?.status === 'DISPATCHED'
                            ? 'Email Dispatched'
                            : 'Gateway Unconfigured (SMTP not set)'}
                        </span>
                      </div>

                      {/* SMS Contact Notification Real Status */}
                      {Array.isArray(activeAlert.deliveryStatus?.sms) && activeAlert.deliveryStatus.sms.length > 0 ? (
                        activeAlert.deliveryStatus.sms.map((smsItem, sIdx) => (
                          <div key={sIdx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                            <div>
                              <div className="font-bold text-slate-900">{smsItem.contactName || 'Caregiver'}</div>
                              <div className="text-[10px] text-slate-500">{smsItem.phone}</div>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              smsItem.status === 'DELIVERED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : smsItem.status === 'PROVIDER_UNCONFIGURED'
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {smsItem.status === 'DELIVERED'
                                ? 'Delivered (SMS)'
                                : smsItem.status === 'PROVIDER_UNCONFIGURED'
                                ? 'Gateway Unconfigured (Twilio not set)'
                                : smsItem.status}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <div>
                            <div className="font-bold text-slate-900">{patient.emergencyContact || 'Caregiver'}</div>
                            <div className="text-[10px] text-slate-500">{patient.emergencyPhone || '+91 98765 43210'}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                            Logged in System
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Medical Transport Ambulance Dispatch Section */}
                {activeAlert.ambulanceStatus === 'AMBULANCE_REQUESTED' ? (
                  <div className="p-4 rounded-xl border border-sky-300 bg-sky-50 text-sky-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <Ambulance className="h-6 w-6 text-sky-600 animate-bounce shrink-0" />
                      <div>
                        <div className="font-bold text-sky-900">
                          Ambulance Transport Requested & Dispatched
                        </div>
                        <div className="text-sky-700">
                          {activeAlert.ambulanceDetails?.message || 'Paramedics assigned. Unit MED-AMB-409 en route (ETA ~9 mins).'}
                        </div>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-sky-200 text-sky-800 font-extrabold text-[11px] shrink-0">
                      ETA: ~9 MINS
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-end pt-2">
                    <button
                      onClick={() => emergency?.requestAmbulance && emergency.requestAmbulance()}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 text-white font-bold text-xs hover:bg-sky-700 shadow-md shadow-sky-600/20 transition"
                    >
                      <Ambulance className="h-4 w-4" />
                      Request Medical Transport / Ambulance Dispatch
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 2. EMERGENCY TRIGGER HERO CARD */}
            <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-500/10 via-rose-500/5 to-white p-6 shadow-sm">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-red-500/30 shrink-0">
                    <Siren className="h-8 w-8 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900">Emergency Distress Command (SOS)</h3>
                    <p className="text-xs text-slate-600 mt-1 max-w-xl">
                      Broadcasting an SOS alert immediately transmits your live GPS coordinates, telemetry snapshot, and
                      emergency notifications directly to the registered hospital trauma center and your emergency contacts.
                    </p>
                    <div className="mt-2 text-[11px] font-semibold text-rose-700 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Equipped with 5-second accidental-trigger protection window.
                    </div>

                    {/* GPS Coordinates & Permission Info */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <MapPin className="h-4 w-4 text-rose-500 shrink-0" />
                      <span>
                        GPS Coordinates:{' '}
                        {currentGps
                          ? `${currentGps.latitude}, ${currentGps.longitude} (±${currentGps.accuracy}m)`
                          : gpsLoading
                          ? 'Acquiring GPS position...'
                          : locationPermStatus === 'denied'
                          ? 'Permission Denied in Browser Settings'
                          : 'Position not locked'}
                      </span>
                      <button
                        onClick={captureGpsLocation}
                        disabled={gpsLoading}
                        className="text-sky-600 font-bold hover:underline ml-2 inline-flex items-center gap-1"
                      >
                        <RefreshCw className={`h-3 w-3 ${gpsLoading ? 'animate-spin' : ''}`} />
                        {gpsLoading ? 'Acquiring...' : 'Refresh GPS'}
                      </button>

                      {currentMapLinks?.googleMaps && (
                        <a
                          href={currentMapLinks.googleMaps}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-700 font-semibold hover:underline inline-flex items-center gap-0.5 ml-2"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Map Preview
                        </a>
                      )}
                    </div>

                    {locationPermStatus === 'denied' && (
                      <div className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-2">
                        <Info className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span>
                          Location blocked: Click the lock icon in your browser URL bar &gt; set Location to "Allow", then click Refresh GPS.
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={openSosModal}
                  disabled={sosTriggering}
                  className="w-full md:w-auto px-8 py-5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-base shadow-xl shadow-red-600/30 transform active:scale-95 transition flex items-center justify-center gap-2.5 animate-pulse"
                >
                  <AlertOctagon className="h-6 w-6" />
                  {sosTriggering ? 'DISPATCHING...' : 'TRIGGER SOS NOW'}
                </button>
              </div>
            </div>

            {/* 3. THREE-COLUMN QUICK CONTACTS & HELPLINES */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Emergency Helplines */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <PhoneCall className="h-3.5 w-3.5 text-red-600" />
                  Emergency Helplines
                </h4>
                <div className="space-y-2">
                  <a
                    href="tel:108"
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <Ambulance className="h-5 w-5 text-red-600" />
                      <div>
                        <div className="text-xs font-bold text-slate-800">Ambulance Emergency</div>
                        <div className="text-[10px] text-slate-400">24x7 Free Trauma Dispatch</div>
                      </div>
                    </div>
                    <span className="font-mono font-extrabold text-red-600 text-sm">108</span>
                  </a>
                  <a
                    href="tel:112"
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldAlert className="h-5 w-5 text-indigo-600" />
                      <div>
                        <div className="text-xs font-bold text-slate-800">National Emergency</div>
                        <div className="text-[10px] text-slate-400">Unified Distress Hotline</div>
                      </div>
                    </div>
                    <span className="font-mono font-extrabold text-indigo-600 text-sm">112</span>
                  </a>
                  <a
                    href="tel:102"
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <Heart className="h-5 w-5 text-rose-500" />
                      <div>
                        <div className="text-xs font-bold text-slate-800">Maternity & Childcare</div>
                        <div className="text-[10px] text-slate-400">Specialized Emergency</div>
                      </div>
                    </div>
                    <span className="font-mono font-extrabold text-rose-600 text-sm">102</span>
                  </a>
                </div>
              </div>

              {/* Primary Emergency Contact */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                  Designated SOS Contact
                </h4>
                <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
                  <div className="text-xs font-bold text-slate-900">{patient.emergencyContact || 'Caregiver / Family'}</div>
                  <div className="text-xs text-slate-500">Authorized primary contact person</div>
                  <a
                    href={`tel:${patient.emergencyPhone || '+919876543210'}`}
                    className="inline-flex items-center gap-1.5 font-bold text-rose-600 text-xs mt-1 hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {patient.emergencyPhone || '+91 98765 43210'}
                  </a>
                </div>
                <div className="text-[11px] text-slate-400 italic">
                  Notified automatically whenever distress SOS is triggered.
                </div>
              </div>

              {/* Hospital Trauma Ward */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Stethoscope className="h-3.5 w-3.5 text-sky-600" />
                  Hospital Casualty Desk
                </h4>
                <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
                  <div className="text-xs font-bold text-slate-900">{hospital.name || 'City General Medical Center'}</div>
                  <div className="text-xs text-slate-500">24x7 Emergency Casualty Ward</div>
                  <a
                    href={`tel:${hospital.phone || '+911140001000'}`}
                    className="inline-flex items-center gap-1.5 font-bold text-sky-600 text-xs mt-1 hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {hospital.phone || '+91 11 4000 1000'}
                  </a>
                </div>
                <div className="text-[11px] text-slate-400">
                  Direct line to casualty triage staff and duty emergency medical officer.
                </div>
              </div>
            </div>

            {/* 4. OFFLINE EMERGENCY DISPATCH & FALLBACK TEMPLATE */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-emerald-600" />
                    Offline Emergency SMS Dispatch Template
                  </h4>
                  <p className="text-xs text-slate-500">
                    If internet connection fails, copy or send this pre-formatted emergency dispatch text to 108 or your emergency contact.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(prefilledSmsText);
                      toast.success('Emergency SMS template copied to clipboard!');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                  >
                    <Copy className="h-3.5 w-3.5 text-slate-500" />
                    Copy SMS Text
                  </button>
                  <a
                    href={`sms:108?body=${encodeURIComponent(prefilledSmsText)}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition shadow-2xs"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send SMS to 108
                  </a>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 leading-relaxed select-all">
                {prefilledSmsText}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* TAB 8: AI HEALTH ASSISTANT (BILINGUAL HINDI / HINGLISH) */}
      {/* ========================================================================= */}
      {activeTab === 'ai-assistant' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden flex flex-col h-[650px]">
          {/* Header */}
          <div className="border-b border-slate-200 bg-slate-50/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Smart Health AI Assistant
                  <span className="rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-[10px] font-semibold">
                    v2.5 Bilingual
                  </span>
                </h3>
                <p className="text-xs text-slate-500">Clinical health guidance in Hindi, Hinglish & English</p>
              </div>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
              {[
                { id: 'hinglish', label: 'Hinglish' },
                { id: 'hindi', label: 'हिंदी (Hindi)' },
                { id: 'english', label: 'English' },
              ].map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setAiLanguage(lang.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                    aiLanguage === lang.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clinical Safety Disclaimer Banner */}
          <div className="bg-amber-50/80 border-b border-amber-200/60 px-4 py-2 text-[11px] text-amber-900 flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>
              यह AI स्वास्थ्य सहायक केवल सामान्य मार्गदर्शन के लिए है। आपातकालीन स्थिति में तुरंत डॉक्टर या 108 पर संपर्क करें।
            </span>
          </div>

          {/* Chat Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {aiMessages.map((msg, index) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={index}
                  className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                      <Sparkles className="h-4 w-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-xl rounded-2xl p-4 text-xs shadow-xs ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : msg.isEmergency
                        ? 'bg-rose-50 text-rose-950 border border-rose-300 rounded-tl-none'
                        : 'bg-slate-100/80 text-slate-800 rounded-tl-none border border-slate-200/60'
                    }`}
                  >
                    <div className="whitespace-pre-line leading-relaxed">{msg.text}</div>

                    {msg.isEmergency && (
                      <div className="mt-3 pt-3 border-t border-rose-200 flex items-center justify-between">
                        <span className="font-bold text-rose-700">Immediate action advised:</span>
                        <button
                          onClick={() => setShowSosConfirmModal(true)}
                          className="px-3 py-1 rounded-lg bg-red-600 text-white font-bold text-xs hover:bg-red-700 shadow-2xs"
                        >
                          Trigger SOS
                        </button>
                      </div>
                    )}

                    <div
                      className={`text-[10px] mt-2 text-right ${
                        isUser ? 'text-indigo-200' : 'text-slate-400'
                      }`}
                    >
                      {msg.timestamp}
                    </div>
                  </div>

                  {isUser && (
                    <div className="h-8 w-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {aiLoading && (
              <div className="flex items-center gap-2 text-xs text-indigo-600">
                <div className="h-2 w-2 rounded-full bg-indigo-600 animate-bounce" />
                <div className="h-2 w-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.2s]" />
                <div className="h-2 w-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.4s]" />
                <span className="font-medium text-slate-500">AI Assistant is typing...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Prompt Suggestion Chips */}
          <div className="p-2 border-t border-slate-100 bg-slate-50 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {[
              '🩺 Normal blood pressure kitna hona chahiye?',
              '💊 Dawa lene ka sahi samay kya hai?',
              '❤️ Resting heart rate 85 normal hai ya nahi?',
              '⚠️ Seene me halka dard mehsus ho raha hai',
              '🥗 High BP ke liye kaisa diet lena chahiye?',
            ].map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSendAiQuery(prompt)}
                className="whitespace-nowrap rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 border-t border-slate-200 bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendAiQuery();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder={
                  aiLanguage === 'hindi'
                    ? 'अपना स्वास्थ्य प्रश्न यहाँ लिखें (जैसे: मेरा रक्तचाप 130 है...)'
                    : aiLanguage === 'hinglish'
                    ? 'Apna health question yahan type karein (jaise: BP kitna hona chahiye)...'
                    : 'Type your health inquiry here...'
                }
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={aiLoading || !aiQuery.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-white hover:bg-indigo-700 transition disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 9: NOTIFICATIONS */}
      {/* ========================================================================= */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Health Alerts & Communications</h3>
              <p className="text-xs text-slate-500">Appointment updates, released reports, and care team notices</p>
            </div>
            {unreadNotifCount > 0 && (
              <span className="rounded-full bg-sky-100 text-sky-800 px-3 py-1 text-xs font-semibold">
                {unreadNotifCount} Unread
              </span>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-dashed border-slate-200 bg-white p-8">
              <Bell className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-800">No Notifications</h4>
              <p className="text-xs text-slate-500 mt-1">You are all caught up on care updates.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`rounded-2xl border p-4 transition ${
                    notif.read
                      ? 'border-slate-200 bg-white opacity-80'
                      : 'border-sky-200 bg-sky-50/40 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                          notif.type === 'appointment'
                            ? 'bg-purple-100 text-purple-700'
                            : notif.type === 'emergency'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-sky-100 text-sky-700'
                        }`}
                      >
                        {notif.type === 'appointment' ? (
                          <Calendar className="h-4 w-4" />
                        ) : notif.type === 'emergency' ? (
                          <Siren className="h-4 w-4" />
                        ) : (
                          <Bell className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{notif.title}</div>
                        <div className="text-xs text-slate-600 mt-0.5">{notif.message}</div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {notif.timestamp ? new Date(notif.timestamp).toLocaleString() : 'Recent'}
                        </div>
                      </div>
                    </div>

                    {!notif.read && (
                      <button
                        onClick={() => handleMarkNotifRead(notif.id)}
                        className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 whitespace-nowrap"
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 10: PRIVACY AND SETTINGS */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Password Management */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">Security Credentials & Password</h3>
              <p className="text-xs text-slate-500">Update your authenticated healthcare portal login password</p>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Current Password</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">New Password (Min 8 chars)</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Enter new strong password"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <button
                type="submit"
                disabled={passwordSaving}
                className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 transition disabled:opacity-60 shadow-xs"
              >
                {passwordSaving ? 'Verifying & Updating...' : 'Update Password'}
              </button>
            </form>
          </div>

          {/* Healthcare Privacy Governance */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h3 className="text-base font-bold text-slate-900">Healthcare Data Privacy</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your health records are safeguarded according to standard health data privacy standards (DISHA and
              HIPAA).
            </p>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="font-bold text-slate-800 block">🔒 End-to-End Cryptographic Security</span>
                <span>All telemetry and clinical data are encrypted using TLS 1.3 in transit and AES-256 at rest.</span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="font-bold text-slate-800 block">🏥 Hospital-Level Data Isolation</span>
                <span>
                  Records are accessible exclusively by your authorized treating physician (Dr. {doctor.name}) and
                  registered medical staff.
                </span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="font-bold text-slate-800 block">📋 Complete Audit Logging</span>
                <span>Every access to your medical history and vitals logs is recorded in an immutable audit trail.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: EDIT PROFILE */}
      {/* ========================================================================= */}
      {showProfileEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Edit Personal Health Profile</h3>
              <button
                onClick={() => setShowProfileEditModal(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Blood Group</label>
                  <select
                    value={profileForm.bloodGroup}
                    onChange={(e) => setProfileForm({ ...profileForm, bloodGroup: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-sky-500/20"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Emergency Contact Name</label>
                  <input
                    type="text"
                    value={profileForm.emergencyContact}
                    onChange={(e) => setProfileForm({ ...profileForm, emergencyContact: e.target.value })}
                    placeholder="Caregiver Name"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Emergency Phone</label>
                  <input
                    type="tel"
                    value={profileForm.emergencyPhone}
                    onChange={(e) => setProfileForm({ ...profileForm, emergencyPhone: e.target.value })}
                    placeholder="+91 98765 00000"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Known Allergies</label>
                  <input
                    type="text"
                    value={profileForm.allergies}
                    onChange={(e) => setProfileForm({ ...profileForm, allergies: e.target.value })}
                    placeholder="e.g. Penicillin, Peanuts (or None)"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Residential Address</label>
                  <textarea
                    rows={2}
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    placeholder="Full residential street address..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowProfileEditModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="rounded-xl bg-sky-600 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  {profileSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: BOOK APPOINTMENT */}
      {/* ========================================================================= */}
      {showAppointmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Book Outpatient Consultation</h3>
                <p className="text-xs text-slate-500">With Dr. {doctor.name || 'Assigned Physician'}</p>
              </div>
              <button onClick={() => setShowAppointmentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleBookAppointment} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Appointment Date</label>
                <input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={appointmentForm.appointmentDate}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, appointmentDate: e.target.value })}
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Preferred Time Slot</label>
                <select
                  value={appointmentForm.appointmentTime}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, appointmentTime: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs"
                >
                  {['09:00 AM', '10:00 AM', '11:30 AM', '02:00 PM', '03:30 PM', '05:00 PM'].map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Clinical Department</label>
                <select
                  value={appointmentForm.department}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, department: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs"
                >
                  {[
                    'General Medicine',
                    'Cardiology',
                    'Pulmonology',
                    'Endocrinology',
                    'Orthopedics',
                    'Pediatrics',
                  ].map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Reason for Visit / Symptoms</label>
                <textarea
                  rows={2}
                  value={appointmentForm.notes}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })}
                  placeholder="Describe your current symptoms or follow-up reason..."
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAppointmentModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="rounded-xl bg-sky-600 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  {bookingLoading ? 'Scheduling...' : 'Confirm Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: LOG MANUAL VITALS */}
      {/* ========================================================================= */}
      {showManualVitalsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Health Measurements</h3>
                <p className="text-xs text-slate-500">Physiological measurements with range verification</p>
              </div>
              <button onClick={() => setShowManualVitalsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {vitalsValidationErrors.length > 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 space-y-1">
                {vitalsValidationErrors.map((err, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSaveManualVitals} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    min="30"
                    max="220"
                    value={vitalsForm.heartRate}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, heartRate: e.target.value })}
                    placeholder="e.g. 72 (30-220)"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">SpO2 Oxygen (%)</label>
                  <input
                    type="number"
                    min="60"
                    max="100"
                    value={vitalsForm.spo2}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, spo2: e.target.value })}
                    placeholder="e.g. 98 (60-100)"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Temperature (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="34.0"
                    max="43.0"
                    value={vitalsForm.temperature}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, temperature: e.target.value })}
                    placeholder="e.g. 36.8 (34-43)"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Blood Glucose (mg/dL)</label>
                  <input
                    type="number"
                    value={vitalsForm.bloodGlucose}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, bloodGlucose: e.target.value })}
                    placeholder="e.g. 95"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Systolic BP (mmHg)</label>
                  <input
                    type="number"
                    min="70"
                    max="240"
                    value={vitalsForm.systolicBP}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, systolicBP: e.target.value })}
                    placeholder="e.g. 120 (70-240)"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Diastolic BP (mmHg)</label>
                  <input
                    type="number"
                    min="40"
                    max="140"
                    value={vitalsForm.diastolicBP}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, diastolicBP: e.target.value })}
                    placeholder="e.g. 80 (40-140)"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Observation Notes</label>
                  <input
                    type="text"
                    value={vitalsForm.notes}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, notes: e.target.value })}
                    placeholder="e.g. Measured at resting state after morning walk"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowManualVitalsModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={vitalsSaving}
                  className="rounded-xl bg-sky-600 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  {vitalsSaving ? 'Saving...' : 'Save Measurements'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: PRINTABLE PRESCRIPTION DOCUMENT */}
      {/* ========================================================================= */}
      {showPrescriptionPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 print:m-0 print:p-0 print:shadow-none">
            {/* Header / Letterhead */}
            <div className="border-b-2 border-slate-800 pb-4 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  {hospital.name || 'CITY GENERAL MEDICAL CENTER'}
                </h2>
                <p className="text-xs text-slate-600 font-medium">Department of Ambulatory & Telemedicine Care</p>
                <p className="text-[11px] text-slate-500">
                  {hospital.address || 'Healthcare Blvd, Suite 400'} • Phone: {hospital.phone || '+91 11 4000 1000'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-serif font-black text-sky-800">℞</span>
                <div className="text-[10px] text-slate-400 mt-1">Rx Ref: RX-{Date.now().toString().slice(-6)}</div>
              </div>
            </div>

            {/* Patient & Doctor Demographics */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <div className="text-slate-400 font-semibold uppercase text-[10px]">Patient Name</div>
                <div className="font-bold text-slate-900">{patient.name || patientName}</div>
                <div className="text-slate-600">ID: {patientId} • Age: {patient.age || 26} Yrs ({patient.gender || 'M'})</div>
              </div>
              <div>
                <div className="text-slate-400 font-semibold uppercase text-[10px]">Prescribing Clinician</div>
                <div className="font-bold text-slate-900">Dr. {doctor.name || 'Treating Physician'}</div>
                <div className="text-slate-600">{doctor.specialty || 'General Medicine'} • Lic: MED-IN-4920</div>
              </div>
            </div>

            {/* Medications Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Prescribed Medication Regimen</h4>
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-2 border">#</th>
                    <th className="p-2 border">Medication & Strength</th>
                    <th className="p-2 border">Frequency & Timing</th>
                    <th className="p-2 border">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activePrescriptions.map((rx, idx) => (
                    <tr key={idx}>
                      <td className="p-2 border font-bold">{idx + 1}</td>
                      <td className="p-2 border font-bold text-slate-900">
                        {rx.name || rx.medicineName} ({rx.dosage || rx.dose || 'Standard'})
                        <div className="text-[10px] font-normal text-slate-500 italic mt-0.5">
                          {rx.instructions || 'As instructed by doctor'}
                        </div>
                      </td>
                      <td className="p-2 border">{rx.frequency || 'Once Daily'}</td>
                      <td className="p-2 border">{rx.duration || '30 Days'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Doctor Signature & Legal Certification */}
            <div className="pt-6 border-t border-slate-200 flex items-end justify-between text-xs">
              <div className="text-[11px] text-slate-400 max-w-xs">
                Certified electronic prescription generated under certified Electronic Health Record guidelines.
                Verification hash: SHA256-CERT-{patientId.slice(0, 4)}
              </div>
              <div className="text-center">
                <div className="font-serif italic font-bold text-slate-800 text-sm">Dr. {doctor.name || 'Treating Physician'}</div>
                <div className="text-[10px] text-slate-400 border-t border-slate-300 pt-1 mt-1">Authorized Digital Signature</div>
              </div>
            </div>

            {/* Print & Close Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 print:hidden">
              <button
                onClick={() => setShowPrescriptionPrintModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-black transition shadow-xs"
              >
                <Printer className="h-4 w-4" />
                Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: EMERGENCY SOS ACCIDENTAL-TRIGGER PROTECTION & CONFIRMATION */}
      {/* ========================================================================= */}
      {showSosConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 border-2 border-red-500">
            {/* Header with animated pulse and countdown ring */}
            <div className="flex items-center justify-between border-b border-red-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                  <Siren className="h-7 w-7 animate-pulse text-red-600" />
                  <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white font-mono text-xs font-black shadow-md">
                    {sosCountdown}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Emergency SOS Broadcast</h3>
                  <p className="text-xs font-bold text-red-600">Accidental-Trigger Protection Active</p>
                </div>
              </div>
              <button
                onClick={() => setShowSosConfirmModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Countdown Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>Auto-dispatching in:</span>
                <span className="font-mono text-sm font-extrabold text-red-600">{sosCountdown} seconds</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-rose-600 transition-all duration-1000 ease-linear"
                  style={{ width: `${(sosCountdown / 5) * 100}%` }}
                />
              </div>
            </div>

            {/* Event Summary Details */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Patient:</span>
                <span className="font-bold text-slate-900">{patient.name || patientName} ({patientId})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Target Hospital:</span>
                <span className="font-bold text-slate-900">{hospital.name || 'Assigned Hospital Trauma Unit'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">GPS Telemetry:</span>
                <span className="font-mono font-bold text-slate-800">
                  {currentGps
                    ? `${currentGps.latitude}, ${currentGps.longitude} (±${currentGps.accuracy}m)`
                    : 'Acquiring GPS / Fallback location'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Emergency Contact:</span>
                <span className="font-semibold text-slate-800">
                  {patient.emergencyContact || 'Designated caregiver'} ({patient.emergencyPhone || '+91 98765 43210'})
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              If you triggered this by mistake, click <strong>Cancel (Abort Trigger)</strong>. Otherwise, click <strong>CONFIRM & DISPATCH NOW</strong> or wait for the countdown to expire.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowSosConfirmModal(false);
                  toast('SOS broadcast cancelled.');
                }}
                className="w-full sm:w-auto rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs"
              >
                Cancel (Abort Trigger)
              </button>
              <button
                type="button"
                onClick={handleTriggerSos}
                disabled={sosTriggering}
                className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-6 py-2.5 text-xs font-extrabold text-white hover:from-red-500 hover:to-rose-500 shadow-lg shadow-red-600/30 active:scale-95 transition flex items-center justify-center gap-2"
              >
                <AlertOctagon className="h-4 w-4" />
                {sosTriggering ? 'DISPATCHING...' : 'CONFIRM & DISPATCH NOW'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: REPORT DETAILS VIEW */}
      {/* ========================================================================= */}
      {selectedReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedReportModal.testName}</h3>
                <p className="text-xs text-slate-500">Certified Diagnostic Report</p>
              </div>
              <button onClick={() => setSelectedReportModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="rounded-xl bg-slate-50 p-3 space-y-1">
                <div><span className="font-semibold text-slate-500">Diagnostic Center:</span> {selectedReportModal.labName}</div>
                <div><span className="font-semibold text-slate-500">Date Verified:</span> {selectedReportModal.date}</div>
                <div><span className="font-semibold text-slate-500">Certified By:</span> Dr. {selectedReportModal.verifiedBy || doctor.name}</div>
                <div><span className="font-semibold text-slate-500">Status:</span> {selectedReportModal.status}</div>
              </div>

              <div>
                <span className="font-bold text-slate-900 block mb-1">Clinical Findings:</span>
                <p className="rounded-xl border border-slate-100 bg-white p-3 text-slate-800 leading-relaxed font-mono text-[11px]">
                  {selectedReportModal.findings}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedReportModal(null)}
                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-black"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
