import type { Metadata } from "next";
import { Suspense } from "react";
import { ImportLanding } from "@/components/import-landing";

export const metadata: Metadata = {
  title: "Import",
  description: "Import a deck from a shared mneme URL, .apkg, CSV, JSON, or load a sample.",
};

export default function ImportPage() {
  return (
    <Suspense fallback={null}>
      <ImportLanding />
    </Suspense>
  );
}
