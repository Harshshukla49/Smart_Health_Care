import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2, Copy, LoaderCircle, ShieldAlert, ShieldCheck, UserPlus } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { createPatientAccount } from '../services/api';
import { getAuthSession } from '../utils/auth';
import { Navigate } from 'react-router-dom';

const initialForm = {
  name: '',
  age: '',
  gender: '',
  phone: '',
  email: '',
  symptoms: '',
  heartRate: '',
  spo2: '',
  temperature: '',
  ecgData: '',
  sosContactName: '',
  sosContactPhone: '',
  sosContactRelation: 'Brother',
};

const requiredFields = ['name', 'age', 'gender', 'phone', 'email', 'symptoms'];

export function AddPatient() {
  const navigate = useNavigate();
  const session = getAuthSession();

  // Role Guard: Only doctors can add patients
  if (!session || session.role !== 'doctor') {
    toast.error('Access Denied: Only licensed physicians can register new patients.');
    return <Navigate to="/dashboard" replace />;
  }

  const [formData, setFormData] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState(null);

  const canSubmit = useMemo(
    () => requiredFields.every((field) => String(formData[field] || '').trim() !== ''),
    [formData]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const copyText = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}`);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await createPatientAccount(formData);
      setCredentials(result.credentials);
      setFormData(initialForm);
      toast.success('Patient Created Successfully');
    } catch (requestError) {
      const message = requestError?.response?.data?.message || requestError?.message || 'Unable to create patient.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout
      role="doctor"
      title="Add New Patient"
      subtitle="Register an authorized patient record, configure SOS contact, and bind telemetry monitoring."
      backTo="/dashboard"
      backLabel="Back to Dashboard"
    >
      <Card className="p-6 sm:p-8 bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-600" />
              <span>Doctor Authorization Required</span>
            </div>
            <h2 className="mt-3 font-sans text-2xl sm:text-3xl font-bold text-slate-900">
              Patient Clinical Intake Form
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
              Create a secure patient profile with auto-generated credentials, baseline vitals, and designated SOS emergency contacts.
            </p>
          </div>

          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </Link>
        </div>

        {error ? (
          <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs sm:text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
          {/* Patient Details */}
          <Field label="Patient Full Name" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Akash Soni" />
          <Field label="Patient Age" name="age" type="number" value={formData.age} onChange={handleChange} placeholder="e.g. 24" />

          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Gender</span>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              required
            >
              <option value="" disabled>Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <Field label="Phone Number" name="phone" value={formData.phone} onChange={handleChange} placeholder="+91 98765 43210" />
          <Field label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="patient@email.com" />

          {/* SOS Emergency Contact Section */}
          <div className="sm:col-span-2 pt-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Designated SOS Emergency Contact (GPS Alerts)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field
                  label="Contact Full Name"
                  name="sosContactName"
                  value={formData.sosContactName}
                  onChange={handleChange}
                  placeholder="e.g. Rahul Soni"
                  required={false}
                />
                <Field
                  label="Emergency Phone"
                  name="sosContactPhone"
                  value={formData.sosContactPhone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  required={false}
                />
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">Relationship</span>
                  <select
                    name="sosContactRelation"
                    value={formData.sosContactRelation}
                    onChange={handleChange}
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
          </div>

          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-slate-700">Clinical Symptoms & Notes</span>
            <textarea
              name="symptoms"
              value={formData.symptoms}
              onChange={handleChange}
              rows={3}
              required
              placeholder="Describe initial symptoms, reasons for telemetry monitoring, or underlying conditions"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </label>

          <Field label="Heart Rate Baseline (BPM, Optional)" name="heartRate" type="number" value={formData.heartRate} onChange={handleChange} placeholder="72" required={false} />
          <Field label="SpO2 Baseline (%, Optional)" name="spo2" type="number" value={formData.spo2} onChange={handleChange} placeholder="98" required={false} />
          <Field label="Temperature Baseline (°C, Optional)" name="temperature" type="number" step="0.1" value={formData.temperature} onChange={handleChange} placeholder="36.7" required={false} />

          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-slate-700">Initial ECG Waveform Samples (Comma-separated, Optional)</span>
            <textarea
              name="ecgData"
              value={formData.ecgData}
              onChange={handleChange}
              rows={2}
              placeholder="e.g. 0.12, 0.45, -0.08, 0.22, 0.95, -0.15"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </label>

          <div className="sm:col-span-2 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">Scoped to physician ID and assigned cardiology department</span>
            <Button
              type="submit"
              disabled={loading || !canSubmit}
              className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold px-5 py-2.5 shadow-sm"
            >
              {loading ? <LoaderCircle className="h-4 w-4 animate-spin mr-1.5" /> : <UserPlus className="h-4 w-4 mr-1.5" />}
              {loading ? 'Creating Patient...' : 'Create Patient'}
            </Button>
          </div>
        </form>
      </Card>

      <AnimatePresence>
        {credentials ? (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 px-4 backdrop-blur-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-lg rounded-2xl border border-emerald-200 bg-white p-6 shadow-2xl"
              initial={{ scale: 0.95, y: 14 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 14 }}
            >
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-sans text-xl font-bold text-slate-900">Patient Created Successfully</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Store these login credentials now. Passwords are encrypted and shown only once.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-2.5">
                <CredentialRow
                  label="Patient ID"
                  value={credentials.patientId}
                  onCopy={() => copyText(credentials.patientId, 'Patient ID')}
                />
                <CredentialRow
                  label="Temporary Password"
                  value={credentials.password}
                  onCopy={() => copyText(credentials.password, 'Password')}
                />
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-2.5">
                <Button variant="secondary" onClick={() => setCredentials(null)} className="rounded-xl text-xs">
                  Close
                </Button>
                <Button onClick={() => navigate('/dashboard')} className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold">
                  Go to Dashboard
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function Field({ label, required = true, ...props }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      <input
        {...props}
        required={required}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      />
    </label>
  );
}

function CredentialRow({ label, value, onCopy }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-0.5 font-mono text-sm font-bold text-slate-900">{value}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={onCopy} className="rounded-lg text-xs">
        <Copy className="h-3.5 w-3.5 mr-1" />
        Copy
      </Button>
    </div>
  );
}
