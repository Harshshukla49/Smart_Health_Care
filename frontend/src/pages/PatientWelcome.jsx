import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, HeartPulse, ShieldCheck, Video } from 'lucide-react';
import { getAuthSession } from '../utils/auth';
import { Button } from '../components/Button';

export default function PatientWelcome() {
  const navigate = useNavigate();
  const session = getAuthSession();

  useEffect(() => {
    if (!session || session.role !== 'patient') {
      navigate('/login/patient', { replace: true });
    }
  }, [navigate, session]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-indigo-800 via-purple-700 to-teal-600 text-white overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-400/30 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-teal-300/30 rounded-full blur-3xl pointer-events-none animate-pulse" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md rounded-[32px] border border-white/25 bg-white/15 p-6 sm:p-8 backdrop-blur-2xl shadow-[0_25px_70px_rgba(15,23,42,0.3)] flex flex-col items-center text-center"
      >
        {/* Welcoming Cartoon Doctor Avatar */}
        <div className="relative mb-4 group">
          <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-teal-300 via-sky-300 to-purple-300 opacity-60 blur-md animate-pulse" />
          <div className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-full overflow-hidden border-4 border-white shadow-2xl bg-white/20">
            <img
              src="/assets/welcome-doctor-cartoon.png"
              alt="Welcome Doctor"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src = '/assets/doctor-command-center.png';
              }}
            />
          </div>
          <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-white text-base shadow-lg border-2 border-teal-300">
            👋
          </span>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-bold text-sky-200 backdrop-blur-sm mb-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
          <span>Patient Account Verified</span>
        </span>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight drop-shadow-md">
          Welcome, {session?.name || 'Patient'}!
        </h1>

        <p className="mt-2 text-xs sm:text-sm text-slate-100/90 leading-relaxed font-medium">
          Your personal health monitoring dashboard is ready. Track continuous live vitals, review cardiologist notes, and request instant emergency assistance.
        </p>

        {/* Quick Highlights */}
        <div className="mt-4 w-full grid grid-cols-2 gap-2 text-left text-xs">
          <div className="rounded-xl border border-white/15 bg-white/10 p-2.5 backdrop-blur-sm flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-rose-300 shrink-0" />
            <span className="font-semibold text-[11px] leading-tight">Live ECG & Pulse</span>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 p-2.5 backdrop-blur-sm flex items-center gap-2">
            <Video className="h-4 w-4 text-teal-300 shrink-0" />
            <span className="font-semibold text-[11px] leading-tight">Telehealth Video</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/dashboard', { replace: true })}
          className="mt-6 w-full group flex items-center justify-center gap-2 rounded-2xl bg-white text-[#0F172A] hover:bg-sky-50 py-3 px-6 text-sm font-bold shadow-lg transition-all active:scale-[0.98]"
        >
          <span>Continue to Dashboard</span>
          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform text-[#0284C7]" />
        </button>
      </motion.div>
    </div>
  );
}
