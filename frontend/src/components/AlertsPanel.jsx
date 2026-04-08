import React from 'react';
import { AlertTriangle, CheckCircle2, Siren } from 'lucide-react';
import { Card } from './Card';
import { EmptyState } from './EmptyState';

const alertStyles = {
  normal: {
    ring: 'border-emerald-300/25 bg-emerald-500/10',
    text: 'text-emerald-100',
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-300" />,
  },
  warning: {
    ring: 'border-amber-300/25 bg-amber-500/10',
    text: 'text-amber-100',
    icon: <AlertTriangle className="h-5 w-5 text-amber-300" />,
  },
  critical: {
    ring: 'border-rose-300/30 bg-rose-500/12',
    text: 'text-rose-100',
    icon: <Siren className="h-5 w-5 text-rose-300" />,
  },
};

export function AlertsPanel({ alerts = [] }) {
  return (
    <Card id="alerts" className="p-6">
      <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Alerts</p>
      <h3 className="mt-2 font-display text-2xl font-bold text-white">Live alert feed</h3>

      <div className="mt-5 space-y-3">
        {!alerts.length ? (
          <EmptyState
            title="No active alerts"
            message="Vitals are in normal range. This panel will auto-update when a warning is detected."
          />
        ) : (
          alerts.map((alert, index) => {
            const styles = alertStyles[alert.type] || alertStyles.normal;
            return (
              <div
                key={`${alert.code}-${index}`}
                className={[
                  'rounded-2xl border px-4 py-3 transition-all duration-500',
                  styles.ring,
                ].join(' ')}
              >
                <div className="flex items-center gap-3">
                  {styles.icon}
                  <div>
                    <p className={["text-sm font-semibold", styles.text].join(' ')}>{alert.title}</p>
                    <p className="mt-1 text-xs text-slate-300">{alert.description}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
