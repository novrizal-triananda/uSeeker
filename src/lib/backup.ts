import { db } from './db';

// ponytail: export/import Dexie data as JSON for backup/restore.
// Add new tables here when schema changes.

type BackupData = {
  version: number;
  timestamp: string;
  masterResume: unknown[];
  jobEntries: unknown[];
  applications: unknown[];
  fitScores: unknown[];
  companyIntel: unknown[];
  tailoredResumes: unknown[];
  interviewQuestions: unknown[];
  eventLog: unknown[];
};

/** Export all Dexie tables to a JSON-serializable object */
export async function exportAllData(): Promise<BackupData> {
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
}

/** Import data from a backup into Dexie (clears existing data first) */
export async function importAllData(data: BackupData): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.masterResume,
      db.jobEntries,
      db.applications,
      db.fitScores,
      db.companyIntel,
      db.tailoredResumes,
      db.interviewQuestions,
      db.eventLog,
    ],
    async () => {
      await Promise.all([
        db.masterResume.clear(),
        db.jobEntries.clear(),
        db.applications.clear(),
        db.fitScores.clear(),
        db.companyIntel.clear(),
        db.tailoredResumes.clear(),
        db.interviewQuestions.clear(),
        db.eventLog.clear(),
      ]);

      await Promise.all([
        data.masterResume.length ? db.masterResume.bulkAdd(data.masterResume as any[]) : Promise.resolve(),
        data.jobEntries.length ? db.jobEntries.bulkAdd(data.jobEntries as any[]) : Promise.resolve(),
        data.applications.length ? db.applications.bulkAdd(data.applications as any[]) : Promise.resolve(),
        data.fitScores.length ? db.fitScores.bulkAdd(data.fitScores as any[]) : Promise.resolve(),
        data.companyIntel.length ? db.companyIntel.bulkAdd(data.companyIntel as any[]) : Promise.resolve(),
        data.tailoredResumes.length ? db.tailoredResumes.bulkAdd(data.tailoredResumes as any[]) : Promise.resolve(),
        data.interviewQuestions.length ? db.interviewQuestions.bulkAdd(data.interviewQuestions as any[]) : Promise.resolve(),
        data.eventLog.length ? db.eventLog.bulkAdd(data.eventLog as any[]) : Promise.resolve(),
      ]);
    },
  );
}

/** Check if database has any data */
export async function hasData(): Promise<boolean> {
  const count = await db.jobEntries.count();
  return count > 0;
}
