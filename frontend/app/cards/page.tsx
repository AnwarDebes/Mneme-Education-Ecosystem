import type { Metadata } from "next";
import { GlobalCardsShell } from "@/components/global-cards-shell";

export const metadata: Metadata = {
  title: "All cards",
  description: "Every card across every deck in one view.",
};

export default function GlobalCardsPage() {
  return <GlobalCardsShell />;
}
