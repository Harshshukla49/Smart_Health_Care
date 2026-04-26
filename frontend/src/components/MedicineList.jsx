import React, { useState } from 'react';
import { MedicineCard } from './MedicineCard';
import { Button } from './Button';

export function MedicineList({ medicines, onMarkTaken, onAddMedicine, loading }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', dosage: '', time: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await onAddMedicine(form);
    setForm({ name: '', dosage: '', time: '' });
    setSubmitting(false);
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Medicines</h3>
        <Button onClick={() => setShowForm((v) => !v)} variant="secondary">
          {showForm ? 'Cancel' : 'Add Medicine'}
        </Button>
      </div>
      {showForm && (
        <form className="bg-white/10 rounded-xl p-4 mb-4" onSubmit={handleSubmit}>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Medicine Name"
              required
              className="rounded border px-3 py-2"
            />
            <input
              name="dosage"
              value={form.dosage}
              onChange={handleChange}
              placeholder="Dosage"
              required
              className="rounded border px-3 py-2"
            />
            <input
              name="time"
              value={form.time}
              onChange={handleChange}
              placeholder="Time (e.g. 9:00 AM)"
              required
              className="rounded border px-3 py-2"
            />
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </form>
      )}
      <div>
        {loading ? (
          <div>Loading medicines...</div>
        ) : medicines.length === 0 ? (
          <div className="text-slate-500">No medicines scheduled.</div>
        ) : (
          medicines.map((med) => (
            <MedicineCard key={med.id || med._id || med.name} medicine={med} onMarkTaken={onMarkTaken} />
          ))
        )}
      </div>
    </div>
  );
}
