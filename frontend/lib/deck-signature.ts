// Deck integrity: SHA-256 checksum of (sorted) Q/A pairs + a short version
// stamp. Lets a share URL prove it hasn't been tampered with vs. the original.

import type { ParsedCard } from "./import";

export async function digestCards(cards: ParsedCard[]): Promise<string> {
  const sorted = cards
    .slice()
    .sort((a, b) => `${a.question}|${a.answer}`.localeCompare(`${b.question}|${b.answer}`))
    .map((c) => `${c.question.trim().toLowerCase()}|${c.answer.trim().toLowerCase()}`)
    .join("\n");
  if (typeof window === "undefined") {
    // SSR fallback: simple FNV-1a hash.
    let h = 0x811c9dc5;
    for (let i = 0; i < sorted.length; i++) {
      h = (h ^ sorted.charCodeAt(i)) >>> 0;
      h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }
  const enc = new TextEncoder().encode(sorted);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export interface SignedShare {
  name: string;
  version: string;
  digest: string;
  created_at: string;
  cards: ParsedCard[];
}

export async function signShare(name: string, cards: ParsedCard[]): Promise<SignedShare> {
  const digest = await digestCards(cards);
  return {
    name,
    version: "1",
    digest,
    created_at: new Date().toISOString(),
    cards,
  };
}

export async function verifyShare(share: SignedShare): Promise<boolean> {
  const computed = await digestCards(share.cards);
  return computed === share.digest;
}
