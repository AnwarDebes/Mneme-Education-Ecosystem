import type { Metadata } from "next";
import { Suspense } from "react";
import { DeckCompareShell } from "@/components/deck-compare-shell";

export const metadata: Metadata = {
  title: "Compare decks",
  description: "Side-by-side mastery, retention, and engagement between any two decks.",
};

export default function ComparePage() {
  return (
    <Suspense fallback={null}>
      <DeckCompareShell />
    </Suspense>
  );
}
