import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Edit2,
  FileText,
  History,
  Pill,
  Plus,
  RotateCcw,
  ShieldCheck,
  Timer,
  User,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createPrescription,
  getMedicationTimeline,
  getPatientAdherence,
  getPatientMedicines,
  markMedicineTaken,
  recordAdherence,
  updatePrescriptionStatus,
} from '../services/api';

export function MedicationManagement({
  patientId,
  role = 'patient',
  doctorInfo = null,
  className = '',
}) {
  const isDoctor = role === 'doctor';
  const [activeSubTab, setActiveSubTab] = useState('schedule'); // 'schedule' | 'prescriptions' | 'adherence' | 'timeline'
  const [medicines, setMedicines] = useState([]);
  const [adherenceData, setAdherenceData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Doctor Prescription Modal State
  const [showPrescribeModal, setShowPrescribeModal] = useState(false);
  const [submittingPrescription, setSubmittingPrescription] = useState(false);
  const [prescriptionForm, setPrescriptionForm] = useState({
    medicineName: '',
    dosage: '',
    frequency: 'Every 8 hours',
    route: 'Oral',
    instructions: 'Take with full glass of water',
    foodInstruction: 'After food',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    duration: '3 days',
    notes: '',
  });

  const loadData = async () => {
    if (!patientId) return;
    setLoading(true);
    setError('');
    try {
      const [medsList, adherenceRes, timelineRes] = await Promise.all([
        getPatientMedicines(patientId),
        getPatientAdherence(patientId),
        getMedicationTimeline(patientId),
      ]);
      setMedicines(medsList);
      setAdherenceData(adherenceRes);
      setTimeline(timelineRes);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to load medication records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  // Handle Mark as Taken / Status change
  const handleMarkDose = async (med, status = 'Taken') => {
    setActionLoadingId(med.id);
    try {
      if (status === 'Taken') {
        await markMedicineTaken(patientId, med.id, true);
        toast.success(`${med.medicineName || med.name} marked as taken.`);
      } else {
        await recordAdherence(patientId, {
          medicationId: med.id,
          medicineName: med.medicineName || med.name,
          dosage: med.dosage,
          status,
        });
        toast.success(`Dose marked as ${status.toLowerCase()}.`);
      }
      await loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update dose status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Doctor status updates (Pause, Discontinue, Complete)
  const handleUpdateStatus = async (medId, newStatus) => {
    if (!isDoctor) return;
    setActionLoadingId(medId);
    try {
      await updatePrescriptionStatus(patientId, medId, newStatus);
      toast.success(`Prescription marked as ${newStatus}.`);
      await loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update prescription.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Doctor Prescribe Submission
  const handlePrescribeSubmit = async (e) => {
    e.preventDefault();
    if (!prescriptionForm.medicineName.trim() || !prescriptionForm.dosage.trim()) {
      toast.error('Medicine name and dosage are required.');
      return;
    }

    setSubmittingPrescription(true);
    try {
      await createPrescription(patientId, prescriptionForm);
      toast.success(`Prescription for ${prescriptionForm.medicineName} created successfully.`);
      setShowPrescribeModal(false);
      setPrescriptionForm({
        medicineName: '',
        dosage: '',
        frequency: 'Every 8 hours',
        route: 'Oral',
        instructions: 'Take with full glass of water',
        foodInstruction: 'After food',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: '',
        duration: '3 days',
        notes: '',
      });
      await loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to create prescription.');
    } finally {
      setSubmittingPrescription(false);
    }
  };

  const activeMedicines = useMemo(() => {
    return medicines.filter((m) => (m.status || 'Active').toLowerCase() === 'active');
  }, [medicines]);

  const historyMedicines = useMemo(() => {
    return medicines.filter((m) => (m.status || 'Active').toLowerCase() !== 'active');
  }, [medicines]);

  const todaySummary = adherenceData?.today || {
    taken: 0,
    pending: activeMedicines.length,
    missed: 0,
    skipped: 0,
    totalScheduled: activeMedicines.length || 1,
    adherenceRate: 100,
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header & Sub-Navigation */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/40 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/50 dark:border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-600 dark:text-blue-400">
              <Pill className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isDoctor ? 'Clinical Prescriptions & Medication Management' : 'My Medications & Daily Doses'}
                </h3>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {activeMedicines.length} Active
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isDoctor
                  ? 'Manage physician prescriptions, regimen adjustments, and monitor adherence'
                  : 'Track prescribed daily regimens, log taken doses, and review treatment history'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {isDoctor && (
              <button
                type="button"
                onClick={() => setShowPrescribeModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
              >
                <Plus className="h-4 w-4" />
                Prescribe Medication
              </button>
            )}
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              title="Refresh Medications"
              className="rounded-xl border border-slate-200 dark:border-white/10 p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 transition"
            >
              <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="mt-4 flex flex-wrap gap-1 border-b border-slate-200/40 dark:border-white/5 pb-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('schedule')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeSubTab === 'schedule'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            Today's Schedule
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('prescriptions')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeSubTab === 'prescriptions'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            Prescription Details ({medicines.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('adherence')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeSubTab === 'adherence'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            Adherence Analytics
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('timeline')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeSubTab === 'timeline'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            Medication Timeline
          </button>
        </div>

        {/* TAB 1: TODAY'S SCHEDULE */}
        {activeSubTab === 'schedule' && (
          <div className="mt-4 space-y-3">
            {activeMedicines.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/10 p-8 text-center text-xs text-slate-500">
                No active medications scheduled for today.
              </div>
            ) : (
              activeMedicines.map((med) => {
                const isTaken = Boolean(med.taken);
                const isLoading = actionLoadingId === med.id;

                return (
                  <div
                    key={med.id}
                    className={`rounded-xl border p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isTaken
                        ? 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10'
                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/60 shadow-xs'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wide">
                          {med.medicineName || med.name}
                        </span>
                        <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                          {med.dosage}
                        </span>
                        <span className="rounded-md bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                          {med.foodInstruction || 'After food'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {med.frequency || 'Daily'}
                        </span>
                        <span>•</span>
                        <span>Route: {med.route || 'Oral'}</span>
                        {med.instructions && (
                          <>
                            <span>•</span>
                            <span className="italic text-slate-600 dark:text-slate-300">{med.instructions}</span>
                          </>
                        )}
                        {med.prescribedByDoctorName && (
                          <>
                            <span>•</span>
                            <span className="text-blue-600 dark:text-blue-300">Prescribed by Dr. {med.prescribedByDoctorName}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {isTaken ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <Check className="h-3.5 w-3.5" />
                            Taken {med.takenAt ? `at ${new Date(med.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleMarkDose(med, 'Pending')}
                            disabled={isLoading}
                            className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                          >
                            Reset
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleMarkDose(med, 'Taken')}
                            disabled={isLoading}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            {isLoading ? 'Saving...' : 'Mark as Taken'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkDose(med, 'Skipped')}
                            disabled={isLoading}
                            className="rounded-xl border border-slate-200 dark:border-white/10 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                          >
                            Skip
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: PRESCRIPTION DETAILS & MANAGEMENT */}
        {activeSubTab === 'prescriptions' && (
          <div className="mt-4 space-y-3">
            {medicines.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/10 p-8 text-center text-xs text-slate-500">
                No prescriptions found for this patient record.
              </div>
            ) : (
              medicines.map((med) => {
                const isMedActive = (med.status || 'Active').toLowerCase() === 'active';
                const isMedPaused = (med.status || '').toLowerCase() === 'paused';
                const isMedCompleted = (med.status || '').toLowerCase() === 'completed';

                return (
                  <div
                    key={med.id}
                    className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-800/60 p-4 shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-slate-900 dark:text-white uppercase tracking-wide">
                            {med.medicineName || med.name}
                          </span>
                          <span className="rounded-md bg-blue-500/10 px-2.5 py-0.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                            {med.dosage}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                              isMedActive
                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : isMedPaused
                                ? 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : isMedCompleted
                                ? 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : 'border-slate-400/20 bg-slate-500/10 text-slate-500'
                            }`}
                          >
                            {med.status || 'Active'}
                          </span>
                        </div>

                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <div>
                            <span className="text-slate-400">Schedule:</span> {med.frequency || 'Daily'} ({med.foodInstruction || 'After food'})
                          </div>
                          <div>
                            <span className="text-slate-400">Route:</span> {med.route || 'Oral'}
                          </div>
                          <div>
                            <span className="text-slate-400">Duration:</span> {med.startDate || 'Start'} {med.endDate ? `to ${med.endDate}` : `(${med.duration || 'Ongoing'})`}
                          </div>
                        </div>

                        {med.instructions && (
                          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                            <strong>Instructions:</strong> {med.instructions}
                          </p>
                        )}
                        {med.notes && (
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 italic">
                            <strong>Clinical Notes:</strong> {med.notes}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-slate-400">
                          Prescribed by: Dr. {med.prescribedByDoctorName || 'Assigned Physician'}
                        </p>
                      </div>

                      {isDoctor && (
                        <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-start">
                          {isMedActive ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(med.id, 'Paused')}
                                className="rounded-lg border border-slate-200 dark:border-white/10 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                Pause
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(med.id, 'Completed')}
                                className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
                              >
                                Complete
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(med.id, 'Discontinued')}
                                className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
                              >
                                Discontinue
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(med.id, 'Active')}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                            >
                              Resume
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 3: ADHERENCE ANALYTICS */}
        {activeSubTab === 'adherence' && (
          <div className="mt-4 space-y-4">
            {/* Today's Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-white/5 p-3.5 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">Adherence Rate</p>
                <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {todaySummary.adherenceRate}%
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {todaySummary.taken} / {todaySummary.totalScheduled} doses
                </p>
              </div>

              <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3.5 text-center">
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Doses Taken</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {todaySummary.taken}
                </p>
                <p className="mt-0.5 text-[11px] text-emerald-600/70 dark:text-emerald-400/70">Completed</p>
              </div>

              <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3.5 text-center">
                <p className="text-xs text-amber-600 dark:text-amber-400">Pending</p>
                <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {todaySummary.pending}
                </p>
                <p className="mt-0.5 text-[11px] text-amber-600/70 dark:text-amber-400/70">Awaiting time</p>
              </div>

              <div className="rounded-xl bg-rose-500/5 border border-rose-500/20 p-3.5 text-center">
                <p className="text-xs text-rose-600 dark:text-rose-400">Missed / Skipped</p>
                <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">
                  {todaySummary.missed + todaySummary.skipped}
                </p>
                <p className="mt-0.5 text-[11px] text-rose-600/70 dark:text-rose-400/70">Requires follow-up</p>
              </div>
            </div>

            {/* Weekly Adherence Bars */}
            <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-800/60 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                7-Day Weekly Adherence
              </h4>
              <div className="mt-3 grid grid-cols-7 gap-2 text-center">
                {(adherenceData?.weekly || []).map((day, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="h-24 w-full bg-slate-100 dark:bg-slate-700/50 rounded-lg flex items-end p-1">
                      <div
                        className={`w-full rounded-md transition-all ${
                          day.percentage >= 80
                            ? 'bg-emerald-500'
                            : day.percentage >= 50
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ height: `${Math.max(10, day.percentage)}%` }}
                        title={`${day.day}: ${day.percentage}% (${day.taken} doses)`}
                      />
                    </div>
                    <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      {day.day}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      {day.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CLINICAL TIMELINE */}
        {activeSubTab === 'timeline' && (
          <div className="mt-4 space-y-3">
            {timeline.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/10 p-8 text-center text-xs text-slate-500">
                No medication timeline events recorded yet.
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                {timeline.map((event, idx) => {
                  const isDose = event.category === 'adherence';
                  return (
                    <div key={idx} className="relative">
                      <div className={`absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${
                        isDose ? 'bg-emerald-500' : 'bg-blue-500'
                      }`} />
                      <div className="rounded-xl border border-slate-200/60 dark:border-white/5 bg-white dark:bg-slate-800/40 p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {event.title}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {event.timestamp ? new Date(event.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-600 dark:text-slate-300">
                          {event.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* DOCTOR PRESCRIBE MODAL */}
      {showPrescribeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    New Clinical Prescription
                  </h3>
                  <p className="text-xs text-slate-500">
                    Patient ID: {patientId} • Prescribed by Dr. {doctorInfo?.name || 'Physician'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrescribeModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePrescribeSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Medicine Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Paracetamol, Metoprolol"
                    value={prescriptionForm.medicineName}
                    onChange={(e) => setPrescriptionForm({ ...prescriptionForm, medicineName: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2 text-xs text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Dosage *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 500 mg, 25 mcg"
                    value={prescriptionForm.dosage}
                    onChange={(e) => setPrescriptionForm({ ...prescriptionForm, dosage: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2 text-xs text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Frequency
                  </label>
                  <select
                    value={prescriptionForm.frequency}
                    onChange={(e) => setPrescriptionForm({ ...prescriptionForm, frequency: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                  >
                    <option value="Once daily">Once daily (Q24H)</option>
                    <option value="Every 12 hours">Twice daily (Q12H)</option>
                    <option value="Every 8 hours">Every 8 hours (Q8H)</option>
                    <option value="Every 6 hours">Every 6 hours (Q6H)</option>
                    <option value="As needed (PRN)">As needed (PRN)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Route
                  </label>
                  <select
                    value={prescriptionForm.route}
                    onChange={(e) => setPrescriptionForm({ ...prescriptionForm, route: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                  >
                    <option value="Oral">Oral (PO)</option>
                    <option value="Sublingual">Sublingual (SL)</option>
                    <option value="Inhalation">Inhalation</option>
                    <option value="Subcutaneous">Subcutaneous (SC)</option>
                    <option value="Intravenous">Intravenous (IV)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Food Instruction
                  </label>
                  <select
                    value={prescriptionForm.foodInstruction}
                    onChange={(e) => setPrescriptionForm({ ...prescriptionForm, foodInstruction: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                  >
                    <option value="After food">After food</option>
                    <option value="Before food">Before food</option>
                    <option value="With food">With food</option>
                    <option value="No restriction">No restriction</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 3 days, 14 days, Chronic"
                    value={prescriptionForm.duration}
                    onChange={(e) => setPrescriptionForm({ ...prescriptionForm, duration: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2 text-xs text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={prescriptionForm.startDate}
                    onChange={(e) => setPrescriptionForm({ ...prescriptionForm, startDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2 text-xs text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Specific Instructions
                </label>
                <input
                  type="text"
                  placeholder="e.g. Swallow whole with 250ml water. Do not crush."
                  value={prescriptionForm.instructions}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, instructions: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2 text-xs text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Physician Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Clinical notes, diagnostic indications, warning signs..."
                  value={prescriptionForm.notes}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2 text-xs text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowPrescribeModal(false)}
                  className="rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPrescription}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submittingPrescription ? 'Saving...' : 'Authorize Prescription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
