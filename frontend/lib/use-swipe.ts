"use client";
import { useEffect, useRef } from "react";

export interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  minDistance?: number;
}

// Touch-driven 4-way swipe detector. Pure JS, no deps. Attach to a ref
// container; callbacks fire once per gesture when the threshold is met.
export function useSwipe<T extends HTMLElement = HTMLElement>(
  ref: React.RefObject<T | null>,
  handlers: SwipeHandlers,
): void {
  const startX = useRef(0);
  const startY = useRef(0);
  const startT = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const min = handlers.minDistance ?? 60;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      startX.current = t.clientX;
      startY.current = t.clientY;
      startT.current = Date.now();
    };
    const onEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;
      const dt = Date.now() - startT.current;
      if (dt > 800) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > min) handlers.onSwipeRight?.();
        else if (dx < -min) handlers.onSwipeLeft?.();
      } else {
        if (dy > min) handlers.onSwipeDown?.();
        else if (dy < -min) handlers.onSwipeUp?.();
      }
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, handlers.onSwipeLeft, handlers.onSwipeRight, handlers.onSwipeUp, handlers.onSwipeDown]);
}
