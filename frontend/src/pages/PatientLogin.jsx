import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Activity, ArrowLeft, ArrowRight, HeartPulse, LoaderCircle, ShieldCheck } from 'lucide-react';
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
        token: auth?.token || '',
        tokenExpiresIn: auth?.expiresIn || 0,
      });

      toast.success(t('auth.patientLogin.loginSuccess'));
      navigate('/welcome', { replace: true });
    } catch (requestError) {
      const message = requestError?.response?.data?.message || requestError?.message || t('auth.patientLogin.invalidCredentials');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050816] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.34),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.3),transparent_32%),radial-gradient(circle_at_bottom,rgba(20,184,166,0.18),transparent_28%),linear-gradient(135deg,#020617_0%,#08101f_46%,#120b25_100%)]" />

      <div className="relative z-20 px-4 pt-4 sm:px-6">
        <Link to="/" className="dashboard-back-link" aria-label={t('auth.backToHome')}>
          <ArrowLeft className="h-4 w-4" />
          <span className="dashboard-back-label">{t('auth.backToHome')}</span>
        </Link>
      </div>

      <motion.div
        className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="grid w-full gap-8 lg:grid-cols-[1fr_1.05fr]">
          <div className="flex flex-col justify-center gap-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200">
              <ShieldCheck className="h-4 w-4 text-cyan-200" />
              {t('auth.patientLogin.secureLogin')}
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">{t('auth.patientLogin.patientAccess')}</p>
              <h1 className="mt-4 max-w-xl font-display text-4xl font-bold leading-tight text-white md:text-6xl">
                {t('auth.patientLogin.title')}
              </h1>
              <p className="mt-4 max-w-xl text-base leading-8 text-slate-300 md:text-lg">
                {t('auth.patientLogin.subtitle')}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { title: t('auth.patientLogin.feature1Title'), desc: t('auth.patientLogin.feature1Desc'), icon: Activity },
                { title: t('auth.patientLogin.feature2Title'), desc: t('auth.patientLogin.feature2Desc'), icon: HeartPulse },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-xl">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-cyan-400/10 text-cyan-200">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-100">{item.title}</p>
                    <p className="mt-1 text-xs leading-6 text-slate-300">{item.desc}</p>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: t('auth.patientLogin.sessionSecurity'), value: t('auth.patientLogin.protectedAccess') },
                { label: t('auth.patientLogin.monitoringScope'), value: t('auth.patientLogin.personalizedView') },
                { label: t('auth.patientLogin.careCoordination'), value: t('auth.patientLogin.doctorSynced') },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 backdrop-blur-xl">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full rounded-[2rem] border border-white/12 bg-white/8 p-6 shadow-[0_30px_120px_rgba(2,6,23,0.5)] backdrop-blur-2xl sm:p-8">
            <h2 className="font-display text-3xl font-bold text-white">{t('auth.patientLogin.formTitle')}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{t('auth.patientLogin.formSubtitle')}</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <Field
                label={t('auth.patientLogin.patientId')}
                value={patientId}
                onChange={(event) => setPatientId(event.target.value)}
                placeholder={t('auth.patientLogin.patientIdPlaceholder')}
              />

              <Field
                label={t('auth.rolePage.password')}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t('auth.patientLogin.passwordPlaceholder')}
              />

              {error ? <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

              <Button type="submit" size="lg" className="w-full justify-center" disabled={loading || !patientId || !password}>
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {loading ? t('auth.patientLogin.signingIn') : t('auth.patientLogin.login')}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-slate-300">
              {t('auth.patientLogin.doctorLoginPrompt')}{' '}
              <Link to="/login/doctor" className="font-semibold text-cyan-200 hover:text-cyan-100">
                {t('auth.patientLogin.switchHere')}
              </Link>
            </p>

            <OtpPasswordReset role="patient" />
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
