import type { Metadata } from "next";
import { HelpShell } from "@/components/help-shell";

export const metadata: Metadata = {
  title: "Help",
  description: "Short answers about how mneme works.",
};

export default function HelpPage() {
  return <HelpShell />;
}
