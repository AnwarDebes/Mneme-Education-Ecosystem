import type { Metadata } from "next";
import { LearnShell } from "@/components/learn-shell";

export const metadata: Metadata = {
  title: "Learn",
  description: "Short interactive lessons on the memory science behind every study mode.",
};

export default function LearnPage() {
  return <LearnShell />;
}
