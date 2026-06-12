import type { Metadata } from "next";
import { DemoShell } from "@/components/demo-shell";

export const metadata: Metadata = {
  title: "Showcase",
  description: "Every feature mneme ships, on one page.",
};

export default function ShowcasePage() {
  return <DemoShell />;
}
