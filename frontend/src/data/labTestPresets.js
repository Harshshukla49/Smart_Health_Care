/**
 * Standard Medical Laboratory Test Panels & Clinical Reference Ranges
 * Aligned with NABH / NABL Clinical Diagnostic Standards.
 */

export const STANDARD_LAB_TEST_PANELS = [
  {
    category: 'Hematology (Complete Blood Count - CBC)',
    tests: [
      {
        id: 'cbc-hb',
        name: 'Hemoglobin (Hb)',
        unit: 'g/dL',
        maleRange: '13.0 - 17.0',
        femaleRange: '12.0 - 15.5',
        defaultRefRange: '13.0 - 17.0',
        minNormal: 13.0,
        maxNormal: 17.0,
        criticalLow: 8.0,
        criticalHigh: 20.0,
        method: 'Photometric Cyanmethemoglobin',
      },
      {
        id: 'cbc-wbc',
        name: 'Total Leukocyte Count (TLC / WBC)',
        unit: '/µL',
        defaultRefRange: '4,000 - 11,000',
        minNormal: 4000,
        maxNormal: 11000,
        criticalLow: 2000,
        criticalHigh: 25000,
        method: 'Automated Flow Cytometry',
      },
      {
        id: 'cbc-plt',
        name: 'Platelet Count',
        unit: '/µL',
        defaultRefRange: '150,000 - 450,000',
        minNormal: 150000,
        maxNormal: 450000,
        criticalLow: 50000,
        criticalHigh: 800000,
        method: 'Electrical Impedance',
      },
      {
        id: 'cbc-pcv',
        name: 'Packed Cell Volume (PCV / Hematocrit)',
        unit: '%',
        defaultRefRange: '40.0 - 50.0',
        minNormal: 40.0,
        maxNormal: 50.0,
        criticalLow: 25.0,
        criticalHigh: 60.0,
        method: 'Calculated / Centrifugation',
      },
      {
        id: 'cbc-esr',
        name: 'Erythrocyte Sedimentation Rate (ESR)',
        unit: 'mm/1st hr',
        defaultRefRange: '0 - 15',
        minNormal: 0,
        maxNormal: 15,
        criticalLow: 0,
        criticalHigh: 70,
        method: 'Westergren Method',
      },
    ],
  },
  {
    category: 'Biochemistry & Renal Function (KFT / RFT)',
    tests: [
      {
        id: 'kft-fbs',
        name: 'Fasting Blood Glucose (FBS)',
        unit: 'mg/dL',
        defaultRefRange: '70 - 100',
        minNormal: 70,
        maxNormal: 100,
        criticalLow: 50,
        criticalHigh: 300,
        method: 'Hexokinase / GOD-POD',
      },
      {
        id: 'kft-hba1c',
        name: 'Glycated Hemoglobin (HbA1c)',
        unit: '%',
        defaultRefRange: '4.0 - 5.6',
        minNormal: 4.0,
        maxNormal: 5.6,
        criticalLow: 3.5,
        criticalHigh: 10.0,
        method: 'HPLC Ion-Exchange',
      },
      {
        id: 'kft-creat',
        name: 'Serum Creatinine',
        unit: 'mg/dL',
        defaultRefRange: '0.70 - 1.30',
        minNormal: 0.70,
        maxNormal: 1.30,
        criticalLow: 0.4,
        criticalHigh: 4.0,
        method: 'Jaffe Kinetic (IDMS Calibrated)',
      },
      {
        id: 'kft-bun',
        name: 'Blood Urea Nitrogen (BUN)',
        unit: 'mg/dL',
        defaultRefRange: '7.0 - 20.0',
        minNormal: 7.0,
        maxNormal: 20.0,
        criticalLow: 4.0,
        criticalHigh: 60.0,
        method: 'GLDH Kinetic',
      },
      {
        id: 'kft-uric',
        name: 'Serum Uric Acid',
        unit: 'mg/dL',
        defaultRefRange: '3.5 - 7.2',
        minNormal: 3.5,
        maxNormal: 7.2,
        criticalLow: 2.0,
        criticalHigh: 12.0,
        method: 'Uricase Enzymatic',
      },
    ],
  },
  {
    category: 'Cardiac Biomarkers & Electrolytes',
    tests: [
      {
        id: 'card-trop',
        name: 'High-Sensitivity Cardiac Troponin I (hs-cTnI)',
        unit: 'ng/mL',
        defaultRefRange: '< 0.040',
        minNormal: 0,
        maxNormal: 0.040,
        criticalLow: 0,
        criticalHigh: 0.150,
        method: 'Chemiluminescent Immunoassay (CLIA)',
      },
      {
        id: 'card-ckmb',
        name: 'Creatine Kinase - MB (CK-MB)',
        unit: 'U/L',
        defaultRefRange: '0.0 - 24.0',
        minNormal: 0,
        maxNormal: 24.0,
        criticalLow: 0,
        criticalHigh: 80.0,
        method: 'Immunoinhibition',
      },
      {
        id: 'card-na',
        name: 'Serum Sodium (Na+)',
        unit: 'mEq/L',
        defaultRefRange: '135.0 - 145.0',
        minNormal: 135.0,
        maxNormal: 145.0,
        criticalLow: 120.0,
        criticalHigh: 160.0,
        method: 'Ion Selective Electrode (ISE)',
      },
      {
        id: 'card-k',
        name: 'Serum Potassium (K+)',
        unit: 'mEq/L',
        defaultRefRange: '3.50 - 5.10',
        minNormal: 3.50,
        maxNormal: 5.10,
        criticalLow: 2.8,
        criticalHigh: 6.5,
        method: 'Ion Selective Electrode (ISE)',
      },
    ],
  },
  {
    category: 'Lipid Profile & Liver Function (LFT)',
    tests: [
      {
        id: 'lip-chol',
        name: 'Total Serum Cholesterol',
        unit: 'mg/dL',
        defaultRefRange: '< 200.0',
        minNormal: 120.0,
        maxNormal: 200.0,
        criticalLow: 90.0,
        criticalHigh: 350.0,
        method: 'CHOD-PAP Enzymatic',
      },
      {
        id: 'lip-trig',
        name: 'Serum Triglycerides',
        unit: 'mg/dL',
        defaultRefRange: '< 150.0',
        minNormal: 50.0,
        maxNormal: 150.0,
        criticalLow: 30.0,
        criticalHigh: 500.0,
        method: 'GPO-PAP Enzymatic',
      },
      {
        id: 'lft-bili',
        name: 'Total Bilirubin',
        unit: 'mg/dL',
        defaultRefRange: '0.20 - 1.20',
        minNormal: 0.20,
        maxNormal: 1.20,
        criticalLow: 0.1,
        criticalHigh: 4.0,
        method: 'Diazo / Jendrassik-Grof',
      },
      {
        id: 'lft-sgpt',
        name: 'SGPT / Alanine Aminotransferase (ALT)',
        unit: 'U/L',
        defaultRefRange: '10.0 - 45.0',
        minNormal: 10.0,
        maxNormal: 45.0,
        criticalLow: 5.0,
        criticalHigh: 200.0,
        method: 'IFCC UV Kinetic',
      },
    ],
  },
];

/**
 * Evaluates clinical status of a test result (Normal, High, Low, Critical High, Critical Low)
 */
export function evaluateTestStatus(testMeta, value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return { flag: 'Normal', level: 'normal', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }

  if (testMeta.criticalHigh && num >= testMeta.criticalHigh) {
    return { flag: 'Critical High (H*)', level: 'critical', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold' };
  }
  if (testMeta.criticalLow && num <= testMeta.criticalLow) {
    return { flag: 'Critical Low (L*)', level: 'critical', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold' };
  }
  if (testMeta.maxNormal && num > testMeta.maxNormal) {
    return { flag: 'High (H)', level: 'warning', badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold' };
  }
  if (testMeta.minNormal && num < testMeta.minNormal) {
    return { flag: 'Low (L)', level: 'warning', badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold' };
  }

  return { flag: 'Normal', level: 'normal', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
}

/**
 * Generates realistic diagnostic test results customized to patient physiological profile
 */
export function generateRealisticLabResults(patient = {}) {
  const isCritical = String(patient?.prediction?.status || patient?.status || '').toLowerCase() === 'critical';
  const hr = Number(patient?.vitals?.heartRate || patient?.heartRate || 75);
  const spo2 = Number(patient?.vitals?.spo2 || patient?.spo2 || 98);
  const temp = Number(patient?.vitals?.temperature || patient?.temperature || 36.8);

  const flatTests = [];

  STANDARD_LAB_TEST_PANELS.forEach((panel) => {
    panel.tests.forEach((test) => {
      let resultVal = '';
      let status = 'COMPLETED'; // 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED'
      let verifiedBy = 'Dr. A. Verma, MD (Pathology), Lab Director';

      switch (test.id) {
        case 'cbc-hb':
          resultVal = (patient.gender?.toLowerCase() === 'female' ? 13.4 : 14.8).toFixed(1);
          break;
        case 'cbc-wbc':
          resultVal = (temp > 38.0 || isCritical ? 12400 : 7800).toString();
          break;
        case 'cbc-plt':
          resultVal = '245,000';
          break;
        case 'cbc-pcv':
          resultVal = '44.2';
          break;
        case 'cbc-esr':
          resultVal = (temp > 38.0 ? '24' : '10');
          break;
        case 'kft-fbs':
          resultVal = '92.0';
          break;
        case 'kft-hba1c':
          resultVal = '5.4';
          break;
        case 'kft-creat':
          resultVal = '0.94';
          break;
        case 'kft-bun':
          resultVal = '14.2';
          break;
        case 'kft-uric':
          resultVal = '5.1';
          break;
        case 'card-trop':
          resultVal = (hr > 120 || isCritical ? 0.062 : 0.012).toFixed(3);
          break;
        case 'card-ckmb':
          resultVal = (hr > 120 || isCritical ? 28.5 : 12.4).toFixed(1);
          break;
        case 'card-na':
          resultVal = '139.4';
          break;
        case 'card-k':
          resultVal = '4.20';
          break;
        case 'lip-chol':
          resultVal = '184.0';
          break;
        case 'lip-trig':
          resultVal = '132.0';
          break;
        case 'lft-bili':
          resultVal = '0.85';
          break;
        case 'lft-sgpt':
          resultVal = '28.0';
          break;
        default:
          resultVal = 'Normal';
      }

      const numVal = parseFloat(String(resultVal).replace(/,/g, ''));
      const evalStatus = evaluateTestStatus(test, numVal);

      flatTests.push({
        id: test.id,
        category: panel.category,
        name: test.name,
        result: resultVal,
        unit: test.unit,
        referenceRange: test.defaultRefRange,
        method: test.method,
        status: 'VERIFIED', // Default verified for completed clinical workflow
        flag: evalStatus.flag,
        flagLevel: evalStatus.level,
        badgeClass: evalStatus.badgeClass,
        verifiedBy: verifiedBy,
        completedAt: new Date(Date.now() - 3600 * 1000 * 2).toLocaleString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      });
    });
  });

  return flatTests;
}

/**
 * Calculates test completion statistics and report certification status
 */
export function calculateLabCompletion(tests = []) {
  if (!Array.isArray(tests) || tests.length === 0) {
    return {
      total: 0,
      completed: 0,
      verified: 0,
      pending: 0,
      percentage: 100,
      isAllCompleted: true,
      isAllVerified: true,
      reportType: 'FINAL_CERTIFIED',
      badgeText: 'Final Certified Report',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    };
  }

  const total = tests.length;
  const verified = tests.filter((t) => String(t.status).toUpperCase() === 'VERIFIED').length;
  const completed = tests.filter((t) => ['COMPLETED', 'VERIFIED'].includes(String(t.status).toUpperCase())).length;
  const pending = total - completed;
  const percentage = Math.round((completed / total) * 100);

  const isAllVerified = verified === total;
  const isAllCompleted = completed === total;

  return {
    total,
    completed,
    verified,
    pending,
    percentage,
    isAllCompleted,
    isAllVerified,
    reportType: isAllVerified ? 'FINAL_CERTIFIED' : isAllCompleted ? 'PRELIMINARY_COMPLETED' : 'PRELIMINARY_PENDING',
    badgeText: isAllVerified
      ? 'Final Certified Report (All Tests Verified)'
      : isAllCompleted
      ? 'Provisional Report (Lab Tests Completed - Awaiting Final Verification)'
      : `Preliminary Report (${pending} Test${pending > 1 ? 's' : ''} Pending)`,
    badgeClass: isAllVerified
      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
      : isAllCompleted
      ? 'bg-sky-50 text-sky-800 border-sky-300'
      : 'bg-amber-50 text-amber-800 border-amber-300',
  };
}
