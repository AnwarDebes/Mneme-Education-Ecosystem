// Thin localStorage wrapper that is safe to import from server components.
// All reads return ``null`` if window is not available; all writes are no-ops
// in that case. Keys are namespaced under ``mneme:`` so they never collide
// with anything else the browser stores.

const PREFIX = "mneme:";

export function storageKey(name: string): string {
  return PREFIX + name;
}

// In-memory mirror of every key we've read. Without this, every render
// that calls loadDeckMeta / loadFSRS / loadStats walks through synchronous
// JSON.parse, which becomes O(N decks) per render on the library page.
// The cache is invalidated on writes + on the cross-tab "storage" event.
const CACHE = new Map<string, unknown>();
const CACHE_MISS = Symbol("cache-miss");

function readRaw(name: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(storageKey(name));
  } catch {
    return null;
  }
}

export function readJSON<T>(name: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const cached = CACHE.has(name) ? (CACHE.get(name) as T | typeof CACHE_MISS) : CACHE_MISS;
  if (cached !== CACHE_MISS) return cached as T;
  const raw = readRaw(name);
  if (raw == null) {
    CACHE.set(name, fallback);
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as T;
    CACHE.set(name, parsed);
    return parsed;
  } catch {
    CACHE.set(name, fallback);
    return fallback;
  }
}

export function writeJSON(name: string, value: unknown): void {
  if (typeof window === "undefined") return;
  CACHE.set(name, value);
  try {
    window.localStorage.setItem(storageKey(name), JSON.stringify(value));
  } catch {
    /* quota exceeded; drop silently */
  }
}

export function removeKey(name: string): void {
  if (typeof window === "undefined") return;
  CACHE.delete(name);
  try {
    window.localStorage.removeItem(storageKey(name));
  } catch {
    /* ignore */
  }
}

export function clearMnemeStorage(): void {
  if (typeof window === "undefined") return;
  CACHE.clear();
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  for (const k of keys) window.localStorage.removeItem(k);
}

// Cross-tab writes show up as a native "storage" event. When one fires
// we must drop the in-memory cache because another tab may have mutated
// the underlying key.
if (typeof window !== "undefined") {
  window.addEventListener("storage", () => CACHE.clear());
}

// Test-only escape hatch: lets unit tests force a fresh read after they
// reset their MemoryStorage. Not exported for app code - the live cache
// invalidation paths above cover normal operation.
export function __resetStorageCacheForTests(): void {
  CACHE.clear();
}

// Namespaces declared up front so subscribers can opt in to a slice
// rather than re-rendering on every unrelated write.
export type StorageNamespace =
  | "deck"
  | "schedule"
  | "fsrs"
  | "stats"
  | "xp"
  | "achievements"
  | "settings"
  | "media"
  | "snapshots"
  | "notes"
  | "confidence"
  | "variants"
  | "other";

function namespaceOf(name: string): StorageNamespace {
  if (name.startsWith("schedule:")) return "schedule";
  if (name.startsWith("fsrs:")) return "fsrs";
  if (name.startsWith("deck:")) return "deck";
  if (name === "stats" || name.startsWith("stats:") || name.startsWith("tag-stats:") || name.startsWith("timing:")) return "stats";
  if (name === "xp" || name.startsWith("xp:")) return "xp";
  if (name.startsWith("achievements") || name.startsWith("quests")) return "achievements";
  if (name.startsWith("settings:")) return "settings";
  if (name.startsWith("media:")) return "media";
  if (name.startsWith("snapshots:")) return "snapshots";
  if (name.startsWith("notes:")) return "notes";
  if (name === "confidence:v1") return "confidence";
  if (name.startsWith("variants:")) return "variants";
  return "other";
}

const LISTENERS = new Set<(ns: StorageNamespace) => void>();
const NS_LISTENERS = new Map<StorageNamespace, Set<() => void>>();

export function notifyStorageChange(name?: string): void {
  if (typeof window === "undefined") return;
  const ns: StorageNamespace = name ? namespaceOf(name) : "other";
  LISTENERS.forEach((l) => {
    try {
      l(ns);
    } catch {
      /* ignore */
    }
  });
  const subs = NS_LISTENERS.get(ns);
  if (subs) {
    subs.forEach((l) => {
      try {
        l();
      } catch {
        /* ignore */
      }
    });
  }
  try {
    window.dispatchEvent(new CustomEvent("mneme:storage", { detail: { ns } }));
  } catch {
    /* ignore */
  }
}

export function subscribe(listener: () => void): () => void {
  const wrapped = () => listener();
  LISTENERS.add(wrapped);
  if (typeof window !== "undefined") {
    window.addEventListener("mneme:storage", wrapped);
    window.addEventListener("storage", wrapped);
  }
  return () => {
    LISTENERS.delete(wrapped);
    if (typeof window !== "undefined") {
      window.removeEventListener("mneme:storage", wrapped);
      window.removeEventListener("storage", wrapped);
    }
  };
}

export function subscribeNamespace(ns: StorageNamespace, listener: () => void): () => void {
  let set = NS_LISTENERS.get(ns);
  if (!set) {
    set = new Set();
    NS_LISTENERS.set(ns, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
  };
}
