import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Heart,
  HeartPulse,
  Lock,
  LoaderCircle,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { Button } from '../components/Button';
import { OtpPasswordReset } from '../components/OtpPasswordReset';
import { useI18n } from '../context/I18nContext';
import { loginPatient } from '../services/api';
import { setAuthSession } from '../utils/auth';

export function PatientLogin() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [patientId, setPatientId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [heroImgLoaded, setHeroImgLoaded] = useState(true);

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
        phone: patient.phone,
        doctorId: patient.doctorId || patient.assignedDoctorId || '',
        doctorEmail: patient.doctorEmail || patient.doctorContact?.email || '',
        doctorName: patient.doctorName || patient.assignedDoctorName || patient.doctorContact?.name || '',
        doctorPhone: patient.doctorPhone || patient.doctorContact?.phone || '',
        doctorSpecialty: patient.doctorSpecialty || patient.doctorContact?.specialty || '',
        token: auth?.token || '',
        tokenExpiresIn: auth?.expiresIn || 0,
      });

      toast.success(t('auth.patientLogin.loginSuccess') || 'Welcome back!');
      navigate('/welcome', { replace: true });
    } catch (requestError) {
      const message =
        requestError?.response?.data?.message ||
        requestError?.message ||
        t('auth.patientLogin.invalidCredentials') ||
        'Invalid patient ID or password.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F9FF] text-[#0F2747] font-sans antialiased selection:bg-sky-100 selection:text-sky-900">
      {/* Background Ambience */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-blue-200/40 via-sky-100/30 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-gradient-to-tl from-teal-100/40 via-sky-100/30 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:radial-gradient(#1677FF_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Top Header Navigation */}
      <header className="relative z-20 px-4 pt-6 sm:px-8 max-w-[1440px] mx-auto flex items-center justify-between">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          aria-label="Back to role selection"
        >
          <ArrowLeft className="h-4 w-4 text-[#1677FF]" />
          <span>Back to Role Selection</span>
        </Link>

        {/* Branding Logo with Heart + ECG waveform */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#1677FF] to-[#0284C7] text-white shadow-sm shadow-blue-500/20">
            <Heart className="h-5 w-5 fill-white/20 stroke-white stroke-[2.2]" />
            <Activity className="absolute h-3.5 w-3.5 text-white animate-pulse" />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-sans text-sm font-extrabold tracking-tight text-[#0F2747]">
              Smart Healthcare
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#1677FF] hidden sm:block">
              Remote Monitor
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <motion.main
        className="relative mx-auto flex min-h-[calc(100vh-85px)] w-full max-w-[1400px] items-center px-4 py-8 sm:px-6 lg:px-10"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="grid w-full gap-8 lg:gap-12 lg:grid-cols-[1.15fr_1fr] items-center">
          
          {/* =========================================================
              LEFT COLUMN: Clinical Hero, Medical Image & Feature Cards
             ========================================================= */}
          <div className="flex flex-col justify-center gap-5 sm:gap-6">
            
            {/* Header badges & titles */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1 text-xs font-bold text-[#1677FF]">
                <ShieldCheck className="h-4 w-4" />
                <span>{t('auth.patientLogin.secureLogin') || 'Patient secure login'}</span>
              </div>

              <div className="mt-3">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#1677FF]">
                  {t('auth.patientLogin.patientAccess') || 'PATIENT ACCESS'}
                </p>
                <h1 className="mt-1.5 font-sans text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#0F2747] leading-snug">
                  {t('auth.patientLogin.title') || 'Continue to your health monitoring workspace.'}
                </h1>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600 max-w-xl">
                  {t('auth.patientLogin.subtitle') || 'Track vitals, view doctor updates, and receive secure care signals from one trusted workspace connected to your care team.'}
                </p>
              </div>
            </div>

            {/* =========================================================
                PROFESSIONAL MEDICAL HERO IMAGE WITH TELEMETRY OVERLAY
               ========================================================= */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative overflow-hidden rounded-[20px] border border-slate-200/90 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)] group"
            >
              {/* Image Container with 16:9 / responsive height */}
              <div className="relative h-56 sm:h-72 w-full overflow-hidden bg-slate-100">
                {heroImgLoaded ? (
                  <img
                    src="/assets/patient-remote-care.png"
                    alt="Doctor reviewing remote patient monitoring data and vital trends on clinical tablet"
                    className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    onError={() => setHeroImgLoaded(false)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-50 to-blue-100 p-6 text-center">
                    <div>
                      <HeartPulse className="mx-auto h-12 w-12 text-[#1677FF]" />
                      <p className="mt-2 text-xs font-bold text-[#0F2747]">Remote Patient Monitoring</p>
                      <p className="text-[11px] text-slate-500">Connected care telemetry with clinical supervision</p>
                    </div>
                  </div>
                )}

                {/* Subtle Decorative ECG Waveform along bottom edge */}
                <div
                  className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 w-full opacity-60 overflow-hidden"
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 500 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-full w-full preserve-3d"
                  >
                    <path
                      d="M0 20 L120 20 L130 10 L140 32 L150 4 L160 28 L170 20 L270 20 L280 12 L290 30 L300 6 L310 26 L320 20 L500 20"
                      stroke="#0284C7"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                {/* Floating Health Monitoring Telemetry Card Overlay */}
                <motion.div
                  initial={{ y: 6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 rounded-xl border border-white/80 bg-white/95 p-3 sm:p-3.5 shadow-lg backdrop-blur-md max-w-[240px] text-left"
                >
                  <div className="flex items-center gap-1.5 text-[#1677FF]">
                    <Heart className="h-3.5 w-3.5 fill-[#1677FF]" />
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0F2747]">
                      Live Monitoring
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 text-left">
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">Heart Rate</p>
                      <p className="text-xs sm:text-sm font-bold text-[#0F2747]">72 BPM</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">SpO₂</p>
                      <p className="text-xs sm:text-sm font-bold text-[#059669]">98%</p>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Monitoring Active</span>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Feature Cards Grid */}
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-2xs transition hover:border-blue-200 hover:shadow-xs">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-[#1677FF]">
                  <Activity className="h-4 w-4" />
                </span>
                <p className="mt-3 text-xs sm:text-sm font-bold text-[#0F2747]">
                  {t('auth.patientLogin.feature1Title') || 'Live Vitals Timeline'}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  {t('auth.patientLogin.feature1Desc') || 'Monitor your latest trends with clear status visibility.'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-2xs transition hover:border-teal-200 hover:shadow-xs">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-teal-600">
                  <HeartPulse className="h-4 w-4" />
                </span>
                <p className="mt-3 text-xs sm:text-sm font-bold text-[#0F2747]">
                  {t('auth.patientLogin.feature2Title') || 'Care Notes Feed'}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  {t('auth.patientLogin.feature2Desc') || 'Review guidance and updates shared by your doctor.'}
                </p>
              </div>
            </div>

            {/* 3 Compact Trust Cards */}
            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t('auth.patientLogin.sessionSecurity') || 'Session Security'}
                </p>
                <p className="text-xs font-bold text-[#0F2747] mt-0.5">
                  {t('auth.patientLogin.protectedAccess') || 'Protected Access'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t('auth.patientLogin.monitoringScope') || 'Monitoring Scope'}
                </p>
                <p className="text-xs font-bold text-[#0F2747] mt-0.5">
                  {t('auth.patientLogin.personalizedView') || 'Personalized View'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t('auth.patientLogin.careCoordination') || 'Care Coordination'}
                </p>
                <p className="text-xs font-bold text-[#0F2747] mt-0.5">
                  {t('auth.patientLogin.doctorSynced') || 'Doctor Synced'}
                </p>
              </div>
            </div>
          </div>

          {/* =========================================================
              RIGHT COLUMN: Patient Login Form Card
             ========================================================= */}
          <div className="w-full rounded-3xl sm:rounded-[2.25rem] border border-slate-200/90 bg-white p-6 sm:p-10 shadow-[0_20px_60px_-15px_rgba(16,42,86,0.08)]">
            
            {/* Form Header with small medical heart badge */}
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 border border-sky-200 text-[#1677FF] shadow-xs">
                <Heart className="h-6 w-6 fill-sky-100 text-[#1677FF]" />
              </span>
              <div className="text-left">
                <h2 className="font-sans text-2xl font-extrabold text-[#0F2747]">
                  {t('auth.patientLogin.formTitle') || 'Patient Login'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('auth.patientLogin.formSubtitle') || 'Sign in with your patient ID and password to access your health records.'}
                </p>
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="mt-7 space-y-4 text-left">
              <Field
                label={t('auth.patientLogin.patientId') || 'Patient ID'}
                value={patientId}
                onChange={(event) => setPatientId(event.target.value)}
                placeholder="PAT-2026-2007"
              />

              <Field
                label={t('auth.rolePage.password') || 'Password'}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />

              {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="w-full justify-center bg-[#1677FF] hover:bg-blue-600 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/25 py-3 transition-all"
                disabled={loading || !patientId || !password}
              >
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {loading ? (t('auth.patientLogin.signingIn') || 'Signing in...') : (t('auth.patientLogin.login') || 'Login')}
              </Button>
            </form>

            {/* Switch to Doctor Login */}
            <p className="mt-5 text-center text-xs text-slate-500">
              {t('auth.patientLogin.doctorLoginPrompt') || 'Are you a clinician?'}{' '}
              <Link to="/login/doctor" className="font-bold text-[#1677FF] hover:text-blue-700 hover:underline">
                {t('auth.patientLogin.switchHere') || 'Switch to Doctor Login'}
              </Link>
            </p>

            {/* OTP Password Recovery */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <OtpPasswordReset role="patient" />
            </div>
          </div>

        </div>
      </motion.main>
    </div>
  );
}

function Field({ label, type = 'text', ...props }) {
  return (
    <label className="block space-y-1.5 text-left">
      <span className="text-xs font-bold text-slate-700">{label}</span>
      <input
        type={type}
        {...props}
        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-[#0F2747] placeholder:text-slate-400 outline-none transition focus:border-[#1677FF] focus:bg-white focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}
