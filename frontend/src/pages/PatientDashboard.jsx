import React, { useEffect, useMemo, useState } from 'react';
import { Activity, HeartPulse, Link2, Thermometer, Waves } from 'lucide-react';
import { io } from 'socket.io-client';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card } from '../components/Card';
import { Loader } from '../components/Loader';
import { EmptyState } from '../components/EmptyState';
import { StatusPill } from '../components/StatusPill';
import { Button } from '../components/Button';
import { AlertsPanel } from '../components/AlertsPanel';
import { InsightsPanel } from '../components/InsightsPanel';
import { VitalsCard } from '../components/VitalsCard';
import { connectPatientDevice, getApiPatientById } from '../services/api';
import { getAuthSession } from '../utils/auth';

const SOCKET_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const statusToAlertType = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'critical' || normalized === 'high') {
    return 'critical';
  }
  if (normalized === 'warning' || normalized === 'medium') {
    return 'warning';
  }
  return 'normal';
};

export function PatientDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [patientData, setPatientData] = useState(null);
  const [vitals, setVitals] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [history, setHistory] = useState([]);
  const [deviceConnecting, setDeviceConnecting] = useState(false);

  useEffect(() => {
    let active = true;

    const loadPatient = async () => {
      const session = getAuthSession();
      const patientId = session?.patientId;

      if (!patientId) {
        setError('Patient session is missing. Please login again.');
        setLoading(false);
        return;
      }

      try {
        const response = await getApiPatientById(patientId);
        if (!active) {
          return;
        }

        setPatientData(response);
        setVitals(response?.vitals || null);
        setPrediction(response?.prediction || null);
        if (response?.vitals) {
          setHistory([
            {
              timestamp: response.vitals.updatedAt || new Date().toLocaleTimeString(),
              heartRate: Number(response.vitals.heartRate || 0),
              spo2: Number(response.vitals.spo2 || 0),
              temperature: Number(response.vitals.temperature || 0),
            },
          ]);
        }
      } catch (requestError) {
        const message = requestError?.response?.data?.message || requestError?.message || 'Unable to load patient data.';
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadPatient();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!patientData?.deviceConnected || !patientData?.id) {
      return;
    }

    const socket = io(SOCKET_BASE_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.emit('subscribe_patient', { patientId: patientData.id });

    socket.on('vitals_update', (payload) => {
      const nextVitals = payload?.vitals;
      if (!nextVitals) {
        return;
      }

      setVitals(nextVitals);
      setHistory((prev) => {
        const next = [
          ...prev,
          {
            timestamp: nextVitals.updatedAt || new Date().toLocaleTimeString(),
            heartRate: Number(nextVitals.heartRate || 0),
            spo2: Number(nextVitals.spo2 || 0),
            temperature: Number(nextVitals.temperature || 0),
          },
        ];
        return next.slice(-30);
      });
    });

    socket.on('patient_snapshot', (payload) => {
      const nextPatient = payload?.data;
      if (!nextPatient) {
        return;
      }

      setPatientData(nextPatient);
      setVitals(nextPatient?.vitals || null);
      setPrediction(nextPatient?.prediction || null);

      if (nextPatient?.vitals) {
        setHistory((prev) => {
          const next = [
            ...prev,
            {
              timestamp: nextPatient.vitals.updatedAt || new Date().toLocaleTimeString(),
              heartRate: Number(nextPatient.vitals.heartRate || 0),
              spo2: Number(nextPatient.vitals.spo2 || 0),
              temperature: Number(nextPatient.vitals.temperature || 0),
            },
          ];

          return next.slice(-30);
        });
      }
    });

    socket.on('insights_update', (payload) => {
      if (payload?.prediction) {
        setPrediction(payload.prediction);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [patientData?.deviceConnected, patientData?.id]);

  const alerts = useMemo(() => {
    if (!prediction) {
      return [];
    }

    return [
      {
        code: 'ml-insight',
        title: 'ML insight status',
        description: prediction.message || 'Prediction unavailable',
        type: statusToAlertType(prediction.status),
      },
    ];
  }, [prediction]);

  const handleConnectDevice = async () => {
    if (!patientData?.id) {
      return;
    }

    setDeviceConnecting(true);
    setError('');
    try {
      const response = await connectPatientDevice(patientData.id);
      setPatientData(response);
      setVitals(response?.vitals || vitals);
      setPrediction(response?.prediction || prediction);
    } catch (requestError) {
      const message = requestError?.response?.data?.message || requestError?.message || 'Unable to connect device.';
      setError(message);
    } finally {
      setDeviceConnecting(false);
    }
  };

  return (
    <DashboardLayout
      role="patient"
      title="Patient dashboard"
      subtitle="Dataset-initialized vitals with model-driven insights and future-ready live sensor streaming."
    >
      {loading ? <Loader label="Loading patient data" /> : null}

      {!loading && error ? (
        <Card className="border border-rose-400/20 bg-rose-500/10 p-6 text-rose-100">{error}</Card>
      ) : null}

      {!loading && patientData ? (
        <div className="space-y-6">
          <Card className="space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Overview</p>
                <h2 className="mt-2 font-display text-3xl font-bold text-white">{patientData.name}</h2>
                <p className="mt-1 text-sm text-slate-300">ID: {patientData.id}</p>
              </div>
              <StatusPill status={prediction?.status || 'Normal'} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Info label="Data Source" value={patientData.dataSource || 'dataset'} />
              <Info label="Device" value={patientData.deviceConnected ? 'Connected' : 'Not Connected'} />
              <Info label="Mode" value={patientData.deviceConnected ? 'Live stream' : 'Static dataset vitals'} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Info label="Doctor Email" value={patientData?.doctorContact?.email || 'Not available'} />
              <Info label="Doctor Phone" value={patientData?.doctorContact?.phone || 'Not available'} />
            </div>

            {!patientData.deviceConnected ? (
              <div className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4 text-amber-100">
                <p className="text-sm">Device is not connected. Showing static vitals and ML insights from dataset-based initialization.</p>
                <Button className="mt-3" onClick={handleConnectDevice} disabled={deviceConnecting}>
                  <Link2 className="h-4 w-4" />
                  {deviceConnecting ? 'Connecting...' : 'Connect Device'}
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-4 text-emerald-100">
                <p className="text-sm">Device connected. Vitals and insights will update in real time through WebSocket events.</p>
              </div>
            )}
          </Card>

          <section id="vitals" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <VitalsCard
                label="Heart Rate"
                value={vitals?.heartRate}
                unit="bpm"
                icon={<HeartPulse className="h-5 w-5" />}
                updatedAt={vitals?.updatedAt}
                accent="text-cyan-200"
              />
              <VitalsCard
                label="SpO2"
                value={vitals?.spo2}
                unit="%"
                icon={<Waves className="h-5 w-5" />}
                updatedAt={vitals?.updatedAt}
                accent="text-teal-200"
              />
              <VitalsCard
                label="Temperature"
                value={vitals?.temperature}
                unit="°C"
                icon={<Thermometer className="h-5 w-5" />}
                updatedAt={vitals?.updatedAt}
                accent="text-fuchsia-200"
              />
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Vitals</p>
                  <h3 className="mt-2 font-display text-2xl font-bold text-white">Dataset and live trend</h3>
                </div>
                <Activity className="h-5 w-5 text-cyan-200" />
              </div>

              <div className="mt-5 h-[300px] rounded-2xl border border-white/10 bg-slate-950/35 p-3">
                {history.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history}>
                      <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="4 4" />
                      <XAxis dataKey="timestamp" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={34} />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(15, 23, 42, 0.96)',
                          border: '1px solid rgba(148, 163, 184, 0.2)',
                          borderRadius: '12px',
                          color: '#e2e8f0',
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="heartRate" name="Heart Rate" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="spo2" name="SpO2" stroke="#2dd4bf" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="temperature" name="Temperature" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <EmptyState title="No vitals available" message="Patient vitals will appear here once data is loaded." />
                  </div>
                )}
              </div>
            </Card>

            <div className="space-y-6">
              <AlertsPanel alerts={alerts} />
              <InsightsPanel insight={prediction ? { risk: prediction.risk, message: prediction.message } : null} loading={false} error={prediction?.risk === 'Prediction unavailable' ? 'Prediction unavailable' : ''} />
            </div>
          </section>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
