import { Suspense } from "react";
import type { Metadata } from "next";
import { StudyShell } from "@/components/study-shell";

export const metadata: Metadata = {
  title: "Study",
  description: "Flip-card review in your browser. Keyboard shortcuts: space to flip, arrows to navigate, 1-4 to grade.",
};

export default function StudyPage() {
  return (
    <Suspense fallback={null}>
      <StudyShell />
    </Suspense>
  );
}
