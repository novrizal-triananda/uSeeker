/**
 * E2E test: PDF → text extraction → structured parsing.
 * Uses real dummy CV from /home/azzerith/Ovi/Career/Dummy/.
 *
 * Run: pnpm exec vitest run src/lib/__tests__/e2e-pdf-parsing.test.ts
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist';
import { parseResumeText } from '../cvParser';

const DUMMY_PDF =
  '/home/azzerith/Ovi/Career/Dummy/Resume Esmeralda Cantika Rachma untuk MM UGM_20260526_094433_0000.pdf';

/**
 * Mirror of fileImporter's reconstructPageText — uses Y-coordinates
 * to group text items into lines instead of blind join(' ').
 */
function reconstructPageText(items: any[]): string {
  if (items.length === 0) return '';
  const sorted = [...items].sort((a: any, b: any) => {
    const aY = Math.round(a.transform[5]);
    const bY = Math.round(b.transform[5]);
    if (aY !== bY) return bY - aY;
    return a.transform[4] - b.transform[4];
  });
  const lines: string[][] = [];
  let currentLine: string[] = [];
  let currentY: number | null = null;
  const LINE_THRESHOLD = 3;
  for (const item of sorted) {
    const y = Math.round(item.transform[5]);
    const text = item.str;
    if (!text || !text.trim()) continue;
    if (currentY === null || Math.abs(y - currentY) <= LINE_THRESHOLD) {
      currentLine.push(text);
      currentY = y;
    } else {
      lines.push(currentLine);
      currentLine = [text];
      currentY = y;
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);
  return lines.map((line) => line.join(' ').trim()).join('\n');
}

async function extractPdfText(pdfPath: string): Promise<string> {
  const buffer = fs.readFileSync(pdfPath);
  const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    pageTexts.push(reconstructPageText(tc.items));
  }
  return pageTexts.join('\n\n');
}

describe('E2E: PDF parsing pipeline with dummy CV', () => {
  it('1. PDF file exists and is valid', () => {
    expect(fs.existsSync(DUMMY_PDF)).toBe(true);
    const stat = fs.statSync(DUMMY_PDF);
    expect(stat.size).toBeGreaterThan(1000);
    const header = Buffer.alloc(5);
    const fd = fs.openSync(DUMMY_PDF, 'r');
    fs.readSync(fd, header, 0, 5, 0);
    fs.closeSync(fd);
    expect(header.toString('utf-8')).toBe('%PDF-');
  });

  it('2. pdfjs-dist extracts text from dummy CV', async () => {
    const text = await extractPdfText(DUMMY_PDF);
    expect(text.length).toBeGreaterThan(50);
    const lower = text.toLowerCase();
    expect(
      lower.includes('esmeralda') || lower.includes('cantika') || lower.includes('rachma')
    ).toBe(true);
  });

  it('3. cvParser produces structured output from extracted text', async () => {
    const text = await extractPdfText(DUMMY_PDF);
    const parsed = parseResumeText(text);

    expect(parsed).toBeDefined();
    expect(parsed.sections).toBeDefined();
    expect(Array.isArray(parsed.sections)).toBe(true);
    expect(parsed.sections.length).toBeGreaterThan(0);

    const types = parsed.sections.map((s) => s.type);
    const hasSection = types.some((t) =>
      ['contact', 'experience', 'education', 'skills', 'summary'].includes(t)
    );
    expect(hasSection).toBe(true);
  });

  it('4. cvParser extracts items with content from extracted text', async () => {
    const text = await extractPdfText(DUMMY_PDF);
    const parsed = parseResumeText(text);

    const totalItems = parsed.sections.reduce((acc, s) => acc + s.items.length, 0);
    expect(totalItems).toBeGreaterThan(3);

    const hasLongItem = parsed.sections.some((s) =>
      s.items.some((item) => item.text.length > 10)
    );
    expect(hasLongItem).toBe(true);
  });

  it('5. extracted text has >= 50 non-space chars (no OCR needed)', async () => {
    const text = await extractPdfText(DUMMY_PDF);
    const nonSpace = text.replace(/\s/g, '').length;
    expect(nonSpace).toBeGreaterThanOrEqual(50);
  });

  it('6. reconstructed text preserves line breaks (not one flat line)', async () => {
    const text = await extractPdfText(DUMMY_PDF);
    const lineCount = text.split('\n').length;
    expect(lineCount).toBeGreaterThan(5);
  });
});
