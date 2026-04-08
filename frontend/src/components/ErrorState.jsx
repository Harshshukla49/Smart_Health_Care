import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';

export function ErrorState({ title = 'Something went wrong', message, actionLabel = 'Try again', onRetry }) {
  return (
    <Card className="border-rose-400/20 bg-rose-400/5 p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/10 text-rose-200">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-display text-2xl font-bold text-white">{title}</h3>
      {message ? <p className="mt-3 text-sm leading-7 text-slate-300">{message}</p> : null}
      {onRetry ? (
        <div className="mt-5">
          <Button type="button" variant="secondary" onClick={onRetry}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}