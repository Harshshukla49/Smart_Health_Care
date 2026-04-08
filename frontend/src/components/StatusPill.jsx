import React from 'react';

const styles = {
  Normal: 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/25',
  Warning: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/25',
  Critical: 'bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/25',
};

export function StatusPill({ status = 'Normal' }) {
  return (
    <span className={['inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em]', styles[status] || styles.Normal].join(' ')}>
      {status}
    </span>
  );
}
