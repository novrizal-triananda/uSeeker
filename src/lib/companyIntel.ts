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

  // Try JSON first
  try {
    const parsed = JSON.parse(response);
    return {
      snapshot: parsed.snapshot || "",
      products: Array.isArray(parsed.products) ? parsed.products : [],
      industry: parsed.industry || "",
      redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
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
      }
    } else if (currentSection === "snapshot" && trimmed.length > 0 && !trimmed.includes(":")) {
      snapshot = snapshot ? snapshot + " " + trimmed : trimmed;
    } else if (currentSection === "industry" && trimmed.length > 0 && !trimmed.includes(":")) {
      industry = industry ? industry + " " + trimmed : trimmed;
    }
  }

  return { snapshot, products, industry, redFlags };
}

/**
 * Request AI research for a company intel card.
 * Calls server proxy POST /api/ai with task=company_research.
 * Returns null if server is down, intel not found, or URL is banned.
 */
export async function requestResearch(
  intelId: string,
): Promise<ParsedIntelResponse | null> {
  const intel = await db.companyIntel.get(intelId);
  if (!intel) return null;

  if (isBannedDomain(intel.officialUrl)) return null;

  try {
    const response = await fetch(API_BASE + "/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt:
          "You are a company research analyst helping job seekers evaluate potential employers. " +
          "Return ONLY a valid JSON object with exactly these fields: " +
          '{"snapshot": "...", "products": [...], "industry": "...", "redFlags": [...]}. ' +
          "snapshot: 1-2 sentence company overview. products: array of main products/services. " +
          "industry: sector/industry string. redFlags: array of potential concerns for job seekers " +
          "(e.g., layoffs, financial trouble, lawsuits, poor work-life balance signals). " +
          "Use empty strings/arrays if information is unavailable.",
        prompt:
          "Research the company " + intel.company + " (website: " + intel.officialUrl + "). " +
          "Provide a brief overview, list their main products/services, identify their industry, " +
          "and flag any potential red flags for job seekers (e.g., recent layoffs, lawsuits, " +
          "financial instability, poor employee reviews). " +
          "Return ONLY the JSON object, no markdown or explanation.",
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
      crawlDepth: 1,
      sources: [...new Set([...intel.sources, intel.officialUrl])],
    });

    return parsed;
  } catch {
    // Graceful degradation - server down or network error
    return null;
  }
}
