import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, HeartPulse, ShieldCheck, Siren, Workflow } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { teamMembers } from '../data/demoData';
import { useI18n } from '../context/I18nContext';

export function About() {
  const { t } = useI18n();
  const trustSignals = [
    t('publicPages.about.trust.one'),
    t('publicPages.about.trust.two'),
    t('publicPages.about.trust.three'),
    t('publicPages.about.trust.four'),
  ];

  const architectureFlow = [
    {
      title: t('publicPages.about.arch.step1Title'),
      description: t('publicPages.about.arch.step1Desc'),
      icon: HeartPulse,
    },
    {
      title: t('publicPages.about.arch.step2Title'),
      description: t('publicPages.about.arch.step2Desc'),
      icon: Siren,
    },
    {
      title: t('publicPages.about.arch.step3Title'),
      description: t('publicPages.about.arch.step3Desc'),
      icon: Workflow,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={t('publicPages.about.header.eyebrow')}
        title={t('publicPages.about.header.title')}
        description={t('publicPages.about.header.description')}
      />

      <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {trustSignals.map((signal) => (
          <div key={signal} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200">
            {signal}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">{t('publicPages.about.mission.eyebrow')}</p>
          <h2 className="font-display text-2xl font-bold text-white">{t('publicPages.about.mission.title')}</h2>
          <p className="text-sm leading-7 text-slate-300">
            {t('publicPages.about.mission.description')}
          </p>
          <ul className="space-y-2 text-sm text-slate-200">
            <li>{t('publicPages.about.mission.bullets.one')}</li>
            <li>{t('publicPages.about.mission.bullets.two')}</li>
            <li>{t('publicPages.about.mission.bullets.three')}</li>
          </ul>
        </Card>

        <Card className="space-y-4 p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-fuchsia-300">{t('publicPages.about.vision.eyebrow')}</p>
          <h2 className="font-display text-2xl font-bold text-white">{t('publicPages.about.vision.title')}</h2>
          <p className="text-sm leading-7 text-slate-300">
            {t('publicPages.about.vision.description')}
          </p>
          <ul className="space-y-2 text-sm text-slate-200">
            <li>{t('publicPages.about.vision.bullets.one')}</li>
            <li>{t('publicPages.about.vision.bullets.two')}</li>
            <li>{t('publicPages.about.vision.bullets.three')}</li>
          </ul>
        </Card>
      </div>

      <section className="mt-10 space-y-6">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">{t('publicPages.about.arch.eyebrow')}</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-white">{t('publicPages.about.arch.title')}</h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {architectureFlow.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="h-full p-6">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-fuchsia-500/20 ring-1 ring-white/10">
                  <Icon className="h-5 w-5 text-cyan-100" />
                </div>
                <h3 className="mt-5 font-display text-2xl font-bold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{item.description}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mt-10 space-y-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">{t('publicPages.about.team.eyebrow')}</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-white">{t('publicPages.about.team.title')}</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {teamMembers.map((member) => (
            <Card key={member.name} className="p-6">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-400/25 to-fuchsia-500/25 ring-1 ring-white/10" />
              <h3 className="mt-5 font-display text-xl font-bold text-white">{member.name}</h3>
              <p className="mt-1 text-sm font-semibold text-cyan-200">{member.title}</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">{member.bio}</p>
              <p className="mt-2 text-sm text-slate-200">{t('publicPages.about.team.footer')}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <Card className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">{t('publicPages.about.next.eyebrow')}</p>
            <h3 className="mt-2 font-display text-2xl font-bold text-white">{t('publicPages.about.next.title')}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
              {t('publicPages.about.next.description')}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button as={Link} to="/login/doctor" size="lg">
              {t('auth.loginSelection.doctorTitle')} <ArrowRight className="h-4 w-4" />
            </Button>
            <Button as={Link} to="/login/patient" variant="secondary" size="lg">
              {t('auth.loginSelection.patientTitle')} <ShieldCheck className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
