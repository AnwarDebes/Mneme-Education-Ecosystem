// Per-deck color override: a single primary hue, applied as a CSS variable
// scoped to the deck's pages. Saved in the deck meta's color slot already
// for the gradient; this is a richer override.

import { loadDeckMeta, saveDeckMeta } from "./deck-store";

export interface DeckTheme {
  primary_hue: number;
  primary_sat: number;
}

const PALETTE: DeckTheme[] = [
  { primary_hue: 250, primary_sat: 65 }, // violet (default)
  { primary_hue: 30, primary_sat: 88 }, // amber
  { primary_hue: 152, primary_sat: 60 }, // emerald
  { primary_hue: 200, primary_sat: 80 }, // sky
  { primary_hue: 0, primary_sat: 70 }, // rose
  { primary_hue: 280, primary_sat: 65 }, // purple
  { primary_hue: 180, primary_sat: 70 }, // teal
  { primary_hue: 50, primary_sat: 85 }, // yellow
];

export function getThemePalette(): DeckTheme[] {
  return PALETTE;
}

export function getDeckTheme(deckId: string): DeckTheme | null {
  const meta = loadDeckMeta(deckId);
  if (!meta.color) return null;
  // We store the theme as a JSON-encoded suffix on color when set via picker.
  if (meta.color.startsWith("hue:")) {
    const parts = meta.color.slice(4).split(",");
    return { primary_hue: Number(parts[0]) || 250, primary_sat: Number(parts[1]) || 65 };
  }
  return null;
}

export function setDeckTheme(deckId: string, theme: DeckTheme): void {
  const meta = loadDeckMeta(deckId);
  meta.color = `hue:${theme.primary_hue},${theme.primary_sat}`;
  saveDeckMeta(deckId, meta);
}

export function clearDeckTheme(deckId: string): void {
  const meta = loadDeckMeta(deckId);
  meta.color = undefined;
  saveDeckMeta(deckId, meta);
}

export function styleForDeck(deckId: string): React.CSSProperties {
  const t = getDeckTheme(deckId);
  if (!t) return {};
  return {
    // Override the primary HSL CSS variables within this subtree.
    ["--primary" as any]: `${t.primary_hue} ${t.primary_sat}% 50%`,
    ["--ring" as any]: `${t.primary_hue} ${t.primary_sat}% 50%`,
  };
}
