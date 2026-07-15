import { invoke } from '@tauri-apps/api/core';

/**
 * One-time migration: import IndexedDB data into JSON database.
 * Runs on first launch after update. Clears IndexedDB after import.
 */

export async function migrateFromIndexedDBIfNeeded(
  exportAllData: () => Promise<any>,
  importAllData: (data: any) => Promise<void>,
  reloadDatabase: () => Promise<void>,
): Promise<boolean> {
  // Check if JSON database already has data
  const existing = await invoke<string | null>('load_database');
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      const hasJobs = parsed.jobEntries && parsed.jobEntries.length > 0;
      if (hasJobs) return false; // Already migrated
    } catch { /* corrupt, re-migrate */ }
  }

  // Try to read from IndexedDB
  try {
    const idbData = await exportAllData();
    if (!idbData || !idbData.jobEntries || idbData.jobEntries.length === 0) return false;

    // Import into JSON database
    await importAllData(idbData);
    await reloadDatabase();

    // Clear IndexedDB to prevent future conflicts
    try {
      indexedDB.deleteDatabase('USeekerDB');
    } catch { /* best effort */ }

    return true;
  } catch {
    // IndexedDB not available or empty — nothing to migrate
    return false;
  }
}
