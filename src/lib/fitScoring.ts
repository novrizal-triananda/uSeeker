import type { MasterResume, FitScore } from '../types';

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
  'team','working','work','environment','dynamic','able','looking','candidates','join','team','company'
]);

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

function calculateSkillMatch(resumeText: string, jdKeywords: string[]): { score: number; matched: string[]; missing: string[] } {
  const resumeLower = resumeText.toLowerCase();
  const resumeWords = new Set(resumeLower.split(/[^a-z0-9]/).filter(w => w.length >= 2));
  const matched: string[] = [];
  const missing: string[] = [];

  for (const keyword of jdKeywords) {
    if (resumeWords.has(keyword) || resumeLower.includes(keyword)) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  const score = jdKeywords.length > 0
    ? Math.round((matched.length / jdKeywords.length) * 100)
    : 0;

  return { score, matched, missing };
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

function calculatePreferenceMatch(jdText: string, expectedSalary?: string, salaryRange?: string): number {
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

export function generateFitScore(
  masterResume: MasterResume,
  jobDescription: string,
  jobId: string,
  expectedSalary?: string,
  salaryRange?: string,
): FitScore {
  const resumeText = masterResume.sections
    .flatMap(s => s.items.map(i => i.text))
    .join(' ');

  const jdKeywords = extractKeywords(jobDescription);
  const { score: skillMatch, matched, missing } = calculateSkillMatch(resumeText, jdKeywords);
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
    matchedSkills: matched,
    missingSkills: missing,
    calculatedAt: new Date(),
  };
}
