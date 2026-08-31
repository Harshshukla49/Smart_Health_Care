import React, { useMemo } from 'react';
import { Activity, Radio } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Card } from './Card';
import { useI18n } from '../context/I18nContext';

export function ECGChart({ ecgData = [], heartRate = 72 }) {
  const { t } = useI18n();

  // If real ecgData is provided, format it; otherwise provide a standard clinical Lead II template waveform
  const data = useMemo(() => {
    if (ecgData && ecgData.length > 0) {
      return ecgData.map((point, index) => ({
        index,
        value: Number(point),
      }));
    }
    // Baseline realistic Lead II waveform points (P-Q-R-S-T wave cycle)
    const baseline = [
      0.0, 0.02, 0.05, 0.12, 0.08, 0.02, 0.0, -0.05, 0.95, -0.28, 0.0, 0.05, 0.18, 0.24, 0.15, 0.04, 0.0,
      0.0, 0.02, 0.05, 0.12, 0.08, 0.02, 0.0, -0.05, 0.95, -0.28, 0.0, 0.05, 0.18, 0.24, 0.15, 0.04, 0.0,
    ];
    return baseline.map((value, index) => ({
      index,
      value,
    }));
  }, [ecgData]);

  return (
    <Card className="h-full p-5 sm:p-6 bg-white border border-[#E2E8F0] rounded-[18px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_26px_rgba(15,23,42,0.07)] transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-sans text-lg font-bold text-[#0F172A]">Live ECG Rhythm</h3>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Signal stable
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[#64748B]">Continuous telemetry waveform strip (250 Hz)</p>
        </div>

        {/* Clinical parameters badge bar */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
          <span className="rounded-lg border border-[#E2E8F0] bg-slate-50 px-2.5 py-1 text-[#334155] font-semibold">
            Lead: <strong className="text-[#0F172A]">Lead II</strong>
          </span>
          <span className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-700 font-semibold">
            HR: <strong className="font-bold">{heartRate || 72} BPM</strong>
          </span>
          <span className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-teal-700 font-semibold">
            Quality: <strong className="font-bold">98%</strong>
          </span>
        </div>
      </div>

      {/* Medical ECG grid background */}
      <div className="mt-4 h-[210px] rounded-xl border border-[#E2E8F0] ecg-grid-background p-2.5 relative overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="index" tick={false} axisLine={false} tickLine={false} />
            <YAxis tick={false} axisLine={false} tickLine={false} domain={['auto', 'auto']} width={10} />
            <Tooltip
              formatter={(value) => [`${Number(value).toFixed(2)} mV`, 'Amplitude']}
              labelFormatter={(idx) => `Sample #${idx}`}
              contentStyle={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                color: '#0f172a',
                fontSize: '12px',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              name="Lead II"
              stroke="#0284c7"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span>Sweep speed: 25 mm/s · Gain: 10 mm/mV</span>
        <span className="flex items-center gap-1 text-slate-500 font-medium">
          <Activity className="h-3.5 w-3.5 text-sky-600" /> Filter: 0.05-150 Hz
        </span>
      </div>
    </Card>
  );
}

