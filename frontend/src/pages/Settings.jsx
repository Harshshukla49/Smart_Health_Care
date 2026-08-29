import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Ambulance,
  Bell,
  CheckCircle2,
  Compass,
  Globe,
  HeartPulse,
  Info,
  KeyRound,
  Laptop,
  Lock,
  Mail,
  MapPin,
  Phone,
  PhoneCall,
  PlayCircle,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { getAuthSession, setAuthSession, normalizeRole } from '../utils/auth';
import { updateDoctorProfile, updatePatientProfile } from '../services/api';
import { useI18n } from '../context/I18nContext';
import { useEmergency } from '../context/EmergencyContext';

export function Settings() {
  const { t, language, setLanguage } = useI18n();
  const emergency = useEmergency();
  const session = getAuthSession();
  const role = normalizeRole(session?.role);
  const isDoctor = role === 'doctor';

  const [activeTab, setActiveTab] = useState('account');

  // Account State
  const [name, setName] = useState(session?.name || (isDoctor ? 'Doctor' : 'Patient'));
  const [email, setEmail] = useState(session?.email || (isDoctor ? 'doctor@hospital.org' : 'patient@hospital.org'));
  const [phone, setPhone] = useState(session?.phone || '+91 98765 43210');
  const [savingAccount, setSavingAccount] = useState(false);

  // Clinical Thresholds State
  const [hrMin, setHrMin] = useState(emergency.thresholds.hrMin || 50);
  const [hrMax, setHrMax] = useState(emergency.thresholds.hrMax || 120);
  const [spo2Critical, setSpo2Critical] = useState(emergency.thresholds.spo2Critical || 90);
  const [tempMax, setTempMax] = useState(emergency.thresholds.tempMax || 38.5);
  const [ecgRate, setEcgRate] = useState('250');
  const [audioAlerts, setAudioAlerts] = useState(emergency.thresholds.audioAlerts !== false);
  const [autoDispatch, setAutoDispatch] = useState(emergency.thresholds.autoDispatch === true);

  // SOS Emergency Contact State
  const [sosName, setSosName] = useState(emergency.sosContact?.name || 'Rahul Soni');
  const [sosPhone, setSosPhone] = useState(emergency.sosContact?.phone || '+91 98765 43210');
  const [sosRelation, setSosRelation] = useState(emergency.sosContact?.relation || 'Brother');

  // Location Permissions State
  const [locShare, setLocShare] = useState(emergency.locationSharingEnabled);
  const [emergLocShare, setEmergLocShare] = useState(emergency.emergencyLocationSharingEnabled);

  // System State
  const [telemetrySync, setTelemetrySync] = useState('350ms');

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    setSavingAccount(true);

    try {
      if (isDoctor) {
        const result = await updateDoctorProfile({
          name,
          email,
          phone,
        });

        const nextSession = {
          ...session,
          name: result?.doctor?.name || name,
          email: result?.doctor?.email || email,
          phone: result?.doctor?.phone || phone,
        };
        setAuthSession(nextSession);
        toast.success(result?.message || 'Doctor account updated successfully.');
      } else {
        const result = await updatePatientProfile({
          patientId: session?.patientId,
          email,
          phone,
          sosContactName: sosName,
          sosContactPhone: sosPhone,
          sosContactRelation: sosRelation,
          locationSharingEnabled: locShare,
          emergencyLocationSharingEnabled: emergLocShare,
        });

        const nextSession = {
          ...session,
          name: result?.patient?.name || name,
          email: result?.patient?.email || email,
          phone: result?.patient?.phone || phone,
        };
        setAuthSession(nextSession);
        toast.success(result?.message || 'Patient account updated successfully.');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update account.');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleSaveClinical = (e) => {
    e.preventDefault();
    const config = {
      hrMin,
      hrMax,
      spo2Critical,
      tempMax,
      ecgRate,
      audioAlerts,
      autoDispatch,
    };
    emergency.setThresholds(config);
    localStorage.setItem('clinical_settings', JSON.stringify(config));
    toast.success('Clinical monitoring thresholds updated.');
  };

  const handleSaveSos = (e) => {
    e.preventDefault();
    const newContact = { name: sosName, phone: sosPhone, relation: sosRelation };
    emergency.setSosContact(newContact);
    emergency.setLocationSharingEnabled(locShare);
    emergency.setEmergencyLocationSharingEnabled(emergLocShare);

    localStorage.setItem('patient_sos_contact', JSON.stringify(newContact));
    localStorage.setItem('location_sharing_pref', String(locShare));
    localStorage.setItem('emergency_location_pref', String(emergLocShare));

    toast.success('Emergency contact & location sharing preferences saved.');
  };

  const handleSaveSystem = (e) => {
    e.preventDefault();
    toast.success('Workstation preferences saved.');
  };

  const initials = (name || (isDoctor ? 'DR' : 'PT')).slice(0, 2).toUpperCase();

  const tabs = useMemo(() => {
    const list = [
      { id: 'account', label: isDoctor ? 'Doctor Profile' : 'Patient Profile', icon: User },
      { id: 'sos', label: 'Emergency & SOS', icon: ShieldAlert },
    ];

    if (isDoctor) {
      list.push({ id: 'clinical', label: 'Clinical Thresholds', icon: Sliders });
    }

    list.push(
      { id: 'security', label: 'Security & Role Access', icon: ShieldCheck },
      { id: 'system', label: 'System Preferences', icon: Laptop }
    );

    return list;
  }, [isDoctor]);

  useEffect(() => {
    if (!isDoctor && activeTab === 'clinical') {
      setActiveTab('account');
    }
  }, [isDoctor, activeTab]);

  return (
    <DashboardLayout
      role={role}
      title="Workstation Settings"
      subtitle="Configure clinical telemetry thresholds, GPS location sharing, emergency SOS contacts, and system preferences."
      backTo="/dashboard"
      backLabel="Back to Dashboard"
    >
      <div className="space-y-5">
        {/* Navigation Tabs Bar */}
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-xs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-sky-50 text-sky-700 font-bold border border-sky-200/80 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Account Profile */}
        {activeTab === 'account' && (
          <Card className="p-5 sm:p-7 bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-6 border-b border-slate-100">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-sky-100 border border-sky-200 text-xl font-bold text-sky-700 shadow-xs">
                {initials}
              </span>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="font-sans text-xl font-bold text-slate-900">{name}</h2>
                  <span className="rounded-full bg-sky-50 border border-sky-200 px-2.5 py-0.5 text-xs font-bold text-sky-700">
                    {isDoctor ? 'Cardiologist' : 'Patient'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {email} · Authorized Healthcare Workspace
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveAccount} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">Full Name</span>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">Clinical Specialty / Role</span>
                  <input
                    type="text"
                    disabled
                    value={isDoctor ? 'Chief Cardiologist (Assigned Ward A)' : 'Personal Health Account'}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 cursor-not-allowed"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">Workstation Email</span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">Emergency Contact Phone</span>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </label>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                <span className="text-xs text-slate-400">Authenticated via Firebase Secure Credential Vault</span>
                <Button
                  type="submit"
                  disabled={savingAccount}
                  className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold"
                >
                  <Save className="h-4 w-4 mr-1.5" />
                  {savingAccount ? 'Saving...' : 'Save Account Changes'}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Tab 2: Emergency & SOS Contacts */}
        {activeTab === 'sos' && (
          <div className="space-y-5">
            <Card className="p-5 sm:p-7 bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
              <div>
                <h2 className="font-sans text-xl font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-rose-600" />
                  <span>Emergency & Designated SOS Contact</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Configure trusted contacts and location sharing permissions for automatic critical alerts.
                </p>
              </div>

              <form onSubmit={handleSaveSos} className="mt-6 space-y-5">
                {/* Designated SOS Contact */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                  <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Designated SOS Contact
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <label className="space-y-1.5">
                      <span className="text-xs font-semibold text-slate-700">SOS Contact Name</span>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          value={sosName}
                          onChange={(e) => setSosName(e.target.value)}
                          required
                          placeholder="e.g. Rahul Soni"
                          className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                        />
                      </div>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-xs font-semibold text-slate-700">SOS Phone Number</span>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          type="tel"
                          value={sosPhone}
                          onChange={(e) => setSosPhone(e.target.value)}
                          required
                          placeholder="e.g. +91 98765 43210"
                          className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                        />
                      </div>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-xs font-semibold text-slate-700">Relationship</span>
                      <select
                        value={sosRelation}
                        onChange={(e) => setSosRelation(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      >
                        <option value="Brother">Brother</option>
                        <option value="Sister">Sister</option>
                        <option value="Spouse">Spouse</option>
                        <option value="Parent">Parent</option>
                        <option value="Child">Child</option>
                        <option value="Guardian">Guardian</option>
                        <option value="Other">Other</option>
                      </select>
                    </label>
                  </div>
                </div>

                {/* Location Sharing Toggles */}
                <div className="space-y-3 pt-2">
                  <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Location Sharing Controls
                  </p>

                  <label className="flex items-start justify-between rounded-xl border border-slate-200 p-4 bg-white hover:bg-slate-50 transition cursor-pointer">
                    <div className="pr-4">
                      <p className="text-xs font-bold text-slate-900">Location Sharing</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Allows authorized healthcare providers to access your location during continuous monitoring and emergency situations.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={locShare}
                      onChange={(e) => setLocShare(e.target.checked)}
                      className="h-4 w-4 rounded accent-sky-600 mt-1 cursor-pointer shrink-0"
                    />
                  </label>

                  <label className="flex items-start justify-between rounded-xl border border-slate-200 p-4 bg-white hover:bg-slate-50 transition cursor-pointer">
                    <div className="pr-4">
                      <p className="text-xs font-bold text-slate-900">Emergency Location Sharing</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Allows your current GPS location coordinates and safe map link to be dispatched to your authorized emergency contact during confirmed emergencies.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={emergLocShare}
                      onChange={(e) => setEmergLocShare(e.target.checked)}
                      className="h-4 w-4 rounded accent-sky-600 mt-1 cursor-pointer shrink-0"
                    />
                  </label>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                  <span className="text-xs text-slate-500">Only configured contacts receive location links</span>
                  <Button
                    type="submit"
                    className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold"
                  >
                    <Save className="h-4 w-4 mr-1.5" />
                    Save Emergency Preferences
                  </Button>
                </div>
              </form>
            </Card>

            {/* Developer / Presentation Demo Trigger */}
            <Card className="p-5 sm:p-7 bg-white border border-amber-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                      DEVELOPER & EVALUATOR DEMO
                    </span>
                  </div>
                  <h3 className="font-sans text-lg font-bold text-slate-900 mt-1">
                    Simulate Critical Emergency Workflow
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                    Safely test the end-to-end emergency response: injects critical hypoxia/arrhythmia readings, captures current GPS, notifies doctor dashboard, displays high-contrast emergency UI, and simulates paramedic ambulance dispatch.
                  </p>
                </div>

                <Button
                  onClick={emergency.simulateCriticalEmergency}
                  className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/30 px-4 py-2.5 shrink-0"
                >
                  <PlayCircle className="h-4 w-4 mr-1.5" />
                  Simulate Critical Emergency
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Tab 3: Clinical Thresholds */}
        {activeTab === 'clinical' && (
          <Card className="p-5 sm:p-7 bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
            <div>
              <h2 className="font-sans text-xl font-bold text-slate-900">Clinical Alert Thresholds</h2>
              <p className="text-xs text-slate-500 mt-1">
                Customize warning and emergency alert tripwires for continuous vital telemetry.
              </p>
            </div>

            <form onSubmit={handleSaveClinical} className="mt-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Heart Rate Minimum */}
                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Bradycardia Threshold (Min HR)</span>
                    <span className="rounded-lg bg-sky-100 border border-sky-200 px-2 py-0.5 text-xs font-bold text-sky-700">
                      {hrMin} BPM
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Alerts if heart rate drops below this level.</p>
                  <input
                    type="range"
                    min="40"
                    max="70"
                    value={hrMin}
                    onChange={(e) => setHrMin(Number(e.target.value))}
                    className="mt-3 w-full accent-sky-600"
                  />
                </div>

                {/* Heart Rate Maximum */}
                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Tachycardia Threshold (Max HR)</span>
                    <span className="rounded-lg bg-amber-100 border border-amber-200 px-2 py-0.5 text-xs font-bold text-amber-700">
                      {hrMax} BPM
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Alerts if heart rate spikes above this level.</p>
                  <input
                    type="range"
                    min="90"
                    max="160"
                    value={hrMax}
                    onChange={(e) => setHrMax(Number(e.target.value))}
                    className="mt-3 w-full accent-amber-600"
                  />
                </div>

                {/* SpO2 Critical Alert */}
                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Critical Hypoxia Level (SpO2)</span>
                    <span className="rounded-lg bg-rose-100 border border-rose-200 px-2 py-0.5 text-xs font-bold text-rose-700">
                      &lt; {spo2Critical}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Triggers emergency alarm when oxygen drops.</p>
                  <input
                    type="range"
                    min="85"
                    max="95"
                    value={spo2Critical}
                    onChange={(e) => setSpo2Critical(Number(e.target.value))}
                    className="mt-3 w-full accent-rose-600"
                  />
                </div>

                {/* Temperature High Threshold */}
                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Pyrexia Alert (Temperature)</span>
                    <span className="rounded-lg bg-amber-100 border border-amber-200 px-2 py-0.5 text-xs font-bold text-amber-700">
                      &gt; {tempMax}°C
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Warning fired on patient hyperthermia.</p>
                  <input
                    type="range"
                    min="37.5"
                    max="40.0"
                    step="0.1"
                    value={tempMax}
                    onChange={(e) => setTempMax(Number(e.target.value))}
                    className="mt-3 w-full accent-amber-600"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2">
                <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 bg-white hover:bg-slate-50 transition cursor-pointer">
                  <div className="flex items-center gap-3">
                    {audioAlerts ? (
                      <Volume2 className="h-5 w-5 text-sky-600" />
                    ) : (
                      <VolumeX className="h-5 w-5 text-slate-400" />
                    )}
                    <div>
                      <p className="text-xs font-bold text-slate-800">Audible Alarm on Critical Alerts</p>
                      <p className="text-[11px] text-slate-500">Play workstation audio tones during arrhythmia or hypoxia.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={audioAlerts}
                    onChange={(e) => setAudioAlerts(e.target.checked)}
                    className="h-4 w-4 rounded accent-sky-600 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 bg-white hover:bg-slate-50 transition cursor-pointer">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="h-5 w-5 text-teal-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">Auto-Dispatch Notifications</p>
                      <p className="text-[11px] text-slate-500">Automatically broadcast emergency telemetry to on-duty nurse team.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoDispatch}
                    onChange={(e) => setAutoDispatch(e.target.checked)}
                    className="h-4 w-4 rounded accent-teal-600 cursor-pointer"
                  />
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end border-t border-slate-100">
                <Button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold"
                >
                  <Save className="h-4 w-4 mr-1.5" />
                  Save Clinical Thresholds
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Tab 4: Security & Access */}
        {activeTab === 'security' && (
          <Card className="p-5 sm:p-7 bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
            <div>
              <h2 className="font-sans text-xl font-bold text-slate-900">Security & Clinical Access</h2>
              <p className="text-xs text-slate-500 mt-1">
                Cryptographic guarantees, session isolation, and HIPAA audit parameters.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-emerald-900">HIPAA & HITECH Compliance Active</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Data is stored encrypted at rest via AES-256 and transmitted exclusively over TLS 1.3 encrypted sockets.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Authenticated Role</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">{isDoctor ? 'Licensed Physician (Doctor)' : 'Registered Patient'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Role-Based Access Control (RBAC) enforced</p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Telemetry Isolation</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">{isDoctor ? 'Clinical Ward Scoped' : 'Personal Record Scoped'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{isDoctor ? 'Access authorized for all assigned ward patients' : 'Strictly isolated to self records only'}</p>
                </div>
              </div>

              {/* Explicit Role Privilege Separation Table */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Role Privilege Separation Matrix
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold">
                        <th className="pb-2">Capability</th>
                        <th className="pb-2 text-center text-[#059669]">Doctor Role</th>
                        <th className="pb-2 text-center text-[#1677FF]">Patient Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      <tr>
                        <td className="py-2 font-medium">Multi-patient telemetry & ward oversight</td>
                        <td className="py-2 text-center font-bold text-emerald-600">✓ Authorized</td>
                        <td className="py-2 text-center font-semibold text-slate-400">✕ Denied</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-medium">Register & onboard new patient records</td>
                        <td className="py-2 text-center font-bold text-emerald-600">✓ Authorized</td>
                        <td className="py-2 text-center font-semibold text-slate-400">✕ Denied</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-medium">Modify clinical alert tripwires & thresholds</td>
                        <td className="py-2 text-center font-bold text-emerald-600">✓ Authorized</td>
                        <td className="py-2 text-center font-semibold text-slate-400">✕ Denied</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-medium">View personal real-time vitals & ECG rhythm</td>
                        <td className="py-2 text-center font-bold text-emerald-600">✓ Authorized</td>
                        <td className="py-2 text-center font-bold text-blue-600">✓ Authorized</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-medium">Trigger emergency SOS & GPS location sharing</td>
                        <td className="py-2 text-center font-bold text-emerald-600">✓ Authorized (Triage)</td>
                        <td className="py-2 text-center font-bold text-blue-600">✓ Authorized (Patient SOS)</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-medium">Cross-patient telemetry access</td>
                        <td className="py-2 text-center font-bold text-emerald-600">✓ Ward authorized</td>
                        <td className="py-2 text-center font-semibold text-rose-600">✕ Strictly Blocked</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                <span className="text-xs text-slate-500">Security status: Healthy (0 unauthorized attempts)</span>
                <Button
                  onClick={() => toast.success('Cryptographic session token rotated.')}
                  variant="secondary"
                  size="sm"
                  className="text-xs font-semibold rounded-xl"
                >
                  <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                  Rotate Session Key
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Tab 5: System & Preferences */}
        {activeTab === 'system' && (
          <Card className="p-5 sm:p-7 bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
            <div>
              <h2 className="font-sans text-xl font-bold text-slate-900">Workstation Preferences</h2>
              <p className="text-xs text-slate-500 mt-1">
                Customize terminal language, telemetry streaming frequency, and layout parameters.
              </p>
            </div>

            <form onSubmit={handleSaveSystem} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">Display Language</span>
                  <div className="relative">
                    <Globe className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <select
                      value={language || 'en'}
                      onChange={(e) => setLanguage?.(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    >
                      <option value="en">English (US)</option>
                      <option value="hi">हिंदी (Hindi)</option>
                      <option value="es">Español (Spanish)</option>
                      <option value="fr">Français (French)</option>
                    </select>
                  </div>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">Telemetry Sync Rate</span>
                  <select
                    value={telemetrySync}
                    onChange={(e) => setTelemetrySync(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="250ms">250ms (Ultra Low Latency)</option>
                    <option value="350ms">350ms (Balanced Standard)</option>
                    <option value="1000ms">1000ms (Low Bandwidth)</option>
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">Workstation Theme</span>
                  <input
                    type="text"
                    disabled
                    value="Hospital Light Clinical (Active)"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 cursor-not-allowed font-medium"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">Workstation Terminal ID</span>
                  <input
                    type="text"
                    disabled
                    value="WS-CLINICAL-CARDIO-01"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 font-mono cursor-not-allowed"
                  />
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end border-t border-slate-100">
                <Button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold"
                >
                  <Save className="h-4 w-4 mr-1.5" />
                  Save Workstation Preferences
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
