import type { Metadata } from "next";
import { CourseShell } from "@/components/course-shell";

export const metadata: Metadata = {
  title: "Course",
  description: "Treat a collection as an ordered curriculum.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CoursePage({ params }: PageProps) {
  const { id } = await params;
  return <CourseShell collectionId={id} />;
}
