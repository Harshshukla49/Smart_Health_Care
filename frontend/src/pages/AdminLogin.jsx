import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Hospital,
  KeyRound,
  Lock,
  Mail,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { loginAdmin } from '../services/api';
import { setAuthSession } from '../utils/auth';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both administrator email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await loginAdmin({ email, password });
      const admin = result?.admin;
      const auth = result?.auth;

      setAuthSession({
        role: admin.role, // 'super_admin' or 'hospital_admin'
        id: admin.id,
        adminId: admin.id,
        name: admin.name,
        email: admin.email,
        hospitalId: admin.hospitalId || '',
        hospitalName: admin.hospitalName || '',
        token: auth?.token || '',
        tokenExpiresIn: auth?.expiresIn || 0,
      });

      toast.success(`Welcome, ${admin.name}! Authenticated as ${admin.role === 'super_admin' ? 'Super Administrator' : 'Hospital Administrator'}.`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Administrator authentication failed.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F9FF] text-[#0F2747] font-sans antialiased">
      {/* Background Lighting */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-indigo-200/40 via-blue-100/30 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-gradient-to-tl from-purple-100/40 via-sky-100/30 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Top Header Navigation */}
      <div className="relative z-20 px-4 pt-6 sm:px-8 max-w-[1440px] mx-auto flex items-center justify-between">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
        >
          <ArrowLeft className="h-4 w-4 text-indigo-600" />
          <span>Role Selection</span>
        </Link>

        <div className="flex items-center gap-3">
          <LanguageSwitcher compact />
        </div>
      </div>

      <motion.div
        className="relative mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-lg items-center px-4 py-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="w-full rounded-3xl sm:rounded-[2.25rem] border border-slate-200/90 bg-white p-6 sm:p-10 shadow-[0_20px_60px_-15px_rgba(16,42,86,0.08)]">
          {/* Header */}
          <div className="text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 shadow-xs mb-4">
              <ShieldCheck className="h-7 w-7" />
            </span>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50/80 px-3 py-1 text-xs font-bold text-indigo-700">
              <Lock className="h-3.5 w-3.5" />
              <span>Privileged Administrator Portal</span>
            </div>
            <h1 className="mt-4 font-sans text-2xl sm:text-3xl font-extrabold text-[#0F2747] tracking-tight">
              Administrator Sign In
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-500">
              Authorized access for Super Administrators and Hospital Care Network Directors.
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-700"
            >
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Administrator Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@smarthealth.io"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-3 text-sm text-[#0F2747] placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Password
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-11 py-3 text-sm text-[#0F2747] placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm shadow-indigo-500/25 hover:bg-indigo-700 active:scale-[0.98] transition disabled:opacity-60"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>Authenticate & Enter Console</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Security Note */}
          <div className="mt-8 rounded-2xl border border-indigo-100/70 bg-indigo-50/40 p-4 text-xs text-slate-500">
            <p className="flex items-center gap-1.5 font-bold text-indigo-900 mb-1">
              <Shield className="h-3.5 w-3.5 text-indigo-600" />
              <span>Security & Audit Notice</span>
            </p>
            <p className="leading-relaxed">
              Administrative sessions are cryptographically signed and rate-limited. All clinician provisioning and account toggles are audited to ensure clinical traceability.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
