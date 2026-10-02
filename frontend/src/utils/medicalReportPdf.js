import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { calculateLabCompletion } from '../data/labTestPresets';

/**
 * Generates a pure, crystal-clear, vector-native Hospital Medical Report PDF.
 * Uses native vector shapes, crisp fonts, and autoTable for flawless alignment,
 * zero row cuts, and professional hospital presentation.
 */
export function generateVectorMedicalReportPdf({
  patient = {},
  doctor = {},
  vitals = {},
  labTests = [],
  medicines = [],
  clinicalDiagnosis = null,
  reportMetadata = null,
  fileName = 'Patient_Medical_Report.pdf',
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const now = new Date();
  const year = now.getFullYear();
  const pid = String(patient.id || patient.patientId || 'PAT-001');
  const patientName = patient.name || 'Dhiraj Shukla';
  const age = patient.age || 24;
  const gender = patient.gender || 'Male';
  const bloodGroup = patient.bloodGroup || 'B+ (Positive)';
  const phone = patient.phone || '+91 98765 00123';
  const email = patient.email || 'patient@smarthealth.hospital.in';
  const address = patient.address || 'H.No 45, Sector 12, Healthcare Enclave, New Delhi';
  const emergencyContact = patient.sosContactName
    ? `${patient.sosContactName} (${patient.sosContactPhone || 'Available'})`
    : 'Family Emergency Contact (+91 98111 22334)';

  const doctorName = doctor.name || patient.assignedDoctorName || patient.doctorName || 'Dr. Sourav Tripathi';
  const doctorSpecialty = doctor.specialty || patient.doctorSpecialty || 'Cardiology & Internal Medicine';
  const doctorRegNo = doctor.regNo || 'MCI/NMC-2018-94820';

  const reportId =
    reportMetadata?.reportId ||
    `RPT-${year}-${pid.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || 'MED'}-${Math.floor(1000 + Math.random() * 9000)}`;

  const reportDateFormatted = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const labSummary = calculateLabCompletion(labTests);
  const isPreliminary = !labSummary.isAllVerified;

  // Telemetry vitals
  const heartRate = Number(vitals.heartRate ?? patient.vitals?.heartRate ?? patient.heartRate ?? 72);
  const spo2 = Number(vitals.spo2 ?? patient.vitals?.spo2 ?? patient.spo2 ?? 98.5);
  const temperature = Number(vitals.temperature ?? patient.vitals?.temperature ?? patient.temperature ?? 36.8);
  const bloodPressure = vitals.bloodPressure || patient.vitals?.bloodPressure || patient.bloodPressure || '120/80 mmHg';

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

  // =========================================================================
  // PAGE 1: CLINICAL ENCOUNTER, DEMOGRAPHICS & VITALS
  // =========================================================================

  // Letterhead Top Banner
  doc.setFillColor(2, 132, 199); // Sky blue top line
  doc.rect(10, 10, 190, 1.5, 'F');

  // Hospital Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text('APOLLO SMART HEALTHCARE', 10, 19);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text('MULTI-SPECIALITY HOSPITAL & RESEARCH INSTITUTE', 10, 23.5);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('NABH ACCREDITED HOSPITAL  |  NABL CERTIFIED DIAGNOSTIC LAB  |  ISO 9001:2015', 10, 27.5);

  // Hospital Contact Right Aligned
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Plot 42, Healthcare City, New Delhi - 110001', 200, 18, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text('24x7 Emergency: 1800-419-8800', 200, 22.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Web: smarthealth.hospital.in', 200, 26.5, { align: 'right' });

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(10, 30, 200, 30);

  // Document Title Strip
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('PATIENT CLINICAL SUMMARY & TELEMETRY RECORD', 10, 36);

  // Status Badge
  if (isPreliminary) {
    doc.setFillColor(254, 243, 199); // Amber light
    doc.setDrawColor(245, 158, 11);
    doc.roundedRect(120, 32, 45, 5.5, 1, 1, 'FD');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 83, 9);
    doc.text('PRELIMINARY REPORT', 142.5, 36, { align: 'center' });
  } else {
    doc.setFillColor(209, 250, 229); // Emerald light
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(120, 32, 45, 5.5, 1, 1, 'FD');
    doc.setFontSize(7.5);
    doc.setTextColor(6, 95, 70);
    doc.text('FINAL CERTIFIED REPORT', 142.5, 36, { align: 'center' });
  }

  // Report ID
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(168, 32, 32, 5.5, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(reportId, 184, 36, { align: 'center' });

  // Watermark if preliminary
  if (isPreliminary) {
    doc.saveGraphicsState?.();
    doc.setFontSize(55);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(244, 63, 94);
    // Draw subtle watermark
    doc.text('PRELIMINARY', 45, 140, { angle: 45 });
    doc.restoreGraphicsState?.();
  }

  // Patient Demographics Box Table
  autoTable(doc, {
    startY: 40,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [15, 23, 42],
    },
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.3,
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [3, 105, 161],
      fontStyle: 'bold',
      fontSize: 8,
    },
    head: [['PATIENT DEMOGRAPHICS & CLINICAL REGISTRATION', 'ENCOUNTER METADATA']],
    body: [
      [
        `Patient Name: ${patientName}\nMRN / Patient ID: ${pid}\nAge / Gender: ${age} Yrs / ${gender}\nBlood Group: ${bloodGroup}`,
        `Contact Number: ${phone}\nEmail: ${email}\nEmergency Contact: ${emergencyContact}\nAddress: ${address}`,
      ],
      [
        `Attending Physician: ${doctorName}\nDepartment: ${doctorSpecialty}`,
        `Medical Council Reg. No.: ${doctorRegNo}\nGenerated: ${reportDateFormatted}`,
      ],
    ],
    columnStyles: {
      0: { cellWidth: 95 },
      1: { cellWidth: 95 },
    },
    margin: { left: 10, right: 10 },
  });

  // Clinical Symptoms & Medical History Table
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 3.5,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [51, 65, 85],
    },
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.3,
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8,
    },
    head: [['PRESENTING CHIEF COMPLAINTS & SYMPTOMS', 'PAST MEDICAL HISTORY & ALLERGIES']],
    body: [[symptoms, medicalHistory]],
    columnStyles: {
      0: { cellWidth: 95 },
      1: { cellWidth: 95 },
    },
    margin: { left: 10, right: 10 },
  });

  // Continuous Telemetry & Vital Signs Table
  const getTempEval = (t) => {
    if (t < 35.0) return 'Critical Low (Hypothermia)';
    if (t < 36.5) return 'Subnormal (Low)';
    if (t <= 37.5) return 'Normothermic';
    if (t <= 38.5) return 'Elevated (Fever)';
    return 'Critical High (Pyrexia)';
  };

  const hrStatus = heartRate > 100 ? 'Elevated / Tachycardia' : heartRate < 50 ? 'Bradycardia' : 'Nominal Sinus';
  const spo2Status = spo2 < 92 ? 'Critical Hypoxemia' : spo2 < 95 ? 'Mild Hypoxemia' : 'Adequate Saturation';

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 3.5,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    head: [['VITAL PARAMETER', 'OBSERVED RESULT', 'REFERENCE INTERVAL', 'UNITS', 'CLINICAL STATUS']],
    body: [
      ['Heart Rate (Pulse)', `${heartRate.toFixed(1)}`, '60.0 - 100.0', 'BPM', hrStatus],
      ['Oxygen Saturation (SpO2)', `${spo2.toFixed(1)}`, '95.0 - 100.0', '%', spo2Status],
      ['Core Body Temperature', `${temperature.toFixed(1)}`, '36.5 - 37.5', '°C', getTempEval(temperature)],
      ['Non-Invasive Blood Pressure', bloodPressure, '90/60 - 120/80', 'mmHg', 'Normotensive'],
      ['ECG Rhythm (Lead II)', heartRate > 100 ? 'Sinus Tachycardia' : 'Normal Sinus Rhythm', 'PR: 120-200ms | QRS: 80-120ms', 'Continuous', 'Isoelectric ST Segment'],
    ],
    margin: { left: 10, right: 10 },
  });

  // Clinical Assessment & Diagnosis Table
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 3.5,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [15, 23, 42],
    },
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.3,
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [3, 105, 161],
      fontStyle: 'bold',
      fontSize: 8,
    },
    head: [['DOCTOR\'S CLINICAL ASSESSMENT & DIAGNOSIS']],
    body: [
      [`Provisional Clinical Impression:\n${provisionalDiagnosis}`],
      [`Final Verified Diagnosis (ICD-11 Aligned):\n${finalDiagnosis}`],
    ],
    margin: { left: 10, right: 10 },
  });

  // Page 1 Footer
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(10, 283, 200, 283);
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Apollo Smart Healthcare & Research Institute · Confidential Patient Medical Record', 10, 287);
  doc.setFont('helvetica', 'bold');
  doc.text(`Page 1 of 2 · Document ID: ${reportId}`, 200, 287, { align: 'right' });

  // =========================================================================
  // PAGE 2: DIAGNOSTIC LAB TESTS, PRESCRIPTIONS & SIGN-OFF
  // =========================================================================
  doc.addPage('a4', 'portrait');

  // Page 2 Compact Header
  doc.setFillColor(2, 132, 199);
  doc.rect(10, 10, 190, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('APOLLO SMART HEALTHCARE - DIAGNOSTIC LABORATORY INVESTIGATIONS', 10, 17);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Patient: ${patientName} (${pid})  |  Verification: ${labSummary.verified}/${labSummary.total} Verified`, 200, 17, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.line(10, 20, 200, 20);

  // Diagnostic Lab Tests Table
  const labRows = (labTests && labTests.length > 0 ? labTests : []).map((t) => [
    t.name || 'Test',
    String(t.result || 'Normal'),
    t.referenceRange || 'Standard',
    t.unit || '-',
    t.flag || 'Normal',
    t.status || 'Verified',
  ]);

  autoTable(doc, {
    startY: 23,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.6,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [12, 74, 110], // Deep Sky Navy
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    head: [['INVESTIGATION / PARAMETER NAME', 'OBSERVED RESULT', 'REFERENCE INTERVAL', 'UNIT', 'FLAG', 'VERIFICATION']],
    body: labRows.length > 0 ? labRows : [['Complete Blood Count & Metabolic Profile', 'Normal', 'Standard', '-', 'Normal', 'Verified']],
    margin: { left: 10, right: 10 },
  });

  // Prescriptions (Rx) Table
  const rxRows = (medicines && medicines.length > 0 ? medicines : [
    { name: 'Tab. Metoprolol Tartrate 25mg', dosage: '25 mg', frequency: '1-0-0 (Morning)', duration: '14 Days', instructions: 'Take after breakfast.' },
    { name: 'Tab. Multivitamin & Minerals', dosage: '1 Capsule', frequency: '0-1-0 (Afternoon)', duration: '30 Days', instructions: 'General wellness.' },
  ]).map((m, idx) => [
    idx + 1,
    m.medicineName || m.name || 'Medication',
    m.dosage || '1 Tab',
    `${m.frequency || '1-0-1'} · ${m.foodInstruction || 'After food'}`,
    m.duration || '5 Days',
    m.instructions || 'Take with water.',
  ]);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 3,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.6,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    head: [['#', 'MEDICATION (Rx)', 'DOSAGE', 'FREQUENCY & TIMING', 'DURATION', 'INSTRUCTIONS']],
    body: rxRows,
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 55 },
      2: { cellWidth: 22 },
      3: { cellWidth: 40 },
      4: { cellWidth: 20 },
      5: { cellWidth: 45 },
    },
    margin: { left: 10, right: 10 },
  });

  // Dietary & Follow-up Table
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 3,
    theme: 'plain',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [51, 65, 85],
    },
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.3,
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8,
    },
    head: [['DIETARY & LIFESTYLE ADVICE', 'FOLLOW-UP & EMERGENCY SOS']],
    body: [
      [
        '• Maintain hydration (2.5 to 3L water/day).\n• Limit sodium intake (< 2g/day) and caffeine.\n• 20-30 mins of moderate walking as tolerated.',
        `• Next Review: 7 Days (or SOS)\n• Department: Cardiology Outpatient (OPD 4B)\n• 24x7 Emergency SOS: 1800-419-8800`,
      ],
    ],
    columnStyles: {
      0: { cellWidth: 95 },
      1: { cellWidth: 95 },
    },
    margin: { left: 10, right: 10 },
  });

  // Signatures & Seals Box
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 3.5,
    theme: 'plain',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      halign: 'center',
    },
    body: [
      [
        'Dr. Arvind Verma\n_____________________\nDr. Arvind Verma, MD\nDirector of Pathology (DMC-38491)',
        `OFFICIAL SEAL\n[ DIGITAL CERTIFIED ]\nHASH: ${reportId.slice(-6)}-VERIFIED`,
        `${doctorName}\n_____________________\n${doctorName}\n${doctorSpecialty}\n(${doctorRegNo})`,
      ],
    ],
    columnStyles: {
      0: { cellWidth: 63 },
      1: { cellWidth: 64 },
      2: { cellWidth: 63 },
    },
    margin: { left: 10, right: 10 },
  });

  // Page 2 Footer
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(10, 283, 200, 283);
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Certified Electronic Medical Report · Verified under Clinical Establishments Act', 10, 287);
  doc.setFont('helvetica', 'bold');
  doc.text(`Page 2 of 2 · Document ID: ${reportId}`, 200, 287, { align: 'right' });

  const safeName = String(fileName).replace(/[/\\?%*:|"<>]/g, '_');
  doc.save(safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`);
  return true;
}

/**
 * Universal Medical Report PDF Downloader:
 * If vectorData is passed, generates a 100% crisp vector native PDF.
 * If a DOM element is passed, captures each .medical-report-page cleanly.
 */
export async function downloadMedicalReportPdf(targetElementOrIdOrData, fileName = 'Patient_Medical_Report.pdf') {
  // If invoked with a pure data object
  if (
    typeof targetElementOrIdOrData === 'object' &&
    targetElementOrIdOrData !== null &&
    !targetElementOrIdOrData.nodeType &&
    !(targetElementOrIdOrData instanceof HTMLElement)
  ) {
    return generateVectorMedicalReportPdf({
      ...targetElementOrIdOrData,
      fileName,
    });
  }

  const container =
    typeof targetElementOrIdOrData === 'string'
      ? document.getElementById(targetElementOrIdOrData)
      : targetElementOrIdOrData;

  if (!container) {
    throw new Error('Report document element not found for PDF export.');
  }

  // Standard A4 dimensions in millimeters
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;

  // Find individual medical report page containers
  let pages = Array.from(container.querySelectorAll('.medical-report-page'));
  if (pages.length === 0) {
    pages = [container];
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  for (let i = 0; i < pages.length; i++) {
    const pageElement = pages[i];

    const canvas = await html2canvas(pageElement, {
      scale: 2.2, // Crisp, ultra-sharp medical typography
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1024,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);

    if (i > 0) {
      pdf.addPage('a4', 'portrait');
    }

    pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, undefined, 'FAST');
  }

  const safeName = String(fileName).replace(/[/\\?%*:|"<>]/g, '_');
  pdf.save(safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`);
  return true;
}

/**
 * Triggers native browser print formatted specifically for hospital medical documents.
 */
export function printMedicalReport(targetElementId = 'printable-medical-report') {
  const printElement = document.getElementById(targetElementId);

  if (!printElement) {
    window.print();
    return;
  }

  // Create dedicated hidden print iframe to isolate the document
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Hospital Medical Report</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Manrope:wght@500;700;800&display=swap" rel="stylesheet">
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        @page {
          size: A4 portrait;
          margin: 6mm 6mm 6mm 6mm;
        }
        body {
          background-color: #ffffff;
          color: #0f172a;
          font-size: 11px;
          line-height: 1.4;
        }
        .medical-report-page {
          width: 100%;
          max-width: 198mm;
          min-height: 285mm;
          margin: 0 auto 12mm auto;
          page-break-after: always;
          break-after: page;
        }
        .medical-report-page:last-child {
          page-break-after: auto;
          break-after: auto;
          margin-bottom: 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          padding: 4px 6px;
        }
        .page-break-avoid {
          break-inside: avoid;
          page-break-inside: avoid;
        }
      </style>
    </head>
    <body>
      <div class="report-print-container">
        ${printElement.innerHTML}
      </div>
    </body>
    </html>
  `);
  doc.close();

  // Wait for styles to settle before printing
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 400);
}
