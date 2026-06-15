import { parseResumeText } from './cvParser';
import type { MasterResume } from '../types';

/**
 * Extract raw text from a CV file (any supported format).
 * Used by both local parser and AI parser.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'txt':
    case 'md':
      return await file.text();

    case 'docx':
      return await extractDocxText(file);

    case 'pdf':
      return await extractPdfText(file);

    default:
      throw new Error(`Format file tidak didukung: .${ext}. Gunakan .txt, .md, .docx, atau .pdf`);
  }
}

/**
 * Import a CV file (TXT, MD, DOCX, PDF) and return a parsed MasterResume.
 * Handles file reading + format detection + text extraction + local parsing.
 */
export async function importCVFile(file: File): Promise<MasterResume> {
  const text = await extractTextFromFile(file);

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
 * Preserves line structure by detecting y-position changes between text items.
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
    
    let lastY: number | null = null;
    let line = '';
    
    for (const item of content.items as any[]) {
      const y = item.transform?.[5] ?? 0;
      
      // If y changed significantly, it's a new line
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        textParts.push(line.trimEnd());
        line = '';
      }
      
      line += item.str;
      
      // Detect if next item needs a space (gap in x position or different font)
      const nextItem = content.items[content.items.indexOf(item) + 1];
      if (nextItem) {
        const currentX = (item.transform?.[4] ?? 0) + (item.width ?? 0);
        const nextX = nextItem.transform?.[4] ?? 0;
        // If there's a gap > 2px, add a space
        if (nextX - currentX > 2) {
          line += ' ';
        }
      }
      
      lastY = y;
    }
    
    if (line.trim()) textParts.push(line.trimEnd());
  }
  
  return textParts.join('\n\n');
}
