"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Palette, RotateCcw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { saveCustomCss } from "@/lib/custom-css";
import { toast } from "sonner";

// Builds a CSS override block from a few sliders. Writes to the same
// custom-css store; clearing the custom CSS undoes everything.
export function ThemeDesigner() {
  const [open, setOpen] = useState(false);
  const [primaryH, setPrimaryH] = useState(250);
  const [primaryS, setPrimaryS] = useState(65);
  const [primaryL, setPrimaryL] = useState(50);
  const [accentH, setAccentH] = useState(30);
  const [accentS, setAccentS] = useState(88);
  const [accentL, setAccentL] = useState(60);
  const [radius, setRadius] = useState(0.7);

  const css = `:root {
  --primary: ${primaryH} ${primaryS}% ${primaryL}%;
  --ring: ${primaryH} ${primaryS}% ${primaryL}%;
  --accent: ${accentH} ${accentS}% ${accentL}%;
  --radius: ${radius}rem;
}
.dark {
  --primary: ${primaryH} ${primaryS}% ${Math.min(85, primaryL + 20)}%;
  --ring: ${primaryH} ${primaryS}% ${Math.min(85, primaryL + 20)}%;
  --accent: ${accentH} ${accentS}% ${Math.min(85, accentL + 5)}%;
}
`;

  const apply = () => {
    saveCustomCss(css);
    toast.success("Theme applied");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Palette className="h-4 w-4" /> Design theme
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" /> Theme designer
          </DialogTitle>
          <DialogDescription>
            Build your own color theme with HSL sliders and a live preview.
            Saves into the Custom CSS slot - clear it in Settings to undo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="space-y-3">
            <Group
              label="Primary"
              h={primaryH}
              s={primaryS}
              l={primaryL}
              setH={setPrimaryH}
              setS={setPrimaryS}
              setL={setPrimaryL}
            />
            <Group
              label="Accent"
              h={accentH}
              s={accentS}
              l={accentL}
              setH={setAccentH}
              setS={setAccentS}
              setL={setAccentL}
            />
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Corner radius</Label>
                <span className="font-mono text-xs">{radius.toFixed(2)}rem</span>
              </div>
              <Slider value={[radius]} min={0} max={1.5} step={0.05} onValueChange={(v) => setRadius(v[0])} />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Live preview</p>
            <motion.div
              className="space-y-2 rounded-lg border p-3"
              style={{
                background: `hsl(${primaryH} ${primaryS}% 98%)`,
                color: "#111",
              }}
              animate={{}}
            >
              <button
                className="w-full rounded-md px-3 py-2 text-sm font-medium text-white"
                style={{ background: `hsl(${primaryH} ${primaryS}% ${primaryL}%)`, borderRadius: `${radius}rem` }}
              >
                Primary button
              </button>
              <button
                className="w-full rounded-md px-3 py-2 text-sm font-medium"
                style={{
                  background: `hsl(${accentH} ${accentS}% ${accentL}%)`,
                  color: "#111",
                  borderRadius: `${radius}rem`,
                }}
              >
                Accent button
              </button>
              <Badge variant="outline" style={{ borderRadius: `${radius * 2}rem` }}>
                badge
              </Badge>
            </motion.div>
            <pre className="overflow-x-auto rounded-md bg-muted px-2 py-1 text-[9px]">
{css}
            </pre>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setPrimaryH(250); setPrimaryS(65); setPrimaryL(50);
              setAccentH(30); setAccentS(88); setAccentL(60);
              setRadius(0.7);
            }}
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
          <Button onClick={apply}>
            <Save className="h-4 w-4" /> Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Group({
  label,
  h,
  s,
  l,
  setH,
  setS,
  setL,
}: {
  label: string;
  h: number;
  s: number;
  l: number;
  setH: (n: number) => void;
  setS: (n: number) => void;
  setL: (n: number) => void;
}) {
  return (
    <div className="space-y-2 rounded-md border bg-secondary/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{label}</p>
        <div
          className="h-5 w-12 rounded"
          style={{ background: `hsl(${h} ${s}% ${l}%)` }}
        />
      </div>
      <Row label={`Hue ${h}`} value={h} min={0} max={360} step={1} onChange={setH} />
      <Row label={`Sat ${s}%`} value={s} min={0} max={100} step={1} onChange={setS} />
      <Row label={`Light ${l}%`} value={l} min={0} max={100} step={1} onChange={setL} />
    </div>
  );
}

function Row({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}
