import type { MasterResume, ResumeSection, TailorSuggestion, TailoredResume } from '../types';
import { isUrlOrDomain } from './fitScoring';
import { invoke } from '@tauri-apps/api/core';

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
  // Strip full URLs before extracting words
  const cleaned = text
    .replace(/https?:\/\/[^\s]+/g, ' ')
    .replace(/www\.[^\s]+/g, ' ');

  const words = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9+\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOP_WORDS.has(w) && !isUrlOrDomain(w));

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
    // Skip URL/domain fragments that slipped through
    if (isUrlOrDomain(kw)) continue;
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

const URL_PATTERN = /https?:|www\.|\.com|\.co\.|\.id|\.org|\.net|\.io|\.dev|\.app|\.gov|\.edu/i;

function isUrlFragment(s: string): boolean {
  if (!s) return false;
  return URL_PATTERN.test(s);
}

export function parseAiSuggestions(response: string): TailorSuggestion[] {
  if (!response || response.trim().length === 0) return [];

  try {
    const parsed = JSON.parse(stripMarkdown(response));
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
        }))
        // Post-process: filter out suggestions containing URL fragments
        .filter(s =>
          !isUrlFragment(s.section) &&
          !isUrlFragment(s.original) &&
          !isUrlFragment(s.suggested) &&
          !isUrlFragment(s.reason)
        );
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
    'Semua saran harus dalam Bahasa Indonesia.',
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
    '  - Jangan pernah menyertakan URL, domain, atau fragment seperti https, http, www, .com, .id dalam saran.',
    '  - Fokus hanya pada kata kunci profesional dan skill.',
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
    const data = await invoke<{ result: string }>('call_ai', {
      prompt,
      systemPrompt,
      task: 'resume_tailor',
    });
    const result: string = data.result || JSON.stringify(data);
    return parseAiSuggestions(result);
  } catch {
    return null;
  }
}


export interface SkillAnalysis {
  fundamentalFit: {
    experienceLevel: 'match' | 'mismatch' | 'partial';
    note: string;
  };
  matchedSkills: string[];
  /** @deprecated Use requiredGapSkills and niceToHaveGapSkills instead */
  gapSkills: string[];
  requiredGapSkills: string[];
  niceToHaveGapSkills: string[];
  confidence: number;
  suggestions: TailorSuggestion[];
}

export async function generateSkillAnalysis(
  masterResume: MasterResume,
  jobDescription: string,
  jobId: string,
): Promise<SkillAnalysis | null> {
  void jobId;
  const resumeText = masterResume.sections
    .flatMap(s => s.items.map(i => i.text))
    .join('\n');

  const systemPrompt = [
    '## ROLE',
    'Ahli analisis kecocokan CV dengan lowongan kerja Indonesia.',
    '',
    '## INSTRUCTIONS',
    'Analisis CV pelamar dan bandingkan dengan job description.',
    'Evaluasi: (1) fundamental fit — apakah level pengalaman cocok?, (2) skill match — skill mana yang benar-benar ada di CV DAN disebutkan di JD?, (3) skill gaps — bedakan hard requirement vs nice-to-have, (4) saran tailoring — perbaikan wording tanpa mengarang pengalaman baru.',
    '',
    '## INPUTS',
    'CV pelamar dan job description yang diberikan.',
    '',
    '## CONSTRAINTS',
    '- Hanya gunakan informasi yang ada di CV dan JD. Jangan mengarang pengalaman baru.',
    '- matchedSkills: skill yang BENAR-BENAR ada di CV DAN disebutkan di JD sebagai requirement. Jangan match skill yang tidak disebutkan di JD.',
    '- Jangan match skill yang cuma "nice to have" di JD sebagai matchedSkills.',
    '- Jangan menyertakan keyword umum: team, communication, problem solving, leadership.',
    '- Bedakan hard requirement (kualifikasi wajib) vs nice-to-have (kualifikasi tambahan) dari teks JD.',
    '- suggestions: HANYA tingkatkan wording yang sudah ada di CV. Jangan tambah pengalaman, skill, atau proyek yang tidak ada di CV asli.',
    '- Jika CV pelamar tidak ada pengalaman yang relevan sama sekali, jangan paksa saran — cukup flag di fundamentalFit.',
    '- Semua output dalam Bahasa Indonesia.',
    '',
    '## OUTPUT FORMAT',
    'JSON saja, tanpa markdown atau penjelasan:',
    '{',
    '  "fundamentalFit": {',
    '    "experienceLevel": "match|mismatch|partial",',
    '    "note": "penjelasan singkat (misal: fresh grad tapi JD minta 2 tahun)"',
    '  },',
    '  "matchedSkills": ["skill yang ada di CV DAN disebutkan di JD"],',
    '  "requiredGapSkills": ["skill hard requirement di JD tapi tidak ada di CV"],',
    '  "niceToHaveGapSkills": ["skill nice-to-have di JD tapi tidak ada di CV"],',
    '  "confidence": 0.0-1.0,',
    '  "suggestions": [',
    '    {',
    '      "section": "nama section CV",',
    '      "original": "teks asli dari CV",',
    '      "suggested": "teks yang sudah di-tailor",',
    '      "reason": "alasan perubahan"',
    '    }',
    '  ]',
    '}',
    '',
    '## SUCCESS CRITERIA',
    '- fundamentalFit terisi dengan level pengalaman yang akurat.',
    '- matchedSkills hanya berisi skill yang benar-benar ada di CV DAN disebutkan di JD.',
    '- requiredGapSkills berisi hard requirement yang benar-benar missing.',
    '- niceToHaveGapSkills berisi nice-to-have yang missing.',
    '- confidence mencerminkan kualitas match (tinggi jika banyak skill cocok, rendah jika banyak gap fundamental).',
    '- suggestions HANYA memperbaiki wording, tidak mengarang experience baru.',
  ].join('\n');

  const prompt = [
    'Analisis CV ini dan bandingkan dengan job description.',
    'Identifikasi skill yang cocok dan skill yang gap.',
    'Berikan saran tailoring untuk CV.',
    '',
    '--- CV ---',
    resumeText,
    '',
    '--- JOB DESCRIPTION ---',
    jobDescription,
  ].join('\n');

  const data = await invoke<{ result: string }>('call_ai', {
    prompt,
    systemPrompt,
    task: 'skill_analysis',
  });
  const result: string = data.result || JSON.stringify(data);
  const parsed = parseSkillAnalysis(result);
  if (!parsed) throw new Error('AI returned invalid response');
  return parsed;
}

/** Strip markdown code fences from AI response and extract JSON */ function stripMarkdown(text: string): string { const trimmed = text.trim(); try { JSON.parse(trimmed); return trimmed; } catch {} const m1 = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/); if (m1) { try { JSON.parse(m1[1].trim()); return m1[1].trim(); } catch {} } const m2 = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/); if (m2) { try { JSON.parse(m2[1].trim()); return m2[1].trim(); } catch {} } const mObj = trimmed.match(/\{[\s\S]*\}/); if (mObj) { try { JSON.parse(mObj[0].trim()); return mObj[0].trim(); } catch {} } const mArr = trimmed.match(/\[[\s\S]*\]/); if (mArr) { try { JSON.parse(mArr[0].trim()); return mArr[0].trim(); } catch {} } return trimmed; }
function parseSkillAnalysis(response: string): SkillAnalysis | null {
  if (!response || response.trim().length === 0) return null;

  try {
    const parsed = JSON.parse(stripMarkdown(response));
    return {
      fundamentalFit: {
        experienceLevel: ['match', 'mismatch', 'partial'].includes(parsed.fundamentalFit?.experienceLevel)
          ? parsed.fundamentalFit.experienceLevel
          : 'partial',
        note: typeof parsed.fundamentalFit?.note === 'string' ? parsed.fundamentalFit.note : '',
      },
      matchedSkills: Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills : [],
      requiredGapSkills: Array.isArray(parsed.requiredGapSkills) ? parsed.requiredGapSkills : [],
      niceToHaveGapSkills: Array.isArray(parsed.niceToHaveGapSkills) ? parsed.niceToHaveGapSkills : [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      gapSkills: [
        ...(Array.isArray(parsed.requiredGapSkills) ? parsed.requiredGapSkills : []),
        ...(Array.isArray(parsed.niceToHaveGapSkills) ? parsed.niceToHaveGapSkills : []),
      ],
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions
            .filter((s: Record<string, unknown>) =>
              typeof s.section === 'string' &&
              typeof s.original === 'string' &&
              typeof s.suggested === 'string'
            )
            .map((s: Record<string, unknown>) => ({
              section: s.section as string,
              original: s.original as string,
              suggested: s.suggested as string,
              reason: (typeof s.reason === 'string' ? s.reason : '') as string,
              accepted: undefined as boolean | undefined,
            }))
        : [],
    };
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
