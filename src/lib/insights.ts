import type { Application, FitScore, ApplicationStatus } from '../types';

const PIPELINE_STAGES: ApplicationStatus[] = ['applied', 'screen', 'interview', 'offer', 'rejected'];

const MIN_SAMPLE_SIZE = 10;

export interface StageBocor {
  stage: ApplicationStatus;
  rejectionRate: number;
}

export interface SkillGapEntry {
  skill: string;
  count: number;
}

export interface SampleWarning {
  currentSize: number;
  requiredSize: number;
  message: string;
}

export interface LearningPoint {
  category: 'stage' | 'skill' | 'pattern';
  insight: string;
  recommendation: string;
}

export interface OutcomeDistribution {
  accepted: number;
  rejected: number;
  ghosted: number;
  withdrawn: number;
}

/**
 * Finds which pipeline stage has the highest rejection rate.
 * Rejection = outcome is 'rejected' or 'ghosted'.
 */
export function getStageBocor(applications: Application[]): StageBocor | null {
  const withOutcome = applications.filter(a => a.outcome !== undefined);
  if (withOutcome.length === 0) return null;

  let best: StageBocor | null = null;

  for (const stage of PIPELINE_STAGES) {
    const atStage = withOutcome.filter(a => a.status === stage);
    if (atStage.length === 0) continue;

    const negativeCount = atStage.filter(
      a => a.outcome === 'rejected' || a.outcome === 'ghosted',
    ).length;

    const rejectionRate = Math.round((negativeCount / atStage.length) * 100);

    if (!best || rejectionRate > best.rejectionRate) {
      best = { stage, rejectionRate };
    }
  }

  return best;
}

/**
 * Counts missing skills across rejected/ghosted applications.
 * Requires FitScore records linked to those jobs.
 * Returns skills sorted by frequency (most common first).
 */
export function getSkillGapFrequency(
  applications: Application[],
  fitScores: FitScore[],
): SkillGapEntry[] {
  const rejectedJobIds = new Set(
    applications
      .filter(a => a.outcome === 'rejected' || a.outcome === 'ghosted')
      .map(a => a.jobId),
  );

  const skillCount = new Map<string, number>();
  for (const score of fitScores) {
    if (!rejectedJobIds.has(score.jobId)) continue;
    for (const skill of score.missingSkills) {
      skillCount.set(skill, (skillCount.get(skill) || 0) + 1);
    }
  }

  return Array.from(skillCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([skill, count]) => ({ skill, count }));
}

/**
 * Returns a warning if fewer than 10 outcomes have been recorded.
 * Returns null if sample size is sufficient.
 */
export function getSampleWarning(applications: Application[]): SampleWarning | null {
  const withOutcome = applications.filter(a => a.outcome !== undefined);
  if (withOutcome.length >= MIN_SAMPLE_SIZE) return null;

  return {
    currentSize: withOutcome.length,
    requiredSize: MIN_SAMPLE_SIZE,
    message: `Only ${withOutcome.length} outcomes recorded. At least ${MIN_SAMPLE_SIZE} needed for reliable pattern analysis.`,
  };
}

/**
 * Generates actionable insights from application patterns.
 * Returns empty array if sample is too small.
 */
export function getLearningPoints(applications: Application[]): LearningPoint[] {
  const withOutcome = applications.filter(a => a.outcome !== undefined);
  if (withOutcome.length < MIN_SAMPLE_SIZE) return [];

  const points: LearningPoint[] = [];

  // Stage-based insight
  const stageBocor = getStageBocor(applications);
  if (stageBocor && stageBocor.rejectionRate > 0) {
    points.push({
      category: 'stage',
      insight: `Highest rejection rate at "${stageBocor.stage}" stage (${stageBocor.rejectionRate}%)`,
      recommendation: `Focus on strengthening your profile for the ${stageBocor.stage} stage — review common reasons for rejection at this point.`,
    });
  }

  // Outcome ratio insight
  const accepted = withOutcome.filter(a => a.outcome === 'accepted').length;
  const rejected = withOutcome.filter(a => a.outcome === 'rejected').length;
  const ghosted = withOutcome.filter(a => a.outcome === 'ghosted').length;
  const total = withOutcome.length;

  if (total > 0) {
    const acceptanceRate = Math.round((accepted / total) * 100);
    const ghostRate = Math.round((ghosted / total) * 100);

    if (acceptanceRate < 10) {
      points.push({
        category: 'pattern',
        insight: `Low acceptance rate: ${acceptanceRate}% (${accepted}/${total})`,
        recommendation: 'Consider improving job targeting — apply to roles better aligned with your skill set.',
      });
    }

    if (ghostRate > 40) {
      points.push({
        category: 'pattern',
        insight: `High ghost rate: ${ghostRate}% (${ghosted}/${total})`,
        recommendation: 'Follow up more aggressively after applying. Many applications go silent — a polite nudge can help.',
      });
    }

    if (rejected > 0 && accepted > 0) {
      const rejectToAccept = rejected / accepted;
      if (rejectToAccept > 5) {
        points.push({
          category: 'pattern',
          insight: `Reject-to-accept ratio is ${rejectToAccept.toFixed(1)}:1`,
          recommendation: 'Your conversion rate is low. Revisit your CV tailoring and cover letter approach.',
        });
      }
    }
  }

  return points;
}

/**
 * Returns the distribution of outcomes across applications.
 */
export function getOutcomeDistribution(applications: Application[]): OutcomeDistribution {
  const dist: OutcomeDistribution = { accepted: 0, rejected: 0, ghosted: 0, withdrawn: 0 };

  for (const app of applications) {
    if (app.outcome === undefined) continue;
    dist[app.outcome]++;
  }

  return dist;
}
