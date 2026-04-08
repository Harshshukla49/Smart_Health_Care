import React from 'react';

export function Loader({ label = 'Loading' }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-200 backdrop-blur-xl">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-300/40 border-t-cyan-300" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
