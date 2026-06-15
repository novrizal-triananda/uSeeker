import { db } from './db';
import type { CompanyIntel } from '../types';

const API_BASE = 'http://127.0.0.1:8787';

const BANNED_DOMAINS = [
  'linkedin.com',
  'glassdoor.com',
  'indeed.com',
  'ambitionbox.com',
  'teamblind.com',
];

export type ClaimConfidence = 'sourced' | 'needs verification';

export interface IntelClaim {
  text: string;
  confidence: ClaimConfidence;
}

export interface ParsedIntelResponse {
  snapshot: string;
  products: string[];
  industry: string;
  redFlags: string[];
  culture: string[];
  recentNews: string[];
  interviewTips: string[];
}

/**
 * Check if a URL belongs to a banned domain (review sites, job boards).
 * These sources are unreliable for company intel.
 */
export function isBannedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BANNED_DOMAINS.some((d) => hostname.includes(d));
  } catch {
    return false;
  }
}

/**
 * Label AI-generated claims with confidence level.
 * Claims containing URLs or official markers are sourced.
 * All others are needs verification.
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
  let snapshot = "";
  let products: string[] = [];
  let industry = "";
  let redFlags: string[] = [];
  let culture: string[] = [];
  let recentNews: string[] = [];
  let interviewTips: string[] = [];

  // Try JSON first
  try {
    const parsed = JSON.parse(response);
    return {
      snapshot: parsed.snapshot || "",
      products: Array.isArray(parsed.products) ? parsed.products : [],
      industry: parsed.industry || "",
      redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
      culture: Array.isArray(parsed.culture) ? parsed.culture : [],
      recentNews: Array.isArray(parsed.recentNews) ? parsed.recentNews : [],
      interviewTips: Array.isArray(parsed.interviewTips) ? parsed.interviewTips : [],
    };
  } catch {
    // Not JSON - parse as text
  }

  // Parse line-based text format
  const lines = response.split("\n");
  let currentSection = "";

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^(?:snapshot|overview)[:\s]/i.test(trimmed)) {
      currentSection = "snapshot";
      const m = trimmed.match(/^(?:snapshot|overview)[:\s]+(.+)/i);
      if (m) snapshot = m[1].trim();
    } else if (/^products?[:\s]/i.test(trimmed)) {
      currentSection = "products";
      const m = trimmed.match(/^products?[:\s]+(.+)/i);
      if (m) {
        products = m[1]
          .split(/[,;]\s*/)
          .map((p) => p.trim())
          .filter(Boolean);
      }
    } else if (/^(?:industry|sector)[:\s]/i.test(trimmed)) {
      currentSection = "industry";
      const m = trimmed.match(/^(?:industry|sector)[:\s]+(.+)/i);
      if (m) industry = m[1].trim();
    } else if (/^(?:red\s*flags?|concerns?)[:\s]/i.test(trimmed)) {
      currentSection = "redFlags";
      const m = trimmed.match(/^(?:red\s*flags?|concerns?)[:\s]+(.+)/i);
      if (m) {
        redFlags = m[1]
          .split(/[,;]\s*/)
          .map((f) => f.trim())
          .filter(Boolean);
      }
    } else if (/^culture[:\s]/i.test(trimmed)) {
      currentSection = "culture";
      const m = trimmed.match(/^culture[:\s]+(.+)/i);
      if (m) {
        culture = m[1].split(/[,;]\s*/).map((c) => c.trim()).filter(Boolean);
      }
    } else if (/^(?:recent\s*news|berita)[:\s]/i.test(trimmed)) {
      currentSection = "recentNews";
      const m = trimmed.match(/^(?:recent\s*news|berita)[:\s]+(.+)/i);
      if (m) {
        recentNews = m[1].split(/[,;]\s*/).map((n) => n.trim()).filter(Boolean);
      }
    } else if (/^(?:interview\s*tips?|tips\s*wawancara)[:\s]/i.test(trimmed)) {
      currentSection = "interviewTips";
      const m = trimmed.match(/^(?:interview\s*tips?|tips\s*wawancara)[:\s]+(.+)/i);
      if (m) {
        interviewTips = m[1].split(/[,;]\s*/).map((t) => t.trim()).filter(Boolean);
      }
    } else if (/^[-*]\s+/.test(trimmed)) {
      // Bullet item under current section
      const item = trimmed.replace(/^[-*]\s+/, "").trim();
      if (!item) continue;
      switch (currentSection) {
        case "products":
          products.push(item);
          break;
        case "redFlags":
          redFlags.push(item);
          break;
        case "culture":
          culture.push(item);
          break;
        case "recentNews":
          recentNews.push(item);
          break;
        case "interviewTips":
          interviewTips.push(item);
          break;
      }
    } else if (currentSection === "snapshot" && trimmed.length > 0 && !trimmed.includes(":")) {
      snapshot = snapshot ? snapshot + " " + trimmed : trimmed;
    } else if (currentSection === "industry" && trimmed.length > 0 && !trimmed.includes(":")) {
      industry = industry ? industry + " " + trimmed : trimmed;
    }
  }

  return { snapshot, products, industry, redFlags, culture, recentNews, interviewTips };
}

/**
 * Fetch text content of a URL via the server-side proxy.
 * Returns null if the fetch fails.
 */
async function fetchUrlContent(url: string): Promise<string | null> {
  try {
    const res = await fetch(API_BASE + "/api/fetch-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.text || null;
  } catch {
    return null;
  }
}

/**
 * Search via DuckDuckGo as fallback when scraping fails.
 * Calls server-side /api/search endpoint which scrapes DuckDuckGo HTML results.
 */
async function searchViaDuckDuckGo(query: string): Promise<{ title: string; url: string; content: string }[]> {
  try {
    const res = await fetch(API_BASE + '/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).slice(0, 5).map((r: any) => ({
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
    const res = await fetch(API_BASE + "/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { text: data.text || "", links: data.links || [] };
  } catch {
    return null;
  }
}

/**
 * Filter and rank links by relevance for company research.
 * Prioritizes: about, products, news, career, investor pages.
 */
function filterRelevantLinks(
  links: { url: string; text: string }[],
  baseUrl: string,
  company: string,
): string[] {
  const baseHost = new URL(baseUrl).hostname;
  const keywords = ['about', 'tentang', 'product', 'produk', 'service', 'layanan',
    'news', 'berita', 'press', 'career', 'karir', 'investor', 'report', 'annual',
    'profile', 'profil', 'company', 'perusahaan'];

  return links
    .filter(l => {
      try {
        const host = new URL(l.url).hostname;
        // Same domain only
        if (!host.includes(baseHost.replace('www.', ''))) return false;
        // Skip fragments, downloads, images
        if (l.url.includes('#') || l.url.match(/\.(pdf|jpg|png|gif|zip)$/i)) return false;
        return true;
      } catch { return false; }
    })
    .sort((a, b) => {
      // Rank by keyword relevance
      const aText = (a.text + a.url).toLowerCase();
      const bText = (b.text + b.url).toLowerCase();
      const aScore = keywords.filter(k => aText.includes(k)).length;
      const bScore = keywords.filter(k => bText.includes(k)).length;
      return bScore - aScore;
    })
    .slice(0, 5) // Top 5 links
    .map(l => l.url);
}

/**
 * Request AI research for a company intel card.
 * Multi-page scraping: fetches main page, extracts links, follows top pages.
 * Returns null if server is down, intel not found, or URL is banned.
 */
export async function requestResearch(
  intelId: string,
  enrichmentUrls?: string[],
): Promise<ParsedIntelResponse | null> {
  const intel = await db.companyIntel.get(intelId);
  if (!intel) return null;

  if (isBannedDomain(intel.officialUrl)) return null;

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

  // Step 2b: DuckDuckGo fallback if main scrape yielded little content
  const totalContentLength = contentSections.join('').length;
  if (totalContentLength < 200) {
    const [profileResults, newsResults] = await Promise.all([
      searchViaDuckDuckGo(`${intel.company} company profile`),
      searchViaDuckDuckGo(`${intel.company} news`),
    ]);
    for (const r of profileResults) {
      if (r.content) {
        contentSections.push(
          `=== DUCKDUCKGO HASIL: ${r.title} (${r.url}) ===\n${r.content}\n=== AKHIR DUCKDUCKGO ===`
        );
        fetchedSources.push(r.url);
      }
    }
    for (const r of newsResults) {
      if (r.content && !fetchedSources.includes(r.url)) {
        contentSections.push(
          `=== DUCKDUCKGO HASIL: ${r.title} (${r.url}) ===\n${r.content}\n=== AKHIR DUCKDUCKGO ===`
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
        .filter((url) => !isBannedDomain(url))
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

  // Step 3b: DuckDuckGo fallback for failed enrichment URLs
  if (failedEnrichmentUrls.length > 0) {
    for (const failedUrl of failedEnrichmentUrls.slice(0, 3)) {
      let domain = '';
      try { domain = new URL(failedUrl).hostname.replace('www.', ''); } catch { continue; }
      const searchQuery = `${intel.company} site:${domain}`;
      const results = await searchViaDuckDuckGo(searchQuery);
      for (const r of results) {
        if (r.content && !fetchedSources.includes(r.url)) {
          contentSections.push(
            `=== DUCKDUCKGO HASIL: ${r.title} (${r.url}) ===\n${r.content}\n=== AKHIR DUCKDUCKGO ===`
          );
          fetchedSources.push(r.url);
        }
      }
    }
  }

  const systemPrompt =
    "Kamu adalah analis riset perusahaan senior yang membantu pencari kerja Indonesia " +
    "mengevaluasi calon tempat kerja secara mendalam dan akurat. " +
    "SEMUA output HARUS dalam Bahasa Indonesia. " +
    "Tugasmu adalah melakukan analisis KOMPREHENSIF — bukan sekadar ringkasan permukaan. " +
    "Gunakan SEMUA informasi dari konten website dan sumber yang diberikan untuk mengisi setiap field sejelas mungkin. " +
    "Kembalikan HANYA objek JSON valid dengan field-field berikut:\n\n" +
    '{\n' +
    '  "snapshot": "...",\n' +
    '  "products": [...],\n' +
    '  "industry": "...",\n' +
    '  "redFlags": [...],\n' +
    '  "culture": [...],\n' +
    '  "recentNews": [...],\n' +
    '  "interviewTips": [...]\n' +
    '}\n\n' +
    "Panduan pengisian setiap field:\n\n" +
    "**snapshot** (string, 3-5 kalimat): " +
    "Ringkasan mendalam perusahaan yang mencakup: sejarah pendirian (tahun, founder, visi awal), " +
    "ukuran perusahaan (jumlah karyawan estimasi, kantor di kota/negara mana saja), " +
    "fokus bisnis utama, dan pencapaian/signifikansi perusahaan di industrinya. " +
    "Jangan sekadar sebut nama — ceritakan KONTEKS perusahaan itu sendiri.\n\n" +
    "**products** (array of string): " +
    "Daftar produk/layanan UTAMA perusahaan. Untuk setiap item, sebutkan nama produk + penjelasan singkat apa fungsinya. " +
    "Contoh yang benar: \"[ nama produk ] — [ apa yang dilakukan ]\". " +
    "Jangan cuma daftar nama tanpa konteks.\n\n" +
    "**industry** (string): " +
    "Sektor/industri perusahaan, posisi di pasar (leader/challenger/niche), " +
    "dan competitor utama yang disebutkan di sumber. " +
    "Contoh: \"Fintech — salah satu pemain terbesar di Southeast Asia, bersaing dengan [competitor]\".\n\n" +
    "**redFlags** (array of string): " +
    "Potensi MASALAH nyata bagi pencari kerja. Cari indikator seperti: " +
    "masa kerja karyawan rata-rata sangat pendek (high turnover), " +
    "berita PHK massal atau restructuring, " +
    "masalah hukum/litigasi/perdata, " +
    "keuangan tidak stabil (burn rate tinggi, kerugian berturut-turut untuk startup), " +
    "work-life balance buruk (pulang larut, kerja Sabtu), " +
    "budaya micromanagement atau toxic. " +
    "Jika tidak ada red flags, tulis \"Tidak ditemukan red flags signifikan dari sumber yang tersedia\".\n\n" +
    "**culture** (array of string): " +
    "Info budaya kerja SPESIFIK berdasarkan sumber: " +
    "gaya manajemen (hierarkis vs flat), " +
    "model kerja (remote/hybrid/onsite), " +
    "nilai-nilai perusahaan yang ditekankan, " +
    "feedback dari karyawan tentang lingkungan kerja, " +
    "program kesejahteraan (benefits, training, wellness). " +
    "Jika ada informasi spesifik dari sumber, gunakan itu — jangan generalisir.\n\n" +
    "**recentNews** (array of string): " +
    "Perkembangan terbaru perusahaan (12 bulan terakhir): " +
    "peluncuran produk baru, akuisisi/merger, " +
    "perubahan kepemimpinan (CEO baru, dll), " +
    "pendanaan/seri investasi, " +
    "ekspansi pasar, " +
    "perubahan strategi bisnis. " +
    "Setiap item harus jelas: apa yang terjadi + kapan (perkiraan waktu jika ada).\n\n" +
    "**interviewTips** (array of string): " +
    "Tips SPESIFIK untuk wawancara di perusahaan ini: " +
    "proses rekrutmen (berapa tahap, apa formatnya), " +
    "pertanyaan umum yang sering ditanyakan, " +
    "apa yang perusahaan cari dari kandidat, " +
    "saran persiapan (teknologi yang perlu dipelajari, portofolio yang relevan), " +
    "etika bisnis perusahaan yang perlu dipahami kandidat. " +
    "Jika informasi spesifik tidak tersedia dari sumber, berikan tips umum namun relevan dengan industri perusahaan.\n\n" +
    "Jika informasi benar-benar tidak tersedia untuk suatu field, gunakan string kosong atau array kosong — " +
    "TIDAK BOLEH mengarang informasi yang tidak ada di sumber yang diberikan.";

  const prompt =
    "Lakukan riset mendalam tentang perusahaan \"" + intel.company + "\".\n\n" +
    "=== INFORMASI DASAR ===\n" +
    "Nama perusahaan: " + intel.company + "\n" +
    "Website resmi: " + intel.officialUrl + "\n" +
    "Sumber yang berhasil diakses: " + (fetchedSources.length > 0 ? fetchedSources.join(", ") : "tidak ada") + "\n\n" +
    (contentSections.length > 0
      ? "=== KONTEN DARI SUMBER ===\n" + contentSections.join("\n\n") + "\n=== AKHIR KONTEN ===\n\n"
      : "") +
    "Gunakan informasi di atas untuk mengisi setiap field dengan SEJUJUR dan SEDETAIL mungkin. " +
    "Jangan mengarang informasi — gunakan HANYA data dari sumber yang diberikan. " +
    "Jika sumber tidak menyediakan informasi untuk field tertentu, tulis \"Informasi tidak tersedia dari sumber yang ada\".\n" +
    "Kembalikan HANYA objek JSON, tanpa markdown formatting atau penjelasan tambahan.";

  try {
    const response = await fetch(API_BASE + "/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt,
        prompt,
        task: "company_research",
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const result = data.result || JSON.stringify(data);
    const parsed = parseIntelResponse(result);

    // Update intel card in DB
    await db.companyIntel.update(intelId, {
      snapshot: parsed.snapshot,
      products: parsed.products,
      industry: parsed.industry,
      redFlags: parsed.redFlags,
      culture: parsed.culture,
      recentNews: parsed.recentNews,
      interviewTips: parsed.interviewTips,
      crawlDepth: 1,
      sources: [...new Set([...intel.sources, ...fetchedSources])],
    });

    return parsed;
  } catch {
    // Graceful degradation - server down or network error
    return null;
  }
}
