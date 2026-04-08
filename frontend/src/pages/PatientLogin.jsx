import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowRight, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Button } from '../components/Button';
import { confirmPatientPasswordReset, loginPatient, requestPatientPasswordReset } from '../services/api';
import { setAuthSession } from '../utils/auth';

export function PatientLogin() {
  const navigate = useNavigate();
  const [patientId, setPatientId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await loginPatient({ patientId, password });
      const patient = result?.patient;
      const auth = result?.auth;
      setAuthSession({
        role: 'patient',
        patientId: patient.patientId || patient.id,
        name: patient.name,
        email: patient.email,
        token: auth?.token || '',
        tokenExpiresIn: auth?.expiresIn || 0,
      });

      toast.success('Login successful');
      navigate('/dashboard/patient', { replace: true });
    } catch (requestError) {
      const message = requestError?.response?.data?.message || requestError?.message || 'Invalid Patient ID or password.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!resetToken) {
        const response = await requestPatientPasswordReset({
          patientId,
          email: resetEmail,
        });
        setResetToken(response?.token || '');
      } else {
        await confirmPatientPasswordReset({
          patientId,
          email: resetEmail,
          token: resetToken,
          newPassword,
        });
        setShowReset(false);
        setResetToken('');
        setNewPassword('');
      }
    } catch (requestError) {
      const message = requestError?.response?.data?.message || requestError?.message || 'Unable to reset password.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050816] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.34),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.3),transparent_32%),radial-gradient(circle_at_bottom,rgba(20,184,166,0.18),transparent_28%),linear-gradient(135deg,#020617_0%,#08101f_46%,#120b25_100%)]" />

      <motion.div
        className="relative mx-auto flex min-h-screen w-full max-w-2xl items-center px-4 py-10 sm:px-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="w-full rounded-[2rem] border border-white/12 bg-white/8 p-6 shadow-[0_30px_120px_rgba(2,6,23,0.5)] backdrop-blur-2xl sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200">
            <ShieldCheck className="h-4 w-4 text-cyan-200" />
            Patient secure login
          </div>

          <h1 className="mt-6 font-display text-4xl font-bold text-white">Patient Login</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">Sign in with the Patient ID and password shared by your doctor.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <Field
              label="Patient ID"
              value={patientId}
              onChange={(event) => setPatientId(event.target.value)}
              placeholder="PAT-2026-XXXX"
            />

            <Field
              label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
            />

            {error ? <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

            <Button type="submit" size="lg" className="w-full justify-center" disabled={loading || !patientId || !password}>
              {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {loading ? 'Signing in...' : 'Login'}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-300">
            Doctor login?{' '}
            <Link to="/login/doctor" className="font-semibold text-cyan-200 hover:text-cyan-100">
              Switch here
            </Link>
          </p>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
            <button
              type="button"
              onClick={() => setShowReset((prev) => !prev)}
              className="text-sm font-semibold text-cyan-200"
            >
              {showReset ? 'Hide password reset' : 'Forgot patient password? Reset with email'}
            </button>

            {showReset ? (
              <form className="mt-3 space-y-3" onSubmit={handleResetPassword}>
                <Field
                  label="Registered Email"
                  type="email"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  placeholder="patient@email.com"
                />
                <Field
                  label="Reset Token"
                  value={resetToken}
                  onChange={(event) => setResetToken(event.target.value)}
                  placeholder="Token from email"
                />
                <Field
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="New password"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  className="w-full justify-center"
                  disabled={
                    loading
                    || !patientId
                    || !resetEmail
                    || (!!resetToken && resetToken.trim().length < 10)
                    || (!!resetToken && newPassword.trim().length < 6)
                  }
                >
                  {resetToken ? 'Confirm Reset' : 'Send Reset Token'}
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ label, type = 'text', ...props }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-200">{label}</span>
      <input
        type={type}
        {...props}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
      />
    </label>
  );
}
