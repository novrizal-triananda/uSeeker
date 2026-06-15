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
}): Promise<CompanyIntel> {
  const intel: CompanyIntel = {
    id: crypto.randomUUID(),
    jobId: data.jobId,
    company: data.company,
    officialUrl: data.officialUrl,
    notes: data.notes,
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
 * Request AI research for a company intel card.
 * Calls server proxy POST /api/ai with task=company_research.
 * Returns null if server is down, intel not found, or URL is banned.
 */
export async function requestResearch(
  intelId: string,
  enrichmentUrls?: string[],
): Promise<ParsedIntelResponse | null> {
  const intel = await db.companyIntel.get(intelId);
  if (!intel) return null;

  if (isBannedDomain(intel.officialUrl)) return null;

  // Collect enrichment sources: user-provided + official URL
  const allSources = [
    intel.officialUrl,
    ...(enrichmentUrls || intel.enrichmentUrls || []),
  ].filter(Boolean);

  try {
    const response = await fetch(API_BASE + "/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt:
          "Kamu adalah analis riset perusahaan yang membantu pencari kerja mengevaluasi calon tempat kerja. " +
          "SEMUA output HARUS dalam Bahasa Indonesia. " +
          "Kembalikan HANYA objek JSON valid dengan field-field berikut: " +
          '{"snapshot": "...", "products": [...], "industry": "...", ' +
          '"redFlags": [...], "culture": [...], "recentNews": [...], "interviewTips": [...]}. ' +
          "- snapshot: Ringkasan perusahaan 2-3 kalimat (sejarah, ukuran, fokus bisnis). " +
          "- products: Array produk/layanan utama perusahaan. " +
          "- industry: Sektor/industri perusahaan. " +
          "- redFlags: Array potensi masalah bagi pencari kerja (PHK, masalah hukum, keuangan tidak stabil, work-life balance buruk). " +
          "- culture: Array info budaya kerja (gaya manajemen, remote/hybrid, nilai perusahaan, kepuasan karyawan). " +
          "- recentNews: Array berita terbaru perusahaan (peluncuran produk, akuisisi, perubahan strategi, tahun terakhir). " +
          "- interviewTips: Array tips untuk wawancara di perusahaan ini (proses rekrutmen, pertanyaan umum, apa yang dicari, saran persiapan). " +
          "Gunakan string kosong atau array kosong jika informasi tidak tersedia.",
        prompt:
          "Riset perusahaan " + intel.company + " (website: " + intel.officialUrl + "). " +
          "Berikut sumber-sumber tambahan untuk diriset: " + allSources.join(", ") + ". " +
          "Analisis menyeluruh harus mencakup: " +
          "1. Sejarah singkat dan ukuran perusahaan (jumlah kantor, karyawan). " +
          "2. Produk dan layanan utama. " +
          "3. Industri dan posisi pasar. " +
          "4. Potensi red flags bagi pencari kerja (PHK, masalah hukum, keuangan, budaya kerja). " +
          "5. Budaya kerja dan lingkungan perusahaan. " +
          "6. Berita terbaru dan perkembangan perusahaan. " +
          "7. Tips dan saran untuk proses wawancara di perusahaan ini. " +
          "Kembalikan HANYA objek JSON, tanpa markdown atau penjelasan tambahan.",
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
      sources: [...new Set([...intel.sources, intel.officialUrl])],
    });

    return parsed;
  } catch {
    // Graceful degradation - server down or network error
    return null;
  }
}
