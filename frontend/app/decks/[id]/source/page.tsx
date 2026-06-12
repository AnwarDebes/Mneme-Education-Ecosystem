import type { Metadata } from "next";
import { SourceViewerShell } from "@/components/source-viewer-shell";

export const metadata: Metadata = {
  title: "Source",
  description: "Read the original source for this deck; highlight to make cards.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SourcePage({ params }: PageProps) {
  const { id } = await params;
  return <SourceViewerShell deckId={id} />;
}
