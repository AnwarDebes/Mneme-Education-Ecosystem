// Achievement definitions. Each achievement has a stable id, a name, a
// description, an icon, and a ``check`` function that takes the current
// stats and returns whether it should unlock. Achievements unlock once
// and never lock back; we just keep an ``unlocked`` array in stats.

import { Award, Flame, Library, Sparkles, Star, Target, Zap } from "lucide-react";
import type { ComponentType } from "react";
import type { GlobalStats } from "./stats";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  tier: "bronze" | "silver" | "gold" | "platinum";
  check: (stats: GlobalStats) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-card",
    name: "First Spark",
    description: "Review your first card.",
    icon: Sparkles,
    tier: "bronze",
    check: (s) => s.total_reviewed >= 1,
  },
  {
    id: "ten-cards",
    name: "Getting Warm",
    description: "Review 10 cards total.",
    icon: Zap,
    tier: "bronze",
    check: (s) => s.total_reviewed >= 10,
  },
  {
    id: "fifty-cards",
    name: "Halfway Hero",
    description: "Review 50 cards total.",
    icon: Target,
    tier: "silver",
    check: (s) => s.total_reviewed >= 50,
  },
  {
    id: "hundred-cards",
    name: "Centurion",
    description: "Review 100 cards total.",
    icon: Award,
    tier: "silver",
    check: (s) => s.total_reviewed >= 100,
  },
  {
    id: "five-hundred-cards",
    name: "Half a Thousand",
    description: "Review 500 cards total.",
    icon: Star,
    tier: "gold",
    check: (s) => s.total_reviewed >= 500,
  },
  {
    id: "thousand-cards",
    name: "Card Connoisseur",
    description: "Review 1,000 cards total.",
    icon: Library,
    tier: "platinum",
    check: (s) => s.total_reviewed >= 1000,
  },
  {
    id: "streak-3",
    name: "Three in a Row",
    description: "Study three days in a row.",
    icon: Flame,
    tier: "bronze",
    check: (s) => s.current_streak >= 3 || s.longest_streak >= 3,
  },
  {
    id: "streak-7",
    name: "Weekly Habit",
    description: "Study seven days in a row.",
    icon: Flame,
    tier: "silver",
    check: (s) => s.current_streak >= 7 || s.longest_streak >= 7,
  },
  {
    id: "streak-30",
    name: "Monthly Marathon",
    description: "Study thirty days in a row.",
    icon: Flame,
    tier: "gold",
    check: (s) => s.current_streak >= 30 || s.longest_streak >= 30,
  },
  {
    id: "streak-100",
    name: "Triple Digits",
    description: "Study a hundred days in a row.",
    icon: Flame,
    tier: "platinum",
    check: (s) => s.current_streak >= 100 || s.longest_streak >= 100,
  },
  {
    id: "deep-focus",
    name: "Deep Focus",
    description: "Study at least 30 minutes in a single day.",
    icon: Target,
    tier: "silver",
    check: (s) => Object.values(s.daily).some((d) => d.minutes >= 30),
  },
  {
    id: "perfect-day",
    name: "Flawless",
    description: "End a day with zero ``again`` grades and at least 10 reviews.",
    icon: Star,
    tier: "gold",
    check: (s) =>
      Object.values(s.daily).some((d) => d.reviewed >= 10 && d.again === 0),
  },
];

export function tierColor(tier: Achievement["tier"]): string {
  switch (tier) {
    case "bronze":
      return "from-amber-700/40 to-amber-500/20 ring-amber-700/40 text-amber-700 dark:text-amber-300";
    case "silver":
      return "from-slate-400/40 to-slate-200/20 ring-slate-400/40 text-slate-500 dark:text-slate-300";
    case "gold":
      return "from-yellow-400/50 to-amber-300/30 ring-yellow-500/50 text-yellow-700 dark:text-yellow-300";
    case "platinum":
      return "from-violet-500/40 to-indigo-400/30 ring-violet-500/50 text-violet-600 dark:text-violet-300";
  }
}
