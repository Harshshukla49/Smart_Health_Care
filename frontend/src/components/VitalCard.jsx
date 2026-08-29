import React from 'react';
import { Card } from './Card';
import { useI18n } from '../context/I18nContext';

export function VitalCard({
  label,
  value,
  unit,
  icon,
  updatedAt = '',
  vitalType = 'heartRate',
  status: explicitStatus,
  trend = '',
}) {
  const { t } = useI18n();
  const formattedValue = Number.isFinite(Number(value)) ? Number(value) : value || 0;

  // Determine clinical status if not explicitly provided
  let status = explicitStatus || 'normal';
  if (!explicitStatus && Number.isFinite(Number(value))) {
    const num = Number(value);
    if (vitalType === 'spo2') {
      if (num < 90) status = 'critical';
      else if (num < 95) status = 'warning';
      else status = 'normal';
    } else if (vitalType === 'heartRate') {
      if (num > 120 || num < 50) status = 'critical';
      else if (num > 100 || num < 60) status = 'warning';
      else status = 'normal';
    } else if (vitalType === 'temperature') {
      if (num > 38.5 || num < 35.0) status = 'critical';
      else if (num > 37.5) status = 'warning';
      else status = 'normal';
    }
  }

  // Clinical theme mappings
  const themeMap = {
    heartRate: {
      iconBg: 'bg-rose-50 border-rose-200 text-rose-600',
      borderAccent: 'border-t-2 border-t-rose-500',
      trendDefault: '↑ 3% vs baseline',
    },
    spo2: {
      iconBg: 'bg-teal-50 border-teal-200 text-teal-600',
      borderAccent: 'border-t-2 border-t-teal-500',
      trendDefault: 'Steady optimal',
    },
    temperature: {
      iconBg: 'bg-amber-50 border-amber-200 text-amber-600',
      borderAccent: 'border-t-2 border-t-amber-500',
      trendDefault: 'Stable 36.7°C',
    },
    bp: {
      iconBg: 'bg-indigo-50 border-indigo-200 text-indigo-600',
      borderAccent: 'border-t-2 border-t-indigo-500',
      trendDefault: 'Optimal 120/80',
    },
    respRate: {
      iconBg: 'bg-sky-50 border-sky-200 text-sky-600',
      borderAccent: 'border-t-2 border-t-sky-500',
      trendDefault: '16/min normal',
    },
  };

  const currentTheme = themeMap[vitalType] || themeMap.heartRate;

  const statusBadges = {
    normal: {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dot: 'bg-emerald-500',
      label: 'Normal',
    },
    warning: {
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      dot: 'bg-amber-500',
      label: 'Warning',
    },
    critical: {
      bg: 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse',
      dot: 'bg-rose-500',
      label: 'Critical',
    },
  };

  const badge = statusBadges[status] || statusBadges.normal;

  return (
    <Card className={`p-4 sm:p-5 group relative overflow-hidden bg-white border border-[#E2E8F0] shadow-[0_4px_18px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.07)] transition-all ${currentTheme.borderAccent}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-[#94A3B8] truncate">
            {label}
          </p>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-sans text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">
              {formattedValue}
            </span>
            <span className="text-xs font-semibold text-[#64748B]">
              {unit}
            </span>
          </div>
        </div>

        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${currentTheme.iconBg} shadow-2xs`}>
          {icon}
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.bg}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
          {badge.label}
        </span>

        <span className="text-[11px] font-medium text-[#64748B]">
          {trend || currentTheme.trendDefault}
        </span>
      </div>
    </Card>
  );
}

export default VitalCard;
