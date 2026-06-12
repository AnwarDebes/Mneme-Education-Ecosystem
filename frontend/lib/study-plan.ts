// Per-deck study plans: "master this deck by date X" -> a daily target.
// Tracks progress per day and a running "on pace / behind / done" status.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";
import { isoDate, loadStats } from "./stats";

export interface StudyPlan {
  deck_id: string;
  goal: string;
  total_cards: number;
  target_date: string;
  cards_per_day: number;
  created_at: string;
  reviewed_log: Record<string, number>;
}

const KEY = "study-plans:v1";

function load(): Record<string, StudyPlan> {
  return readJSON<Record<string, StudyPlan>>(KEY, {});
}

function save(plans: Record<string, StudyPlan>): void {
  writeJSON(KEY, plans);
  notifyStorageChange();
}

export function loadPlan(deckId: string): StudyPlan | null {
  return load()[deckId] ?? null;
}

export function loadAllPlans(): StudyPlan[] {
  return Object.values(load());
}

export function savePlan(plan: StudyPlan): void {
  const all = load();
  all[plan.deck_id] = plan;
  save(all);
}

export function deletePlan(deckId: string): void {
  const all = load();
  delete all[deckId];
  save(all);
}

export function createPlan(
  deckId: string,
  totalCards: number,
  targetDate: string,
  goal: string,
): StudyPlan {
  const today = isoDate();
  const daysLeft = Math.max(
    1,
    Math.round((new Date(targetDate + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000),
  );
  const plan: StudyPlan = {
    deck_id: deckId,
    goal,
    total_cards: totalCards,
    target_date: targetDate,
    cards_per_day: Math.max(1, Math.ceil(totalCards / daysLeft)),
    created_at: new Date().toISOString(),
    reviewed_log: {},
  };
  savePlan(plan);
  return plan;
}

export interface PlanProgress {
  status: "on_pace" | "behind" | "ahead" | "done" | "expired";
  reviewed_today: number;
  reviewed_total: number;
  days_left: number;
  expected_today_total: number;
  target_pct: number;
  achieved_pct: number;
}

export function planProgress(plan: StudyPlan): PlanProgress {
  const today = isoDate();
  const stats = loadStats();
  const totalReviewed = Object.values(stats.daily)
    .filter((d) => d.date >= plan.created_at.slice(0, 10))
    .reduce((acc, d) => acc + d.reviewed, 0);
  const reviewedToday = stats.daily[today]?.reviewed ?? 0;
  const daysLeft = Math.max(
    0,
    Math.round((new Date(plan.target_date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000),
  );
  const elapsedDays =
    Math.max(
      1,
      Math.round(
        (new Date(today + "T00:00:00").getTime() -
          new Date(plan.created_at.slice(0, 10) + "T00:00:00").getTime()) /
          86400000,
      ),
    ) + 1;
  const expectedToday = Math.min(plan.total_cards, plan.cards_per_day * elapsedDays);
  const targetPct = Math.min(100, Math.round((expectedToday / plan.total_cards) * 100));
  const achievedPct = Math.min(100, Math.round((totalReviewed / plan.total_cards) * 100));
  let status: PlanProgress["status"] = "on_pace";
  if (totalReviewed >= plan.total_cards) status = "done";
  else if (daysLeft === 0) status = "expired";
  else if (totalReviewed < expectedToday * 0.8) status = "behind";
  else if (totalReviewed > expectedToday * 1.15) status = "ahead";
  return {
    status,
    reviewed_today: reviewedToday,
    reviewed_total: totalReviewed,
    days_left: daysLeft,
    expected_today_total: expectedToday,
    target_pct: targetPct,
    achieved_pct: achievedPct,
  };
}
