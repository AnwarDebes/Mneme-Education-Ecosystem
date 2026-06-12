import type { Metadata } from "next";
import { InsightsShell } from "@/components/insights-shell";

export const metadata: Metadata = {
  title: "Insights",
  description: "Your weekly report card: accuracy by tag, hardest cards, due-card forecast.",
};

export default function InsightsPage() {
  return <InsightsShell />;
}
