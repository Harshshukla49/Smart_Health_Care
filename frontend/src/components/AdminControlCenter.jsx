import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  KeyRound,
  Lock,
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
  getAdminAccounts,
  getAdminStats,
  provisionDoctor,
  provisionHospitalAdmin,
  toggleAccountStatus,
} from '../services/api';
import { clearAuthSession } from '../utils/auth';

export function AdminControlCenter({ session }) {
  const isSuperAdmin = session?.role === 'super_admin';
  const hospitalScope = session?.hospitalId || 'All Hospitals';

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [accounts, setAccounts] = useState({ doctors: [], patients: [], admins: [] });
  const [filterRole, setFilterRole] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [showHospitalAdminModal, setShowHospitalAdminModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [docForm, setDocForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    specialty: 'General Medicine',
    hospitalId: session?.hospitalId || 'HOSP-01',
  });

  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    hospitalId: '',
    hospitalName: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, accountsRes] = await Promise.all([
        getAdminStats(),
        getAdminAccounts(),
      ]);
      setStats(statsRes?.stats || null);
      setAccounts({
        doctors: accountsRes?.doctors || [],
        patients: accountsRes?.patients || [],
        admins: accountsRes?.admins || [],
      });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load administrative accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
        hospitalId: session?.hospitalId || 'HOSP-01',
      });
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Doctor provisioning failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProvisionHospitalAdmin = async (e) => {
    e.preventDefault();
    if (!adminForm.name || !adminForm.email || !adminForm.password || !adminForm.hospitalId) {
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
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Hospital Admin provisioning failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (targetType, targetId, currentActive) => {
    const nextActive = !currentActive;
    const actionLabel = nextActive ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${actionLabel} account ${targetId}?`)) {
      return;
    }

    try {
      await toggleAccountStatus({
        targetType,
        targetId,
        active: nextActive,
      });
      toast.success(`Account ${actionLabel}d successfully.`);
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || `Failed to ${actionLabel} account.`);
    }
  };

  // Aggregate and filter accounts
  const allList = [
    ...accounts.admins.map((a) => ({ ...a, accountType: 'hospital_admin' })),
    ...accounts.doctors.map((d) => ({ ...d, accountType: 'doctor' })),
    ...accounts.patients.map((p) => ({ ...p, accountType: 'patient' })),
  ];

  const filteredAccounts = allList.filter((item) => {
    if (filterRole !== 'all' && item.accountType !== filterRole) {
      return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = String(item.name || '').toLowerCase().includes(term);
      const matchEmail = String(item.email || '').toLowerCase().includes(term);
      const matchId = String(item.id || item.patientId || item.doctorId || '').toLowerCase().includes(term);
      const matchHosp = String(item.hospitalId || '').toLowerCase().includes(term);
      return matchName || matchEmail || matchId || matchHosp;
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold backdrop-blur-md border border-white/15 text-indigo-200">
              <ShieldCheck className="h-4 w-4 text-indigo-300" />
              <span>{isSuperAdmin ? 'Root Super Administrator Console' : 'Hospital Clinical Admin Console'}</span>
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight">
              Administrator Control Center
            </h1>
            <p className="mt-1 text-sm text-indigo-200 max-w-xl">
              Centralized identity governance, role-based access control, and clinician credential provisioning.
            </p>
            <div className="mt-3 flex items-center gap-4 text-xs text-indigo-300">
              <span><strong>Scope:</strong> {session?.hospitalName || hospitalScope}</span>
              <span>•</span>
              <span><strong>Admin ID:</strong> {session?.id || session?.adminId}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowDoctorModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-900/30 transition active:scale-95"
            >
              <UserPlus className="h-4 w-4" />
              <span>Provision Doctor</span>
            </button>

            {isSuperAdmin && (
              <button
                onClick={() => setShowHospitalAdminModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-indigo-900/30 transition active:scale-95"
              >
                <Building2 className="h-4 w-4" />
                <span>Provision Hospital Admin</span>
              </button>
            )}

            <button
              onClick={loadData}
              title="Refresh Accounts"
              className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Doctors Provisioned</span>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <Stethoscope className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-[#0F2747]">{stats?.totalDoctors ?? accounts.doctors.length}</p>
          <p className="mt-1 text-xs text-slate-500">Authorized medical practitioners</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Registered Patients</span>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-[#1677FF]">
              <Users className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-[#0F2747]">{stats?.totalPatients ?? accounts.patients.length}</p>
          <p className="mt-1 text-xs text-slate-500">Monitored patient records</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Admin Accounts</span>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <Shield className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-[#0F2747]">{stats?.totalAdmins ?? accounts.admins.length}</p>
          <p className="mt-1 text-xs text-slate-500">Hospital & System Directors</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Access Security</span>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <Lock className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 text-lg font-bold text-emerald-600">Enforced RBAC</p>
          <p className="mt-1 text-xs text-slate-500">Rate-limited PBKDF2 Vault</p>
        </div>
      </div>

      {/* Accounts Directory */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <h3 className="text-xl font-extrabold text-[#0F2747]">Credentialed Accounts Directory</h3>
            <p className="text-xs text-slate-500 mt-0.5">Manage accounts, verify internal IDs, and toggle active status.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, email, ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs text-[#0F2747] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
              />
            </div>

            {/* Filter buttons */}
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-bold">
              {['all', 'doctor', 'patient', 'hospital_admin'].map((roleKey) => (
                <button
                  key={roleKey}
                  onClick={() => setFilterRole(roleKey)}
                  className={`rounded-lg px-3 py-1.5 capitalize transition ${
                    filterRole === roleKey ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {roleKey === 'hospital_admin' ? 'Admins' : `${roleKey}s`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-3 px-3">Account ID</th>
                <th className="py-3 px-3">Name & Email</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Hospital / Dept</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400">
                    No accounts found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account) => {
                  const accountId = account.id || account.patientId || account.doctorId || account.email;
                  const isActive = account.isActive !== false && account.status !== 'deactivated';
                  const roleBadgeStyles = {
                    super_admin: 'bg-purple-50 text-purple-700 border-purple-200',
                    hospital_admin: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                    doctor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    patient: 'bg-sky-50 text-sky-700 border-sky-200',
                  }[account.accountType || account.role] || 'bg-slate-50 text-slate-700 border-slate-200';

                  return (
                    <tr key={accountId} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-3 font-mono font-bold text-slate-700">
                        {accountId}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#0F2747]">{account.name || 'Unnamed'}</div>
                        <div className="text-slate-400 text-[11px]">{account.email || 'No email'}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${roleBadgeStyles}`}>
                          {account.accountType || account.role}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {account.hospitalName || account.hospitalId || account.specialty || 'General'}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                          {isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleToggleStatus(account.accountType, accountId, isActive)}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                            isActive
                              ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                              : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Provision Doctor */}
      {showDoctorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-[#0F2747]">
                <Stethoscope className="h-5 w-5 text-emerald-600" />
                <h3 className="font-extrabold text-lg">Provision Doctor Account</h3>
              </div>
              <button onClick={() => setShowDoctorModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleProvisionDoctor} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="Dr. Sarah Johnson"
                  value={docForm.name}
                  onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                  required
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-[#0F2747] focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Official Doctor Email</label>
                <input
                  type="email"
                  placeholder="sarah.johnson@hospital.org"
                  value={docForm.email}
                  onChange={(e) => setDocForm({ ...docForm, email: e.target.value })}
                  required
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-[#0F2747] focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Mobile Phone (E.164)</label>
                <input
                  type="text"
                  placeholder="+919876543210"
                  value={docForm.phone}
                  onChange={(e) => setDocForm({ ...docForm, phone: e.target.value })}
                  required
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-[#0F2747] focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Medical Specialty</label>
                <select
                  value={docForm.specialty}
                  onChange={(e) => setDocForm({ ...docForm, specialty: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-[#0F2747] focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                >
                  <option value="General Medicine">General Medicine</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="Pulmonology">Pulmonology</option>
                  <option value="Emergency Care">Emergency Care</option>
                  <option value="Neurology">Neurology</option>
                  <option value="Pediatrics">Pediatrics</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Hospital ID</label>
                <input
                  type="text"
                  value={docForm.hospitalId}
                  disabled={!isSuperAdmin}
                  onChange={(e) => setDocForm({ ...docForm, hospitalId: e.target.value })}
                  required
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-[#0F2747] bg-slate-50 disabled:opacity-75 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Initial Temporary Password (min 8 chars)</label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={docForm.password}
                  onChange={(e) => setDocForm({ ...docForm, password: e.target.value })}
                  required
                  minLength={8}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-[#0F2747] focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDoctorModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 p-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 rounded-xl bg-emerald-600 p-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {actionLoading ? 'Provisioning...' : 'Confirm Provisioning'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Provision Hospital Admin */}
      {showHospitalAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-[#0F2747]">
                <Building2 className="h-5 w-5 text-indigo-600" />
                <h3 className="font-extrabold text-lg">Provision Hospital Admin</h3>
              </div>
              <button onClick={() => setShowHospitalAdminModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleProvisionHospitalAdmin} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Administrator Name</label>
                <input
                  type="text"
                  placeholder="Director Robert Vance"
                  value={adminForm.name}
                  onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                  required
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-[#0F2747] focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="r.vance@cityhospital.org"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  required
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-[#0F2747] focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Hospital ID</label>
                <input
                  type="text"
                  placeholder="HOSP-CITY-01"
                  value={adminForm.hospitalId}
                  onChange={(e) => setAdminForm({ ...adminForm, hospitalId: e.target.value })}
                  required
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-[#0F2747] focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Hospital Legal Name</label>
                <input
                  type="text"
                  placeholder="City General Medical Center"
                  value={adminForm.hospitalName}
                  onChange={(e) => setAdminForm({ ...adminForm, hospitalName: e.target.value })}
                  required
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-[#0F2747] focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Initial Password (min 8 chars)</label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  required
                  minLength={8}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-[#0F2747] focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowHospitalAdminModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 p-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 rounded-xl bg-indigo-600 p-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {actionLoading ? 'Provisioning...' : 'Confirm Provisioning'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
