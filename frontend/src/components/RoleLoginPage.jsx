import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, HeartPulse, LoaderCircle, Lock, Mail, Phone, ShieldCheck } from 'lucide-react';
import { Button } from './Button';
import { getDashboardPathForRole, setAuthSession } from '../utils/auth';
import {
  confirmDoctorPasswordReset,
  loginDoctor,
  requestDoctorPasswordReset,
  signupDoctor,
} from '../services/api';

export function RoleLoginPage({ role, mode = 'login', title, subtitle, accent, ctaLabel = 'Login', helperCopy }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const emailPattern = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);
  const roleLabel = role === 'doctor' ? 'Doctor' : 'Patient';
  const isSignup = mode === 'signup';
  const selectionPath = isSignup ? '/signup' : '/login';
  const alternatePath = role === 'doctor'
    ? (isSignup ? '/login/doctor' : '/signup/doctor')
    : (isSignup ? '/login/patient' : '/signup/patient');

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!emailPattern.test(email)) {
      setError('Enter a valid email address.');
      return;
    }

    if (password.trim().length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (role === 'doctor' && isSignup && phone.trim().length < 8) {
      setError('Doctor phone number is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (role === 'doctor') {
        let result = null;
        if (isSignup) {
          result = await signupDoctor({
            name: email.split('@')[0],
            email,
            phone,
            password,
          });
        } else {
          result = await loginDoctor({ email, password });
        }

        const doctor = result?.doctor || null;
        const auth = result?.auth || null;

        setAuthSession({
          role,
          email: doctor?.email || email,
          name: doctor?.name || email.split('@')[0],
          phone: doctor?.phone || phone,
          token: auth?.token || '',
          tokenExpiresIn: auth?.expiresIn || 0,
        });
      } else {
        setAuthSession({
          role,
          email,
          name: email.split('@')[0],
        });
      }

      navigate(getDashboardPathForRole(role), { replace: true });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorReset = async (event) => {
    event.preventDefault();
    if (role !== 'doctor') {
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (!resetToken) {
        const result = await requestDoctorPasswordReset({ email });
        setResetToken(result?.token || '');
        return;
      }

      await confirmDoctorPasswordReset({
        email,
        token: resetToken,
        newPassword: resetPassword,
      });

      setShowReset(false);
      setResetPassword('');
      setResetToken('');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050816] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.34),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.3),transparent_32%),radial-gradient(circle_at_bottom,rgba(20,184,166,0.18),transparent_28%),linear-gradient(135deg,#020617_0%,#08101f_46%,#120b25_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />

      <motion.div
        className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="grid w-full gap-8 lg:grid-cols-[1fr_1.1fr]">
          <div className="flex flex-col justify-center gap-6">
            <Link to={selectionPath} className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 backdrop-blur-xl transition hover:bg-white/10">
              <ShieldCheck className="h-4 w-4 text-cyan-200" />
              Secure access
            </Link>

            <div className="space-y-4">
              <p className={`text-sm font-semibold uppercase tracking-[0.35em] ${accent}`}>{roleLabel} {isSignup ? 'Signup' : 'Login'}</p>
              <h1 className="max-w-xl font-display text-4xl font-bold leading-tight text-white md:text-6xl">{title}</h1>
              <p className="max-w-xl text-base leading-8 text-slate-300 md:text-lg">{subtitle}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                'Glassmorphism interface with clear hierarchy',
                'Smooth motion for high-trust clinical workflows',
                'Role-based dashboard redirect after sign in',
                'Mobile-friendly from login through monitoring',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-6 text-slate-200 backdrop-blur-xl">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <motion.div
            className="relative rounded-[2rem] border border-white/12 bg-white/8 p-5 shadow-[0_30px_120px_rgba(2,6,23,0.52)] backdrop-blur-2xl sm:p-7"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.05 }}
          >
            <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.12),transparent_32%)]" />

            <div className="relative">
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200">
                <HeartPulse className="h-4 w-4 text-cyan-200" />
                {helperCopy}
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <Field
                  label="Email"
                  type="email"
                  icon={<Mail className="h-4 w-4" />}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />

                <Field
                  label="Password"
                  type="password"
                  icon={<Lock className="h-4 w-4" />}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                />

                {role === 'doctor' && isSignup ? (
                  <Field
                    label="Phone"
                    type="tel"
                    icon={<Phone className="h-4 w-4" />}
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+91XXXXXXXXXX"
                  />
                ) : null}

                {error ? (
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {error}
                  </div>
                ) : null}

                <Button type="submit" size="lg" className="w-full justify-center rounded-2xl" disabled={loading}>
                  {loading ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      {isSignup ? 'Creating account...' : 'Signing in...'}
                    </>
                  ) : (
                    <>
                      {ctaLabel}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <p className="text-center text-sm leading-6 text-slate-300">
                  Continue to your {roleLabel.toLowerCase()} dashboard after authentication.
                </p>

                <p className="text-center text-sm leading-6 text-slate-300">
                  {isSignup ? 'Already have an account?' : 'Need a new account?'}{' '}
                  <Link to={alternatePath} className="font-semibold text-cyan-200 transition hover:text-cyan-100">
                    {isSignup ? 'Login' : 'Sign up'}
                  </Link>
                </p>

                {role === 'doctor' && !isSignup ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <button
                      type="button"
                      onClick={() => setShowReset((prev) => !prev)}
                      className="text-sm font-semibold text-cyan-200"
                    >
                      {showReset ? 'Hide reset password' : 'Forgot doctor password? Reset with email'}
                    </button>

                    {showReset ? (
                      <form className="mt-3 space-y-3" onSubmit={handleDoctorReset}>
                        <Field
                          label="Reset Token"
                          type="text"
                          icon={<ShieldCheck className="h-4 w-4" />}
                          value={resetToken}
                          onChange={(event) => setResetToken(event.target.value)}
                          placeholder="Token from email (auto-filled after request)"
                        />
                        <Field
                          label="New Password"
                          type="password"
                          icon={<Lock className="h-4 w-4" />}
                          value={resetPassword}
                          onChange={(event) => setResetPassword(event.target.value)}
                          placeholder="Enter new password"
                        />
                        <Button
                          type="submit"
                          variant="secondary"
                          disabled={
                            loading
                            || !email
                            || (!!resetToken && resetToken.trim().length < 10)
                            || (!!resetToken && resetPassword.trim().length < 6)
                          }
                        >
                          {resetToken ? 'Confirm Password Reset' : 'Send Reset Token'}
                        </Button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </form>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ label, icon, ...props }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-200">{label}</span>
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 backdrop-blur-xl transition focus-within:border-cyan-300/40 focus-within:ring-1 focus-within:ring-cyan-300/30">
        <span className="text-slate-400">{icon}</span>
        <input
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          {...props}
        />
      </div>
    </label>
  );
}
