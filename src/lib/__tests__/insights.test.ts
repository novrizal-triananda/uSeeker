import { describe, it, expect } from 'vitest';
import {
  getStageBocor,
  getSkillGapFrequency,
  getSampleWarning,
  getLearningPoints,
  getOutcomeDistribution,
} from '../insights';
import type { Application, FitScore } from '../../types';

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

function makeFitScore(overrides: Partial<FitScore> = {}): FitScore {
  return {
    id: crypto.randomUUID(),
    jobId: 'job-' + crypto.randomUUID().slice(0, 8),
    overallScore: 50,
    skillMatch: 50,
    experienceMatch: 50,
    preferenceMatch: 50,
    matchedSkills: [],
    missingSkills: [],
    calculatedAt: new Date(),
    ...overrides,
  };
}

describe('getStageBocor', () => {
  it('should return null for empty array', () => {
    expect(getStageBocor([])).toBeNull();
  });

  it('should return null when no outcomes recorded', () => {
    const apps: Application[] = [
      makeApp({ status: 'applied', jobId: 'j1' }),
      makeApp({ status: 'screen', jobId: 'j2' }),
    ];
    expect(getStageBocor(apps)).toBeNull();
  });

  it('should find stage with highest rejection rate', () => {
    const apps: Application[] = [
      // screen: 50% rejection (1/2)
      makeApp({ status: 'screen', jobId: 'j1', outcome: 'rejected' }),
      makeApp({ status: 'screen', jobId: 'j2', outcome: 'accepted' }),
      // interview: 100% rejection (2/2)
      makeApp({ status: 'interview', jobId: 'j3', outcome: 'rejected' }),
      makeApp({ status: 'interview', jobId: 'j4', outcome: 'ghosted' }),
    ];

    const result = getStageBocor(apps);
    expect(result).not.toBeNull();
    expect(result!.stage).toBe('interview');
    expect(result!.rejectionRate).toBe(100);
  });

  it('should handle all accepted outcomes', () => {
    const apps: Application[] = [
      makeApp({ status: 'offer', jobId: 'j1', outcome: 'accepted' }),
      makeApp({ status: 'offer', jobId: 'j2', outcome: 'accepted' }),
    ];

    const result = getStageBocor(apps);
    expect(result).not.toBeNull();
    expect(result!.rejectionRate).toBe(0);
  });

  it('should count ghosted as negative outcome', () => {
    const apps: Application[] = [
      makeApp({ status: 'applied', jobId: 'j1', outcome: 'ghosted' }),
      makeApp({ status: 'applied', jobId: 'j2', outcome: 'accepted' }),
    ];

    const result = getStageBocor(apps);
    expect(result).not.toBeNull();
    expect(result!.stage).toBe('applied');
    expect(result!.rejectionRate).toBe(50);
  });

  it('should ignore withdrawn in rejection rate calculation', () => {
    // withdrawn is not "negative" per our definition
    const apps: Application[] = [
      makeApp({ status: 'applied', jobId: 'j1', outcome: 'withdrawn' }),
      makeApp({ status: 'applied', jobId: 'j2', outcome: 'accepted' }),
    ];

    const result = getStageBocor(apps);
    expect(result).not.toBeNull();
    expect(result!.rejectionRate).toBe(0);
  });
});

describe('getSkillGapFrequency', () => {
  it('should return empty for no rejected/ghosted apps', () => {
    const apps: Application[] = [
      makeApp({ jobId: 'j1', outcome: 'accepted' }),
      makeApp({ jobId: 'j2', outcome: 'withdrawn' }),
    ];
    const scores: FitScore[] = [
      makeFitScore({ jobId: 'j1', missingSkills: ['Docker', 'K8s'] }),
    ];

    expect(getSkillGapFrequency(apps, scores)).toEqual([]);
  });

  it('should count missing skills from rejected apps only', () => {
    const apps: Application[] = [
      makeApp({ jobId: 'j1', outcome: 'rejected' }),
      makeApp({ jobId: 'j2', outcome: 'ghosted' }),
      makeApp({ jobId: 'j3', outcome: 'accepted' }),
    ];
    const scores: FitScore[] = [
      makeFitScore({ jobId: 'j1', missingSkills: ['TypeScript', 'Docker'] }),
      makeFitScore({ jobId: 'j2', missingSkills: ['TypeScript', 'React'] }),
      makeFitScore({ jobId: 'j3', missingSkills: ['Python', 'Go'] }), // accepted — should be excluded
    ];

    const result = getSkillGapFrequency(apps, scores);
    expect(result).toEqual([
      { skill: 'TypeScript', count: 2 },
      { skill: 'Docker', count: 1 },
      { skill: 'React', count: 1 },
    ]);
  });

  it('should sort by frequency descending', () => {
    const apps: Application[] = [
      makeApp({ jobId: 'j1', outcome: 'rejected' }),
      makeApp({ jobId: 'j2', outcome: 'rejected' }),
      makeApp({ jobId: 'j3', outcome: 'rejected' }),
    ];
    const scores: FitScore[] = [
      makeFitScore({ jobId: 'j1', missingSkills: ['React'] }),
      makeFitScore({ jobId: 'j2', missingSkills: ['React', 'Docker'] }),
      makeFitScore({ jobId: 'j3', missingSkills: ['React', 'Docker', 'K8s'] }),
    ];

    const result = getSkillGapFrequency(apps, scores);
    expect(result[0].skill).toBe('React');
    expect(result[0].count).toBe(3);
    expect(result[1].skill).toBe('Docker');
    expect(result[1].count).toBe(2);
  });

  it('should handle apps with no matching fitScores', () => {
    const apps: Application[] = [
      makeApp({ jobId: 'j1', outcome: 'rejected' }),
    ];

    expect(getSkillGapFrequency(apps, [])).toEqual([]);
  });
});

describe('getSampleWarning', () => {
  it('should return warning when fewer than 10 outcomes', () => {
    const apps: Application[] = Array.from({ length: 5 }, (_, i) =>
      makeApp({ jobId: `j${i}`, outcome: 'rejected' }),
    );

    const warning = getSampleWarning(apps);
    expect(warning).not.toBeNull();
    expect(warning!.currentSize).toBe(5);
    expect(warning!.requiredSize).toBe(10);
    expect(warning!.message).toContain('5');
  });

  it('should return null when 10 or more outcomes', () => {
    const apps: Application[] = Array.from({ length: 12 }, (_, i) =>
      makeApp({ jobId: `j${i}`, outcome: i % 2 === 0 ? 'rejected' : 'accepted' }),
    );

    expect(getSampleWarning(apps)).toBeNull();
  });

  it('should return null for exactly 10 outcomes', () => {
    const apps: Application[] = Array.from({ length: 10 }, (_, i) =>
      makeApp({ jobId: `j${i}`, outcome: 'ghosted' }),
    );

    expect(getSampleWarning(apps)).toBeNull();
  });

  it('should not count apps without outcomes', () => {
    const apps: Application[] = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeApp({ jobId: `j${i}`, outcome: 'rejected' }),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        makeApp({ jobId: `j${i + 5}` }), // no outcome
      ),
    ];

    const warning = getSampleWarning(apps);
    expect(warning).not.toBeNull();
    expect(warning!.currentSize).toBe(5);
  });
});

describe('getLearningPoints', () => {
  it('should return empty array when sample too small', () => {
    const apps: Application[] = Array.from({ length: 5 }, (_, i) =>
      makeApp({ jobId: `j${i}`, outcome: 'rejected' }),
    );

    expect(getLearningPoints(apps)).toEqual([]);
  });

  it('should generate stage insight for highest rejection stage', () => {
    // 12 apps, all rejected at interview → high rejection rate at interview
    const apps: Application[] = Array.from({ length: 12 }, (_, i) =>
      makeApp({
        jobId: `j${i}`,
        status: 'interview',
        outcome: i < 10 ? 'rejected' : 'accepted',
      }),
    );

    const points = getLearningPoints(apps);
    const stagePoint = points.find(p => p.category === 'stage');
    expect(stagePoint).toBeDefined();
    expect(stagePoint!.insight).toContain('interview');
    expect(stagePoint!.recommendation).toBeDefined();
  });

  it('should flag low acceptance rate', () => {
    // 10 apps: 0 accepted, 10 rejected → 0% acceptance
    const apps: Application[] = Array.from({ length: 10 }, (_, i) =>
      makeApp({ jobId: `j${i}`, outcome: 'rejected' }),
    );

    const points = getLearningPoints(apps);
    const patternPoint = points.find(p => p.insight.includes('Low acceptance rate'));
    expect(patternPoint).toBeDefined();
    expect(patternPoint!.category).toBe('pattern');
  });

  it('should flag high ghost rate when >40%', () => {
    // 10 apps: 6 ghosted (60%), 4 accepted
    const apps: Application[] = [
      ...Array.from({ length: 6 }, (_, i) =>
        makeApp({ jobId: `g${i}`, outcome: 'ghosted' }),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        makeApp({ jobId: `a${i}`, outcome: 'accepted' }),
      ),
    ];

    const points = getLearningPoints(apps);
    const ghostPoint = points.find(p => p.insight.includes('High ghost rate'));
    expect(ghostPoint).toBeDefined();
  });

  it('should flag high reject-to-accept ratio', () => {
    // 11 apps: 10 rejected, 1 accepted → ratio 10:1
    const apps: Application[] = [
      makeApp({ jobId: 'a1', outcome: 'accepted' }),
      ...Array.from({ length: 10 }, (_, i) =>
        makeApp({ jobId: `r${i}`, outcome: 'rejected' }),
      ),
    ];

    const points = getLearningPoints(apps);
    const ratioPoint = points.find(p => p.insight.includes('Reject-to-accept'));
    expect(ratioPoint).toBeDefined();
  });

  it('should not flag high ghost rate when <=40%', () => {
    // 10 apps: 4 ghosted (40%), 6 accepted
    const apps: Application[] = [
      ...Array.from({ length: 4 }, (_, i) =>
        makeApp({ jobId: `g${i}`, outcome: 'ghosted' }),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        makeApp({ jobId: `a${i}`, outcome: 'accepted' }),
      ),
    ];

    const points = getLearningPoints(apps);
    const ghostPoint = points.find(p => p.insight.includes('High ghost rate'));
    expect(ghostPoint).toBeUndefined();
  });
});

describe('getOutcomeDistribution', () => {
  it('should return zero counts for empty array', () => {
    expect(getOutcomeDistribution([])).toEqual({
      accepted: 0,
      rejected: 0,
      ghosted: 0,
      withdrawn: 0,
    });
  });

  it('should count all outcome types', () => {
    const apps: Application[] = [
      makeApp({ outcome: 'accepted' }),
      makeApp({ outcome: 'accepted' }),
      makeApp({ outcome: 'rejected' }),
      makeApp({ outcome: 'rejected' }),
      makeApp({ outcome: 'rejected' }),
      makeApp({ outcome: 'ghosted' }),
      makeApp({ outcome: 'withdrawn' }),
      makeApp({ outcome: 'withdrawn' }),
      makeApp({ outcome: 'withdrawn' }),
      makeApp({ outcome: 'withdrawn' }),
    ];

    expect(getOutcomeDistribution(apps)).toEqual({
      accepted: 2,
      rejected: 3,
      ghosted: 1,
      withdrawn: 4,
    });
  });

  it('should ignore applications without outcomes', () => {
    const apps: Application[] = [
      makeApp({ outcome: 'accepted' }),
      makeApp({}), // no outcome
      makeApp({}), // no outcome
    ];

    expect(getOutcomeDistribution(apps)).toEqual({
      accepted: 1,
      rejected: 0,
      ghosted: 0,
      withdrawn: 0,
    });
  });
});
