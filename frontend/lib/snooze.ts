// Manual scheduling override: pause a card for N days, or set a specific
// due date. Layered on top of the FSRS-lite schedule store.

import { loadDeckSchedule, saveDeckSchedule, type CardSchedule } from "./schedule";

function emptyCardSchedule(): CardSchedule {
  return {
    reps: 0,
    lapses: 0,
    ease: 2.5,
    interval_days: 0,
    due_at: new Date().toISOString(),
    last_graded: null,
    history: [],
  };
}

export function snoozeCard(deckId: string, cardId: string, days: number): void {
  const all = loadDeckSchedule(deckId);
  const cur = all[cardId] ?? emptyCardSchedule();
  const due = new Date();
  due.setDate(due.getDate() + Math.max(1, days));
  cur.due_at = due.toISOString();
  cur.interval_days = Math.max(cur.interval_days, days);
  all[cardId] = cur;
  saveDeckSchedule(deckId, all);
}

export function setCardDueDate(deckId: string, cardId: string, isoDay: string): void {
  const all = loadDeckSchedule(deckId);
  const cur = all[cardId] ?? emptyCardSchedule();
  cur.due_at = new Date(isoDay + "T00:00:00").toISOString();
  all[cardId] = cur;
  saveDeckSchedule(deckId, all);
}

export function resetCardSchedule(deckId: string, cardId: string): void {
  const all = loadDeckSchedule(deckId);
  delete all[cardId];
  saveDeckSchedule(deckId, all);
}
