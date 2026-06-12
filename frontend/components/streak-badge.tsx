"use client";
import { Flame } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StreakBadgeProps {
  streak: number;
  longest: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function StreakBadge({ streak, longest, className, size = "md" }: StreakBadgeProps) {
  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-2 text-base",
  } as const;
  const iconSizes = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-5 w-5" } as const;
  const flame = streak > 0 ? "text-orange-500" : "text-muted-foreground";
  return (
    <motion.span
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-card font-medium",
        sizes[size],
        className,
      )}
      title={`Longest streak: ${longest} days`}
    >
      <Flame className={cn(iconSizes[size], flame)} />
      <span>{streak}-day streak</span>
    </motion.span>
  );
}
