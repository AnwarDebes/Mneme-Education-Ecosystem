// The voice-only mode's auto-grade is the riskiest piece of new code in R1.
// It's pure - extract and test it here.
import { describe, it, expect } from "vitest";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[‘’']/g, "'").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenOverlap(guess: string, expected: string): number {
  const g = new Set(normalize(guess).split(" ").filter(Boolean));
  const e = normalize(expected).split(" ").filter((t) => t.length > 2);
  if (e.length === 0) return 0;
  let hit = 0;
  for (const t of e) if (g.has(t)) hit += 1;
  return hit / e.length;
}

describe("voice-only auto-grading", () => {
  it("scores perfect match as 1", () => {
    expect(tokenOverlap("the cell membrane", "the cell membrane")).toBeCloseTo(1);
  });

  it("ignores stop-length tokens in expected (length<=2 dropped)", () => {
    // 'is' is too short, won't be counted in expected; 'a' too short
    expect(tokenOverlap("photosynthesis", "is a photosynthesis")).toBe(1);
  });

  it("scores partial overlap", () => {
    expect(tokenOverlap("photosynthesis sugar", "photosynthesis light sugar plant")).toBeCloseTo(0.5);
  });

  it("returns 0 for no overlap", () => {
    expect(tokenOverlap("completely different words", "photosynthesis mitosis")).toBe(0);
  });

  it("is case-insensitive and punctuation-tolerant", () => {
    expect(tokenOverlap("Photosynthesis!!!", "photosynthesis")).toBe(1);
  });

  it("handles smart quotes by normalizing", () => {
    expect(tokenOverlap("it’s a cell", "the cell membrane")).toBeGreaterThan(0);
  });

  it("graded threshold sanity: 3-of-4 token hit lands in 'good' band (>=0.7)", () => {
    // Expected tokens of length > 2: photosynthesis, plant, light, sugar
    // Guess hits 3: photosynthesis, light, sugar -> 0.75
    expect(tokenOverlap("photosynthesis light sugar", "photosynthesis plant light sugar")).toBeGreaterThanOrEqual(0.7);
  });
});
