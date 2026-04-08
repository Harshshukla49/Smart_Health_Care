import React from 'react';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { teamMembers } from '../data/demoData';

export function About() {
  return (
    <div>
      <PageHeader
        eyebrow="About Us"
        title="Built to make remote care feel immediate, calm, and reliable."
        description="Smart Healthcare Remote Monitoring System combines predictive insights, real-time vitals, and a clear clinician-first interface for modern patient oversight."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Our Mission</p>
          <h2 className="font-display text-2xl font-bold text-white">Give every care team a single source of truth.</h2>
          <p className="text-sm leading-7 text-slate-300">
            We want clinicians to see the right signal faster, reduce uncertainty in monitoring workflows, and make
            critical care coordination feel smooth instead of fragmented.
          </p>
        </Card>

        <Card className="space-y-4 p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-fuchsia-300">Our Vision</p>
          <h2 className="font-display text-2xl font-bold text-white">A proactive health platform built around prevention.</h2>
          <p className="text-sm leading-7 text-slate-300">
            Our vision is a connected monitoring experience where early warning signs are visible before they become
            emergencies, improving response times and care outcomes.
          </p>
        </Card>
      </div>

      <section className="mt-10 space-y-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">Our Team</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-white">A small team with a strong clinical mindset</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {teamMembers.map((member) => (
            <Card key={member.name} className="p-6">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-400/25 to-fuchsia-500/25 ring-1 ring-white/10" />
              <h3 className="mt-5 font-display text-xl font-bold text-white">{member.name}</h3>
              <p className="mt-1 text-sm font-semibold text-cyan-200">{member.title}</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">{member.bio}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
