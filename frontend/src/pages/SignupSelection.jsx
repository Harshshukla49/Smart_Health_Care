import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Heart,
  Lock,
  Shield,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Zap,
} from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export function SignupSelection() {
  const { t } = useI18n();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F9FF] text-[#0F2747] font-sans antialiased">
      {/* Background Lighting */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-blue-200/40 via-sky-100/30 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-gradient-to-tl from-teal-100/40 via-sky-100/30 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:radial-gradient(#1677FF_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Top Header Navigation */}
      <div className="relative z-20 px-4 pt-6 sm:px-8 max-w-[1440px] mx-auto flex items-center justify-between">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          aria-label="Back to login"
        >
          <ArrowLeft className="h-4 w-4 text-[#1677FF]" />
          <span>Back to Login</span>
        </Link>

        <div className="flex items-center gap-3">
          <LanguageSwitcher compact />
        </div>
      </div>

      <motion.div
        className="relative mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-5xl items-center px-4 py-8 sm:px-6 lg:px-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="w-full rounded-3xl sm:rounded-[2.25rem] border border-slate-200/90 bg-white p-6 sm:p-10 shadow-[0_20px_60px_-15px_rgba(16,42,86,0.08)]">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-[#1677FF]">
              <ShieldCheck className="h-4 w-4" />
              <span>{t('auth.secureRoleAccess')}</span>
            </div>
            <h1 className="mt-4 font-sans text-3xl sm:text-4xl font-extrabold text-[#0F2747] tracking-tight">
              {t('auth.signupSelection.title')}
            </h1>
            <p className="mt-2 text-sm sm:text-base leading-relaxed text-slate-600">
              {t('auth.signupSelection.subtitle')}
            </p>
          </div>

          {/* Role Cards Grid */}
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {/* Patient Signup Card */}
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className="group flex flex-col justify-between rounded-2xl border-2 border-sky-100 bg-[#F5F9FF] p-6 transition-all hover:border-[#1677FF] hover:bg-[#EDF5FF] hover:shadow-[0_12px_30px_rgba(22,119,255,0.08)]"
            >
              <div>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white border border-sky-200 text-[#1677FF] shadow-xs group-hover:bg-[#1677FF] group-hover:text-white transition-colors">
                  <UserRound className="h-6 w-6" />
                </span>
                <h3 className="mt-5 font-sans text-xl font-bold text-[#0F2747]">
                  {t('auth.signupSelection.patientTitle')}
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {t('auth.signupSelection.patientDescription')}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-sky-100/80">
                <Link
                  to="/signup/patient"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1677FF] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm shadow-blue-500/25 transition hover:bg-blue-600"
                >
                  <span>Continue as Patient</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </motion.div>

            {/* Doctor Signup Card */}
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className="group flex flex-col justify-between rounded-2xl border-2 border-emerald-100 bg-[#F3FAF7] p-6 transition-all hover:border-[#059669] hover:bg-[#EBF7F2] hover:shadow-[0_12px_30px_rgba(5,150,105,0.08)]"
            >
              <div>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white border border-emerald-200 text-[#059669] shadow-xs group-hover:bg-[#059669] group-hover:text-white transition-colors">
                  <Stethoscope className="h-6 w-6" />
                </span>
                <h3 className="mt-5 font-sans text-xl font-bold text-[#0F2747]">
                  {t('auth.signupSelection.doctorTitle')}
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {t('auth.signupSelection.doctorDescription')}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-emerald-100/80">
                <Link
                  to="/signup/doctor"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#059669] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm shadow-emerald-500/25 transition hover:bg-emerald-700"
                >
                  <span>Continue as Doctor</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </motion.div>
          </div>

          {/* 3 Compact Trust Cards */}
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-left">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#1677FF]" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t('auth.trustCards.identityVerification')}
                </p>
              </div>
              <p className="mt-1 text-xs font-bold text-[#0F2747]">{t('auth.trustCards.roleScoped')}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-left">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-emerald-600" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t('auth.trustCards.patientDataAccess')}
                </p>
              </div>
              <p className="mt-1 text-xs font-bold text-[#0F2747]">{t('auth.trustCards.protectedByDesign')}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-left">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t('auth.trustCards.onboardingExperience')}
                </p>
              </div>
              <p className="mt-1 text-xs font-bold text-[#0F2747]">{t('auth.trustCards.mobileFirst')}</p>
            </div>
          </div>

          {/* Bottom Already Have Account */}
          <p className="mt-8 text-center text-xs sm:text-sm text-slate-500">
            {t('auth.alreadyHaveAccount')}{' '}
            <Link to="/login" className="font-bold text-[#1677FF] hover:underline">
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
