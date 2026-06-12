import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Standard shadcn helper: merge Tailwind class lists, dedupe conflicts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number of seconds as a human-readable elapsed string. */
export function formatElapsed(seconds: number): string {
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds - m * 60);
  return `${m}m ${s}s`;
}

/** Truncate a long string to ``n`` chars, adding a horizontal ellipsis. */
export function truncate(text: string, n: number): string {
  if (text.length <= n) return text;
  return text.slice(0, n - 1) + "...";
}

/** Pick the right colour for a difficulty label. */
export function difficultyTone(d?: string | null): {
  label: string;
  bg: string;
  fg: string;
  ring: string;
} {
  switch ((d || "").toLowerCase()) {
    case "easy":
      return {
        label: "Easy",
        bg: "bg-success/15",
        fg: "text-success",
        ring: "ring-success/30",
      };
    case "medium":
      return {
        label: "Medium",
        bg: "bg-warn/15",
        fg: "text-warn",
        ring: "ring-warn/30",
      };
    case "hard":
      return {
        label: "Hard",
        bg: "bg-destructive/15",
        fg: "text-destructive",
        ring: "ring-destructive/30",
      };
    default:
      return {
        label: "Unrated",
        bg: "bg-muted",
        fg: "text-muted-foreground",
        ring: "ring-border",
      };
  }
}
