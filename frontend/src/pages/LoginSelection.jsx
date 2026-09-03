import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Heart,
  HeartPulse,
  Lock,
  Radio,
  Shield,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  Users,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '../context/I18nContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export function LoginSelection() {
  const { t } = useI18n();
  const [heroImgLoaded, setHeroImgLoaded] = useState(true);
  const [patientImgLoaded, setPatientImgLoaded] = useState(true);
  const [doctorImgLoaded, setDoctorImgLoaded] = useState(true);

  React.useEffect(() => {
    toast.dismiss();
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F9FF] text-[#0F2747] font-sans antialiased selection:bg-sky-100 selection:text-sky-900">
      {/* Subtle Background Glows and Decorative Medical Grid */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-blue-200/40 via-sky-100/30 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-gradient-to-tl from-teal-100/40 via-sky-100/30 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:radial-gradient(#1677FF_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] items-center px-4 py-8 sm:px-6 lg:px-10">
        <div className="grid w-full grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* =========================================================
              LEFT SIDE: Healthcare Branding & Visual Hero (~42% Width)
             ========================================================= */}
          <motion.div
            className="lg:col-span-5 flex flex-col justify-between space-y-6 lg:space-y-8"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            {/* Logo / Header */}
            <div>
              <div className="inline-flex items-center gap-3">
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1677FF] to-[#0284C7] text-white shadow-md shadow-blue-500/25">
                  <Heart className="h-6 w-6 fill-white/20 stroke-white stroke-[2.2]" />
                  <Activity className="absolute h-4 w-4 text-white animate-pulse" />
                </div>
                <div>
                  <span className="block font-sans text-lg font-extrabold tracking-tight text-[#0F2747]">
                    SMART HEALTHCARE
                  </span>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-[#1677FF]">
                    Remote Monitor
                  </span>
                </div>
              </div>

              {/* Main Headline */}
              <h1 className="mt-6 font-sans text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#0F2747] leading-[1.15]">
                Smarter Monitoring.{' '}
                <span className="text-[#1677FF] block sm:inline">
                  Better Care.
                </span>
              </h1>

              <p className="mt-3.5 text-sm sm:text-base leading-relaxed text-slate-600 max-w-lg">
                Real-time monitoring, AI-powered insights, and seamless care coordination — all in one secure healthcare workspace.
              </p>
            </div>

            {/* 3 Key Healthcare Features */}
            <div className="space-y-3.5">
              {/* Feature 1 */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-slate-200/80 bg-white/80 p-3.5 shadow-2xs backdrop-blur-xs transition hover:border-blue-200 hover:bg-white">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#1677FF]">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <h4 className="font-sans text-xs sm:text-sm font-bold text-[#0F2747]">
                    Secure & Compliant
                  </h4>
                  <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">
                    Protected healthcare access with role-based security and HIPAA standards.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-slate-200/80 bg-white/80 p-3.5 shadow-2xs backdrop-blur-xs transition hover:border-sky-200 hover:bg-white">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600">
                  <HeartPulse className="h-5 w-5" />
                </span>
                <div>
                  <h4 className="font-sans text-xs sm:text-sm font-bold text-[#0F2747]">
                    Real-time Monitoring
                  </h4>
                  <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">
                    Live tracking of vitals, continuous ECG waveforms, and predictive health metrics.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-slate-200/80 bg-white/80 p-3.5 shadow-2xs backdrop-blur-xs transition hover:border-teal-200 hover:bg-white">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-600">
                  <Users className="h-5 w-5" />
                </span>
                <div>
                  <h4 className="font-sans text-xs sm:text-sm font-bold text-[#0F2747]">
                    Connected Care
                  </h4>
                  <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">
                    Patients, doctors, and emergency response teams connected in one unified workspace.
                  </p>
                </div>
              </div>
            </div>

            {/* High-Quality Medical Hero Image Card */}
            <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)] group">
              <div className="relative h-48 sm:h-56 w-full overflow-hidden bg-slate-100">
                {heroImgLoaded ? (
                  <img
                    src="/assets/medical-doctor.png"
                    alt="Professional cardiologist with clinical tablet in modern cardiology ward"
                    className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    onError={() => setHeroImgLoaded(false)}
                  />
                ) : (
                  /* Fallback SVG if image not found */
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-50 to-blue-100 p-6 text-center">
                    <div>
                      <Stethoscope className="mx-auto h-12 w-12 text-[#1677FF]" />
                      <p className="mt-2 text-xs font-bold text-[#0F2747]">Remote Patient Monitoring Station</p>
                      <p className="text-[11px] text-slate-500">Continuous clinical cardiology telemetry</p>
                    </div>
                  </div>
                )}

                {/* Floating Telemetry Badge Overlay */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl border border-white/80 bg-white/95 px-3.5 py-2 shadow-md backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        WARD 4A · CARDIOLOGY
                      </p>
                      <p className="text-xs font-bold text-[#0F2747]">
                        Live Patient Telemetry Active
                      </p>
                    </div>
                  </div>
                  <span className="rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-[#1677FF]">
                    250 Hz
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* =========================================================
              RIGHT SIDE: Authentication & Role Selection (~58% Width)
             ========================================================= */}
          <motion.div
            className="lg:col-span-7"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
          >
            <div className="relative rounded-3xl sm:rounded-[2.25rem] border border-slate-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-[0_20px_60px_-15px_rgba(16,42,86,0.08)]">
              
              {/* Top Security & Language Bar */}
              <div className="flex items-center justify-between gap-3 pb-6 border-b border-slate-100">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Welcome Back</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full">
                    <Lock className="h-3 w-3 text-slate-400" />
                    <span>Secure TLS 1.3 Connection</span>
                  </span>

                  <LanguageSwitcher compact />
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="mt-6">
                <h2 className="font-sans text-2xl sm:text-3xl font-extrabold text-[#0F2747] tracking-tight">
                  Sign in to your healthcare workspace
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed">
                  Choose your role to access the tools and information relevant to your care.
                </p>
              </div>

              {/* Two Role Cards: Patient & Doctor */}
              <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
                
                {/* 1. PATIENT LOGIN CARD */}
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="group flex flex-col justify-between rounded-2xl border-2 border-sky-100 bg-[#F5F9FF] p-5 transition-all hover:border-[#1677FF] hover:bg-[#EDF5FF] hover:shadow-[0_12px_30px_rgba(22,119,255,0.08)]"
                >
                  <div>
                    {/* Top Row: Icon + Badge */}
                    <div className="flex items-center justify-between">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white border border-sky-200 text-[#1677FF] shadow-xs group-hover:bg-[#1677FF] group-hover:text-white transition-colors">
                        <UserRound className="h-6 w-6" />
                      </span>
                      <span className="rounded-full border border-sky-200 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1677FF]">
                        PATIENT
                      </span>
                    </div>

                    {/* Patient Illustration / Image Preview */}
                    <div className="mt-4 h-28 w-full overflow-hidden rounded-xl border border-sky-100 bg-white shadow-2xs">
                      {patientImgLoaded ? (
                        <img
                          src="/assets/patient-app.png"
                          alt="Patient using mobile healthcare app"
                          className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                          onError={() => setPatientImgLoaded(false)}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-sky-50/70 p-3 text-center">
                          <HeartPulse className="h-8 w-8 text-[#1677FF]" />
                        </div>
                      )}
                    </div>

                    <h3 className="mt-4 font-sans text-lg font-bold text-[#0F2747]">
                      Patient Login
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                      View your vitals, health updates, and monitoring history through your secure patient portal.
                    </p>
                  </div>

                  <div className="mt-5 pt-3">
                    <Link
                      to="/login/patient"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1677FF] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm shadow-blue-500/25 transition-all hover:bg-blue-600 active:scale-[0.98]"
                    >
                      <span>Continue as Patient</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </motion.div>

                {/* 2. DOCTOR LOGIN CARD */}
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="group flex flex-col justify-between rounded-2xl border-2 border-emerald-100 bg-[#F3FAF7] p-5 transition-all hover:border-[#059669] hover:bg-[#EBF7F2] hover:shadow-[0_12px_30px_rgba(5,150,105,0.08)]"
                >
                  <div>
                    {/* Top Row: Icon + Badge */}
                    <div className="flex items-center justify-between">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white border border-emerald-200 text-[#059669] shadow-xs group-hover:bg-[#059669] group-hover:text-white transition-colors">
                        <Stethoscope className="h-6 w-6" />
                      </span>
                      <span className="rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#059669]">
                        CLINICIAN
                      </span>
                    </div>

                    {/* Doctor Illustration / Image Preview */}
                    <div className="mt-4 h-28 w-full overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-2xs">
                      {doctorImgLoaded ? (
                        <img
                          src="/assets/doctor-desk.png"
                          alt="Doctor analyzing clinical telemetry workstation"
                          className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                          onError={() => setDoctorImgLoaded(false)}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-emerald-50/70 p-3 text-center">
                          <Stethoscope className="h-8 w-8 text-[#059669]" />
                        </div>
                      )}
                    </div>

                    <h3 className="mt-4 font-sans text-lg font-bold text-[#0F2747]">
                      Doctor Login
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                      Access the clinical command center for patient monitoring, risk insights, alerts, and care management.
                    </p>
                  </div>

                  <div className="mt-5 pt-3">
                    <Link
                      to="/login/doctor"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#059669] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm shadow-emerald-500/25 transition-all hover:bg-emerald-700 active:scale-[0.98]"
                    >
                      <span>Continue as Doctor</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </motion.div>
              </div>

              {/* 3 Compact Security Information Cards */}
              <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-left">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-[#1677FF]" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Role Verification
                    </p>
                  </div>
                  <p className="mt-1 text-xs font-bold text-[#0F2747]">Scoped Entry</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Isolated role domains</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-left">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-emerald-600" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Session Controls
                    </p>
                  </div>
                  <p className="mt-1 text-xs font-bold text-[#0F2747]">Security First</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Encrypted token vault</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-left">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Care Workflow
                    </p>
                  </div>
                  <p className="mt-1 text-xs font-bold text-[#0F2747]">Fast Onboarding</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Instant triage routing</p>
                </div>
              </div>

              {/* Bottom: Create Account Link */}
              <div className="mt-7 pt-5 border-t border-slate-100 text-center text-xs sm:text-sm text-slate-500">
                <span>New to Smart Healthcare? </span>
                <Link
                  to="/signup"
                  className="font-bold text-[#1677FF] hover:text-blue-700 inline-flex items-center gap-1 transition-colors"
                >
                  <span>Create an account</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
