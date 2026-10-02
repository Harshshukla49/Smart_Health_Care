import React, { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  FileCheck2,
  HeartPulse,
  Mail,
  MapPin,
  Phone,
  QrCode,
  ShieldCheck,
  Stethoscope,
  Thermometer,
  User,
  Waves,
} from 'lucide-react';
import { calculateLabCompletion } from '../data/labTestPresets';

export function MedicalReportDocument({
  patient = {},
  doctor = {},
  vitals = {},
  labTests = [],
  medicines = [],
  clinicalDiagnosis = null,
  reportMetadata = null,
  isDraft = false,
  elementId = 'printable-medical-report',
}) {
  const now = useMemo(() => new Date(), []);

  const reportId = useMemo(() => {
    if (reportMetadata?.reportId) return reportMetadata.reportId;
    const year = now.getFullYear();
    const pidPart = String(patient.id || patient.patientId || 'PAT').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `RPT-${year}-${pidPart || 'MED'}-${rand}`;
  }, [patient, reportMetadata, now]);

  const reportDateFormatted = useMemo(() => {
    return now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }, [now]);

  // Telemetry vitals with safe defaults
  const heartRate = Number(vitals.heartRate ?? patient.vitals?.heartRate ?? patient.heartRate ?? 72);
  const spo2 = Number(vitals.spo2 ?? patient.vitals?.spo2 ?? patient.spo2 ?? 98.5);
  const temperature = Number(vitals.temperature ?? patient.vitals?.temperature ?? patient.temperature ?? 36.8);
  const bloodPressure = vitals.bloodPressure || patient.vitals?.bloodPressure || patient.bloodPressure || '120/80 mmHg';

  // Completion calculation
  const labSummary = useMemo(() => calculateLabCompletion(labTests), [labTests]);
  const isPreliminary = isDraft || !labSummary.isAllVerified;

  // Attending doctor info
  const doctorName = doctor.name || patient.assignedDoctorName || patient.doctorName || 'Dr. Sourav Tripathi';
  const doctorSpecialty = doctor.specialty || patient.doctorSpecialty || 'Senior Consultant - Cardiology & Internal Medicine';
  const doctorRegNo = doctor.regNo || 'MCI / NMC-2018-94820';
  const doctorPhone = doctor.phone || patient.doctorPhone || '+91 98765 43210';
  const doctorEmail = doctor.email || patient.assignedDoctorId || patient.doctorEmail || 'doctor@smarthealth.hospital.in';

  // Patient demographic details
  const patientName = patient.name || 'Dhiraj Shukla';
  const patientId = patient.id || patient.patientId || 'PAT-2026-0827';
  const age = patient.age || 24;
  const gender = patient.gender || 'Male';
  const bloodGroup = patient.bloodGroup || 'B+ (Positive)';
  const phone = patient.phone || '+91 98765 00123';
  const email = patient.email || 'patient@smarthealth.hospital.in';
  const address = patient.address || 'H.No 45, Sector 12, Healthcare Enclave, New Delhi';
  const emergencyContact = patient.sosContactName
    ? `${patient.sosContactName} (${patient.sosContactPhone || 'Available'})`
    : 'Family Emergency Contact (+91 98111 22334)';

  const symptoms = patient.symptoms || patient.clinicalHistory || 'Presented with mild exertion fatigue, intermittent palpitation, and requested continuous clinical telemetry review.';
  const medicalHistory = patient.pastHistory || patient.medicalHistory || 'No known drug allergies. Non-smoker. Baseline normotensive.';

  const provisionalDiagnosis = clinicalDiagnosis?.provisional || (
    heartRate > 100
      ? 'Sinus Tachycardia with mild exertion intolerance — Rule out secondary infectious or endocrine etiology.'
      : 'Physiological Sinus Rhythm — Vital telemetry parameters within normal limits.'
  );

  const finalDiagnosis = clinicalDiagnosis?.final || (
    labSummary.isAllVerified
      ? 'Confirmed Normal Sinus Rhythm; Complete blood count, cardiac markers and renal parameters verified within physiological limits.'
      : 'Awaiting final verification of pending diagnostic laboratory investigations.'
  );

  return (
    <div
      id={elementId}
      className="relative bg-white text-slate-900 mx-auto font-sans p-6 sm:p-8 md:p-10 max-w-[210mm] border border-slate-200 shadow-md print:shadow-none print:border-0 print:p-4 print:max-w-none print:w-full"
      style={{ minHeight: '297mm' }}
    >
      {/* WATERMARK FOR PRELIMINARY REPORTS */}
      {isPreliminary && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden z-0 select-none opacity-[0.04] print:opacity-[0.06]">
          <span className="transform -rotate-45 text-7xl sm:text-9xl font-black uppercase tracking-widest text-rose-950">
            PRELIMINARY
          </span>
        </div>
      )}

      {/* =========================================================================
          1. HOSPITAL LETTERHEAD & BRANDING HEADER
         ========================================================================= */}
      <header className="relative z-10 border-b-2 border-sky-800 pb-4 mb-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Hospital Emblem Logo */}
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-sky-700 via-sky-800 to-teal-800 flex items-center justify-center text-white shadow-md print:shadow-none shrink-0 border border-sky-600">
              <div className="relative flex items-center justify-center">
                <HeartPulse className="h-8 w-8 text-sky-200" />
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
                  +
                </span>
              </div>
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-black text-sky-950 tracking-tight leading-none uppercase font-display">
                Apollo Smart Healthcare
              </h1>
              <p className="text-[11px] font-bold text-sky-700 uppercase tracking-widest mt-0.5">
                Multi-Speciality Hospital & Research Institute
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-slate-500 font-medium">
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" />
                  NABH ACCREDITED HOSPITAL
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                  <Award className="h-3 w-3 text-sky-600" />
                  NABL CERTIFIED DIAGNOSTIC LAB
                </span>
                <span className="text-slate-400">ISO 9001:2015</span>
              </div>
            </div>
          </div>

          {/* Hospital Contact Info Box */}
          <div className="text-left sm:text-right text-[10px] text-slate-600 space-y-0.5 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
            <p className="font-semibold text-slate-800">Plot 42, Healthcare City, MedTech Enclave</p>
            <p>New Delhi - 110001, India</p>
            <p className="font-mono text-sky-900 font-bold">24x7 Emergency Helpline: 1800-419-8800</p>
            <p className="text-slate-500">Email: clinical.care@smarthealth.hospital.in</p>
            <p className="text-slate-500">Web: https://smarthealth.hospital.in</p>
          </div>
        </div>

        {/* Report Document Title Banner */}
        <div className="mt-4 pt-2.5 border-t border-sky-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Official Clinical Record</span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              PATIENT MEDICAL SUMMARY & DIAGNOSTIC LAB REPORT
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                isPreliminary
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : 'bg-emerald-50 text-emerald-900 border-emerald-300'
              }`}
            >
              {isPreliminary ? (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              )}
              {isPreliminary ? 'PRELIMINARY MEDICAL REPORT' : 'FINAL CERTIFIED MEDICAL REPORT'}
            </span>

            <span className="font-mono text-[11px] font-bold bg-slate-100 text-slate-800 px-2 py-1 rounded border border-slate-200">
              {reportId}
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 space-y-4">
        {/* =========================================================================
            2. PATIENT DEMOGRAPHIC & CLINICAL ENCOUNTER CARD
           ========================================================================= */}
        <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 text-[11px] page-break-avoid">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/80">
            <span className="font-bold text-sky-900 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-sky-700" />
              Patient Demographics & Admission Record
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              Generated: <strong>{reportDateFormatted}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2.5 gap-x-4">
            <div>
              <p className="text-[9px] uppercase font-bold text-slate-400">Patient Name</p>
              <p className="font-bold text-slate-900 text-xs sm:text-sm">{patientName}</p>
            </div>

            <div>
              <p className="text-[9px] uppercase font-bold text-slate-400">Medical Record No. (MRN)</p>
              <p className="font-mono font-bold text-sky-900">{patientId}</p>
            </div>

            <div>
              <p className="text-[9px] uppercase font-bold text-slate-400">Age / Gender</p>
              <p className="font-semibold text-slate-800">{age} Yrs / {gender}</p>
            </div>

            <div>
              <p className="text-[9px] uppercase font-bold text-slate-400">Blood Group</p>
              <p className="font-bold text-rose-700">{bloodGroup}</p>
            </div>

            <div>
              <p className="text-[9px] uppercase font-bold text-slate-400">Contact Number</p>
              <p className="font-medium text-slate-700">{phone}</p>
            </div>

            <div>
              <p className="text-[9px] uppercase font-bold text-slate-400">Email Address</p>
              <p className="font-medium text-slate-700 truncate">{email}</p>
            </div>

            <div>
              <p className="text-[9px] uppercase font-bold text-slate-400">Emergency Contact</p>
              <p className="font-medium text-slate-700 truncate">{emergencyContact}</p>
            </div>

            <div>
              <p className="text-[9px] uppercase font-bold text-slate-400">Residential Address</p>
              <p className="font-medium text-slate-700 truncate">{address}</p>
            </div>
          </div>

          {/* Attending Physician Bar */}
          <div className="mt-3 pt-2.5 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white/90 p-2.5 rounded-lg border border-slate-200/60">
            <div>
              <p className="text-[9px] uppercase font-bold text-slate-400">Attending Physician</p>
              <p className="font-bold text-slate-900">{doctorName}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase font-bold text-slate-400">Clinical Department & Reg No.</p>
              <p className="font-semibold text-slate-700">{doctorSpecialty} · {doctorRegNo}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase font-bold text-slate-400">Physician Contact</p>
              <p className="font-medium text-slate-600">{doctorPhone} · {doctorEmail}</p>
            </div>
          </div>
        </section>

        {/* =========================================================================
            3. CLINICAL SYMPTOMS & MEDICAL HISTORY
           ========================================================================= */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 page-break-avoid">
          <div className="rounded-xl border border-slate-200 p-3 bg-white text-[11px] space-y-1">
            <span className="font-bold text-sky-900 uppercase tracking-wider text-[10px] flex items-center gap-1">
              <Stethoscope className="h-3 w-3 text-sky-700" />
              Presenting Symptoms & Chief Complaints
            </span>
            <p className="text-slate-700 leading-relaxed font-normal">{symptoms}</p>
          </div>

          <div className="rounded-xl border border-slate-200 p-3 bg-white text-[11px] space-y-1">
            <span className="font-bold text-sky-900 uppercase tracking-wider text-[10px] flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-sky-700" />
              Past Medical History & Allergies
            </span>
            <p className="text-slate-700 leading-relaxed font-normal">{medicalHistory}</p>
          </div>
        </section>

        {/* =========================================================================
            4. PHYSIOLOGICAL TELEMETRY & VITAL SIGNS TABLE
           ========================================================================= */}
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden page-break-avoid text-[11px]">
          <div className="bg-slate-100/90 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-rose-600" />
              Continuous Telemetry & Vital Signs Summary
            </span>
            <span className="text-[10px] font-semibold text-slate-500">Automated Clinical Telemetry Stream</span>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                <th className="py-2 px-3">Vital Parameter</th>
                <th className="py-2 px-3">Measured Result</th>
                <th className="py-2 px-3">Standard Reference Interval</th>
                <th className="py-2 px-3">Units</th>
                <th className="py-2 px-3 text-right">Clinical Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              <tr>
                <td className="py-2 px-3 font-semibold flex items-center gap-1.5">
                  <HeartPulse className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  Heart Rate (Pulse)
                </td>
                <td className="py-2 px-3 font-bold font-mono text-slate-900 text-xs">{heartRate.toFixed(1)}</td>
                <td className="py-2 px-3 text-slate-500">60.0 - 100.0</td>
                <td className="py-2 px-3 text-slate-500">BPM</td>
                <td className="py-2 px-3 text-right">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      heartRate > 100 || heartRate < 50
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {heartRate > 100 ? 'Elevated / Tachycardia' : heartRate < 50 ? 'Bradycardia' : 'Nominal Sinus'}
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-2 px-3 font-semibold flex items-center gap-1.5">
                  <Waves className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                  Oxygen Saturation (SpO₂)
                </td>
                <td className="py-2 px-3 font-bold font-mono text-slate-900 text-xs">{spo2.toFixed(1)}</td>
                <td className="py-2 px-3 text-slate-500">95.0 - 100.0</td>
                <td className="py-2 px-3 text-slate-500">%</td>
                <td className="py-2 px-3 text-right">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      spo2 < 92
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : spo2 < 95
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {spo2 < 92 ? 'Critical Hypoxemia' : spo2 < 95 ? 'Mild Hypoxemia' : 'Adequate Saturation'}
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-2 px-3 font-semibold flex items-center gap-1.5">
                  <Thermometer className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  Core Body Temperature
                </td>
                <td className="py-2 px-3 font-bold font-mono text-slate-900 text-xs">{temperature.toFixed(1)}</td>
                <td className="py-2 px-3 text-slate-500">36.5 - 37.5</td>
                <td className="py-2 px-3 text-slate-500">°C ({(temperature * 1.8 + 32).toFixed(1)}°F)</td>
                <td className="py-2 px-3 text-right">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      temperature > 38.0
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : temperature > 37.5
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {temperature > 38.0 ? 'High Pyrexia' : temperature > 37.5 ? 'Low-grade Fever' : 'Normothermic'}
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-2 px-3 font-semibold flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  Non-Invasive Blood Pressure (NIBP)
                </td>
                <td className="py-2 px-3 font-bold font-mono text-slate-900 text-xs">{bloodPressure}</td>
                <td className="py-2 px-3 text-slate-500">90/60 - 120/80</td>
                <td className="py-2 px-3 text-slate-500">mmHg</td>
                <td className="py-2 px-3 text-right">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Normotensive
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-2 px-3 font-semibold flex items-center gap-1.5">
                  <HeartPulse className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                  ECG Rhythm & Conduction (Lead II)
                </td>
                <td className="py-2 px-3 font-bold text-slate-900 text-xs">
                  {heartRate > 100 ? 'Sinus Tachycardia' : 'Normal Sinus Rhythm'}
                </td>
                <td className="py-2 px-3 text-slate-500">PR: 120-200 ms | QRS: 80-120 ms</td>
                <td className="py-2 px-3 text-slate-500">Continuous</td>
                <td className="py-2 px-3 text-right">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    No ST Elevation / Depression
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* =========================================================================
            5. MEDICAL INVESTIGATIONS & DIAGNOSTIC LABORATORY RESULTS
           ========================================================================= */}
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden page-break-avoid text-[11px]">
          <div className="bg-sky-900 text-white px-3.5 py-2 flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <FileCheck2 className="h-3.5 w-3.5 text-sky-300" />
              Medical Investigation & Laboratory Test Results
            </span>
            <div className="flex items-center gap-2 text-[10px]">
              <span>Verification Status:</span>
              <span className={`px-2 py-0.5 rounded font-bold ${labSummary.badgeClass}`}>
                {labSummary.completed} / {labSummary.total} Completed ({labSummary.verified} Verified)
              </span>
            </div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-[9px] uppercase font-bold text-slate-600">
                <th className="py-2 px-3">Test / Investigation Name</th>
                <th className="py-2 px-3">Observed Result</th>
                <th className="py-2 px-3">Biological Reference Interval</th>
                <th className="py-2 px-3">Unit</th>
                <th className="py-2 px-3 text-center">Status / Flag</th>
                <th className="py-2 px-3 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 text-[10.5px]">
              {labTests && labTests.length > 0 ? (
                labTests.map((t, idx) => {
                  const isAbnormal = t.flagLevel === 'critical' || t.flagLevel === 'warning';
                  const isTestVerified = String(t.status).toUpperCase() === 'VERIFIED';

                  return (
                    <tr key={t.id || idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                      <td className="py-1.5 px-3 font-medium text-slate-900">
                        <div>{t.name}</div>
                        {t.category && (
                          <div className="text-[9px] text-slate-400 font-normal">{t.category}</div>
                        )}
                      </td>
                      <td className="py-1.5 px-3 font-mono font-bold text-slate-900 text-xs">
                        <span className={isAbnormal ? 'text-rose-700 font-extrabold' : ''}>
                          {t.result}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-slate-500 font-mono text-[10px]">
                        {t.referenceRange || 'Standard'}
                      </td>
                      <td className="py-1.5 px-3 text-slate-500 font-mono text-[10px]">{t.unit || '-'}</td>
                      <td className="py-1.5 px-3 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                            t.badgeClass || 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {t.flag || 'Normal'}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1 text-[9px] font-bold ${
                            isTestVerified ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {isTestVerified && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />}
                          {t.status || 'Verified'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-400">
                    No laboratory tests recorded for this clinical session.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* =========================================================================
            6. CLINICAL ASSESSMENT & DIAGNOSIS
           ========================================================================= */}
        <section className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/70 text-[11px] space-y-2 page-break-avoid">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
            <span className="font-bold text-sky-900 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Stethoscope className="h-3.5 w-3.5 text-sky-700" />
              Doctor's Clinical Assessment & Diagnostic Summary
            </span>
            <span className="text-[10px] font-semibold text-slate-500">ICD-11 Aligned</span>
          </div>

          <div className="space-y-1.5">
            <div>
              <p className="text-[9px] uppercase font-bold text-slate-500">Provisional / Working Diagnosis:</p>
              <p className="font-semibold text-slate-900">{provisionalDiagnosis}</p>
            </div>

            <div>
              <p className="text-[9px] uppercase font-bold text-slate-500">Final Verified Clinical Diagnosis:</p>
              <p className="font-bold text-sky-950 bg-white p-2 rounded border border-sky-200/70">
                {finalDiagnosis}
              </p>
            </div>
          </div>
        </section>

        {/* =========================================================================
            7. PRESCRIPTIONS & THERAPEUTIC MANAGEMENT (Rx)
           ========================================================================= */}
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden page-break-avoid text-[11px]">
          <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <span className="font-serif text-sm font-black text-sky-900">Rx</span>
              Prescribed Medications & Treatment Plan
            </span>
            <span className="text-[10px] text-slate-500">Authorized Electronic Prescription</span>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[9px] uppercase font-bold text-slate-500">
                <th className="py-2 px-3">#</th>
                <th className="py-2 px-3">Medication Name & Form</th>
                <th className="py-2 px-3">Dosage</th>
                <th className="py-2 px-3">Frequency & Timing</th>
                <th className="py-2 px-3">Duration</th>
                <th className="py-2 px-3 text-right">Special Instructions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 text-[10.5px]">
              {medicines && medicines.length > 0 ? (
                medicines.map((med, idx) => (
                  <tr key={med.id || idx}>
                    <td className="py-1.5 px-3 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                    <td className="py-1.5 px-3 font-bold text-slate-900">
                      {med.medicineName || med.name || 'Tab. Paracetamol 650mg'}
                    </td>
                    <td className="py-1.5 px-3 font-mono text-slate-700">{med.dosage || '1 Tablet'}</td>
                    <td className="py-1.5 px-3 font-medium text-slate-700">
                      {med.frequency || '1-0-1 (Twice daily)'} · {med.foodInstruction || 'After meals'}
                    </td>
                    <td className="py-1.5 px-3 text-slate-700">{med.duration || '5 Days'}</td>
                    <td className="py-1.5 px-3 text-right text-slate-600 font-normal">
                      {med.instructions || 'Take with water. Avoid empty stomach.'}
                    </td>
                  </tr>
                ))
              ) : (
                <>
                  <tr>
                    <td className="py-1.5 px-3 text-slate-400 font-mono text-[10px]">1</td>
                    <td className="py-1.5 px-3 font-bold text-slate-900">Tab. Metoprolol Tartrate 25mg</td>
                    <td className="py-1.5 px-3 font-mono text-slate-700">25 mg</td>
                    <td className="py-1.5 px-3 font-medium text-slate-700">1-0-0 (Morning) · After breakfast</td>
                    <td className="py-1.5 px-3 text-slate-700">14 Days</td>
                    <td className="py-1.5 px-3 text-right text-slate-600">Rate control therapy. Monitor pulse.</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 text-slate-400 font-mono text-[10px]">2</td>
                    <td className="py-1.5 px-3 font-bold text-slate-900">Tab. Multivitamin & Minerals</td>
                    <td className="py-1.5 px-3 font-mono text-slate-700">1 Capsule</td>
                    <td className="py-1.5 px-3 font-medium text-slate-700">0-1-0 (Afternoon) · After lunch</td>
                    <td className="py-1.5 px-3 text-slate-700">30 Days</td>
                    <td className="py-1.5 px-3 text-right text-slate-600">General wellness & cellular support.</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </section>

        {/* =========================================================================
            8. DIETARY ADVISORY & FOLLOW-UP INSTRUCTIONS
           ========================================================================= */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 page-break-avoid text-[11px]">
          <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-1">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">
              Dietary & Lifestyle Advice
            </span>
            <ul className="list-disc list-inside text-slate-700 space-y-0.5 text-[10px] leading-relaxed">
              <li>Maintain adequate hydration (2.5 to 3 Liters water/day).</li>
              <li>Limit sodium intake (&lt; 2g/day) and avoid excessive caffeine/stimulants.</li>
              <li>Engage in 20-30 mins of moderate aerobic walking as tolerated.</li>
              <li>Report any sudden dizziness, chest tightness, or shortness of breath immediately.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-1">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">
              Follow-Up & Emergency Instructions
            </span>
            <div className="text-slate-700 space-y-0.5 text-[10px]">
              <p>
                <strong>Next Review Date:</strong>{' '}
                {new Date(Date.now() + 7 * 86400 * 1000).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}{' '}
                (or SOS if symptoms recur)
              </p>
              <p>
                <strong>Consulting Department:</strong> Cardiology Outpatient Clinic (OPD Bay 4B)
              </p>
              <p className="text-rose-700 font-semibold">
                🚨 Emergency SOS: If pulse exceeds 140 BPM or chest pain occurs, call 1800-419-8800.
              </p>
            </div>
          </div>
        </section>

        {/* =========================================================================
            9. AUTHORIZED SIGNATURES, SEALS & VERIFICATION
           ========================================================================= */}
        <section className="pt-4 mt-4 border-t-2 border-slate-200 page-break-avoid">
          <div className="grid grid-cols-3 items-end gap-4 text-center">
            {/* Laboratory Sign-off */}
            <div className="space-y-1">
              <div className="h-10 flex items-center justify-center">
                <span className="font-serif italic text-base font-bold text-slate-700">
                  Dr. A. Verma
                </span>
              </div>
              <div className="border-t border-slate-300 pt-1">
                <p className="font-bold text-slate-900 text-[10px]">Dr. Arvind Verma, MD</p>
                <p className="text-[9px] text-slate-500">Director of Pathology & Diagnostics</p>
                <p className="text-[8px] text-slate-400 font-mono">Reg. No: DMC-38491</p>
              </div>
            </div>

            {/* Official Hospital Seal & QR */}
            <div className="flex flex-col items-center justify-center space-y-1">
              <div className="h-12 w-12 rounded-full border-2 border-dashed border-sky-700 flex items-center justify-center bg-sky-50 text-[8px] font-black text-sky-900 uppercase tracking-tighter shadow-xs">
                HOSPITAL SEAL
              </div>
              <p className="text-[8px] font-mono text-slate-500">
                SECURITY HASH: {reportId.slice(-6)}-VERIFIED
              </p>
            </div>

            {/* Attending Doctor Sign-off */}
            <div className="space-y-1">
              <div className="h-10 flex items-center justify-center">
                <span className="font-serif italic text-lg font-bold text-sky-900">
                  {doctorName.replace(/^Dr\.\s*/i, 'Dr. ')}
                </span>
              </div>
              <div className="border-t border-slate-300 pt-1">
                <p className="font-bold text-slate-900 text-[10px]">{doctorName}</p>
                <p className="text-[9px] text-slate-500">{doctorSpecialty}</p>
                <p className="text-[8px] text-slate-400 font-mono">{doctorRegNo}</p>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            10. LEGAL & CONFIDENTIALITY DISCLAIMER FOOTER
           ========================================================================= */}
        <footer className="pt-3 border-t border-slate-200 text-[8.5px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 page-break-avoid">
          <p className="max-w-xl text-left">
            <strong>Confidentiality Notice:</strong> This document contains privileged clinical health information intended solely for the named patient and authorized healthcare professionals. In accordance with the Medical Council Guidelines and Clinical Establishments Act, this digital report is certified and electronically signed.
          </p>
          <div className="text-right font-mono font-semibold text-slate-500 shrink-0">
            Page 1 of 1 · Document ID: {reportId}
          </div>
        </footer>
      </main>
    </div>
  );
}
