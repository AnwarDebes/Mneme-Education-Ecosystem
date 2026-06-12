import type { Metadata } from "next";
import { ReviewFeedShell } from "@/components/review-feed-shell";

export const metadata: Metadata = {
  title: "Review feed",
  description: "Chronological history of every card you've graded across every deck.",
};

export default function FeedPage() {
  return <ReviewFeedShell />;
}
