import type { MasterResume, ResumeSection, ResumeItem, SectionType } from '../types';

// --- Section heading aliases ---
const SECTION_ALIASES: Record<string, SectionType> = {
  contact: 'contact',
  header: 'contact',
  personal: 'contact',
  'personal information': 'contact',
  'personal info': 'contact',
  summary: 'summary',
  objective: 'summary',
  profile: 'summary',
  'career summary': 'summary',
  'professional summary': 'summary',
  about: 'summary',
  experience: 'experience',
  work: 'experience',
  employment: 'experience',
  'professional experience': 'experience',
  'work experience': 'experience',
  internship: 'experience',
  'work history': 'experience',
  education: 'education',
  academic: 'education',
  'academic background': 'education',
  'educational background': 'education',
  qualifications: 'education',
  skills: 'skills',
  competencies: 'skills',
  'technical skills': 'skills',
  'core competencies': 'skills',
  'key skills': 'skills',
  'key competencies': 'skills',
  'technical competencies': 'skills',
  certifications: 'certifications',
  certificates: 'certifications',
  awards: 'certifications',
  achievements: 'certifications',
  honors: 'certifications',
  'awards & certifications': 'certifications',
  'certifications & awards': 'certifications',
  projects: 'projects',
  portfolio: 'projects',
  'personal projects': 'projects',
  links: 'links',
  socials: 'links',
  'online presence': 'links',
  'social media': 'links',
  languages: 'languages',
  'language skills': 'languages',
  volunteer: 'experience',
  'volunteer experience': 'experience',
  'extra-curricular': 'experience',
  references: 'links',
};

// --- Date patterns ---
const MONTH_NAMES = [
  'jan(?:uary)?', 'feb(?:ruary)?', 'mar(?:ch)?', 'apr(?:il)?',
  'may', 'jun(?:e)?', 'jul(?:y)?', 'aug(?:ust)?',
  'sep(?:tember)?', 'oct(?:ober)?', 'nov(?:ember)?', 'dec(?:ember)?',
];
const MONTH_PATTERN = MONTH_NAMES.join('|');
const YEAR_PATTERN = '\\d{4}';
const DATE_PART = `(?:${MONTH_PATTERN})\\s+${YEAR_PATTERN}|${YEAR_PATTERN}`;
const DATE_RANGE_PATTERN = new RegExp(
  `(${DATE_PART})\\s*[–—-]\\s*(${DATE_PART}|Present|Current|Now|present|current|now)`,
  'i',
);
// Looser date pattern — a line that contains a year (used to detect new entries)
const YEAR_LINE_PATTERN = /\b(19|20)\d{2}\b/;

// --- Contact patterns ---
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const PHONE_PATTERN = /(?:\+?\d{1,4}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/;
const LINKEDIN_PATTERN = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+/i;
const WEBSITE_PATTERN = /(?:https?:\/\/)?(?:www\.)?[A-Za-z0-9-]+\.[A-Za-z]{2,}(?:\/[^\s]*)?/i;

// --- Deduplication ---
function dedup(items: ResumeItem[]): ResumeItem[] {
  const seen = new Set<string>();
  const result: ResumeItem[] = [];
  for (const item of items) {
    const key = item.text.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

// --- Date parsing helper ---
function parseDate(dateStr: string): string | undefined {
  const trimmed = dateStr.trim();
  if (/^present|current|now$/i.test(trimmed)) {
    return 'present';
  }
  const monthYearMatch = trimmed.match(
    new RegExp(`^(${MONTH_PATTERN})\\s+(\\d{4})$`, 'i')
  );
  if (monthYearMatch) {
    return trimmed;
  }
  if (/^\d{4}$/.test(trimmed)) {
    return trimmed;
  }
  const slashDateMatch = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
  if (slashDateMatch) {
    return trimmed;
  }
  return undefined;
}

// --- Extract date range from a line of text ---
function extractDateRange(
  text: string
): { startDate?: string; endDate?: string; cleanedText: string } {
  const match = text.match(DATE_RANGE_PATTERN);
  if (!match) {
    return { cleanedText: text };
  }
  const startDate = parseDate(match[1]);
  const endDate = parseDate(match[2]);
  const cleanedText = text
    .replace(match[0], '')
    .replace(/[,;:]\s*$/, '')
    .trim();
  return { startDate, endDate, cleanedText };
}

// --- Map a heading string to SectionType ---
function mapHeadingToSectionType(heading: string): SectionType | null {
  const normalized = heading.trim().toLowerCase();
  if (SECTION_ALIASES[normalized]) {
    return SECTION_ALIASES[normalized];
  }
  for (const [alias, type] of Object.entries(SECTION_ALIASES)) {
    if (normalized.includes(alias)) {
      return type;
    }
  }
  return null;
}

// --- Detect if a line is a section heading ---
function isSectionHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 60) return false;
  const cleaned = trimmed
    .replace(/[:]+$/, '')
    .replace(/^[\u2022\-_*\#=]+/, '')
    .replace(/[,;]+$/, '')
    .trim();
  if (mapHeadingToSectionType(cleaned) !== null) {
    if (cleaned.length <= 50) {
      return true;
    }
  }
  if (
    trimmed === trimmed.toUpperCase() &&
    trimmed.length >= 3 &&
    trimmed.length <= 50 &&
    /[A-Z]/.test(trimmed)
  ) {
    return mapHeadingToSectionType(cleaned) !== null;
  }
  // Also detect markdown-style headings (# ## ###)
  if (/^#{1,3}\s+/.test(trimmed)) {
    const withoutHash = trimmed.replace(/^#{1,3}\s+/, '').trim();
    if (mapHeadingToSectionType(withoutHash) !== null) {
      return true;
    }
  }
  return false;
}

// --- Parse contact info from lines before first heading ---
function parseContactInfo(
  lines: string[]
): { contactItems: ResumeItem[]; remainingLines: string[] } {
  const contactItems: ResumeItem[] = [];
  let endIdx = 0;

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].trim();
    if (!line) {
      endIdx = i + 1;
      continue;
    }
    // Stop if we hit a section heading
    if (isSectionHeading(line)) {
      break;
    }

    const emailMatch = line.match(EMAIL_PATTERN);
    if (emailMatch) {
      contactItems.push({ text: `Email: ${emailMatch[0]}`, metadata: { field: 'email', value: emailMatch[0] } });
      endIdx = i + 1;
      continue;
    }
    const linkedinMatch = line.match(LINKEDIN_PATTERN);
    if (linkedinMatch) {
      contactItems.push({ text: `LinkedIn: ${linkedinMatch[0]}`, metadata: { field: 'linkedin', value: linkedinMatch[0] } });
      endIdx = i + 1;
      continue;
    }
    const websiteMatch = line.match(WEBSITE_PATTERN);
    if (websiteMatch && !websiteMatch[0].includes('linkedin.com')) {
      contactItems.push({ text: `Website: ${websiteMatch[0]}`, metadata: { field: 'website', value: websiteMatch[0] } });
      endIdx = i + 1;
      continue;
    }
    const phoneMatch = line.match(PHONE_PATTERN);
    if (phoneMatch && phoneMatch[0].replace(/\D/g, '').length >= 7) {
      contactItems.push({ text: `Phone: ${phoneMatch[0].trim()}`, metadata: { field: 'phone', value: phoneMatch[0].trim() } });
      endIdx = i + 1;
      continue;
    }
    // Location line — contains comma-separated parts that look like place names
    // e.g. "Jakarta, Indonesia" or "San Francisco, CA"
    if (line.length > 0 && line.length <= 60) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 2 && parts.every(p => /^[A-Z][a-zA-Z\s.]+$/.test(p))) {
        contactItems.push({ text: `Location: ${line}`, metadata: { field: 'location', value: line } });
        endIdx = i + 1;
        continue;
      }
    }
    // Name line — first non-empty, non-contact line that isn't a section keyword
    if (line.length > 0 && line.length <= 60) {
      const lower = line.toLowerCase();
      const hasSectionKeyword = Object.keys(SECTION_ALIASES).some(
        (alias) => lower === alias || lower.includes(alias)
      );
      if (!hasSectionKeyword) {
        contactItems.push({ text: line, metadata: { field: 'name', value: line } });
        endIdx = i + 1;
        continue;
      }
    }
    break;
  }
  const remainingLines = lines.slice(endIdx);
  return { contactItems, remainingLines };
}

// --- Parse a skills section (comma-separated or bullet-separated) ---
function parseSkillsSection(lines: string[]): ResumeItem[] {
  const items: ResumeItem[] = [];
  const allText = lines.join('\n');
  const skillLines = allText.split('\n');
  for (const line of skillLines) {
    const skills = line.split(/[,;]|\band\b/);
    for (const skill of skills) {
      const trimmed = skill
        .trim()
        .replace(/^[-\u2022*]\s*/, '')
        .replace(/[:.]+$/, '')
        .trim();
      if (trimmed.length > 0 && trimmed.length <= 80) {
        items.push({ text: trimmed });
      }
    }
  }
  return items;
}

// --- Group consecutive lines into logical entries ---
// A new entry starts when we see:
//   - An empty line (paragraph break)
//   - A line with a date range (indicates new job/education entry)
//   - A bullet point that starts a new group
// Everything else continues the current entry.
function groupLinesIntoEntries(lines: string[]): string[][] {
  const entries: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Empty line = paragraph break → start new entry
    if (!trimmed) {
      if (current.length > 0) {
        entries.push(current);
        current = [];
      }
      continue;
    }

    // Skip pure separator lines
    if (/^[\u2022\-_*=.\s]{3,}$/.test(trimmed)) {
      continue;
    }

    const { startDate, endDate, cleanedText } = extractDateRange(trimmed);
    const hasDateRange = Boolean(startDate && endDate);
    const hasYear = YEAR_LINE_PATTERN.test(trimmed);

    // Line with a date range that also has meaningful content → new entry
    if (hasDateRange && cleanedText.length > 2) {
      if (current.length > 0) {
        entries.push(current);
        current = [];
      }
      current.push(trimmed);
      continue;
    }

    // Short line with just a year and a title-like pattern → new entry
    if (hasYear && current.length > 0) {
      // Check if current last line is empty or also has a year → new entry
      const lastLine = current[current.length - 1]?.trim() || '';
      if (!lastLine || YEAR_LINE_PATTERN.test(lastLine)) {
        entries.push(current);
        current = [];
      }
    }

    current.push(trimmed);
  }

  if (current.length > 0) {
    entries.push(current);
  }

  return entries;
}

// --- Parse a generic section (experience, education, etc.) ---
// Groups multi-line entries into single items
function parseGenericSection(lines: string[]): ResumeItem[] {
  const items: ResumeItem[] = [];
  const entries = groupLinesIntoEntries(lines);

  for (const entryLines of entries) {
    // The first line is usually the title/company/date line
    const titleLine = entryLines[0];
    const { startDate, endDate } = extractDateRange(titleLine);

    // Join all lines of the entry into a single text
    const fullText = entryLines
      .map(l => l.trim())
      .join(' — ')
      .replace(/[\u2022]\s*/g, '')  // Remove bullet chars
      .replace(/[-*]\s+/g, '')       // Remove bullet markers
      .replace(/\s+/g, ' ')          // Normalize whitespace
      .replace(/—\s*—/g, '—')        // Remove double dashes
      .trim();

    if (fullText.length === 0) continue;

    const item: ResumeItem = { text: fullText };
    if (startDate) item.startDate = startDate;
    if (endDate) item.endDate = endDate;
    items.push(item);
  }

  return items;
}

// --- Main parser ---
export function parseResumeText(text: string): MasterResume {
  if (!text || text.trim().length === 0) {
    return {
      id: generateId(),
      sections: [],
      updatedAt: new Date(),
    };
  }
  const lines = text.split('\n');
  const sections: ResumeSection[] = [];
  const { contactItems, remainingLines } = parseContactInfo(lines);
  if (contactItems.length > 0) {
    sections.push({
      type: 'contact',
      title: 'Contact',
      items: contactItems,
    });
  }
  const sectionBlocks: { heading: string; lines: string[] }[] = [];
  let currentBlock: { heading: string; lines: string[] } | null = null;
  for (const line of remainingLines) {
    const trimmed = line.trim();
    if (isSectionHeading(trimmed)) {
      const cleaned = trimmed
        .replace(/[:]+$/, '')
        .replace(/^[\u2022\-_*\#=]+/, '')
        .replace(/[,;]+$/, '')
        .replace(/^#{1,3}\s+/, '')  // Remove markdown hashes
        .trim();
      if (currentBlock) {
        sectionBlocks.push(currentBlock);
      }
      currentBlock = { heading: cleaned, lines: [] };
    } else if (currentBlock) {
      currentBlock.lines.push(line);
    }
  }
  if (currentBlock) {
    sectionBlocks.push(currentBlock);
  }
  const seenTypes = new Set<SectionType>();
  for (const block of sectionBlocks) {
    const sectionType = mapHeadingToSectionType(block.heading);
    if (!sectionType) continue;
    let items: ResumeItem[];
    if (sectionType === 'skills') {
      items = parseSkillsSection(block.lines);
    } else {
      items = parseGenericSection(block.lines);
    }
    items = dedup(items);
    if (items.length === 0) continue;
    const existingSection = sections.find((s) => s.type === sectionType);
    if (existingSection) {
      existingSection.items.push(...items);
      existingSection.items = dedup(existingSection.items);
    } else {
      sections.push({
        type: sectionType,
        title: block.heading,
        items,
      });
      seenTypes.add(sectionType);
    }
  }
  return {
    id: generateId(),
    sections,
    updatedAt: new Date(),
  };
}

// --- Generate a unique ID ---
function generateId(): string {
  return `resume_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
