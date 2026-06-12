// Per-card relationship graph: card A "is a prerequisite of" / "related to"
// card B. Stored as a flat list of edges so we can render both directions.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

export type RelationKind = "prereq" | "related";

export interface Relation {
  from: string;
  to: string;
  kind: RelationKind;
  created_at: string;
}

const PREFIX = "rel:";

function key(deckId: string): string {
  return PREFIX + deckId;
}

export function loadRelations(deckId: string): Relation[] {
  return readJSON<Relation[]>(key(deckId), []);
}

export function saveRelations(deckId: string, relations: Relation[]): void {
  writeJSON(key(deckId), relations);
  notifyStorageChange();
}

export function addRelation(
  deckId: string,
  from: string,
  to: string,
  kind: RelationKind,
): void {
  if (from === to) return;
  const list = loadRelations(deckId);
  if (list.some((r) => r.from === from && r.to === to && r.kind === kind)) return;
  list.push({ from, to, kind, created_at: new Date().toISOString() });
  saveRelations(deckId, list);
}

export function removeRelation(
  deckId: string,
  from: string,
  to: string,
  kind: RelationKind,
): void {
  const list = loadRelations(deckId).filter(
    (r) => !(r.from === from && r.to === to && r.kind === kind),
  );
  saveRelations(deckId, list);
}

export interface RelatedNeighbors {
  prereqs_in: string[];
  prereqs_out: string[];
  related: string[];
}

export function neighbors(deckId: string, cardId: string): RelatedNeighbors {
  const list = loadRelations(deckId);
  const out: RelatedNeighbors = { prereqs_in: [], prereqs_out: [], related: [] };
  for (const r of list) {
    if (r.kind === "prereq" && r.to === cardId) out.prereqs_in.push(r.from);
    if (r.kind === "prereq" && r.from === cardId) out.prereqs_out.push(r.to);
    if (r.kind === "related" && (r.from === cardId || r.to === cardId)) {
      out.related.push(r.from === cardId ? r.to : r.from);
    }
  }
  // Dedupe.
  out.prereqs_in = Array.from(new Set(out.prereqs_in));
  out.prereqs_out = Array.from(new Set(out.prereqs_out));
  out.related = Array.from(new Set(out.related));
  return out;
}
