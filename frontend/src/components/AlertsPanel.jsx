import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock,
  ShieldAlert,
  Siren,
} from 'lucide-react';
import { Card } from './Card';
import { EmptyState } from './EmptyState';

const alertStyles = {
  normal: {
    container: 'border-emerald-200/90 bg-emerald-50/50 hover:bg-emerald-50/80',
    title: 'text-emerald-950 font-bold',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    badgeText: 'Normal',
    desc: 'text-emerald-800/90',
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />,
  },
  warning: {
    container: 'border-amber-200/90 bg-amber-50/50 hover:bg-amber-50/80',
    title: 'text-amber-950 font-bold',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    badgeText: 'Warning',
    desc: 'text-amber-800/90',
    icon: <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />,
  },
  critical: {
    container: 'border-rose-300 bg-rose-50/60 hover:bg-rose-50/90 shadow-[0_2px_12px_rgba(244,63,94,0.06)]',
    title: 'text-rose-950 font-bold',
    badge: 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse',
    badgeText: 'Critical',
    desc: 'text-rose-800/90',
    icon: <Siren className="h-4 w-4 text-rose-600 shrink-0" />,
  },
};

const defaultSampleAlerts = [
  {
    code: 'alt-1',
    type: 'critical',
    title: 'SpO2 below safe threshold',
    description: 'Transient drop detected (88%); verify pulse oximeter probe placement.',
    time: '14:15',
  },
  {
    code: 'alt-2',
    type: 'warning',
    title: 'Temperature slightly elevated',
    description: 'Current reading is 37.8°C; trending towards normal range.',
    time: '14:28',
  },
  {
    code: 'alt-3',
    type: 'normal',
    title: 'Heart rate within normal range',
    description: 'Cardiac rhythm stable at 72 BPM during rest.',
    time: '14:32',
  },
  {
    code: 'alt-4',
    type: 'normal',
    title: 'Baseline Lead II calibrated',
    description: 'Electrode impedance verified with zero baseline wander.',
    time: '13:50',
  },
];

export function AlertsPanel({ alerts = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  const displayAlerts = useMemo(() => {
    if (alerts && alerts.length > 0) {
      return alerts;
    }
    return defaultSampleAlerts;
  }, [alerts]);

  // Counts by severity
  const counts = useMemo(() => {
    const total = displayAlerts.length;
    const critical = displayAlerts.filter((a) => a.type === 'critical').length;
    const warning = displayAlerts.filter((a) => a.type === 'warning').length;
    const normal = displayAlerts.filter((a) => a.type === 'normal').length;
    return { total, critical, warning, normal };
  }, [displayAlerts]);

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    if (activeFilter === 'all') return displayAlerts;
    return displayAlerts.filter((alert) => alert.type === activeFilter);
  }, [displayAlerts, activeFilter]);

  // Visible alerts: by default show only top 2 to save page space!
  const INITIAL_VISIBLE_COUNT = 2;
  const visibleAlerts = expanded ? filteredAlerts : filteredAlerts.slice(0, INITIAL_VISIBLE_COUNT);
  const hasMore = filteredAlerts.length > INITIAL_VISIBLE_COUNT;

  return (
    <Card
      id="alerts"
      className="p-5 sm:p-6 bg-white border border-[#E2E8F0] rounded-[18px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_26px_rgba(15,23,42,0.07)] transition-all"
    >
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-sky-50 border border-sky-200 text-[#0284C7] shadow-2xs">
            <Bell className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-sans text-base sm:text-lg font-bold text-[#0F172A] leading-tight">
              Clinical Alerts & Notifications
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Real-time physiological threshold monitoring
            </p>
          </div>
        </div>

        {/* Severity Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveFilter('all');
              setExpanded(false);
            }}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
              activeFilter === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({counts.total})
          </button>

          {counts.critical > 0 && (
            <button
              type="button"
              onClick={() => {
                setActiveFilter('critical');
                setExpanded(false);
              }}
              className={`rounded-lg px-2 py-1 text-xs font-bold transition flex items-center gap-1 ${
                activeFilter === 'critical'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
              Critical ({counts.critical})
            </button>
          )}

          {counts.warning > 0 && (
            <button
              type="button"
              onClick={() => {
                setActiveFilter('warning');
                setExpanded(false);
              }}
              className={`rounded-lg px-2 py-1 text-xs font-bold transition ${
                activeFilter === 'warning'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              Warning ({counts.warning})
            </button>
          )}

          {counts.normal > 0 && (
            <button
              type="button"
              onClick={() => {
                setActiveFilter('normal');
                setExpanded(false);
              }}
              className={`rounded-lg px-2 py-1 text-xs font-bold transition ${
                activeFilter === 'normal'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              Normal ({counts.normal})
            </button>
          )}
        </div>
      </div>

      {/* Alerts List */}
      <div className="mt-3.5 space-y-2.5">
        <AnimatePresence initial={false}>
          {visibleAlerts.length > 0 ? (
            visibleAlerts.map((alert, index) => {
              const styles = alertStyles[alert.type] || alertStyles.normal;
              return (
                <motion.div
                  key={`${alert.code || index}-${alert.title}`}
                  initial={{ opacity: 0, height: 0, y: -6 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -6 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className={`rounded-xl border p-3 sm:p-3.5 transition-all duration-200 ${styles.container}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="mt-0.5">{styles.icon}</div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`text-xs sm:text-sm leading-tight ${styles.title}`}>
                            {alert.title}
                          </p>
                          <span
                            className={`rounded-md border px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider ${styles.badge}`}
                          >
                            {styles.badgeText}
                          </span>
                        </div>
                        <p className={`mt-1 text-xs leading-relaxed ${styles.desc}`}>
                          {alert.description}
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap flex items-center gap-1 shrink-0 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {alert.time || 'Just now'}
                    </span>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="py-6 text-center text-xs text-slate-400">
              No alerts found for this filter category.
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* "View More / Show Less" Space-Saving Toggle Button */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-2xs group"
          aria-expanded={expanded}
        >
          <span>
            {expanded
              ? 'Show Less'
              : `View More Alerts (+${filteredAlerts.length - INITIAL_VISIBLE_COUNT} more)`}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-500 transition-transform duration-300 ${
              expanded ? 'rotate-180 text-sky-600' : 'group-hover:translate-y-0.5'
            }`}
          />
        </button>
      )}
    </Card>
  );
}

export default AlertsPanel;
