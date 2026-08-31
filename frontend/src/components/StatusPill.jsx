import React from 'react';
import { useI18n } from '../context/I18nContext';

const statusConfig = {
  Normal: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    dot: 'bg-emerald-500',
  },
  Stable: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    dot: 'bg-emerald-500',
  },
  Monitoring: {
    badge: 'bg-sky-50 text-sky-700 border-sky-200/80',
    dot: 'bg-sky-500 animate-pulse',
  },
  Warning: {
    badge: 'bg-amber-50 text-amber-800 border-amber-200/80',
    dot: 'bg-amber-500',
  },
  Attention: {
    badge: 'bg-amber-50 text-amber-800 border-amber-200/80',
    dot: 'bg-amber-500',
  },
  Critical: {
    badge: 'bg-rose-50 text-rose-700 border-rose-200/80',
    dot: 'bg-rose-500 animate-pulse',
  },
  Offline: {
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  },
};

export function StatusPill({ status = 'Normal', size = 'sm', pulse = false }) {
  const { t } = useI18n();

  const normalizedKey = Object.keys(statusConfig).find(
    (key) => key.toLowerCase() === String(status).toLowerCase()
  ) || 'Normal';
  
  const config = statusConfig[normalizedKey] || statusConfig.Normal;
  const translatedStatus = t(`statuses.${normalizedKey.toLowerCase()}`) || status;

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide shadow-2xs',
        size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs',
        config.badge,
      ].join(' ')}
    >
      <span
        className={[
          'h-1.5 w-1.5 rounded-full shrink-0',
          config.dot,
          pulse ? 'animate-pulse' : '',
        ].join(' ')}
      />
      <span>{translatedStatus}</span>
    </span>
  );
}

export default StatusPill;
