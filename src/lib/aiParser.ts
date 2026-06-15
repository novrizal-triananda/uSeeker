import type { MasterResume, ResumeSection, ResumeItem, SectionType } from '../types';
import { parseResumeText } from './cvParser';

const API_BASE = 'http://127.0.0.1:8787';

const AI_SYSTEM_PROMPT = `Kamu adalah parser CV profesional. Tugasmu: ekstrak SEMUA data dari teks CV dan kembalikan dalam format JSON terstruktur.

ATURAN KRITIS:
1. Ekstrak SEMUA konten — jangan skip bagian apapun. Setiap baris teks harus ada di output.
2. Judul section dalam Bahasa Indonesia (Pengalaman Kerja, Pendidikan, Keahlian, dll)
3. Isi item tetap dalam Bahasa asli CV (jangan translate)
4. Satu entri pekerjaan = satu item (nama perusahaan + jabatan + tanggung jawab + bullet points = SATU item)
5. Skills individual, bukan per kategori
6. Format JSON HANYA — tidak ada markdown fence, tidak ada penjelasan

TYPE YANG VALID: contact, summary, experience, education, skills, certifications, projects, links

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
          "text": "PT Teknologi Nusantara | Software Engineer\\n- Developed microservices architecture serving 1M+ users\\n- Led team of 3 junior developers\\n- Reduced API response time by 40%",
          "startDate": "Jan 2022",
          "endDate": "Present"
        },
        {
          "text": "CV Digital Indonesia | Junior Developer\\n- Built responsive web applications using React\\n- Implemented CI/CD pipeline",
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
}`;

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
