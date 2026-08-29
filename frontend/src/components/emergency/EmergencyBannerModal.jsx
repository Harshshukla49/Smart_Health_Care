import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertOctagon,
  AlertTriangle,
  Ambulance,
  CheckCircle2,
  Clock,
  HeartPulse,
  Hospital,
  MapPin,
  Maximize2,
  Minimize2,
  Phone,
  PhoneCall,
  Share2,
  ShieldAlert,
  UserCheck,
  Video,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../Button';
import { useEmergency } from '../../context/EmergencyContext';
import { EmergencyMap } from './EmergencyMap';
import { AmbulanceRequestModal } from './AmbulanceRequestModal';
import { formatLocationLink } from '../../services/geolocation';

export function EmergencyBannerModal() {
  const {
    location,
    emergencyState,
    activeEmergency,
    emergencyModalOpen,
    setEmergencyModalOpen,
    sosContact,
    ambulanceModalOpen,
    setAmbulanceModalOpen,
    ambulanceRequested,
    ambulanceDispatchInfo,
    resolveEmergency,
    isDemoMode,
  } = useEmergency();

  const [showMap, setShowMap] = useState(false);

  if (!emergencyModalOpen || emergencyState === 'NORMAL') {
    return null;
  }

  const vitals = activeEmergency?.vitals || {
    heartRate: 142,
    spo2: 84,
    temperature: 38.8,
  };

  const coords = location || {
    latitude: 28.6139,
    longitude: 77.209,
    accuracy: 12,
  };

  const googleMapsUrl = formatLocationLink(coords.latitude, coords.longitude);

  const handleCallDoctor = () => {
    window.open('tel:+919876543210');
  };

  const handleCallSos = () => {
    const phone = sosContact?.phone || '+919876543210';
    window.open(`tel:${phone.replace(/[^0-9+]/g, '')}`);
  };

  const handleShareLocation = async () => {
    try {
      await navigator.clipboard.writeText(
        `🚨 EMERGENCY: Patient location link: ${googleMapsUrl} (Coordinates: ${coords.latitude}, ${coords.longitude})`
      );
      toast.success('Emergency location copied to clipboard.');
    } catch {
      toast.error('Unable to copy location link.');
    }
  };

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-[9990] flex items-center justify-center overflow-y-auto bg-slate-950/75 p-3 sm:p-5 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            className="relative w-full max-w-2xl rounded-3xl border-2 border-rose-500 bg-white p-5 sm:p-7 shadow-[0_25px_80px_rgba(239,68,68,0.35)]"
          >
            {/* Top Critical Header */}
            <div className="flex items-start justify-between gap-3 border-b border-rose-100 pb-4">
              <div className="flex items-center gap-3.5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-600/30 animate-pulse">
                  <AlertOctagon className="h-7 w-7" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-rose-700">
                      CRITICAL HEALTH ALERT
                    </span>
                    {isDemoMode ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        DEMO TEST
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-1 font-sans text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                    Emergency Response Active
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEmergencyModalOpen(false)}
                title="Minimize Alert Modal"
                className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Trigger Reason & Vital Readings Snapshot */}
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
              <p className="text-xs font-bold text-rose-900 leading-snug">
                {activeEmergency?.triggerReason || 'Severe physiological telemetry breach detected.'}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-rose-200 bg-white p-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Heart Rate</span>
                  <p className="font-sans text-lg sm:text-xl font-extrabold text-rose-600 mt-0.5">
                    {vitals.heartRate} <span className="text-xs font-semibold text-slate-500">BPM</span>
                  </p>
                </div>
                <div className="rounded-xl border border-rose-200 bg-white p-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400">SpO2 Level</span>
                  <p className="font-sans text-lg sm:text-xl font-extrabold text-rose-600 mt-0.5">
                    {vitals.spo2}%
                  </p>
                </div>
                <div className="rounded-xl border border-rose-200 bg-white p-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Core Temp</span>
                  <p className="font-sans text-lg sm:text-xl font-extrabold text-rose-600 mt-0.5">
                    {vitals.temperature}°C
                  </p>
                </div>
              </div>
            </div>

            {/* Emergency Status Lifecycle Tracker */}
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs">
              <p className="font-bold text-slate-800 flex items-center justify-between">
                <span>Emergency Lifecycle State</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </p>
              <div className="mt-2.5 space-y-1.5 font-medium text-slate-600">
                <p className="flex items-center gap-2 text-emerald-700 font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Critical condition detected & verified
                </p>
                <p className="flex items-center gap-2 text-emerald-700 font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Attending physician notified (Dr. Abhishek Rai)
                </p>
                <p className="flex items-center gap-2 text-emerald-700 font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  SOS Contact notified ({sosContact?.name || 'Rahul Soni'} · {sosContact?.phone})
                </p>
                <p className="flex items-center gap-2 text-emerald-700 font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Location sharing active (±{coords.accuracy}m accuracy)
                </p>
                {ambulanceRequested ? (
                  <p className="flex items-center gap-2 text-sky-700 font-bold">
                    <CheckCircle2 className="h-4 w-4 text-sky-600" />
                    Ambulance requested ({ambulanceDispatchInfo?.provider || 'Demo Emergency Dispatch'})
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-slate-400">
                    <span className="h-3 w-3 rounded-full border border-slate-300 ml-0.5 mr-0.5" />
                    Ambulance assistance pending confirmation
                  </p>
                )}
              </div>
            </div>

            {/* 4 Large High-Contrast 1-Tap Action Buttons (Mobile-First) */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Button 1: Request Ambulance */}
              <button
                type="button"
                onClick={() => setAmbulanceModalOpen(true)}
                className={`flex items-center justify-center gap-3 rounded-2xl p-4 font-bold text-white shadow-md transition-all active:scale-95 ${
                  ambulanceRequested
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                }`}
              >
                <Ambulance className="h-6 w-6" />
                <div className="text-left">
                  <span className="block text-sm sm:text-base font-extrabold uppercase tracking-wide">
                    {ambulanceRequested ? 'Ambulance Dispatched' : 'Request Ambulance'}
                  </span>
                  <span className="block text-[11px] font-normal opacity-90">
                    {ambulanceRequested ? 'Paramedics en route (ETA ~9m)' : 'Tap to dispatch emergency transport'}
                  </span>
                </div>
              </button>

              {/* Button 2: Call SOS Emergency Contact */}
              <button
                type="button"
                onClick={handleCallSos}
                className="flex items-center justify-center gap-3 rounded-2xl bg-amber-600 hover:bg-amber-700 p-4 font-bold text-white shadow-md shadow-amber-600/30 transition-all active:scale-95 text-left"
              >
                <PhoneCall className="h-6 w-6 shrink-0" />
                <div className="min-w-0">
                  <span className="block text-sm sm:text-base font-extrabold uppercase tracking-wide truncate">
                    Call SOS Contact
                  </span>
                  <span className="block text-[11px] font-normal opacity-90 truncate">
                    {sosContact?.name || 'Rahul Soni'} ({sosContact?.relation || 'Brother'})
                  </span>
                </div>
              </button>

              {/* Button 3: Call Doctor */}
              <button
                type="button"
                onClick={handleCallDoctor}
                className="flex items-center justify-center gap-3 rounded-2xl border-2 border-slate-200 bg-white hover:bg-slate-50 p-3.5 font-bold text-slate-800 shadow-xs transition-all active:scale-95 text-left"
              >
                <Phone className="h-5 w-5 text-sky-600 shrink-0" />
                <div className="min-w-0">
                  <span className="block text-xs sm:text-sm font-bold truncate">Call Doctor</span>
                  <span className="block text-[10px] text-slate-500 truncate">Dr. Abhishek Rai</span>
                </div>
              </button>

              {/* Button 4: Share / View Map */}
              <button
                type="button"
                onClick={() => setShowMap((prev) => !prev)}
                className="flex items-center justify-center gap-3 rounded-2xl border-2 border-slate-200 bg-white hover:bg-slate-50 p-3.5 font-bold text-slate-800 shadow-xs transition-all active:scale-95 text-left"
              >
                <MapPin className="h-5 w-5 text-rose-600 shrink-0" />
                <div className="min-w-0">
                  <span className="block text-xs sm:text-sm font-bold truncate">
                    {showMap ? 'Hide Emergency Map' : 'View Live Map'}
                  </span>
                  <span className="block text-[10px] text-slate-500 truncate">
                    Coords: {coords.latitude.toFixed(3)}, {coords.longitude.toFixed(3)}
                  </span>
                </div>
              </button>
            </div>

            {/* Expandable Live OpenStreetMap View */}
            {showMap ? (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <EmergencyMap
                  latitude={coords.latitude}
                  longitude={coords.longitude}
                  accuracy={coords.accuracy}
                  patientName={activeEmergency?.patientName || 'Akash Soni'}
                  status="CRITICAL"
                  lastUpdated="Just now"
                />
              </div>
            ) : null}

            {/* Bottom Actions Bar */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleShareLocation}
                className="rounded-xl text-xs"
              >
                <Share2 className="h-3.5 w-3.5 mr-1.5" />
                Copy Location Link
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => resolveEmergency(activeEmergency?.alertId)}
                className="text-xs rounded-xl text-slate-500 hover:text-rose-600"
              >
                Cancel / Mark Resolved
              </Button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      <AmbulanceRequestModal
        isOpen={ambulanceModalOpen}
        onClose={() => setAmbulanceModalOpen(false)}
      />
    </>
  );
}
