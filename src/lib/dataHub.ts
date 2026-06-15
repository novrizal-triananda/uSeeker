import { db } from './db';
import type { JobEntry, FitScore, CompanyIntel, TailoredResume, Application, ApplicationStatus, ResumeSection, EventLog } from '../types';

const API_BASE = 'http://127.0.0.1:8787';

export interface ConsolidatedView {
  jobEntry: JobEntry;
  fitScore: FitScore | null;
  companyIntel: CompanyIntel | null;
  tailoredResume: TailoredResume | null;
  application: Application | null;
}

export interface InterviewQuestion {
  question: string;
  category: 'teknis' | 'perilaku' | 'situasional';
  tips: string;
}

export interface InterviewPrep {
  companyIntel: CompanyIntel | null;
  fitScore: FitScore | null;
  tailoredResume: TailoredResume | null;
  application: Application | null;
  jobDescription: string;
  cvSections: ResumeSection[];
  eventHistory: EventLog[];
  interviewQuestions: InterviewQuestion[];
}

export interface PipelineSummary {
  total: number;
  byStatus: Record<ApplicationStatus, number>;
  responseRate: number;
  avgFitScore: number;
}

/**
 * Get consolidated view for a specific job.
 * Combines all related entities by jobId.
 */
export async function getConsolidatedView(jobId: string): Promise<ConsolidatedView | null> {
  const jobEntry = await db.jobEntries.get(jobId);
  if (!jobEntry) return null;

  const [fitScore, companyIntel, tailoredResume, application] = await Promise.all([
    db.fitScores.where('jobId').equals(jobId).first(),
    db.companyIntel.where('jobId').equals(jobId).first(),
    db.tailoredResumes.where('jobId').equals(jobId).first(),
    db.applications.where('jobId').equals(jobId).first(),
  ]);

  return {
    jobEntry,
    fitScore: fitScore ?? null,
    companyIntel: companyIntel ?? null,
    tailoredResume: tailoredResume ?? null,
    application: application ?? null,
  };
}

/**
 * Get consolidated views for all jobs.
 */
export async function getAllConsolidatedViews(): Promise<ConsolidatedView[]> {
  const jobs = await db.jobEntries.toArray();
  const views = await Promise.all(
    jobs.map((job) => getConsolidatedView(job.id))
  );
  return views.filter((v): v is ConsolidatedView => v !== null);
}

/**
 * Export all data in specified format.
 */
export async function getExportData(format: 'json' | 'text'): Promise<string> {
  const views = await getAllConsolidatedViews();

  if (format === 'json') {
    return JSON.stringify(views, null, 2);
  }

  const lines: string[] = [];
  lines.push('=== uSeeker Export ===');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total jobs: ${views.length}`);
  lines.push('');

  for (const view of views) {
    lines.push(`--- ${view.jobEntry.company} - ${view.jobEntry.roleTitle} ---`);
    lines.push(`Job ID: ${view.jobEntry.id}`);
    lines.push(`Applied: ${view.jobEntry.createdAt.toISOString()}`);

    if (view.application) {
      lines.push(`Status: ${view.application.status}`);
      if (view.application.outcome) {
        lines.push(`Outcome: ${view.application.outcome}`);
      }
    }

    if (view.fitScore) {
      lines.push(`Fit Score: ${view.fitScore.overallScore}/100`);
      lines.push(`  Skill Match: ${view.fitScore.skillMatch}%`);
      lines.push(`  Experience Match: ${view.fitScore.experienceMatch}%`);
      if (view.fitScore.matchedSkills.length > 0) {
        lines.push(`  Matched: ${view.fitScore.matchedSkills.join(', ')}`);
      }
      if (view.fitScore.missingSkills.length > 0) {
        lines.push(`  Missing: ${view.fitScore.missingSkills.join(', ')}`);
      }
    }

    if (view.companyIntel) {
      lines.push(`Company Intel:`);
      if (view.companyIntel.snapshot) {
        lines.push(`  ${view.companyIntel.snapshot}`);
      }
      if (view.companyIntel.industry) {
        lines.push(`  Industry: ${view.companyIntel.industry}`);
      }
      if (view.companyIntel.products?.length) {
        lines.push(`  Products: ${view.companyIntel.products.join(', ')}`);
      }
      if (view.companyIntel.redFlags?.length) {
        lines.push(`  Red Flags: ${view.companyIntel.redFlags.join(', ')}`);
      }
    }

    if (view.tailoredResume) {
      const accepted = view.tailoredResume.suggestions.filter((s) => s.accepted);
      const pending = view.tailoredResume.suggestions.filter((s) => !s.accepted);
      lines.push(`Resume Tailoring: ${accepted.length} accepted, ${pending.length} pending`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get interview prep view for a specific job.
 */
export async function getInterviewPrep(jobId: string): Promise<InterviewPrep | null> {
  const jobEntry = await db.jobEntries.get(jobId);

  const [fitScore, companyIntel, tailoredResume, application, masterResume, allEvents] = await Promise.all([
    db.fitScores.where('jobId').equals(jobId).first(),
    db.companyIntel.where('jobId').equals(jobId).first(),
    db.tailoredResumes.where('jobId').equals(jobId).first(),
    db.applications.where('jobId').equals(jobId).first(),
    db.masterResume.toCollection().first(),
    db.eventLog.toArray(),
  ]);

  // Filter events related to this job (where metadata.jobId matches)
  const eventHistory = allEvents
    .filter((e) => e.metadata?.jobId === jobId)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Return intel even without an application — shows what's available
  return {
    companyIntel: companyIntel ?? null,
    fitScore: fitScore ?? null,
    tailoredResume: tailoredResume ?? null,
    application: application ?? null,
    jobDescription: jobEntry?.jobDescription ?? '',
    cvSections: masterResume?.sections ?? [],
    eventHistory,
    interviewQuestions: [],
  };
}

/**
 * Generate AI-powered interview questions for a specific job.
 * Queries job data, company intel, fit score, and CV to build a contextual prompt.
 * Returns an array of InterviewQuestion objects.
 */
export async function generateInterviewQuestions(jobId: string): Promise<InterviewQuestion[]> {
  const jobEntry = await db.jobEntries.get(jobId);
  if (!jobEntry) return [];

  const [fitScore, companyIntel, masterResume] = await Promise.all([
    db.fitScores.where('jobId').equals(jobId).first(),
    db.companyIntel.where('jobId').equals(jobId).first(),
    db.masterResume.toCollection().first(),
  ]);

  // Extract candidate skills from CV sections
  const skillsSection = masterResume?.sections.find((s) => s.type === 'skills');
  const candidateSkills = skillsSection
    ? skillsSection.items.map((item) => item.text).join(', ')
    : 'Tidak tersedia';

  const systemPrompt =
    'Kamu adalah konsultan karir Indonesia. Buat daftar pertanyaan interview yang mungkin ditanyakan ke kandidat untuk posisi ini. Return JSON: { "questions": [{ "question": "...", "category": "teknis|perilaku|situasional", "tips": "..." }] }. Minimum 8 pertanyaan. Semua dalam Bahasa Indonesia.';

  const prompt = [
    'Buat daftar pertanyaan interview untuk posisi berikut:',
    '',
    '--- POSISI ---',
    `${jobEntry.company} - ${jobEntry.roleTitle}`,
    '',
    '--- JOB DESCRIPTION ---',
    jobEntry.jobDescription,
    '',
  ];

  if (companyIntel) {
    prompt.push('--- COMPANY INTEL ---');
    if (companyIntel.snapshot) prompt.push(`Snapshot: ${companyIntel.snapshot}`);
    if (companyIntel.industry) prompt.push(`Industri: ${companyIntel.industry}`);
    if (companyIntel.products?.length) prompt.push(`Produk: ${companyIntel.products.join(', ')}`);
    prompt.push('');
  }

  if (fitScore) {
    prompt.push('--- FIT SCORE ---');
    prompt.push(`Overall: ${fitScore.overallScore}/100`);
    prompt.push(`Skill Match: ${fitScore.skillMatch}%`);
    prompt.push(`Missing Skills: ${fitScore.missingSkills.join(', ') || 'Tidak ada'}`);
    prompt.push('');
  }

  prompt.push('--- SKILL KANDIDAT (dari CV) ---');
  prompt.push(candidateSkills);
  prompt.push('');
  prompt.push('Pertanyaan harus relevan dengan posisi, perusahaan, dan profil kandidat.');
  prompt.push('Kategorikan setiap pertanyaan: teknis, perilaku, atau situasional.');
  prompt.push('Berikan tips singkat untuk setiap pertanyaan dalam Bahasa Indonesia.');

  try {
    const response = await fetch(`${API_BASE}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt,
        prompt: prompt.join('\n'),
        task: 'interview_prep',
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const result: string = data.result || JSON.stringify(data);
    const parsed = JSON.parse(result);
    if (Array.isArray(parsed.questions)) {
      return parsed.questions.map((q: any) => ({
        question: String(q.question || ''),
        category: (['teknis', 'perilaku', 'situasional'].includes(q.category) ? q.category : 'teknis') as InterviewQuestion['category'],
        tips: String(q.tips || ''),
      }));
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Calculate pipeline summary statistics from applications.
 */
export async function getPipelineSummary(applications: Application[]): Promise<PipelineSummary> {
  const total = applications.length;

  const byStatus: Record<ApplicationStatus, number> = {
    applied: 0,
    screen: 0,
    interview: 0,
    offer: 0,
    rejected: 0,
  };

  for (const app of applications) {
    byStatus[app.status]++;
  }

  const responded = applications.filter(
    (app) => app.status !== 'applied' || app.outcome !== undefined
  ).length;
  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;

  const jobIds = [...new Set(applications.map((app) => app.jobId))];
  let avgFitScore = 0;

  if (jobIds.length > 0) {
    const fitScores = await db.fitScores
      .where('jobId')
      .anyOf(jobIds)
      .toArray();

    if (fitScores.length > 0) {
      const totalScore = fitScores.reduce((sum, fs) => sum + fs.overallScore, 0);
      avgFitScore = Math.round(totalScore / fitScores.length);
    }
  }

  return { total, byStatus, responseRate, avgFitScore };
}
