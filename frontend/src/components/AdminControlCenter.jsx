import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Eye,
  FileText,
  Filter,
  KeyRound,
  Lock,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  createHospital,
  createHospitalAppointment,
  downloadAuditLogsCsv,
  downloadPatientsCsv,
  fetchAdminMetrics,
  fetchAuditLogs,
  fetchHospitalAppointments,
  fetchHospitalDepartments,
  fetchHospitalDoctors,
  fetchHospitalPatients,
  fetchHospitalTelemetryOverview,
  fetchHospitals,
  fetchPatientHistory,
  getAdminAccounts,
  provisionDoctor,
  provisionHospitalAdmin,
  reassignPatientDoctor,
  registerHospitalPatient,
  toggleAccountStatus,
  toggleHospitalStatus,
  updateAppointmentStatus,
  updateHospital,
  updateHospitalDoctor,
} from '../services/api';
import { clearAuthSession } from '../utils/auth';

export function AdminControlCenter({ session }) {
  const isSuperAdmin = session?.role === 'super_admin';
  const hospitalScope = session?.hospitalId || 'All Hospitals';

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Core Data Stores
  const [metrics, setMetrics] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [telemetry, setTelemetry] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('');

  // Modals & Active Selections
  const [showHospitalModal, setShowHospitalModal] = useState(false);
  const [editingHospital, setEditingHospital] = useState(null);
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [showHospitalAdminModal, setShowHospitalAdminModal] = useState(false);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassigningPatient, setReassigningPatient] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedPatientHistory, setSelectedPatientHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form States
  const [hospitalForm, setHospitalForm] = useState({
    name: '',
    hospitalId: '',
    city: '',
    state: '',
    phone: '',
    email: '',
    departments: 'Cardiology, General Medicine, Emergency Care, Pediatrics',
  });

  const [docForm, setDocForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    specialty: 'General Medicine',
    department: 'General Medicine',
    hospitalId: session?.hospitalId || 'HOSP-CITY-01',
  });

  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    hospitalId: '',
    hospitalName: '',
  });

  const [patientForm, setPatientForm] = useState({
    name: '',
    email: '',
    phone: '',
    age: '35',
    gender: 'male',
    bloodGroup: 'O+',
    address: '',
    assignedDoctorId: '',
    password: 'HealthCare@2026',
  });

  const [reassignForm, setReassignForm] = useState({
    doctorId: '',
    reason: 'Routine specialist transfer',
  });

  const [aptForm, setAptForm] = useState({
    patientId: '',
    doctorId: '',
    appointmentDate: new Date().toISOString().slice(0, 10),
    appointmentTime: '10:00 AM',
    type: 'Consultation',
    notes: '',
  });

  // Load all data
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [metricsRes, hospRes, docRes, patRes, aptRes, auditRes, telemRes] = await Promise.allSettled([
        fetchAdminMetrics(),
        fetchHospitals(),
        fetchHospitalDoctors(),
        fetchHospitalPatients({ limit: 100 }),
        fetchHospitalAppointments(),
        fetchAuditLogs({ limit: 50 }),
        fetchHospitalTelemetryOverview(),
      ]);

      if (metricsRes.status === 'fulfilled') setMetrics(metricsRes.value?.metrics || null);
      if (hospRes.status === 'fulfilled') setHospitals(hospRes.value?.hospitals || []);
      if (docRes.status === 'fulfilled') setDoctors(docRes.value?.doctors || []);
      if (patRes.status === 'fulfilled') setPatients(patRes.value?.patients || []);
      if (aptRes.status === 'fulfilled') setAppointments(aptRes.value?.appointments || []);
      if (auditRes.status === 'fulfilled') setAuditLogs(auditRes.value?.logs || []);
      if (telemRes.status === 'fulfilled') setTelemetry(telemRes.value || null);
    } catch (err) {
      toast.error('Failed to load administrative console data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // 1. Hospital Operations
  const handleCreateOrUpdateHospital = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      if (editingHospital) {
        await updateHospital(editingHospital.hospitalId, hospitalForm);
        toast.success(`Hospital ${hospitalForm.name} updated successfully.`);
      } else {
        await createHospital(hospitalForm);
        toast.success(`Hospital ${hospitalForm.name} created successfully.`);
      }
      setShowHospitalModal(false);
      setEditingHospital(null);
      setHospitalForm({
        name: '',
        hospitalId: '',
        city: '',
        state: '',
        phone: '',
        email: '',
        departments: 'Cardiology, General Medicine, Emergency Care, Pediatrics',
      });
      loadAllData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Hospital operation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleHospitalStatus = async (hospitalId, currentActive) => {
    try {
      await toggleHospitalStatus(hospitalId, !currentActive);
      toast.success(`Hospital ${currentActive ? 'deactivated' : 'activated'} successfully.`);
      loadAllData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Failed to toggle hospital status.');
    }
  };

  // 2. Doctor Operations
  const handleProvisionDoctor = async (e) => {
    e.preventDefault();
    if (!docForm.name || !docForm.email || !docForm.phone || !docForm.password) {
      toast.error('Please complete all required doctor fields.');
      return;
    }
    setActionLoading(true);
    try {
      await provisionDoctor(docForm);
      toast.success(`Doctor ${docForm.name} provisioned successfully.`);
      setShowDoctorModal(false);
      setDocForm({
        name: '',
        email: '',
        phone: '',
        password: '',
        specialty: 'General Medicine',
        department: 'General Medicine',
        hospitalId: session?.hospitalId || 'HOSP-CITY-01',
      });
      loadAllData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Failed to provision doctor.');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Hospital Admin Operations
  const handleProvisionHospitalAdmin = async (e) => {
    e.preventDefault();
    if (!adminForm.name || !adminForm.email || !adminForm.phone || !adminForm.password || !adminForm.hospitalId) {
      toast.error('Please complete all required hospital admin fields.');
      return;
    }
    setActionLoading(true);
    try {
      await provisionHospitalAdmin(adminForm);
      toast.success(`Hospital Administrator ${adminForm.name} provisioned successfully.`);
      setShowHospitalAdminModal(false);
      setAdminForm({
        name: '',
        email: '',
        phone: '',
        password: '',
        hospitalId: '',
        hospitalName: '',
      });
      loadAllData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Failed to provision hospital admin.');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Account Toggle Status
  const handleToggleAccount = async (targetType, targetId, currentActive) => {
    try {
      await toggleAccountStatus({ targetType, targetId, active: !currentActive });
      toast.success(`Account ${currentActive ? 'deactivated' : 'activated'} successfully.`);
      loadAllData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Failed to toggle account.');
    }
  };

  // 5. Patient Registration
  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    if (!patientForm.name || !patientForm.email || !patientForm.phone) {
      toast.error('Name, email, and phone are mandatory.');
      return;
    }
    setActionLoading(true);
    try {
      await registerHospitalPatient({
        ...patientForm,
        hospitalId: session?.hospitalId || 'HOSP-CITY-01',
      });
      toast.success(`Patient ${patientForm.name} registered successfully.`);
      setShowPatientModal(false);
      setPatientForm({
        name: '',
        email: '',
        phone: '',
        age: '35',
        gender: 'male',
        bloodGroup: 'O+',
        address: '',
        assignedDoctorId: '',
        password: 'HealthCare@2026',
      });
      loadAllData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Registration failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Patient Reassignment
  const handleReassignDoctor = async (e) => {
    e.preventDefault();
    if (!reassigningPatient || !reassignForm.doctorId) {
      toast.error('Select a destination physician.');
      return;
    }
    setActionLoading(true);
    try {
      await reassignPatientDoctor(reassigningPatient.patientId || reassigningPatient.id, reassignForm);
      toast.success(`Patient reassigned successfully.`);
      setShowReassignModal(false);
      setReassigningPatient(null);
      loadAllData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Reassignment failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Patient History Inspection
  const handleViewPatientHistory = async (patient) => {
    setSelectedPatientHistory(patient);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const res = await fetchPatientHistory(patient.patientId || patient.id);
      setSelectedPatientHistory({ ...patient, history: res?.history || [] });
    } catch (err) {
      toast.error('Could not load patient history trail.');
    } finally {
      setHistoryLoading(false);
    }
  };

  // 8. Schedule Appointment
  const handleCreateAppointment = async (e) => {
    e.preventDefault();
    if (!aptForm.patientId || !aptForm.doctorId || !aptForm.appointmentDate) {
      toast.error('Patient, Doctor, and Date are required.');
      return;
    }
    setActionLoading(true);
    try {
      await createHospitalAppointment(aptForm);
      toast.success('Appointment scheduled successfully.');
      setShowAppointmentModal(false);
      setAptForm({
        patientId: '',
        doctorId: '',
        appointmentDate: new Date().toISOString().slice(0, 10),
        appointmentTime: '10:00 AM',
        type: 'Consultation',
        notes: '',
      });
      loadAllData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Failed to schedule appointment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateAppointmentStatus = async (aptId, status) => {
    try {
      await updateAppointmentStatus(aptId, { status });
      toast.success(`Appointment marked as ${status}.`);
      loadAllData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Failed to update status.');
    }
  };

  // CSV Export Handlers
  const handleExportPatients = async () => {
    try {
      await downloadPatientsCsv();
      toast.success('Patient roster exported as CSV.');
    } catch (err) {
      toast.error('Failed to export patient records.');
    }
  };

  const handleExportAuditLogs = async () => {
    try {
      await downloadAuditLogsCsv();
      toast.success('Security audit logs exported as CSV.');
    } catch (err) {
      toast.error('Failed to export security logs.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                isSuperAdmin ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
              }`}>
                {isSuperAdmin ? 'Platform Super Admin' : 'Hospital Administrator'}
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {hospitalScope}
              </span>
            </div>
            <h1 className="text-2xl font-black text-[#0F2747] mt-1.5 tracking-tight">
              Enterprise Hospital Command Center
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-facility governance, verified patient registry, real telemetry, and cryptographic audit logs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAllData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => {
                clearAuthSession();
                window.location.href = '/login';
              }}
              className="px-3.5 py-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 text-xs font-semibold transition"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto gap-2 mt-4 pb-1 border-b border-slate-200 text-sm font-semibold">
          {[
            { id: 'overview', label: 'Platform & Metrics', icon: Activity },
            { id: 'hospitals', label: isSuperAdmin ? 'Hospitals Management' : 'Hospital Profile', icon: Building2 },
            { id: 'clinicians', label: 'Clinicians & Departments', icon: Stethoscope },
            { id: 'patients', label: 'Patient Registry', icon: Users },
            { id: 'appointments', label: 'Appointments Schedule', icon: Calendar },
            { id: 'audit', label: 'Security & Audit Logs', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
                  active
                    ? 'bg-[#0F2747] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto">
        {/* ================================================================= */}
        {/* TAB 1: OVERVIEW & REAL-TIME METRICS */}
        {/* ================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">Total Patients</p>
                    <h3 className="text-3xl font-black text-[#0F2747] mt-1">
                      {metrics?.patients?.total ?? patients.length}
                    </h3>
                    <p className="text-xs text-emerald-600 font-medium mt-1">
                      {metrics?.patients?.assigned ?? 0} assigned to care team
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">Active Clinicians</p>
                    <h3 className="text-3xl font-black text-[#0F2747] mt-1">
                      {metrics?.doctors?.active ?? doctors.filter((d) => d.isActive !== false).length}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Across {Object.keys(metrics?.doctors?.departmentBreakdown || {}).length} medical specialties
                    </p>
                  </div>
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">Appointments</p>
                    <h3 className="text-3xl font-black text-[#0F2747] mt-1">
                      {metrics?.appointments?.total ?? appointments.length}
                    </h3>
                    <p className="text-xs text-indigo-600 font-medium mt-1">
                      {metrics?.appointments?.scheduled ?? 0} scheduled upcoming
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                    <Calendar className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">Emergency Incidents</p>
                    <h3 className="text-3xl font-black text-rose-600 mt-1">
                      {telemetry?.activeEmergencyAlerts?.length ?? 0}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {telemetry?.totalEmergencyAlerts ?? 0} total lifetime alerts
                    </p>
                  </div>
                  <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Platform Super Admin: Hospital Network Table */}
            {isSuperAdmin && metrics?.hospitals && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-[#0F2747]">Federated Hospital Network</h2>
                    <p className="text-xs text-slate-500">Live operational telemetry across registered hospital facilities.</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingHospital(null);
                      setShowHospitalModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Register New Hospital
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="p-3">Hospital ID</th>
                        <th className="p-3">Facility Name</th>
                        <th className="p-3">Location</th>
                        <th className="p-3">Clinicians</th>
                        <th className="p-3">Patients</th>
                        <th className="p-3">Appointments</th>
                        <th className="p-3">Emergencies</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {metrics.hospitals.map((hosp) => (
                        <tr key={hosp.hospitalId} className="hover:bg-slate-50/80 transition">
                          <td className="p-3 font-mono font-bold text-indigo-700">{hosp.hospitalId}</td>
                          <td className="p-3 font-bold text-slate-800">{hosp.name}</td>
                          <td className="p-3 text-slate-600">{hosp.city || '—'}</td>
                          <td className="p-3 font-semibold text-slate-700">{hosp.doctorCount}</td>
                          <td className="p-3 font-semibold text-slate-700">{hosp.patientCount}</td>
                          <td className="p-3 font-semibold text-slate-700">{hosp.appointmentCount}</td>
                          <td className="p-3">
                            {hosp.emergencyCount > 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">
                                {hosp.emergencyCount} active
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                              hosp.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {hosp.isActive ? 'Active' : 'Deactivated'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Active Telemetry Alerts */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <AlertOctagon className="w-5 h-5 text-rose-600" />
                <h2 className="text-lg font-bold text-[#0F2747]">Active Clinical Emergencies & SOS Signals</h2>
              </div>
              {telemetry?.activeEmergencyAlerts && telemetry.activeEmergencyAlerts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {telemetry.activeEmergencyAlerts.map((alert) => (
                    <div key={alert.id} className="p-4 rounded-xl border border-rose-200 bg-rose-50/60">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-bold text-[10px] uppercase">
                            {alert.severity} • {alert.type}
                          </span>
                          <h4 className="font-bold text-slate-900 mt-2 text-sm">{alert.patientName || 'Emergency Patient'}</h4>
                          <p className="text-xs text-slate-600 font-mono">Patient ID: {alert.patientId}</p>
                          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(alert.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <span className="px-2 py-1 rounded-lg bg-rose-200 text-rose-900 text-xs font-bold animate-pulse">
                          {alert.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  All patient telemetry normal. No unresolved emergency alerts.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: HOSPITALS MANAGEMENT */}
        {/* ================================================================= */}
        {activeTab === 'hospitals' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#0F2747]">
                    {isSuperAdmin ? 'Federated Hospitals Directory' : 'Facility Profile & Configuration'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Configure institutional details, departments, and active operational status.
                  </p>
                </div>
                {isSuperAdmin && (
                  <button
                    onClick={() => {
                      setEditingHospital(null);
                      setHospitalForm({
                        name: '',
                        hospitalId: '',
                        city: '',
                        state: '',
                        phone: '',
                        email: '',
                        departments: 'Cardiology, General Medicine, Emergency Care, Pediatrics',
                      });
                      setShowHospitalModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Register Hospital
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hospitals.map((hosp) => (
                  <div key={hosp.hospitalId || hosp.id} className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs hover:border-indigo-200 transition">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-mono font-bold">
                          {hosp.hospitalId || hosp.id}
                        </span>
                        <h3 className="text-base font-bold text-[#0F2747] mt-1.5">{hosp.name}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {hosp.address ? `${hosp.address}, ` : ''}{hosp.city}, {hosp.state}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        hosp.isActive !== false && hosp.status !== 'deactivated'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {hosp.isActive !== false && hosp.status !== 'deactivated' ? 'Active' : 'Deactivated'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 text-center my-3">
                      <div>
                        <p className="text-[11px] text-slate-500 uppercase font-semibold">Clinicians</p>
                        <p className="text-base font-black text-slate-800">{hosp.doctorCount ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500 uppercase font-semibold">Patients</p>
                        <p className="text-base font-black text-slate-800">{hosp.patientCount ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500 uppercase font-semibold">Appointments</p>
                        <p className="text-base font-black text-slate-800">{hosp.appointmentCount ?? 0}</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-[11px] text-slate-500 font-semibold mb-1">Departments:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(hosp.departments || []).map((dept) => (
                          <span key={dept} className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] rounded-md font-medium">
                            {dept}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="text-[11px] text-slate-500">
                        {hosp.phone} • {hosp.email}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingHospital(hosp);
                            setHospitalForm({
                              name: hosp.name || '',
                              hospitalId: hosp.hospitalId || hosp.id,
                              city: hosp.city || '',
                              state: hosp.state || '',
                              phone: hosp.phone || '',
                              email: hosp.email || '',
                              departments: (hosp.departments || []).join(', '),
                            });
                            setShowHospitalModal(true);
                          }}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
                          title="Edit Hospital Profile"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {isSuperAdmin && (
                          <button
                            onClick={() => handleToggleHospitalStatus(hosp.hospitalId || hosp.id, hosp.isActive !== false && hosp.status !== 'deactivated')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                              hosp.isActive !== false && hosp.status !== 'deactivated'
                                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            {hosp.isActive !== false && hosp.status !== 'deactivated' ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: CLINICIANS & DEPARTMENTS */}
        {/* ================================================================= */}
        {activeTab === 'clinicians' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#0F2747]">Institutional Clinicians</h2>
                  <p className="text-xs text-slate-500">Authorized medical practitioners assigned to this facility.</p>
                </div>
                <div className="flex items-center gap-2">
                  {isSuperAdmin && (
                    <button
                      onClick={() => setShowHospitalAdminModal(true)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Provision Hospital Admin
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setDocForm({
                        name: '',
                        email: '',
                        phone: '',
                        password: '',
                        specialty: 'General Medicine',
                        department: 'General Medicine',
                        hospitalId: session?.hospitalId || 'HOSP-CITY-01',
                      });
                      setShowDoctorModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Provision Doctor Account
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Doctor</th>
                      <th className="p-3">Department & Specialty</th>
                      <th className="p-3">Hospital</th>
                      <th className="p-3">Contact</th>
                      <th className="p-3">Active Patients</th>
                      <th className="p-3">Account Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {doctors.map((doc) => {
                      const isActive = doc.isActive !== false && doc.status !== 'deactivated';
                      return (
                        <tr key={doc.id || doc.email} className="hover:bg-slate-50/80 transition">
                          <td className="p-3">
                            <p className="font-bold text-slate-900">{doc.name || 'Dr. Unspecified'}</p>
                            <p className="text-[11px] text-slate-500 font-mono">{doc.email}</p>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                              {doc.department || doc.specialty || 'General'}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-indigo-700 font-semibold">{doc.hospitalId || '—'}</td>
                          <td className="p-3 text-slate-600">{doc.phone || '—'}</td>
                          <td className="p-3 font-semibold text-slate-700">{doc.patientCount ?? 0}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                              isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {isActive ? 'Active' : 'Deactivated'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleToggleAccount('doctor', doc.id || doc.email, isActive)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                isActive
                                  ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
                              }`}
                            >
                              {isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: PATIENTS & CARE TEAM MANAGEMENT */}
        {/* ================================================================= */}
        {activeTab === 'patients' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#0F2747]">Patient Registry & Physician Assignment</h2>
                  <p className="text-xs text-slate-500">Verified patient roster, duplicate prevention checks, and transfer audits.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportPatients}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                  <button
                    onClick={() => {
                      setPatientForm({
                        name: '',
                        email: '',
                        phone: '',
                        age: '35',
                        gender: 'male',
                        bloodGroup: 'O+',
                        address: '',
                        assignedDoctorId: doctors[0]?.id || '',
                        password: 'HealthCare@2026',
                      });
                      setShowPatientModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Register New Patient
                  </button>
                </div>
              </div>

              {/* Patient Search Bar */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by Patient ID, Name, Phone, or Email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>

              {/* Patient Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Patient ID</th>
                      <th className="p-3">Name & Details</th>
                      <th className="p-3">Contact</th>
                      <th className="p-3">Assigned Physician</th>
                      <th className="p-3">Hospital</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Care Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {patients
                      .filter((p) => {
                        if (!searchQuery) return true;
                        const q = searchQuery.toLowerCase();
                        return (
                          (p.patientId || p.id || '').toLowerCase().includes(q) ||
                          (p.name || '').toLowerCase().includes(q) ||
                          (p.email || '').toLowerCase().includes(q) ||
                          (p.phone || '').toLowerCase().includes(q)
                        );
                      })
                      .map((pat) => {
                        const pid = pat.patientId || pat.id;
                        const isActive = pat.isActive !== false && pat.status !== 'deactivated';
                        return (
                          <tr key={pid} className="hover:bg-slate-50/80 transition">
                            <td className="p-3 font-mono font-bold text-indigo-700">{pid}</td>
                            <td className="p-3">
                              <p className="font-bold text-slate-900">{pat.name}</p>
                              <p className="text-[11px] text-slate-500">
                                Age {pat.age || '—'} • {pat.gender || '—'} • {pat.bloodGroup || '—'}
                              </p>
                            </td>
                            <td className="p-3">
                              <p className="text-slate-800">{pat.phone || '—'}</p>
                              <p className="text-[11px] text-slate-500">{pat.email || '—'}</p>
                            </td>
                            <td className="p-3">
                              <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-800 font-bold text-[11px]">
                                {pat.assignedDoctorName || pat.doctorName || 'Unassigned'}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-slate-600">{pat.hospitalId || '—'}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                                isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {isActive ? 'Active' : 'Deactivated'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setReassigningPatient(pat);
                                    setReassignForm({ doctorId: '', reason: 'Routine care transfer' });
                                    setShowReassignModal(true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-semibold"
                                  title="Reassign Physician"
                                >
                                  Reassign
                                </button>
                                <button
                                  onClick={() => handleViewPatientHistory(pat)}
                                  className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-semibold"
                                  title="Audit History"
                                >
                                  <FileText className="w-3.5 h-3.5 inline mr-1" />
                                  History
                                </button>
                                <button
                                  onClick={() => handleToggleAccount('patient', pid, isActive)}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-bold ${
                                    isActive ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                >
                                  {isActive ? 'Deactivate' : 'Activate'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 5: APPOINTMENTS SCHEDULE */}
        {/* ================================================================= */}
        {activeTab === 'appointments' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#0F2747]">Appointments & Clinical Consultations</h2>
                  <p className="text-xs text-slate-500">Track and schedule physician visits, diagnostic reviews, and emergencies.</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={appointmentStatusFilter}
                    onChange={(e) => setAppointmentStatusFilter(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">All Statuses</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="in-progress">In-Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <button
                    onClick={() => {
                      setAptForm({
                        patientId: patients[0]?.patientId || patients[0]?.id || '',
                        doctorId: doctors[0]?.id || '',
                        appointmentDate: new Date().toISOString().slice(0, 10),
                        appointmentTime: '10:00 AM',
                        type: 'Consultation',
                        notes: '',
                      });
                      setShowAppointmentModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Book Appointment
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Appointment ID</th>
                      <th className="p-3">Patient</th>
                      <th className="p-3">Doctor</th>
                      <th className="p-3">Date & Time</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Update Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {appointments
                      .filter((a) => !appointmentStatusFilter || (a.status || '').toLowerCase() === appointmentStatusFilter)
                      .map((apt) => (
                        <tr key={apt.id || apt.appointmentId} className="hover:bg-slate-50/80 transition">
                          <td className="p-3 font-mono font-bold text-indigo-700">{apt.id || apt.appointmentId}</td>
                          <td className="p-3">
                            <p className="font-bold text-slate-900">{apt.patientName}</p>
                            <p className="text-[11px] text-slate-500 font-mono">{apt.patientId}</p>
                          </td>
                          <td className="p-3">
                            <p className="font-bold text-slate-800">{apt.doctorName}</p>
                            <p className="text-[11px] text-slate-500">{apt.doctorSpecialty || 'General'}</p>
                          </td>
                          <td className="p-3">
                            <p className="font-semibold text-slate-800">{apt.appointmentDate}</p>
                            <p className="text-[11px] text-slate-500">{apt.appointmentTime}</p>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                              {apt.type || 'Consultation'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                              apt.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : apt.status === 'cancelled'
                                ? 'bg-rose-100 text-rose-800'
                                : apt.status === 'in-progress'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {apt.status || 'scheduled'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <select
                              value={apt.status || 'scheduled'}
                              onChange={(e) => handleUpdateAppointmentStatus(apt.id || apt.appointmentId, e.target.value)}
                              className="px-2 py-1 text-[11px] rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                            >
                              <option value="scheduled">Scheduled</option>
                              <option value="in-progress">In-Progress</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 6: SECURITY & AUDIT LOGS */}
        {/* ================================================================= */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#0F2747]">Immutable Security Audit Logs</h2>
                  <p className="text-xs text-slate-500">Cryptographically verifiable event log of all administrative actions and mutations.</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={auditActionFilter}
                    onChange={(e) => setAuditActionFilter(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">All Actions</option>
                    <option value="HOSPITAL_CREATED">HOSPITAL_CREATED</option>
                    <option value="HOSPITAL_UPDATED">HOSPITAL_UPDATED</option>
                    <option value="DOCTOR_PROVISIONED">DOCTOR_PROVISIONED</option>
                    <option value="PATIENT_REGISTERED">PATIENT_REGISTERED</option>
                    <option value="PATIENT_ASSIGNMENT_CHANGED">PATIENT_ASSIGNMENT_CHANGED</option>
                    <option value="APPOINTMENT_CREATED">APPOINTMENT_CREATED</option>
                    <option value="AUDIT_LOGS_EXPORTED">AUDIT_LOGS_EXPORTED</option>
                  </select>
                  <button
                    onClick={handleExportAuditLogs}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download CSV Audit Log
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Actor</th>
                      <th className="p-3">Target</th>
                      <th className="p-3">Hospital</th>
                      <th className="p-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {auditLogs
                      .filter((l) => !auditActionFilter || (l.action || '').toUpperCase() === auditActionFilter)
                      .map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-3 text-slate-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold">
                              {log.action}
                            </span>
                          </td>
                          <td className="p-3 text-slate-800">
                            <p className="font-semibold">{log.actorEmail || log.actorId}</p>
                            <p className="text-[10px] text-slate-400 uppercase">{log.actorRole}</p>
                          </td>
                          <td className="p-3 text-slate-600">
                            {log.targetType}: {log.targetId}
                          </td>
                          <td className="p-3 text-indigo-700 font-semibold">{log.hospitalId || '—'}</td>
                          <td className="p-3 text-slate-700 font-sans max-w-xs truncate" title={log.details}>
                            {log.details || '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* MODALS SECTION */}
      {/* ================================================================= */}

      {/* 1. Register / Edit Hospital Modal */}
      {showHospitalModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-[#0F2747]">
                {editingHospital ? 'Edit Hospital Facility' : 'Register New Hospital Facility'}
              </h3>
              <button onClick={() => setShowHospitalModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrUpdateHospital} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600">Hospital Legal Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metro Care Multi-Specialty Hospital"
                  value={hospitalForm.name}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, name: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              {!editingHospital && (
                <div>
                  <label className="text-xs font-bold text-slate-600">Hospital Identifier (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. HOSP-METRO-02 (leave blank to auto-generate)"
                    value={hospitalForm.hospitalId}
                    onChange={(e) => setHospitalForm({ ...hospitalForm, hospitalId: e.target.value })}
                    className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200 font-mono"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai"
                    value={hospitalForm.city}
                    onChange={(e) => setHospitalForm({ ...hospitalForm, city: e.target.value })}
                    className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">State / Province</label>
                  <input
                    type="text"
                    placeholder="e.g. Maharashtra"
                    value={hospitalForm.state}
                    onChange={(e) => setHospitalForm({ ...hospitalForm, state: e.target.value })}
                    className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600">Emergency Phone</label>
                  <input
                    type="text"
                    placeholder="+91..."
                    value={hospitalForm.phone}
                    onChange={(e) => setHospitalForm({ ...hospitalForm, phone: e.target.value })}
                    className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Administrative Email</label>
                  <input
                    type="email"
                    placeholder="admin@hospital.org"
                    value={hospitalForm.email}
                    onChange={(e) => setHospitalForm({ ...hospitalForm, email: e.target.value })}
                    className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Departments (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="Cardiology, General Medicine, Neurology, Pediatrics"
                  value={hospitalForm.departments}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, departments: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowHospitalModal(false)}
                  className="flex-1 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : editingHospital ? 'Save Changes' : 'Create Hospital'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Provision Doctor Modal */}
      {showDoctorModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-[#0F2747]">Provision Clinician Account</h3>
              <button onClick={() => setShowDoctorModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProvisionDoctor} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Dr. John Doe"
                  value={docForm.name}
                  onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600">Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="doctor@hospital.org"
                    value={docForm.email}
                    onChange={(e) => setDocForm({ ...docForm, email: e.target.value })}
                    className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="+919876543210"
                    value={docForm.phone}
                    onChange={(e) => setDocForm({ ...docForm, phone: e.target.value })}
                    className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600">Department</label>
                  <input
                    type="text"
                    placeholder="Cardiology"
                    value={docForm.department}
                    onChange={(e) => setDocForm({ ...docForm, department: e.target.value })}
                    className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Hospital ID</label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={docForm.hospitalId}
                    onChange={(e) => setDocForm({ ...docForm, hospitalId: e.target.value })}
                    className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 bg-slate-50 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Initial Password *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={docForm.password}
                  onChange={(e) => setDocForm({ ...docForm, password: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowDoctorModal(false)}
                  className="flex-1 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Provisioning...' : 'Provision Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Provision Hospital Admin Modal (Super Admin Only) */}
      {showHospitalAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-[#0F2747]">Provision Hospital Administrator</h3>
              <button onClick={() => setShowHospitalAdminModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProvisionHospitalAdmin} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600">Administrator Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={adminForm.name}
                  onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Assigned Hospital *</label>
                <select
                  required
                  value={adminForm.hospitalId}
                  onChange={(e) => {
                    const selHosp = hospitals.find((h) => (h.hospitalId || h.id) === e.target.value);
                    setAdminForm({
                      ...adminForm,
                      hospitalId: e.target.value,
                      hospitalName: selHosp?.name || '',
                    });
                  }}
                  className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="">Select Hospital Facility</option>
                  {hospitals.map((h) => (
                    <option key={h.hospitalId || h.id} value={h.hospitalId || h.id}>
                      {h.name} ({h.hospitalId || h.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600">Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="admin@hospital.org"
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                    className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="+919876543210"
                    value={adminForm.phone}
                    onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
                    className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Password *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowHospitalAdminModal(false)}
                  className="flex-1 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Provisioning...' : 'Provision Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Register Patient Modal */}
      {showPatientModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-[#0F2747]">Register New Verified Patient</h3>
              <button onClick={() => setShowPatientModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterPatient} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600">Patient Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ananya Sen"
                  value={patientForm.name}
                  onChange={(e) => setPatientForm({ ...patientForm, name: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="patient@example.com"
                    value={patientForm.email}
                    onChange={(e) => setPatientForm({ ...patientForm, email: e.target.value })}
                    className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="+919876543210"
                    value={patientForm.phone}
                    onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })}
                    className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600">Age</label>
                  <input
                    type="number"
                    value={patientForm.age}
                    onChange={(e) => setPatientForm({ ...patientForm, age: e.target.value })}
                    className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Gender</label>
                  <select
                    value={patientForm.gender}
                    onChange={(e) => setPatientForm({ ...patientForm, gender: e.target.value })}
                    className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Blood Group</label>
                  <input
                    type="text"
                    value={patientForm.bloodGroup}
                    onChange={(e) => setPatientForm({ ...patientForm, bloodGroup: e.target.value })}
                    className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Assign Treating Physician</label>
                <select
                  value={patientForm.assignedDoctorId}
                  onChange={(e) => setPatientForm({ ...patientForm, assignedDoctorId: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="">Unassigned</option>
                  {doctors.map((d) => (
                    <option key={d.id || d.email} value={d.id || d.email}>
                      {d.name} ({d.department || d.specialty || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPatientModal(false)}
                  className="flex-1 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Verifying & Registering...' : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Reassign Doctor Modal */}
      {showReassignModal && reassigningPatient && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-[#0F2747]">Reassign Treating Physician</h3>
              <button onClick={() => setShowReassignModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReassignDoctor} className="space-y-3">
              <div>
                <p className="text-xs text-slate-500">Patient:</p>
                <p className="text-sm font-bold text-slate-900">{reassigningPatient.name} ({reassigningPatient.patientId || reassigningPatient.id})</p>
                <p className="text-xs text-slate-500 mt-1">Current Physician:</p>
                <p className="text-xs font-semibold text-indigo-700">
                  {reassigningPatient.assignedDoctorName || reassigningPatient.doctorName || 'Unassigned'}
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Select New Physician *</label>
                <select
                  required
                  value={reassignForm.doctorId}
                  onChange={(e) => setReassignForm({ ...reassignForm, doctorId: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="">Choose Hospital Physician</option>
                  {doctors.map((d) => (
                    <option key={d.id || d.email} value={d.id || d.email}>
                      {d.name} ({d.department || d.specialty || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Clinical Reason for Transfer</label>
                <input
                  type="text"
                  placeholder="e.g. Specialty transfer, discharge follow-up"
                  value={reassignForm.reason}
                  onChange={(e) => setReassignForm({ ...reassignForm, reason: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowReassignModal(false)}
                  className="flex-1 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Updating...' : 'Confirm Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Patient Audit History Modal */}
      {showHistoryModal && selectedPatientHistory && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-[#0F2747]">
                  Patient Care History Trail: {selectedPatientHistory.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">Patient ID: {selectedPatientHistory.patientId || selectedPatientHistory.id}</p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {historyLoading ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                  Retrieving chronological care audit trail...
                </div>
              ) : selectedPatientHistory.history && selectedPatientHistory.history.length > 0 ? (
                selectedPatientHistory.history.map((hist, idx) => (
                  <div key={hist.id || idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                    <div className="flex justify-between items-start">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold uppercase tracking-wider">
                        {hist.eventType}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(hist.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 mt-2 font-medium">
                      Changed by: <span className="font-semibold text-slate-900">{hist.changedBy}</span> ({hist.changedByRole})
                    </p>
                    {hist.details && (
                      <pre className="mt-1.5 p-2 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-600 overflow-x-auto font-mono">
                        {typeof hist.details === 'object' ? JSON.stringify(hist.details, null, 2) : hist.details}
                      </pre>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-500">
                  No previous audit records logged for this patient.
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Schedule Appointment Modal */}
      {showAppointmentModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-[#0F2747]">Book Clinical Appointment</h3>
              <button onClick={() => setShowAppointmentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600">Patient *</label>
                <select
                  required
                  value={aptForm.patientId}
                  onChange={(e) => setAptForm({ ...aptForm, patientId: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="">Select Patient</option>
                  {patients.map((p) => (
                    <option key={p.patientId || p.id} value={p.patientId || p.id}>
                      {p.name} ({p.patientId || p.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Physician *</label>
                <select
                  required
                  value={aptForm.doctorId}
                  onChange={(e) => setAptForm({ ...aptForm, doctorId: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="">Select Doctor</option>
                  {doctors.map((d) => (
                    <option key={d.id || d.email} value={d.id || d.email}>
                      {d.name} ({d.department || d.specialty || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600">Date *</label>
                  <input
                    type="date"
                    required
                    value={aptForm.appointmentDate}
                    onChange={(e) => setAptForm({ ...aptForm, appointmentDate: e.target.value })}
                    className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Time</label>
                  <input
                    type="text"
                    placeholder="10:00 AM"
                    value={aptForm.appointmentTime}
                    onChange={(e) => setAptForm({ ...aptForm, appointmentTime: e.target.value })}
                    className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Consultation Type</label>
                <select
                  value={aptForm.type}
                  onChange={(e) => setAptForm({ ...aptForm, type: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="Consultation">Routine Consultation</option>
                  <option value="Follow-up">Post-Operative Follow-up</option>
                  <option value="Diagnostic">Diagnostic Review</option>
                  <option value="Emergency">Urgent Care Evaluation</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Clinical Notes</label>
                <input
                  type="text"
                  placeholder="Symptoms, previous prescriptions, etc."
                  value={aptForm.notes}
                  onChange={(e) => setAptForm({ ...aptForm, notes: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAppointmentModal(false)}
                  className="flex-1 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Scheduling...' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
