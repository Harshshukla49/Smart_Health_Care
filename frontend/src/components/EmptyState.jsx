import React from 'react';
import { Inbox } from 'lucide-react';
import { Card } from './Card';

export function EmptyState({ title = 'No data available', message, action }) {
  return (
    <Card className="border-dashed border-white/15 bg-white/5 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300">
        <Inbox className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-display text-2xl font-bold text-white">{title}</h3>
      {message ? <p className="mt-3 text-sm leading-7 text-slate-300">{message}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  );
}