import type { MasterResume, ResumeSection, ResumeItem, SectionType } from '../types';
import { parseResumeText } from './cvParser';
import { invoke } from '@tauri-apps/api/core';

const AI_SYSTEM_PROMPT = `Kamu adalah parser CV profesional. Tugasmu: ekstrak SEMUA data dari teks CV dan kembalikan dalam format JSON terstruktur.

ATURAN KRITIS:
1. Ekstrak SEMUA konten — jangan skip bagian apapun. Setiap baris teks harus ada di output.
2. Judul section dalam Bahasa Indonesia (Kontak, Ringkasan Profesional, Pengalaman Kerja, Pendidikan, Keahlian, Sertifikasi, Proyek, Tautan)
3. Isi item tetap dalam Bahasa asli CV (jangan translate)
4. Satu entri pekerjaan = SATU item (nama perusahaan + jabatan + tanggung jawab + bullet points = SATU item). JANGAN split menjadi beberapa item.
5. Bullet points dalam satu pekerjaan HARUS digabung dalam satu field "text", dipisah dengan newline (\n). Contoh: "PT Teknologi | Software Engineer\\n- Developed microservices\\n- Led team"
6. Skills individual, bukan per kategori
7. Format JSON HANYA — tidak ada markdown fence, tidak ada penjelasan, tidak ada komentar
8. JANGAN pernah menyertakan URL atau email sebagai bagian dari item text kecuali itu memang kontak info
9. Untuk CV multi-kolom: gabungkan kolom kiri dan kanan secara logis. Jangan buat section duplikat.

TYPE YANG VALID: contact, summary, experience, education, skills, certifications, projects, links

FIELD OPSIONAL per item: text (wajib), startDate, endDate, metadata (object)

METADATA UNTUK CONTACT section:
- "field": "name" | "email" | "phone" | "location" | "linkedin" | "website" | "other"
- "value": nilai kontak

CONTOH INPUT:
"John Doe
john@email.com | +62 812-xxxx-xxxx | Jakarta, Indonesia | linkedin.com/in/johndoe

PROFESSIONAL SUMMARY
Senior software engineer with 5+ years experience in full-stack development.

WORK EXPERIENCE
PT Teknologi Nusantara, Jakarta | Software Engineer | Jan 2022 - Present
- Developed microservices architecture serving 1M+ users
- Led team of 3 junior developers
- Reduced API response time by 40%

CV Digital Indonesia | Junior Developer | Jul 2019 - Dec 2021
- Built responsive web applications using React
- Implemented CI/CD pipeline

EDUCATION
Universitas Indonesia | Bachelor of Computer Science | 2015 - 2019
GPA: 3.8/4.0

SKILLS
JavaScript, TypeScript, Python, React, Node.js, PostgreSQL, Docker, AWS, Git

CERTIFICATIONS
AWS Solutions Architect Associate | 2023"

CONTOH OUTPUT:
{
  "sections": [
    {
      "type": "contact",
      "title": "Kontak",
      "items": [
        { "text": "John Doe", "metadata": { "field": "name", "value": "John Doe" } },
        { "text": "john@email.com", "metadata": { "field": "email", "value": "john@email.com" } },
        { "text": "+62 812-xxxx-xxxx", "metadata": { "field": "phone", "value": "+62 812-xxxx-xxxx" } },
        { "text": "Jakarta, Indonesia", "metadata": { "field": "location", "value": "Jakarta, Indonesia" } },
        { "text": "linkedin.com/in/johndoe", "metadata": { "field": "linkedin", "value": "linkedin.com/in/johndoe" } }
      ]
    },
    {
      "type": "summary",
      "title": "Ringkasan Profesional",
      "items": [
        { "text": "Senior software engineer with 5+ years experience in full-stack development." }
      ]
    },
    {
      "type": "experience",
      "title": "Pengalaman Kerja",
      "items": [
        {
          "text": "PT Teknologi Nusantara | Software Engineer\n- Developed microservices architecture serving 1M+ users\n- Led team of 3 junior developers\n- Reduced API response time by 40%",
          "startDate": "Jan 2022",
          "endDate": "Present"
        },
        {
          "text": "CV Digital Indonesia | Junior Developer\n- Built responsive web applications using React\n- Implemented CI/CD pipeline",
          "startDate": "Jul 2019",
          "endDate": "Dec 2021"
        }
      ]
    },
    {
      "type": "education",
      "title": "Pendidikan",
      "items": [
        {
          "text": "Universitas Indonesia | Bachelor of Computer Science | GPA: 3.8/4.0",
          "startDate": "2015",
          "endDate": "2019"
        }
      ]
    },
    {
      "type": "skills",
      "title": "Keahlian",
      "items": [
        { "text": "JavaScript" },
        { "text": "TypeScript" },
        { "text": "Python" },
        { "text": "React" },
        { "text": "Node.js" },
        { "text": "PostgreSQL" },
        { "text": "Docker" },
        { "text": "AWS" },
        { "text": "Git" }
      ]
    },
    {
      "type": "certifications",
      "title": "Sertifikasi",
      "items": [
        { "text": "AWS Solutions Architect Associate", "startDate": "2023" }
      ]
    }
  ]
}

CONTOH EDGE CASES:
- CV berbahasa Indonesia: section titles tetap Indonesia, item text tetap Indonesia
- Bullet point yang terpisah baris: GABUNGKAN dalam satu item text dengan newline
- Email/phone di tengah baris: ekstrak ke contact section, jangan biarkan di experience
- Tanggal "2020 - Sekarang" atau "2020 - Present": gunakan endDate "Present"
- Nama tanpa kontak: tetap buat contact section dengan name saja`;

/**
 * Attempt to parse AI response JSON with multiple recovery strategies.
 */
function tryParseJson(raw: string): any | null {
  // Strategy 1: Direct parse
  try {
    return JSON.parse(raw);
  } catch { /* continue */ }

  // Strategy 2: Strip markdown fences
  let cleaned = raw.replace(/^```(?:json)?\s*/gm, '').replace(/```\s*$/gm, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch { /* continue */ }

  // Strategy 3: Fix trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
  try {
    return JSON.parse(cleaned);
  } catch { /* continue */ }

  // Strategy 4: Extract JSON object from mixed text (find outermost { ... })
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    let extracted = jsonMatch[0];
    // Fix trailing commas again on extracted portion
    extracted = extracted.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(extracted);
    } catch { /* continue */ }
  }

  return null;
}

/**
 * Post-process AI-parsed sections to validate and clean data.
 */
function postProcessSections(sections: ResumeSection[]): ResumeSection[] {
  const processed: ResumeSection[] = [];

  for (const section of sections) {
    let items = [...section.items];

    // Filter out items that are just URLs (except in contact/links sections)
    if (section.type !== 'contact' && section.type !== 'links') {
      items = items.filter(item => !looksLikeUrl(item.text));
    }

    // Filter out items that are just numbers or single words (< 10 chars, not contact)
    if (section.type !== 'contact' && section.type !== 'skills') {
      items = items.filter(item => {
        const trimmed = item.text.trim();
        // Allow short text if it contains metadata (contact info)
        if (item.metadata) return true;
        // Allow dates as startDate/endDate
        if (item.startDate || item.endDate) return true;
        // Remove items that are too short and look like noise
        return trimmed.length >= 10 || trimmed.split(/\s+/).length > 1;
      });
    }

    // Deduplicate items within the section
    const seen = new Set<string>();
    items = items.filter(item => {
      const key = item.text.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Validate contact section: must have at least a name-like item
    if (section.type === 'contact') {
      const hasName = items.some(item =>
        item.metadata?.field === 'name' ||
        item.text.trim().length > 2
      );
      if (!hasName && items.length === 0) {
        // Skip empty contact sections
        continue;
      }
    }

    // Clean up experience items: ensure they have meaningful content
    if (section.type === 'experience') {
      items = items.filter(item => {
        const text = item.text.trim();
        // Must have at least a company/role identifier
        return text.length >= 15 || text.includes('|') || text.includes('-');
      });
    }

    if (items.length > 0) {
      processed.push({
        ...section,
        items,
      });
    }
  }

  return processed;
}

function looksLikeUrl(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('www.') ||
    trimmed.match(/^[\w-]+\.\w{2,}\//) !== null
  );
}

/**
 * Parse CV text using AI (Deepseek via server proxy).
 * Falls back to local regex parser if server is unavailable.
 * Includes retry logic and post-processing validation.
 */
export async function parseResumeWithAI(text: string): Promise<MasterResume> {
  if (!text || text.trim().length === 0) {
    return {
      id: generateId(),
      sections: [],
      updatedAt: new Date(),
    };
  }

  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await invoke<{ result: string }>('call_ai', {
        prompt: `Parse this CV/resume text into structured JSON:\n\n${text}`,
        systemPrompt: AI_SYSTEM_PROMPT,
        task: 'cv_parsing',
      });
      const result = data.result || '';

      // Try to parse with multiple recovery strategies
      const parsed = tryParseJson(result);

      if (!parsed || !parsed.sections || !Array.isArray(parsed.sections)) {
        console.warn(`AI response missing sections array, attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
        if (attempt < MAX_RETRIES) continue;
        console.warn('AI returned invalid structure after retries, falling back to local parser');
        return parseResumeText(text);
      }

      // Convert AI response to MasterResume format
      const sections: ResumeSection[] = parsed.sections.map((s: any) => ({
        type: validateSectionType(s.type),
        title: s.title || s.type,
        items: (s.items || []).map((item: any) => {
          const resumeItem: ResumeItem = { text: String(item.text || '').trim() };
          if (item.startDate) resumeItem.startDate = String(item.startDate);
          if (item.endDate) resumeItem.endDate = String(item.endDate);
          if (item.metadata && typeof item.metadata === 'object') {
            resumeItem.metadata = item.metadata;
          }
          return resumeItem;
        }),
      }));

      // Post-process: validate, clean, deduplicate
      const cleanedSections = postProcessSections(sections);

      return {
        id: generateId(),
        sections: cleanedSections,
        updatedAt: new Date(),
      };
    } catch (err: any) {
      // Classify the error for better diagnostics
      if (err instanceof TypeError && err.message?.includes('fetch')) {
        console.warn(`AI parser network error (server unreachable), attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
      } else if (err.name === 'AbortError' || err.message?.includes('timeout')) {
        console.warn(`AI parser timeout, attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
      } else {
        console.warn(`AI parser error on attempt ${attempt + 1}/${MAX_RETRIES + 1}:`, err);
      }
      if (attempt < MAX_RETRIES) continue;
      return parseResumeText(text);
    }
  }

  // Should never reach here, but just in case
  return parseResumeText(text);
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
