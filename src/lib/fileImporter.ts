import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const PDF_TEXT_THRESHOLD = 50; // chars — below this, treat as scanned

/**
 * Unified import entry point.
 */
export async function importFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'txt':
    case 'md':
      return readAsText(file);
    case 'docx':
      return extractDocxText(file);
    case 'pdf':
      return extractPdfText(file);
    default:
      throw new Error(`Format file tidak didukung: .${ext}. Gunakan .txt, .md, .docx, atau .pdf`);
  }
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Gagal membaca file teks'));
    reader.readAsText(file);
  });
}

async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/**
 * Extract text from PDF. Falls back to OCR if text content is too short
 * (scanned/image-based PDF).
 */
async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const pageTexts: string[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ')
      .trim();
    pageTexts.push(pageText);
  }

  const combined = pageTexts.join('\n\n');
  const totalChars = combined.replace(/\s/g, '').length;

  if (totalChars >= PDF_TEXT_THRESHOLD) {
    return combined;
  }

  // Scanned/image PDF — use OCR
  return ocrPdf(pdf);
}

/**
 * Render each PDF page to canvas, then OCR with Tesseract.js.
 */
async function ocrPdf(pdf: any): Promise<string> {
  const totalPages = pdf.numPages;
  const ocrTexts: string[] = [];

  const worker = await createWorker('eng');
  try {
    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 }); // 2x for better OCR
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;

      await page.render({ canvasContext: ctx, viewport }).promise;

      const imageData = canvas.toDataURL('image/png');
      const { data } = await worker.recognize(imageData);
      ocrTexts.push(data.text);
    }
  } finally {
    await worker.terminate();
  }

  return ocrTexts.join('\n\n');
}
