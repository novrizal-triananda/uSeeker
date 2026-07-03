/**
 * E2E test: actual CV parsing pipeline.
 * Run with: pnpm exec vitest run src/lib/__tests__/e2e-parsing.test.ts
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import mammoth from 'mammoth';
import { parseResumeText } from '../cvParser';

const CV_DOCX = '/home/azzerith/Ovi/Career/CV_Novrizal_Triananda_EN.docx';
const CV_PDF = '/home/azzerith/Ovi/Career/CV_Novrizal_Triananda_EN.pdf';

describe('E2E: .docx extraction + parsing', () => {
  it('extracts meaningful text from real CV .docx', async () => {
    const result = await mammoth.extractRawText({ path: CV_DOCX });
    const text = result.value;

    expect(text.length).toBeGreaterThan(200);
    const lower = text.toLowerCase();
    expect(
      lower.includes('novrizal') || lower.includes('experience') || lower.includes('education')
    ).toBe(true);
  });

  it('cvParser produces structured output from real CV text', async () => {
    const result = await mammoth.extractRawText({ path: CV_DOCX });
    const parsed = parseResumeText(result.value);

    expect(parsed.sections).toBeDefined();
    expect(parsed.sections.length).toBeGreaterThan(0);

    const sectionTypes = parsed.sections.map((s) => s.type);
    expect(
      sectionTypes.includes('contact') ||
      sectionTypes.includes('experience') ||
      sectionTypes.includes('education') ||
      sectionTypes.includes('skills')
    ).toBe(true);
  });

  it('cvParser extracts items with text content', async () => {
    const result = await mammoth.extractRawText({ path: CV_DOCX });
    const parsed = parseResumeText(result.value);

    const totalItems = parsed.sections.reduce((acc, s) => acc + s.items.length, 0);
    expect(totalItems).toBeGreaterThan(5);
  });
});

describe('E2E: PDF file validation', () => {
  it('PDF exists and is >10KB', () => {
    expect(fs.statSync(CV_PDF).size).toBeGreaterThan(10000);
  });

  it('PDF starts with %PDF header', () => {
    const header = fs.readFileSync(CV_PDF).toString('utf-8', 0, 5);
    expect(header).toBe('%PDF-');
  });
});

describe('E2E: fileImporter module', () => {
  it('exports importFile function', async () => {
    const mod = await import('../fileImporter');
    expect(typeof mod.importFile).toBe('function');
  });
});

describe('E2E: United Tractors JD', () => {
  const JD = `Budget Operation Trainee
United Tractors

Job Description:
1. Compile and analyze financial data to support financial planning, including working capital and cash planning analysis.
2. Prepare Operational Expense (OPEX) and Capital Expense (CAPEX) plans.
3. Perform financial planning analysis to support budgeting decisions.
4. Monitor budget and prepare management reports on budget performance.
5. Conduct OPEX and account-level cost analysis by cost center.
6. Coordinate budget planning, budget tracking, budget relocation, and other related budgeting activities with relevant stakeholders.`;

  it('cvParser extracts structured text from JD', () => {
    const parsed = parseResumeText(JD);
    expect(parsed.sections.length).toBeGreaterThan(0);
    const allText = parsed.sections
      .flatMap((s) => s.items.map((i) => i.text))
      .join(' ');
    expect(allText.length).toBeGreaterThan(20);
  });
});
