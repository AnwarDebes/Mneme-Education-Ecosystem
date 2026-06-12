"use client";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  size?: "sm" | "md";
  readOnly?: boolean;
  className?: string;
}

export function StarRating({ value, onChange, size = "sm", readOnly = false, className }: StarRatingProps) {
  const sz = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={readOnly}
          onClick={(e) => {
            e.stopPropagation();
            if (readOnly || !onChange) return;
            onChange(value === i ? 0 : i);
          }}
          className={cn(
            "transition-colors",
            readOnly ? "cursor-default" : "cursor-pointer hover:scale-110",
          )}
          aria-label={`${i} stars`}
        >
          <Star
            className={cn(
              sz,
              i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
            )}
          />
        </button>
      ))}
    </div>
  );
}
