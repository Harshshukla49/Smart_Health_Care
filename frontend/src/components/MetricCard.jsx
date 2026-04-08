import React from 'react';
import { Card } from './Card';

export function MetricCard({ icon, label, value, delta, tone = 'cyan' }) {
  const toneStyles = {
    cyan: 'from-cyan-400/18 to-cyan-400/5 text-cyan-200 ring-cyan-300/20',
    purple: 'from-fuchsia-400/18 to-fuchsia-400/5 text-fuchsia-200 ring-fuchsia-300/20',
    teal: 'from-teal-400/18 to-teal-400/5 text-teal-200 ring-teal-300/20',
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-300">{label}</p>
          <div className="mt-2 flex items-end gap-3">
            <h3 className="font-display text-3xl font-bold text-white">{value}</h3>
            {delta ? <span className="pb-1 text-sm font-semibold text-cyan-200">{delta}</span> : null}
          </div>
        </div>
        <div className={['grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ring-1', toneStyles[tone] || toneStyles.cyan].join(' ')}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
