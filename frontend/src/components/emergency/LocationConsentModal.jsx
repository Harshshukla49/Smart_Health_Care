import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MapPin, ShieldCheck, X } from 'lucide-react';
import { Button } from '../Button';

export function LocationConsentModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] grid place-items-center bg-slate-900/60 p-4 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sky-100 border border-sky-200 text-sky-600">
              <MapPin className="h-6 w-6" />
            </span>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4">
            <h3 className="font-sans text-xl font-bold text-slate-900">
              Allow Smart Healthcare to access your location?
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Location is used during <strong>emergency situations</strong> to help authorized doctors, paramedics, and your designated emergency contacts locate you immediately.
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50/60 p-3 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-teal-800 leading-tight">
              <strong>Patient Privacy Guarantee:</strong> Your coordinates are protected under HIPAA standards and shared only when critical alarms or SOS are activated.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <Button variant="secondary" size="sm" onClick={onClose} className="rounded-xl text-xs">
              Not Now
            </Button>
            <Button
              size="sm"
              onClick={onConfirm}
              className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm"
            >
              Allow Location Access
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
