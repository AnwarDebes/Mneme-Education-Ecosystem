"use client";
import { cn } from "@/lib/utils";

interface ConfidenceRatingProps {
  value: 1 | 2 | 3 | 4 | 5 | null;
  onChange: (n: 1 | 2 | 3 | 4 | 5) => void;
  className?: string;
}

// 5-button pre-answer prediction. Persisted by the caller via logConfidence.
const RATING_LABELS = {
  1: "Very unsure",
  2: "Unsure",
  3: "Neutral",
  4: "Confident",
  5: "Very confident",
} as const;

export function ConfidenceRating({ value, onChange, className }: ConfidenceRatingProps) {
  return (
    <div
      role="radiogroup"
      aria-label="How confident are you before flipping?"
      className={cn(
        "flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <span id="confidence-label">Confidence:</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${RATING_LABELS[n as 1 | 2 | 3 | 4 | 5]} (${n} of 5)`}
          onClick={() => onChange(n as 1 | 2 | 3 | 4 | 5)}
          className={cn(
            "h-7 w-7 rounded-full border text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            value === n
              ? "border-primary bg-primary/10 text-primary"
              : "text-muted-foreground hover:border-primary/40",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
