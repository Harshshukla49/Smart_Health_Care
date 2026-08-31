import React from 'react';

export function Loader({ label = 'Synchronizing Telemetry...' }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sky-900 shadow-2xs">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-[#0284C7]" />
      <span className="text-xs sm:text-sm font-semibold tracking-tight">{label}</span>
    </div>
  );
}

export function SkeletonVitalCard() {
  return (
    <div className="rounded-[18px] border border-[#E2E8F0] bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-3 w-20 rounded-md skeleton-shimmer" />
          <div className="h-7 w-24 rounded-md skeleton-shimmer" />
        </div>
        <div className="h-9 w-9 rounded-xl skeleton-shimmer" />
      </div>
      <div className="pt-2 border-t border-slate-100 flex justify-between">
        <div className="h-4 w-16 rounded-full skeleton-shimmer" />
        <div className="h-3 w-20 rounded-md skeleton-shimmer" />
      </div>
    </div>
  );
}

export default Loader;
