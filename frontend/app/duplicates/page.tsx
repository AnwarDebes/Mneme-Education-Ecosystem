import type { Metadata } from "next";
import { DuplicatesShell } from "@/components/duplicates-shell";

export const metadata: Metadata = {
  title: "Duplicates",
  description: "Find near-duplicate cards across all your decks.",
};

export default function DuplicatesPage() {
  return <DuplicatesShell />;
}
