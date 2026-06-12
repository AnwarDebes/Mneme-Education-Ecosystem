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

import { getVariants, addVariant, pickVariantQuestion } from "@/lib/card-variants";
import { __resetStorageCacheForTests } from "@/lib/storage";

describe("card-variants", () => {
  beforeEach(() => {
    (globalThis as any).localStorage.clear();
    __resetStorageCacheForTests();
  });

  it("returns empty list initially", () => {
    expect(getVariants("d1", "c1")).toEqual([]);
  });

  it("persists variants per deck/card", () => {
    addVariant("d1", "c1", "alt 1");
    addVariant("d1", "c1", "alt 2");
    expect(getVariants("d1", "c1")).toEqual(["alt 1", "alt 2"]);
    expect(getVariants("d1", "c2")).toEqual([]);
    expect(getVariants("d2", "c1")).toEqual([]);
  });

  it("dedupes variants on repeat add", () => {
    addVariant("d1", "c1", "same");
    addVariant("d1", "c1", "same");
    expect(getVariants("d1", "c1")).toEqual(["same"]);
  });

  it("falls back to default question when no variants exist", () => {
    expect(pickVariantQuestion("d1", "c1", "What is X?")).toBe("What is X?");
  });

  it("picks from set { default, ...variants } when variants exist", () => {
    addVariant("d1", "c1", "Define X.");
    addVariant("d1", "c1", "Explain X in one line.");
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      seen.add(pickVariantQuestion("d1", "c1", "What is X?"));
    }
    expect(seen.size).toBeGreaterThan(1);
    for (const s of seen) {
      expect(["What is X?", "Define X.", "Explain X in one line."]).toContain(s);
    }
  });
});
