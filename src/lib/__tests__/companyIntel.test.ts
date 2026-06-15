import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createIntelCard, parseIntelResponse, requestResearch, isBannedDomain, labelClaims } from '../companyIntel';
import { db } from '../db';

describe('createIntelCard', () => {
  beforeEach(async () => {
    await db.companyIntel.clear();
  });

  it('should create an intel card with crawlDepth 0', async () => {
    const intel = await createIntelCard({
      company: 'Acme Corp',
      officialUrl: 'https://acme.com',
    });

    expect(intel.id).toBeDefined();
    expect(intel.company).toBe('Acme Corp');
    expect(intel.officialUrl).toBe('https://acme.com');
    expect(intel.crawlDepth).toBe(0);
    expect(intel.sources).toEqual([]);
    expect(intel.createdAt).toBeInstanceOf(Date);
  });

  it('should persist in the database', async () => {
    const intel = await createIntelCard({
      company: 'TestCo',
      officialUrl: 'https://testco.io',
      jobId: 'job-1',
      notes: 'Interesting company',
    });

    const stored = await db.companyIntel.get(intel.id);
    expect(stored).toBeDefined();
    expect(stored?.company).toBe('TestCo');
    expect(stored?.jobId).toBe('job-1');
    expect(stored?.notes).toBe('Interesting company');
  });
});

describe('parseIntelResponse', () => {
  it('should parse a valid JSON response', () => {
    const response = JSON.stringify({
      snapshot: 'Acme Corp is a tech company founded in 2010',
      products: ['Acme Platform', 'Acme Analytics'],
      industry: 'Technology / SaaS',
      redFlags: ['High turnover rate'],
    });

    const parsed = parseIntelResponse(response);
    expect(parsed.snapshot).toContain('Acme Corp');
    expect(parsed.products).toHaveLength(2);
    expect(parsed.products).toContain('Acme Platform');
    expect(parsed.industry).toBe('Technology / SaaS');
    expect(parsed.redFlags).toContain('High turnover rate');
  });

  it('should handle missing fields in JSON gracefully', () => {
    const response = JSON.stringify({ snapshot: 'Partial data' });

    const parsed = parseIntelResponse(response);
    expect(parsed.snapshot).toBe('Partial data');
    expect(parsed.products).toEqual([]);
    expect(parsed.industry).toBe('');
    expect(parsed.redFlags).toEqual([]);
  });

  it('should parse text format with sections', () => {
    const response = [
      'Snapshot: A well-known e-commerce company in Southeast Asia',
      'Products: Lazada Marketplace, Lazada Wallet, Seller Center',
      'Industry: E-Commerce',
      'Red Flags: Recent layoffs, Management changes',
    ].join('\n');

    const parsed = parseIntelResponse(response);
    expect(parsed.snapshot).toContain('e-commerce');
    expect(parsed.products).toHaveLength(3);
    expect(parsed.industry).toBe('E-Commerce');
    expect(parsed.redFlags).toHaveLength(2);
  });

  it('should parse text format with bullet points', () => {
    const response = [
      'Snapshot: Tech startup in Jakarta',
      'Products:',
      '- MainApp v2',
      '- DeveloperTools',
      'Industry: FinTech',
    ].join('\n');

    const parsed = parseIntelResponse(response);
    expect(parsed.products).toContain('MainApp v2');
    expect(parsed.products).toContain('DeveloperTools');
    expect(parsed.industry).toBe('FinTech');
  });

  it('should handle completely empty response', () => {
    const parsed = parseIntelResponse('');
    expect(parsed.snapshot).toBe('');
    expect(parsed.products).toEqual([]);
    expect(parsed.industry).toBe('');
    expect(parsed.redFlags).toEqual([]);
  });
});

describe('isBannedDomain', () => {
  it('should detect LinkedIn', () => {
    expect(isBannedDomain('https://www.linkedin.com/company/acme')).toBe(true);
  });

  it('should detect Glassdoor', () => {
    expect(isBannedDomain('https://glassdoor.com/Reviews/acme-reviews')).toBe(true);
  });

  it('should detect Indeed', () => {
    expect(isBannedDomain('https://indeed.com/cmp/acme')).toBe(true);
  });

  it('should detect AmbitionBox', () => {
    expect(isBannedDomain('https://ambitionbox.com/overview/acme')).toBe(true);
  });

  it('should detect TeamBlind', () => {
    expect(isBannedDomain('https://teamblind.com/company/acme')).toBe(true);
  });

  it('should allow official company websites', () => {
    expect(isBannedDomain('https://acme.com')).toBe(false);
    expect(isBannedDomain('https://www.google.com')).toBe(false);
  });

  it('should handle invalid URLs gracefully', () => {
    expect(isBannedDomain('not-a-url')).toBe(false);
  });
});

describe('labelClaims', () => {
  it('should label claims with URLs as sourced', () => {
    const claims = labelClaims([
      'See https://acme.com/about for details',
      'Founded in 2010',
    ]);
    expect(claims[0].confidence).toBe('sourced');
    expect(claims[1].confidence).toBe('needs verification');
  });

  it('should label official claims as sourced', () => {
    const claims = labelClaims(['Official revenue: 50M USD']);
    expect(claims[0].confidence).toBe('sourced');
  });

  it('should label uncertain claims as needs verification', () => {
    const claims = labelClaims(['Estimated headcount: 500']);
    expect(claims[0].confidence).toBe('needs verification');
  });
});

describe('requestResearch', () => {
  beforeEach(async () => {
    await db.companyIntel.clear();
  });

  it('should return null when server is unavailable', async () => {
    const intel = await createIntelCard({
      company: 'TestCo',
      officialUrl: 'https://testco.com',
    });

    // Mock fetch to reject (simulating server down)
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    try {
      const result = await requestResearch(intel.id);
      expect(result).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should return null for banned domains', async () => {
    const intel = await createIntelCard({
      company: 'LinkedIn Corp',
      officialUrl: 'https://linkedin.com/company/test',
    });

    const result = await requestResearch(intel.id);
    expect(result).toBeNull();
  });

  it('should return null for non-existent intel', async () => {
    const result = await requestResearch('non-existent-id');
    expect(result).toBeNull();
  });
});
