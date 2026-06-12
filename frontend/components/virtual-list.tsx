"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  overscan?: number;
  className?: string;
  maxHeight?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  getKey?: (item: T, index: number) => string;
}

// Single-column virtual scroller. For very long lists (>200 items) so we
// don't render every row at once. Same DOM regardless of list size.
export function VirtualList<T>({
  items,
  itemHeight,
  overscan = 6,
  className,
  maxHeight = 600,
  renderItem,
  getKey,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(maxHeight);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setViewport(el.clientHeight);
    const onResize = () => setViewport(el.clientHeight);
    if (typeof window !== "undefined") {
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
  }, []);

  const total = items.length;
  const totalHeight = total * itemHeight;
  const startIdx = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIdx = Math.min(total, Math.ceil((scrollTop + viewport) / itemHeight) + overscan);
  const offset = startIdx * itemHeight;

  const visible = useMemo(() => items.slice(startIdx, endIdx), [items, startIdx, endIdx]);

  // Falls back to a regular list for small inputs so a11y stays nice.
  if (total <= 50) {
    return (
      <div className={cn("space-y-0", className)}>
        {items.map((it, i) => (
          <div key={getKey ? getKey(it, i) : i}>{renderItem(it, i)}</div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-y-auto", className)}
      style={{ maxHeight }}
      onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${offset}px)` }}>
          {visible.map((it, i) => (
            <div key={getKey ? getKey(it, startIdx + i) : startIdx + i} style={{ height: itemHeight }}>
              {renderItem(it, startIdx + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
