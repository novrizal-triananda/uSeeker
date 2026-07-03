import { db } from './db';
import type { Application, ApplicationStatus, ApplicationOutcome, PipelineStats } from '../types';

const PIPELINE_STAGES: ApplicationStatus[] = ['applied', 'screen', 'interview', 'offer'];

export interface StageBocor {
  stage: ApplicationStatus;
  rejectionRate: number;
}

export interface PatternAnalysisResult {
  stageBocor: StageBocor[];
  topMissingSkills: string[];
}

export interface SampleSizeWarning {
  sampleSizeWarning: true;
  currentSize: number;
  requiredSize: number;
}

export type PatternAnalysis = PatternAnalysisResult | SampleSizeWarning;

type AddApplicationData = Omit<Application, 'id' | 'dateApplied' | 'lastUpdated' | 'status' | 'outcome'> & {
  status?: ApplicationStatus;
  outcome?: ApplicationOutcome;
  notes?: string;
};

export async function addApplication(data: AddApplicationData): Promise<Application> {
  const now = new Date();
  const application: Application = {
    id: crypto.randomUUID(),
    status: data.status ?? 'applied',
    dateApplied: now,
    lastUpdated: now,
    jobId: data.jobId,
    company: data.company,
    roleTitle: data.roleTitle,
    notes: data.notes,
  };
  await db.applications.add(application);
  return application;
}

export async function updateStatus(id: string, newStatus: ApplicationStatus): Promise<Application> {
  const app = await db.applications.get(id);
  if (!app) {
    throw new Error(`Application ${id} not found`);
  }
  await db.applications.update(id, { status: newStatus, lastUpdated: new Date() });
  return (await db.applications.get(id))!;
}

export async function getOutcome(id: string, outcome: ApplicationOutcome | undefined): Promise<Application> {
  const app = await db.applications.get(id);
  if (!app) {
    throw new Error(`Application ${id} not found`);
  }
  await db.applications.update(id, { outcome, lastUpdated: new Date() });
  return (await db.applications.get(id))!;
}

export function getPipelineStats(applications: Application[]): PipelineStats {
  const total = applications.length;

  const byStatus = {} as Record<ApplicationStatus, number>;
  for (const stage of PIPELINE_STAGES) {
    byStatus[stage] = 0;
  }
  for (const app of applications) {
    byStatus[app.status]++;
  }

  const responded = applications.filter(
    (app) => app.status !== 'applied' || app.outcome !== undefined,
  ).length;
  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;

  return { total, byStatus, responseRate };
}

export async function getPatternAnalysis(applications: Application[]): Promise<PatternAnalysis> {
  const withOutcome = applications.filter((app) => app.outcome !== undefined);

  if (withOutcome.length < 10) {
    return {
      sampleSizeWarning: true,
      currentSize: withOutcome.length,
      requiredSize: 10,
    };
  }

  const stageBocor: StageBocor[] = [];
  for (const stage of PIPELINE_STAGES) {
    const atStage = applications.filter((app) => app.status === stage);
    if (atStage.length === 0) continue;

    const negativeCount = atStage.filter(
      (app) => app.outcome === 'rejected' || app.outcome === 'ghosted',
    ).length;

    stageBocor.push({
      stage,
      rejectionRate: Math.round((negativeCount / atStage.length) * 100),
    });
  }

  const rejectedJobIds = new Set(
    withOutcome
      .filter((app) => app.outcome === 'rejected' || app.outcome === 'ghosted')
      .map((app) => app.jobId),
  );

  const fitScores = await db.fitScores
    .where('jobId')
    .anyOf(Array.from(rejectedJobIds))
    .toArray();

  const skillCount = new Map<string, number>();
  for (const score of fitScores) {
    for (const skill of score.missingSkills) {
      skillCount.set(skill, (skillCount.get(skill) || 0) + 1);
    }
  }

  const topMissingSkills = Array.from(skillCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([skill]) => skill);

  return { stageBocor, topMissingSkills };
}
