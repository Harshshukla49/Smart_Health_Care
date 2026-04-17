import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Sparkles, ShieldCheck, MonitorSmartphone, Activity, Users, HeartPulse } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { featureItems, testimonials } from '../data/demoData';
import { useI18n } from '../context/I18nContext';

const iconMap = {
  activity: Activity,
  'shield-alert': ShieldCheck,
  'heart-pulse': HeartPulse,
  users: Users,
  smartphone: MonitorSmartphone,
};

export function Home() {
  const { t } = useI18n();
  const workflowSteps = [
    {
      title: t('publicPages.home.workflow.step1Title'),
      description: t('publicPages.home.workflow.step1Desc'),
      icon: MonitorSmartphone,
    },
    {
      title: t('publicPages.home.workflow.step2Title'),
      description: t('publicPages.home.workflow.step2Desc'),
      icon: Activity,
    },
    {
      title: t('publicPages.home.workflow.step3Title'),
      description: t('publicPages.home.workflow.step3Desc'),
      icon: Users,
    },
  ];

  const trustSignals = [
    {
      label: t('publicPages.home.trust.one'),
      icon: Activity,
      ring: 'from-cyan-400/25 via-sky-400/15 to-white/5',
      iconTone: 'text-cyan-200',
    },
    {
      label: t('publicPages.home.trust.two'),
      icon: ShieldCheck,
      ring: 'from-emerald-400/25 via-teal-400/15 to-white/5',
      iconTone: 'text-emerald-200',
    },
    {
      label: t('publicPages.home.trust.three'),
      icon: Users,
      ring: 'from-fuchsia-400/25 via-pink-400/15 to-white/5',
      iconTone: 'text-fuchsia-200',
    },
    {
      label: t('publicPages.home.trust.four'),
      icon: Sparkles,
      ring: 'from-amber-400/25 via-orange-400/15 to-white/5',
      iconTone: 'text-amber-200',
    },
  ];

  const testimonialImpact = [
    t('publicPages.home.testimonialImpact.one'),
    t('publicPages.home.testimonialImpact.two'),
    t('publicPages.home.testimonialImpact.three'),
  ];

  const highlightBullets = [
    {
      text: t('publicPages.home.highlight.bullets.one'),
      icon: Activity,
      tone: 'from-cyan-400/25 via-cyan-400/10 to-transparent',
    },
    {
      text: t('publicPages.home.highlight.bullets.two'),
      icon: ShieldCheck,
      tone: 'from-emerald-400/25 via-emerald-400/10 to-transparent',
    },
    {
      text: t('publicPages.home.highlight.bullets.three'),
      icon: HeartPulse,
      tone: 'from-fuchsia-400/25 via-fuchsia-400/10 to-transparent',
    },
    {
      text: t('publicPages.home.highlight.bullets.four'),
      icon: Users,
      tone: 'from-amber-400/25 via-amber-400/10 to-transparent',
    },
  ];

  return (
    <div className="space-y-20">
      <section className="grid items-center gap-10 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="animate-fadeUp">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100">
            <Sparkles className="h-4 w-4" />
            {t('publicPages.home.badge')}
          </div>
          <h1 className="mt-6 max-w-4xl font-display text-4xl font-bold leading-tight text-white md:text-6xl">
            {t('publicPages.home.heroTitle')}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
            {t('publicPages.home.heroSubtitle')}
          </p>

          <div className="mt-7 rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-950/70 via-slate-950/45 to-cyan-950/25 p-3 shadow-[0_24px_70px_rgba(2,6,23,0.35)]">
            <div className="grid gap-3 md:grid-cols-2">
              {trustSignals.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className={`group rounded-2xl border bg-gradient-to-br ${item.ring} px-4 py-3 shadow-[0_14px_34px_rgba(2,6,23,0.2)] transition-transform hover:-translate-y-0.5`}>
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/10 ${item.iconTone} ring-1 ring-white/10`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-6 text-white">{item.label}</p>
                        <div className="mt-2 h-px w-24 bg-gradient-to-r from-white/40 via-white/20 to-transparent" />
                        <p className="mt-2 text-[11px] uppercase tracking-[0.28em] text-slate-300">Powered for clinical workflows</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button as="a" href="#features" size="lg" className="hero-cta hero-cta-primary">
              {t('publicPages.home.cta.exploreFeatures')} <ArrowRight className="h-4 w-4" />
            </Button>
            <Button as={Link} to="/login/doctor" variant="secondary" size="lg" className="hero-cta hero-cta-secondary">
              {t('publicPages.home.cta.doctorAccess')} <ShieldCheck className="h-4 w-4" />
            </Button>
            <Button as={Link} to="/login/patient" variant="secondary" size="lg" className="hero-cta hero-cta-secondary">
              {t('publicPages.home.cta.patientPortal')} <HeartPulse className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card className="relative overflow-hidden border-white/15 p-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.22),transparent_28%)]" />
          <div className="relative space-y-5 p-6 md:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">System Snapshot</p>
                <h2 className="mt-2 font-display text-2xl font-bold text-white">{t('publicPages.home.snapshot.title')}</h2>
              </div>
              <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/25">
                {t('publicPages.home.snapshot.status')}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: t('publicPages.home.snapshot.hr'), value: '82 bpm', tone: 'from-cyan-400/25 to-cyan-400/5' },
                { label: t('publicPages.home.snapshot.spo2'), value: '98%', tone: 'from-teal-400/25 to-teal-400/5' },
                { label: t('publicPages.home.snapshot.temp'), value: '36.7°C', tone: 'from-fuchsia-400/25 to-fuchsia-400/5' },
              ].map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <div className={`rounded-2xl bg-gradient-to-br ${metric.tone} p-4`}>
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-300">{metric.label}</p>
                    <p className="mt-3 font-display text-2xl font-bold text-white">{metric.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <ObservationTrendChart />
          </div>
        </Card>
      </section>

      <section id="features" className="space-y-6 scroll-mt-32">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">{t('publicPages.home.features.eyebrow')}</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">{t('publicPages.home.features.title')}</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {featureItems.map((item) => {
            const Icon = iconMap[item.icon];
            return (
              <Card key={item.title} className="group h-full p-6">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-fuchsia-500/20 ring-1 ring-white/10 transition group-hover:scale-105 group-hover:ring-cyan-300/25">
                  <Icon className="h-6 w-6 text-cyan-200" />
                </div>
                <h3 className="mt-5 font-display text-xl font-bold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{item.description}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section id="workflow" className="space-y-6 scroll-mt-32">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">{t('publicPages.home.workflow.eyebrow')}</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">{t('publicPages.home.workflow.title')}</h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {workflowSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card key={step.title} className="h-full p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">Step 0{index + 1}</span>
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-fuchsia-500/20 ring-1 ring-white/10">
                    <Icon className="h-5 w-5 text-cyan-100" />
                  </div>
                </div>
                <h3 className="mt-5 font-display text-2xl font-bold text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{step.description}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section id="highlights" className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr] scroll-mt-32">
        <Card className="relative overflow-hidden p-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_8%,rgba(45,212,191,0.16),transparent_38%),radial-gradient(circle_at_90%_85%,rgba(56,189,248,0.14),transparent_42%)]" />
          <div className="relative space-y-6 p-6 md:p-8">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">{t('publicPages.home.highlight.eyebrow')}</p>
              <h2 className="font-display text-3xl font-bold leading-tight text-white md:text-[2.15rem]">{t('publicPages.home.highlight.title')}</h2>
              <p className="max-w-3xl text-sm leading-8 text-slate-300 md:text-base">
                {t('publicPages.home.highlight.description')}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {highlightBullets.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.text} className={`rounded-2xl border border-white/10 bg-gradient-to-br ${item.tone} p-4 backdrop-blur-sm`}>
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-slate-950/35 text-cyan-100">
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <p className="text-sm font-medium leading-7 text-slate-100">{item.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Avg alert triage', value: '< 30s' },
                { label: 'Signal confidence', value: '98.2%' },
                { label: 'Team sync status', value: 'Live' },
              ].map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{metric.label}</p>
                  <p className="mt-2 font-display text-2xl font-bold text-white">{metric.value}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="grid gap-5">
          {testimonials.map((testimonial, index) => (
            <Card key={testimonial.author} className="p-6 md:p-7" style={{ animationDelay: `${index * 90}ms` }}>
              <p className="text-sm leading-7 text-slate-200">“{testimonial.quote}”</p>
              <div className="mt-5">
                <p className="font-semibold text-white">{testimonial.author}</p>
                <p className="text-sm text-slate-400">{testimonial.role}</p>
                <p className="mt-2 text-sm text-cyan-200">{testimonialImpact[index] || 'Improved operational confidence across monitoring.'}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function ObservationTrendChart() {
  const { t } = useI18n();
  const [points, setPoints] = useState([66, 71, 64, 78, 69, 74, 60, 82, 76, 88, 72, 85]);
  const driftRef = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPoints((current) => {
        const previous = current[current.length - 1] ?? 72;
        driftRef.current += 1;
        const wave = Math.sin(driftRef.current * 0.75) * 4.8;
        const directionalShift = (Math.random() - 0.5) * 5.8;
        const pulse = Math.random() > 0.9 ? (Math.random() > 0.5 ? 7 : -7) : 0;
        const next = Math.max(56, Math.min(95, Math.round(previous + directionalShift + wave + pulse)));
        return [...current.slice(1), next];
      });
    }, 850);

    return () => window.clearInterval(timer);
  }, []);

  const width = 600;
  const height = 190;
  const padding = 18;
  const stepX = (width - padding * 2) / (points.length - 1);

  const chartPoints = points.map((value, index) => {
    const normalized = (value - 55) / 40;
    const x = padding + index * stepX;
    const y = height - padding - normalized * (height - padding * 2);
    return { x, y, value };
  });

  const linePath = chartPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  const areaPath = `${linePath} L ${chartPoints[chartPoints.length - 1].x.toFixed(2)} ${(height - padding).toFixed(2)} L ${chartPoints[0].x.toFixed(2)} ${(height - padding).toFixed(2)} Z`;

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
      <div className="flex items-center justify-between text-sm text-slate-300">
        <span>{t('publicPages.home.trend.title')}</span>
        <span>{t('publicPages.home.trend.window')}</span>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/70 to-slate-950/90 p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[170px] w-full" preserveAspectRatio="none" role="img" aria-label={t('publicPages.home.trend.ariaLabel')}>
          <defs>
            <linearGradient id="trend-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(52, 211, 153, 0.35)" />
              <stop offset="55%" stopColor="rgba(34, 211, 238, 0.18)" />
              <stop offset="100%" stopColor="rgba(15, 23, 42, 0.03)" />
            </linearGradient>
            <linearGradient id="trend-stroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(34, 211, 238, 0.9)" />
              <stop offset="55%" stopColor="rgba(99, 102, 241, 0.92)" />
              <stop offset="100%" stopColor="rgba(217, 70, 239, 0.9)" />
            </linearGradient>
          </defs>

          {[0.2, 0.4, 0.6, 0.8].map((line, index) => (
            <line
              key={`grid-${index}`}
              x1={padding}
              y1={padding + (height - padding * 2) * line}
              x2={width - padding}
              y2={padding + (height - padding * 2) * line}
              stroke="rgba(148, 163, 184, 0.18)"
              strokeDasharray="4 6"
            />
          ))}

          <motion.path
            d={linePath}
            fill="none"
            stroke="url(#trend-stroke)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ d: linePath, pathLength: 1 }}
            transition={{ duration: 0.78, ease: 'easeInOut' }}
          />

          <motion.path
            d={areaPath}
            fill="url(#trend-area)"
            initial={{ opacity: 0.7 }}
            animate={{ d: areaPath, opacity: [0.65, 0.85, 0.65] }}
            transition={{ duration: 0.82, ease: 'easeInOut' }}
          />

          {chartPoints.map((point, index) => (
            <motion.circle
              key={`dot-${index}`}
              cx={point.x}
              cy={point.y}
              r={index === chartPoints.length - 1 ? 5 : 3.2}
              fill={index === chartPoints.length - 1 ? 'rgba(16, 185, 129, 0.95)' : 'rgba(125, 211, 252, 0.9)'}
              animate={{ opacity: [0.55, 1, 0.55] }}
              transition={{ duration: 2.6, repeat: Infinity, delay: index * 0.08 }}
            />
          ))}

          <motion.circle
            cx={chartPoints[chartPoints.length - 1].x}
            cy={chartPoints[chartPoints.length - 1].y}
            r="8"
            fill="rgba(16, 185, 129, 0.18)"
            animate={{ scale: [1, 1.45, 1], opacity: [0.25, 0.5, 0.25] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </svg>

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(56,189,248,0.08)_45%,transparent_70%)] animate-[pulse_2.8s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
