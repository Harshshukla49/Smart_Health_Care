import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowRight, Clock3, MessageCircleMore, ShieldCheck, Stethoscope } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useI18n } from '../context/I18nContext';
import { submitContactMessage } from '../services/api';

const initialState = {
  name: '',
  email: '',
  message: '',
};

export function Contact() {
  const { t } = useI18n();
  const [formData, setFormData] = useState(initialState);
  const [loading, setLoading] = useState(false);

  const capabilityItems = [
    {
      text: t('publicPages.contact.capabilities.one'),
      chip: 'from-cyan-400/25 via-sky-400/15 to-white/5 text-cyan-50 ring-cyan-300/25',
      dot: 'bg-cyan-300',
    },
    {
      text: t('publicPages.contact.capabilities.two'),
      chip: 'from-emerald-400/25 via-teal-400/15 to-white/5 text-emerald-50 ring-emerald-300/25',
      dot: 'bg-emerald-300',
    },
    {
      text: t('publicPages.contact.capabilities.three'),
      chip: 'from-fuchsia-400/25 via-pink-400/15 to-white/5 text-fuchsia-50 ring-fuchsia-300/25',
      dot: 'bg-fuchsia-300',
    },
    {
      text: t('publicPages.contact.capabilities.four'),
      chip: 'from-amber-400/25 via-orange-400/15 to-white/5 text-amber-50 ring-amber-300/25',
      dot: 'bg-amber-300',
    },
  ];

  const responseCards = [
    {
      label: t('publicPages.contact.response.sla'),
      value: t('publicPages.contact.response.slaValue'),
      icon: Clock3,
      ring: 'ring-cyan-300/25',
      glow: 'from-cyan-400/22 via-sky-400/12 to-transparent',
      iconTone: 'text-cyan-200',
    },
    {
      label: t('publicPages.contact.response.clinical'),
      value: t('publicPages.contact.response.clinicalValue'),
      icon: Stethoscope,
      ring: 'ring-emerald-300/25',
      glow: 'from-emerald-400/22 via-teal-400/12 to-transparent',
      iconTone: 'text-emerald-200',
    },
    {
      label: t('publicPages.contact.response.security'),
      value: t('publicPages.contact.response.securityValue'),
      icon: ShieldCheck,
      ring: 'ring-fuchsia-300/25',
      glow: 'from-fuchsia-400/22 via-pink-400/12 to-transparent',
      iconTone: 'text-fuchsia-200',
    },
  ];

  const contactMethods = [
    {
      label: t('publicPages.contact.form.email'),
      value: 'support@smarthealth.com',
      chip: 'from-cyan-400/18 to-sky-400/6',
      accent: 'text-cyan-100',
    },
    {
      label: t('publicPages.contact.form.phone'),
      value: '+1 (555) 012-4310',
      chip: 'from-fuchsia-400/18 to-pink-400/6',
      accent: 'text-fuchsia-100',
    },
  ];

  const quickActions = [
    {
      label: 'Chat on WhatsApp',
      href: 'https://wa.me/15550124310?text=Hi%20SmartHealth%2C%20I%20need%20help%20with%20the%20contact%20page.',
      icon: MessageCircleMore,
      className: 'from-emerald-400 to-teal-500 text-white shadow-[0_18px_40px_rgba(16,185,129,0.26)]',
    },
  ];

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await submitContactMessage(formData);
      toast.success(result.message);
      setFormData(initialState);
    } catch (error) {
      toast.error(error.message || t('publicPages.contact.form.sendError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={t('publicPages.contact.header.eyebrow')}
        title={t('publicPages.contact.header.title')}
        description={t('publicPages.contact.header.description')}
      />

      <div className="mb-8 rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-950/70 via-slate-950/55 to-indigo-950/35 p-3 shadow-[0_20px_60px_rgba(2,6,23,0.42)]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {capabilityItems.map((item) => (
            <div key={item.text} className={`rounded-2xl border bg-gradient-to-br px-4 py-3 text-sm font-medium shadow-[0_12px_30px_rgba(2,6,23,0.22)] backdrop-blur-sm transition-transform hover:-translate-y-0.5 ${item.chip}`}>
              <div className="flex items-start gap-3">
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.dot} shadow-[0_0_16px_rgba(255,255,255,0.45)]`} />
                <div className="min-w-0">
                  <p className="leading-6 text-slate-50">{item.text}</p>
                  <div className="mt-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-slate-300">
                    <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
                    Ready
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <Card className="p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {[
              { label: t('publicPages.contact.form.name'), name: 'name', type: 'text', placeholder: t('publicPages.contact.form.namePlaceholder') },
              { label: t('publicPages.contact.form.email'), name: 'email', type: 'email', placeholder: t('publicPages.contact.form.emailPlaceholder') },
            ].map((field) => (
              <label key={field.name} className="block space-y-2">
                <span className="text-sm font-semibold text-slate-200">{field.label}</span>
                <input
                  type={field.type}
                  name={field.name}
                  value={formData[field.name]}
                  onChange={handleChange}
                  placeholder={field.placeholder}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:bg-white/8 focus:ring-2 focus:ring-cyan-300/20"
                />
              </label>
            ))}

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-200">{t('publicPages.contact.form.message')}</span>
              <textarea
                name="message"
                rows="6"
                value={formData.message}
                onChange={handleChange}
                placeholder={t('publicPages.contact.form.messagePlaceholder')}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:bg-white/8 focus:ring-2 focus:ring-cyan-300/20"
              />
            </label>

            <Button type="submit" size="lg" disabled={loading}>
              {loading ? t('publicPages.contact.form.sending') : t('publicPages.contact.form.send')}
            </Button>
          </form>
        </Card>

        <Card className="relative overflow-hidden space-y-5 p-6 md:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.14),transparent_34%)]" />
          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">{t('publicPages.contact.response.eyebrow')}</p>
            <div className="mt-4 rounded-[24px] border border-cyan-300/15 bg-gradient-to-r from-cyan-400/10 via-slate-950/50 to-fuchsia-400/10 p-5 shadow-[0_20px_50px_rgba(2,6,23,0.35)]">
              <h2 className="font-display text-3xl font-bold text-white">{t('publicPages.contact.response.title')}</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
                {t('publicPages.contact.response.description')}
              </p>
            </div>
          </div>

          <div className="relative grid gap-3 sm:grid-cols-1">
            {quickActions.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.label}
                  as="a"
                  href={item.href}
                  variant="secondary"
                  size="lg"
                  className={`group w-full justify-between border-0 bg-gradient-to-r ${item.className}`}
                  target={item.href.startsWith('http') ? '_blank' : undefined}
                  rel={item.href.startsWith('http') ? 'noreferrer' : undefined}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              );
            })}
          </div>

          <div className="relative grid gap-3 sm:grid-cols-3">
            {responseCards.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className={`rounded-[22px] border border-white/10 bg-gradient-to-br ${item.glow} p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] backdrop-blur-sm ${item.ring}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-200"><Icon className={`h-4 w-4 ${item.iconTone}`} /> {item.label}</p>
                    <span className="h-2.5 w-2.5 rounded-full bg-white/50 shadow-[0_0_16px_rgba(255,255,255,0.45)]" />
                  </div>
                  <p className="mt-4 text-sm font-semibold leading-6 text-white">{item.value}</p>
                </div>
              );
            })}
          </div>

          <div className="relative grid gap-4 sm:grid-cols-2">
            {contactMethods.map((item) => (
              <div key={item.label} className={`rounded-[24px] border border-white/10 bg-gradient-to-br ${item.chip} p-4 shadow-[0_16px_36px_rgba(2,6,23,0.2)]`}>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-300">{item.label}</p>
                <p className={`mt-3 font-semibold ${item.accent}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

    </div>
  );
}
