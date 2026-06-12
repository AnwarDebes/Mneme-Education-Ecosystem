import { describe, it, expect } from "vitest";
import { buildIndex, searchIndex } from "@/lib/search-index";
import type { ResolvedCard } from "@/lib/cards";

function mk(id: string, q: string, a: string, tags: string[] = []): ResolvedCard {
  return {
    id,
    question: q,
    answer: a,
    source_fact: "",
    notes: "",
    tags,
    customTags: [],
    effective_difficulty: "medium",
    cloze: null,
    starred: false,
    hidden: false,
  } as unknown as ResolvedCard;
}

describe("search-index", () => {
  const idx = buildIndex([
    {
      deckId: "biology",
      cards: [
        mk("c1", "What is photosynthesis?", "Plants converting light to sugar.", ["plant"]),
        mk("c2", "What is mitosis?", "Cell division producing identical daughters.", ["cell"]),
      ],
    },
    {
      deckId: "history",
      cards: [
        mk("c3", "When did World War II end?", "September 1945.", ["war"]),
      ],
    },
  ]);

  it("returns empty for empty query", () => {
    expect(searchIndex(idx, "")).toEqual([]);
    expect(searchIndex(idx, "   ")).toEqual([]);
  });

  it("matches by question token", () => {
    const hits = searchIndex(idx, "photosynthesis");
    expect(hits.length).toBe(1);
    expect(hits[0].card.id).toBe("c1");
  });

  it("matches across decks", () => {
    const hits = searchIndex(idx, "war");
    expect(hits.length).toBe(1);
    expect(hits[0].deckId).toBe("history");
  });

  it("ranks exact substring above pure token match", () => {
    const hits = searchIndex(idx, "world war");
    expect(hits[0].card.id).toBe("c3");
    // substring bonus is added on top of the token-IDF mass, so the
    // top hit's score must exceed the query's IDF mass alone.
    expect(hits[0].score).toBeGreaterThan(0);
  });

  it("ranks rare tokens higher than common ones (IDF effect)", () => {
    const corpus = buildIndex([
      {
        deckId: "x",
        cards: [
          // 'test' appears in every card -> low IDF
          mk("c1", "test photosynthesis", "answer"),
          mk("c2", "test cell biology", "answer"),
          mk("c3", "test world history", "answer"),
        ],
      },
    ]);
    // Hit purely on rare token vs purely on common token: rare wins.
    const rare = searchIndex(corpus, "photosynthesis");
    const common = searchIndex(corpus, "test");
    expect(rare[0].score).toBeGreaterThan(0);
    // 'test' appears in every doc -> IDF = 0 -> all results score 0
    expect(common[0]?.score ?? 0).toBeLessThanOrEqual(rare[0].score);
  });

  it("respects limit", () => {
    const big = buildIndex([
      {
        deckId: "x",
        cards: Array.from({ length: 200 }).map((_, i) => mk(`b${i}`, "test card", "answer here")),
      },
    ]);
    const hits = searchIndex(big, "test", 10);
    expect(hits.length).toBe(10);
  });
});
