import { describe, it, expect, beforeEach } from "vitest";

class MemoryStorage {
  private store = new Map<string, string>();
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(k: string): string | null { return this.store.get(k) ?? null; }
  key(i: number): string | null { return Array.from(this.store.keys())[i] ?? null; }
  removeItem(k: string): void { this.store.delete(k); }
  setItem(k: string, v: string): void { this.store.set(k, v); }
}

beforeEach(async () => {
  (globalThis as any).window = { localStorage: new MemoryStorage(), dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} };
  (globalThis as any).localStorage = (globalThis as any).window.localStorage;
  const { __resetStorageCacheForTests } = await import("../lib/storage");
  __resetStorageCacheForTests();
});

describe("global stats", () => {
  it("counts a single review", async () => {
    const { recordReview, loadStats } = await import("../lib/stats");
    recordReview("good");
    const s = loadStats();
    expect(s.total_reviewed).toBe(1);
    expect(s.current_streak).toBe(1);
  });

  it("buckets accuracy by day", async () => {
    const { recordReview, loadStats } = await import("../lib/stats");
    recordReview("good");
    recordReview("again");
    recordReview("easy");
    const s = loadStats();
    const day = Object.values(s.daily)[0]!;
    expect(day.reviewed).toBe(3);
    expect(day.good).toBe(1);
    expect(day.again).toBe(1);
    expect(day.easy).toBe(1);
  });
});

describe("FSRS lite", () => {
  it("initial state increases stability after 'good'", async () => {
    const { gradeFSRS, getFSRS } = await import("../lib/fsrs");
    const next = gradeFSRS("deck-x", "card-1", 3);
    expect(next.stability).toBeGreaterThan(0);
    expect(next.reps).toBe(1);
    expect(getFSRS("deck-x", "card-1")?.stability).toBe(next.stability);
  });

  it("'again' resets and grows lapses", async () => {
    const { gradeFSRS } = await import("../lib/fsrs");
    gradeFSRS("deck-y", "card-2", 3);
    const after = gradeFSRS("deck-y", "card-2", 1);
    expect(after.lapses).toBe(1);
  });
});
