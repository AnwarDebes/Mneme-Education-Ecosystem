"use client";
import { useRef, useState } from "react";
import { Eraser, Pen, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DrawingPadProps {
  width?: number;
  height?: number;
  initialSvg?: string;
  onSave?: (svg: string) => void;
  className?: string;
}

interface Stroke {
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

const PALETTE = ["#1e293b", "#dc2626", "#2563eb", "#059669", "#d97706", "#7c3aed"];

export function DrawingPad({
  width = 360,
  height = 220,
  onSave,
  className,
}: DrawingPadProps) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(PALETTE[0]);
  const [size, setSize] = useState(2.5);
  const drawingRef = useRef(false);
  const currentRef = useRef<Stroke | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const toPoint = (e: React.PointerEvent<SVGSVGElement>): { x: number; y: number } => {
    const rect = (e.target as Element).getBoundingClientRect();
    const svg = svgRef.current!;
    const sx = width / rect.width;
    const sy = height / rect.height;
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy,
    };
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    drawingRef.current = true;
    const p = toPoint(e);
    const stroke: Stroke = { color, width: size, points: [p] };
    currentRef.current = stroke;
    setStrokes((cur) => [...cur, stroke]);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawingRef.current || !currentRef.current) return;
    const p = toPoint(e);
    currentRef.current.points.push(p);
    setStrokes((cur) => cur.slice());
  };
  const onPointerUp = () => {
    drawingRef.current = false;
    currentRef.current = null;
  };

  const clear = () => setStrokes([]);

  const toSVG = (): string => {
    const paths = strokes
      .map((s) => {
        if (s.points.length === 0) return "";
        const d =
          "M " +
          s.points
            .map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
            .join(" L ");
        return `<path d="${d}" stroke="${s.color}" stroke-width="${s.width}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
      })
      .join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${paths}</svg>`;
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn(
                "h-6 w-6 rounded-full ring-2 transition-all",
                color === c ? "ring-primary" : "ring-transparent hover:ring-border",
              )}
              style={{ backgroundColor: c }}
              aria-label={`color ${c}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Pen className="h-3.5 w-3.5" />
          <input
            type="range"
            min="1"
            max="8"
            step="0.5"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-20"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={clear}>
          <Eraser className="h-3.5 w-3.5" /> Clear
        </Button>
        {onSave && (
          <Button size="sm" onClick={() => onSave(toSVG())} disabled={strokes.length === 0}>
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
        )}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full touch-none rounded-md border bg-card"
        style={{ aspectRatio: `${width} / ${height}` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {strokes.map((s, i) => {
          if (s.points.length === 0) return null;
          const d =
            "M " +
            s.points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ");
          return (
            <path
              key={i}
              d={d}
              stroke={s.color}
              strokeWidth={s.width}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </svg>
    </div>
  );
}

interface DrawingPreviewProps {
  svg: string;
  className?: string;
}

export function DrawingPreview({ svg, className }: DrawingPreviewProps) {
  if (!svg) return null;
  return (
    <div
      className={cn("w-full overflow-hidden rounded-md border bg-card", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
