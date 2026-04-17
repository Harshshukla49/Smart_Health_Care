import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2, Copy, LoaderCircle, ShieldCheck, UserPlus } from 'lucide-react';
import { Button } from '../components/Button';
import { createPatientAccount } from '../services/api';

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
};

const requiredFields = ['name', 'age', 'gender', 'phone', 'email', 'symptoms'];

export function AddPatient() {
  const navigate = useNavigate();
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
    <div className="relative min-h-screen overflow-hidden bg-[#050816] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.34),transparent_30%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.26),transparent_32%),linear-gradient(135deg,#020617_0%,#08101f_48%,#0e1325_100%)]" />

      <motion.div
        className="relative mx-auto w-full max-w-6xl rounded-[2rem] border border-white/10 bg-white/8 p-5 shadow-[0_30px_120px_rgba(2,6,23,0.45)] backdrop-blur-2xl sm:p-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200">
              <ShieldCheck className="h-4 w-4" />
              Doctor Access
            </p>
            <h1 className="mt-4 font-display text-3xl font-bold text-white sm:text-5xl">Add New Patient</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Create a secure patient profile with auto-generated credentials. Baseline vitals and first insight are assigned from your dataset automatically.
            </p>
          </div>

          <Button as={Link} to="/dashboard/doctor" variant="secondary">
            Back to Dashboard
          </Button>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Patient Name" name="name" value={formData.name} onChange={handleChange} placeholder="Enter full name" />
          <Field label="Age" name="age" type="number" value={formData.age} onChange={handleChange} placeholder="Age" />

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-200">Gender</span>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
              required
            >
              <option value="" disabled>Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <Field label="Phone Number" name="phone" value={formData.phone} onChange={handleChange} placeholder="+91XXXXXXXXXX" />
          <Field label="Email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="patient@email.com" />

          <label className="space-y-2 sm:col-span-2">
            <span className="text-sm font-semibold text-slate-200">Symptoms</span>
            <textarea
              name="symptoms"
              value={formData.symptoms}
              onChange={handleChange}
              rows={4}
              required
              placeholder="Describe patient symptoms"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
            />
          </label>

          <Field label="Heart Rate (Optional Override)" name="heartRate" type="number" value={formData.heartRate} onChange={handleChange} placeholder="bpm" required={false} />
          <Field label="SpO2 (Optional Override)" name="spo2" type="number" value={formData.spo2} onChange={handleChange} placeholder="%" required={false} />
          <Field label="Temperature (Optional Override)" name="temperature" type="number" step="0.1" value={formData.temperature} onChange={handleChange} placeholder="°C" required={false} />

          <label className="space-y-2 sm:col-span-2">
            <span className="text-sm font-semibold text-slate-200">ECG Samples (Manual Optional)</span>
            <textarea
              name="ecgData"
              value={formData.ecgData}
              onChange={handleChange}
              rows={3}
              placeholder="Comma-separated ECG values, e.g. 0.12,0.45,-0.08,0.22"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
            />
          </label>

          <div className="sm:col-span-2">
            <Button type="submit" size="lg" disabled={loading || !canSubmit} className="w-full sm:w-auto">
              {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {loading ? 'Creating Patient...' : 'Create Patient'}
            </Button>
          </div>
        </form>
      </motion.div>

      <AnimatePresence>
        {credentials ? (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-xl rounded-[1.75rem] border border-emerald-300/20 bg-slate-900/95 p-6 shadow-[0_30px_120px_rgba(2,6,23,0.55)]"
              initial={{ scale: 0.95, y: 14 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 14 }}
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 h-6 w-6 text-emerald-300" />
                <div>
                  <h2 className="font-display text-3xl font-bold text-white">Patient Created Successfully</h2>
                  <p className="mt-2 text-sm text-slate-300">Store these credentials now. The password is shown only once.</p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <CredentialRow
                  label="Patient ID"
                  value={credentials.patientId}
                  onCopy={() => copyText(credentials.patientId, 'Patient ID')}
                />
                <CredentialRow
                  label="Password"
                  value={credentials.password}
                  onCopy={() => copyText(credentials.password, 'Password')}
                />
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => setCredentials(null)}>Close</Button>
                <Button onClick={() => navigate('/dashboard/doctor')}>Go to Doctor Dashboard</Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, required = true, ...props }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-slate-200">{label}</span>
      <input
        {...props}
        required={required}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
      />
    </label>
  );
}

function CredentialRow({ label, value, onCopy }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</p>
        <p className="mt-1 font-mono text-sm font-semibold text-white">{value}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={onCopy}>
        <Copy className="h-4 w-4" />
        Copy
      </Button>
    </div>
  );
}
