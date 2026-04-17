import React from 'react';
import { Card } from './Card';

export function MetricCard({ icon, label, value, delta, tone = 'cyan' }) {
  const toneStyles = {
    cyan: 'from-cyan-400/20 to-cyan-400/5 text-cyan-300 ring-cyan-300/30 border-cyan-300/20',
    purple: 'from-purple-400/20 to-purple-400/5 text-purple-300 ring-purple-300/30 border-purple-300/20',
    teal: 'from-teal-400/20 to-teal-400/5 text-teal-300 ring-teal-300/30 border-teal-300/20',
    blue: 'from-blue-400/20 to-blue-400/5 text-blue-300 ring-blue-300/30 border-blue-300/20',
    green: 'from-green-400/20 to-green-400/5 text-green-300 ring-green-300/30 border-green-300/20',
    red: 'from-red-400/20 to-red-400/5 text-red-300 ring-red-300/30 border-red-300/20',
  };

  return (
    <Card className="p-5 group hover:scale-102 transition-transform">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 font-semibold">{label}</p>
          <div className="mt-3 flex items-end gap-3">
            <h3 className="font-display text-3xl font-bold text-white">{value}</h3>
            {delta ? <span className="pb-1 text-sm font-semibold text-slate-300">{delta}</span> : null}
          </div>
        </div>
        <div className={['grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ring-1 border transition-all group-hover:ring-2 group-hover:scale-110', toneStyles[tone] || toneStyles.cyan].join(' ')}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
