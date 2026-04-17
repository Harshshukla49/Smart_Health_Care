import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  HeartPulse,
  Thermometer,
  Waves,
  ArrowLeft,
  Activity,
  ShieldAlert,
  Link2,
  Link2Off,
  History,
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { Loader } from '../components/Loader';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { StatusPill } from '../components/StatusPill';
import { Button } from '../components/Button';
import {
  connectPatientDevice,
  disconnectPatientDevice,
  getApiPatientById,
  getPatientPredictionAudit,
  updatePatientManualValues,
} from '../services/api';
import { getAuthSession } from '../utils/auth';

const SOCKET_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export function PatientDetails() {
  const { patientId } = useParams();
  const session = getAuthSession();
  const isDoctor = session?.role === 'doctor';

  const [patient, setPatient] = useState(null);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [manualValues, setManualValues] = useState({
    heartRate: '',
    spo2: '',
    temperature: '',
    ecgData: '',
  });
  const lastServerSignatureRef = useRef('');

  useEffect(() => {
    let active = true;

    const loadPatient = async () => {
      setLoading(true);
      setError('');
      try {
        const [patientResponse, auditResponse] = await Promise.all([
          getApiPatientById(patientId),
          getPatientPredictionAudit(patientId),
        ]);

        if (!active) {
          return;
        }

        setPatient(patientResponse);
        setAudit(auditResponse);
      } catch (requestError) {
        if (active) {
          setError(requestError?.response?.data?.message || requestError?.message || 'Unable to load patient details.');
        }
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
  }, [patientId]);

  useEffect(() => {
    if (!patient?.deviceConnected) {
      return;
    }

    const socket = io(SOCKET_BASE_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.emit('subscribe_patient', { patientId });

    socket.on('patient_snapshot', (payload) => {
      const snapshot = payload?.data;
      if (!snapshot) {
        return;
      }

      setPatient(snapshot);
    });

    socket.on('vitals_update', (payload) => {
      const incomingVitals = payload?.vitals;
      if (!incomingVitals) {
        return;
      }

      setPatient((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          vitals: incomingVitals,
          dataSource: 'sensor-stream',
        };
      });
    });

    socket.on('insights_update', (payload) => {
      const incomingPrediction = payload?.prediction;
      if (!incomingPrediction) {
        return;
      }

      setPatient((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          prediction: incomingPrediction,
        };
      });

      setAudit((current) => {
        const next = [
          ...current,
          {
            timestamp: new Date().toISOString(),
            source: 'socket-stream',
            risk: incomingPrediction.risk,
            status: incomingPrediction.status,
            confidence: incomingPrediction.confidence,
            message: incomingPrediction.message,
            vitals: payload?.vitals,
          },
        ];

        return next.slice(-100);
      });
    });

    socket.on('device_status_update', (payload) => {
      if (String(payload?.patientId) !== String(patientId)) {
        return;
      }

      setPatient((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          deviceConnected: Boolean(payload?.deviceConnected),
          dataSource: payload?.dataSource || current.dataSource,
        };
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [patient?.deviceConnected, patientId]);

  useEffect(() => {
    if (!patient) {
      return;
    }

    const vitals = patient.vitals || {};
    const ecgSource = Array.isArray(vitals.ecgData) ? vitals.ecgData : Array.isArray(patient.ecgData) ? patient.ecgData : [];
    const nextValues = {
      heartRate: String(vitals.heartRate ?? ''),
      spo2: String(vitals.spo2 ?? ''),
      temperature: String(vitals.temperature ?? ''),
      ecgData: ecgSource.join(','),
    };
    setManualValues(nextValues);
    lastServerSignatureRef.current = JSON.stringify(nextValues);
  }, [patient]);

  const handleConnect = async () => {
    setActionLoading(true);
    try {
      const updated = await connectPatientDevice(patientId);
      setPatient(updated);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Unable to connect device.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setActionLoading(true);
    try {
      const updated = await disconnectPatientDevice(patientId);
      setPatient(updated);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Unable to disconnect device.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualChange = (event) => {
    const { name, value } = event.target;
    setManualValues((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const submitManualUpdate = async (values, mode = 'manual') => {
    if (!patientId) {
      return;
    }

    if (mode === 'manual') {
      setActionLoading(true);
    } else {
      setAutoSaving(true);
    }

    setError('');
    try {
      const updated = await updatePatientManualValues(patientId, values);
      setPatient(updated);
      const nextAudit = await getPatientPredictionAudit(patientId);
      setAudit(nextAudit);
      lastServerSignatureRef.current = JSON.stringify(values);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Unable to update patient values.');
    } finally {
      if (mode === 'manual') {
        setActionLoading(false);
      } else {
        setAutoSaving(false);
      }
    }
  };

  const handleManualUpdate = async (event) => {
    event.preventDefault();
    await submitManualUpdate(manualValues, 'manual');
  };

  useEffect(() => {
    if (!isDoctor || !patientId || actionLoading || autoSaving) {
      return;
    }

    const nextSignature = JSON.stringify(manualValues);
    if (nextSignature === lastServerSignatureRef.current) {
      return;
    }

    const debounceHandle = window.setTimeout(() => {
      submitManualUpdate(manualValues, 'auto');
    }, 900);

    return () => {
      window.clearTimeout(debounceHandle);
    };
  }, [manualValues, isDoctor, patientId, actionLoading, autoSaving]);

  const chartData = useMemo(() => {
    const rows = Array.isArray(audit) ? audit.slice(-12) : [];
    return rows.map((entry, index) => ({
      label: entry.timestamp || `Reading ${index + 1}`,
      heartRate: Number(entry?.vitals?.heartRate || entry?.vitals?.heart_rate || patient?.vitals?.heartRate || 0),
      spo2: Number(entry?.vitals?.spo2 || patient?.vitals?.spo2 || 0),
      temperature: Number(entry?.vitals?.temperature || patient?.vitals?.temperature || 0),
    }));
  }, [audit, patient?.vitals]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <Loader label="Loading patient details" />
      </div>
    );
  }

  if (error && !patient) {
    return <ErrorState title="Could not load patient" message={error} />;
  }

  if (!patient) {
    return <EmptyState title="Patient not found" message="The patient record could not be found." action={<ButtonLink />} />;
  }

  const isCritical = String(patient?.prediction?.status || '').toLowerCase() === 'critical';
  const status = patient?.prediction?.status || 'normal';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Patient Details"
        title={patient.name || 'Patient'}
        description={`Data source ${patient.dataSource || 'dataset'} · Device ${patient.deviceConnected ? 'connected' : 'not connected'}`}
        action={
          <Link
            to="/dashboard/doctor"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />Back to dashboard
          </Link>
        }
      />

      {error ? (
        <Card className="border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="space-y-5 p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Status</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-white">Current condition</h2>
            </div>
            <StatusPill status={status} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <VitalsTile icon={<HeartPulse className="h-5 w-5 text-cyan-200" />} label="Heart Rate" value={`${Number(patient?.vitals?.heartRate || 0).toFixed(1)} bpm`} />
            <VitalsTile icon={<Waves className="h-5 w-5 text-teal-200" />} label="SpO2" value={`${Number(patient?.vitals?.spo2 || 0).toFixed(1)}%`} />
            <VitalsTile icon={<Thermometer className="h-5 w-5 text-fuchsia-200" />} label="Temperature" value={`${Number(patient?.vitals?.temperature || 0).toFixed(1)}°C`} />
          </div>

          {isDoctor ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Device Control</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button onClick={handleConnect} disabled={actionLoading || patient.deviceConnected}>
                  <Link2 className="h-4 w-4" />
                  Connect Device
                </Button>
                <Button variant="secondary" onClick={handleDisconnect} disabled={actionLoading || !patient.deviceConnected}>
                  <Link2Off className="h-4 w-4" />
                  Disconnect Device
                </Button>
              </div>
            </div>
          ) : null}

          {isDoctor ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Manual Values + Re-Predict</p>
              <p className="mt-2 text-xs text-cyan-200/90">Auto predict is enabled. Model runs automatically after you stop typing.</p>
              <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={handleManualUpdate}>
                <input
                  name="heartRate"
                  type="number"
                  step="0.1"
                  value={manualValues.heartRate}
                  onChange={handleManualChange}
                  placeholder="Heart Rate"
                  className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-white placeholder:text-slate-500 outline-none"
                />
                <input
                  name="spo2"
                  type="number"
                  step="0.1"
                  value={manualValues.spo2}
                  onChange={handleManualChange}
                  placeholder="SpO2"
                  className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-white placeholder:text-slate-500 outline-none"
                />
                <input
                  name="temperature"
                  type="number"
                  step="0.1"
                  value={manualValues.temperature}
                  onChange={handleManualChange}
                  placeholder="Temperature"
                  className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-white placeholder:text-slate-500 outline-none"
                />
                <textarea
                  name="ecgData"
                  rows={3}
                  value={manualValues.ecgData}
                  onChange={handleManualChange}
                  placeholder="ECG samples comma-separated"
                  className="sm:col-span-2 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-white placeholder:text-slate-500 outline-none"
                />
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={actionLoading}>
                    {actionLoading ? 'Updating...' : autoSaving ? 'Auto Predicting...' : 'Update Values & Predict'}
                  </Button>
                </div>
              </form>
            </div>
          ) : null}
        </Card>

        <Card className="space-y-4 p-6 md:p-8">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">ML Insight</p>
            <ShieldAlert className={isCritical ? 'h-5 w-5 text-rose-300' : 'h-5 w-5 text-emerald-300'} />
          </div>

          <div className="space-y-3 text-sm leading-7 text-slate-300">
            <p><span className="text-white">Patient ID:</span> {patient.id}</p>
            <p><span className="text-white">Risk:</span> {patient?.prediction?.risk || 'Prediction unavailable'}</p>
            <p><span className="text-white">Confidence:</span> {Number(patient?.prediction?.confidence || 0).toFixed(2)}</p>
            <p><span className="text-white">Message:</span> {patient?.prediction?.message || 'Prediction unavailable'}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Stream State</p>
                <h3 className="mt-2 font-display text-2xl font-bold text-white">
                  {patient.deviceConnected ? 'Live device stream' : 'Dataset static mode'}
                </h3>
              </div>
              <Activity className="h-5 w-5 text-cyan-200" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="space-y-4 p-6 md:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">Prediction Audit</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-white">Latest model outputs</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300">
            <History className="h-4 w-4 text-cyan-200" />
            {audit.length} entries
          </div>
        </div>

        {audit.length ? (
          <div className="space-y-3">
            {audit.slice(-8).reverse().map((entry, index) => (
              <div key={`${entry.timestamp || 'ts'}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{entry.risk || 'Prediction unavailable'} ({entry.status || 'unavailable'})</p>
                  <p className="text-xs text-slate-400">{entry.timestamp || 'N/A'}</p>
                </div>
                <p className="mt-2 text-sm text-slate-300">{entry.message || 'Prediction unavailable'}</p>
                <p className="mt-2 text-xs text-slate-400">Source: {entry.source || 'unknown'} · Confidence: {Number(entry.confidence || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No audit entries" message="Model outputs will appear here as predictions are generated." />
        )}
      </Card>

      <Card className="space-y-4 p-6 md:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">Trend Preview</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-white">Vitals trend from audit snapshots</h2>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300">
            {chartData.length} points
          </div>
        </div>

        <div className="h-[340px] rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-4 sm:p-6">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="4 4" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} hide />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} width={34} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15, 23, 42, 0.96)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '16px',
                    color: '#e2e8f0',
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="heartRate" name="Heart Rate" stroke="#38bdf8" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="spo2" name="SpO2" stroke="#2dd4bf" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="temperature" name="Temperature" stroke="#d946ef" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No readings recorded" message="Prediction audit snapshots are required for trend visualization." />
          )}
        </div>
      </Card>
    </div>
  );
}

function VitalsTile({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</p>
        <div className="rounded-xl bg-white/5 p-2">{icon}</div>
      </div>
      <p className="mt-4 font-display text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function ButtonLink() {
  return (
    <Link
      to="/dashboard/doctor"
      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-5 py-3 font-semibold text-slate-950 transition hover:brightness-110"
    >
      <ArrowLeft className="h-4 w-4" />
      Return to dashboard
    </Link>
  );
}
