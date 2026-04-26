import React from 'react';
import { Button } from './Button';

export function MedicineCard({ medicine, onMarkTaken, disabled }) {
  return (
    <div className={`rounded-xl border p-4 mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between ${medicine.taken ? 'bg-green-50 border-green-200' : 'bg-white/5 border-white/10'}`}>
      <div>
        <div className="font-semibold text-lg text-slate-900 dark:text-white">{medicine.name}</div>
        <div className="text-sm text-slate-600 dark:text-slate-300">Dosage: {medicine.dosage}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">Time: {medicine.time}</div>
        {medicine.taken && (
          <div className="mt-1 text-xs text-green-600 dark:text-green-300">Taken</div>
        )}
      </div>
      <div className="mt-3 sm:mt-0">
        {!medicine.taken && (
          <Button onClick={() => onMarkTaken(medicine)} disabled={disabled}>
            Mark as Taken
          </Button>
        )}
      </div>
    </div>
  );
}
