// Build a per-deck statistics report. CSV for spreadsheet love; HTML for
// the browser's Print-to-PDF.

import type { ResolvedCard } from "./cards";
import { deckScheduleStats, getCardSchedule } from "./schedule";
import { deckRetention } from "./retention";

export interface DeckReport {
  deck_name: string;
  total: number;
  mastered: number;
  learned: number;
  due_now: number;
  lapses: number;
  avg_ease: number;
  retention_mean: number;
  retention_median: number;
  weak_cards: { id: string; question: string; lapses: number; ease: number }[];
  generated_at: string;
}

export function buildDeckReport(deckId: string, deckName: string, cards: ResolvedCard[]): DeckReport {
  const ids = cards.map((c) => c.id);
  const sched = deckScheduleStats(deckId, ids);
  const ret = deckRetention(deckId, ids);
  const weak: DeckReport["weak_cards"] = [];
  for (const c of cards) {
    const s = getCardSchedule(deckId, c.id);
    if (s.lapses > 0 || s.ease < 2.0) {
      weak.push({ id: c.id, question: c.question, lapses: s.lapses, ease: s.ease });
    }
  }
  weak.sort((a, b) => b.lapses - a.lapses || a.ease - b.ease);
  return {
    deck_name: deckName,
    total: cards.length,
    mastered: sched.mastered,
    learned: sched.learned,
    due_now: sched.due_now,
    lapses: sched.lapses,
    avg_ease: sched.avg_ease,
    retention_mean: ret.mean,
    retention_median: ret.median,
    weak_cards: weak.slice(0, 20),
    generated_at: new Date().toISOString(),
  };
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function reportToCSV(r: DeckReport): string {
  const top = [
    `deck,${csvEscape(r.deck_name)}`,
    `total_cards,${r.total}`,
    `mastered,${r.mastered}`,
    `learned,${r.learned}`,
    `due_now,${r.due_now}`,
    `lapses,${r.lapses}`,
    `avg_ease,${r.avg_ease.toFixed(2)}`,
    `retention_mean,${r.retention_mean.toFixed(3)}`,
    `retention_median,${r.retention_median.toFixed(3)}`,
    `generated_at,${r.generated_at}`,
  ].join("\n");
  const weak = [
    "",
    "weak_card_id,question,lapses,ease",
    ...r.weak_cards.map((w) =>
      [w.id, csvEscape(w.question), String(w.lapses), w.ease.toFixed(2)].join(","),
    ),
  ].join("\n");
  return top + "\n" + weak + "\n";
}

export function reportToHTML(r: DeckReport): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>${esc(r.deck_name)} report</title>
<style>
  body { font-family: Inter, system-ui, sans-serif; color: #1e293b; padding: 24px; }
  h1 { margin: 0 0 8px; }
  .meta { color: #64748b; font-size: 11pt; margin-bottom: 16px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 18px; }
  .tile { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
  .tile .v { font-size: 22pt; font-weight: 600; }
  .tile .k { font-size: 9pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
  th { background: #f8fafc; }
  footer { margin-top: 16px; color: #94a3b8; font-size: 9pt; }
</style>
</head><body>
<h1>${esc(r.deck_name)}</h1>
<p class="meta">Generated ${new Date(r.generated_at).toLocaleString()} - via mneme (local only)</p>
<div class="grid">
  <div class="tile"><div class="v">${r.total}</div><div class="k">Total</div></div>
  <div class="tile"><div class="v">${r.mastered}</div><div class="k">Mastered</div></div>
  <div class="tile"><div class="v">${r.learned}</div><div class="k">Learned</div></div>
  <div class="tile"><div class="v">${r.due_now}</div><div class="k">Due now</div></div>
  <div class="tile"><div class="v">${r.lapses}</div><div class="k">Lapses</div></div>
  <div class="tile"><div class="v">${r.avg_ease.toFixed(2)}</div><div class="k">Avg ease</div></div>
  <div class="tile"><div class="v">${Math.round(r.retention_mean * 100)}%</div><div class="k">Retention mean</div></div>
  <div class="tile"><div class="v">${Math.round(r.retention_median * 100)}%</div><div class="k">Retention median</div></div>
</div>
<h2>Hardest cards</h2>
<table><thead><tr><th>Question</th><th>Lapses</th><th>Ease</th></tr></thead><tbody>
${r.weak_cards
  .map((w) => `<tr><td>${esc(w.question)}</td><td>${w.lapses}</td><td>${w.ease.toFixed(2)}</td></tr>`)
  .join("")}
</tbody></table>
<footer>Print this page to PDF from your browser's print dialog.</footer>
</body></html>`;
}
