import React from 'react';
import { Activity } from 'lucide-react';
import { Card } from './Card';

export function EmptyState({
  title = 'No recent health readings',
  message = 'Your latest measurements will appear here when your device sends new telemetry data.',
  icon: Icon = Activity,
  action,
}) {
  return (
    <Card className="border-dashed border-[#CBD5E1] bg-slate-50/70 p-8 sm:p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-[#0284C7] shadow-2xs">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-3.5 font-sans text-lg font-bold text-[#0F172A]">{title}</h3>
      {message ? (
        <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-[#64748B] max-w-md mx-auto">
          {message}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </Card>
  );
}

export default EmptyState;