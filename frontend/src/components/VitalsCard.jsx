import React from 'react';
import { Card } from './Card';

export function VitalsCard({ label, value, unit, icon, updatedAt, accent = 'text-cyan-200' }) {
  const displayValue = value === null || value === undefined || Number.isNaN(Number(value)) ? '--' : Number(value).toFixed(1);

  return (
    <Card className="group p-5 transition-all duration-500">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-400">{label}</p>
          <p className="mt-3 font-display text-3xl font-bold text-white transition-transform duration-500 group-hover:scale-[1.02]">
            {displayValue}
            <span className="ml-1 text-base font-semibold text-slate-300">{unit}</span>
          </p>
          <p className="mt-2 text-xs text-slate-400">Updated {updatedAt || 'just now'}</p>
        </div>
        <span className={["mt-1", accent].join(' ')}>{icon}</span>
      </div>
    </Card>
  );
}
