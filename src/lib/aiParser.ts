import type { MasterResume, ResumeSection, ResumeItem, SectionType } from '../types';
import { parseResumeText } from './cvParser';

const API_BASE = 'http://127.0.0.1:8787';

const AI_SYSTEM_PROMPT = `You are a CV/resume parser. Extract structured data from the given CV text.

Return ONLY a valid JSON object with this exact schema:
{
  "sections": [
    {
      "type": "contact|summary|experience|education|skills|certifications|projects|links",
      "title": "Section Title",
      "items": [
        {
          "text": "Item text content",
          "startDate": "optional start date like 'Jan 2024' or '2024'",
          "endDate": "optional end date like 'Jun 2024' or 'present'"
        }
      ]
    }
  ]
}

Rules:
- "type" must be one of: contact, summary, experience, education, skills, certifications, projects, links
- Contact items should have metadata: { "field": "name|email|phone|linkedin|location", "value": "the value" }
- Group related lines into single items (e.g., one job entry = company + role + bullets = ONE item)
- Skills should be individual skill names, NOT grouped by category
- Extract dates from entries that have date ranges
- Return ONLY the JSON, no markdown fences, no explanation`;

/**
 * Parse CV text using AI (Deepseek via server proxy).
 * Falls back to local regex parser if server is unavailable.
 */
export async function parseResumeWithAI(text: string): Promise<MasterResume> {
  if (!text || text.trim().length === 0) {
    return {
      id: generateId(),
      sections: [],
      updatedAt: new Date(),
    };
  }

  try {
    const response = await fetch(`${API_BASE}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `Parse this CV/resume text into structured JSON:\n\n${text}`,
        systemPrompt: AI_SYSTEM_PROMPT,
        task: 'cv_parsing',
      }),
    });

    if (!response.ok) {
      console.warn('AI parser unavailable, falling back to local parser');
      return parseResumeText(text);
    }

    const data = await response.json();
    const result = data.result || '';

    // Try to parse the AI response as JSON
    let parsed: any;
    try {
      // Strip markdown fences if present
      const cleaned = result.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.warn('AI returned invalid JSON, falling back to local parser');
      return parseResumeText(text);
    }

    if (!parsed.sections || !Array.isArray(parsed.sections)) {
      console.warn('AI response missing sections array, falling back to local parser');
      return parseResumeText(text);
    }

    // Convert AI response to MasterResume format
    const sections: ResumeSection[] = parsed.sections.map((s: any) => ({
      type: validateSectionType(s.type),
      title: s.title || s.type,
      items: (s.items || []).map((item: any) => {
        const resumeItem: ResumeItem = { text: item.text || '' };
        if (item.startDate) resumeItem.startDate = item.startDate;
        if (item.endDate) resumeItem.endDate = item.endDate;
        if (item.metadata) resumeItem.metadata = item.metadata;
        return resumeItem;
      }),
    }));

    return {
      id: generateId(),
      sections: sections.filter(s => s.items.length > 0),
      updatedAt: new Date(),
    };
  } catch (err) {
    console.warn('AI parser error, falling back to local parser:', err);
    return parseResumeText(text);
  }
}

function validateSectionType(type: string): SectionType {
  const valid: SectionType[] = [
    'contact', 'summary', 'experience', 'education',
    'skills', 'certifications', 'projects', 'links',
  ];
  return valid.includes(type as SectionType) ? type as SectionType : 'summary';
}

function generateId(): string {
  return `resume_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
