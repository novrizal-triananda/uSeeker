import { parseResumeText } from './cvParser';
import type { MasterResume } from '../types';

/**
 * Import a CV file (TXT, MD, DOCX, PDF) and return a parsed MasterResume.
 * Handles file reading + format detection + text extraction.
 */
export async function importCVFile(file: File): Promise<MasterResume> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  
  let text: string;
  
  switch (ext) {
    case 'txt':
    case 'md':
      text = await file.text();
      break;
    
    case 'docx':
      text = await extractDocxText(file);
      break;
    
    case 'pdf':
      text = await extractPdfText(file);
      break;
    
    default:
      throw new Error(`Format file tidak didukung: .${ext}. Gunakan .txt, .md, .docx, atau .pdf`);
  }
  
  if (!text || text.trim().length === 0) {
    throw new Error('File kosong atau tidak dapat dibaca.');
  }
  
  return parseResumeText(text);
}

/**
 * Extract text from a .docx file using mammoth.
 */
async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  
  if (result.messages.length > 0) {
    console.warn('DOCX extraction warnings:', result.messages);
  }
  
  return result.value;
}

/**
 * Extract text from a .pdf file using pdfjs-dist.
 */
async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  
  // Set worker source
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const textParts: string[] = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ');
    textParts.push(pageText);
  }
  
  return textParts.join('\n\n');
}
