// Course mode: treat a collection as an ordered curriculum.
// We store an explicit deck order per collection and a "completed" flag per
// deck-step so the user can mark sections done independently of FSRS.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";

export type GoalKind = "mastery" | "coverage" | "maintenance";

export interface CourseStep {
  deck_id: string;
  goal: GoalKind;
  target_mastered_pct?: number;
  completed?: boolean;
  notes?: string;
}

export interface Course {
  collection_id: string;
  steps: CourseStep[];
  started_at: string;
  finished_at?: string;
}

const KEY = "course:v1";

function load(): Record<string, Course> {
  return readJSON<Record<string, Course>>(KEY, {});
}

function save(map: Record<string, Course>): void {
  writeJSON(KEY, map);
  notifyStorageChange();
}

export function loadCourse(collectionId: string): Course | null {
  return load()[collectionId] ?? null;
}

export function saveCourse(course: Course): void {
  const all = load();
  all[course.collection_id] = course;
  save(all);
}

export function deleteCourse(collectionId: string): void {
  const all = load();
  delete all[collectionId];
  save(all);
}

export function createCourse(collectionId: string, deckIds: string[]): Course {
  const course: Course = {
    collection_id: collectionId,
    started_at: new Date().toISOString(),
    steps: deckIds.map((deck_id) => ({
      deck_id,
      goal: "mastery",
      target_mastered_pct: 80,
      completed: false,
    })),
  };
  saveCourse(course);
  return course;
}

export function toggleStepComplete(collectionId: string, deckId: string): void {
  const course = loadCourse(collectionId);
  if (!course) return;
  for (const s of course.steps) {
    if (s.deck_id === deckId) s.completed = !s.completed;
  }
  saveCourse(course);
}

export function setStepGoal(
  collectionId: string,
  deckId: string,
  goal: GoalKind,
  targetPct?: number,
): void {
  const course = loadCourse(collectionId);
  if (!course) return;
  for (const s of course.steps) {
    if (s.deck_id !== deckId) continue;
    s.goal = goal;
    if (targetPct != null) s.target_mastered_pct = targetPct;
  }
  saveCourse(course);
}

export function reorderSteps(collectionId: string, deckIds: string[]): void {
  const course = loadCourse(collectionId);
  if (!course) return;
  const byId = new Map(course.steps.map((s) => [s.deck_id, s]));
  course.steps = deckIds
    .map((id) => byId.get(id))
    .filter((s): s is CourseStep => !!s);
  // Append any steps that weren't in the new order (shouldn't normally happen).
  for (const s of byId.values()) {
    if (!course.steps.includes(s)) course.steps.push(s);
  }
  saveCourse(course);
}
