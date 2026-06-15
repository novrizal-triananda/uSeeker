import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import type { MasterResume, JobEntry, Application, FitScore, CompanyIntel, TailoredResume, EventLog } from '../../types';

describe('MasterResume CRUD', () => {
  beforeEach(async () => {
    await db.masterResume.clear();
  });

  it('should create and read a master resume', async () => {
    const resume: MasterResume = {
      id: '1',
      sections: [{ type: 'contact', title: 'Contact', items: [{ text: 'Test User' }] }],
      updatedAt: new Date(),
    };
    await db.masterResume.add(resume);
    const result = await db.masterResume.get('1');
    expect(result).toBeDefined();
    expect(result?.sections[0].items[0].text).toBe('Test User');
  });

  it('should update a master resume', async () => {
    const resume: MasterResume = {
      id: '1',
      sections: [{ type: 'contact', title: 'Contact', items: [{ text: 'Old' }] }],
      updatedAt: new Date(),
    };
    await db.masterResume.add(resume);
    await db.masterResume.update('1', { sections: [{ type: 'contact', title: 'Contact', items: [{ text: 'New' }] }] });
    const result = await db.masterResume.get('1');
    expect(result?.sections[0].items[0].text).toBe('New');
  });

  it('should delete a master resume', async () => {
    await db.masterResume.add({ id: '1', sections: [], updatedAt: new Date() });
    await db.masterResume.delete('1');
    const result = await db.masterResume.get('1');
    expect(result).toBeUndefined();
  });
});

describe('JobEntry CRUD', () => {
  beforeEach(async () => {
    await db.jobEntries.clear();
  });

  it('should create and read a job entry', async () => {
    const job: JobEntry = {
      id: '1', company: 'Test Corp', roleTitle: 'Engineer',
      jobDescription: 'Build things', createdAt: new Date(),
    };
    await db.jobEntries.add(job);
    const result = await db.jobEntries.get('1');
    expect(result?.company).toBe('Test Corp');
  });

  it('should update a job entry', async () => {
    await db.jobEntries.add({ id: '1', company: 'Old', roleTitle: 'Dev', jobDescription: 'x', createdAt: new Date() });
    await db.jobEntries.update('1', { company: 'New' });
    const result = await db.jobEntries.get('1');
    expect(result?.company).toBe('New');
  });

  it('should delete a job entry', async () => {
    await db.jobEntries.add({ id: '1', company: 'X', roleTitle: 'Y', jobDescription: 'z', createdAt: new Date() });
    await db.jobEntries.delete('1');
    expect(await db.jobEntries.get('1')).toBeUndefined();
  });

  it('should query jobs by company', async () => {
    await db.jobEntries.bulkAdd([
      { id: '1', company: 'A', roleTitle: 'Dev', jobDescription: 'x', createdAt: new Date() },
      { id: '2', company: 'B', roleTitle: 'Dev', jobDescription: 'y', createdAt: new Date() },
    ]);
    const results = await db.jobEntries.where('company').equals('A').toArray();
    expect(results.length).toBe(1);
  });
});

describe('Application CRUD', () => {
  beforeEach(async () => {
    await db.applications.clear();
  });

  it('should create and read an application', async () => {
    const app: Application = {
      id: '1', jobId: 'j1', company: 'Corp', roleTitle: 'Dev',
      status: 'applied', dateApplied: new Date(), lastUpdated: new Date(),
    };
    await db.applications.add(app);
    const result = await db.applications.get('1');
    expect(result?.status).toBe('applied');
  });

  it('should update application status', async () => {
    await db.applications.add({
      id: '1', jobId: 'j1', company: 'Corp', roleTitle: 'Dev',
      status: 'applied', dateApplied: new Date(), lastUpdated: new Date(),
    });
    await db.applications.update('1', { status: 'interview' });
    const result = await db.applications.get('1');
    expect(result?.status).toBe('interview');
  });

  it('should delete an application', async () => {
    await db.applications.add({
      id: '1', jobId: 'j1', company: 'Corp', roleTitle: 'Dev',
      status: 'applied', dateApplied: new Date(), lastUpdated: new Date(),
    });
    await db.applications.delete('1');
    expect(await db.applications.get('1')).toBeUndefined();
  });
});

describe('FitScore CRUD', () => {
  beforeEach(async () => {
    await db.fitScores.clear();
  });

  it('should create and read a fit score', async () => {
    const score: FitScore = {
      id: '1', jobId: 'j1', overallScore: 75, skillMatch: 80,
      experienceMatch: 70, preferenceMatch: 70,
      matchedSkills: ['React'], missingSkills: ['Vue'], calculatedAt: new Date(),
    };
    await db.fitScores.add(score);
    const result = await db.fitScores.get('1');
    expect(result?.overallScore).toBe(75);
  });

  it('should update a fit score', async () => {
    await db.fitScores.add({
      id: '1', jobId: 'j1', overallScore: 50, skillMatch: 50,
      experienceMatch: 50, preferenceMatch: 50,
      matchedSkills: [], missingSkills: [], calculatedAt: new Date(),
    });
    await db.fitScores.update('1', { overallScore: 90 });
    expect((await db.fitScores.get('1'))?.overallScore).toBe(90);
  });

  it('should delete a fit score', async () => {
    await db.fitScores.add({
      id: '1', jobId: 'j1', overallScore: 0, skillMatch: 0,
      experienceMatch: 0, preferenceMatch: 0,
      matchedSkills: [], missingSkills: [], calculatedAt: new Date(),
    });
    await db.fitScores.delete('1');
    expect(await db.fitScores.get('1')).toBeUndefined();
  });
});

describe('CompanyIntel CRUD', () => {
  beforeEach(async () => {
    await db.companyIntel.clear();
  });

  it('should create company intel', async () => {
    const intel: CompanyIntel = {
      id: '1', company: 'Corp', officialUrl: 'https://corp.com',
      crawlDepth: 0, sources: [], createdAt: new Date(),
    };
    await db.companyIntel.add(intel);
    expect((await db.companyIntel.get('1'))?.company).toBe('Corp');
  });

  it('should update company intel', async () => {
    await db.companyIntel.add({
      id: '1', company: 'Corp', officialUrl: 'https://corp.com',
      crawlDepth: 0, sources: [], createdAt: new Date(),
    });
    await db.companyIntel.update('1', { snapshot: 'Overview' });
    expect((await db.companyIntel.get('1'))?.snapshot).toBe('Overview');
  });

  it('should delete company intel', async () => {
    await db.companyIntel.add({
      id: '1', company: 'Corp', officialUrl: 'https://corp.com',
      crawlDepth: 0, sources: [], createdAt: new Date(),
    });
    await db.companyIntel.delete('1');
    expect(await db.companyIntel.get('1')).toBeUndefined();
  });
});

describe('TailoredResume CRUD', () => {
  beforeEach(async () => {
    await db.tailoredResumes.clear();
  });

  it('should create and read a tailored resume', async () => {
    const tr: TailoredResume = {
      id: '1', jobId: 'j1', masterResumeId: 'mr1',
      suggestions: [{ section: 'exp', original: 'Old', suggested: 'New', reason: 'Better' }],
      createdAt: new Date(),
    };
    await db.tailoredResumes.add(tr);
    expect((await db.tailoredResumes.get('1'))?.suggestions.length).toBe(1);
  });

  it('should update a suggestion acceptance', async () => {
    await db.tailoredResumes.add({
      id: '1', jobId: 'j1', masterResumeId: 'mr1',
      suggestions: [{ section: 'exp', original: 'Old', suggested: 'New', reason: 'Better' }],
      createdAt: new Date(),
    });
    const tr = await db.tailoredResumes.get('1');
    tr!.suggestions[0].accepted = true;
    await db.tailoredResumes.update('1', { suggestions: tr!.suggestions });
    const result = await db.tailoredResumes.get('1');
    expect(result?.suggestions[0].accepted).toBe(true);
  });

  it('should delete a tailored resume', async () => {
    await db.tailoredResumes.add({
      id: '1', jobId: 'j1', masterResumeId: 'mr1', suggestions: [], createdAt: new Date(),
    });
    await db.tailoredResumes.delete('1');
    expect(await db.tailoredResumes.get('1')).toBeUndefined();
  });
});

describe('EventLog CRUD', () => {
  beforeEach(async () => {
    await db.eventLog.clear();
  });

  it('should create and read an event log', async () => {
    const event: EventLog = {
      id: '1', type: 'import_cv', timestamp: new Date(),
    };
    await db.eventLog.add(event);
    expect((await db.eventLog.get('1'))?.type).toBe('import_cv');
  });

  it('should query events by type', async () => {
    await db.eventLog.bulkAdd([
      { id: '1', type: 'import_cv', timestamp: new Date() },
      { id: '2', type: 'add_job', timestamp: new Date() },
    ]);
    const results = await db.eventLog.where('type').equals('import_cv').toArray();
    expect(results.length).toBe(1);
  });

  it('should delete an event log', async () => {
    await db.eventLog.add({ id: '1', type: 'export', timestamp: new Date() });
    await db.eventLog.delete('1');
    expect(await db.eventLog.get('1')).toBeUndefined();
  });
});
