import type { Metadata } from "next";
import { TodayShell } from "@/components/today-shell";

export const metadata: Metadata = {
  title: "Today",
  description: "Your daily review queue across every deck.",
};

export default function TodayPage() {
  return <TodayShell />;
}
