import React, { useState } from 'react';
import {
  Video,
  Phone,
  PhoneCall,
  User,
  ShieldCheck,
  Star,
  CheckCircle2,
  X,
  Stethoscope,
  Sparkles,
  Radio,
  ArrowRight,
  Delete,
  Hash,
} from 'lucide-react';
import { useVideoCall, HOSPITAL_PHYSICIANS } from '../../context/VideoCallContext';

export function VideoCallDialerModal() {
  const { isDialerOpen, closeDialer, startCall, dialerDefaultDoctor } = useVideoCall();

  // Secondary Preference State: 'specialist' | 'dialpad'
  const [secondaryTab, setSecondaryTab] = useState('specialist');
  const [selectedPhysicianId, setSelectedPhysicianId] = useState(HOSPITAL_PHYSICIANS[0]?.id || 'DOC-EM-02');
  const [dialedNumber, setDialedNumber] = useState('');

  if (!isDialerOpen) return null;

  // First preference doctor is the patient's dynamically assigned doctor
  const assignedDoctor = dialerDefaultDoctor || {
    id: 'DOC-CARE-TEAM',
    name: 'Assigned Physician Care Team',
    doctorName: 'Assigned Physician Care Team',
    role: 'doctor',
    title: 'Attending Physician',
    department: 'Cardiology & Intensive Ward 4B',
    phone: '+91 98765 43210',
    extension: '401',
    avatar: '/assets/doctor-command-center.png',
    status: 'online',
    isAssigned: false,
  };

  const otherPhysicians = HOSPITAL_PHYSICIANS.filter((d) => d.id !== assignedDoctor.id && d.name !== assignedDoctor.name);

  // Dial pad keys
  const dialKeys = [
    { num: '1', sub: '' },
    { num: '2', sub: 'ABC' },
    { num: '3', sub: 'DEF' },
    { num: '4', sub: 'GHI' },
    { num: '5', sub: 'JKL' },
    { num: '6', sub: 'MNO' },
    { num: '7', sub: 'PQRS' },
    { num: '8', sub: 'TUV' },
    { num: '9', sub: 'WXYZ' },
    { num: '*', sub: '' },
    { num: '0', sub: '+' },
    { num: '#', sub: '' },
  ];

  const handleKeypadPress = (val) => {
    if (dialedNumber.length < 16) {
      setDialedNumber((prev) => prev + val);
    }
  };

  const handleBackspace = () => {
    setDialedNumber((prev) => prev.slice(0, -1));
  };

  const handleCallAssignedDoctor = () => {
    startCall(assignedDoctor);
  };

  const handleCallSelectedSpecialist = () => {
    const physician = HOSPITAL_PHYSICIANS.find((p) => p.id === selectedPhysicianId);
    if (physician) {
      startCall(physician);
    }
  };

  const handleCallDialedNumber = () => {
    if (!dialedNumber.trim()) return;

    // Check if dialed number matches a physician extension
    const matched = HOSPITAL_PHYSICIANS.find(
      (p) => p.extension === dialedNumber.trim() || p.phone.includes(dialedNumber.trim())
    );

    if (matched) {
      startCall(matched);
    } else {
      startCall({
        id: `CUSTOM-${dialedNumber}`,
        name: `Hospital Extension #${dialedNumber}`,
        title: 'Direct Telehealth Line',
        department: 'Clinical Tele-Triage',
        phone: dialedNumber,
        extension: dialedNumber,
        dialedNumber,
        isAssigned: false,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl rounded-[20px] bg-white border border-[#E2E8F0] shadow-[0_20px_50px_rgba(15,23,42,0.18)] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] bg-slate-50/70">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 border border-teal-200 text-[#0D9488]">
              <Video className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#0F172A] leading-tight">
                Clinical Telehealth Consultation
              </h2>
              <p className="text-xs text-[#64748B] flex items-center gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>AES-256 Encrypted Telemedicine Link</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeDialer}
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#0F172A] hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* =========================================================
              FIRST PREFERENCE: ASSIGNED CARDIOLOGIST (RECOMMENDED)
             ========================================================= */}
          <div className="rounded-[16px] border-2 border-[#BAE6FD] bg-gradient-to-br from-[#EFF8FF] to-white p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0284C7] text-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-2xs">
                <Star className="h-3 w-3 fill-current text-amber-300" />
                <span>First Preference · {assignedDoctor.isAssigned ? 'Assigned Doctor' : 'On-Duty Physician'}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Online / Ready</span>
              </span>
            </div>

            <div className="flex items-center gap-3.5">
              {assignedDoctor.avatar ? (
                <img
                  src={assignedDoctor.avatar}
                  alt={assignedDoctor.name}
                  className="h-14 w-14 rounded-2xl object-cover border-2 border-white shadow-xs shrink-0"
                />
              ) : (
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#0284C7] to-blue-700 text-white font-black text-lg grid place-items-center border-2 border-white shadow-xs shrink-0">
                  {(assignedDoctor.name || 'DR').replace('Dr.', '').trim().slice(0, 2).toUpperCase() || 'DR'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-extrabold text-[#0F172A] truncate">
                  {assignedDoctor.name}
                </h3>
                <p className="text-xs font-semibold text-[#0284C7]">{assignedDoctor.title || 'Attending Physician'}</p>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  {assignedDoctor.department || 'Cardiology & Intensive Telemetry'} · Ext: <strong className="text-[#0F172A] font-mono">{assignedDoctor.extension || '401'}</strong>
                </p>
              </div>
            </div>

            <div className="mt-3.5 pt-3 border-t border-sky-100 flex flex-col sm:flex-row items-center gap-2.5 justify-between">
              <div className="text-[11px] text-[#64748B] flex items-center gap-1.5 self-start sm:self-center">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Primary physician linked to your patient telemetry record</span>
              </div>
              <button
                type="button"
                onClick={handleCallAssignedDoctor}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#0284C7] hover:bg-[#0369A1] text-white px-4 py-2.5 text-xs font-bold shadow-xs hover:shadow-md transition-all active:scale-[0.98]"
              >
                <Video className="h-4 w-4" />
                <span>Call Assigned Doctor</span>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E2E8F0]" />
            </div>
            <span className="relative bg-white px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">
              Or Choose Alternative / Dial Number
            </span>
          </div>

          {/* =========================================================
              SECOND PREFERENCE: CHOOSE THEMSELVES OR DIAL NUMBER
             ========================================================= */}
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden shadow-2xs">
            {/* Tabs */}
            <div className="flex border-b border-[#E2E8F0] bg-slate-50/80 p-1">
              <button
                type="button"
                onClick={() => setSecondaryTab('specialist')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-[10px] text-xs font-bold transition ${
                  secondaryTab === 'specialist'
                    ? 'bg-white text-[#0F172A] shadow-2xs border border-[#E2E8F0]'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <Stethoscope className="h-3.5 w-3.5 text-[#0284C7]" />
                <span>Choose On-Duty Specialist</span>
              </button>

              <button
                type="button"
                onClick={() => setSecondaryTab('dialpad')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-[10px] text-xs font-bold transition ${
                  secondaryTab === 'dialpad'
                    ? 'bg-white text-[#0F172A] shadow-2xs border border-[#E2E8F0]'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <Phone className="h-3.5 w-3.5 text-[#0D9488]" />
                <span>Dial Direct Extension / Number</span>
              </button>
            </div>

            {/* Content: Option A (Choose On-Duty Specialist) */}
            {secondaryTab === 'specialist' && (
              <div className="p-4 space-y-3">
                <p className="text-[11px] text-[#64748B]">
                  Select an available hospital physician or emergency triage desk:
                </p>

                <div className="space-y-2">
                  {otherPhysicians.map((doc) => {
                    const isSelected = selectedPhysicianId === doc.id;
                    return (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedPhysicianId(doc.id)}
                        className={`flex items-center justify-between p-3 rounded-[12px] border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#0284C7] bg-sky-50/60 shadow-2xs'
                            : 'border-[#E2E8F0] hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={doc.avatar}
                            alt={doc.name}
                            className="h-10 w-10 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#0F172A] truncate">{doc.name}</p>
                            <p className="text-[11px] text-[#64748B]">{doc.title}</p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              Ext: {doc.extension} · {doc.department}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Online
                          </span>
                          <input
                            type="radio"
                            checked={isSelected}
                            onChange={() => setSelectedPhysicianId(doc.id)}
                            className="text-[#0284C7] focus:ring-[#0284C7]"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleCallSelectedSpecialist}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-[10px] bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 text-xs font-bold shadow-xs transition"
                  >
                    <Video className="h-3.5 w-3.5 text-teal-400" />
                    <span>Call Selected Specialist</span>
                  </button>
                </div>
              </div>
            )}

            {/* Content: Option B (Dial Pad) */}
            {secondaryTab === 'dialpad' && (
              <div className="p-4 space-y-4">
                {/* Number display */}
                <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-slate-50/80 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
                      Direct Extension or Phone Number
                    </span>
                    <input
                      type="text"
                      value={dialedNumber}
                      onChange={(e) => setDialedNumber(e.target.value)}
                      placeholder="e.g. 401 or +91 98765..."
                      className="w-full bg-transparent text-lg sm:text-xl font-bold font-mono text-[#0F172A] focus:outline-none placeholder:text-slate-400"
                    />
                  </div>
                  {dialedNumber && (
                    <button
                      type="button"
                      onClick={handleBackspace}
                      className="p-2 text-slate-400 hover:text-rose-600 transition"
                      title="Backspace"
                    >
                      <Delete className="h-5 w-5" />
                    </button>
                  )}
                </div>

                {/* Speed Dial Shortcuts */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Speed Dial Shortcuts
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setDialedNumber('401')}
                      className="p-2 rounded-lg border border-[#E2E8F0] bg-slate-50 hover:bg-sky-50 hover:border-sky-300 text-left transition"
                    >
                      <span className="font-mono font-bold text-[#0284C7]">401</span>
                      <p className="text-[10px] text-slate-600 truncate">Cardiology</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDialedNumber('102')}
                      className="p-2 rounded-lg border border-[#E2E8F0] bg-slate-50 hover:bg-sky-50 hover:border-sky-300 text-left transition"
                    >
                      <span className="font-mono font-bold text-[#0D9488]">102</span>
                      <p className="text-[10px] text-slate-600 truncate">Emergency</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDialedNumber('108')}
                      className="p-2 rounded-lg border border-[#E2E8F0] bg-slate-50 hover:bg-sky-50 hover:border-sky-300 text-left transition"
                    >
                      <span className="font-mono font-bold text-indigo-600">108</span>
                      <p className="text-[10px] text-slate-600 truncate">ICU Telemetry</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDialedNumber('911')}
                      className="p-2 rounded-lg border border-[#E2E8F0] bg-slate-50 hover:bg-rose-50 hover:border-rose-300 text-left transition"
                    >
                      <span className="font-mono font-bold text-[#E11D48]">911</span>
                      <p className="text-[10px] text-slate-600 truncate">Rapid Response</p>
                    </button>
                  </div>
                </div>

                {/* Telephone Keypad Grid */}
                <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto pt-1">
                  {dialKeys.map((k) => (
                    <button
                      key={k.num}
                      type="button"
                      onClick={() => handleKeypadPress(k.num)}
                      className="h-12 rounded-[12px] border border-[#E2E8F0] bg-slate-50 hover:bg-slate-100 active:bg-sky-100 flex flex-col items-center justify-center transition shadow-2xs group"
                    >
                      <span className="text-base font-bold text-[#0F172A] group-active:scale-95 transition-transform">
                        {k.num}
                      </span>
                      {k.sub && (
                        <span className="text-[8px] font-semibold text-[#94A3B8] tracking-widest uppercase -mt-0.5">
                          {k.sub}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Call Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={!dialedNumber.trim()}
                    onClick={handleCallDialedNumber}
                    className="w-full flex items-center justify-center gap-2 rounded-[12px] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 text-sm font-bold shadow-md transition active:scale-[0.98]"
                  >
                    <PhoneCall className="h-4 w-4" />
                    <span>Dial & Start Video Call ({dialedNumber || '...'})</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-[#E2E8F0] bg-slate-50 text-[11px] text-[#64748B] flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Radio className="h-3.5 w-3.5 text-emerald-600" />
            Ward 4B Telemetry Hub Online
          </span>
          <button
            type="button"
            onClick={closeDialer}
            className="font-semibold text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
