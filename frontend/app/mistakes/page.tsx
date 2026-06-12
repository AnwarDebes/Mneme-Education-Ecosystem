import type { Metadata } from "next";
import { ErrorBookShell } from "@/components/error-book-shell";

export const metadata: Metadata = {
  title: "Error book",
  description: "Every card you've stumbled on, with AI-powered explanations.",
};

export default function MistakesPage() {
  return <ErrorBookShell />;
}
