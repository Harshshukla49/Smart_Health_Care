import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Ambulance,
  CheckCircle2,
  Clock,
  HeartPulse,
  Info,
  MapPin,
  PhoneCall,
  ShieldAlert,
  X,
} from 'lucide-react';
import { Button } from '../Button';
import { useEmergency } from '../../context/EmergencyContext';

export function AmbulanceRequestModal({ isOpen, onClose }) {
  const {
    location,
    activeEmergency,
    requestAmbulance,
    ambulanceRequested,
    ambulanceDispatchInfo,
    isDemoMode,
  } = useEmergency();

  const [loading, setLoading] = useState(false);
  const [urgency, setUrgency] = useState('CRITICAL');
  const [notes, setNotes] = useState('Patient exhibiting severe cardiac desaturation.');

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setLoading(true);
    await requestAmbulance({ urgency, notes });
    setLoading(false);
  };

  const coordsText = location
    ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
    : '28.6139, 77.2090 (Demo Delhi NCR)';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] grid place-items-center bg-slate-900/60 p-4 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-6 sm:p-7 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-600 text-white shadow-md shadow-rose-600/30">
                <Ambulance className="h-6 w-6" />
              </span>
              <div>
                <h3 className="font-sans text-xl font-bold text-slate-900">
                  Request Emergency Transport
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct dispatch to nearest emergency trauma unit
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Demo Mode / Simulation Notice */}
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/80 p-3 text-xs text-sky-900">
            <div className="flex items-start gap-2.5">
              <Info className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold flex items-center gap-2">
                  <span>Demo Emergency Dispatch Architecture</span>
                  <span className="rounded-full bg-sky-200 text-sky-800 text-[10px] px-2 py-0.2">
                    DEMO SIMULATION
                  </span>
                </p>
                <p className="text-[11px] text-sky-700 mt-0.5 leading-relaxed">
                  This system integrates with real emergency dispatch abstractions (`requestEmergencyTransport`). In development & portfolio mode, requests are routed to a verified simulator that tracks ETA, telemetry packet exchange, and paramedic audit logs without placing live 911 calls.
                </p>
              </div>
            </div>
          </div>

          {/* Dispatch Data Overview */}
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Patient:</span>
                <span className="font-bold text-slate-900">
                  {activeEmergency?.patientName || activeEmergency?.patientId || 'Patient'} {activeEmergency?.patientId ? `(ID: ${activeEmergency.patientId})` : ''}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Critical Telemetry:</span>
                <span className="font-bold text-rose-700">
                  SpO2 {activeEmergency?.vitals?.spo2 || 84}% · HR {activeEmergency?.vitals?.heartRate || 142} BPM
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">GPS Coordinates:</span>
                <span className="font-mono font-bold text-slate-800 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-rose-600" />
                  {coordsText}
                </span>
              </div>
            </div>

            <label className="block space-y-1 text-xs font-semibold text-slate-700">
              <span>Paramedic Triage Notes (Optional)</span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                placeholder="Describe current patient condition for incoming medics"
              />
            </label>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>

            <Button
              size="sm"
              disabled={loading}
              onClick={handleConfirm}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/30 px-5 py-2.5"
            >
              <Ambulance className="h-4 w-4 mr-1.5" />
              {loading ? 'Transmitting Request...' : 'Confirm Ambulance Request'}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
