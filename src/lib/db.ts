import Dexie, { type Table } from 'dexie';
import type { MasterResume, JobEntry, Application, FitScore, CompanyIntel, TailoredResume, EventLog } from '../types';

export interface InterviewQuestion {
  id: string;
  jobId: string;
  question: string;
  tips: string;
  category: 'teknis' | 'perilaku' | 'situasional';
  createdAt: Date;
}

export class USeekerDB extends Dexie {
  masterResume!: Table<MasterResume>;
  jobEntries!: Table<JobEntry>;
  applications!: Table<Application>;
  fitScores!: Table<FitScore>;
  companyIntel!: Table<CompanyIntel>;
  tailoredResumes!: Table<TailoredResume>;
  interviewQuestions!: Table<InterviewQuestion>;
  eventLog!: Table<EventLog>;

  constructor() {
    super('USeekerDB');
    this.version(1).stores({
      masterResume: 'id',
      jobEntries: 'id, company, roleTitle, createdAt',
      applications: 'id, jobId, company, status, dateApplied',
      fitScores: 'id, jobId',
      companyIntel: 'id, jobId, company',
      tailoredResumes: 'id, jobId, masterResumeId',
      interviewQuestions: 'id, jobId',
      eventLog: 'id, type, timestamp',
    });
    this.version(2).stores({
      jobEntries: 'id, company, roleTitle, location, createdAt',
    });
    this.version(3).stores({
      jobEntries: 'id, company, roleTitle, location, employmentType, createdAt',
    });
  }
}

export const db = new USeekerDB();
