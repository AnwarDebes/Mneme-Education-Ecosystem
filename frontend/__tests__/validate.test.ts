import { describe, it, expect } from "vitest";
import {
  ResponseShapeError,
  validateCard,
  validateJobSummary,
  validateVisionCheck,
} from "@/lib/validate";

describe("API response validators", () => {
  describe("validateJobSummary", () => {
    it("accepts a well-formed payload", () => {
      const r = validateJobSummary({
        id: "abc",
        filename: "x.pdf",
        status: "done",
        n_cards: 10,
        created_at: "2026-05-25",
      });
      expect(r.id).toBe("abc");
    });

    it("throws with a path on missing field", () => {
      try {
        validateJobSummary({ id: "abc", filename: "x.pdf", status: "done", created_at: "x" });
        throw new Error("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ResponseShapeError);
        expect((err as ResponseShapeError).path).toBe("job.n_cards");
      }
    });

    it("throws on wrong type", () => {
      expect(() =>
        validateJobSummary({ id: "abc", filename: "x", status: "done", n_cards: "10", created_at: "x" }),
      ).toThrow(ResponseShapeError);
    });

    it("rejects array/null at the top level", () => {
      expect(() => validateJobSummary(null)).toThrow(ResponseShapeError);
      expect(() => validateJobSummary([])).toThrow(ResponseShapeError);
    });
  });

  describe("validateCard", () => {
    it("accepts minimal valid card", () => {
      const c = validateCard({ id: "1", question: "Q", answer: "A" }, "card");
      expect(c.question).toBe("Q");
    });

    it("path includes parent context", () => {
      try {
        validateCard({ id: "1", question: "Q" }, "deck.cards[2]");
      } catch (err) {
        expect((err as ResponseShapeError).path).toBe("deck.cards[2].answer");
      }
    });
  });

  describe("validateVisionCheck", () => {
    it("accepts available shape", () => {
      const r = validateVisionCheck({ available: true, model: "llava:7b", candidates: ["llava:7b"] });
      expect(r.available).toBe(true);
      expect(r.model).toBe("llava:7b");
    });

    it("accepts model: null when not available", () => {
      const r = validateVisionCheck({ available: false, model: null });
      expect(r.model).toBeNull();
    });

    it("rejects non-boolean available", () => {
      expect(() => validateVisionCheck({ available: "no", model: null })).toThrow(ResponseShapeError);
    });

    it("filters out non-string candidates silently", () => {
      const r = validateVisionCheck({ available: true, model: "x", candidates: ["llava:7b", 123, null] });
      expect(r.candidates).toEqual(["llava:7b"]);
    });
  });
});
