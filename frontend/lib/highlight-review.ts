// Spaced review of highlights: turn each highlight into a "do I remember
// this passage" prompt and schedule like a card. We piggyback on the
// existing FSRS-lite schedule store with a virtual card id "h:<deck>:<hid>".

import { getCardSchedule, gradeCard, type Grade } from "./schedule";
import { loadHighlights, type Highlight } from "./highlights";

export interface HighlightReviewItem {
  deck_id: string;
  highlight: Highlight;
  due_at: string;
  reps: number;
}

function virtualId(deckId: string, highlightId: string): string {
  return `__hl__${deckId}__${highlightId}`;
}

export function highlightReviewQueue(deckIds: string[]): HighlightReviewItem[] {
  const now = Date.now();
  const out: HighlightReviewItem[] = [];
  for (const deckId of deckIds) {
    for (const h of loadHighlights(deckId)) {
      const sched = getCardSchedule(deckId, virtualId(deckId, h.id));
      const dueAt = sched.last_graded ? sched.due_at : new Date().toISOString();
      if (new Date(dueAt).getTime() <= now + 86400000) {
        out.push({ deck_id: deckId, highlight: h, due_at: dueAt, reps: sched.reps });
      }
    }
  }
  return out.sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
}

export function gradeHighlight(deckId: string, highlight: Highlight, grade: Grade): void {
  gradeCard(deckId, virtualId(deckId, highlight.id), grade);
}
