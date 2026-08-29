import React from 'react';
import {
  Video,
  PhoneOff,
  PhoneCall,
  User,
  HeartPulse,
  Activity,
  Thermometer,
  ShieldAlert,
  Waves,
} from 'lucide-react';
import { useVideoCall } from '../../context/VideoCallContext';

export function IncomingCallModal() {
  const { callState, activeCall, acceptCall, declineCall } = useVideoCall();

  if (callState !== 'incoming' || !activeCall) return null;

  const vitals = activeCall.vitalsSnapshot || {
    heartRate: 72,
    spo2: 98,
    temperature: 36.7,
    status: 'Normal Sinus Rhythm',
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md rounded-[22px] bg-white border-2 border-emerald-400/80 shadow-[0_25px_60px_rgba(16,185,129,0.25)] overflow-hidden flex flex-col">
        {/* Pulsing Beacon Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 px-5 py-4 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),_transparent)]" />
          <div className="relative z-10 flex items-center justify-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
            </span>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-100">
              Incoming Clinical Video Call
            </span>
          </div>
          <h2 className="relative z-10 text-xl font-black mt-1">
            Patient Telehealth Request
          </h2>
        </div>

        {/* Caller Details & Telemetry Snapshot */}
        <div className="p-6 space-y-5 text-center">
          {/* Avatar & Rings */}
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-75" />
            <div className="relative w-24 h-24 rounded-full border-4 border-emerald-500 bg-slate-100 overflow-hidden shadow-lg mx-auto flex items-center justify-center">
              <img
                src="/assets/patient-remote-care.png"
                alt="Caller"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <User className="h-10 w-10 text-slate-400 absolute" />
            </div>
            <span className="absolute bottom-0 right-1 h-6 w-6 rounded-full bg-emerald-500 border-2 border-white grid place-items-center text-white shadow-xs">
              <Video className="h-3 w-3" />
            </span>
          </div>

          <div>
            <h3 className="text-xl font-bold text-[#0F172A]">
              {activeCall.patientName || activeCall.callerName || activeCall.fromName || 'Patient'}
            </h3>
            <p className="text-xs text-[#64748B] font-mono mt-0.5">
              ID: {activeCall.patientId || activeCall.fromId || 'N/A'} · {activeCall.callerPhone || ''}
            </p>
            <span className="inline-block mt-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-0.5 text-[11px] font-bold text-[#0284C7]">
              {activeCall.isAssignedDoctor
                ? '⭐ Direct Call to Assigned Doctor'
                : `Ext ${activeCall.recipientExtension || '401'} Line`}
            </span>
          </div>

          {/* Live Vitals Snapshot */}
          <div className="rounded-[14px] border border-[#E2E8F0] bg-slate-50/90 p-3.5 text-left">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2 flex items-center gap-1.5">
              <Activity className="h-3 w-3 text-[#0284C7]" />
              <span>Current Telemetry Stream Preview</span>
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white p-2 border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] text-slate-500 block">Heart Rate</span>
                <span className="text-sm font-extrabold text-[#0F172A]">
                  {vitals.heartRate} <span className="text-[9px] font-normal text-slate-400">BPM</span>
                </span>
              </div>
              <div className="rounded-lg bg-white p-2 border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] text-slate-500 block">SpO2</span>
                <span className="text-sm font-extrabold text-emerald-700">
                  {vitals.spo2}%
                </span>
              </div>
              <div className="rounded-lg bg-white p-2 border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] text-slate-500 block">Temp</span>
                <span className="text-sm font-extrabold text-[#0F172A]">
                  {vitals.temperature}°C
                </span>
              </div>
            </div>
            <p className="text-[11px] text-[#64748B] text-center mt-2 font-medium">
              Rhythm: <strong className="text-emerald-700">{vitals.status}</strong>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={declineCall}
              className="flex items-center justify-center gap-2 rounded-[14px] border border-rose-200 bg-rose-50 hover:bg-rose-100 text-[#E11D48] py-3 px-4 text-xs font-bold transition shadow-xs active:scale-[0.98]"
            >
              <PhoneOff className="h-4 w-4" />
              <span>Decline</span>
            </button>

            <button
              type="button"
              onClick={acceptCall}
              className="flex items-center justify-center gap-2 rounded-[14px] bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-4 text-xs font-bold transition shadow-md hover:shadow-lg active:scale-[0.98] animate-pulse"
            >
              <Video className="h-4 w-4" />
              <span>Accept Call</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
