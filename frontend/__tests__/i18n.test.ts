import { describe, it, expect, beforeEach } from "vitest";
import { t, loadLocale, saveLocale } from "@/lib/i18n";
import { __resetStorageCacheForTests } from "@/lib/storage";

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

describe("i18n", () => {
  beforeEach(() => {
    (globalThis as any).localStorage.clear();
    __resetStorageCacheForTests();
  });

  it("returns English by default", () => {
    expect(t("nav.library")).toBe("Library");
    expect(t("nav.today")).toBe("Today");
  });

  it("switches to Spanish when locale set", () => {
    saveLocale("es");
    expect(loadLocale()).toBe("es");
    expect(t("nav.library")).toBe("Biblioteca");
    expect(t("study.again")).toBe("Otra vez");
  });

  it("falls back to English for missing Spanish keys", () => {
    saveLocale("es");
    expect(t("nonexistent.key")).toBe("nonexistent.key");
  });

  it("substitutes %s args", () => {
    saveLocale("en");
    expect(t("common.cards", 7)).toBe("7 cards");
    saveLocale("es");
    expect(t("common.cards", 7)).toBe("7 tarjetas");
  });
});
