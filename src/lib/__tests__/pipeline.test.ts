import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { addApplication, updateStatus, getOutcome, getPipelineStats, getPatternAnalysis } from '../pipeline';
import type { Application, ApplicationStatus, FitScore } from '../../types';

function makeApp(overrides: Partial<Application> = {}): Application {
  return {
    id: crypto.randomUUID(),
    jobId: 'job-' + crypto.randomUUID().slice(0, 8),
    company: 'Test Corp',
    roleTitle: 'Developer',
    status: 'applied',
    dateApplied: new Date(),
    lastUpdated: new Date(),
    ...overrides,
  };
}

describe('addApplication', () => {
  beforeEach(async () => {
    await db.applications.clear();
  });

  it('should create an application and store it in DB', async () => {
    const app = await addApplication({
      jobId: 'j1',
      company: 'Acme Inc',
      roleTitle: 'Frontend Dev',
    });

    expect(app).toBeDefined();
    expect(app.id).toBeDefined();
    expect(app.jobId).toBe('j1');
    expect(app.company).toBe('Acme Inc');
    expect(app.roleTitle).toBe('Frontend Dev');
    expect(app.status).toBe('applied');
    expect(app.dateApplied).toBeInstanceOf(Date);
    expect(app.lastUpdated).toBeInstanceOf(Date);

    const stored = await db.applications.get(app.id);
    expect(stored).toBeDefined();
    expect(stored?.company).toBe('Acme Inc');
  });

  it('should respect custom status', async () => {
    const app = await addApplication({
      jobId: 'j2',
      company: 'Beta Co',
      roleTitle: 'Backend Dev',
      status: 'screen',
    });
    expect(app.status).toBe('screen');
  });
});

describe('updateStatus', () => {
  beforeEach(async () => {
    await db.applications.clear();
  });

  it('should update status through pipeline stages', async () => {
    const app = await addApplication({
      jobId: 'j1',
      company: 'Corp',
      roleTitle: 'Dev',
    });

    const stages: ApplicationStatus[] = ['screen', 'interview', 'offer', 'rejected'];
    let current = app;

    for (const stage of stages) {
      const updated = await updateStatus(current.id, stage);
      expect(updated.status).toBe(stage);
      expect(updated.lastUpdated.getTime()).toBeGreaterThanOrEqual(current.lastUpdated.getTime());
      current = updated;
    }

    const final = await db.applications.get(app.id);
    expect(final?.status).toBe('rejected');
  });

  it('should throw for non-existent application', async () => {
    await expect(updateStatus('nonexistent', 'screen')).rejects.toThrow('not found');
  });
});

describe('getOutcome', () => {
  beforeEach(async () => {
    await db.applications.clear();
  });

  it('should record an outcome on an application', async () => {
    const app = await addApplication({
      jobId: 'j1',
      company: 'Corp',
      roleTitle: 'Dev',
    });

    const updated = await getOutcome(app.id, 'rejected');
    expect(updated.outcome).toBe('rejected');
    expect(updated.lastUpdated.getTime()).toBeGreaterThanOrEqual(app.lastUpdated.getTime());

    const stored = await db.applications.get(app.id);
    expect(stored?.outcome).toBe('rejected');
  });

  it('should record ghosted outcome', async () => {
    const app = await addApplication({
      jobId: 'j2',
      company: 'Corp',
      roleTitle: 'Dev',
    });

    const updated = await getOutcome(app.id, 'ghosted');
    expect(updated.outcome).toBe('ghosted');
  });

  it('should throw for non-existent application', async () => {
    await expect(getOutcome('nonexistent', 'accepted')).rejects.toThrow('not found');
  });
});

describe('getPipelineStats', () => {
  beforeEach(async () => {
    await db.applications.clear();
  });

  it('should calculate pipeline stats', () => {
    const apps: Application[] = [
      makeApp({ status: 'applied', company: 'A', jobId: 'j1' }),
      makeApp({ status: 'applied', company: 'B', jobId: 'j2' }),
      makeApp({ status: 'screen', company: 'C', jobId: 'j3' }),
      makeApp({ status: 'interview', company: 'D', jobId: 'j4' }),
      makeApp({ status: 'interview', company: 'E', jobId: 'j5' }),
      makeApp({ status: 'offer', company: 'F', jobId: 'j6' }),
      makeApp({ status: 'rejected', company: 'G', jobId: 'j7', outcome: 'rejected' }),
      makeApp({ status: 'rejected', company: 'H', jobId: 'j8', outcome: 'ghosted' }),
    ];

    const stats = getPipelineStats(apps);

    expect(stats.total).toBe(8);
    expect(stats.byStatus.applied).toBe(2);
    expect(stats.byStatus.screen).toBe(1);
    expect(stats.byStatus.interview).toBe(2);
    expect(stats.byStatus.offer).toBe(1);
    expect(stats.byStatus.rejected).toBe(2);

    // 6 out of 8 moved beyond applied or have outcome => 75%
    expect(stats.responseRate).toBe(75);
  });

  it('should return zero stats for empty array', () => {
    const stats = getPipelineStats([]);
    expect(stats.total).toBe(0);
    expect(stats.responseRate).toBe(0);
  });

  it('should count 100% response rate when all moved past applied', () => {
    const apps: Application[] = [
      makeApp({ status: 'screen', jobId: 'j1' }),
      makeApp({ status: 'interview', jobId: 'j2' }),
    ];
    const stats = getPipelineStats(apps);
    expect(stats.responseRate).toBe(100);
  });
});

describe('getPatternAnalysis', () => {
  beforeEach(async () => {
    await db.applications.clear();
    await db.fitScores.clear();
  });

  it('should return sampleSizeWarning when fewer than 10 outcomes', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const app = await addApplication({
        jobId: 'j' + i,
        company: 'Corp' + i,
        roleTitle: 'Dev',
      });
      await getOutcome(app.id, 'rejected');
      ids.push(app.id);
    }

    // Re-read from DB so outcome field is present on the objects
    const apps = await Promise.all(ids.map((id) => db.applications.get(id))) as Application[];

    const result = await getPatternAnalysis(apps);
    expect('sampleSizeWarning' in result && result.sampleSizeWarning).toBe(true);
    if ('sampleSizeWarning' in result) {
      expect(result.currentSize).toBe(5);
      expect(result.requiredSize).toBe(10);
    }
  });

  it('should return sampleSizeWarning with zero outcomes', async () => {
    const apps: Application[] = [
      makeApp({ status: 'applied', jobId: 'j1' }),
      makeApp({ status: 'applied', jobId: 'j2' }),
    ];

    const result = await getPatternAnalysis(apps);
    expect('sampleSizeWarning' in result && result.sampleSizeWarning).toBe(true);
  });

  it('should return pattern analysis with enough data', async () => {
    // Create 12 applications with outcomes
    const ids: string[] = [];
    const jobIds: string[] = [];

    for (let i = 0; i < 12; i++) {
      const jobId = 'pattern-j' + i;
      jobIds.push(jobId);
      const app = await addApplication({
        jobId,
        company: 'Corp' + i,
        roleTitle: 'Dev' + i,
      });

      // Distribute across statuses
      let status: ApplicationStatus;
      if (i < 4) status = 'rejected';
      else if (i < 8) status = 'screen';
      else status = 'interview';

      await updateStatus(app.id, status);
      await getOutcome(app.id, i < 6 ? 'rejected' : 'accepted');
      ids.push(app.id);
    }

    // Re-read from DB so all fields (outcome, status) are up-to-date
    const apps = await Promise.all(ids.map((id) => db.applications.get(id))) as Application[];

    // Add fitScores for rejected/ghosted jobs with missing skills
    const fitScores: FitScore[] = [
      { id: 'fs1', jobId: jobIds[0], overallScore: 40, skillMatch: 30, experienceMatch: 50, preferenceMatch: 50, matchedSkills: ['React'], missingSkills: ['TypeScript', 'Docker', 'Kubernetes'], calculatedAt: new Date() },
      { id: 'fs2', jobId: jobIds[1], overallScore: 35, skillMatch: 25, experienceMatch: 40, preferenceMatch: 50, matchedSkills: ['Vue'], missingSkills: ['TypeScript', 'React', 'GraphQL'], calculatedAt: new Date() },
      { id: 'fs3', jobId: jobIds[2], overallScore: 45, skillMatch: 35, experienceMatch: 55, preferenceMatch: 50, matchedSkills: ['Angular'], missingSkills: ['TypeScript', 'Docker', 'AWS'], calculatedAt: new Date() },
      { id: 'fs4', jobId: jobIds[3], overallScore: 30, skillMatch: 20, experienceMatch: 40, preferenceMatch: 50, matchedSkills: ['Python'], missingSkills: ['React', 'TypeScript', 'Node.js'], calculatedAt: new Date() },
      { id: 'fs5', jobId: jobIds[4], overallScore: 38, skillMatch: 28, experienceMatch: 45, preferenceMatch: 50, matchedSkills: ['Java'], missingSkills: ['React', 'TypeScript', 'Docker'], calculatedAt: new Date() },
      { id: 'fs6', jobId: jobIds[5], overallScore: 42, skillMatch: 32, experienceMatch: 50, preferenceMatch: 50, matchedSkills: ['Go'], missingSkills: ['TypeScript', 'React', 'Kubernetes'], calculatedAt: new Date() },
    ];

    await db.fitScores.bulkAdd(fitScores);

    const result = await getPatternAnalysis(apps);

    expect('sampleSizeWarning' in result).toBe(false);
    if (!('sampleSizeWarning' in result)) {
      // Should have stageBocor entries for stages with applications
      expect(result.stageBocor.length).toBeGreaterThan(0);

      // Each stageBocor has valid structure
      for (const sb of result.stageBocor) {
        expect(sb.stage).toBeDefined();
        expect(sb.rejectionRate).toBeGreaterThanOrEqual(0);
        expect(sb.rejectionRate).toBeLessThanOrEqual(100);
      }

      // topMissingSkills should have entries from rejected jobs
      expect(result.topMissingSkills.length).toBeGreaterThan(0);
      // TypeScript appears in all 6 rejected job fitScores
      expect(result.topMissingSkills[0]).toBe('TypeScript');
    }
  });
});
