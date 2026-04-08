import React from 'react';
import { ArrowRight, Sparkles, ShieldCheck, MonitorSmartphone, Activity, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { featureItems, testimonials } from '../data/demoData';

const iconMap = {
  activity: Activity,
  'shield-alert': ShieldCheck,
  users: Users,
  smartphone: MonitorSmartphone,
};

export function Home() {
  return (
    <div className="space-y-20">
      <section className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="animate-fadeUp">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100">
            <Sparkles className="h-4 w-4" />
            Smart Healthcare Remote Monitoring System
          </div>
          <h1 className="mt-6 max-w-4xl font-display text-4xl font-bold leading-tight text-white md:text-6xl">
            A modern command center for patient vitals, alerts, and care team coordination.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
            Track heart rate, SpO2, and temperature in real time with a polished dashboard built for clinicians,
            caregivers, and operations teams.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button as="a" href="#features" size="lg">
              Explore Features <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap gap-4 text-sm text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Live vitals overview</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Predictive alerts</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Responsive by design</span>
          </div>
        </div>

        <Card className="relative overflow-hidden border-white/15 p-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.22),transparent_28%)]" />
          <div className="relative space-y-5 p-6 md:p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">System Snapshot</p>
                <h2 className="mt-2 font-display text-2xl font-bold text-white">Remote Monitoring Live</h2>
              </div>
              <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/25">
                Operational
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: 'Heart Rate', value: '82 bpm', tone: 'from-cyan-400/25 to-cyan-400/5' },
                { label: 'SpO2', value: '98%', tone: 'from-teal-400/25 to-teal-400/5' },
                { label: 'Temp', value: '36.7°C', tone: 'from-fuchsia-400/25 to-fuchsia-400/5' },
              ].map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <div className={`rounded-2xl bg-gradient-to-br ${metric.tone} p-4`}>
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-300">{metric.label}</p>
                    <p className="mt-3 font-display text-2xl font-bold text-white">{metric.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Observation Trend</span>
                <span>24h window</span>
              </div>
              <div className="mt-4 flex items-end gap-2">
                {[55, 60, 68, 64, 75, 72, 84, 81, 90].map((height, index) => (
                  <div key={index} className="flex-1 rounded-t-2xl bg-gradient-to-t from-cyan-500/60 to-fuchsia-500/80" style={{ height: `${height}px` }} />
                ))}
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section id="features" className="space-y-6 scroll-mt-32">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">Features</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">Designed for clarity under pressure</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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

      <section id="highlights" className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] scroll-mt-32">
        <Card className="space-y-5 p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">System Highlight</p>
          <h2 className="font-display text-3xl font-bold text-white">A UI that feels like a premium health platform</h2>
          <p className="text-sm leading-7 text-slate-300">
            Glass panels, layered gradients, and sharp status signals give the interface a trustworthy clinical feel
            without losing warmth or approachability.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              'Fast triage of at-risk patients',
              'Readable on mobile and workstation screens',
              'Designed for live monitoring operations',
              'Reuses backend prediction services cleanly',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-5">
          {testimonials.map((testimonial, index) => (
            <Card key={testimonial.author} className="p-6 md:p-7" style={{ animationDelay: `${index * 90}ms` }}>
              <p className="text-sm leading-7 text-slate-200">“{testimonial.quote}”</p>
              <div className="mt-5">
                <p className="font-semibold text-white">{testimonial.author}</p>
                <p className="text-sm text-slate-400">{testimonial.role}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
