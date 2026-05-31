import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, HeartPulse, MessageCircle, Phone, ShieldCheck, Siren, Thermometer, Waves } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Loader } from '../components/Loader';
import { ECGChart } from '../components/ECGChart';
import { VitalCard } from '../components/VitalCard';
import { AlertsPanel } from '../components/AlertsPanel';
import { LiveVitalsProvider, useLiveVitals } from '../context/LiveVitalsContext';
import { useI18n } from '../context/I18nContext';
import { getApiPatientById, getPatients, updateDoctorProfile, updatePatientProfile } from '../services/api';
import { getAuthSession, setAuthSession } from '../utils/auth';

export function Dashboard() {
  return (
    <LiveVitalsProvider>
      <DashboardBody />
    </LiveVitalsProvider>
  );
}

function DashboardBody() {
  const { t } = useI18n();
  const {
    loading,
    error,
    patientId,
    patientName,
    heartRate,
    spo2,
    temperature,
    updatedAt,
    ecgData,
    // Add prediction fields if available from context
    risk,
    risk_score,
    confidence,
    alerts,
    message,
  } = useLiveVitals();

  const session = getAuthSession();
  const role = session?.role === 'doctor' ? 'doctor' : 'patient';
  const [doctorPatients, setDoctorPatients] = useState([]);
  const [profileEmail, setProfileEmail] = useState(session?.email || '');
  const [profilePhone, setProfilePhone] = useState(session?.phone || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState('');
  const [profileError, setProfileError] = useState('');
  const [doctorEmail, setDoctorEmail] = useState('');
  const [doctorPhone, setDoctorPhone] = useState('');

  const patientCount = doctorPatients.length;
  const preferredChatPatientId = doctorPatients[0]?.id ? String(doctorPatients[0].id) : '';
  const hasCriticalVitals = Number(spo2) > 0 && Number(spo2) < 90;
  // Use backend risk and alerts if available
  const healthStatusLabel = risk ? `${risk}` : (hasCriticalVitals ? t('dashboard.cards.criticalAttention') : t('dashboard.cards.stableMonitoring'));
  const healthStatusClass = risk === 'Critical'
    ? 'border-rose-300/30 bg-rose-500/15 text-rose-100'
    : risk === 'High Risk'
      ? 'border-amber-300/30 bg-amber-500/15 text-amber-100'
      : 'border-emerald-300/30 bg-emerald-500/12 text-emerald-100';

  useEffect(() => {
    let active = true;

    const loadDoctorPatients = async () => {
      if (role !== 'doctor') {
        return;
      }

      try {
        const rows = await getPatients();
        if (active) {
          setDoctorPatients(Array.isArray(rows) ? rows : []);
        }
      } catch {
        if (active) {
          setDoctorPatients([]);
        }
      }
    };

    loadDoctorPatients();
    const timer = role === 'doctor' ? window.setInterval(loadDoctorPatients, 12000) : null;

    return () => {
      active = false;
      if (timer) {
        window.clearInterval(timer);
      }
    };
  }, [role]);

  useEffect(() => {
    const latest = getAuthSession();
    setProfileEmail(latest?.email || '');
    setProfilePhone(latest?.phone || '');
  }, [role]);

  useEffect(() => {
    let active = true;

    const loadDoctorDetailsForPatient = async () => {
      if (role !== 'patient') {
        setDoctorEmail('');
        setDoctorPhone('');
        return;
      }

      const resolvedPatientId = String(session?.patientId || patientId || '').trim();
      if (!resolvedPatientId) {
        setDoctorEmail('');
        setDoctorPhone('');
        return;
      }

      try {
        const profile = await getApiPatientById(resolvedPatientId);
        if (!active) {
          return;
        }

        // Extract doctor email - try multiple possible locations
        const doctorEmailValue = 
          profile?.doctorContact?.email || 
          profile?.doctorEmail || 
          String(profile?.doctorId || '').trim().toLowerCase() || 
          '';
        
        // Extract doctor phone - handle if it's stored as an object
        let doctorPhoneValue = profile?.doctorContact?.phone || profile?.doctorPhone || '';
        if (typeof doctorPhoneValue === 'object' && doctorPhoneValue !== null) {
          doctorPhoneValue = doctorPhoneValue?.phone || '';
        }
        
        setDoctorEmail(String(doctorEmailValue || '').trim());
        setDoctorPhone(String(doctorPhoneValue || '').trim());
      } catch {
        if (active) {
          setDoctorEmail('');
          setDoctorPhone('');
        }
      }
    };

    loadDoctorDetailsForPatient();
    return () => {
      active = false;
    };
  }, [patientId, role, session?.patientId]);

  const handleProfileSave = async () => {
    setProfileSaving(true);
    setProfileStatus('');
    setProfileError('');

    try {
      if (role === 'doctor') {
        const result = await updateDoctorProfile({
          name: session?.name || 'Doctor',
          email: profileEmail,
          phone: profilePhone,
        });

        const nextSession = {
          ...session,
          email: result?.doctor?.email || profileEmail,
          phone: result?.doctor?.phone || profilePhone,
          name: result?.doctor?.name || session?.name,
          token: result?.auth?.token || session?.token || '',
          tokenExpiresIn: result?.auth?.expiresIn || session?.tokenExpiresIn || 0,
          role: 'doctor',
        };
        setAuthSession(nextSession);
        setProfileEmail(nextSession.email || '');
        setProfilePhone(nextSession.phone || '');
        setProfileStatus(result?.message || 'Doctor profile updated successfully.');
      } else {
        const result = await updatePatientProfile({
          patientId: session?.patientId,
          email: profileEmail,
          phone: profilePhone,
        });

        const nextSession = {
          ...session,
          email: result?.patient?.email || profileEmail,
          phone: result?.patient?.phone || profilePhone,
          name: result?.patient?.name || session?.name,
          token: result?.auth?.token || session?.token || '',
          tokenExpiresIn: result?.auth?.expiresIn || session?.tokenExpiresIn || 0,
          role: 'patient',
        };
        setAuthSession(nextSession);
        setProfileEmail(nextSession.email || '');
        setProfilePhone(nextSession.phone || '');
        setProfileStatus(result?.message || 'Patient profile updated successfully.');
      }
    } catch (requestError) {
      setProfileError(requestError?.response?.data?.message || requestError?.message || 'Unable to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <DashboardLayout
      title={t('dashboard.title')}
      subtitle={t('dashboard.subtitle')}
      backLabel={t('common.backToHome')}
    >
      {loading ? <Loader label={t('dashboard.loadingVitals')} /> : null}

      {/* Show live alerts panel if alerts exist */}
      {alerts && alerts.length > 0 && (
        <AlertsPanel
          alerts={alerts.map((alert, idx) => ({
            code: `alert-${idx}`,
            type: alert.toLowerCase().includes('critical') || alert.toLowerCase().includes('emergency') ? 'critical' : alert.toLowerCase().includes('warning') ? 'warning' : 'normal',
            title: alert,
            description: message || '',
          }))}
        />
      )}

      {!loading ? (
        <div className="space-y-4 sm:space-y-5 lg:space-y-6">
          <section className="grid gap-2 sm:grid-cols-2 sm:gap-3 md:gap-3 lg:gap-4 xl:grid-cols-4">
            {/* Monitoring State */}
            <Card className="min-w-0 p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2 sm:gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.24em] text-slate-400 sm:text-[10px]">{t('dashboard.cards.monitoringState')}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-100 sm:mt-2 sm:text-sm">{healthStatusLabel}</p>
                  {risk_score !== undefined && (
                    <span className="block mt-1 text-xs text-cyan-200">Risk Score: {risk_score}</span>
                  )}
                  {confidence !== undefined && (
                    <span className="block mt-1 text-xs text-cyan-200">Confidence: {confidence}%</span>
                  )}
                </div>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-cyan-200 sm:h-9 sm:w-9 sm:rounded-xl">
                  <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </span>
              </div>
            </Card>
            {/* Signal Freshness */}
            <Card className="min-w-0 p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2 sm:gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.24em] text-slate-400 sm:text-[10px]">{t('dashboard.cards.signalFreshness')}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-100 sm:mt-2 sm:text-sm">{updatedAt ? t('dashboard.cards.liveStream') : t('dashboard.cards.pendingSync')}</p>
                </div>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-cyan-200 sm:h-9 sm:w-9 sm:rounded-xl">
                  <Waves className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </span>
              </div>
            </Card>
            {/* Protection Mode */}
            <Card className="min-w-0 p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2 sm:gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.24em] text-slate-400 sm:text-[10px]">{t('dashboard.cards.protectionMode')}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-100 sm:mt-2 sm:text-sm">{t('dashboard.cards.roleBasedSecure')}</p>
                </div>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-cyan-200 sm:h-9 sm:w-9 sm:rounded-xl">
                  <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </span>
              </div>
            </Card>
            {/* Doctor Scope */}
            <Card className="min-w-0 p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2 sm:gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.24em] text-slate-400 sm:text-[10px]">{t('dashboard.cards.doctorScope')}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-100 sm:mt-2 sm:text-sm">{role === 'doctor' ? t('dashboard.cards.doctorPatients', { count: patientCount }) : t('dashboard.cards.personalView')}</p>
                </div>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-cyan-200 sm:h-9 sm:w-9 sm:rounded-xl">
                  <Siren className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </span>
              </div>
            </Card>
          </section>

          <Card className="p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">{t('dashboard.target.heading')}</p>
                <h2 className="mt-1 font-display text-2xl font-bold text-white sm:mt-2 sm:text-3xl">{patientName || t('roles.patient')}</h2>
                <p className="mt-1 overflow-hidden text-ellipsis text-xs text-slate-300 sm:text-sm">ID: {patientId || t('common.unavailable')} · {t('dashboard.target.lastUpdate')}: {updatedAt || t('common.pending')}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:self-start">
                <div className={["rounded-full border px-2.5 py-1.5 text-xs font-semibold sm:px-3 sm:py-2", healthStatusClass].join(' ')}>
                  {healthStatusLabel}
                </div>
                {role === 'doctor' ? (
                  <Button as={Link} to="/add-patient" size="sm" className="text-xs sm:text-sm">
                    {t('dashboard.actions.addPatient')}
                  </Button>
                ) : null}
                <Button
                  as={Link}
                  to={role === 'doctor' && preferredChatPatientId ? `/chat?patientId=${encodeURIComponent(preferredChatPatientId)}` : '/chat'}
                  size="sm"
                  className="text-xs sm:text-sm"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Video Call
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:mt-5 sm:grid-cols-2 sm:gap-3 md:gap-3 lg:grid-cols-4 lg:gap-4">
              <Link
                to={role === 'doctor' ? '/add-patient' : '/contact'}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-slate-200 transition hover:border-cyan-300/35 hover:bg-white/10 sm:rounded-2xl sm:px-4 sm:py-4 sm:text-sm"
              >
                <p className="text-[9px] uppercase tracking-[0.24em] text-slate-400 sm:text-xs">{t('dashboard.quickActions.heading')}</p>
                <p className="mt-1 font-semibold text-white sm:mt-2">{role === 'doctor' ? t('dashboard.quickActions.doctorAction') : t('dashboard.quickActions.patientAction')}</p>
                <p className="mt-0.5 inline-flex items-center gap-0.5 text-cyan-200 sm:mt-1 sm:gap-1 text-[9px] sm:text-xs">{t('common.open')} <ArrowRight className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" /></p>
              </Link>
              <Link
                to="/about"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-slate-200 transition hover:border-cyan-300/35 hover:bg-white/10 sm:rounded-2xl sm:px-4 sm:py-4 sm:text-sm"
              >
                <p className="text-[9px] uppercase tracking-[0.24em] text-slate-400 sm:text-xs">{t('dashboard.quickActions.platform')}</p>
                <p className="mt-1 font-semibold text-white sm:mt-2">{t('dashboard.quickActions.platformAction')}</p>
                <p className="mt-0.5 inline-flex items-center gap-0.5 text-cyan-200 sm:mt-1 sm:gap-1 text-[9px] sm:text-xs">{t('common.explore')} <ArrowRight className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" /></p>
              </Link>
              <Link
                to="/blog"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-slate-200 transition hover:border-cyan-300/35 hover:bg-white/10 sm:rounded-2xl sm:px-4 sm:py-4 sm:text-sm"
              >
                <p className="text-[9px] uppercase tracking-[0.24em] text-slate-400 sm:text-xs">{t('dashboard.quickActions.insights')}</p>
                <p className="mt-1 font-semibold text-white sm:mt-2">{t('dashboard.quickActions.insightAction')}</p>
                <p className="mt-0.5 inline-flex items-center gap-0.5 text-cyan-200 sm:mt-1 sm:gap-1 text-[9px] sm:text-xs">{t('common.read')} <ArrowRight className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" /></p>
              </Link>
              <Link
                to={role === 'doctor' && preferredChatPatientId ? `/chat?patientId=${encodeURIComponent(preferredChatPatientId)}` : '/chat'}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-slate-200 transition hover:border-cyan-300/35 hover:bg-white/10 sm:rounded-2xl sm:px-4 sm:py-4 sm:text-sm"
              >
                <p className="text-[9px] uppercase tracking-[0.24em] text-slate-400 sm:text-xs">Realtime chat</p>
                <p className="mt-1 inline-flex items-center gap-1 font-semibold text-white sm:mt-2 text-xs"><MessageCircle className="h-3 w-3 sm:h-4 sm:w-4" /> Doctor & patient</p>
                <p className="mt-0.5 inline-flex items-center gap-0.5 text-cyan-200 sm:mt-1 sm:gap-1 text-[9px] sm:text-xs">Open chat <ArrowRight className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" /></p>
              </Link>
            </div>
          </Card>

          <Card className="p-4 sm:p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">{t('dashboard.profile.heading')}</p>
            <h3 className="mt-1 font-display text-xl font-bold text-white sm:mt-2 sm:text-2xl">{t('dashboard.profile.title')}</h3>
            <p className="mt-1 text-xs text-slate-300 sm:mt-2 sm:text-sm">
              {t('dashboard.profile.description')}
            </p>

            <div className="mt-3 grid gap-3 sm:mt-4 sm:grid-cols-2 sm:gap-4">
              <label className="space-y-1 sm:space-y-2">
                <span className="text-xs font-semibold text-slate-200 sm:text-sm">{t('dashboard.profile.email')}</span>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(event) => setProfileEmail(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-950/45 px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                  placeholder="you@example.com"
                />
              </label>

              <label className="space-y-1 sm:space-y-2">
                <span className="text-xs font-semibold text-slate-200 sm:text-sm">{t('dashboard.profile.phone')}</span>
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={(event) => setProfilePhone(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-950/45 px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                  placeholder="+91XXXXXXXXXX"
                />
              </label>
            </div>

            {profileError ? <p className="mt-2 text-xs text-rose-200 sm:mt-3 sm:text-sm">{profileError}</p> : null}
            {profileStatus ? <p className="mt-2 text-xs text-emerald-200 sm:mt-3 sm:text-sm">{profileStatus}</p> : null}

            <div className="mt-3 sm:mt-4">
              <Button onClick={handleProfileSave} disabled={profileSaving || !profileEmail || !profilePhone} className="text-xs sm:text-sm">
                {profileSaving ? t('dashboard.profile.saving') : t('dashboard.profile.save')}
              </Button>
            </div>
          </Card>

          {role === 'patient' ? (
            <Card className="p-4 sm:p-6">
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Doctor Contact</p>
              <h3 className="mt-1 font-display text-xl font-bold text-white sm:mt-2 sm:text-2xl">Assigned Doctor Details</h3>
              <p className="mt-1 text-xs text-slate-300 sm:mt-2 sm:text-sm">
                Reach your doctor directly for quick guidance and follow-up.
              </p>

              <div className="mt-3 grid gap-3 sm:mt-4 sm:grid-cols-2 sm:gap-4">
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">
                  <p className="text-[9px] uppercase tracking-[0.24em] text-slate-400 sm:text-xs">{t('dashboard.profile.email')}</p>
                  <p className="mt-1 text-xs font-semibold text-white overflow-hidden text-ellipsis sm:mt-2 sm:text-sm">{doctorEmail || 'Not available yet'}</p>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">
                  <p className="text-[9px] uppercase tracking-[0.24em] text-slate-400 sm:text-xs">{t('dashboard.profile.phone')}</p>
                  <p className="mt-1 text-xs font-semibold text-white overflow-hidden text-ellipsis sm:mt-2 sm:text-sm">{doctorPhone || 'Not available yet'}</p>
                </div>
              </div>
            </Card>
          ) : null}

          {error ? (
            <Card className="border border-rose-400/20 bg-rose-500/10 p-6 text-rose-100">{error}</Card>
          ) : (
            <>
              <section id="vitals" className="grid gap-2 sm:grid-cols-2 sm:gap-3 md:gap-4 lg:grid-cols-4">
                <VitalCard
                  label={t('dashboard.vitals.heartRate')}
                  value={heartRate}
                  unit="bpm"
                  icon={<HeartPulse className="h-5 w-5" />}
                  updatedAt={updatedAt}
                  accent="text-cyan-200"
                />
                <VitalCard
                  label={t('dashboard.vitals.spo2')}
                  value={spo2}
                  unit="%"
                  icon={<Waves className="h-5 w-5" />}
                  updatedAt={updatedAt}
                  accent="text-teal-200"
                />
                <VitalCard
                  label={t('dashboard.vitals.temperature')}
                  value={temperature}
                  unit="°C"
                  icon={<Thermometer className="h-5 w-5" />}
                  updatedAt={updatedAt}
                  accent="text-fuchsia-200"
                />
                <ECGChart ecgData={ecgData} />
              </section>

              {role === 'doctor' ? (
                <Card className="p-4 sm:p-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">{t('dashboard.doctorControls.heading')}</p>
                      <h3 className="mt-1 font-display text-xl font-bold text-white sm:mt-2 sm:text-2xl">{t('dashboard.doctorControls.title')}</h3>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-2 sm:gap-3">
                    {doctorPatients
                      .slice()
                      .sort((a, b) => Number(a?.spo2 || 0) - Number(b?.spo2 || 0))
                      .map((row) => {
                        const isCritical = Number(row?.spo2 || 0) > 0 && Number(row?.spo2 || 0) < 90;
                        return (
                      <Link
                        key={row.id}
                        to={`/patients/${row.id}`}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-slate-200 transition hover:border-cyan-300/35 hover:bg-white/10 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                      >
                        <div className="flex items-start justify-between gap-2 sm:gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-white text-xs sm:text-sm">{row.name}</p>
                            <p className="mt-0.5 text-[0.75rem] text-slate-400 overflow-hidden text-ellipsis sm:mt-1">ID: {row.id} · HR {row.heartRate} · SpO2 {row.spo2}% · Temp {row.temperature}°C</p>
                          </div>
                          <span className={[
                            'rounded-full border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] whitespace-nowrap sm:px-2.5 sm:py-1 sm:text-[0.7rem]',
                            isCritical
                              ? 'border-rose-300/30 bg-rose-500/15 text-rose-100'
                              : 'border-emerald-300/30 bg-emerald-500/12 text-emerald-100',
                          ].join(' ')}>
                            {isCritical ? t('dashboard.doctorControls.critical') : t('dashboard.doctorControls.normal')}
                          </span>
                        </div>
                      </Link>
                        );
                      })}

                    {!doctorPatients.length ? (
                      <p className="text-xs text-slate-300 sm:text-sm">{t('dashboard.doctorControls.noPatients')}</p>
                    ) : null}
                  </div>
                </Card>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </DashboardLayout>
  );
}