import type { Metadata } from "next";
import { BulkEditShell } from "@/components/bulk-edit-shell";

export const metadata: Metadata = {
  title: "Edit deck",
  description: "Spreadsheet-style bulk editing for a deck.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BulkEditPage({ params }: PageProps) {
  const { id } = await params;
  return <BulkEditShell deckId={id} />;
}
