import type { Metadata } from "next";
import { GeneratorShell } from "@/components/generator-shell";

export const metadata: Metadata = {
  title: "Generate",
  description: "Drop a file in, watch the pipeline run, export an Anki deck.",
};

export default function GeneratorPage() {
  return <GeneratorShell />;
}
