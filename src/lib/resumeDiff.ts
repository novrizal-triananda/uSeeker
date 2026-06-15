import type { MasterResume, ResumeSection, TailorSuggestion, TailoredResume } from '../types';

const API_BASE = 'http://127.0.0.1:8787';

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
  'from','as','is','was','are','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','shall','can',
  'this','that','these','those','i','me','my','we','our','you','your','he',
  'him','his','she','her','it','its','they','them','their','what','which',
  'who','whom','where','when','why','how','all','each','every','both','few',
  'more','most','other','some','such','no','nor','not','only','own','same',
  'so','than','too','very','just','because','if','about','above','after',
  'again','also','am','any','before','below','between','by','during','for',
  'from','further','here','into','itself','like','make','many','much','must',
  'now','off','once','or','our','out','over','own','per','put','said','see',
  'since','still','take','then','there','through','under','until','up','upon',
  'us','use','using','want','way','well','while','within','without','yet',
  'required','preferred','experience','ability','must','should','including',
  'within','etc','strong','excellent','good','skills','knowledge','understanding',
  'familiar','proficient','minimum','years','year','plus','role','position',
  'team','working','work','environment','dynamic','able','looking','candidates','join','team','company',
]);

export interface LocalDiffResult {
  keywordMatch: string[];
  skillGaps: string[];
  sectionScores: Record<string, number>;
}

export function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9+\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOP_WORDS.has(w));

  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
}

function flattenResumeText(resume: MasterResume): string {
  return resume.sections
    .flatMap(s => s.items.map(i => i.text))
    .join(' ')
    .toLowerCase();
}

function flattenSectionText(section: ResumeSection): string {
  return section.items.map(i => i.text).join(' ').toLowerCase();
}

function keywordInText(keyword: string, text: string): boolean {
  if (text.includes(keyword)) return true;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp('\\b' + escaped + '\\b', 'i');
  return pattern.test(text);
}

export function generateLocalDiff(
  masterResume: MasterResume,
  jobDescription: string,
): LocalDiffResult {
  const resumeText = flattenResumeText(masterResume);
  const jdKeywords = extractKeywords(jobDescription);

  const keywordMatch: string[] = [];
  const skillGaps: string[] = [];

  for (const kw of jdKeywords) {
    if (keywordInText(kw, resumeText)) {
      keywordMatch.push(kw);
    } else {
      skillGaps.push(kw);
    }
  }

  const sectionScores: Record<string, number> = {};

  for (const section of masterResume.sections) {
    const sectionText = flattenSectionText(section);
    const total = jdKeywords.length;
    if (total === 0) {
      sectionScores[section.type] = 0;
      continue;
    }
    const hits = jdKeywords.filter(kw => keywordInText(kw, sectionText)).length;
    sectionScores[section.type] = Math.round((hits / total) * 100);
  }

  return { keywordMatch, skillGaps, sectionScores };
}

export function parseAiSuggestions(response: string): TailorSuggestion[] {
  if (!response || response.trim().length === 0) return [];

  try {
    const parsed = JSON.parse(response);
    if (Array.isArray(parsed)) {
      return parsed
        .filter(
          (s: Record<string, unknown>) =>
            typeof s.section === 'string' &&
            typeof s.original === 'string' &&
            typeof s.suggested === 'string',
        )
        .map((s: Record<string, unknown>) => ({
          section: s.section as string,
          original: s.original as string,
          suggested: s.suggested as string,
          reason: (typeof s.reason === 'string' ? s.reason : '') as string,
          accepted: undefined as boolean | undefined,
        }));
    }
  } catch {
    // Not JSON - fall through to line-based parsing
  }

  const suggestions: TailorSuggestion[] = [];
  let current: Partial<TailorSuggestion> | null = null;

  const flush = () => {
    if (
      current &&
      current.section &&
      current.original &&
      current.suggested
    ) {
      suggestions.push({
        section: current.section,
        original: current.original,
        suggested: current.suggested,
        reason: current.reason || '',
        accepted: undefined,
      });
    }
    current = null;
  };

  for (const line of response.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const sectionMatch = trimmed.match(/^SECTION:\s*(.+)/i);
    if (sectionMatch) {
      flush();
      current = { section: sectionMatch[1].trim() };
      continue;
    }

    const originalMatch = trimmed.match(/^ORIGINAL:\s*(.+)/i);
    if (originalMatch && current) {
      current.original = originalMatch[1].trim();
      continue;
    }

    const suggestedMatch = trimmed.match(/^SUGGESTED:\s*(.+)/i);
    if (suggestedMatch && current) {
      current.suggested = suggestedMatch[1].trim();
      continue;
    }

    const reasonMatch = trimmed.match(/^REASON:\s*(.+)/i);
    if (reasonMatch && current) {
      current.reason = reasonMatch[1].trim();
      continue;
    }
  }

  flush();
  return suggestions;
}

export async function generateAiSuggestions(
  masterResume: MasterResume,
  jobDescription: string,
  jobId: string,
): Promise<TailorSuggestion[] | null> {
  void jobId; // kept for API stability; server ignores it
  const resumeText = masterResume.sections
    .flatMap(s => s.items.map(i => i.text))
    .join('\n');

  const systemPrompt = [
    'You are a professional resume tailoring assistant.',
    'You MUST return ONLY a JSON array — no markdown, no explanation, no wrapping.',
    'Each item in the array must be an object with exactly these fields:',
    '  - "section": the resume section name (e.g. "Experience", "Skills", "Summary")',
    '  - "original": the exact original text from the resume',
    '  - "suggested": the improved text',
    '  - "reason": a brief explanation of why this change helps',
    '',
    'Focus on:',
    '  1. Adding missing keywords from the job description',
    '  2. Strengthening weak bullet points with stronger action verbs or metrics',
    '  3. Reordering sections if a more relevant section should appear first',
    '',
    'Rules:',
    '  - Do NOT fabricate experience, dates, or qualifications not in the original resume',
    '  - Only suggest wording improvements, not new content',
    '  - Keep suggestions concise and professional',
    '  - Return an empty array [] if no improvements are possible',
  ].join('\n');

  const prompt = [
    'Analyze this resume against the job description and suggest tailoring improvements.',
    '',
    '--- RESUME ---',
    resumeText,
    '',
    '--- JOB DESCRIPTION ---',
    jobDescription,
  ].join('\n');

  try {
    const response = await fetch(`${API_BASE}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt,
        prompt,
        task: 'resume_tailor',
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const result: string = data.result || JSON.stringify(data);
    return parseAiSuggestions(result);
  } catch {
    return null;
  }
}

export function applyAcceptedSuggestions(tailoredResume: TailoredResume): string {
  const sections = new Map<string, { original: string; suggested: string }[]>();

  for (const s of tailoredResume.suggestions) {
    if (!sections.has(s.section)) {
      sections.set(s.section, []);
    }
    sections.get(s.section)!.push({ original: s.original, suggested: s.suggested });
  }

  const outputLines: string[] = [];

  for (const [section, items] of sections) {
    outputLines.push('--- ' + section.toUpperCase() + ' ---');
    for (const item of items) {
      const suggestion = tailoredResume.suggestions.find(
        s => s.section === section && s.original === item.original,
      );
      if (suggestion?.accepted === true) {
        outputLines.push(item.suggested);
      } else {
        outputLines.push(item.original);
      }
    }
    outputLines.push('');
  }

  return outputLines.join('\n').trim();
}
