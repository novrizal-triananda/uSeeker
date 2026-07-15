import type { MasterResume, FitScore } from '../types';
import { invoke } from '@tauri-apps/api/core';

// ── Skill taxonomy ──────────────────────────────────────────────────────────

const SKILL_TAXONOMY: Record<string, string[]> = {
  frontend: ['react', 'vue', 'angular', 'javascript', 'typescript', 'html', 'css', 'sass', 'tailwind', 'webpack', 'vite'],
  backend: ['node.js', 'express', 'django', 'flask', 'spring', 'laravel', 'php', 'ruby', 'go', 'rust'],
  database: ['sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb'],
  devops: ['docker', 'kubernetes', 'aws', 'gcp', 'azure', 'ci/cd', 'jenkins', 'github actions', 'terraform'],
  data: ['python', 'pandas', 'numpy', 'sql', 'tableau', 'power bi', 'excel', 'statistics', 'machine learning'],
  mobile: ['react native', 'flutter', 'swift', 'kotlin', 'android', 'ios'],
  design: ['figma', 'sketch', 'adobe xd', 'photoshop', 'illustrator', 'ui/ux'],
  management: ['agile', 'scrum', 'kanban', 'jira', 'leadership', 'team management', 'project management'],
  finance: ['financial analysis', 'accounting', 'budgeting', 'forecasting', 'excel', 'sap', 'oracle', 'financial reporting', 'cost analysis', 'opex', 'capex'],
};

/** skill → category */
const SKILL_TO_CATEGORY = new Map<string, string>();
/** category → Set of skills for fast lookup */
const CATEGORY_SKILLS = new Map<string, Set<string>>();

for (const [cat, skills] of Object.entries(SKILL_TAXONOMY)) {
  const set = new Set(skills.map(s => s.toLowerCase()));
  CATEGORY_SKILLS.set(cat, set);
  for (const skill of skills) {
    SKILL_TO_CATEGORY.set(skill.toLowerCase(), cat);
  }
}

// ── Text helpers ────────────────────────────────────────────────────────────

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
  // URL/domain fragments
  'http','https','www','com','id','org','net','co','httpid','httpsid',
  'httpwww','httpswww','httpcom','httpscom',
  'html','htm','php','asp','jsp','cgi',
  // Indonesian stop words (common in JD, not skills)
  'dan','untuk','dengan','dalam','pada','dari','ke','di','yang','adalah','ini','itu','atau','juga',
  'telah','sudah','akan','dapat','bisa','harus','lebih','serta','oleh','karena','sebagai',
  'apabila','bahwa','serta','antara','lain','meliputi','bagi','guna','wajib','nantinya',
  'melakukan','mempersiapkan','membuat','mengelola','menjalankan','bertanggung','jawab',
  'pengalaman','kemampuan','kualifikasi','tanggung','kriteria','posisi','lowongan',
  'makanan','bahan','pasien','klinis','kolaborasi','pengolahan','olahan',
  'deadline','secepatnya','cafe','gizi','sesuai','hasil',
  ]);

const URL_DOMAIN_PATTERNS = /https?:|www\.|\.com|\.co\.|\.id|\.org|\.net|\.io|\.dev|\.app/i;
const DOMAIN_SUFFIXES = /\.(com|id|org|net|io|co|dev|app|gov|edu|co\.id)$/;

export function isUrlOrDomain(word: string): boolean {
  if (URL_DOMAIN_PATTERNS.test(word)) return true;
  if (DOMAIN_SUFFIXES.test(word)) return true;
  // Words containing dots are likely domain fragments (e.g. "example.com")
  if (word.includes('.') && word.split('.').some(part => part.length === 0)) return true;
  return false;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** All known multi-word or dotted skill phrases from the taxonomy. */
const TAXONOMY_PHRASES: string[] = Object.values(SKILL_TAXONOMY)
  .flat()
  .filter(s => s.includes(' ') || s.includes('.'))
  .map(s => s.toLowerCase());

// ── Keyword extraction ──────────────────────────────────────────────────────

export function extractKeywords(text: string): string[] {
  // Strip full URLs before extracting words
  const cleaned = text
    .replace(/https?:\/\/[^\s]+/g, ' ')
    .replace(/www\.[^\s]+/g, ' ');

  const lowerText = cleaned.toLowerCase();

  // --- single-word extraction (original behaviour) ---
  const words = lowerText
    .replace(/[^a-z0-9+\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOP_WORDS.has(w) && !isUrlOrDomain(w));

  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  // --- multi-word / dotted taxonomy phrase extraction ---
  for (const phrase of TAXONOMY_PHRASES) {
    const regex = new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) {
      freq.set(phrase, (freq.get(phrase) || 0) + matches.length);
    }
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
}

export function extractSkillPhrases(text: string): string[] {
  const skills: string[] = [];
  const commaLists = text.match(/([\w]+(?:\s[\w]+)?(?:\s*[,/]\s*[\w]+(?:\s[\w]+)?)+)/gi);
  if (commaLists) {
    for (const list of commaLists) {
      const parts = list.split(/[,/]\s*/).map(s => s.trim().toLowerCase()).filter(s => s.length >= 2);
      skills.push(...parts);
    }
  }
  const techTerms = text.match(/\b(React|Vue|Angular|TypeScript|JavaScript|Python|Java|Node\.?js|Express|Django|Flask|SQL|NoSQL|MongoDB|PostgreSQL|MySQL|Redis|Docker|Kubernetes|AWS|GCP|Azure|Git|CI\/CD|REST|GraphQL|API|HTML|CSS|SASS|Webpack|Vite|Dexie|IndexedDB|PWA|agile|scrum|jira|figma|photoshop)\b/gi);
  if (techTerms) {
    skills.push(...techTerms.map(t => t.toLowerCase()));
  }
  return [...new Set(skills)];
}

function getEarlyJdSkills(jdText: string, maxBullets = 3): Set<string> {
  const lines = jdText.split(/\n/).filter(l => l.trim().length > 0);
  const bulletRe = /^\s*(?:[-•●◆\d]+[.)\s])\s*/;
  const earlyLines = lines.slice(0, maxBullets).join(' ').toLowerCase();

  const early = new Set<string>();
  // Grab skills that appear in the first few lines
  for (const [, skills] of Object.entries(SKILL_TAXONOMY)) {
    for (const skill of skills) {
      const re = new RegExp(`\\b${escapeRegex(skill)}\\b`, 'gi');
      if (re.test(earlyLines)) early.add(skill.toLowerCase());
    }
  }
  // Also match explicit bullet-style listings in first maxBullets lines
  for (const line of lines.slice(0, maxBullets)) {
    if (bulletRe.test(line)) {
      const parts = line.replace(bulletRe, '').split(/[,/;|]/);
      for (const p of parts) {
        const w = p.trim().toLowerCase();
        if (w.length >= 2 && !STOP_WORDS.has(w)) early.add(w);
      }
    }
  }
  return early;
}

function calculateSkillMatch(
  resumeText: string,
  jdKeywords: string[],
  jdText: string,
): { score: number; matched: string[]; missing: string[]; taxonomyMatched: string[] } {
  const resumeLower = resumeText.toLowerCase();
  const resumeWords = new Set(resumeLower.split(/[^a-z0-9]/).filter(w => w.length >= 2));

  const earlySkills = getEarlyJdSkills(jdText);

  const matched: string[] = [];
  const missing: string[] = [];
  const taxonomyMatched: string[] = [];

  let weightedSum = 0;
  let totalWeight = 0;

  for (const keyword of jdKeywords) {
    if (isUrlOrDomain(keyword) || STOP_WORDS.has(keyword)) continue;

    const kw = keyword.toLowerCase();
    const weight = earlySkills.has(kw) ? 2 : 1;
    totalWeight += weight;

    // Direct keyword match
    if (resumeWords.has(kw) || resumeLower.includes(kw)) {
      matched.push(keyword);
      weightedSum += 1.0 * weight;
      continue;
    }

    // Taxonomy-based match: find the JD keyword's category, check if resume has ANY skill in that category
    const jdCategory = SKILL_TO_CATEGORY.get(kw);
    if (jdCategory) {
      const categorySkills = CATEGORY_SKILLS.get(jdCategory);
      if (categorySkills) {
        const hasCategorySkill = Array.from(categorySkills).some(
          s => s !== kw && (resumeWords.has(s) || resumeLower.includes(s)),
        );
        if (hasCategorySkill) {
          taxonomyMatched.push(keyword);
          weightedSum += 0.7 * weight;
          continue;
        }
      }
    }

    // No match
    missing.push(keyword);
    weightedSum += 0;
  }

  const score = totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 100)
    : 0;

  return { score, matched, missing, taxonomyMatched };
}

/**
 * Semantic match: uses the taxonomy to find related skills between JD and resume.
 * Returns a score (0-100) and the list of related skill pairs found.
 */
export function calculateSemanticMatch(
  resumeText: string,
  jdText: string,
): { score: number; relatedPairs: Array<{ jdSkill: string; resumeSkill: string; category: string }> } {
  const resumeLower = resumeText.toLowerCase();
  const jdLower = jdText.toLowerCase();

  const relatedPairs: Array<{ jdSkill: string; resumeSkill: string; category: string }> = [];
  const matchedCategories = new Set<string>();

  for (const [category, skills] of Object.entries(SKILL_TAXONOMY)) {
    const jdSkillsInCat = skills.filter(s => {
      const re = new RegExp(`\\b${escapeRegex(s.toLowerCase())}\\b`, 'gi');
      return re.test(jdLower);
    });
    const resumeSkillsInCat = skills.filter(s => {
      const re = new RegExp(`\\b${escapeRegex(s.toLowerCase())}\\b`, 'gi');
      return re.test(resumeLower);
    });

    if (jdSkillsInCat.length > 0 && resumeSkillsInCat.length > 0) {
      matchedCategories.add(category);
      for (const jdSkill of jdSkillsInCat) {
        for (const resumeSkill of resumeSkillsInCat) {
          if (jdSkill.toLowerCase() !== resumeSkill.toLowerCase()) {
            relatedPairs.push({ jdSkill, resumeSkill, category });
          }
        }
      }
    }
  }

  const totalCategories = Object.keys(SKILL_TAXONOMY).length;
  const score = totalCategories > 0
    ? Math.round((matchedCategories.size / totalCategories) * 100)
    : 0;

  return { score, relatedPairs };
}

function calculateExperienceMatch(resumeText: string, jdText: string): number {
  const resumeYears = extractYears(resumeText);
  const jdYears = extractYears(jdText);
  if (jdYears === 0) return 100;
  if (resumeYears === 0) return 50;
  const ratio = resumeYears / jdYears;
  if (ratio >= 1) return 100;
  if (ratio >= 0.8) return 80;
  if (ratio >= 0.5) return 60;
  if (ratio >= 0.3) return 40;
  return 20;
}

function extractYears(text: string): number {
  const match = text.match(/(\d+)\+?\s*years?/i);
  return match ? parseInt(match[1]) : 0;
}

function calculatePreferenceMatch(_jdText: string, expectedSalary?: string, salaryRange?: string): number {
  let score = 100;
  if (expectedSalary && salaryRange) {
    const expected = parseInt(expectedSalary.match(/(\d+)/)?.[1] || '0');
    const rangeMatch = salaryRange.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (rangeMatch && expected > 0) {
      const max = parseInt(rangeMatch[2]);
      if (expected > max) score -= 30;
    }
  }
  return Math.max(0, score);
}

// ── AI Skill Extraction ──────────────────────────────────────────────────────

const SKILL_EXTRACTION_PROMPT = `## TASK
Analyze this job description and extract the KEY skills, qualifications, and requirements.

## OUTPUT FORMAT
Return a JSON object with exactly these fields:
{
  "requiredSkills": ["skill1", "skill2"],
  "niceToHaveSkills": ["skill3", "skill4"],
  "qualifications": ["bachelor degree", "3+ years experience"],
  "industryKnowledge": ["knowledge area 1"]
}

## RULES
- Extract actual SPECIFIC skills, not generic words
- Include both hard skills (tools, technologies, programming) and soft skills (leadership, communication)
- Include domain-specific knowledge relevant to the job
- Include education and experience requirements
- Do NOT include generic Indonesian words like "memiliki", "mampu", "baik", "secara"
- Do NOT include company-specific terms
- Be specific: "React.js" not "frontend"; "Python" not "programming language"
- For Indonesian JDs, translate technical terms to English (e.g., "pembukuan" → "accounting")
- Max 20 required skills, max 10 nice-to-have skills

## EXAMPLES

Input: "Mencari frontend developer yang menguasai React.js, TypeScript, dan Tailwind CSS. Pengalaman minimal 2 tahun."
Output: {"requiredSkills": ["React.js", "TypeScript", "Tailwind CSS", "frontend development"], "niceToHaveSkills": [], "qualifications": ["2+ years frontend experience"], "industryKnowledge": []}

Input: "Dibutuhkan staff akuntansi. Menguasai Microsoft Excel, pembukuan, laporan keuangan. Pendidikan minimal D3 Akuntansi."
Output: {"requiredSkills": ["Microsoft Excel", "accounting", "financial reporting", "bookkeeping"], "niceToHaveSkills": [], "qualifications": ["D3 in Accounting"], "industryKnowledge": []}
`;

async function extractSkillsWithAI(
  resumeText: string,
  jobDescription: string,
): Promise<{ requiredSkills: string[]; niceToHaveSkills: string[] } | null> {
  const prompt = [
    '--- JOB DESCRIPTION ---',
    jobDescription,
    '',
    '--- RESUME (for context on candidate background) ---',
    resumeText.slice(0, 2000),
    '',
    SKILL_EXTRACTION_PROMPT,
  ].join('\n');

  try {
    const data = await invoke<{ result: string }>('call_ai', {
      prompt,
      systemPrompt: 'You are an expert HR analyst. Extract skills from job descriptions accurately.',
      task: 'skill_extraction',
    });

    let text = (data.result || '').trim();
    // Strip markdown fences
    const fenceMatch = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
    if (fenceMatch) text = fenceMatch[1].trim();

    const parsed = JSON.parse(text);
    return {
      requiredSkills: Array.isArray(parsed.requiredSkills) ? parsed.requiredSkills : [],
      niceToHaveSkills: Array.isArray(parsed.niceToHaveSkills) ? parsed.niceToHaveSkills : [],
    };
  } catch {
    return null;
  }
}

// ── Local skill match (fallback) ─────────────────────────────────────────────

export async function generateFitScore(
  masterResume: MasterResume,
  jobDescription: string,
  jobId: string,
  expectedSalary?: string,
  salaryRange?: string,
): Promise<FitScore> {
  const resumeText = masterResume.sections
    .flatMap(s => s.items.map(i => i.text))
    .join(' ');

  // Edge case: empty JD or resume → return score 0
  if (!jobDescription || jobDescription.trim().length === 0) {
    return {
      id: crypto.randomUUID(),
      jobId,
      overallScore: 0,
      skillMatch: 0,
      experienceMatch: 0,
      preferenceMatch: 0,
      matchedSkills: [],
      missingSkills: [],
      calculatedAt: new Date(),
    };
  }
  if (!resumeText || resumeText.trim().length === 0) {
    return {
      id: crypto.randomUUID(),
      jobId,
      overallScore: 0,
      skillMatch: 0,
      experienceMatch: 0,
      preferenceMatch: 0,
      matchedSkills: [],
      missingSkills: [],
      calculatedAt: new Date(),
    };
  }

  // Try AI extraction first, fall back to local
  const aiSkills = await extractSkillsWithAI(resumeText, jobDescription);

  let matchedSkills: string[];
  let missingSkills: string[];
  let skillMatch: number;

  if (aiSkills && (aiSkills.requiredSkills.length > 0 || aiSkills.niceToHaveSkills.length > 0)) {
    // AI extraction succeeded — use its results
    const allRequired = aiSkills.requiredSkills.map(s => s.toLowerCase());
    const allNiceToHave = aiSkills.niceToHaveSkills.map(s => s.toLowerCase());
    const allSkills = [...allRequired, ...allNiceToHave];
    const resumeLower = resumeText.toLowerCase();

    matchedSkills = allSkills.filter(s => resumeLower.includes(s));
    missingSkills = allSkills.filter(s => !resumeLower.includes(s));

    // Weight required skills higher
    const requiredWeight = allRequired.length * 2;
    const niceWeight = allNiceToHave.length;
    const totalWeight = requiredWeight + niceWeight;
    const matchedRequired = allRequired.filter(s => resumeLower.includes(s)).length;
    const matchedNice = allNiceToHave.filter(s => resumeLower.includes(s)).length;
    skillMatch = totalWeight > 0
      ? Math.round(((matchedRequired * 2 + matchedNice) / totalWeight) * 100)
      : 0;
  } else {
    // Fallback: local keyword extraction
    const jdKeywords = extractKeywords(jobDescription);
    const localResult = calculateSkillMatch(resumeText, jdKeywords, jobDescription);
    matchedSkills = localResult.matched;
    missingSkills = localResult.missing;
    skillMatch = localResult.score;
  }

  const experienceMatch = calculateExperienceMatch(resumeText, jobDescription);
  const preferenceMatch = calculatePreferenceMatch(jobDescription, expectedSalary, salaryRange);

  const overallScore = Math.round(
    skillMatch * 0.5 + experienceMatch * 0.3 + preferenceMatch * 0.2
  );

  return {
    id: crypto.randomUUID(),
    jobId,
    overallScore,
    skillMatch,
    experienceMatch,
    preferenceMatch,
    matchedSkills,
    missingSkills,
    calculatedAt: new Date(),
  };
}