import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share, PlusSquare, CheckCircle, Smartphone } from 'lucide-react';
import { usePwa } from '../../context/PwaContext';

export function IosInstallModal() {
  const { showIosGuide, setShowIosGuide } = usePwa();

  if (!showIosGuide) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] grid place-items-center bg-slate-900/60 p-4 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setShowIosGuide(false)}
            className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-500 to-teal-600 p-0.5 shadow-md flex items-center justify-center">
              <img
                src="/icons/icon-192.png"
                alt="Smart Health Care Logo"
                className="h-11 w-11 rounded-[14px]"
              />
            </div>
            <div>
              <h3 className="font-heading text-base font-bold text-slate-900">
                Install Smart Health Care
              </h3>
              <p className="text-xs text-slate-500">
                Add to your iPhone or iPad Home Screen
              </p>
            </div>
          </div>

          {/* Steps */}
          <div className="mt-5 space-y-4 text-xs text-slate-700">
            <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 border border-slate-100">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-sky-100 font-bold text-sky-700">
                1
              </span>
              <div>
                <p className="font-bold text-slate-900">
                  Open in Safari & Tap Share
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tap the Safari <strong>Share</strong> button at the bottom of your screen (square with an arrow pointing up).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 border border-slate-100">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-sky-100 font-bold text-sky-700">
                2
              </span>
              <div>
                <p className="font-bold text-slate-900">
                  Select "Add to Home Screen"
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Scroll down the share sheet and tap <strong>Add to Home Screen</strong> with the plus icon.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 border border-slate-100">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-sky-100 font-bold text-sky-700">
                3
              </span>
              <div>
                <p className="font-bold text-slate-900">
                  Tap "Add" in Top Right
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Confirm the name and tap <strong>Add</strong>. The app icon will appear instantly on your home screen.
                </p>
              </div>
            </div>
          </div>

          {/* Action button */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full rounded-xl bg-sky-600 py-2.5 text-center text-xs font-bold text-white shadow-xs hover:bg-sky-700 transition"
            >
              Got it, thanks!
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
