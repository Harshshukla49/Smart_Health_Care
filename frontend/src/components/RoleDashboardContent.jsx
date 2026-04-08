import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, AlertTriangle, HeartPulse, Sparkles, Thermometer, TrendingUp, Waves } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Card } from './Card';
import { MetricCard } from './MetricCard';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Loader } from './Loader';
import { StatusPill } from './StatusPill';
import { usePatients } from '../hooks/usePatients';

const chartFormatter = (value) => (value ? String(value).slice(0, 16) : 'Reading');

export function RoleDashboardContent({ role }) {
  const { patients, loading, error, reload } = usePatients();
  const currentRole = role === 'doctor' ? 'doctor' : 'patient';
  const title = currentRole === 'doctor' ? 'Doctor dashboard' : 'Patient dashboard';
  const eyebrow = currentRole === 'doctor' ? 'Clinical overview' : 'Personal health overview';
  const trendSeries = (patients || []).slice(0, 10).slice().reverse().map((patient, index) => ({
    label: patient.updatedAt || patient.name || `Reading ${index + 1}`,
    heartRate: Number(patient.heartRate || 0),
    spo2: Number(patient.spo2 || 0),
    temperature: Number(patient.temperature || 0),
  }));
  const latestPatient = patients?.[0] || null;

  const average = (selector) => {
    if (!patients?.length) {
      return 0;
    }

    const total = patients.reduce((sum, patient) => sum + Number(selector(patient) || 0), 0);
    return Math.round(total / patients.length);
  };

  const stats = [
    {
      label: 'Heart Rate',
      value: `${average((patient) => patient.heartRate) || latestPatient?.heartRate || 0} bpm`,
      delta: latestPatient ? `Latest ${latestPatient.name}` : 'No recent reading',
      tone: 'cyan',
      icon: <HeartPulse className="h-5 w-5 text-cyan-200" />,
    },
    {
      label: 'SpO2',
      value: `${average((patient) => patient.spo2) || latestPatient?.spo2 || 0}%`,
      delta: latestPatient && latestPatient.spo2 < 90 ? 'Critical threshold' : 'Stable oxygenation',
      tone: 'teal',
      icon: <Waves className="h-5 w-5 text-teal-200" />,
    },
    {
      label: 'Temperature',
      value: `${average((patient) => patient.temperature) || latestPatient?.temperature || 0}°C`,
      delta: 'Rolling average',
      tone: 'purple',
      icon: <Thermometer className="h-5 w-5 text-fuchsia-200" />,
    },
  ];

  if (error) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          {error}
        </div>
        <Button onClick={reload}>Retry loading</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className="relative overflow-hidden p-6 md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.14),transparent_32%)]" />
          <div className="relative flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200">{eyebrow}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200">Live API data</span>
              {currentRole === 'doctor' ? (
                <Button as={Link} to="/add-patient" size="sm">
                  Add Patient
                </Button>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">{title}</p>
              <h2 className="max-w-3xl font-display text-3xl font-bold text-white md:text-5xl">
                {currentRole === 'doctor'
                  ? 'Triage patients faster with a command center that feels immediate.'
                  : 'Track your vitals, review trends, and stay informed from one secure view.'}
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                {currentRole === 'doctor'
                  ? 'Prioritized patient cards, smooth motion, and a clear sidebar make this dashboard feel like a production SaaS product.'
                  : 'Everything is arranged to keep the monitoring experience calm, readable, and reassuring on any screen size.'}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {stats.map((stat) => (
                <MetricCard key={stat.label} {...stat} />
              ))}
            </div>
          </div>
        </Card>

        <Card id="alerts" className="space-y-4 p-6 md:p-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">Alerts</p>
              <h3 className="mt-2 font-display text-2xl font-bold text-white">{currentRole === 'doctor' ? 'Priority signal queue' : 'Your current monitoring state'}</h3>
            </div>
            <AlertTriangle className="h-5 w-5 text-amber-300" />
          </div>

          <div className="space-y-3 rounded-3xl border border-white/10 bg-slate-950/40 p-4 text-sm leading-7 text-slate-300">
            <p>
              {currentRole === 'doctor'
                ? 'Use the dashboard to review the most recent patients, identify critical SpO2 readings, and move into patient details quickly.'
                : 'Use this view to monitor your most recent vitals, check whether any values need attention, and stay connected to your care team.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <StatusPill status={latestPatient?.spo2 < 90 ? 'Critical' : 'Normal'} />
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200">Protected session</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Monitoring', value: 'Active' },
              { label: 'Sync', value: 'Live' },
              { label: 'Theme', value: 'Glass' },
              { label: 'Motion', value: 'Enabled' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{item.label}</p>
                <p className="mt-2 font-display text-2xl font-bold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section id="vitals" className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6 md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">Vitals</p>
              <h3 className="mt-2 font-display text-2xl font-bold text-white">Last 10 readings</h3>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300">
              <TrendingUp className="h-4 w-4 text-cyan-200" />
              Live trend
            </div>
          </div>

          <div className="mt-6 h-[340px] rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-4 sm:p-6">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader label="Loading chart data" />
              </div>
            ) : trendSeries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendSeries} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tickFormatter={chartFormatter} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)' }} tickLine={false} minTickGap={18} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)' }} tickLine={false} width={34} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15, 23, 42, 0.96)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '16px',
                      color: '#e2e8f0',
                    }}
                    labelFormatter={chartFormatter}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="heartRate" name="Heart Rate" stroke="#38bdf8" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="spo2" name="SpO2" stroke="#2dd4bf" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="temperature" name="Temperature" stroke="#d946ef" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="No readings yet"
                message={currentRole === 'doctor' ? 'No patient data is available yet.' : 'Your monitoring history is empty for now.'}
                action={currentRole === 'doctor' ? <Button as={Link} to="/">Back home</Button> : null}
              />
            )}
          </div>
        </Card>

        <Card id="insights" className="p-6 md:p-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">Insights</p>
              <h3 className="mt-2 font-display text-2xl font-bold text-white">Operational summary</h3>
            </div>
            <Sparkles className="h-5 w-5 text-fuchsia-300" />
          </div>

          <div className="mt-6 space-y-3">
            {(patients || []).slice(0, 5).map((patient) => (
              <Link
                key={patient.id}
                to={`/patients/${patient.id}`}
                className="group flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4 transition hover:border-cyan-300/30 hover:bg-white/8"
              >
                <div>
                  <p className="font-semibold text-white">{patient.name}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    HR {patient.heartRate} bpm · SpO2 {patient.spo2}% · Temp {patient.temperature}°C
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={patient.spo2 < 90 ? 'Critical' : patient.status} />
                  <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white" />
                </div>
              </Link>
            ))}

            {!loading && !(patients || []).length ? (
              <EmptyState
                title="No patients yet"
                message="There is nothing to show until patient data is available."
                action={<Button as={Link} to="/login">Login</Button>}
              />
            ) : null}
          </div>
        </Card>
      </section>
    </div>
  );
}
