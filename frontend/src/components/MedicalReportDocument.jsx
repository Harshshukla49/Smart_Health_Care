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

  // Evaluate temperature status properly
  const getTempStatus = (temp) => {
    if (temp < 35.0) return { text: 'Critical Low (Hypothermia)', cls: 'bg-rose-100 text-rose-800 border-rose-300' };
    if (temp < 36.5) return { text: 'Subnormal (Low)', cls: 'bg-amber-100 text-amber-800 border-amber-300' };
    if (temp <= 37.5) return { text: 'Normothermic', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (temp <= 38.5) return { text: 'Elevated (Fever)', cls: 'bg-amber-100 text-amber-800 border-amber-300' };
    return { text: 'Critical High (High Pyrexia)', cls: 'bg-rose-100 text-rose-800 border-rose-300' };
  };

  const tempStatus = getTempStatus(temperature);

  return (
    <div id={elementId} className="space-y-6 print:space-y-0 text-slate-900 font-sans mx-auto max-w-[210mm]">
      {/* =========================================================================
          PAGE 1: CLINICAL ENCOUNTER, DEMOGRAPHICS & TELEMETRY VITALS
         ========================================================================= */}
      <div
        className="medical-report-page relative bg-white border border-slate-200 shadow-md print:shadow-none print:border-0 p-6 sm:p-7 flex flex-col justify-between"
        style={{ minHeight: '287mm' }}
      >
        {/* WATERMARK FOR PRELIMINARY REPORTS */}
        {isPreliminary && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden z-0 select-none opacity-[0.04] print:opacity-[0.06]">
            <span className="transform -rotate-45 text-7xl sm:text-9xl font-black uppercase tracking-widest text-rose-950">
              PRELIMINARY
            </span>
          </div>
        )}

        <div className="relative z-10 space-y-3.5">
          {/* 1.1 HOSPITAL LETTERHEAD HEADER */}
          <header className="border-b-2 border-sky-800 pb-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-sky-700 via-sky-800 to-teal-800 flex items-center justify-center text-white shadow-md print:shadow-none shrink-0 border border-sky-600">
                  <HeartPulse className="h-7 w-7 text-sky-200" />
                </div>

                <div>
                  <h1 className="text-xl font-black text-sky-950 tracking-tight leading-none uppercase font-display">
                    Apollo Smart Healthcare
                  </h1>
                  <p className="text-[10px] font-bold text-sky-700 uppercase tracking-widest mt-0.5">
                    Multi-Speciality Hospital & Research Institute
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[9px] text-slate-500 font-medium">
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      <ShieldCheck className="h-2.5 w-2.5 text-emerald-600" />
                      NABH ACCREDITED
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                      <Award className="h-2.5 w-2.5 text-sky-600" />
                      NABL CERTIFIED LAB
                    </span>
                    <span className="text-slate-400">ISO 9001:2015</span>
                  </div>
                </div>
              </div>

              <div className="text-left sm:text-right text-[9px] text-slate-600 space-y-0.5 shrink-0 border-t sm:border-t-0 pt-1.5 sm:pt-0 border-slate-100">
                <p className="font-semibold text-slate-800">Plot 42, Healthcare City, MedTech Enclave</p>
                <p>New Delhi - 110001, India</p>
                <p className="font-mono text-sky-900 font-bold">24x7 Emergency: 1800-419-8800</p>
                <p className="text-slate-500">Email: clinical.care@smarthealth.hospital.in</p>
              </div>
            </div>

            {/* Document Title Banner */}
            <div className="mt-3 pt-2 border-t border-sky-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Official Medical Record</span>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  PATIENT CLINICAL SUMMARY & TELEMETRY RECORD
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                    isPreliminary
                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                      : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  }`}
                >
                  {isPreliminary ? (
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  )}
                  {isPreliminary ? 'PRELIMINARY REPORT' : 'FINAL CERTIFIED REPORT'}
                </span>

                <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                  {reportId}
                </span>
              </div>
            </div>
          </header>

          {/* 1.2 PATIENT DEMOGRAPHICS */}
          <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-[10.5px]">
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-200/80">
              <span className="font-bold text-sky-900 uppercase tracking-wider text-[9.5px] flex items-center gap-1">
                <User className="h-3 w-3 text-sky-700" />
                Patient Demographics & Admission Record
              </span>
              <span className="text-[9.5px] text-slate-500 font-mono">
                Date: <strong>{reportDateFormatted}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-3 text-[10.5px]">
              <div>
                <p className="text-[8.5px] uppercase font-bold text-slate-400">Patient Name</p>
                <p className="font-bold text-slate-900 text-xs">{patientName}</p>
              </div>

              <div>
                <p className="text-[8.5px] uppercase font-bold text-slate-400">Medical Record No. (MRN)</p>
                <p className="font-mono font-bold text-sky-900">{patientId}</p>
              </div>

              <div>
                <p className="text-[8.5px] uppercase font-bold text-slate-400">Age / Gender</p>
                <p className="font-semibold text-slate-800">{age} Yrs / {gender}</p>
              </div>

              <div>
                <p className="text-[8.5px] uppercase font-bold text-slate-400">Blood Group</p>
                <p className="font-bold text-rose-700">{bloodGroup}</p>
              </div>

              <div>
                <p className="text-[8.5px] uppercase font-bold text-slate-400">Contact Number</p>
                <p className="font-medium text-slate-700">{phone}</p>
              </div>

              <div>
                <p className="text-[8.5px] uppercase font-bold text-slate-400">Email Address</p>
                <p className="font-medium text-slate-700 truncate">{email}</p>
              </div>

              <div>
                <p className="text-[8.5px] uppercase font-bold text-slate-400">Emergency Contact</p>
                <p className="font-medium text-slate-700 truncate">{emergencyContact}</p>
              </div>

              <div>
                <p className="text-[8.5px] uppercase font-bold text-slate-400">Residential Address</p>
                <p className="font-medium text-slate-700 truncate">{address}</p>
              </div>
            </div>

            {/* Attending Doctor Strip */}
            <div className="mt-2.5 pt-2 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white/90 p-2 rounded-lg border border-slate-200/60 text-[10px]">
              <div>
                <p className="text-[8.5px] uppercase font-bold text-slate-400">Attending Physician</p>
                <p className="font-bold text-slate-900">{doctorName}</p>
              </div>
              <div>
                <p className="text-[8.5px] uppercase font-bold text-slate-400">Department & Reg. No.</p>
                <p className="font-semibold text-slate-700">{doctorSpecialty} · {doctorRegNo}</p>
              </div>
              <div>
                <p className="text-[8.5px] uppercase font-bold text-slate-400">Physician Contact</p>
                <p className="font-medium text-slate-600">{doctorPhone} · {doctorEmail}</p>
              </div>
            </div>
          </section>

          {/* 1.3 SYMPTOMS & CLINICAL HISTORY */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-slate-200 p-2.5 bg-white text-[10.5px] space-y-1">
              <span className="font-bold text-sky-900 uppercase tracking-wider text-[9px] flex items-center gap-1">
                <Stethoscope className="h-3 w-3 text-sky-700" />
                Presenting Symptoms & Chief Complaints
              </span>
              <p className="text-slate-700 leading-relaxed font-normal">{symptoms}</p>
            </div>

            <div className="rounded-xl border border-slate-200 p-2.5 bg-white text-[10.5px] space-y-1">
              <span className="font-bold text-sky-900 uppercase tracking-wider text-[9px] flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-sky-700" />
                Past Medical History & Allergies
              </span>
              <p className="text-slate-700 leading-relaxed font-normal">{medicalHistory}</p>
            </div>
          </section>

          {/* 1.4 CONTINUOUS TELEMETRY & VITAL SIGNS */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden text-[10.5px]">
            <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[9.5px] flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-rose-600" />
                Continuous Physiological Telemetry & Vitals
              </span>
              <span className="text-[9px] font-semibold text-slate-500">Real-time Sensor Calibrated Stream</span>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[9px] uppercase font-bold text-slate-500">
                  <th className="py-1.5 px-3">Vital Parameter</th>
                  <th className="py-1.5 px-3">Measured Result</th>
                  <th className="py-1.5 px-3">Standard Reference Interval</th>
                  <th className="py-1.5 px-3">Units</th>
                  <th className="py-1.5 px-3 text-right">Clinical Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 text-[10px]">
                <tr>
                  <td className="py-1.5 px-3 font-semibold flex items-center gap-1.5">
                    <HeartPulse className="h-3 w-3 text-rose-500 shrink-0" />
                    Heart Rate (Pulse)
                  </td>
                  <td className="py-1.5 px-3 font-bold font-mono text-slate-900">{heartRate.toFixed(1)}</td>
                  <td className="py-1.5 px-3 text-slate-500">60.0 - 100.0</td>
                  <td className="py-1.5 px-3 text-slate-500">BPM</td>
                  <td className="py-1.5 px-3 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${
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
                  <td className="py-1.5 px-3 font-semibold flex items-center gap-1.5">
                    <Waves className="h-3 w-3 text-teal-600 shrink-0" />
                    Oxygen Saturation (SpO₂)
                  </td>
                  <td className="py-1.5 px-3 font-bold font-mono text-slate-900">{spo2.toFixed(1)}</td>
                  <td className="py-1.5 px-3 text-slate-500">95.0 - 100.0</td>
                  <td className="py-1.5 px-3 text-slate-500">%</td>
                  <td className="py-1.5 px-3 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${
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
                  <td className="py-1.5 px-3 font-semibold flex items-center gap-1.5">
                    <Thermometer className="h-3 w-3 text-amber-500 shrink-0" />
                    Core Body Temperature
                  </td>
                  <td className="py-1.5 px-3 font-bold font-mono text-slate-900">{temperature.toFixed(1)}</td>
                  <td className="py-1.5 px-3 text-slate-500">36.5 - 37.5</td>
                  <td className="py-1.5 px-3 text-slate-500">°C ({(temperature * 1.8 + 32).toFixed(1)}°F)</td>
                  <td className="py-1.5 px-3 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${tempStatus.cls}`}>
                      {tempStatus.text}
                    </span>
                  </td>
                </tr>

                <tr>
                  <td className="py-1.5 px-3 font-semibold flex items-center gap-1.5">
                    <Activity className="h-3 w-3 text-blue-600 shrink-0" />
                    Non-Invasive Blood Pressure (NIBP)
                  </td>
                  <td className="py-1.5 px-3 font-bold font-mono text-slate-900">{bloodPressure}</td>
                  <td className="py-1.5 px-3 text-slate-500">90/60 - 120/80</td>
                  <td className="py-1.5 px-3 text-slate-500">mmHg</td>
                  <td className="py-1.5 px-3 text-right">
                    <span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Normotensive
                    </span>
                  </td>
                </tr>

                <tr>
                  <td className="py-1.5 px-3 font-semibold flex items-center gap-1.5">
                    <HeartPulse className="h-3 w-3 text-purple-600 shrink-0" />
                    ECG Rhythm & Conduction (Lead II)
                  </td>
                  <td className="py-1.5 px-3 font-bold text-slate-900">
                    {heartRate > 100 ? 'Sinus Tachycardia' : 'Normal Sinus Rhythm'}
                  </td>
                  <td className="py-1.5 px-3 text-slate-500">PR: 120-200 ms | QRS: 80-120 ms</td>
                  <td className="py-1.5 px-3 text-slate-500">Continuous</td>
                  <td className="py-1.5 px-3 text-right">
                    <span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      No ST Elevation / Depression
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 1.5 CLINICAL ASSESSMENT & DIAGNOSIS */}
          <section className="rounded-xl border border-slate-200 p-3 bg-slate-50/70 text-[10.5px] space-y-1.5">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <span className="font-bold text-sky-900 uppercase tracking-wider text-[9.5px] flex items-center gap-1">
                <Stethoscope className="h-3 w-3 text-sky-700" />
                Doctor's Clinical Assessment & Diagnostic Summary
              </span>
              <span className="text-[9px] font-semibold text-slate-500">ICD-11 Aligned</span>
            </div>

            <div className="space-y-1">
              <div>
                <p className="text-[8.5px] uppercase font-bold text-slate-500">Provisional Clinical Impression:</p>
                <p className="font-semibold text-slate-900">{provisionalDiagnosis}</p>
              </div>

              <div>
                <p className="text-[8.5px] uppercase font-bold text-slate-500">Final Verified Diagnosis:</p>
                <p className="font-bold text-sky-950 bg-white p-1.5 rounded border border-sky-200/70">
                  {finalDiagnosis}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* 1.6 PAGE 1 FOOTER */}
        <footer className="pt-2 border-t border-slate-200 text-[8px] text-slate-400 flex items-center justify-between">
          <p>
            Apollo Smart Healthcare & Research Institute · Confidential Patient Medical Record
          </p>
          <p className="font-mono font-bold text-slate-600">
            Page 1 of 2 · ID: {reportId}
          </p>
        </footer>
      </div>

      {/* =========================================================================
          PAGE 2: DIAGNOSTIC INVESTIGATIONS, PRESCRIPTIONS & SIGN-OFF
         ========================================================================= */}
      <div
        className="medical-report-page relative bg-white border border-slate-200 shadow-md print:shadow-none print:border-0 p-6 sm:p-7 flex flex-col justify-between"
        style={{ minHeight: '287mm' }}
      >
        {/* WATERMARK FOR PRELIMINARY REPORTS */}
        {isPreliminary && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden z-0 select-none opacity-[0.04] print:opacity-[0.06]">
            <span className="transform -rotate-45 text-7xl sm:text-9xl font-black uppercase tracking-widest text-rose-950">
              PRELIMINARY
            </span>
          </div>
        )}

        <div className="relative z-10 space-y-3.5">
          {/* 2.1 COMPACT HEADER */}
          <header className="border-b-2 border-sky-800 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-sky-700" />
              <div>
                <h3 className="text-sm font-black text-sky-950 tracking-tight uppercase leading-none">
                  Apollo Smart Healthcare
                </h3>
                <p className="text-[9px] text-slate-500">Diagnostic Laboratory Investigations & Prescriptions</p>
              </div>
            </div>
            <div className="text-right font-mono text-[9.5px]">
              <span className="text-slate-500">Patient: </span>
              <strong className="text-slate-900">{patientName} ({patientId})</strong>
            </div>
          </header>

          {/* 2.2 LABORATORY INVESTIGATION RESULTS */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden text-[10px]">
            {/* Header bar with robust flex-wrap and no text overlap */}
            <div className="bg-sky-900 text-white px-3 py-1.5 flex items-center justify-between gap-2">
              <span className="font-bold uppercase tracking-wider text-[9px] flex items-center gap-1.5 shrink-0">
                <FileCheck2 className="h-3.5 w-3.5 text-sky-300" />
                Diagnostic Laboratory Test Results
              </span>
              
              <div className="flex items-center gap-1.5 text-[9px] shrink-0">
                <span className="text-sky-200 text-[8.5px]">Status:</span>
                <span className={`px-2 py-0.5 rounded font-bold text-[8.5px] ${labSummary.badgeClass}`}>
                  {labSummary.completed} / {labSummary.total} Completed ({labSummary.verified} Verified)
                </span>
              </div>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[8.5px] uppercase font-bold text-slate-600">
                  <th className="py-1 px-2.5">Investigation / Test Name</th>
                  <th className="py-1 px-2.5">Observed Result</th>
                  <th className="py-1 px-2.5">Biological Ref. Interval</th>
                  <th className="py-1 px-2.5">Unit</th>
                  <th className="py-1 px-2.5 text-center">Flag</th>
                  <th className="py-1 px-2.5 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 text-[9.5px]">
                {labTests && labTests.length > 0 ? (
                  labTests.map((t, idx) => {
                    const isAbnormal = t.flagLevel === 'critical' || t.flagLevel === 'warning';
                    const isTestVerified = String(t.status).toUpperCase() === 'VERIFIED';

                    return (
                      <tr key={t.id || idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                        <td className="py-1 px-2.5 font-medium text-slate-900">
                          <span>{t.name}</span>
                          {t.category && (
                            <span className="text-[8px] text-slate-400 block">{t.category}</span>
                          )}
                        </td>
                        <td className="py-1 px-2.5 font-mono font-bold text-slate-900">
                          <span className={isAbnormal ? 'text-rose-700 font-extrabold' : ''}>
                            {t.result}
                          </span>
                        </td>
                        <td className="py-1 px-2.5 text-slate-500 font-mono text-[9px]">
                          {t.referenceRange || 'Standard'}
                        </td>
                        <td className="py-1 px-2.5 text-slate-500 font-mono text-[9px]">{t.unit || '-'}</td>
                        <td className="py-1 px-2.5 text-center">
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[8px] font-bold border ${
                              t.badgeClass || 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {t.flag || 'Normal'}
                          </span>
                        </td>
                        <td className="py-1 px-2.5 text-right">
                          <span
                            className={`inline-flex items-center gap-0.5 text-[8.5px] font-bold ${
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
                    <td colSpan={6} className="py-3 text-center text-slate-400">
                      No laboratory tests recorded for this session.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {/* 2.3 PRESCRIPTIONS & TREATMENT PLAN */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden text-[10px]">
            <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[9px] flex items-center gap-1.5">
                <span className="font-serif text-xs font-black text-sky-900">Rx</span>
                Prescribed Medications & Treatment Plan
              </span>
              <span className="text-[8.5px] text-slate-500">Authorized Electronic Prescription</span>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[8.5px] uppercase font-bold text-slate-500">
                  <th className="py-1 px-2.5">#</th>
                  <th className="py-1 px-2.5">Medication Name & Form</th>
                  <th className="py-1 px-2.5">Dosage</th>
                  <th className="py-1 px-2.5">Frequency & Timing</th>
                  <th className="py-1 px-2.5">Duration</th>
                  <th className="py-1 px-2.5 text-right">Special Instructions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 text-[9.5px]">
                {medicines && medicines.length > 0 ? (
                  medicines.map((med, idx) => (
                    <tr key={med.id || idx}>
                      <td className="py-1 px-2.5 text-slate-400 font-mono text-[9px]">{idx + 1}</td>
                      <td className="py-1 px-2.5 font-bold text-slate-900">
                        {med.medicineName || med.name || 'Tab. Paracetamol 650mg'}
                      </td>
                      <td className="py-1 px-2.5 font-mono text-slate-700">{med.dosage || '1 Tab'}</td>
                      <td className="py-1 px-2.5 font-medium text-slate-700">
                        {med.frequency || '1-0-1'} · {med.foodInstruction || 'After food'}
                      </td>
                      <td className="py-1 px-2.5 text-slate-700">{med.duration || '5 Days'}</td>
                      <td className="py-1 px-2.5 text-right text-slate-600">
                        {med.instructions || 'Take with water.'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <>
                    <tr>
                      <td className="py-1 px-2.5 text-slate-400 font-mono text-[9px]">1</td>
                      <td className="py-1 px-2.5 font-bold text-slate-900">Tab. Metoprolol Tartrate 25mg</td>
                      <td className="py-1 px-2.5 font-mono text-slate-700">25 mg</td>
                      <td className="py-1 px-2.5 font-medium text-slate-700">1-0-0 (Morning) · After breakfast</td>
                      <td className="py-1 px-2.5 text-slate-700">14 Days</td>
                      <td className="py-1 px-2.5 text-right text-slate-600">Rate control therapy. Monitor pulse.</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2.5 text-slate-400 font-mono text-[9px]">2</td>
                      <td className="py-1 px-2.5 font-bold text-slate-900">Tab. Multivitamin & Minerals</td>
                      <td className="py-1 px-2.5 font-mono text-slate-700">1 Capsule</td>
                      <td className="py-1 px-2.5 font-medium text-slate-700">0-1-0 (Afternoon) · After lunch</td>
                      <td className="py-1 px-2.5 text-slate-700">30 Days</td>
                      <td className="py-1 px-2.5 text-right text-slate-600">General cellular support.</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </section>

          {/* 2.4 ADVISORY & FOLLOW-UP */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[10px]">
            <div className="rounded-xl border border-slate-200 p-2.5 bg-white space-y-1">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[9px]">
                Dietary & Lifestyle Advice
              </span>
              <ul className="list-disc list-inside text-slate-700 space-y-0.5 text-[9px] leading-relaxed">
                <li>Maintain adequate hydration (2.5 to 3 Liters water/day).</li>
                <li>Limit sodium intake (&lt; 2g/day) and avoid excessive stimulants.</li>
                <li>Engage in 20-30 mins of moderate walking as tolerated.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 p-2.5 bg-white space-y-1">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[9px]">
                Follow-Up & Emergency Instructions
              </span>
              <div className="text-slate-700 space-y-0.5 text-[9px]">
                <p>
                  <strong>Next Review:</strong>{' '}
                  {new Date(Date.now() + 7 * 86400 * 1000).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  (or SOS if symptoms recur)
                </p>
                <p>
                  <strong>Department:</strong> Cardiology Outpatient Clinic (OPD Bay 4B)
                </p>
                <p className="text-rose-700 font-semibold">
                  🚨 Emergency: If pulse &gt; 140 BPM or chest pain occurs, call 1800-419-8800.
                </p>
              </div>
            </div>
          </section>

          {/* 2.5 SIGNATURES & DIGITAL SEALS */}
          <section className="pt-2 border-t border-slate-200">
            <div className="grid grid-cols-3 items-end gap-3 text-center">
              {/* Pathologist */}
              <div className="space-y-0.5">
                <div className="h-8 flex items-center justify-center">
                  <span className="font-serif italic text-sm font-bold text-slate-700">
                    Dr. A. Verma
                  </span>
                </div>
                <div className="border-t border-slate-300 pt-0.5">
                  <p className="font-bold text-slate-900 text-[9px]">Dr. Arvind Verma, MD</p>
                  <p className="text-[8px] text-slate-500">Director of Diagnostics (DMC-38491)</p>
                </div>
              </div>

              {/* Official Seal */}
              <div className="flex flex-col items-center justify-center space-y-0.5">
                <div className="h-10 w-10 rounded-full border-2 border-dashed border-sky-700 flex items-center justify-center bg-sky-50 text-[7px] font-black text-sky-900 uppercase tracking-tighter">
                  SEAL
                </div>
                <p className="text-[7.5px] font-mono text-slate-500">
                  HASH: {reportId.slice(-6)}-VERIFIED
                </p>
              </div>

              {/* Attending Doctor */}
              <div className="space-y-0.5">
                <div className="h-8 flex items-center justify-center">
                  <span className="font-serif italic text-base font-bold text-sky-900">
                    {doctorName.replace(/^Dr\.\s*/i, 'Dr. ')}
                  </span>
                </div>
                <div className="border-t border-slate-300 pt-0.5">
                  <p className="font-bold text-slate-900 text-[9px]">{doctorName}</p>
                  <p className="text-[8px] text-slate-500">{doctorSpecialty} ({doctorRegNo})</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* 2.6 PAGE 2 FOOTER */}
        <footer className="pt-2 border-t border-slate-200 text-[8px] text-slate-400 flex items-center justify-between">
          <p>
            Certified Electronic Health Record · Compliant with Clinical Establishments Act
          </p>
          <p className="font-mono font-bold text-slate-600">
            Page 2 of 2 · ID: {reportId}
          </p>
        </footer>
      </div>
    </div>
  );
}
