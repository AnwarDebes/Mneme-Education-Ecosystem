"use client";
// Beyond plain light/dark we support a small palette of "vibes" applied as
// extra data-attributes on <html>. Each variant tweaks the same CSS vars
// used elsewhere, so every component picks them up for free.

import { useEffect, useState } from "react";
import { readJSON, writeJSON, notifyStorageChange, subscribe } from "./storage";

export type ThemeVariant = "default" | "sepia" | "high-contrast" | "oled";

const KEY = "settings:theme-variant";

export const VARIANTS: { id: ThemeVariant; label: string; description: string }[] = [
  { id: "default", label: "Mneme", description: "The default warm-paper palette." },
  { id: "sepia", label: "Sepia", description: "Warm, paper-like tones; easy on the eyes." },
  { id: "high-contrast", label: "High contrast", description: "Maximum contrast for low-light or accessibility." },
  { id: "oled", label: "OLED black", description: "Pure black backgrounds for OLED displays." },
];

export function loadVariant(): ThemeVariant {
  return readJSON<ThemeVariant>(KEY, "default");
}

export function saveVariant(v: ThemeVariant): void {
  writeJSON(KEY, v);
  apply(v);
  notifyStorageChange();
}

export function apply(v: ThemeVariant): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-variant", v);
}

export function useThemeVariant(): [ThemeVariant, (v: ThemeVariant) => void] {
  const [variant, setVariant] = useState<ThemeVariant>("default");
  useEffect(() => {
    setVariant(loadVariant());
    apply(loadVariant());
    return subscribe(() => setVariant(loadVariant()));
  }, []);
  return [variant, saveVariant];
}
