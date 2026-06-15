import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import {
  getConsolidatedView,
  getAllConsolidatedViews,
  getExportData,
  getInterviewPrep,
  getPipelineSummary,
} from '../dataHub';
import type {
  JobEntry,
  FitScore,
  CompanyIntel,
  TailoredResume,
  Application,
} from '../../types';

const now = new Date();

const sampleJob: JobEntry = {
  id: 'job-1',
  company: 'Acme Corp',
  roleTitle: 'Senior Developer',
  jobDescription: 'Build amazing things',
  createdAt: now,
};

const sampleJob2: JobEntry = {
  id: 'job-2',
  company: 'TechStart',
  roleTitle: 'Full Stack Engineer',
  jobDescription: 'Work on exciting projects',
  createdAt: now,
};

const sampleFitScore: FitScore = {
  id: 'fs-1',
  jobId: 'job-1',
  overallScore: 85,
  skillMatch: 90,
  experienceMatch: 80,
  preferenceMatch: 75,
  matchedSkills: ['react', 'typescript'],
  missingSkills: ['vue'],
  calculatedAt: now,
};

const sampleIntel: CompanyIntel = {
  id: 'ci-1',
  jobId: 'job-1',
  company: 'Acme Corp',
  officialUrl: 'https://acme.com',
  snapshot: 'Acme is a tech company',
  products: ['Product A', 'Product B'],
  industry: 'Technology',
  redFlags: ['High turnover'],
  crawlDepth: 1,
  sources: ['https://acme.com'],
  createdAt: now,
};

const sampleTailoredResume: TailoredResume = {
  id: 'tr-1',
  jobId: 'job-1',
  masterResumeId: 'mr-1',
  suggestions: [
    { section: 'experience', original: 'Built apps', suggested: 'Built enterprise apps', reason: 'Better fit', accepted: true },
    { section: 'skills', original: 'React', suggested: 'React, TypeScript', reason: 'Match JD', accepted: false },
  ],
  createdAt: now,
};

const sampleApp: Application = {
  id: 'app-1',
  jobId: 'job-1',
  company: 'Acme Corp',
  roleTitle: 'Senior Developer',
  status: 'interview',
  dateApplied: now,
  lastUpdated: now,
};

describe('getConsolidatedView', () => {
  beforeEach(async () => {
    await db.jobEntries.clear();
    await db.fitScores.clear();
    await db.companyIntel.clear();
    await db.tailoredResumes.clear();
    await db.applications.clear();
  });

  it('should return all entities for a given jobId', async () => {
    await db.jobEntries.add(sampleJob);
    await db.fitScores.add(sampleFitScore);
    await db.companyIntel.add(sampleIntel);
    await db.tailoredResumes.add(sampleTailoredResume);
    await db.applications.add(sampleApp);

    const view = await getConsolidatedView('job-1');

    expect(view).not.toBeNull();
    expect(view!.jobEntry.company).toBe('Acme Corp');
    expect(view!.fitScore?.overallScore).toBe(85);
    expect(view!.companyIntel?.company).toBe('Acme Corp');
    expect(view!.tailoredResume?.suggestions.length).toBe(2);
    expect(view!.application?.status).toBe('interview');
  });

  it('should return null for non-existent jobId', async () => {
    const view = await getConsolidatedView('non-existent');
    expect(view).toBeNull();
  });

  it('should handle partial data (only job entry)', async () => {
    await db.jobEntries.add(sampleJob);

    const view = await getConsolidatedView('job-1');

    expect(view).not.toBeNull();
    expect(view!.jobEntry).toBeDefined();
    expect(view!.fitScore).toBeNull();
    expect(view!.companyIntel).toBeNull();
    expect(view!.tailoredResume).toBeNull();
    expect(view!.application).toBeNull();
  });
});

describe('getAllConsolidatedViews', () => {
  beforeEach(async () => {
    await db.jobEntries.clear();
    await db.fitScores.clear();
    await db.companyIntel.clear();
    await db.tailoredResumes.clear();
    await db.applications.clear();
  });

  it('should return views for all jobs', async () => {
    await db.jobEntries.add(sampleJob);
    await db.jobEntries.add(sampleJob2);
    await db.fitScores.add(sampleFitScore);
    await db.applications.add(sampleApp);

    const views = await getAllConsolidatedViews();

    expect(views.length).toBe(2);
    expect(views[0].jobEntry.company).toBe('Acme Corp');
    expect(views[1].jobEntry.company).toBe('TechStart');
  });

  it('should return empty array when no jobs exist', async () => {
    const views = await getAllConsolidatedViews();
    expect(views.length).toBe(0);
  });
});

describe('getExportData', () => {
  beforeEach(async () => {
    await db.jobEntries.clear();
    await db.fitScores.clear();
    await db.companyIntel.clear();
    await db.tailoredResumes.clear();
    await db.applications.clear();
  });

  it('should export data as JSON', async () => {
    await db.jobEntries.add(sampleJob);
    await db.fitScores.add(sampleFitScore);
    await db.applications.add(sampleApp);

    const json = await getExportData('json');
    const parsed = JSON.parse(json);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);
    expect(parsed[0].jobEntry.company).toBe('Acme Corp');
    expect(parsed[0].fitScore.overallScore).toBe(85);
  });

  it('should export data as text', async () => {
    await db.jobEntries.add(sampleJob);
    await db.fitScores.add(sampleFitScore);
    await db.applications.add(sampleApp);

    const text = await getExportData('text');

    expect(text).toContain('uSeeker Export');
    expect(text).toContain('Acme Corp');
    expect(text).toContain('Senior Developer');
    expect(text).toContain('Fit Score: 85/100');
    expect(text).toContain('Status: interview');
  });

  it('should export text with company intel', async () => {
    await db.jobEntries.add(sampleJob);
    await db.companyIntel.add(sampleIntel);

    const text = await getExportData('text');

    expect(text).toContain('Company Intel:');
    expect(text).toContain('Technology');
    expect(text).toContain('Product A');
    expect(text).toContain('Red Flags: High turnover');
  });

  it('should export empty data correctly', async () => {
    const json = await getExportData('json');
    const parsed = JSON.parse(json);
    expect(parsed.length).toBe(0);

    const text = await getExportData('text');
    expect(text).toContain('Total jobs: 0');
  });
});

describe('getInterviewPrep', () => {
  beforeEach(async () => {
    await db.jobEntries.clear();
    await db.fitScores.clear();
    await db.companyIntel.clear();
    await db.tailoredResumes.clear();
    await db.applications.clear();
  });

  it('should return interview prep data when application exists', async () => {
    await db.jobEntries.add(sampleJob);
    await db.fitScores.add(sampleFitScore);
    await db.companyIntel.add(sampleIntel);
    await db.tailoredResumes.add(sampleTailoredResume);
    await db.applications.add(sampleApp);

    const prep = await getInterviewPrep('job-1');

    expect(prep).not.toBeNull();
    expect(prep!.companyIntel?.company).toBe('Acme Corp');
    expect(prep!.fitScore?.overallScore).toBe(85);
    expect(prep!.tailoredResume?.suggestions.length).toBe(2);
    expect(prep!.application?.status).toBe('interview');
  });

  it('should return null when no application exists', async () => {
    await db.jobEntries.add(sampleJob);
    await db.fitScores.add(sampleFitScore);
    await db.companyIntel.add(sampleIntel);

    const prep = await getInterviewPrep('job-1');

    expect(prep).toBeNull();
  });

  it('should handle partial intel gracefully', async () => {
    await db.jobEntries.add(sampleJob);
    await db.applications.add(sampleApp);

    const prep = await getInterviewPrep('job-1');

    expect(prep).not.toBeNull();
    expect(prep!.companyIntel).toBeNull();
    expect(prep!.fitScore).toBeNull();
    expect(prep!.tailoredResume).toBeNull();
    expect(prep!.application).toBeDefined();
  });
});

describe('getPipelineSummary', () => {
  it('should calculate pipeline stats from applications', async () => {
    const apps: Application[] = [
      { id: '1', jobId: 'j1', company: 'A', roleTitle: 'Dev', status: 'applied', dateApplied: now, lastUpdated: now },
      { id: '2', jobId: 'j2', company: 'B', roleTitle: 'Dev', status: 'screen', dateApplied: now, lastUpdated: now },
      { id: '3', jobId: 'j3', company: 'C', roleTitle: 'Dev', status: 'interview', dateApplied: now, lastUpdated: now },
      { id: '4', jobId: 'j4', company: 'D', roleTitle: 'Dev', status: 'rejected', dateApplied: now, lastUpdated: now },
    ];

    await db.fitScores.bulkAdd([
      { id: 'fs1', jobId: 'j1', overallScore: 70, skillMatch: 70, experienceMatch: 70, preferenceMatch: 70, matchedSkills: [], missingSkills: [], calculatedAt: now },
      { id: 'fs2', jobId: 'j2', overallScore: 80, skillMatch: 80, experienceMatch: 80, preferenceMatch: 80, matchedSkills: [], missingSkills: [], calculatedAt: now },
      { id: 'fs3', jobId: 'j3', overallScore: 90, skillMatch: 90, experienceMatch: 90, preferenceMatch: 90, matchedSkills: [], missingSkills: [], calculatedAt: now },
      { id: 'fs4', jobId: 'j4', overallScore: 60, skillMatch: 60, experienceMatch: 60, preferenceMatch: 60, matchedSkills: [], missingSkills: [], calculatedAt: now },
    ]);

    const summary = await getPipelineSummary(apps);

    expect(summary.total).toBe(4);
    expect(summary.byStatus.applied).toBe(1);
    expect(summary.byStatus.screen).toBe(1);
    expect(summary.byStatus.interview).toBe(1);
    expect(summary.byStatus.rejected).toBe(1);
    expect(summary.byStatus.offer).toBe(0);
    expect(summary.responseRate).toBe(75); // 3 out of 4 responded (all except 'applied')
    expect(summary.avgFitScore).toBe(75); // (70+80+90+60)/4 = 75
  });

  it('should handle empty applications array', async () => {
    const summary = await getPipelineSummary([]);

    expect(summary.total).toBe(0);
    expect(summary.byStatus.applied).toBe(0);
    expect(summary.responseRate).toBe(0);
    expect(summary.avgFitScore).toBe(0);
  });

  it('should count response rate correctly for all-applied status', async () => {
    const apps: Application[] = [
      { id: '1', jobId: 'j1', company: 'A', roleTitle: 'Dev', status: 'applied', dateApplied: now, lastUpdated: now },
      { id: '2', jobId: 'j2', company: 'B', roleTitle: 'Dev', status: 'applied', dateApplied: now, lastUpdated: now },
    ];

    const summary = await getPipelineSummary(apps);

    expect(summary.total).toBe(2);
    expect(summary.responseRate).toBe(0); // No one responded
  });
});
