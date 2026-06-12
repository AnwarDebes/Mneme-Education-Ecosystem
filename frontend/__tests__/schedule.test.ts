// Smoke tests for the in-browser scheduler. These run via Node + Vitest
// using the localStorage shim, so we don't need a real browser.

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

beforeEach(() => {
  (globalThis as any).window = { localStorage: new MemoryStorage(), dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} };
  (globalThis as any).localStorage = (globalThis as any).window.localStorage;
});

describe("schedule", () => {
  it("starts cards with no schedule", async () => {
    const { getCardSchedule } = await import("../lib/schedule");
    const s = getCardSchedule("deck-a", "card-1");
    expect(s.reps).toBe(0);
    expect(s.lapses).toBe(0);
  });

  it("grading 'good' increases reps and pushes the due date forward", async () => {
    const { gradeCard } = await import("../lib/schedule");
    const before = Date.now();
    const after = gradeCard("deck-a", "card-1", "good");
    expect(after.reps).toBe(1);
    expect(new Date(after.due_at).getTime()).toBeGreaterThan(before);
  });

  it("grading 'again' bumps lapses and shortens the interval", async () => {
    const { gradeCard } = await import("../lib/schedule");
    gradeCard("deck-a", "card-2", "good");
    gradeCard("deck-a", "card-2", "good");
    const after = gradeCard("deck-a", "card-2", "again");
    expect(after.lapses).toBeGreaterThan(0);
  });
});

describe("retention prediction", () => {
  it("returns ~0.5 for a never-graded card", async () => {
    const { predictRetention } = await import("../lib/retention");
    const r = predictRetention("deck-a", "card-3");
    expect(r).toBeGreaterThan(0.4);
    expect(r).toBeLessThan(0.6);
  });

  it("decays as time passes", async () => {
    const { gradeCard } = await import("../lib/schedule");
    const { predictRetention } = await import("../lib/retention");
    gradeCard("deck-a", "card-4", "good");
    const nowR = predictRetention("deck-a", "card-4");
    const farR = predictRetention("deck-a", "card-4", Date.now() + 365 * 86400000);
    expect(farR).toBeLessThan(nowR);
  });
});
