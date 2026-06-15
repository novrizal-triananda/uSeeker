import Dexie, { type Table } from 'dexie';
import type { MasterResume, JobEntry, Application, FitScore, CompanyIntel, TailoredResume, EventLog } from '../types';

export class USeekerDB extends Dexie {
  masterResume!: Table<MasterResume>;
  jobEntries!: Table<JobEntry>;
  applications!: Table<Application>;
  fitScores!: Table<FitScore>;
  companyIntel!: Table<CompanyIntel>;
  tailoredResumes!: Table<TailoredResume>;
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
      eventLog: 'id, type, timestamp',
    });
  }
}

export const db = new USeekerDB();
