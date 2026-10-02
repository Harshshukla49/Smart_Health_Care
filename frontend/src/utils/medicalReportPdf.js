import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Downloads a DOM container as a high-resolution, multi-page Hospital Medical Report PDF.
 * Captures each designated page container individually to ensure zero row-splitting,
 * no clipping, and exact 1:1 A4 alignment.
 * 
 * @param {HTMLElement|string} targetElementOrId - DOM element or element ID
 * @param {string} fileName - Destination filename
 */
export async function downloadMedicalReportPdf(targetElementOrId, fileName = 'Patient_Medical_Report.pdf') {
  const container =
    typeof targetElementOrId === 'string'
      ? document.getElementById(targetElementOrId)
      : targetElementOrId;

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

    // High resolution capture
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

    // Exact full bleed A4 placement without scaling distortion
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
