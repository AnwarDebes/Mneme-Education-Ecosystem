import type { Metadata } from "next";
import { LibraryShell } from "@/components/library-shell";

export const metadata: Metadata = {
  title: "Library",
  description: "All your decks, study stats, and achievements in one place.",
};

export default function LibraryPage() {
  return <LibraryShell />;
}
