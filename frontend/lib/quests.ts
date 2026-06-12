// Daily quests: three small daily goals that refresh on a new day.
// Each quest tracks progress toward a target and awards XP when complete.

import { notifyStorageChange, readJSON, writeJSON } from "./storage";
import { addXP } from "./xp";
import { isoDate } from "./stats";

export interface Quest {
  id: string;
  title: string;
  description: string;
  target: number;
  reward_xp: number;
  metric: "reviews" | "minutes" | "accuracy" | "modes";
}

export interface QuestState {
  date: string;
  quests: Quest[];
  progress: Record<string, number>;
  claimed: string[];
}

const KEY = "quests:v1";

const POOL: Quest[] = [
  { id: "review-20", title: "Quick warmup", description: "Review 20 cards today.", target: 20, reward_xp: 30, metric: "reviews" },
  { id: "review-50", title: "Steady learner", description: "Review 50 cards today.", target: 50, reward_xp: 80, metric: "reviews" },
  { id: "review-100", title: "Heavy session", description: "Review 100 cards today.", target: 100, reward_xp: 180, metric: "reviews" },
  { id: "minutes-25", title: "One Pomodoro", description: "Study 25 focused minutes today.", target: 25, reward_xp: 40, metric: "minutes" },
  { id: "minutes-60", title: "Hour of focus", description: "Study 60 minutes today.", target: 60, reward_xp: 100, metric: "minutes" },
  { id: "modes-3", title: "Mix it up", description: "Use three different study modes today.", target: 3, reward_xp: 60, metric: "modes" },
  { id: "modes-5", title: "Mode marathon", description: "Use five different study modes today.", target: 5, reward_xp: 140, metric: "modes" },
  { id: "accuracy-90", title: "Sharp shooter", description: "Reach 90% session accuracy today.", target: 90, reward_xp: 80, metric: "accuracy" },
];

function pickThree(date: string): Quest[] {
  // Deterministic seed from the date so all reads on the same day pick the
  // same quests, but different days get different sets.
  let seed = 0;
  for (const c of date) seed = (seed * 31 + c.charCodeAt(0)) & 0x7fffffff;
  const pool = POOL.slice();
  const out: Quest[] = [];
  while (out.length < 3 && pool.length > 0) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const idx = seed % pool.length;
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

export function loadQuests(): QuestState {
  const today = isoDate();
  const cur = readJSON<QuestState | null>(KEY, null);
  if (cur && cur.date === today) return cur;
  const fresh: QuestState = {
    date: today,
    quests: pickThree(today),
    progress: {},
    claimed: [],
  };
  writeJSON(KEY, fresh);
  notifyStorageChange();
  return fresh;
}

export function saveQuests(state: QuestState): void {
  writeJSON(KEY, state);
  notifyStorageChange();
}

export function bumpQuest(metric: Quest["metric"], delta: number): void {
  const state = loadQuests();
  for (const q of state.quests) {
    if (q.metric !== metric) continue;
    state.progress[q.id] = (state.progress[q.id] ?? 0) + delta;
  }
  saveQuests(state);
}

export function setQuestAbsolute(metric: Quest["metric"], value: number): void {
  const state = loadQuests();
  for (const q of state.quests) {
    if (q.metric !== metric) continue;
    state.progress[q.id] = Math.max(state.progress[q.id] ?? 0, value);
  }
  saveQuests(state);
}

export interface ClaimResult {
  claimed: number;
  xp_total: number;
  names: string[];
}

export function claimCompleted(): ClaimResult {
  const state = loadQuests();
  let xpEarned = 0;
  const names: string[] = [];
  for (const q of state.quests) {
    if (state.claimed.includes(q.id)) continue;
    const progress = state.progress[q.id] ?? 0;
    if (progress >= q.target) {
      state.claimed.push(q.id);
      xpEarned += q.reward_xp;
      names.push(q.title);
    }
  }
  if (xpEarned > 0) {
    addXP(xpEarned);
    saveQuests(state);
  }
  return { claimed: names.length, xp_total: xpEarned, names };
}
