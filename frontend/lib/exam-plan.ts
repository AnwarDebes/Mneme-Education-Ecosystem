// Practice-exam scheduler. Given a target exam date and a deck (or
// collection), generate a schedule of practice tests on a tightening curve:
// every 7 days, then 4 days, then 2 days, then daily as the date approaches.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";
import { isoDate } from "./stats";

export type ExamScope = { kind: "deck"; deck_id: string } | { kind: "collection"; collection_id: string };

export interface ExamSession {
  date: string;
  question_count: number;
  duration_min: number;
  done: boolean;
  score_pct?: number;
}

export interface ExamPlan {
  id: string;
  name: string;
  target_date: string;
  scope: ExamScope;
  sessions: ExamSession[];
  created_at: string;
}

const KEY = "exam-plans:v1";

function load(): ExamPlan[] {
  return readJSON<ExamPlan[]>(KEY, []);
}

function save(plans: ExamPlan[]): void {
  writeJSON(KEY, plans);
  notifyStorageChange();
}

export function loadExamPlans(): ExamPlan[] {
  return load();
}

function newId(): string {
  return `exam-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function dateMinusDays(end: Date, days: number): string {
  const d = new Date(end);
  d.setDate(d.getDate() - days);
  return isoDate(d);
}

function defaultSessions(targetDate: string, questionCount: number, durationMin: number): ExamSession[] {
  const end = new Date(targetDate + "T00:00:00");
  const today = new Date(isoDate() + "T00:00:00");
  const daysOut = Math.max(0, Math.round((end.getTime() - today.getTime()) / 86400000));
  if (daysOut === 0) return [{ date: targetDate, question_count: questionCount, duration_min: durationMin, done: false }];

  // Sample at increasing density: every 7 days far out, then 4, then 2, then daily in last 3 days.
  const dates = new Set<string>();
  dates.add(targetDate);
  // Last 3 days
  for (let i = 1; i <= 3 && i <= daysOut; i++) dates.add(dateMinusDays(end, i));
  // Every 2 days for 4 days before that
  for (let i = 4; i <= 10 && i <= daysOut; i += 2) dates.add(dateMinusDays(end, i));
  // Every 4 days for the run-up
  for (let i = 14; i <= 26 && i <= daysOut; i += 4) dates.add(dateMinusDays(end, i));
  // Weekly anchors going further out
  for (let i = 33; i <= daysOut; i += 7) dates.add(dateMinusDays(end, i));

  return Array.from(dates)
    .sort()
    .map((date) => ({
      date,
      question_count: questionCount,
      duration_min: durationMin,
      done: false,
    }));
}

export function createExamPlan(
  name: string,
  targetDate: string,
  scope: ExamScope,
  questionCount: number,
  durationMin: number,
): ExamPlan {
  const plan: ExamPlan = {
    id: newId(),
    name: name.trim() || "Exam",
    target_date: targetDate,
    scope,
    sessions: defaultSessions(targetDate, questionCount, durationMin),
    created_at: new Date().toISOString(),
  };
  const plans = load();
  plans.push(plan);
  save(plans);
  return plan;
}

export function deleteExamPlan(id: string): void {
  save(load().filter((p) => p.id !== id));
}

export function markSession(planId: string, date: string, scorePct?: number): void {
  const plans = load();
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return;
  for (const s of plan.sessions) {
    if (s.date === date) {
      s.done = true;
      if (scorePct != null) s.score_pct = scorePct;
    }
  }
  save(plans);
}

export function nextSession(plan: ExamPlan): ExamSession | null {
  const today = isoDate();
  for (const s of plan.sessions) {
    if (!s.done) {
      if (s.date >= today) return s;
    }
  }
  // Past-due sessions still surface as "next" (catch up).
  return plan.sessions.find((s) => !s.done) ?? null;
}

export function planProgress(plan: ExamPlan): { done: number; total: number; pct: number } {
  const done = plan.sessions.filter((s) => s.done).length;
  return { done, total: plan.sessions.length, pct: plan.sessions.length ? Math.round((done / plan.sessions.length) * 100) : 0 };
}
