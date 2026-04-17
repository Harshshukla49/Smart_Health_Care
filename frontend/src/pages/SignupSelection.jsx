import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, ShieldCheck, Stethoscope, UserRound } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

export function SignupSelection() {
  const { t } = useI18n();
  const options = [
    {
      title: t('auth.signupSelection.patientTitle'),
      description: t('auth.signupSelection.patientDescription'),
      icon: UserRound,
      to: '/signup/patient',
      accent: 'from-cyan-400/20 to-sky-500/20',
    },
    {
      title: t('auth.signupSelection.doctorTitle'),
      description: t('auth.signupSelection.doctorDescription'),
      icon: Stethoscope,
      to: '/signup/doctor',
      accent: 'from-fuchsia-400/20 to-violet-500/20',
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050816] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.34),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.3),transparent_32%),radial-gradient(circle_at_bottom,rgba(20,184,166,0.18),transparent_28%),linear-gradient(135deg,#020617_0%,#08101f_46%,#120b25_100%)]" />
      <div className="pointer-events-none absolute left-10 top-10 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 right-10 h-40 w-40 rounded-full bg-fuchsia-400/10 blur-3xl" />

      <div className="relative z-20 px-4 pt-4 sm:px-6 lg:px-8">
        <Link to="/" className="dashboard-back-link" aria-label={t('auth.backToHome')}>
          <ArrowLeft className="h-4 w-4" />
          <span className="dashboard-back-label">{t('auth.backToHome')}</span>
        </Link>
      </div>

      <motion.div
        className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="w-full rounded-[2rem] border border-white/12 bg-white/8 p-6 shadow-[0_30px_120px_rgba(2,6,23,0.5)] backdrop-blur-2xl sm:p-8 lg:p-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200">
              <ShieldCheck className="h-4 w-4 text-cyan-200" />
              {t('auth.secureRoleAccess')}
            </div>
            <h1 className="mt-6 font-display text-4xl font-bold leading-tight text-white md:text-6xl">
              {t('auth.signupSelection.title')}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
              {t('auth.signupSelection.subtitle')}
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {options.map((option, index) => {
              const Icon = option.icon;

              return (
                <motion.div
                  key={option.title}
                  whileHover={{ y: -6, scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <Link
                    to={option.to}
                    className="group block h-full rounded-[1.75rem] border border-white/10 bg-slate-950/45 p-6 shadow-[0_20px_70px_rgba(2,6,23,0.35)] transition group-hover:border-cyan-300/30 group-hover:bg-white/8"
                  >
                    <div className={`flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br ${option.accent} text-white shadow-glow transition group-hover:shadow-[0_0_40px_rgba(56,189,248,0.22)]`}>
                      <Icon className="h-7 w-7" />
                    </div>
                    <h2 className="mt-6 font-display text-3xl font-bold text-white">{option.title}</h2>
                    <p className="mt-3 max-w-md text-sm leading-7 text-slate-300">{option.description}</p>
                    <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition group-hover:translate-x-1">
                      {t('auth.continue')} <ArrowRight className="h-4 w-4" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { label: t('auth.trustCards.identityVerification'), value: t('auth.trustCards.roleScoped') },
              { label: t('auth.trustCards.patientDataAccess'), value: t('auth.trustCards.protectedByDesign') },
              { label: t('auth.trustCards.onboardingExperience'), value: t('auth.trustCards.mobileFirst') },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 backdrop-blur-xl">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
                <p className="mt-2 text-sm font-semibold text-slate-100">{item.value}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-sm leading-7 text-slate-300">
            {t('auth.alreadyHaveAccount')}{' '}
            <Link to="/login" className="font-semibold text-cyan-200 transition hover:text-cyan-100">
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
