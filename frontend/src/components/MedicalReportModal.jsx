import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileText,
  History,
  Layers,
  Printer,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MedicalReportDocument } from './MedicalReportDocument';
import { calculateLabCompletion, generateRealisticLabResults } from '../data/labTestPresets';
import { downloadMedicalReportPdf, printMedicalReport } from '../utils/medicalReportPdf';
import { getAuthSession } from '../utils/auth';

export function MedicalReportModal({
  isOpen,
  onClose,
  patient = {},
  doctor = {},
  vitals = {},
  medicines = [],
  clinicalDiagnosis = null,
  initialTab = 'preview', // 'preview' | 'tests' | 'history'
}) {
  const session = getAuthSession();
  const isDoctor = session?.role === 'doctor';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [labTests, setLabTests] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [isDraftMode, setIsDraftMode] = useState(false);
  const [reportHistory, setReportHistory] = useState([]);
  const [testFilter, setTestFilter] = useState('all'); // 'all' | 'verified' | 'pending' | 'abnormal'

  // Initialize or re-generate lab tests when patient changes
  useEffect(() => {
    if (patient && isOpen) {
      const generated = generateRealisticLabResults(patient);
      setLabTests(generated);

      // Load previous local reports history
      try {
        const histKey = `medical_reports_hist:${patient.id || patient.patientId || 'default'}`;
        const stored = localStorage.getItem(histKey);
        if (stored) {
          setReportHistory(JSON.parse(stored));
        } else {
          // Initialize with current session entry
          const initialRecord = {
            reportId: `RPT-${new Date().getFullYear()}-${String(patient.id || 'PAT').slice(-4).toUpperCase()}-1042`,
            timestamp: new Date().toLocaleString(),
            type: 'FINAL_CERTIFIED',
            doctorName: doctor?.name || patient?.assignedDoctorName || 'Dr. Sourav Tripathi',
            status: 'Verified',
          };
          setReportHistory([initialRecord]);
          localStorage.setItem(histKey, JSON.stringify([initialRecord]));
        }
      } catch {
        // silent
      }
    }
  }, [patient, isOpen, doctor]);

  const labSummary = useMemo(() => calculateLabCompletion(labTests), [labTests]);

  if (!isOpen) return null;

  const patientName = patient?.name || 'Patient';
  const patientId = patient?.id || patient?.patientId || 'PAT-001';

  // Toggle single test verification
  const handleToggleTestVerification = (testId) => {
    setLabTests((prev) =>
      prev.map((t) => {
        if (t.id === testId) {
          const isCurrentlyVerified = String(t.status).toUpperCase() === 'VERIFIED';
          return {
            ...t,
            status: isCurrentlyVerified ? 'COMPLETED' : 'VERIFIED',
          };
        }
        return t;
      })
    );
  };

  // Batch verify all tests
  const handleVerifyAllTests = () => {
    setLabTests((prev) =>
      prev.map((t) => ({
        ...t,
        status: 'VERIFIED',
      }))
    );
    toast.success('All laboratory diagnostic tests marked as VERIFIED.');
  };

  // Mark all tests as pending (to simulate incomplete test workflow)
  const handleMarkTestsPending = () => {
    setLabTests((prev) =>
      prev.map((t, idx) => ({
        ...t,
        status: idx < 3 ? 'VERIFIED' : idx < 8 ? 'IN_PROGRESS' : 'PENDING',
      }))
    );
    toast('Switched to Preliminary workflow (some tests pending).', { icon: '⚠️' });
  };

  // Handle PDF Download
  const handleDownloadPdf = async () => {
    setDownloading(true);
    const toastId = toast.loading('Generating authentic Medical Report PDF...');
    try {
      const fileName = `${patientName.replace(/\s+/g, '_')}_Medical_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      await downloadMedicalReportPdf('modal-medical-report-doc', fileName);
      toast.success('Medical Report PDF downloaded successfully!', { id: toastId });

      // Append to local report history
      const newEntry = {
        reportId: `RPT-${new Date().getFullYear()}-${String(patientId).slice(-4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: new Date().toLocaleString(),
        type: labSummary.reportType,
        doctorName: doctor?.name || patient?.assignedDoctorName || 'Dr. Sourav Tripathi',
        status: labSummary.isAllVerified ? 'Verified' : 'Preliminary',
      };
      const updatedHist = [newEntry, ...reportHistory.slice(0, 9)];
      setReportHistory(updatedHist);
      try {
        localStorage.setItem(`medical_reports_hist:${patientId}`, JSON.stringify(updatedHist));
      } catch {
        // silent
      }
    } catch (err) {
      toast.error(`Failed to generate PDF: ${err.message}`, { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  // Handle Print
  const handlePrint = () => {
    setPrinting(true);
    toast.success('Opening print dialog for Patient Medical Report...');
    try {
      printMedicalReport('modal-medical-report-doc');
    } catch (err) {
      window.print();
    } finally {
      setTimeout(() => setPrinting(false), 800);
    }
  };

  // Filtered lab tests
  const filteredTests = useMemo(() => {
    if (testFilter === 'verified') return labTests.filter((t) => String(t.status).toUpperCase() === 'VERIFIED');
    if (testFilter === 'pending') return labTests.filter((t) => String(t.status).toUpperCase() !== 'VERIFIED');
    if (testFilter === 'abnormal') return labTests.filter((t) => t.flagLevel === 'critical' || t.flagLevel === 'warning');
    return labTests;
  }, [labTests, testFilter]);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-5xl bg-slate-100 rounded-2xl shadow-2xl border border-slate-300 flex flex-col max-h-[94vh] overflow-hidden my-auto">
        {/* =========================================================
            1. MODAL TOP CONTROL BAR
           ========================================================= */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-sky-600 flex items-center justify-center text-white shadow-xs">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Hospital Medical Report
                </h3>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                    labSummary.isAllVerified
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {labSummary.isAllVerified ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 text-amber-400" />
                  )}
                  {labSummary.isAllVerified ? 'Certified Final' : 'Preliminary / Tests Incomplete'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Patient: <strong className="text-white">{patientName}</strong> ({patientId})
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-95 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition disabled:opacity-50"
              title="Download High-Resolution Medical PDF"
            >
              <Download className="h-4 w-4" />
              <span>{downloading ? 'Exporting...' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={printing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 active:scale-95 px-3.5 py-2 text-xs font-bold text-slate-200 shadow-xs transition"
              title="Print Clinical Summary Report"
            >
              <Printer className="h-4 w-4" />
              <span>Print Report</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* =========================================================
            2. MODAL TAB NAVIGATION & TEST COMPLETION STATUS BAR
           ========================================================= */}
        <div className="bg-white border-b border-slate-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'preview'
                  ? 'bg-sky-50 text-sky-800 border border-sky-200 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Eye className="h-3.5 w-3.5 text-sky-600" />
              <span>Report Document Preview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tests')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'tests'
                  ? 'bg-sky-50 text-sky-800 border border-sky-200 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-sky-600" />
              <span>
                Lab Tests & Verification ({labSummary.verified}/{labSummary.total})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'history'
                  ? 'bg-sky-50 text-sky-800 border border-sky-200 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <History className="h-3.5 w-3.5 text-sky-600" />
              <span>Report History</span>
            </button>
          </div>

          {/* Test Completion Pill / Progress */}
          <div className="flex items-center gap-3 text-xs">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500">Test Completion:</span>
              <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    labSummary.isAllVerified
                      ? 'bg-emerald-500'
                      : labSummary.isAllCompleted
                      ? 'bg-sky-500'
                      : 'bg-amber-500'
                  }`}
                  style={{ width: `${labSummary.percentage}%` }}
                />
              </div>
              <span className="font-bold text-slate-800 text-[11px]">{labSummary.percentage}%</span>
            </div>

            {isDoctor && (
              <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                <button
                  type="button"
                  onClick={handleVerifyAllTests}
                  className="inline-flex items-center gap-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2 py-1 text-[11px] font-bold border border-emerald-200 transition"
                  title="Verify all completed lab tests"
                >
                  <Check className="h-3 w-3" />
                  Verify All
                </button>

                <button
                  type="button"
                  onClick={handleMarkTestsPending}
                  className="rounded bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 text-[11px] font-semibold transition"
                  title="Toggle some tests as pending"
                >
                  Test Pending Mode
                </button>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================
            3. TAB CONTENT AREA
           ========================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/60">
          {/* TAB 1: DOCUMENT PREVIEW */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              {/* Notice Banner if Preliminary */}
              {!labSummary.isAllVerified && (
                <div className="max-w-[210mm] mx-auto rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-amber-900 text-xs flex items-start gap-3 shadow-xs">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Preliminary Report Notice (Incomplete / Unverified Tests)</p>
                    <p className="text-amber-800">
                      {labSummary.pending > 0
                        ? `${labSummary.pending} required diagnostic investigation(s) are currently in progress or awaiting laboratory verification.`
                        : 'All tests are completed but pending final doctor sign-off verification.'}{' '}
                      The generated document will carry a PRELIMINARY watermark until all investigations are certified.
                    </p>
                  </div>
                </div>
              )}

              {/* The Authentic Hospital Document */}
              <div className="overflow-x-auto pb-4">
                <MedicalReportDocument
                  elementId="modal-medical-report-doc"
                  patient={patient}
                  doctor={doctor}
                  vitals={vitals}
                  labTests={labTests}
                  medicines={medicines}
                  clinicalDiagnosis={clinicalDiagnosis}
                  isDraft={isDraftMode || !labSummary.isAllVerified}
                />
              </div>
            </div>
          )}

          {/* TAB 2: LAB TESTS & VERIFICATION TRACKER */}
          {activeTab === 'tests' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Laboratory Diagnostic Investigations Checklist
                    </h4>
                    <p className="text-xs text-slate-500">
                      Manage observed test results and toggle clinical verification before final report release.
                    </p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setTestFilter('all')}
                      className={`px-2.5 py-1 rounded font-semibold transition ${
                        testFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      All ({labTests.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTestFilter('verified')}
                      className={`px-2.5 py-1 rounded font-semibold transition ${
                        testFilter === 'verified'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      Verified ({labSummary.verified})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTestFilter('pending')}
                      className={`px-2.5 py-1 rounded font-semibold transition ${
                        testFilter === 'pending'
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      Pending ({labSummary.total - labSummary.verified})
                    </button>
                  </div>
                </div>

                {/* Tests Table */}
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                        <th className="py-2 px-3">Investigation Name</th>
                        <th className="py-2 px-3">Result</th>
                        <th className="py-2 px-3">Ref. Range</th>
                        <th className="py-2 px-3">Unit</th>
                        <th className="py-2 px-3">Flag</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {filteredTests.map((test) => {
                        const isVerified = String(test.status).toUpperCase() === 'VERIFIED';
                        return (
                          <tr key={test.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-900">
                              {test.name}
                              <div className="text-[10px] text-slate-400 font-normal">{test.category}</div>
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-900">{test.result}</td>
                            <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{test.referenceRange}</td>
                            <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{test.unit}</td>
                            <td className="py-2 px-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${test.badgeClass}`}>
                                {test.flag}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                                  isVerified ? 'text-emerald-700' : 'text-amber-700'
                                }`}
                              >
                                {isVerified && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                                {test.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              {isDoctor ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleTestVerification(test.id)}
                                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                                    isVerified
                                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  }`}
                                >
                                  {isVerified ? 'Mark Pending' : 'Verify Test'}
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Doctor Only</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: REPORT HISTORY */}
          {activeTab === 'history' && (
            <div className="max-w-3xl mx-auto space-y-3">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <h4 className="text-sm font-bold text-slate-900">Generated Medical Reports History</h4>
                <p className="text-xs text-slate-500 mb-3">
                  Previous verified versions and digital copies generated for {patientName}.
                </p>

                <div className="space-y-2">
                  {reportHistory && reportHistory.length > 0 ? (
                    reportHistory.map((entry, idx) => (
                      <div
                        key={entry.reportId || idx}
                        className="rounded-lg border border-slate-200 p-3 flex items-center justify-between gap-3 hover:border-slate-300 bg-slate-50/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-xs">
                            PDF
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-slate-900">{entry.reportId}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  entry.status === 'Verified'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {entry.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Generated: {entry.timestamp} · Attending: {entry.doctorName}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleDownloadPdf}
                          className="inline-flex items-center gap-1 rounded bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 text-xs font-bold transition shadow-2xs"
                        >
                          <Download className="h-3 w-3" />
                          <span>Download</span>
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-4">No report history recorded.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
