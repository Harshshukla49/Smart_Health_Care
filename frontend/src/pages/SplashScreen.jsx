import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  HeartPulse,
  Radio,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import { getAuthSession } from '../utils/auth';

export default function SplashScreen() {
  const navigate = useNavigate();
  const session = getAuthSession();
  const [progress, setProgress] = useState(15);

  const targetPath = session?.token ? '/dashboard' : '/login';

  const handleEnter = () => {
    navigate(targetPath, { replace: true });
  };

  useEffect(() => {
    // Increment progress bar smoothly
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 12;
      });
    }, 320);

    const timeout = setTimeout(() => {
      navigate(targetPath, { replace: true });
    }, 3800);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [navigate, targetPath]);

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-gradient-to-br from-indigo-700 via-purple-600 to-teal-500">
      {/* Background Animated Ambient Lights */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-400/30 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-teal-300/30 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-80 h-80 bg-blue-400/20 rounded-full blur-2xl pointer-events-none" />

      {/* Floating Micro Medical Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-35">
        <div className="absolute top-16 left-1/5 text-white/50 animate-bounce">
          <HeartPulse className="h-8 w-8" />
        </div>
        <div className="absolute bottom-20 right-1/4 text-white/50 animate-pulse">
          <Activity className="h-10 w-10" />
        </div>
        <div className="absolute top-1/3 right-12 text-white/50 animate-bounce delay-300">
          <Stethoscope className="h-7 w-7" />
        </div>
        <div className="absolute bottom-1/3 left-12 text-white/50 animate-pulse delay-500">
          <ShieldCheck className="h-8 w-8" />
        </div>
      </div>

      {/* Glassmorphic Welcome Card */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -30 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-lg rounded-[32px] border border-white/25 bg-white/15 p-6 sm:p-8 backdrop-blur-2xl shadow-[0_24px_70px_rgba(15,23,42,0.28)] flex flex-col items-center text-center text-white"
        >
          {/* Welcome Doctor Cartoon Illustration with Halo */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0, rotate: -6 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ delay: 0.15, duration: 0.7, type: 'spring', stiffness: 120 }}
            className="relative mb-4 group"
          >
            {/* Pulsing Glowing Ring */}
            <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-teal-300 via-sky-300 to-purple-300 opacity-60 blur-md animate-pulse group-hover:opacity-100 transition" />

            <div className="relative h-32 w-32 sm:h-36 sm:w-36 rounded-full overflow-hidden border-4 border-white shadow-2xl bg-white/20">
              <img
                src="/assets/welcome-doctor-cartoon.png"
                alt="Friendly Healthcare Doctor"
                className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  e.target.src = '/assets/doctor-command-center.png';
                }}
              />
            </div>

            {/* Waving Hand Badge */}
            <motion.div
              animate={{ rotate: [0, 16, -10, 16, 0] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
              className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-white text-lg shadow-lg border-2 border-teal-300"
            >
              👋
            </motion.div>
          </motion.div>

          {/* Brand Title */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-md"
          >
            Smart Health Care
          </motion.h1>

          {/* Welcoming Headline */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.6 }}
            className="mt-2 text-base sm:text-lg font-semibold text-sky-100 drop-shadow-sm flex items-center justify-center gap-1.5"
          >
            <span>Welcome to a Smarter Way of Healthcare</span>
          </motion.div>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-1 text-xs sm:text-sm text-slate-100/90 font-medium tracking-wide"
          >
            Monitoring · Caring · Connecting
          </motion.p>

          {/* Three Feature Highlight Badges */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold"
          >
            <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white shadow-2xs backdrop-blur-sm">
              <HeartPulse className="h-3.5 w-3.5 text-rose-300" />
              <span>Real-Time Vitals</span>
            </span>

            <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white shadow-2xs backdrop-blur-sm">
              <Radio className="h-3.5 w-3.5 text-teal-300" />
              <span>Live Telemetry</span>
            </span>

            <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white shadow-2xs backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
              <span>Secure Telehealth</span>
            </span>
          </motion.div>

          {/* Loading Progress Bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.85, duration: 0.4 }}
            className="mt-6 w-full space-y-1.5"
          >
            <div className="flex items-center justify-between text-[11px] text-white/80 font-medium px-1">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                Preparing your clinical workspace...
              </span>
              <span>{Math.min(100, progress)}%</span>
            </div>

            <div className="h-2 w-full rounded-full bg-white/20 p-0.5 overflow-hidden backdrop-blur-sm">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-300 via-sky-300 to-white transition-all duration-300 ease-out shadow-sm"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          </motion.div>

          {/* Quick Enter Action Button */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.4 }}
            type="button"
            onClick={handleEnter}
            className="mt-6 group inline-flex items-center justify-center gap-2 rounded-2xl border border-white/40 bg-white/20 px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg backdrop-blur-md transition-all hover:bg-white hover:text-[#0F172A] active:scale-95"
          >
            <span>Enter Healthcare Portal</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
