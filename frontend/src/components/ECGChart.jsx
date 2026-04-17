import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Card } from './Card';
import { useI18n } from '../context/I18nContext';

export function ECGChart({ ecgData = [] }) {
  const { t } = useI18n();
  const data = useMemo(
    () =>
      ecgData.map((point, index) => ({
        index,
        value: Number(point),
      })),
    [ecgData]
  );

  return (
    <Card className="h-full p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">{t('dashboard.ecg.heading')}</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">{t('dashboard.ecg.title')}</h3>
        </div>
        <Activity className="h-5 w-5 text-cyan-200" />
      </div>

      <div className="mt-4 h-[220px] rounded-2xl border border-white/10 bg-slate-950/35 p-3">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="4 4" />
              <XAxis dataKey="index" tick={false} axisLine={false} tickLine={false} />
              <YAxis tick={false} axisLine={false} tickLine={false} domain={['auto', 'auto']} width={10} />
              <Tooltip
                formatter={(value) => [Number(value).toFixed(3), 'mV']}
                labelFormatter={() => t('dashboard.ecg.sample')}
                contentStyle={{
                  background: 'rgba(15, 23, 42, 0.96)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '12px',
                  color: '#e2e8f0',
                }}
              />
              <Line type="monotone" dataKey="value" name="ECG" stroke="#22d3ee" strokeWidth={2.2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center text-center">
            <div>
              <p className="text-sm font-semibold text-slate-100">{t('dashboard.ecg.noSamplesTitle')}</p>
              <p className="mt-1 text-xs text-slate-400">{t('dashboard.ecg.noSamplesDescription')}</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
