import React from 'react';
import { Brain, Sparkles } from 'lucide-react';
import { Card } from './Card';
import { Loader } from './Loader';
import { EmptyState } from './EmptyState';

const riskClassMap = {
  low: 'text-emerald-300',
  medium: 'text-amber-300',
  high: 'text-rose-300',
};

export function InsightsPanel({ insight, loading, error }) {
  const risk = String(insight?.risk || '').toLowerCase();
  const riskClassName = riskClassMap[risk] || 'text-slate-200';

  return (
    <Card id="insights" className="p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Insights</p>
          <h3 className="mt-2 font-display text-2xl font-bold text-white">Smart analysis</h3>
        </div>
        <Sparkles className="h-5 w-5 text-fuchsia-300" />
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        {loading ? <Loader label="Updating insights" /> : null}

        {!loading && error ? (
          <p className="text-sm text-amber-200">{error}</p>
        ) : null}

        {!loading && !error && insight ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Brain className={["h-5 w-5", riskClassName].join(' ')} />
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Risk level</p>
            </div>
            <p className={["font-display text-3xl font-bold uppercase", riskClassName].join(' ')}>{insight.risk}</p>
            <p className="text-sm leading-7 text-slate-300">{insight.message}</p>
          </div>
        ) : null}

        {!loading && !error && !insight ? (
          <EmptyState title="No insight yet" message="Insight will appear after the next vitals update." />
        ) : null}
      </div>
    </Card>
  );
}
