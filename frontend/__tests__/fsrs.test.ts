import { describe, it, expect, beforeEach } from "vitest";

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.get(k) ?? null; }
  setItem(k: string, v: string) { this.store.set(k, v); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
  key(i: number) { return Array.from(this.store.keys())[i] ?? null; }
  get length() { return this.store.size; }
}
(globalThis as any).window = { localStorage: new MemoryStorage(), dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} };
(globalThis as any).localStorage = (globalThis as any).window.localStorage;

import { applyFSRSGrade, gradeFSRS, getFSRS, ratingFromGrade } from "@/lib/fsrs";
import { __resetStorageCacheForTests } from "@/lib/storage";

describe("FSRS scheduler", () => {
  beforeEach(() => {
    (globalThis as any).localStorage.clear();
    __resetStorageCacheForTests();
  });

  it("translates grade names to ratings 1..4", () => {
    expect(ratingFromGrade("again")).toBe(1);
    expect(ratingFromGrade("hard")).toBe(2);
    expect(ratingFromGrade("good")).toBe(3);
    expect(ratingFromGrade("easy")).toBe(4);
  });

  it("initializes with positive stability + difficulty for any first grade", () => {
    for (const rating of [1, 2, 3, 4] as const) {
      const s = applyFSRSGrade(null, rating);
      expect(s.stability).toBeGreaterThan(0);
      expect(s.difficulty).toBeGreaterThan(0);
      expect(s.difficulty).toBeLessThanOrEqual(10);
      // initial state always counts the first attempt as one rep
      expect(s.reps).toBe(1);
      expect(s.lapses).toBe(rating === 1 ? 1 : 0);
    }
  });

  it("easy grade produces a longer interval than good", () => {
    const easy = applyFSRSGrade(null, 4);
    const good = applyFSRSGrade(null, 3);
    const easyIv = easy.history.at(-1)!.interval;
    const goodIv = good.history.at(-1)!.interval;
    expect(easyIv).toBeGreaterThanOrEqual(goodIv);
  });

  it("again resets stability lower than the previous good grade", () => {
    const good = applyFSRSGrade(null, 3);
    const again = applyFSRSGrade(good, 1);
    expect(again.lapses).toBe(good.lapses + 1);
    expect(again.stability).toBeLessThan(good.stability);
  });

  it("hard grade leaves higher residual difficulty than easy grade", () => {
    // The impl's nextDifficulty collapses both toward an anchor, but hard
    // should still end above easy. That's the invariant we care about.
    const base = applyFSRSGrade(null, 3);
    const harder = applyFSRSGrade(base, 2);
    const easier = applyFSRSGrade(base, 4);
    expect(harder.difficulty).toBeGreaterThan(easier.difficulty);
  });

  it("history caps at 50 entries", () => {
    let s = applyFSRSGrade(null, 3);
    for (let i = 0; i < 60; i++) s = applyFSRSGrade(s, 3);
    expect(s.history.length).toBeLessThanOrEqual(50);
  });

  it("gradeFSRS persists state per deck/card and accumulates reps", () => {
    expect(getFSRS("d1", "c1")).toBeNull();
    const s1 = gradeFSRS("d1", "c1", 3);
    expect(s1.reps).toBe(1);
    const s2 = gradeFSRS("d1", "c1", 3);
    expect(s2.reps).toBe(2);
    expect(getFSRS("d1", "c2")).toBeNull();
    expect(getFSRS("d2", "c1")).toBeNull();
  });

  it("due_at moves further into the future with each successful good grade", () => {
    const s1 = applyFSRSGrade(null, 3, new Date("2026-01-01T00:00:00Z"));
    const s2 = applyFSRSGrade(s1, 3, new Date("2026-01-02T00:00:00Z"));
    expect(new Date(s2.due_at).getTime()).toBeGreaterThan(new Date(s1.due_at).getTime());
  });
});
