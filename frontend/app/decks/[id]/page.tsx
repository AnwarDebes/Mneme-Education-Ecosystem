import type { Metadata } from "next";
import { DeckDetailShell } from "@/components/deck-detail-shell";

export const metadata: Metadata = {
  title: "Deck",
  description: "Review and edit the cards in a deck.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DeckPage({ params }: PageProps) {
  const { id } = await params;
  return <DeckDetailShell deckId={id} />;
}
