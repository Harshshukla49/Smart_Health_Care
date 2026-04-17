import React from 'react';
import { Card } from './Card';
import { useI18n } from '../context/I18nContext';

export function VitalCard({ label, value, unit, icon, accent = 'text-cyan-200', updatedAt = '', vitalType = 'heart' }) {
  const { t } = useI18n();
  const formattedValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  
  // Determine if value is critical
  const isCritical = (vitalType === 'spo2' && formattedValue < 90) || 
                    (vitalType === 'heartRate' && (formattedValue > 120 || formattedValue < 60)) ||
                    (vitalType === 'temperature' && (formattedValue > 38.5 || formattedValue < 35));
  
  // Map vital type to gradient class
  const gradientMap = {
    heart: 'card-vitals-heart',
    spo2: 'card-vitals-spo2',
    temperature: 'card-vitals-temperature',
    ecg: 'card-vitals-ecg'
  };

  return (
    <Card className={`p-5 group relative overflow-hidden transition-all duration-300 ${gradientMap[vitalType] || ''}`}>
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 font-semibold">{label}</p>
          <p className={`mt-3 font-display text-3xl font-bold transition-all duration-300 group-hover:scale-105 ${isCritical ? 'vital-value critical animate-pulse' : 'vital-value normal'}`}>
            {formattedValue}
            <span className="ml-1 text-base font-semibold text-slate-400">{unit}</span>
          </p>
          <p className="mt-2 text-xs text-slate-500">{t('dashboard.vitalCard.updated')} {updatedAt || t('dashboard.vitalCard.justNow')}</p>
        </div>

        <div className={`grid h-12 w-12 place-items-center rounded-2xl bg-white/8 ring-1 ring-white/15 group-hover:ring-white/30 transition-all ${accent}`}>
          {isCritical && <div className="absolute inset-0 rounded-2xl animate-pulse bg-red-500/20"></div>}
          <span className="relative z-10">
            {icon}
          </span>
        </div>
      </div>
    </Card>
  );
}
