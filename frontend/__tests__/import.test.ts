import { describe, it, expect } from "vitest";

describe("CSV / TSV / JSON parsers", () => {
  it("parses a comma-separated deck with header", async () => {
    const { parseDelimited } = await import("../lib/import");
    const csv = `question,answer,tags\n"What is 2+2?",4,math\nWhat is the capital of France?,Paris,geography`;
    const result = parseDelimited(csv, ",");
    expect(result.cards.length).toBe(2);
    expect(result.cards[0].question).toBe("What is 2+2?");
    expect(result.cards[0].answer).toBe("4");
    expect(result.cards[0].tags).toEqual(["math"]);
  });

  it("parses tab-separated input without a header", async () => {
    const { parseDelimited } = await import("../lib/import");
    const tsv = "alpha\tbeta\nfoo\tbar";
    const result = parseDelimited(tsv, "\t");
    expect(result.cards.length).toBe(2);
    expect(result.cards[0].question).toBe("alpha");
    expect(result.cards[0].answer).toBe("beta");
  });

  it("parses JSON array of cards", async () => {
    const { parseJSON } = await import("../lib/import");
    const json = JSON.stringify([
      { question: "Q1", answer: "A1" },
      { question: "Q2", answer: "A2", tags: ["x"] },
    ]);
    const result = parseJSON(json);
    expect(result.cards.length).toBe(2);
    expect(result.cards[1].tags).toEqual(["x"]);
  });

  it("flags malformed JSON", async () => {
    const { parseJSON } = await import("../lib/import");
    const result = parseJSON("not json");
    expect(result.cards.length).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("strips UTF-8 BOM at file start (Excel export)", async () => {
    const { parseDelimited } = await import("../lib/import");
    const csv = "﻿question,answer\nWhat is 2+2?,4";
    const result = parseDelimited(csv, ",");
    expect(result.cards.length).toBe(1);
    expect(result.cards[0].question).toBe("What is 2+2?");
  });

  it("handles \\r\\n line endings", async () => {
    const { parseDelimited } = await import("../lib/import");
    const csv = "q,a\r\nA,1\r\nB,2";
    const result = parseDelimited(csv, ",");
    expect(result.cards.length).toBe(2);
    expect(result.cards[1].question).toBe("B");
  });

  it("handles newlines inside quoted fields", async () => {
    const { parseDelimited } = await import("../lib/import");
    const csv = `question,answer\n"line one\nline two",ok`;
    const result = parseDelimited(csv, ",");
    expect(result.cards.length).toBe(1);
    expect(result.cards[0].question).toBe("line one\nline two");
  });

  it("handles escaped double quotes inside fields", async () => {
    const { parseDelimited } = await import("../lib/import");
    const csv = `q,a\n"he said ""hi""",reply`;
    const result = parseDelimited(csv, ",");
    expect(result.cards.length).toBe(1);
    expect(result.cards[0].question).toBe('he said "hi"');
  });

  it("ignores blank lines between rows", async () => {
    const { parseDelimited } = await import("../lib/import");
    const csv = "q,a\n\n\nfoo,bar\n\n";
    const result = parseDelimited(csv, ",");
    expect(result.cards.length).toBe(1);
    expect(result.cards[0].question).toBe("foo");
  });
});

describe("card quality grader", () => {
  it("scores a well-formed card high", async () => {
    const { gradeCardQuality } = await import("../lib/card-quality");
    const card: any = {
      id: "1",
      question: "What is the capital of France?",
      answer: "Paris",
      tags: ["geography"],
      customTags: [],
      notes: "",
      favorite: false,
      archived: false,
      effective_difficulty: "easy",
      difficulty: "easy",
      difficulty_rationale: null,
      quality_score: null,
      source_fact: null,
      edited: false,
    };
    const r = gradeCardQuality(card);
    expect(r.score).toBeGreaterThan(80);
  });

  it("penalizes a card with Q equal to A", async () => {
    const { gradeCardQuality } = await import("../lib/card-quality");
    const card: any = {
      id: "2",
      question: "Paris",
      answer: "Paris",
      tags: [], customTags: [], notes: "", favorite: false, archived: false,
      effective_difficulty: null, difficulty: null, difficulty_rationale: null,
      quality_score: null, source_fact: null, edited: false,
    };
    const r = gradeCardQuality(card);
    expect(r.score).toBeLessThan(70);
  });
});
