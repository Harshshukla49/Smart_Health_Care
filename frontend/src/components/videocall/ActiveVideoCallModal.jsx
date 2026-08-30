import React, { useEffect, useMemo, useRef } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  User,
  ShieldCheck,
  Activity,
  HeartPulse,
  Thermometer,
  Waves,
} from 'lucide-react';
import { useVideoCall } from '../../context/VideoCallContext';
import { getAuthSession, normalizeRole } from '../../utils/auth';

export function ActiveVideoCallModal() {
  const {
    callState,
    activeCall,
    endCall,
    acceptCall,
    formattedDuration,
    isMuted,
    isCameraOff,
    toggleMute,
    toggleCamera,
    localStream,
    remoteStream,
    localParticipant,
    remoteParticipant,
  } = useVideoCall();

  const session = getAuthSession();
  const userRole = normalizeRole(session?.role);
  const isDoctor = userRole === 'doctor';

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState]);

  if (callState !== 'calling' && callState !== 'connected' && callState !== 'ended') {
    return null;
  }

  // Determine Display Names based on WHO the user is
  const remoteDisplayName = isDoctor
    ? (activeCall?.patientName || activeCall?.receiverName || 'Patient')
    : (activeCall?.doctorName || activeCall?.receiverName || 'Assigned Physician');

  const remoteDisplaySubtitle = isDoctor
    ? `Patient ID: ${activeCall?.patientId || activeCall?.receiverId || 'N/A'}`
    : `Attending Physician · ${activeCall?.recipientDepartment || 'Cardiology Ward 4B'}`;

  const vitals = activeCall?.vitalsSnapshot || {
    heartRate: 72,
    spo2: 98,
    temperature: 36.7,
    status: 'Normal Sinus Rhythm',
  };

  // =========================================================================
  // STATE 1: OUTGOING CALLING / RINGING
  // =========================================================================
  if (callState === 'calling') {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
        <div className="relative w-full max-w-md rounded-[24px] bg-white border border-[#E2E8F0] shadow-[0_25px_60px_rgba(15,23,42,0.25)] overflow-hidden flex flex-col p-6 text-center space-y-6">
          {/* Top Status */}
          <div className="flex items-center justify-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#0284C7]">
              {isDoctor ? 'Calling Patient Transceiver...' : 'Connecting Telehealth Transmission...'}
            </span>
          </div>

          {/* Participant Avatar with Radar Rings */}
          <div className="relative mx-auto w-28 h-28">
            <div className="absolute inset-0 rounded-full bg-sky-200 animate-ping opacity-60" />
            <div className="relative w-28 h-28 rounded-full border-4 border-[#0284C7] bg-slate-100 overflow-hidden shadow-xl mx-auto flex items-center justify-center">
              {isDoctor ? (
                <div className="w-full h-full bg-gradient-to-br from-sky-600 to-blue-800 flex items-center justify-center text-white text-3xl font-black">
                  {(remoteDisplayName || 'PT').slice(0, 2).toUpperCase()}
                </div>
              ) : (
                <img
                  src={activeCall?.recipientAvatar || '/assets/doctor-command-center.png'}
                  alt="Doctor"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = '/assets/doctor-telemetry-desk.jpg';
                  }}
                />
              )}
            </div>
            <span className="absolute bottom-1 right-2 h-7 w-7 rounded-full bg-[#0284C7] border-2 border-white grid place-items-center text-white shadow-xs">
              <Video className="h-4 w-4" />
            </span>
          </div>

          <div>
            <h3 className="text-2xl font-black text-[#0F172A]">
              {remoteDisplayName}
            </h3>
            <p className="text-sm font-semibold text-[#0284C7] mt-0.5">
              {remoteDisplaySubtitle}
            </p>
            <p className="text-xs text-[#64748B] mt-1 font-mono">
              Room #{activeCall?.callId?.slice(-8) || 'CALL-DIRECT'}
            </p>
          </div>

          <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-3 text-xs text-sky-800 flex items-center justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
            <span>
              {isDoctor
                ? `Ringing ${remoteDisplayName}'s mobile device...`
                : "Ringing doctor's clinical workstation..."}
            </span>
          </div>

          {/* Cancel Call Button */}
          <div className="pt-1 flex flex-col gap-2">
            <button
              type="button"
              onClick={endCall}
              className="w-full flex items-center justify-center gap-2 rounded-[14px] bg-rose-600 hover:bg-rose-700 text-white py-3.5 text-xs font-bold transition shadow-md active:scale-[0.98]"
            >
              <PhoneOff className="h-4 w-4" />
              <span>Cancel Call</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE 2: ACTIVE CONNECTED VIDEO CONSULTATION ROOM
  // =========================================================================
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl h-[88vh] rounded-[24px] bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col">
        {/* Call Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 text-white shrink-0 z-20">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-bold text-white">
                  {remoteDisplayName}
                </span>
                <span className="rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 text-[10px] font-bold">
                  LIVE TELEHEALTH
                </span>
                {isDoctor && (
                  <span className="rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 text-[10px] font-mono font-bold">
                    ID: {activeCall?.patientId}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Duration: <strong className="text-white">{formattedDuration}</strong> · P2P WebRTC Encrypted
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>HIPAA Compliant Room</span>
            </span>
          </div>
        </div>

        {/* Video Canvas Stage */}
        <div className="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden">
          {/* Main Remote Video feed */}
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-950">
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-6 text-slate-300">
                <div className="relative mb-4">
                  <div className="w-24 h-24 rounded-full border-4 border-sky-400/50 bg-slate-800 flex items-center justify-center shadow-xl">
                    <User className="h-12 w-12 text-sky-300" />
                  </div>
                  <span className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-emerald-500 border-2 border-slate-900 grid place-items-center">
                    <Activity className="h-3 w-3 text-white animate-pulse" />
                  </span>
                </div>
                <h4 className="text-xl font-bold text-white">
                  {remoteDisplayName}
                </h4>
                <p className="text-xs text-sky-300 mt-1 font-mono">
                  Connecting secure peer-to-peer WebRTC media channel...
                </p>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Negotiating STUN/TURN ICE candidates</span>
                </div>
              </div>
            )}

            {/* Ambient Remote Participant Tag (Top Left) */}
            <div className="absolute top-4 left-4 rounded-xl bg-slate-900/75 border border-slate-700/80 backdrop-blur-md px-3.5 py-2 text-xs text-white flex items-center gap-2 shadow-lg">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <p className="font-bold leading-none">{remoteDisplayName}</p>
                <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{remoteDisplaySubtitle}</p>
              </div>
            </div>

            {/* Floating Patient Telemetry HUD Overlay (Top Right - Doctor View) */}
            {isDoctor && (
              <div className="absolute top-4 right-4 rounded-2xl bg-slate-900/85 border border-slate-700/80 backdrop-blur-md p-3 text-white max-w-xs shadow-xl hidden sm:block">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                  <Activity className="h-3 w-3 text-sky-400" />
                  <span>Patient Telemetry Stream</span>
                </p>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-slate-800/80 p-1.5 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 block">HR</span>
                    <span className="font-mono font-bold text-sky-400">{vitals.heartRate} BPM</span>
                  </div>
                  <div className="rounded-lg bg-slate-800/80 p-1.5 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 block">SpO2</span>
                    <span className="font-mono font-bold text-emerald-400">{vitals.spo2}%</span>
                  </div>
                  <div className="rounded-lg bg-slate-800/80 p-1.5 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 block">Temp</span>
                    <span className="font-mono font-bold text-slate-200">{vitals.temperature}°C</span>
                  </div>
                </div>
                <p className="text-[10px] text-emerald-400 mt-2 text-center font-medium">
                  ● Lead II: {vitals.status || 'Isoelectric Sinus Rhythm'}
                </p>
              </div>
            )}

            {/* Local Camera Picture-in-Picture (Bottom Right) */}
            <div className="absolute bottom-4 right-4 w-32 h-24 sm:w-44 sm:h-32 rounded-2xl border-2 border-slate-600 bg-slate-800 overflow-hidden shadow-2xl z-10">
              {localStream && !isCameraOff ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-400 p-2 text-center">
                  <User className="h-6 w-6 text-slate-500" />
                  <span className="text-[10px] mt-1 text-slate-400">
                    {isCameraOff ? 'Camera Off' : 'Connecting preview'}
                  </span>
                </div>
              )}
              <span className="absolute bottom-1 left-2 text-[9px] font-bold text-white bg-black/60 px-1.5 rounded">
                You ({isDoctor ? 'Dr. ' + session?.name : 'Patient'})
              </span>
            </div>
          </div>
        </div>

        {/* Video Call Controls Bottom Bar */}
        <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between z-20">
          <div className="text-xs text-slate-400 font-mono hidden sm:block">
            Target: {remoteDisplayName} ({isDoctor ? `Patient ID: ${activeCall?.patientId}` : 'Doctor'})
          </div>

          <div className="flex items-center gap-3 sm:gap-4 mx-auto sm:mx-0">
            {/* Toggle Mic */}
            <button
              type="button"
              onClick={toggleMute}
              className={`p-3.5 rounded-full border transition shadow-sm ${
                isMuted
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>

            {/* Toggle Camera */}
            <button
              type="button"
              onClick={toggleCamera}
              className={`p-3.5 rounded-full border transition shadow-sm ${
                isCameraOff
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              }`}
              title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
            >
              {isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </button>

            {/* End Call Button */}
            <button
              type="button"
              onClick={endCall}
              className="p-3.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white transition shadow-lg hover:shadow-rose-600/30 active:scale-[0.96]"
              title="End consultation"
            >
              <PhoneOff className="h-5 w-5" />
            </button>
          </div>

          <div className="text-xs text-slate-400 font-mono hidden sm:block">
            Room: #{activeCall?.callId?.slice(-8) || 'TELE-401'}
          </div>
        </div>
      </div>
    </div>
  );
}
