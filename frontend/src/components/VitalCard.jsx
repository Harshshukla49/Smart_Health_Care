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
  const numValue = Number(value);

  // Determine clinical status if not explicitly provided
  let status = explicitStatus || 'normal';
  if (!explicitStatus && Number.isFinite(numValue)) {
    if (vitalType === 'spo2') {
      if (numValue < 90) status = 'critical';
      else if (numValue < 95) status = 'warning';
      else status = 'normal';
    } else if (vitalType === 'heartRate') {
      if (numValue > 120 || numValue < 50) status = 'critical';
      else if (numValue > 100 || numValue < 60) status = 'warning';
      else status = 'normal';
    } else if (vitalType === 'temperature') {
      if (numValue > 38.5 || numValue < 35.0) status = 'critical';
      else if (numValue > 37.5) status = 'warning';
      else status = 'normal';
    }
  }

  // Clinical theme mappings
  const themeMap = {
    heartRate: {
      iconBg: 'bg-rose-50 border-rose-200/80 text-rose-600',
      borderAccent: 'hover:border-rose-300',
      trendDefault: '↑ 3% vs baseline',
      accentColor: '#e11d48',
    },
    spo2: {
      iconBg: 'bg-teal-50 border-teal-200/80 text-teal-600',
      borderAccent: 'hover:border-teal-300',
      trendDefault: 'Steady optimal',
      accentColor: '#0d9488',
    },
    temperature: {
      iconBg: 'bg-amber-50 border-amber-200/80 text-amber-600',
      borderAccent: 'hover:border-amber-300',
      trendDefault: 'Stable 36.7°C',
      accentColor: '#d97706',
    },
    bp: {
      iconBg: 'bg-indigo-50 border-indigo-200/80 text-indigo-600',
      borderAccent: 'hover:border-indigo-300',
      trendDefault: 'Optimal 120/80',
      accentColor: '#4f46e5',
    },
    respRate: {
      iconBg: 'bg-sky-50 border-sky-200/80 text-sky-600',
      borderAccent: 'hover:border-sky-300',
      trendDefault: '16/min normal',
      accentColor: '#0284c7',
    },
  };

  const currentTheme = themeMap[vitalType] || themeMap.heartRate;

  const statusBadges = {
    normal: {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      dot: 'bg-emerald-500',
      label: 'Normal',
    },
    stable: {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      dot: 'bg-emerald-500',
      label: 'Stable',
    },
    monitoring: {
      bg: 'bg-sky-50 text-sky-700 border-sky-200/80',
      dot: 'bg-sky-500 animate-pulse',
      label: 'Monitoring',
    },
    warning: {
      bg: 'bg-amber-50 text-amber-800 border-amber-200/80',
      dot: 'bg-amber-500',
      label: 'Warning',
    },
    critical: {
      bg: 'bg-rose-50 text-rose-700 border-rose-200/80',
      dot: 'bg-rose-500 animate-pulse',
      label: 'Critical',
    },
  };

  const badge = statusBadges[status.toLowerCase()] || statusBadges.normal;

  return (
    <Card className={`p-4 sm:p-5 group relative overflow-hidden bg-white border border-[#E2E8F0] shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_26px_rgba(15,23,42,0.07)] transition-all duration-200 ${currentTheme.borderAccent}`}>
      {/* Top row: Label + Icon + Status */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${currentTheme.iconBg} shadow-2xs`}>
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#94A3B8] truncate">
              {label}
            </p>
          </div>
        </div>

        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold shrink-0 ${badge.bg}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
          <span>{badge.label}</span>
        </span>
      </div>

      {/* Main Focus: Primary Value */}
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-sans text-3xl sm:text-[34px] font-extrabold tracking-tight text-[#0F172A] leading-none">
          {formattedValue}
        </span>
        <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
          {unit}
        </span>
      </div>

      {/* Micro Visualization per vital type */}
      <div className="mt-3.5 pt-2 border-t border-slate-100">
        {vitalType === 'heartRate' ? (
          <div className="space-y-1.5">
            <div className="h-6 w-full flex items-center overflow-hidden">
              <svg className="w-full h-full text-rose-500" viewBox="0 0 160 30" fill="none" preserveAspectRatio="none">
                <path
                  d="M0,15 L35,15 L45,15 L52,4 L60,26 L68,10 L75,18 L82,15 L120,15 L128,8 L134,22 L140,15 L160,15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-80"
                />
              </svg>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#64748B]">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                <span className="font-medium text-[#475569]">Sinus rhythm</span>
              </span>
              <span className="font-medium">{trend || currentTheme.trendDefault}</span>
            </div>
          </div>
        ) : vitalType === 'spo2' ? (
          <div className="space-y-1.5">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-teal-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(Math.max(Number(value) || 98, 0), 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#64748B]">
              <span className="font-medium text-[#475569]">O₂ Saturation</span>
              <span className="font-medium">{trend || 'Optimal ≥ 95%'}</span>
            </div>
          </div>
        ) : vitalType === 'temperature' ? (
          <div className="space-y-1.5">
            <div className="relative w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{ width: '62%' }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#64748B]">
              <span className="font-medium text-[#475569]">Normothermic</span>
              <span className="font-medium">{trend || '36.5 – 37.5°C'}</span>
            </div>
          </div>
        ) : vitalType === 'bp' ? (
          <div className="space-y-1.5">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-indigo-500 h-full rounded-full" style={{ width: '70%' }} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#64748B]">
              <span className="font-medium text-[#475569]">Systolic / Diastolic</span>
              <span className="font-medium">{trend || 'Optimal range'}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-sky-500 h-full rounded-full" style={{ width: '55%' }} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#64748B]">
              <span className="font-medium text-[#475569]">Eupneic</span>
              <span className="font-medium">{trend || currentTheme.trendDefault}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default VitalCard;
