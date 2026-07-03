import type { Application, FitScore, ApplicationStatus, JobEntry } from '../types';

const PIPELINE_STAGES: ApplicationStatus[] = ['applied', 'screen', 'interview', 'offer'];

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

// --- New: Advanced Insights ---

export interface LocationInsight {
  location: string;
  totalJobs: number;
  totalApplications: number;
  responseRate: number;
  acceptanceRate: number;
}

export interface EmploymentTypeInsight {
  type: string;
  totalJobs: number;
  totalApplications: number;
  responseRate: number;
  acceptanceRate: number;
}

export interface FitScoreInsight {
  range: string;
  count: number;
  avgResponseRate: number;
  avgAcceptanceRate: number;
}

/**
 * Analyze success rates by location.
 */
export function getLocationInsights(
  applications: Application[],
  jobs: JobEntry[],
): LocationInsight[] {
  const jobMap = new Map(jobs.map(j => [j.id, j]));
  const locationGroups = new Map<string, Application[]>();

  for (const app of applications) {
    const job = jobMap.get(app.jobId);
    const loc = job?.location || 'Unknown';
    if (!locationGroups.has(loc)) locationGroups.set(loc, []);
    locationGroups.get(loc)!.push(app);
  }

  return Array.from(locationGroups.entries())
    .map(([location, apps]) => {
      const withOutcome = apps.filter(a => a.outcome !== undefined);
      const responded = apps.filter(a => a.status !== 'applied' || a.outcome !== undefined);
      const accepted = apps.filter(a => a.outcome === 'accepted');
      return {
        location,
        totalJobs: new Set(apps.map(a => a.jobId)).size,
        totalApplications: apps.length,
        responseRate: apps.length > 0 ? Math.round((responded.length / apps.length) * 100) : 0,
        acceptanceRate: withOutcome.length > 0 ? Math.round((accepted.length / withOutcome.length) * 100) : 0,
      };
    })
    .sort((a, b) => b.totalApplications - a.totalApplications);
}

/**
 * Analyze success rates by employment type.
 */
export function getEmploymentTypeInsights(
  applications: Application[],
  jobs: JobEntry[],
): EmploymentTypeInsight[] {
  const jobMap = new Map(jobs.map(j => [j.id, j]));
  const typeGroups = new Map<string, Application[]>();

  for (const app of applications) {
    const job = jobMap.get(app.jobId);
    const type = job?.employmentType || 'Unknown';
    if (!typeGroups.has(type)) typeGroups.set(type, []);
    typeGroups.get(type)!.push(app);
  }

  return Array.from(typeGroups.entries())
    .map(([type, apps]) => {
      const withOutcome = apps.filter(a => a.outcome !== undefined);
      const responded = apps.filter(a => a.status !== 'applied' || a.outcome !== undefined);
      const accepted = apps.filter(a => a.outcome === 'accepted');
      return {
        type,
        totalJobs: new Set(apps.map(a => a.jobId)).size,
        totalApplications: apps.length,
        responseRate: apps.length > 0 ? Math.round((responded.length / apps.length) * 100) : 0,
        acceptanceRate: withOutcome.length > 0 ? Math.round((accepted.length / withOutcome.length) * 100) : 0,
      };
    })
    .sort((a, b) => b.totalApplications - a.totalApplications);
}

/**
 * Analyze response rates by fit score range.
 */
export function getFitScoreInsights(
  applications: Application[],
  fitScores: FitScore[],
): FitScoreInsight[] {
  const scoreMap = new Map(fitScores.map(s => [s.jobId, s]));
  const ranges = [
    { label: '90-100', min: 90, max: 100 },
    { label: '70-89', min: 70, max: 89 },
    { label: '50-69', min: 50, max: 69 },
    { label: '0-49', min: 0, max: 49 },
  ];

  return ranges.map(range => {
    const apps = applications.filter(a => {
      const score = scoreMap.get(a.jobId);
      if (!score) return false;
      return score.overallScore >= range.min && score.overallScore <= range.max;
    });

    const withOutcome = apps.filter(a => a.outcome !== undefined);
    const responded = apps.filter(a => a.status !== 'applied' || a.outcome !== undefined);
    const accepted = apps.filter(a => a.outcome === 'accepted');

    return {
      range: range.label,
      count: apps.length,
      avgResponseRate: apps.length > 0 ? Math.round((responded.length / apps.length) * 100) : 0,
      avgAcceptanceRate: withOutcome.length > 0 ? Math.round((accepted.length / withOutcome.length) * 100) : 0,
    };
  }).filter(r => r.count > 0);
}

/**
 * Calculate overall job search health score (0-100).
 * Based on: response rate, acceptance rate, skill gap closure, pipeline velocity.
 */
export function getJobSearchHealth(
  applications: Application[],
  fitScores: FitScore[],
): { score: number; factors: { name: string; score: number; weight: number }[] } {
  const total = applications.length;
  if (total === 0) return { score: 0, factors: [] };

  const responded = applications.filter(a => a.status !== 'applied' || a.outcome !== undefined);
  const withOutcome = applications.filter(a => a.outcome !== undefined);
  const accepted = applications.filter(a => a.outcome === 'accepted');

  const responseRate = total > 0 ? (responded.length / total) * 100 : 0;
  const acceptanceRate = withOutcome.length > 0 ? (accepted.length / withOutcome.length) * 100 : 0;

  // Skill coverage: how many jobs had fit scores vs total applications
  const jobsWithScores = new Set(fitScores.map(s => s.jobId));
  const appsWithScores = applications.filter(a => jobsWithScores.has(a.jobId));
  const skillCoverage = total > 0 ? (appsWithScores.length / total) * 100 : 0;

  // Average fit score for scored jobs
  const avgFit = appsWithScores.length > 0
    ? appsWithScores.reduce((sum, a) => {
        const score = fitScores.find(s => s.jobId === a.jobId);
        return sum + (score?.overallScore || 0);
      }, 0) / appsWithScores.length
    : 0;

  const factors = [
    { name: 'Response Rate', score: Math.min(100, responseRate), weight: 0.3 },
    { name: 'Acceptance Rate', score: Math.min(100, acceptanceRate), weight: 0.3 },
    { name: 'Skill Coverage', score: skillCoverage, weight: 0.2 },
    { name: 'Avg Fit Score', score: avgFit, weight: 0.2 },
  ];

  const score = Math.round(factors.reduce((sum, f) => sum + f.score * f.weight, 0));

  return { score, factors };
}
