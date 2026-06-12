import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchShell } from "@/components/search-shell";

export const metadata: Metadata = {
  title: "Search",
  description: "Cross-deck search across questions, answers, tags, and notes.",
};

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchShell />
    </Suspense>
  );
}
