import { invoke } from '@tauri-apps/api/core';
import type { JobEntry, FitScore, Application, CompanyIntel, MasterResume, TailoredResume, EventLog } from '../types';

/**
 * JSON-file-backed database via Rust backend.
 * Same API as Dexie — pages need zero changes.
 */

interface DatabaseState {
  masterResume: MasterResume[];
  jobEntries: JobEntry[];
  applications: Application[];
  fitScores: FitScore[];
  companyIntel: CompanyIntel[];
  tailoredResumes: TailoredResume[];
  interviewQuestions: any[];
  eventLog: EventLog[];
}

let state: DatabaseState | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { persist(); }, 200);
}

/** Force immediate save to disk (call after bulk operations before page reload) */
export async function flush(): Promise<void> {
  if (saveTimer) clearTimeout(saveTimer);
  await persist();
}

async function persist() {
  if (!state) return;
  try {
    const plain = JSON.stringify(state, (_key, val) => val instanceof Date ? { __date: val.toISOString() } : val);
    await invoke('save_database', { data: plain });
  } catch (e) {
    console.error('Failed to save database:', e);
  }
}

function reviveDates(obj: any): any {
  if (obj && typeof obj === 'object') {
    if (obj.__date) return new Date(obj.__date);
    for (const key of Object.keys(obj)) {
      obj[key] = reviveDates(obj[key]);
    }
  }
  return obj;
}

async function ensureLoaded(): Promise<DatabaseState> {
  if (state) return state;
  try {
    const raw = await invoke<string | null>('load_database');
    if (raw) {
      state = reviveDates(JSON.parse(raw));
    }
  } catch {
    // ignore
  }
  if (!state) {
    state = {
      masterResume: [],
      jobEntries: [],
      applications: [],
      fitScores: [],
      companyIntel: [],
      tailoredResumes: [],
      interviewQuestions: [],
      eventLog: [],
    };
  }
  return state;
}

// ── Table-like API ──

interface QueryRef<T> {
  delete(): Promise<void>;
  toArray(): Promise<T[]>;
  first(): Promise<T | undefined>;
}

interface WhereClause<T> {
  equals(value: any): QueryRef<T>;
  anyOf(values: any[]): QueryRef<T>;
}

interface CollectionRef<T> {
  first(): Promise<T | undefined>;
  toArray(): Promise<T[]>;
}

interface TableOps<T extends { id: string }> {
  toArray(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  add(item: T): Promise<string>;
  delete(id: string): Promise<void>;
  update(id: string, changes: Partial<T>): Promise<void>;
  bulkAdd(items: T[]): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
  where(field: string): WhereClause<T>;
  toCollection(): CollectionRef<T>;
}

function makeTable<T extends { id: string }>(getter: (s: DatabaseState) => T[]): TableOps<T> {
  function filterByField(arr: T[], field: string, value: any): T[] {
    return arr.filter((item: any) => item[field] === value);
  }

  function filterByFieldAnyOf(arr: T[], field: string, values: any[]): T[] {
    return arr.filter((item: any) => values.includes(item[field]));
  }

  function makeQueryRef(arr: T[], field: string, value: any): QueryRef<T>;
  function makeQueryRef(arr: T[], field: string, values: any[], isAnyOf: true): QueryRef<T>;
  function makeQueryRef(arr: T[], field: string, valueOrValues: any, isAnyOf?: boolean): QueryRef<T> {
    return {
      async delete() {
        const s = await ensureLoaded();
        const fullArr = getter(s) as any[];
        const matchFn = isAnyOf
          ? (item: any) => (valueOrValues as any[]).includes(item[field])
          : (item: any) => item[field] === valueOrValues;
        for (let i = fullArr.length - 1; i >= 0; i--) {
          if (matchFn(fullArr[i])) fullArr.splice(i, 1);
        }
        scheduleSave();
      },
      async toArray() {
        return isAnyOf ? filterByFieldAnyOf(arr, field, valueOrValues) : filterByField(arr, field, valueOrValues);
      },
      async first() {
        return isAnyOf ? filterByFieldAnyOf(arr, field, valueOrValues)[0] : filterByField(arr, field, valueOrValues)[0];
      },
    };
  }

  return {
    async toArray() {
      const s = await ensureLoaded();
      return [...getter(s)];
    },
    async get(id: string) {
      const s = await ensureLoaded();
      return getter(s).find((item) => item.id === id);
    },
    async add(item: T) {
      const s = await ensureLoaded();
      getter(s).push(item);
      scheduleSave();
      return item.id;
    },
    async bulkAdd(items: T[]) {
      const s = await ensureLoaded();
      getter(s).push(...items);
      scheduleSave();
    },
    async delete(id: string) {
      const s = await ensureLoaded();
      const arr = getter(s) as any[];
      const idx = arr.findIndex((item) => item.id === id);
      if (idx !== -1) arr.splice(idx, 1);
      scheduleSave();
    },
    async update(id: string, changes: Partial<T>) {
      const s = await ensureLoaded();
      const arr = getter(s) as any[];
      const item = arr.find((i) => i.id === id);
      if (item) Object.assign(item, changes);
      scheduleSave();
    },
    async clear() {
      const s = await ensureLoaded();
      const arr = getter(s) as any[];
      arr.length = 0;
      scheduleSave();
    },
    async count() {
      const s = await ensureLoaded();
      return getter(s).length;
    },
    where(field: string) {
      return {
        equals(value: any) {
          return makeQueryRef(getter(state!) || [], field, value);
        },
        anyOf(values: any[]) {
          return makeQueryRef(getter(state!) || [], field, values, true as any);
        },
      };
    },
    toCollection() {
      return {
        async first() {
          const s = await ensureLoaded();
          return getter(s)[0];
        },
        async toArray() {
          const s = await ensureLoaded();
          return [...getter(s)];
        },
      };
    },
  };
}

// ── Exported database object ──

export const db = {
  masterResume: makeTable<MasterResume>((s) => s.masterResume),
  jobEntries: makeTable<JobEntry>((s) => s.jobEntries),
  applications: makeTable<Application>((s) => s.applications),
  fitScores: makeTable<FitScore>((s) => s.fitScores),
  companyIntel: makeTable<CompanyIntel>((s) => s.companyIntel),
  tailoredResumes: makeTable<TailoredResume>((s) => s.tailoredResumes),
  interviewQuestions: makeTable<any>((s) => s.interviewQuestions),
  eventLog: makeTable<EventLog>((s) => s.eventLog),
};

/** Force reload from disk (e.g. after migration) */
export async function reloadDatabase() {
  state = null;
  await ensureLoaded();
}
