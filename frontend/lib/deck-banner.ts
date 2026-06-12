// Per-deck cover image: user pastes a URL or chooses one of the bundled
// SVG gradients. Stored in the existing deck meta.

import { loadDeckMeta, saveDeckMeta } from "./deck-store";

export interface DeckBanner {
  kind: "url" | "gradient";
  value: string;
}

const GRADIENTS: { name: string; css: string }[] = [
  { name: "violet sunrise", css: "linear-gradient(120deg, #7c3aed 0%, #f59e0b 100%)" },
  { name: "ocean", css: "linear-gradient(120deg, #0ea5e9 0%, #6366f1 100%)" },
  { name: "forest", css: "linear-gradient(120deg, #10b981 0%, #064e3b 100%)" },
  { name: "ember", css: "linear-gradient(120deg, #ef4444 0%, #f59e0b 100%)" },
  { name: "ink", css: "linear-gradient(120deg, #0f172a 0%, #475569 100%)" },
  { name: "candy", css: "linear-gradient(120deg, #f472b6 0%, #a78bfa 100%)" },
];

export function getBannerGradients() {
  return GRADIENTS;
}

export function getDeckBanner(deckId: string): DeckBanner | null {
  const meta = loadDeckMeta(deckId);
  // We piggyback on the description slot to avoid expanding the DeckMeta
  // type; URLs go in "banner-url:" prefix, gradients in "banner-grad:".
  const cur = meta.description || "";
  const url = cur.match(/^banner-url:(.*)$/s);
  if (url) return { kind: "url", value: url[1] };
  const grad = cur.match(/^banner-grad:(.*)$/s);
  if (grad) return { kind: "gradient", value: grad[1] };
  return null;
}

export function setDeckBanner(deckId: string, banner: DeckBanner | null): void {
  const meta = loadDeckMeta(deckId);
  if (!banner) {
    if (meta.description?.startsWith("banner-")) meta.description = undefined;
  } else if (banner.kind === "url") {
    meta.description = `banner-url:${banner.value}`;
  } else {
    meta.description = `banner-grad:${banner.value}`;
  }
  saveDeckMeta(deckId, meta);
}
