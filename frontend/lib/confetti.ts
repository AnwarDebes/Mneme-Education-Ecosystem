// Tiny zero-dependency confetti effect. Renders ~80 colored circles that
// fall under gravity with random horizontal drift. Self-removes after ~2s.
// Designed so it can be fire-and-forgotten from any callback.

const COLORS = ["#7c3aed", "#f59e0b", "#10b981", "#ef4444", "#06b6d4", "#ec4899"];

export function fireConfetti(options?: { particles?: number; durationMs?: number }) {
  if (typeof window === "undefined") return;
  const root = document.body;
  const layer = document.createElement("div");
  layer.style.position = "fixed";
  layer.style.inset = "0";
  layer.style.pointerEvents = "none";
  layer.style.zIndex = "9999";
  layer.style.overflow = "hidden";
  root.appendChild(layer);

  const N = options?.particles ?? 80;
  const duration = options?.durationMs ?? 2200;
  const w = window.innerWidth;
  const h = window.innerHeight;

  for (let i = 0; i < N; i++) {
    const piece = document.createElement("span");
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const size = 6 + Math.random() * 8;
    const startX = w * 0.5 + (Math.random() - 0.5) * w * 0.6;
    const endX = startX + (Math.random() - 0.5) * 400;
    const endY = h + 80;
    const rot = Math.random() * 720 - 360;
    piece.style.position = "absolute";
    piece.style.left = `${startX}px`;
    piece.style.top = `-20px`;
    piece.style.width = `${size}px`;
    piece.style.height = `${size * 0.6}px`;
    piece.style.background = color;
    piece.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    piece.style.opacity = "0.95";
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    piece.style.transition = `transform ${duration}ms cubic-bezier(0.3, 0.2, 0.3, 1), top ${duration}ms cubic-bezier(0.3, 0.2, 0.3, 1), left ${duration}ms ease-out, opacity ${duration}ms linear`;
    layer.appendChild(piece);
    requestAnimationFrame(() => {
      piece.style.top = `${endY}px`;
      piece.style.left = `${endX}px`;
      piece.style.transform = `rotate(${rot}deg)`;
      piece.style.opacity = "0";
    });
  }

  setTimeout(() => {
    layer.remove();
  }, duration + 200);
}
