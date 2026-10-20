import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Hospital,
  Lock,
  Mail,
  PhoneCall,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  UserCheck,
} from 'lucide-react';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export function DoctorSignup() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F9FF] text-[#0F2747] font-sans antialiased">
      {/* Background Lighting */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-emerald-200/40 via-teal-100/30 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-gradient-to-tl from-blue-100/40 via-sky-100/30 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:radial-gradient(#059669_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Top Header Navigation */}
      <div className="relative z-20 px-4 pt-6 sm:px-8 max-w-[1440px] mx-auto flex items-center justify-between">
        <Link
          to="/signup"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          aria-label="Back to role selection"
        >
          <ArrowLeft className="h-4 w-4 text-emerald-600" />
          <span>Role Selection</span>
        </Link>

        <div className="flex items-center gap-3">
          <LanguageSwitcher compact />
        </div>
      </div>

      <motion.div
        className="relative mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-4xl items-center px-4 py-8 sm:px-6 lg:px-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="w-full rounded-3xl sm:rounded-[2.25rem] border border-slate-200/90 bg-white p-6 sm:p-10 shadow-[0_20px_60px_-15px_rgba(16,42,86,0.08)]">
          {/* Header Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-700">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Healthcare Clinical Security Protocol</span>
          </div>

          <h1 className="mt-5 font-sans text-3xl sm:text-4xl font-extrabold text-[#0F2747] tracking-tight">
            Doctor & Clinician Account Provisioning
          </h1>

          <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600 max-w-2xl">
            In compliance with clinical data protection guidelines, hospital safety protocols, and HIPAA/GDPR requirements, public self-registration for doctor and administrator accounts is restricted.
          </p>

          {/* Provisioning Explainer Card */}
          <div className="mt-8 rounded-2xl border border-emerald-100 bg-[#F3FAF7] p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white border border-emerald-200 text-emerald-600 shadow-xs">
                <Stethoscope className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-[#0F2747]">
                  How to Access Your Doctor Portal
                </h3>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                  Doctor credentials are systematically verified and issued by Hospital Administrators or System Super Administrators:
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-xl bg-white p-4 border border-emerald-100 shadow-2xs">
                <Hospital className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Hospital Provisioned</h4>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Your hospital's administrative department generates your internal Doctor ID and initial credentials.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-white p-4 border border-emerald-100 shadow-2xs">
                <UserCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Identity & Role Guarded</h4>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Ensures all diagnostic reviews and prescription modifications are performed strictly by verified physicians.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <Link
              to="/login/doctor"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-sm shadow-emerald-600/30 hover:bg-emerald-700 transition"
            >
              <span>Sign In with Issued Credentials</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              <span>Administrator & Staff Sign In</span>
            </Link>
          </div>

          {/* Bottom Help Note */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
            <p>Need assistance with your hospital onboarding? Contact your clinical IT supervisor.</p>
            <Link to="/signup/patient" className="font-bold text-[#1677FF] hover:underline">
              Looking for Patient Registration?
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
