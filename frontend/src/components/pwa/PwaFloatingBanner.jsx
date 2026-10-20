import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone, Sparkles } from 'lucide-react';
import { usePwa } from '../../context/PwaContext';

const DISMISS_KEY = 'smarthealth_pwa_banner_dismissed';

export function PwaFloatingBanner() {
  const { isInstallable, isInstalled, isIos, promptInstall } = usePwa();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const lastDismissed = localStorage.getItem(DISMISS_KEY);
    if (!lastDismissed) {
      setDismissed(false);
      return;
    }
    const daysSinceDismiss = (Date.now() - Number(lastDismissed)) / (1000 * 60 * 60 * 24);
    if (daysSinceDismiss > 5) {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  if (isInstalled || dismissed || (!isInstallable && !isIos)) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ duration: 0.25 }}
        className="fixed bottom-5 left-4 right-4 z-40 mx-auto max-w-md sm:left-auto sm:right-6"
      >
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-sky-200/80 bg-white/95 p-3.5 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-sky-500 to-teal-600 p-0.5 shadow-sm flex items-center justify-center">
              <img
                src="/icons/icon-192.png"
                alt="App Icon"
                className="h-9 w-9 rounded-[10px]"
              />
            </div>
            <div>
              <p className="font-heading text-xs font-bold text-slate-900 leading-tight">
                Install Smart Health Care
              </p>
              <p className="text-[11px] text-slate-500">
                {isIos ? 'Add to Home Screen for 1-tap emergency access' : 'Fast, secure, installable desktop & mobile app'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={promptInstall}
              className="inline-flex items-center gap-1 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-sky-700 transition"
            >
              <Download className="h-3 w-3" />
              <span>Install</span>
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
