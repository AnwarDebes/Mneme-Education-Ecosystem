// Snapshot every ``mneme:*`` localStorage key and emit / read back a single
// JSON blob. Lets the user move their personal data (overrides, schedules,
// stats, achievements, plans, collections, notes) between browsers without
// requiring any cloud sync.

const PREFIX = "mneme:";
const META_KEY = "__meta";

export interface BackupBlob {
  __meta: { app: "mneme"; version: number; created_at: string };
  [key: string]: unknown;
}

export function makeBackup(): BackupBlob {
  if (typeof window === "undefined") {
    return {
      __meta: { app: "mneme", version: 1, created_at: new Date().toISOString() },
    };
  }
  const out: BackupBlob = {
    __meta: { app: "mneme", version: 1, created_at: new Date().toISOString() },
  };
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(PREFIX)) continue;
    const value = window.localStorage.getItem(key);
    if (value == null) continue;
    try {
      out[key] = JSON.parse(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

export function restoreBackup(blob: BackupBlob): { restored: number; errors: string[] } {
  if (typeof window === "undefined") return { restored: 0, errors: ["no window"] };
  if (!blob || blob.__meta?.app !== "mneme") {
    return { restored: 0, errors: ["not a mneme backup"] };
  }
  let restored = 0;
  const errors: string[] = [];
  for (const [key, value] of Object.entries(blob)) {
    if (key === META_KEY) continue;
    if (!key.startsWith(PREFIX)) continue;
    try {
      const stringified = typeof value === "string" ? value : JSON.stringify(value);
      window.localStorage.setItem(key, stringified);
      restored += 1;
    } catch (err) {
      errors.push(`${key}: ${(err as Error).message}`);
    }
  }
  try {
    window.dispatchEvent(new Event("mneme:storage"));
  } catch {
    /* ignore */
  }
  return { restored, errors };
}
