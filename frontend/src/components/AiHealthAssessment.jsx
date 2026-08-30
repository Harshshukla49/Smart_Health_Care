import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Heart,
  HelpCircle,
  Info,
  PhoneCall,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Thermometer,
  Wind,
} from 'lucide-react';
import { getAiAssessment } from '../services/api';
import { useEmergency } from '../context/EmergencyContext';
import { useVideoCall } from '../context/VideoCallContext';

export function AiHealthAssessment({
  patientId,
  liveVitals = null,
  attendingDoctor = null,
  onRefreshVitals = null,
  className = '',
}) {
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedDetails, setExpandedDetails] = useState(false);

  const emergency = useEmergency();
  const { openDialer } = useVideoCall();

  const fetchAssessment = async () => {
    if (!patientId) return;
    setLoading(true);
    setError('');
    try {
      const data = await getAiAssessment(patientId);
      setAssessment(data);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to generate AI assessment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // IMMEDIATELY reset previous assessment when patientId changes to prevent stale data leakage
    setAssessment(null);
    if (patientId) {
      fetchAssessment();
    }
  }, [patientId, liveVitals?.heartRate, liveVitals?.spo2, liveVitals?.temperature]);

  // Merge live vitals if backend telemetry hasn't refreshed yet
  const effectiveTelemetry = {
    heartRate: liveVitals?.heartRate ?? assessment?.telemetry?.heartRate ?? 72,
    spo2: liveVitals?.spo2 ?? assessment?.telemetry?.spo2 ?? 98,
    temperature: liveVitals?.temperature ?? assessment?.telemetry?.temperature ?? 36.8,
    bloodPressure: liveVitals?.bloodPressure ?? assessment?.telemetry?.bloodPressure ?? '120/80',
  };

  const isEmergency = Boolean(
    assessment?.isEmergency ||
    effectiveTelemetry.heartRate > 140 ||
    effectiveTelemetry.spo2 < 88 ||
    effectiveTelemetry.temperature > 39.5
  );

  const statusLevel = isEmergency
    ? 'Emergency'
    : (assessment?.overallStatus || 'Normal');

  const statusThemes = {
    Normal: {
      border: 'border-emerald-500/20 bg-emerald-500/5',
      badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      icon: CheckCircle2,
      label: 'Optimal Stability',
      riskText: 'Low Attention Required',
    },
    Attention: {
      border: 'border-amber-500/20 bg-amber-500/5',
      badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      icon: AlertTriangle,
      label: 'Attention Required',
      riskText: 'Moderate Attention Required',
    },
    Urgent: {
      border: 'border-orange-500/20 bg-orange-500/5',
      badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
      icon: AlertTriangle,
      label: 'Urgent Review',
      riskText: 'High Attention Required',
    },
    Emergency: {
      border: 'border-rose-500/30 bg-rose-500/10',
      badge: 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/30 animate-pulse',
      icon: AlertOctagon,
      label: 'Critical Emergency',
      riskText: 'Critical Immediate Attention',
    },
  };

  const currentTheme = statusThemes[statusLevel] || statusThemes.Normal;
  const StatusIcon = currentTheme.icon;

  const defaultSteps = [
    'Rest and remain in a safe, seated or supported position.',
    'Recheck your vital signs with stable sensor placement.',
    'Avoid strenuous exertion and maintain steady hydration.',
    'Contact your assigned healthcare provider if abnormal readings persist.',
  ];

  const stepsToDisplay = assessment?.immediateSteps?.length ? assessment.immediateSteps : defaultSteps;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Critical Emergency Banner if thresholds crossed */}
      {isEmergency && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/15 p-4 sm:p-5 shadow-lg animate-pulse">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-rose-500/20 p-2 text-rose-400">
                <Siren className="h-6 w-6 animate-spin" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-md bg-rose-500 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                    Critical Alert
                  </span>
                  <h4 className="text-base font-bold text-rose-600 dark:text-rose-200">
                    Immediate Medical Attention May Be Required
                  </h4>
                </div>
                <p className="mt-1 text-xs text-rose-600/90 dark:text-rose-200/80">
                  Telemetry readings have crossed critical physiological thresholds. Stop physical activity and seek medical assistance.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              {emergency?.triggerEmergency && (
                <button
                  type="button"
                  onClick={() => emergency.triggerEmergency()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-rose-700 transition"
                >
                  <Siren className="h-4 w-4" />
                  Emergency SOS
                </button>
              )}
              {attendingDoctor?.phone && (
                <a
                  href={`tel:${attendingDoctor.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-200 hover:bg-rose-500/20 transition"
                >
                  <PhoneCall className="h-4 w-4" />
                  Call Doctor
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main AI Health Assessment Card */}
      <div className={`rounded-2xl border p-5 sm:p-6 transition-all ${currentTheme.border}`}>
        {/* Header with status pill and actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/50 dark:border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-2.5 text-white shadow-md">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  AI Health Assessment
                </h3>
                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-300">
                  Clinical Decision Support
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Continuously evaluated from multi-parameter telemetry streams
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${currentTheme.badge}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {currentTheme.label}
            </span>
            <button
              type="button"
              onClick={fetchAssessment}
              disabled={loading}
              title="Refresh Assessment"
              className="rounded-lg border border-slate-200 dark:border-white/10 p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 transition disabled:opacity-50"
            >
              <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Telemetry Chips */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/5 p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <Heart className="h-3.5 w-3.5 text-rose-500" />
              Heart Rate
            </div>
            <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">
              {Math.round(effectiveTelemetry.heartRate)} <span className="text-[10px] font-normal text-slate-500">bpm</span>
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/5 p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <Wind className="h-3.5 w-3.5 text-cyan-500" />
              SpO₂ Oxygen
            </div>
            <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">
              {Number(effectiveTelemetry.spo2).toFixed(1)} <span className="text-[10px] font-normal text-slate-500">%</span>
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/5 p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <Thermometer className="h-3.5 w-3.5 text-amber-500" />
              Temperature
            </div>
            <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">
              {Number(effectiveTelemetry.temperature).toFixed(1)} <span className="text-[10px] font-normal text-slate-500">°C</span>
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/5 p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <Activity className="h-3.5 w-3.5 text-blue-500" />
              Blood Pressure
            </div>
            <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">
              {effectiveTelemetry.bloodPressure} <span className="text-[10px] font-normal text-slate-500">mmHg</span>
            </div>
          </div>
        </div>

        {/* Key Findings Section */}
        <div className="mt-5 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Key Clinical Findings
          </p>
          <div className="space-y-1.5">
            {assessment?.keyFindings?.length ? (
              assessment.keyFindings.map((finding, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                  <span>{finding}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Telemetry parameters are aligned within expected clinical thresholds.
              </p>
            )}
          </div>
        </div>

        {/* First-Aid Guidance Card */}
        <div className="mt-5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/40 p-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200/50 dark:border-white/5 pb-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                AI First-Aid Guidance
              </h4>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Based on live vitals
            </span>
          </div>

          <div className="mt-3">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Immediate Supportive Steps:
            </p>
            <ol className="mt-2 space-y-2">
              {stepsToDisplay.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-[11px] font-bold text-blue-600 dark:text-blue-300">
                    {idx + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Action Row */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200/50 dark:border-white/5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchAssessment}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh Assessment
              </button>
              <button
                type="button"
                onClick={() => setExpandedDetails(!expandedDetails)}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                {expandedDetails ? 'Hide Details' : 'View Clinical Rationale'}
                {expandedDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>

            {attendingDoctor && (
              <div className="flex items-center gap-2">
                {attendingDoctor.phone && (
                  <a
                    href={`tel:${attendingDoctor.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition shadow-sm"
                  >
                    <PhoneCall className="h-3 w-3" />
                    Contact Doctor
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Expandable Clinical Rationale */}
          {expandedDetails && (
            <div className="mt-3 rounded-lg border border-slate-200/60 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50 p-3 text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <p>
                <strong>What was detected:</strong> Multi-sensor telemetry was compared against established physiological ranges and an algorithmic classification model.
              </p>
              <p>
                <strong>When to contact a physician:</strong> Contact Dr. {attendingDoctor?.name || 'your assigned doctor'} if elevated vitals do not return to baseline after 15 minutes of rest, or if experiencing chest tightness, lightheadedness, or shortness of breath.
              </p>
              <p>
                <strong>When emergency help is required:</strong> Seek immediate medical attention or trigger Emergency SOS for chest pain, fainting, difficulty speaking, or severe breathing distress.
              </p>
            </div>
          )}
        </div>

        {/* Medical Non-Prescription Disclaimer */}
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-blue-500/5 border border-blue-500/10 p-3 text-[11px] text-slate-600 dark:text-slate-400">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <span>
            <strong>Clinical Decision Support Disclaimer:</strong> This AI-assisted assessment provides supportive physiological observations for remote monitoring and is not an autonomous medical diagnosis or prescription. Medication adjustments must be made exclusively by an authorized physician.
          </span>
        </div>
      </div>
    </div>
  );
}
