import type { Metadata } from "next";
import { PrintShell } from "@/components/print-shell";

export const metadata: Metadata = {
  title: "Print",
  description: "Printable cheat sheet for a deck.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PrintPage({ params }: PageProps) {
  const { id } = await params;
  return <PrintShell deckId={id} />;
}
