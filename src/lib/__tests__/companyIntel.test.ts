import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createIntelCard, parseIntelResponse, requestResearch, labelClaims } from '../companyIntel';
import { db } from '../db';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core');

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
      overview: 'Acme Corp is a tech company founded in 2010',
      values: ['Innovation', 'Integrity'],
      workModel: 'Hybrid — 3 days office',
      compensation: 'Competitive salary + benefits',
      careerGrowth: ['Training budget', 'Mentorship program'],
      stability: 'Growing — 200+ employees',
      culture: ['Flat hierarchy', 'Fast-paced'],
      redFlags: ['High turnover rate'],
      interviewTips: ['Prepare system design questions'],
      sources: ['https://acme.com/about', 'https://glassdoor.com/acme'],
    });

    const parsed = parseIntelResponse(response);
    expect(parsed.overview).toContain('Acme Corp');
    expect(parsed.values).toHaveLength(2);
    expect(parsed.values).toContain('Innovation');
    expect(parsed.workModel).toBe('Hybrid — 3 days office');
    expect(parsed.stability).toBe('Growing — 200+ employees');
    expect(parsed.redFlags).toContain('High turnover rate');
    expect(parsed.sources).toHaveLength(2);
  });

  it('should handle missing fields in JSON gracefully', () => {
    const response = JSON.stringify({ overview: 'Partial data' });

    const parsed = parseIntelResponse(response);
    expect(parsed.overview).toBe('Partial data');
    expect(parsed.values).toEqual([]);
    expect(parsed.workModel).toBe('');
    expect(parsed.redFlags).toEqual([]);
    expect(parsed.sources).toEqual([]);
  });

  it('should fallback to legacy fields in JSON', () => {
    const response = JSON.stringify({
      snapshot: 'Legacy overview text',
      products: ['Product A'],
    });

    const parsed = parseIntelResponse(response);
    expect(parsed.overview).toBe('Legacy overview text');
  });

  it('should parse text format with sections', () => {
    const response = [
      'Overview: A well-known e-commerce company in Southeast Asia',
      'Values: Customer First, Innovation, Integrity',
      'Work Model: Remote-first with quarterly meetups',
      'Compensation: Market-rate salary, equity, health insurance',
      'Red Flags: Recent layoffs, Management changes',
    ].join('\n');

    const parsed = parseIntelResponse(response);
    expect(parsed.overview).toContain('e-commerce');
    expect(parsed.values).toHaveLength(3);
    expect(parsed.workModel).toContain('Remote-first');
    expect(parsed.redFlags).toHaveLength(2);
  });

  it('should parse text format with bullet points', () => {
    const response = [
      'Overview: Tech startup in Jakarta',
      'Values:',
      '- Innovation',
      '- Transparency',
      'Stability: Series B funded, 100+ employees',
    ].join('\n');

    const parsed = parseIntelResponse(response);
    expect(parsed.values).toContain('Innovation');
    expect(parsed.values).toContain('Transparency');
    expect(parsed.stability).toContain('Series B');
  });

  it('should handle completely empty response', () => {
    const parsed = parseIntelResponse('');
    expect(parsed.overview).toBe('');
    expect(parsed.values).toEqual([]);
    expect(parsed.workModel).toBe('');
    expect(parsed.redFlags).toEqual([]);
    expect(parsed.sources).toEqual([]);
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

    // Mock invoke to reject (simulating server down)
    vi.mocked(invoke).mockRejectedValue(new Error('Network error'));

    const result = await requestResearch(intel.id);
    expect(result).toBeNull();
  });

  it('should return null for non-existent intel', async () => {
    const result = await requestResearch('non-existent-id');
    expect(result).toBeNull();
  });
});
