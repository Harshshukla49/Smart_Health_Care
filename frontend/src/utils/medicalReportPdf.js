import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Downloads a DOM element as a high-resolution, multi-page Hospital Medical Report PDF.
 * Uses 2x or 3x canvas rendering to maintain razor-sharp medical fonts and borders.
 * 
 * @param {HTMLElement|string} targetElementOrId - DOM element or element ID
 * @param {string} fileName - Destination filename
 */
export async function downloadMedicalReportPdf(targetElementOrId, fileName = 'Patient_Medical_Report.pdf') {
  const element =
    typeof targetElementOrId === 'string'
      ? document.getElementById(targetElementOrId)
      : targetElementOrId;

  if (!element) {
    throw new Error('Report document element not found for PDF export.');
  }

  // Temporary styling enhancements during capture for pristine PDF output
  const originalWidth = element.style.width;
  const originalMaxWidth = element.style.maxWidth;

  try {
    // Standard A4 dimensions in millimeters
    const A4_WIDTH_MM = 210;
    const A4_HEIGHT_MM = 297;

    const canvas = await html2canvas(element, {
      scale: 2.2, // High DPI for crystal clear medical typography
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1024,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const imgWidth = A4_WIDTH_MM;
    const pageHeight = A4_HEIGHT_MM;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    // First page
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    // Multi-page handling if document height exceeds single A4 page
    let pageNum = 2;
    while (heightLeft > 2) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
      pageNum++;
    }

    const safeName = String(fileName).replace(/[/\\?%*:|"<>]/g, '_');
    pdf.save(safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`);
    return true;
  } finally {
    element.style.width = originalWidth;
    element.style.maxWidth = originalMaxWidth;
  }
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
          margin: 10mm 8mm 12mm 8mm;
        }
        body {
          background-color: #ffffff;
          color: #0f172a;
          font-size: 11px;
          line-height: 1.45;
        }
        .report-page-container {
          width: 100%;
          max-width: 194mm;
          margin: 0 auto;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          padding: 5px 7px;
        }
        .page-break-avoid {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .page-break-before {
          break-before: page;
          page-break-before: always;
        }
      </style>
    </head>
    <body>
      <div class="report-page-container">
        ${printElement.innerHTML}
      </div>
    </body>
    </html>
  `);
  doc.close();

  // Wait for fonts and images to load before printing
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 400);
}
