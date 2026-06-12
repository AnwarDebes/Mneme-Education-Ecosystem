// Client-side exporters: take a resolved deck and produce CSV / JSON / TSV
// content that the browser can download. The .apkg export lives on the
// backend and is served as a static file.

import type { ResolvedCard } from "./cards";

function csvEscape(value: string): string {
  if (value == null) return "";
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function cardsToCSV(cards: ResolvedCard[]): string {
  const header = [
    "id",
    "question",
    "answer",
    "difficulty",
    "tags",
    "favorite",
    "notes",
    "source_fact",
  ];
  const rows = cards.map((c) =>
    [
      c.id,
      c.question,
      c.answer,
      c.effective_difficulty ?? "",
      [...c.tags, ...c.customTags].join("|"),
      c.favorite ? "yes" : "no",
      c.notes,
      c.source_fact ?? "",
    ].map(csvEscape),
  );
  return [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function cardsToTSV(cards: ResolvedCard[]): string {
  return cards
    .map((c) => `${c.question.replace(/\t/g, " ")}\t${c.answer.replace(/\t/g, " ")}`)
    .join("\n");
}

export function cardsToJSON(cards: ResolvedCard[]): string {
  return JSON.stringify(
    cards.map((c) => ({
      id: c.id,
      question: c.question,
      answer: c.answer,
      difficulty: c.effective_difficulty,
      tags: [...c.tags, ...c.customTags],
      favorite: c.favorite,
      archived: c.archived,
      notes: c.notes,
      source_fact: c.source_fact,
      difficulty_rationale: c.difficulty_rationale,
      quality_score: c.quality_score,
    })),
    null,
    2,
  );
}

export function downloadText(filename: string, mime: string, content: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 200);
}
