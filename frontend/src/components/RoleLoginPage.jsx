import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Heart,
  HeartPulse,
  LoaderCircle,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Stethoscope,
  User,
  UserRound,
} from 'lucide-react';
import { Button } from './Button';
import { OtpPasswordReset } from './OtpPasswordReset';
import { getDashboardPathForRole, setAuthSession } from '../utils/auth';
import { useI18n } from '../context/I18nContext';
import {
  loginDoctor,
  signupDoctor,
} from '../services/api';

export function RoleLoginPage({ role, mode = 'login', title, subtitle, accent, ctaLabel = 'Login', helperCopy }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const emailPattern = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);
  const roleLabel = role === 'doctor' ? t('roles.doctor') : t('roles.patient');
  const isSignup = mode === 'signup';
  const isDoctor = role === 'doctor';
  const selectionPath = isSignup ? '/signup' : '/login';
  const alternatePath = role === 'doctor'
    ? (isSignup ? '/login/doctor' : '/signup/doctor')
    : (isSignup ? '/login/patient' : '/signup/patient');

  const rolePillars = isDoctor
    ? t('auth.rolePage.doctorPillars')
    : t('auth.rolePage.patientPillars');

  const trustStats = isDoctor
    ? [
      { label: 'Clinical Workflows', value: 'Care Ops Ready' },
      { label: 'Alert Coverage', value: '24/7 Monitoring' },
      { label: 'Access Control', value: 'Role Guarded' },
    ]
    : [
      { label: 'Patient Workspace', value: 'Personalized View' },
      { label: 'Monitoring Sync', value: 'Near Real-time' },
      { label: 'Support Routing', value: 'Priority Signals' },
    ];

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!emailPattern.test(email)) {
      setError(t('auth.rolePage.invalidEmail'));
      return;
    }

    if (password.trim().length < 6) {
      setError(t('auth.rolePage.invalidPassword'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isSignup && isDoctor) {
        await signupDoctor({ name, email, password, phone });
        toast.success(t('auth.rolePage.doctorSignupSuccess'));
        navigate('/login/doctor');
      } else if (!isSignup && isDoctor) {
        const result = await loginDoctor({ email, password });
        const doctor = result?.doctor;
        const auth = result?.auth;
        setAuthSession({
          role: 'doctor',
          doctorId: doctor.doctorId || doctor.email,
          name: doctor.name,
          email: doctor.email,
          phone: doctor.phone || '',
          token: auth?.token || '',
          tokenExpiresIn: auth?.expiresIn || 0,
        });

        toast.success(t('auth.rolePage.doctorLoginSuccess'));
        navigate(getDashboardPathForRole('doctor'), { replace: true });
      }
    } catch (requestError) {
      const message = requestError?.response?.data?.message || requestError?.message || t('auth.rolePage.authFailed');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F9FF] text-[#0F2747] font-sans antialiased">
      {/* Background Lighting */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-emerald-100/40 via-teal-50/30 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-gradient-to-tl from-sky-100/40 via-blue-50/30 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:radial-gradient(#059669_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Top Header Navigation */}
      <div className="relative z-20 px-4 pt-6 sm:px-8 max-w-[1440px] mx-auto flex items-center justify-between">
        <Link
          to={selectionPath}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          aria-label="Back to role selection"
        >
          <ArrowLeft className="h-4 w-4 text-[#059669]" />
          <span>Back to Role Selection</span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#059669] text-white shadow-sm">
            <Stethoscope className="h-4 w-4" />
          </div>
          <span className="font-sans text-sm font-bold text-[#0F2747] hidden sm:inline">
            Smart Healthcare
          </span>
        </div>
      </div>

      <motion.div
        className="relative mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="grid w-full gap-8 lg:grid-cols-[1fr_1.1fr] items-center">
          {/* Left Context Column */}
          <div className="flex flex-col justify-center gap-6">
            <Link
              to={selectionPath}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-bold text-[#059669] transition hover:bg-emerald-100/70"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{t('auth.rolePage.secureAccess')}</span>
            </Link>

            <div className="space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#059669]">
                {roleLabel} {isSignup ? t('auth.signUp') : t('auth.login')}
              </p>
              <h1 className="max-w-xl font-sans text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-[#0F2747]">
                {title}
              </h1>
              <p className="max-w-xl text-sm sm:text-base leading-relaxed text-slate-600">
                {subtitle}
              </p>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              {rolePillars.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 text-xs sm:text-sm font-semibold leading-relaxed text-slate-700 shadow-2xs"
                >
                  ✓ {item}
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {trustStats.map((stat) => (
                <div key={stat.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{stat.label}</p>
                  <p className="mt-1 text-xs font-bold text-[#0F2747]">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Form Card */}
          <motion.div
            className="relative rounded-3xl sm:rounded-[2.25rem] border border-slate-200/90 bg-white p-6 sm:p-10 shadow-[0_20px_60px_-15px_rgba(16,42,86,0.08)]"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.05 }}
          >
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-[#059669]">
                <HeartPulse className="h-4 w-4" />
                <span>{helperCopy}</span>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                {role === 'doctor' && isSignup ? (
                  <Field
                    label={t('auth.rolePage.doctorName')}
                    type="text"
                    icon={<User className="h-4 w-4" />}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t('auth.rolePage.doctorNamePlaceholder')}
                  />
                ) : null}

                <Field
                  label={t('auth.rolePage.email')}
                  type="email"
                  icon={<Mail className="h-4 w-4" />}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t('auth.rolePage.emailPlaceholder')}
                />

                <Field
                  label={t('auth.rolePage.password')}
                  type="password"
                  icon={<Lock className="h-4 w-4" />}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t('auth.rolePage.passwordPlaceholder')}
                />

                {role === 'doctor' && isSignup ? (
                  <Field
                    label={t('auth.rolePage.phone')}
                    type="tel"
                    icon={<Phone className="h-4 w-4" />}
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder={t('auth.rolePage.phonePlaceholder')}
                  />
                ) : null}

                {error ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
                    {error}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full justify-center bg-[#059669] hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-500/25 py-3"
                  disabled={loading}
                >
                  {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {loading ? t('auth.rolePage.authorizing') : ctaLabel}
                </Button>
              </form>

              <p className="mt-5 text-center text-xs text-slate-500">
                {isSignup ? t('auth.rolePage.alreadyAccount') : t('auth.rolePage.needAccount')}{' '}
                <Link to={alternatePath} className="font-bold text-[#059669] hover:text-emerald-800">
                  {isSignup ? t('auth.rolePage.loginHere') : t('auth.rolePage.signupHere')}
                </Link>
              </p>

              {!isSignup && isDoctor ? (
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <OtpPasswordReset role="doctor" />
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ label, icon, type = 'text', ...props }) {
  return (
    <label className="block space-y-1.5 text-left">
      <span className="text-xs font-bold text-slate-700">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
          {icon}
        </span>
        <input
          type={type}
          {...props}
          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3.5 py-2.5 text-sm text-[#0F2747] placeholder:text-slate-400 outline-none transition focus:border-[#059669] focus:bg-white focus:ring-2 focus:ring-emerald-100"
        />
      </div>
    </label>
  );
}
