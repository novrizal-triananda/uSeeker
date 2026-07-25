import { db } from './db';
import type { CompanyIntel } from '../types';
import { invoke } from '@tauri-apps/api/core';

export type ClaimConfidence = 'sourced' | 'needs verification';

export interface IntelClaim {
  text: string;
  confidence: ClaimConfidence;
}

export interface ParsedIntelResponse {
  overview: string;
  values: string[];
  workModel: string;
  compensation: string;
  careerGrowth: string[];
  stability: string;
  culture: string[];
  redFlags: string[];
  interviewTips: string[];
  sources: string[];
}

/**
 * Label AI-generated claims with confidence level.
 * Claims containing URLs or official markers are sourced.
 * All others need verification.
 */
export function labelClaims(items: string[]): IntelClaim[] {
  return items.map((text) => ({
    text,
    confidence:
      text.includes('http') || text.toLowerCase().includes('official')
        ? 'sourced'
        : 'needs verification',
  }));
}

/**
 * Create a new CompanyIntel card in the DB with crawlDepth=0.
 */
export async function createIntelCard(data: {
  jobId?: string;
  company: string;
  officialUrl: string;
  notes?: string;
  enrichmentUrls?: string[];
}): Promise<CompanyIntel> {
  const intel: CompanyIntel = {
    id: crypto.randomUUID(),
    jobId: data.jobId,
    company: data.company,
    officialUrl: data.officialUrl,
    notes: data.notes,
    enrichmentUrls: data.enrichmentUrls,
    crawlDepth: 0,
    sources: [],
    createdAt: new Date(),
  };

  await db.companyIntel.add(intel);
  return intel;
}

/**
 * Parse raw AI response string into structured intel data.
 * Handles JSON format and line-based text format.
 * Missing fields default to empty values.
 */
export function parseIntelResponse(response: string): ParsedIntelResponse {
  // Try JSON first
  try {
    const parsed = JSON.parse(response);
    return {
      overview: parsed.overview || parsed.snapshot || "",
      values: Array.isArray(parsed.values) ? parsed.values : [],
      workModel: parsed.workModel || "",
      compensation: parsed.compensation || "",
      careerGrowth: Array.isArray(parsed.careerGrowth) ? parsed.careerGrowth : [],
      stability: parsed.stability || "",
      culture: Array.isArray(parsed.culture) ? parsed.culture : [],
      redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
      interviewTips: Array.isArray(parsed.interviewTips) ? parsed.interviewTips : [],
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    };
  } catch {
    // Not JSON - parse as text
  }

  // Parse line-based text format
  const lines = response.split("\n");
  let currentSection = "";
  const result: ParsedIntelResponse = {
    overview: "",
    values: [],
    workModel: "",
    compensation: "",
    careerGrowth: [],
    stability: "",
    culture: [],
    redFlags: [],
    interviewTips: [],
    sources: [],
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^(?:overview|snapshot)[:\s]/i.test(trimmed)) {
      currentSection = "overview";
      const m = trimmed.match(/^(?:overview|snapshot)[:\s]+(.+)/i);
      if (m) result.overview = m[1].trim();
    } else if (/^values?[:\s]/i.test(trimmed)) {
      currentSection = "values";
      const m = trimmed.match(/^values?[:\s]+(.+)/i);
      if (m) {
        result.values = m[1].split(/[,;]\s*/).map((v) => v.trim()).filter(Boolean);
      }
    } else if (/^work[\s-]?model[:\s]/i.test(trimmed)) {
      currentSection = "workModel";
      const m = trimmed.match(/^work[\s-]?model[:\s]+(.+)/i);
      if (m) result.workModel = m[1].trim();
    } else if (/^compensation|benefits?|salary[:\s]/i.test(trimmed)) {
      currentSection = "compensation";
      const m = trimmed.match(/^(?:compensation|benefits?|salary)[:\s]+(.+)/i);
      if (m) result.compensation = m[1].trim();
    } else if (/^career[\s-]?growth[:\s]/i.test(trimmed)) {
      currentSection = "careerGrowth";
      const m = trimmed.match(/^career[\s-]?growth[:\s]+(.+)/i);
      if (m) {
        result.careerGrowth = m[1].split(/[,;]\s*/).map((g) => g.trim()).filter(Boolean);
      }
    } else if (/^stability[:\s]/i.test(trimmed)) {
      currentSection = "stability";
      const m = trimmed.match(/^stability[:\s]+(.+)/i);
      if (m) result.stability = m[1].trim();
    } else if (/^culture[:\s]/i.test(trimmed)) {
      currentSection = "culture";
      const m = trimmed.match(/^culture[:\s]+(.+)/i);
      if (m) {
        result.culture = m[1].split(/[,;]\s*/).map((c) => c.trim()).filter(Boolean);
      }
    } else if (/^(?:red[\s-]?flags?|concerns?)[:\s]/i.test(trimmed)) {
      currentSection = "redFlags";
      const m = trimmed.match(/^(?:red[\s-]?flags?|concerns?)[:\s]+(.+)/i);
      if (m) {
        result.redFlags = m[1].split(/[,;]\s*/).map((f) => f.trim()).filter(Boolean);
      }
    } else if (/^(?:interview[\s-]?tips?|tips[\s-]?wawancara)[:\s]/i.test(trimmed)) {
      currentSection = "interviewTips";
      const m = trimmed.match(/^(?:interview[\s-]?tips?|tips[\s-]?wawancara)[:\s]+(.+)/i);
      if (m) {
        result.interviewTips = m[1].split(/[,;]\s*/).map((t) => t.trim()).filter(Boolean);
      }
    } else if (/^sources?[:\s]/i.test(trimmed)) {
      currentSection = "sources";
      const m = trimmed.match(/^sources?[:\s]+(.+)/i);
      if (m) {
        result.sources = m[1].split(/[,;]\s*/).map((s) => s.trim()).filter(Boolean);
      }
    } else if (/^[-*]\s+/.test(trimmed)) {
      // Bullet item under current section
      const item = trimmed.replace(/^[-*]\s+/, "").trim();
      if (!item) continue;
      switch (currentSection) {
        case "values": result.values.push(item); break;
        case "careerGrowth": result.careerGrowth.push(item); break;
        case "culture": result.culture.push(item); break;
        case "redFlags": result.redFlags.push(item); break;
        case "interviewTips": result.interviewTips.push(item); break;
        case "sources": result.sources.push(item); break;
      }
    } else if (currentSection === "overview" && trimmed.length > 0 && !trimmed.includes(":")) {
      result.overview = result.overview ? result.overview + " " + trimmed : trimmed;
    } else if (currentSection === "workModel" && trimmed.length > 0 && !trimmed.includes(":")) {
      result.workModel = result.workModel ? result.workModel + " " + trimmed : trimmed;
    } else if (currentSection === "compensation" && trimmed.length > 0 && !trimmed.includes(":")) {
      result.compensation = result.compensation ? result.compensation + " " + trimmed : trimmed;
    } else if (currentSection === "stability" && trimmed.length > 0 && !trimmed.includes(":")) {
      result.stability = result.stability ? result.stability + " " + trimmed : trimmed;
    }
  }

  return result;
}

/**
 * Fetch text content of a URL via the server-side proxy.
 * Returns null if the fetch fails.
 */
async function fetchUrlContent(url: string): Promise<string | null> {
  try {
    const data = await invoke<{ text: string }>('fetch_url', { url });
    return data.text || null;
  } catch {
    return null;
  }
}

/**
 * Search via web search as fallback when scraping fails.
 */
async function searchWeb(query: string): Promise<{ title: string; url: string; content: string }[]> {
  try {
    const results = await invoke<{ title: string; url: string; content: string }[]>('search_web', { query });
    return (results || []).slice(0, 5).map((r) => ({
      title: r.title || '',
      url: r.url || '',
      content: r.content || ''
    }));
  } catch { return []; }
}

/**
 * Scrape a URL and return both text content and extracted links.
 */
async function scrapeUrl(url: string): Promise<{ text: string; links: { url: string; text: string }[] } | null> {
  try {
    const data = await invoke<{ text: string; links: { url: string; text: string }[] }>('scrape_url', { url });
    return { text: data.text || "", links: data.links || [] };
  } catch {
    return null;
  }
}

/**
 * Filter and rank links by relevance for company research.
 * Prioritizes: about, values, career, investor pages.
 */
function filterRelevantLinks(
  links: { url: string; text: string }[],
  baseUrl: string,
  _company: string,
): string[] {
  let baseHost: string;
  try {
    baseHost = new URL(baseUrl).hostname;
  } catch {
    return [];
  }
  const keywords = ['about', 'tentang', 'values', 'nilai', 'vision', 'visi', 'mission', 'misi',
    'career', 'karir', 'benefits', 'culture', 'budaya', 'investor', 'report', 'annual',
    'profile', 'profil', 'company', 'perusahaan', 'work', 'team', 'leadership'];

  return links
    .filter(l => {
      try {
        const host = new URL(l.url).hostname;
        if (!host.includes(baseHost.replace('www.', ''))) return false;
        if (l.url.includes('#') || l.url.match(/\.(pdf|jpg|png|gif|zip)$/i)) return false;
        return true;
      } catch { return false; }
    })
    .sort((a, b) => {
      const aText = (a.text + a.url).toLowerCase();
      const bText = (b.text + b.url).toLowerCase();
      const aScore = keywords.filter(k => aText.includes(k)).length;
      const bScore = keywords.filter(k => bText.includes(k)).length;
      return bScore - aScore;
    })
    .slice(0, 5)
    .map(l => l.url);
}

/**
 * Request AI research for a company intel card.
 * Multi-page scraping: fetches main page, extracts links, follows top pages.
 * Returns null if AI is unavailable or intel not found.
 */
export async function requestResearch(
  intelId: string,
  enrichmentUrls?: string[],
): Promise<ParsedIntelResponse | null> {
  const intel = await db.companyIntel.get(intelId);
  if (!intel) return null;

  const contentSections: string[] = [];
  const fetchedSources: string[] = [];

  // Step 1: Scrape main website (get text + links)
  if (intel.officialUrl) {
    const mainScrape = await scrapeUrl(intel.officialUrl);
    if (mainScrape?.text) {
      contentSections.push(
        `=== KONTEN WEBSITE RESMI ${intel.company} (${intel.officialUrl}) ===\n${mainScrape.text}\n=== AKHIR WEBSITE RESMI ===`
      );
      fetchedSources.push(intel.officialUrl);

      // Step 2: Follow top relevant links for deeper scraping
      if (mainScrape.links.length > 0) {
        const relevantUrls = filterRelevantLinks(mainScrape.links, intel.officialUrl, intel.company);
        const subResults = await Promise.allSettled(
          relevantUrls.map(async (url) => {
            const result = await fetchUrlContent(url);
            return { url, content: result };
          }),
        );
        for (const r of subResults) {
          if (r.status === "fulfilled" && r.value.content) {
            const truncated = r.value.content.length > 4000
              ? r.value.content.slice(0, 4000) + "\n...[truncated]"
              : r.value.content;
            contentSections.push(
              `=== KONTEN HALAMAN: ${r.value.url} ===\n${truncated}\n=== AKHIR HALAMAN ===`
            );
            fetchedSources.push(r.value.url);
          }
        }
      }
    }
  }

  // Step 2b: Targeted web search for diverse data sources
  // Run queries to fill gaps — prioritize interview, salary, red flags
  const totalContentLength = contentSections.join('').length;
  const QUERIES_MINIMAL = [
    { query: `${intel.company} interview tips salary review`, tag: "interview" },
    { query: `${intel.company} red flags employee review`, tag: "redflags" },
  ];
  const QUERIES_FULL = [
    ...QUERIES_MINIMAL,
    { query: `${intel.company} company culture values work environment`, tag: "culture" },
    { query: `${intel.company} recruitment process tahapan wawancara`, tag: "interview" },
    { query: `${intel.company} gaji tunjangan benefits karyawan`, tag: "compensation" },
    { query: `${intel.company} career growth promotion training`, tag: "growth" },
    { query: `${intel.company} news 2025 2026 update`, tag: "news" },
  ];

  // If website content is substantial (>2000 chars), only run minimal queries
  // If thin (<2000 chars), run all queries to compensate
  const queriesToRun = totalContentLength > 2000 ? QUERIES_MINIMAL : QUERIES_FULL;

  const searchResults = await Promise.allSettled(
    queriesToRun.map(async (sq) => {
      const results = await searchWeb(sq.query);
      return { tag: sq.tag, results };
    })
  );

  for (const settled of searchResults) {
    if (settled.status !== "fulfilled") continue;
    const { tag, results } = settled.value;
    for (const r of results.slice(0, 3)) {  // max 3 results per query
      if (r.content && !fetchedSources.includes(r.url)) {
        const truncated = r.content.length > 800
          ? r.content.slice(0, 800) + "...[truncated]"
          : r.content;
        contentSections.push(
          `=== HASIL PENCARIAN [${tag}]: ${r.title} (${r.url}) ===\n${truncated}\n=== AKHIR HASIL ===`
        );
        fetchedSources.push(r.url);
      }
    }
  }

  // Step 3: Fetch enrichment URLs
  const enrichmentList = enrichmentUrls || intel.enrichmentUrls || [];
  const failedEnrichmentUrls: string[] = [];
  if (enrichmentList.length > 0) {
    const enrichResults = await Promise.allSettled(
      enrichmentList
        .filter((url) => {
          try { return new URL(url).protocol.startsWith('http'); } catch { return false; }
        })
        .map(async (url) => ({ url, content: await fetchUrlContent(url) })),
    );
    for (const r of enrichResults) {
      if (r.status === "fulfilled" && r.value.content) {
        const truncated = r.value.content.length > 4000
          ? r.value.content.slice(0, 4000) + "\n...[truncated]"
          : r.value.content;
        contentSections.push(
          `=== KONTEN SUMBER: ${r.value.url} ===\n${truncated}\n=== AKHIR SUMBER ===`
        );
        fetchedSources.push(r.value.url);
      } else if (r.status === "fulfilled" && !r.value.content) {
        failedEnrichmentUrls.push(r.value.url);
      }
    }
  }

  // Step 3b: Web search fallback for failed enrichment URLs
  if (failedEnrichmentUrls.length > 0) {
    for (const failedUrl of failedEnrichmentUrls.slice(0, 3)) {
      let domain = '';
      try { domain = new URL(failedUrl).hostname.replace('www.', ''); } catch { continue; }
      const searchQuery = `${intel.company} site:${domain}`;
      const results = await searchWeb(searchQuery);
      for (const r of results) {
        if (r.content && !fetchedSources.includes(r.url)) {
          contentSections.push(
            `=== HASIL PENCARIAN: ${r.title} (${r.url}) ===\n${r.content}\n=== AKHIR HASIL ===`
          );
          fetchedSources.push(r.url);
        }
      }
    }
  }

  const systemPrompt = getCompanyResearchPrompt();

  const contentBlock = contentSections.length > 0
    ? "=== KONTEN DARI SUMBER ===\n" + contentSections.join("\n\n").slice(0, 12000) + "\n=== AKHIR KONTEN ===\n\n"
    : "";

  // Truncate total content to prevent AI context overflow
  const MAX_CONTENT = 12000;
  const truncatedBlock = contentBlock.length > MAX_CONTENT
    ? contentBlock.slice(0, MAX_CONTENT) + "\n...[konten dipotong karena terlalu panjang]"
    : contentBlock;

  const sourceNote = fetchedSources.length > 0
    ? "Sumber yang berhasil diakses: " + fetchedSources.join(", ")
    : "Tidak ada sumber berhasil diakses. Gunakan pengetahuan umum dari training data dan tandai sebagai 'General knowledge'.";

  const prompt =
    "Lakukan riset mendalam tentang perusahaan \"" + intel.company + "\".\n\n" +
    "=== INFORMASI DASAR ===\n" +
    "Nama perusahaan: " + intel.company + "\n" +
    "Website resmi: " + intel.officialUrl + "\n" +
    sourceNote + "\n\n" +
    truncatedBlock +
    "Gunakan informasi di atas untuk mengisi setiap field dengan SEJUHUR dan SEDETAIL mungkin. " +
    "Jangan mengarang informasi — gunakan HANYA data dari sumber yang diberikan atau pengetahuan umum yang kamu yakin benar. " +
    "Kalau informasi benar-benar tidak tersedia, tulis 'Informasi tidak tersedia dari sumber yang ada'.\n" +
    "Kembalikan HANYA objek JSON, tanpa markdown formatting atau penjelasan tambahan.";

  try {
    const data = await invoke<{ result: string }>('call_ai', {
      prompt,
      systemPrompt,
      task: 'company_research',
    });
    const result = data.result || JSON.stringify(data);
    const parsed = parseIntelResponse(result);

    // Merge fetched sources with AI-reported sources
    const allSources = [...new Set([...fetchedSources, ...parsed.sources])];

    // Update intel card in DB
    await db.companyIntel.update(intelId, {
      overview: parsed.overview,
      values: parsed.values,
      workModel: parsed.workModel,
      compensation: parsed.compensation,
      careerGrowth: parsed.careerGrowth,
      stability: parsed.stability,
      culture: parsed.culture,
      redFlags: parsed.redFlags,
      interviewTips: parsed.interviewTips,
      sources: allSources,
      crawlDepth: 1,
    });

    return parsed;
  } catch {
    // Graceful degradation - server down or network error
    return null;
  }
}

/**
 * System prompt for company research — career decision focus.
 * Instructs AI to help job seekers evaluate if a company is good for their
 * long-term career, not just for passing interviews.
 */
function getCompanyResearchPrompt(): string {
  return `Kamu adalah analis riset perusahaan karier yang membantu pencari kerja Indonesia
mengevaluasi apakah suatu perusahaan BAIK untuk masa depan karir mereka — bukan sekadar lolos wawancara.

SEMUA output HARUS dalam Bahasa Indonesia.

Tugasmu adalah melakukan analisis KOMPREHENSIF tentang perusahaan untuk membantu keputusan karir.
Kamu akan menerima data dari BERBAGAI sumber: website resmi, hasil pencarian web (termasuk Glassdoor, Indeed, LinkedIn, Jobstreet, berita, forum).
Gunakan SEMUA informasi yang tersedia — bukan cuma dari website resmi.
Kembalikan HANYA objek JSON valid dengan field-field berikut:

{
  "overview": "...",
  "values": [...],
  "workModel": "...",
  "compensation": "...",
  "careerGrowth": [...],
  "stability": "...",
  "culture": [...],
  "redFlags": [...],
  "interviewTips": [...],
  "sources": [...]
}

Panduan pengisian setiap field:

**overview** (string, 3-5 kalimat):
Ringkasan mendalam perusahaan: sejarah pendirian, ukuran (karyawan, kantor), fokus bisnis utama,
dan posisi di industri. Sertakan website resmi dan informasi yang bisa diverifikasi.

**values** (array of string):
Core values, visi, dan misi perusahaan. Cari di halaman "About", "Our Values", "Vision & Mission".
Untuk setiap item, sebutkan nama value + penjelasan singkat.
Contoh: "Innovation — Mendorong karyawan untuk bereksperimen dan gagal tanpa takut"

**workModel** (string):
Gaya kerja: remote/hybrid/onsite, jam kerja, lokasi kantor, kebijakan WFH.
Sertakan informasi spesifik yang ditemukan di sumber.

**compensation** (string):
Range gaji (jika tersedia), benefits, tunjangan, bonus structure.
Sebutkan sumber data gaji jika ada (Glassdoor, indeed, dll).

**careerGrowth** (array of string):
Peluang pengembangan karir: training, mentoring, jalur promosi, rotasi posisi,
dukungan sertifikasi/pendidikan. Sebutkan program spesifik jika ada.

**stability** (string):
Kestabilan perusahaan: kondisi keuangan, pertumbuhan pasar, tren hiring,
akuisisi/merger, pendanaan terakhir. Apakah perusahaan sedang tumbuh atau menyusut?

**culture** (array of string):
Budaya kerja SPESIFIK berdasarkan sumber: gaya manajemen, model kerja,
nilai-nilai yang ditekankan, feedback dari karyawan, program kesejahteraan.
Jika ada informasi dari review sites, sebutkan itu.

**redFlags** (array of string):
Potensi MASALAH nyata bagi pencari kerja: high turnover, PHK massal,
masalah hukum, keuangan tidak stabil, WLB buruk, toxic culture.
Jika tidak ada red flags, tulis "Tidak ditemukan red flags signifikan dari sumber yang tersedia".

**interviewTips** (array of string):
Tips SPESIFIK untuk wawancara: proses rekrutmen, tahapan, pertanyaan umum,
apa yang perusahaan cari, saran persiapan, etika bisnis.
Cari dari: hasil pencarian "interview", Glassdoor, Indeed, forum karyawan.
Jika tidak ada info spesifik dari sumber, tulis "Informasi tidak tersedia dari sumber yang ada".

**sources** (array of string):
Daftar URL sumber informasi yang kamu gunakan untuk analisis ini.
Include SEMUA URL dari konten yang diberikan — website resmi, Glassdoor, LinkedIn, Indeed, berita, dll.
Jika menggunakan pengetahuan umum, tambahkan "(General knowledge)" sebagai item terakhir.

ATURAN PENTING:
- Jangan mengarang informasi. Gunakan HANYA data dari sumber yang diberikan + pengetahuan umum yang kamu yakin benar.
- Setiap klaim harus bisa diverifikasi. Sebutkan sumbernya.
- Jika informasi tidak tersedia untuk field tertentu, tulis "Informasi tidak tersedia dari sumber yang ada".
- Output final HARUS dalam Bahasa Indonesia.
- Kembalikan HANYA objek JSON, tanpa markdown formatting.`;
}
