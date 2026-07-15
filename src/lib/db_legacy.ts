import Dexie, { type Table } from 'dexie';

/**
 * Legacy IndexedDB schema — used ONLY for one-time migration to JSON database.
 * This file should be removed after all users have migrated.
 */

export class LegacyDB extends Dexie {
  masterResume!: Table<any>;
  jobEntries!: Table<any>;
  applications!: Table<any>;
  fitScores!: Table<any>;
  companyIntel!: Table<any>;
  tailoredResumes!: Table<any>;
  interviewQuestions!: Table<any>;
  eventLog!: Table<any>;

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

/** Export all data from legacy IndexedDB */
export async function exportLegacyData(): Promise<any> {
  const db = new LegacyDB();
  try {
    const [
      masterResume,
      jobEntries,
      applications,
      fitScores,
      companyIntel,
      tailoredResumes,
      interviewQuestions,
      eventLog,
    ] = await Promise.all([
      db.masterResume.toArray(),
      db.jobEntries.toArray(),
      db.applications.toArray(),
      db.fitScores.toArray(),
      db.companyIntel.toArray(),
      db.tailoredResumes.toArray(),
      db.interviewQuestions.toArray(),
      db.eventLog.toArray(),
    ]);

    if (jobEntries.length === 0) return null;

    return {
      version: 1,
      timestamp: new Date().toISOString(),
      masterResume,
      jobEntries,
      applications,
      fitScores,
      companyIntel,
      tailoredResumes,
      interviewQuestions,
      eventLog,
    };
  } catch {
    return null;
  } finally {
    db.close();
  }
}
