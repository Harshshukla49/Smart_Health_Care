import React, { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Ambulance,
  ArrowRight,
  Bell,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Heart,
  HeartPulse,
  History,
  Info,
  Lock,
  Mail,
  MapPin,
  Pill,
  Phone,
  PhoneCall,
  Plus,
  Printer,
  Radio,
  RefreshCw,
  Search,
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
  fetchDoctorOverview,
  fetchDoctorHospitalDirectory,
  fetchDoctorPatientClinicalRecord,
  requestDoctorEmergencyAccess,
  fetchDoctorAlerts,
  triageDoctorAlert,
  fetchDoctorPatientClinicalDocument,
  recordDoctorConsultation,
  createPrescription,
  updateDoctorPrescriptionWithAudit,
  updateAppointmentStatus,
} from '../../services/api';

export function DoctorCommandCenter({ session, liveVitals, emergency, activeTab: propTab, onTabChange }) {
  const doctorId = session?.doctorId || session?.id || session?.email || 'DOC-CAR-01';
  const doctorName = session?.name || session?.doctorName || 'Doctor';
  const hospitalScope = session?.hospitalId || 'HOSP-CITY-01';

  // Navigation tabs
  const [internalTab, setInternalTab] = useState(propTab || 'overview');
  const activeTab = propTab || internalTab;
  const setActiveTab = (tab) => {
    setInternalTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  useEffect(() => {
    if (propTab) {
      setInternalTab(propTab);
    }
  }, [propTab]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Core Data Stores
  const [overview, setOverview] = useState(null);
  const [directory, setDirectory] = useState([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // Search & Filters
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryFilter, setDirectoryFilter] = useState('all'); // 'all', 'assigned', 'others'

  // Modals
  const [selectedPatientRecord, setSelectedPatientRecord] = useState(null); // Level B Clinical Record
  const [recordLoading, setRecordLoading] = useState(false);
  const [showBreakGlassModal, setShowBreakGlassModal] = useState(false);
  const [breakGlassPatient, setBreakGlassPatient] = useState(null);
  const [breakGlassReason, setBreakGlassReason] = useState('');
  const [breakGlassUrgency, setBreakGlassUrgency] = useState('CRITICAL');
  const [breakGlassLoading, setBreakGlassLoading] = useState(false);

  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const [consultationForm, setConsultationForm] = useState({
    symptoms: '',
    diagnosis: '',
    treatmentPlan: '',
    department: 'Cardiology',
    notes: '',
  });
  const [consultationSaving, setConsultationSaving] = useState(false);

  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [editingPrescription, setEditingPrescription] = useState(null); // If revising existing
  const [prescriptionForm, setPrescriptionForm] = useState({
    medicineName: '',
    dosage: '',
    frequency: 'Once Daily',
    duration: '30 Days',
    instructions: 'Take after meal with lukewarm water',
    reasonForCorrection: '',
  });
  const [prescriptionSaving, setPrescriptionSaving] = useState(false);

  const [showTriageModal, setShowTriageModal] = useState(false);
  const [triagingAlert, setTriagingAlert] = useState(null);
  const [triageAction, setTriageAction] = useState('ACKNOWLEDGE');
  const [triageNotes, setTriageNotes] = useState('');
  const [triageSaving, setTriageSaving] = useState(false);

  const [showPrintDocumentModal, setShowPrintDocumentModal] = useState(false);
  const [clinicalDocument, setClinicalDocument] = useState(null);
  const [documentLoading, setDocumentLoading] = useState(false);

  // Load Overview Data
  const loadOverview = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await fetchDoctorOverview();
      setOverview(data);
    } catch (err) {
      console.error('Failed to load doctor overview:', err);
      toast.error(err?.response?.data?.message || 'Unable to load clinical command center.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load Hospital Directory (Access Level A)
  const loadDirectory = async () => {
    setDirectoryLoading(true);
    try {
      const data = await fetchDoctorHospitalDirectory({ q: directorySearch });
      if (Array.isArray(data?.patients)) {
        setDirectory(data.patients);
      }
    } catch (err) {
      console.error('Failed to load hospital directory:', err);
      toast.error(err?.response?.data?.message || 'Unable to retrieve hospital directory.');
    } finally {
      setDirectoryLoading(false);
    }
  };

  // Load Doctor Alerts
  const loadAlerts = async () => {
    setAlertsLoading(true);
    try {
      const data = await fetchDoctorAlerts();
      if (Array.isArray(data?.alerts)) {
        setAlerts(data.alerts);
      }
    } catch (err) {
      console.error('Failed to load doctor alerts:', err);
    } finally {
      setAlertsLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [doctorId]);

  useEffect(() => {
    if (activeTab === 'directory') {
      loadDirectory();
    } else if (activeTab === 'alerts') {
      loadAlerts();
    }
  }, [activeTab]);

  // Open Detailed Clinical Record (Access Level B)
  const handleOpenClinicalRecord = async (patientId) => {
    setRecordLoading(true);
    try {
      const data = await fetchDoctorPatientClinicalRecord(patientId);
      setSelectedPatientRecord(data);
    } catch (err) {
      console.error('Failed to open clinical record:', err);
      const msg = err?.response?.data?.message || 'Access denied for this patient record.';
      toast.error(msg);
      // If forbidden, prompt break glass if same hospital
      if (err?.response?.status === 403 && !msg.toLowerCase().includes('another hospital')) {
        const targetPt = directory.find((p) => p.id === patientId || p.patientId === patientId);
        if (targetPt) {
          setBreakGlassPatient(targetPt);
          setShowBreakGlassModal(true);
        }
      }
    } finally {
      setRecordLoading(false);
    }
  };

  // Submit Emergency Break-Glass Request
  const handleSubmitBreakGlass = async (e) => {
    e.preventDefault();
    if (!breakGlassPatient || breakGlassReason.trim().length < 8) {
      toast.error('A declared clinical emergency reason (min 8 chars) is required.');
      return;
    }

    setBreakGlassLoading(true);
    try {
      const pid = breakGlassPatient.id || breakGlassPatient.patientId;
      await requestDoctorEmergencyAccess(pid, {
        reason: breakGlassReason.trim(),
        clinicalUrgency: breakGlassUrgency,
      });

      toast.success('Emergency break-glass access granted for 2 hours. Audit logged.');
      setShowBreakGlassModal(false);
      setBreakGlassReason('');

      // Refresh directory and open clinical record
      loadDirectory();
      handleOpenClinicalRecord(pid);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Emergency break-glass access rejected.');
    } finally {
      setBreakGlassLoading(false);
    }
  };

  // Submit New Consultation Record
  const handleSaveConsultation = async (e) => {
    e.preventDefault();
    if (!consultationForm.diagnosis.trim()) {
      toast.error('Clinical diagnosis is required.');
      return;
    }

    const pid = selectedPatientRecord?.patient?.id || selectedPatientRecord?.patient?.patientId;
    if (!pid) return;

    setConsultationSaving(true);
    try {
      await recordDoctorConsultation(doctorId, pid, consultationForm);
      toast.success('Clinical consultation recorded and certified successfully.');
      setShowConsultationModal(false);
      setConsultationForm({
        symptoms: '',
        diagnosis: '',
        treatmentPlan: '',
        department: 'Cardiology',
        notes: '',
      });
      // Refresh patient dossier
      handleOpenClinicalRecord(pid);
      loadOverview(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to record consultation.');
    } finally {
      setConsultationSaving(false);
    }
  };

  // Submit Prescription (New or Audited Revision)
  const handleSavePrescription = async (e) => {
    e.preventDefault();
    if (!prescriptionForm.medicineName.trim() || !prescriptionForm.dosage.trim()) {
      toast.error('Medication name and dosage are required.');
      return;
    }

    const pid = selectedPatientRecord?.patient?.id || selectedPatientRecord?.patient?.patientId;
    if (!pid) return;

    setPrescriptionSaving(true);
    try {
      if (editingPrescription) {
        // Audited Revision
        if (!prescriptionForm.reasonForCorrection.trim()) {
          toast.error('Reason for clinical correction is strictly required for prescription updates.');
          setPrescriptionSaving(false);
          return;
        }

        const medId = editingPrescription.id || editingPrescription.medicationId;
        await updateDoctorPrescriptionWithAudit(pid, medId, {
          medicineName: prescriptionForm.medicineName,
          dosage: prescriptionForm.dosage,
          frequency: prescriptionForm.frequency,
          duration: prescriptionForm.duration,
          instructions: prescriptionForm.instructions,
          reasonForCorrection: prescriptionForm.reasonForCorrection,
        });
        toast.success('Prescription updated. Clinical revision history logged!');
      } else {
        // New Finalized Prescription
        await createPrescription(pid, {
          medicineName: prescriptionForm.medicineName,
          dosage: prescriptionForm.dosage,
          frequency: prescriptionForm.frequency,
          duration: prescriptionForm.duration,
          instructions: prescriptionForm.instructions,
          status: 'Active',
        });
        toast.success('New prescription finalized and certified.');
      }

      setShowPrescriptionModal(false);
      setEditingPrescription(null);
      setPrescriptionForm({
        medicineName: '',
        dosage: '',
        frequency: 'Once Daily',
        duration: '30 Days',
        instructions: 'Take after meal with water',
        reasonForCorrection: '',
      });
      handleOpenClinicalRecord(pid);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to finalize prescription.');
    } finally {
      setPrescriptionSaving(false);
    }
  };

  // Submit Alert Triage
  const handleSaveAlertTriage = async (e) => {
    e.preventDefault();
    if (!triagingAlert) return;

    setTriageSaving(true);
    try {
      await triageDoctorAlert(triagingAlert.id || triagingAlert.alertId, {
        action: triageAction,
        doctorNotes: triageNotes,
      });

      toast.success(`Alert triaged as ${triageAction}.`);
      setShowTriageModal(false);
      setTriagingAlert(null);
      setTriageNotes('');
      loadAlerts();
      loadOverview(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to triage alert.');
    } finally {
      setTriageSaving(false);
    }
  };

  // Open Printable Clinical Document
  const handleOpenPrintDocument = async (patientId) => {
    setDocumentLoading(true);
    setShowPrintDocumentModal(true);
    try {
      const data = await fetchDoctorPatientClinicalDocument(patientId);
      setClinicalDocument(data?.document);
    } catch (err) {
      toast.error('Failed to generate clinical document.');
      setShowPrintDocumentModal(false);
    } finally {
      setDocumentLoading(false);
    }
  };

  // Filtered Hospital Directory List
  const filteredDirectory = useMemo(() => {
    return directory.filter((p) => {
      if (directoryFilter === 'assigned') return p.isAssignedToRequester;
      if (directoryFilter === 'others') return !p.isAssignedToRequester;
      return true;
    });
  }, [directory, directoryFilter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] p-8">
        <div className="relative mb-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-700 animate-pulse flex items-center justify-center shadow-lg shadow-sky-600/20">
            <Stethoscope className="h-8 w-8 text-white animate-bounce" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-slate-800">Initializing Doctor Clinical Command Center...</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm text-center">
          Loading assigned patients, outpatient consultation queue, and telemetry alert feeds.
        </p>
      </div>
    );
  }

  const doctor = overview?.doctor || {};
  const assignedPatients = overview?.assignedPatients || [];
  const todayAppointments = overview?.todayAppointments || [];
  const pendingConsultations = overview?.pendingConsultations || [];
  const followUpReminders = overview?.followUpReminders || [];
  const assignedAlerts = overview?.assignedAlerts || [];
  const recentActivity = overview?.recentActivity || [];

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. DOCTOR COMMAND CENTER HEADER & IDENTITY BANNER */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-500/10 via-indigo-500/5 to-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-sky-600/20 shrink-0">
              <Stethoscope className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Dr. {doctor.name || doctorName}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800 border border-sky-200">
                  <ShieldCheck className="h-3.5 w-3.5 text-sky-600" />
                  {doctor.specialty || 'Cardiologist'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800 border border-purple-200">
                  <Building2 className="h-3.5 w-3.5 text-purple-600" />
                  {doctor.hospitalName || 'City General Medical Center'}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                <span className="font-mono text-slate-700 bg-white/80 px-2 py-0.5 rounded border border-slate-200">
                  ID: {doctor.id || doctorId}
                </span>
                <span>•</span>
                <span>Dept: {doctor.department || 'Cardiology & Intensive Care'}</span>
                <span>•</span>
                <span className="font-mono text-slate-500">Lic: {doctor.licenseNumber || 'MED-REG-4920'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={() => loadOverview(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh Feed
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs ${
                assignedAlerts.length > 0
                  ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-500/20 animate-pulse'
                  : 'bg-slate-800 text-white hover:bg-black'
              }`}
            >
              <Siren className="h-4 w-4" />
              <span>{assignedAlerts.length} Active Alerts</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. DOCTOR WORKSPACE NAVIGATION TABS */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-none">
        {[
          { id: 'overview', label: 'Clinical Overview', icon: Activity },
          { id: 'directory', label: 'Hospital Directory (Level A)', icon: Users, badge: directory.length },
          { id: 'assigned', label: 'My Patients (Level B)', icon: UserCheck, badge: assignedPatients.length },
          { id: 'appointments', label: 'Appointments & Consults', icon: Calendar, badge: pendingConsultations.length },
          { id: 'alerts', label: 'Sensor & Distress Alerts', icon: AlertOctagon, alert: assignedAlerts.length > 0 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-medium transition ${
                isActive
                  ? 'bg-sky-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
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
                <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CLINICAL OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span className="font-semibold uppercase tracking-wider">Assigned Patients</span>
                <UserCheck className="h-5 w-5 text-sky-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">{assignedPatients.length}</span>
                <span className="text-xs text-slate-500">active care</span>
              </div>
              <div className="text-[11px] text-sky-600 font-medium">Direct clinical responsibility</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span className="font-semibold uppercase tracking-wider">Today's Visits</span>
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">{todayAppointments.length}</span>
                <span className="text-xs text-slate-500">appointments</span>
              </div>
              <div className="text-[11px] text-purple-600 font-medium">{pendingConsultations.length} pending review</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span className="font-semibold uppercase tracking-wider">Follow-Up Reminders</span>
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">{followUpReminders.length}</span>
                <span className="text-xs text-slate-500">patients</span>
              </div>
              <div className="text-[11px] text-amber-600 font-medium">Within next 7 days</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span className="font-semibold uppercase tracking-wider">Urgent Alerts</span>
                <Siren className="h-5 w-5 text-rose-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">{assignedAlerts.length}</span>
                <span className="text-xs text-slate-500">distress/vitals</span>
              </div>
              <div className="text-[11px] text-rose-600 font-medium">Triage queue active</div>
            </div>
          </div>

          {/* Two-Column Workspace Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Today's Appointments Queue */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-sky-600" />
                  <h3 className="text-sm font-bold text-slate-900">Today's Consultation Schedule</h3>
                </div>
                <span className="text-xs text-slate-500">{todayAppointments.length} Booked</span>
              </div>

              {todayAppointments.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No appointments scheduled for today.
                </div>
              ) : (
                <div className="space-y-3">
                  {todayAppointments.map((apt) => (
                    <div
                      key={apt.id || apt.appointmentId}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3 hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-700 flex flex-col items-center justify-center font-bold text-xs border border-sky-100 shrink-0">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{apt.patientName || 'Patient'}</div>
                          <div className="text-[11px] text-slate-500">
                            {apt.appointmentTime} • {apt.department || 'Outpatient'} • ID: {apt.patientId}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                          {apt.status}
                        </span>
                        <button
                          onClick={() => handleOpenClinicalRecord(apt.patientId)}
                          className="rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-700 shadow-2xs"
                        >
                          Open Dossier
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Critical Telemetry Alerts Queue */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Siren className="h-4 w-4 text-rose-600" />
                  <h3 className="text-sm font-bold text-slate-900">Urgent Sensor & SOS Alerts</h3>
                </div>
                <span className="text-xs text-slate-500">{assignedAlerts.length} Active</span>
              </div>

              {assignedAlerts.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No active critical alerts for your patients. All vitals nominal.
                </div>
              ) : (
                <div className="space-y-3">
                  {assignedAlerts.slice(0, 4).map((al) => (
                    <div
                      key={al.id || al.alertId}
                      className="rounded-xl border border-red-200 bg-rose-50/50 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" />
                          <span className="text-xs font-bold text-slate-900">{al.patientName || 'Patient'}</span>
                          <span className="text-[10px] text-slate-500">({al.patientId})</span>
                        </div>
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                          {al.type} • {al.severity}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600 flex items-center justify-between">
                        <span>Status: <strong className="text-red-700">{al.triageStatus || 'PENDING_REVIEW'}</strong></span>
                        <span className="text-slate-400">{al.timestamp ? new Date(al.timestamp).toLocaleTimeString() : 'Just now'}</span>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-200/60">
                        <button
                          onClick={() => {
                            setTriagingAlert(al);
                            setShowTriageModal(true);
                          }}
                          className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 shadow-2xs"
                        >
                          Triage Alert
                        </button>
                        <button
                          onClick={() => handleOpenClinicalRecord(al.patientId)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          View Patient
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
      {/* TAB 2: HOSPITAL PATIENT DIRECTORY (ACCESS LEVEL A) */}
      {/* ========================================================================= */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
            <div className="text-xs text-sky-900 leading-relaxed">
              <span className="font-bold">Hospital-Wide Directory (Access Level A):</span> You can search permitted
              directory information for patients registered at your hospital (<strong>{doctor.hospitalName}</strong>).
              To uphold patient confidentiality and medical governance, detailed clinical dossiers are restricted to
              assigned clinicians. Emergency break-glass access is available for acute trauma care and is permanently
              audited.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={directorySearch}
                onChange={(e) => setDirectorySearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadDirectory()}
                placeholder="Search hospital patients by ID, name, or phone..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
              {[
                { id: 'all', label: 'All Patients' },
                { id: 'assigned', label: 'Assigned to Me' },
                { id: 'others', label: 'Other Clinicians' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setDirectoryFilter(f.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                    directoryFilter === f.id
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {directoryLoading ? (
            <div className="text-center py-12 text-xs text-slate-400">Searching hospital directory...</div>
          ) : filteredDirectory.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-dashed border-slate-200 bg-white p-8">
              <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-800">No Patients Found</h4>
              <p className="text-xs text-slate-500 mt-1">Try adjusting your search criteria or filter.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Patient ID</th>
                      <th className="py-3 px-4">Full Name</th>
                      <th className="py-3 px-4">Demographics</th>
                      <th className="py-3 px-4">Assignment Status</th>
                      <th className="py-3 px-4 text-right">Clinical Access</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDirectory.map((pt) => (
                      <tr key={pt.id || pt.patientId} className="hover:bg-slate-50/50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {pt.patientId || pt.id}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {pt.name}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {pt.age || 26} Yrs • {pt.gender || 'Male'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                              pt.isAssignedToRequester
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : pt.hasEmergencyAccess
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {pt.isAssignedToRequester ? (
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            ) : pt.hasEmergencyAccess ? (
                              <ShieldAlert className="h-3 w-3 text-amber-600" />
                            ) : (
                              <User className="h-3 w-3 text-slate-400" />
                            )}
                            {pt.assignmentStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {pt.canOpenClinicalRecord ? (
                            <button
                              onClick={() => handleOpenClinicalRecord(pt.id || pt.patientId)}
                              className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 shadow-2xs transition"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Open Dossier
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setBreakGlassPatient(pt);
                                setShowBreakGlassModal(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition"
                            >
                              <Lock className="h-3.5 w-3.5 text-amber-600" />
                              Break-Glass SOS
                            </button>
                          )}
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
      {/* TAB 3: MY ASSIGNED PATIENTS (ACCESS LEVEL B) */}
      {/* ========================================================================= */}
      {activeTab === 'assigned' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Assigned Patient Panel (Level B Dossiers)</h3>
              <p className="text-xs text-slate-500">
                Patients under your direct clinical care at {doctor.hospitalName}
              </p>
            </div>
            <span className="rounded-full bg-sky-100 text-sky-800 px-3 py-1 text-xs font-bold">
              {assignedPatients.length} Patients
            </span>
          </div>

          {assignedPatients.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-dashed border-slate-200 bg-white p-8">
              <UserCheck className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-800">No Patients Assigned</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Hospital administrators assign patients to treating clinicians. You can also view registered patients
                in the Hospital Directory.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignedPatients.map((pt) => (
                <div
                  key={pt.id || pt.patientId}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 hover:border-sky-300 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{pt.name}</h4>
                      <div className="text-xs text-slate-500 mt-0.5">
                        ID: <span className="font-mono">{pt.patientId || pt.id}</span> • {pt.age} Yrs ({pt.gender})
                      </div>
                    </div>
                    {pt.deviceConnected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                        <Radio className="h-3 w-3 text-emerald-600 animate-pulse" />
                        IoT Live
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        Ambulatory
                      </span>
                    )}
                  </div>

                  {/* Vitals Quick View */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">Heart Rate</span>
                      <span className="font-bold text-slate-900">{pt.vitals?.heart_rate ? Math.round(pt.vitals.heart_rate) : '--'} bpm</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">SpO2</span>
                      <span className="font-bold text-slate-900">{pt.vitals?.spo2 ? Math.round(pt.vitals.spo2) : '--'}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">Temp</span>
                      <span className="font-bold text-slate-900">{pt.vitals?.temperature ? Number(pt.vitals.temperature).toFixed(1) : '--'}°C</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenPrintDocument(pt.id || pt.patientId)}
                      title="Print Clinical Summary"
                      className="text-slate-400 hover:text-slate-700 p-1 rounded"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleOpenClinicalRecord(pt.id || pt.patientId)}
                      className="inline-flex items-center gap-1 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 shadow-2xs"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Open Clinical Dossier
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: APPOINTMENTS & PENDING CONSULTATIONS */}
      {/* ========================================================================= */}
      {activeTab === 'appointments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Outpatient Consultation Schedule</h3>
              <p className="text-xs text-slate-500">Scheduled visits, follow-up evaluations, and pending tasks</p>
            </div>
          </div>

          {pendingConsultations.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-dashed border-slate-200 bg-white p-8">
              <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-800">No Pending Consultations</h4>
              <p className="text-xs text-slate-500 mt-1">All outpatient appointments have been concluded.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingConsultations.map((apt) => (
                <div
                  key={apt.id || apt.appointmentId}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{apt.patientName}</h4>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Patient ID: <span className="font-mono">{apt.patientId}</span>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                      {apt.status}
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>{apt.appointmentDate} at <strong>{apt.appointmentTime}</strong></span>
                    </div>
                    <div>Department: {apt.department || 'General Medicine'}</div>
                    {apt.notes && <div className="text-slate-500 italic">"Reason: {apt.notes}"</div>}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                    <button
                      onClick={async () => {
                        await updateAppointmentStatus(apt.id || apt.appointmentId, { status: 'completed' });
                        toast.success('Consultation marked completed.');
                        loadOverview(true);
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Mark Completed
                    </button>
                    <button
                      onClick={() => handleOpenClinicalRecord(apt.patientId)}
                      className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 shadow-2xs"
                    >
                      Start Consultation
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: SENSOR ALERTS & TRIAGE QUEUE */}
      {/* ========================================================================= */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Emergency & Sensor Telemetry Alerts</h3>
              <p className="text-xs text-slate-500">Review, acknowledge, and take clinical action on active patient distress signals</p>
            </div>
            <button
              onClick={loadAlerts}
              className="inline-flex items-center gap-1 text-xs text-sky-600 font-semibold hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Alerts
            </button>
          </div>

          {alertsLoading ? (
            <div className="text-center py-12 text-xs text-slate-400">Loading alerts queue...</div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-dashed border-slate-200 bg-white p-8">
              <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-800">All Patient Telemetry Normal</h4>
              <p className="text-xs text-slate-500 mt-1">No pending emergency or high-risk vital alerts.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((al) => (
                <div
                  key={al.id || al.alertId}
                  className="rounded-2xl border border-red-200 bg-white p-5 shadow-xs space-y-3 hover:border-red-300 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                        <Siren className="h-5 w-5 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">{al.patientName}</h4>
                          <span className="font-mono text-xs text-slate-500">ID: {al.patientId}</span>
                          {al.isDirectlyAssigned && (
                            <span className="rounded-full bg-sky-100 text-sky-800 px-2 py-0.2 text-[10px] font-semibold">
                              Your Assigned Patient
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Alert Type: <strong className="text-red-700">{al.type}</strong> • Severity: <strong>{al.severity}</strong> • Triage: <strong>{al.triageStatus || 'PENDING_REVIEW'}</strong>
                        </div>
                      </div>
                    </div>

                    <span className="text-xs text-slate-400">
                      {al.timestamp ? new Date(al.timestamp).toLocaleString() : 'Recent'}
                    </span>
                  </div>

                  {al.notes && (
                    <div className="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-700 font-mono">
                      Doctor Clinical Notes: "{al.notes}"
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenClinicalRecord(al.patientId)}
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Open Patient Dossier
                    </button>
                    <button
                      onClick={() => {
                        setTriagingAlert(al);
                        setShowTriageModal(true);
                      }}
                      className="rounded-xl bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700 shadow-2xs"
                    >
                      Triage & Acknowledge
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: DETAILED PATIENT CLINICAL DOSSIER (ACCESS LEVEL B) */}
      {/* ========================================================================= */}
      {selectedPatientRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Dossier Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900">
                    {selectedPatientRecord.patient?.name}
                  </h3>
                  <span className="font-mono text-xs font-semibold bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                    {selectedPatientRecord.patient?.id || selectedPatientRecord.patient?.patientId}
                  </span>
                  {selectedPatientRecord.isEmergencyGrant && (
                    <span className="rounded-full bg-amber-100 text-amber-900 px-2.5 py-0.5 text-xs font-bold border border-amber-300">
                      ⚠️ Emergency Break-Glass Access
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Age: {selectedPatientRecord.patient?.age || 26} Yrs ({selectedPatientRecord.patient?.gender}) • Blood Group: <strong className="text-rose-600">{selectedPatientRecord.patient?.bloodGroup || 'B+'}</strong> • Allergies: {selectedPatientRecord.patient?.allergies || 'None'}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenPrintDocument(selectedPatientRecord.patient?.id || selectedPatientRecord.patient?.patientId)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Printer className="h-4 w-4" />
                  Print Document
                </button>
                <button
                  onClick={() => setSelectedPatientRecord(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowConsultationModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 shadow-2xs"
              >
                <Plus className="h-4 w-4" />
                Record Consultation & Diagnosis
              </button>
              <button
                onClick={() => {
                  setEditingPrescription(null);
                  setShowPrescriptionModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-2xs"
              >
                <Pill className="h-4 w-4" />
                Prescribe Medication
              </button>
            </div>

            {/* Dossier Tabs: Consultations, Prescriptions, Reports */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Consultations History */}
              <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-purple-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase">Consultations & Diagnoses</h4>
                  </div>
                  <span className="text-xs text-slate-400">
                    {selectedPatientRecord.consultations?.length || 0}
                  </span>
                </div>

                {!selectedPatientRecord.consultations || selectedPatientRecord.consultations.length === 0 ? (
                  <div className="text-xs text-slate-400 py-6 text-center">No consultation records on file.</div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {selectedPatientRecord.consultations.map((cons, idx) => (
                      <div key={cons.id || idx} className="rounded-xl bg-slate-50 p-3 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{cons.consultationDate} • Dr. {cons.attendingDoctor}</span>
                          <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[10px] font-semibold text-slate-700">{cons.status}</span>
                        </div>
                        <div><strong className="text-purple-700">Diagnosis:</strong> {cons.diagnosis}</div>
                        {cons.symptoms && <div className="text-slate-500">Symptoms: {cons.symptoms}</div>}
                        {cons.treatmentPlan && <div className="text-slate-700">Plan: {cons.treatmentPlan}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Prescriptions with Revision History */}
              <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Pill className="h-4 w-4 text-indigo-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase">Prescriptions & Audited Revisions</h4>
                  </div>
                  <span className="text-xs text-slate-400">
                    {selectedPatientRecord.prescriptions?.length || 0}
                  </span>
                </div>

                {!selectedPatientRecord.prescriptions || selectedPatientRecord.prescriptions.length === 0 ? (
                  <div className="text-xs text-slate-400 py-6 text-center">No active medication orders.</div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {selectedPatientRecord.prescriptions.map((rx, idx) => (
                      <div key={rx.id || rx.medicationId || idx} className="rounded-xl bg-slate-50 p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-slate-900">{rx.medicineName || rx.name}</div>
                          <span className="rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.2 text-[10px] font-mono font-bold">
                            Rev #{rx.revisionNumber || 1}
                          </span>
                        </div>
                        <div className="text-slate-700">
                          {rx.dosage} • {rx.frequency} • {rx.duration}
                        </div>
                        <div className="text-[11px] text-slate-500 italic">
                          "{rx.instructions || 'As directed'}"
                        </div>

                        {/* Revisions timeline if corrected */}
                        {rx.revisionHistory && rx.revisionHistory.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Audited Revisions:</span>
                            {rx.revisionHistory.map((rev, rIdx) => (
                              <div key={rIdx} className="text-[11px] text-slate-600 bg-white p-1.5 rounded border border-slate-200">
                                <strong>Rev {rev.revisionNumber} ({rev.revisedBy}):</strong> {rev.reasonForCorrection}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-end pt-1">
                          <button
                            onClick={() => {
                              setEditingPrescription(rx);
                              setPrescriptionForm({
                                medicineName: rx.medicineName || rx.name,
                                dosage: rx.dosage || '',
                                frequency: rx.frequency || 'Once Daily',
                                duration: rx.duration || '30 Days',
                                instructions: rx.instructions || '',
                                reasonForCorrection: '',
                              });
                              setShowPrescriptionModal(true);
                            }}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            Correct / Revise Dose →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: BREAK-GLASS EMERGENCY ACCESS */}
      {/* ========================================================================= */}
      {showBreakGlassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 border-2 border-amber-500">
            <div className="flex items-center gap-3 text-amber-700">
              <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Emergency Break-Glass Protocol</h3>
                <p className="text-xs text-amber-700 font-semibold">Immediate Clinical Override</p>
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1.5 leading-relaxed">
              <p>
                Patient: <strong>{breakGlassPatient?.name}</strong> (ID: {breakGlassPatient?.patientId || breakGlassPatient?.id})
              </p>
              <p>
                You are requesting emergency override access to an unassigned patient record in your hospital.
                This temporary access (2 hours) will be permanently recorded in the security audit trail and reported to
                clinical administration.
              </p>
            </div>

            <form onSubmit={handleSubmitBreakGlass} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Declared Clinical Justification (Required, min 8 chars)
                </label>
                <textarea
                  rows={3}
                  value={breakGlassReason}
                  onChange={(e) => setBreakGlassReason(e.target.value)}
                  placeholder="e.g. Acute ER trauma evaluation, attending physician unavailable..."
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Clinical Urgency</label>
                <select
                  value={breakGlassUrgency}
                  onChange={(e) => setBreakGlassUrgency(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                >
                  <option value="CRITICAL">Critical Emergency (Immediate Threat to Life)</option>
                  <option value="URGENT">Urgent Outpatient / Inpatient Evaluation</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBreakGlassModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={breakGlassLoading || breakGlassReason.trim().length < 8}
                  className="rounded-xl bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50 shadow-xs"
                >
                  {breakGlassLoading ? 'Authorizing...' : 'Authorize Emergency Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: RECORD CONSULTATION */}
      {/* ========================================================================= */}
      {showConsultationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Clinical Consultation</h3>
                <p className="text-xs text-slate-500">Official diagnosis & clinical treatment plan</p>
              </div>
              <button onClick={() => setShowConsultationModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConsultation} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Reported Symptoms</label>
                <input
                  type="text"
                  value={consultationForm.symptoms}
                  onChange={(e) => setConsultationForm({ ...consultationForm, symptoms: e.target.value })}
                  placeholder="e.g. Palpitations, mild exertional dyspnea"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Clinical Diagnosis (Required)
                </label>
                <input
                  type="text"
                  value={consultationForm.diagnosis}
                  onChange={(e) => setConsultationForm({ ...consultationForm, diagnosis: e.target.value })}
                  placeholder="e.g. Essential Hypertension Stage 1, Sinus Tachycardia"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Treatment Plan & Recommendations</label>
                <textarea
                  rows={2}
                  value={consultationForm.treatmentPlan}
                  onChange={(e) => setConsultationForm({ ...consultationForm, treatmentPlan: e.target.value })}
                  placeholder="e.g. Daily ambulatory BP log, sodium restriction, review in 14 days"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Clinical Department</label>
                <input
                  type="text"
                  value={consultationForm.department}
                  onChange={(e) => setConsultationForm({ ...consultationForm, department: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConsultationModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={consultationSaving}
                  className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {consultationSaving ? 'Saving...' : 'Finalize & Certify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: PRESCRIBE / AUDITABLE REVISION MODAL */}
      {/* ========================================================================= */}
      {showPrescriptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingPrescription ? 'Revise Prescription (Audited Correction)' : 'Prescribe New Medication'}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingPrescription
                    ? 'Finalized prescriptions cannot be silently overwritten; corrections are tracked.'
                    : 'Validated clinical prescription order'}
                </p>
              </div>
              <button onClick={() => setShowPrescriptionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePrescription} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Medication Name</label>
                <input
                  type="text"
                  value={prescriptionForm.medicineName}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, medicineName: e.target.value })}
                  placeholder="e.g. Telmisartan"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Dosage / Strength</label>
                  <input
                    type="text"
                    value={prescriptionForm.dosage}
                    onChange={(e) => setPrescriptionForm({ ...prescriptionForm, dosage: e.target.value })}
                    placeholder="e.g. 40mg"
                    required
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Frequency</label>
                  <select
                    value={prescriptionForm.frequency}
                    onChange={(e) => setPrescriptionForm({ ...prescriptionForm, frequency: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  >
                    {['Once Daily - Morning', 'Once Daily - Bedtime', 'Twice Daily', 'Thrice Daily', 'SOS / As Needed'].map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Duration</label>
                <input
                  type="text"
                  value={prescriptionForm.duration}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, duration: e.target.value })}
                  placeholder="e.g. 30 Days"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Doctor Instructions</label>
                <input
                  type="text"
                  value={prescriptionForm.instructions}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, instructions: e.target.value })}
                  placeholder="e.g. Take with water after breakfast"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs"
                />
              </div>

              {editingPrescription && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
                  <label className="text-xs font-bold text-indigo-950 block mb-1">
                    Clinical Reason for Correction (Strictly Required for Audit)
                  </label>
                  <input
                    type="text"
                    value={prescriptionForm.reasonForCorrection}
                    onChange={(e) => setPrescriptionForm({ ...prescriptionForm, reasonForCorrection: e.target.value })}
                    placeholder="e.g. Dosage adjusted from 20mg to 40mg following BP assessment"
                    required
                    className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPrescriptionModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={prescriptionSaving}
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {prescriptionSaving ? 'Saving...' : editingPrescription ? 'Sign & Log Revision' : 'Finalize Prescription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: ALERT TRIAGE & ACTION */}
      {/* ========================================================================= */}
      {showTriageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Clinical Alert Triage</h3>
                <p className="text-xs text-slate-500">Patient: {triagingAlert?.patientName} ({triagingAlert?.patientId})</p>
              </div>
              <button onClick={() => setShowTriageModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAlertTriage} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Triage Action</label>
                <select
                  value={triageAction}
                  onChange={(e) => setTriageAction(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                >
                  <option value="ACKNOWLEDGE">Acknowledge Alert (Under Observation)</option>
                  <option value="TAKE_ACTION">Clinical Action Taken (Medication/Intervention Initiated)</option>
                  <option value="RESOLVE">Resolve Alert (Patient Stabilized)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Clinical Action Notes</label>
                <textarea
                  rows={3}
                  value={triageNotes}
                  onChange={(e) => setTriageNotes(e.target.value)}
                  placeholder="Record physician actions, administered therapy, or patient guidance..."
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTriageModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={triageSaving}
                  className="rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {triageSaving ? 'Saving...' : 'Submit Triage Sign-off'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: CERTIFIED CLINICAL DOCUMENT (PRINT / PDF) */}
      {/* ========================================================================= */}
      {showPrintDocumentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 print:m-0 print:p-0 print:shadow-none">
            {documentLoading ? (
              <div className="text-center py-12 text-xs text-slate-400">Compiling certified document...</div>
            ) : clinicalDocument ? (
              <>
                {/* Header Letterhead */}
                <div className="border-b-2 border-slate-800 pb-4 flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">
                      {clinicalDocument.hospital?.name}
                    </h2>
                    <p className="text-xs text-slate-600 font-medium">Department of Clinical Medicine & Outpatient Services</p>
                    <p className="text-[11px] text-slate-500">
                      {clinicalDocument.hospital?.address} • Phone: {clinicalDocument.hospital?.phone}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-serif font-black text-sky-800">℞</span>
                    <div className="text-[10px] text-slate-400 mt-1">{clinicalDocument.documentId}</div>
                  </div>
                </div>

                {/* Patient & Doctor Demographics */}
                <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <div className="text-slate-400 font-semibold uppercase text-[10px]">Patient Information</div>
                    <div className="font-bold text-slate-900">{clinicalDocument.patient?.name}</div>
                    <div className="text-slate-600">ID: {clinicalDocument.patient?.id} • Age: {clinicalDocument.patient?.age} Yrs ({clinicalDocument.patient?.gender})</div>
                    <div className="text-slate-600">Blood Group: {clinicalDocument.patient?.bloodGroup} • Allergies: {clinicalDocument.patient?.allergies}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-semibold uppercase text-[10px]">Attending Clinician</div>
                    <div className="font-bold text-slate-900">Dr. {clinicalDocument.doctor?.name}</div>
                    <div className="text-slate-600">{clinicalDocument.doctor?.specialty} • {clinicalDocument.doctor?.department}</div>
                    <div className="text-slate-600">License: {clinicalDocument.doctor?.licenseNumber}</div>
                  </div>
                </div>

                {/* Latest Diagnosis & Plan */}
                {clinicalDocument.latestConsultation?.diagnosis && (
                  <div className="rounded-xl border border-purple-100 bg-purple-50/30 p-3.5 text-xs space-y-1">
                    <div className="font-bold text-purple-900 uppercase text-[10px]">Clinical Diagnosis & Treatment Plan</div>
                    <div className="font-bold text-slate-900">{clinicalDocument.latestConsultation.diagnosis}</div>
                    {clinicalDocument.latestConsultation.treatmentPlan && (
                      <div className="text-slate-700">Plan: {clinicalDocument.latestConsultation.treatmentPlan}</div>
                    )}
                  </div>
                )}

                {/* Prescriptions Table */}
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
                      {(clinicalDocument.activePrescriptions || []).map((rx, idx) => (
                        <tr key={idx}>
                          <td className="p-2 border font-bold">{idx + 1}</td>
                          <td className="p-2 border font-bold text-slate-900">
                            {rx.medicineName || rx.name} ({rx.dosage})
                            <div className="text-[10px] font-normal text-slate-500 italic mt-0.5">{rx.instructions}</div>
                          </td>
                          <td className="p-2 border">{rx.frequency}</td>
                          <td className="p-2 border">{rx.duration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Doctor Signature & Legal Verification */}
                <div className="pt-6 border-t border-slate-200 flex items-end justify-between text-xs">
                  <div className="text-[11px] text-slate-400 max-w-xs font-mono">
                    Official clinical documentation. Hash: {clinicalDocument.verificationHash}
                  </div>
                  <div className="text-center">
                    <div className="font-serif italic font-bold text-slate-800 text-sm">Dr. {clinicalDocument.doctor?.name}</div>
                    <div className="text-[10px] text-slate-400 border-t border-slate-300 pt-1 mt-1">Authorized Medical Signature</div>
                  </div>
                </div>

                {/* Print & Close Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 print:hidden">
                  <button
                    onClick={() => setShowPrintDocumentModal(false)}
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
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
