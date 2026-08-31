import React from 'react';
import { Pill, Check, Clock } from 'lucide-react';
import { Button } from './Button';

export function MedicineCard({ medicine, onMarkTaken, disabled }) {
  const isTaken = Boolean(medicine?.taken);

  return (
    <div
      className={`rounded-[16px] border p-4 sm:p-5 mb-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all duration-150 ${
        isTaken
          ? 'bg-emerald-50/40 border-emerald-200/90 shadow-2xs'
          : 'bg-white border-[#E2E8F0] shadow-[0_2px_14px_rgba(15,23,42,0.03)] hover:border-slate-300'
      }`}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
            isTaken
              ? 'bg-emerald-100/70 border-emerald-300 text-emerald-700'
              : 'bg-sky-50 border-sky-200 text-[#0284C7]'
          }`}
        >
          <Pill className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-sans text-base font-bold text-[#0F172A] leading-tight">
              {medicine.medicineName || medicine.name}
            </h4>
            {medicine.dosage && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-[#64748B]">
                {medicine.dosage}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#64748B]">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              {medicine.frequency || medicine.time || 'Daily as prescribed'}
            </span>
            {medicine.route && (
              <span>• Route: <strong className="text-[#334155]">{medicine.route}</strong></span>
            )}
          </div>

          {isTaken && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
              <Check className="h-3 w-3 text-emerald-600" />
              <span>Taken today</span>
            </div>
          )}
        </div>
      </div>

      <div className="self-end sm:self-center shrink-0">
        {!isTaken ? (
          <Button
            size="sm"
            onClick={() => onMarkTaken(medicine)}
            disabled={disabled}
            className="rounded-xl px-4 py-2 font-bold"
          >
            Mark as Taken
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
            <Check className="h-3.5 w-3.5" />
            Verified
          </span>
        )}
      </div>
    </div>
  );
}

export default MedicineCard;
