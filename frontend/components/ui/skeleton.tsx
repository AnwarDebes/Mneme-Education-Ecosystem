import { cn } from "@/lib/utils";

// Minimal pulse skeleton. Use to occupy the shape a piece of content will
// take so the layout doesn't pop when data resolves. Color tokens follow
// the existing muted scheme so it works in both light and dark themes.
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("animate-pulse rounded-md bg-muted/60", className)}
      {...props}
    />
  );
}

export function SkeletonCardGrid({ rows = 6 }: { rows?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border bg-card p-5">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <div className="grid grid-cols-3 gap-2 pt-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        </div>
      ))}
    </div>
  );
}
