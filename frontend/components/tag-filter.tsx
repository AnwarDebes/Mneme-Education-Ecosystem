"use client";
import { Hash, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TagFilterProps {
  tags: string[];
  active: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}

export function TagFilter({ tags, active, onToggle, onClear }: TagFilterProps) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
      {tags.map((t) => {
        const isActive = active.includes(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => onToggle(t)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
              isActive
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        );
      })}
      {active.length > 0 && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-6 gap-1 px-2 text-xs">
          <X className="h-3 w-3" /> clear
        </Button>
      )}
      {active.length === 0 && tags.length > 6 && (
        <Badge variant="outline" className="text-[10px]">
          {tags.length} tags
        </Badge>
      )}
    </div>
  );
}
