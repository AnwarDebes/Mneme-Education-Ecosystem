"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichText } from "@/components/rich-text";
import { Calculator, Copy } from "lucide-react";
import { toast } from "sonner";

interface MathBuilderProps {
  onInsert?: (latex: string) => void;
}

const TOKENS = [
  { token: "\\frac{a}{b}", label: "fraction" },
  { token: "\\sqrt{x}", label: "sqrt" },
  { token: "x^2", label: "x^2" },
  { token: "x_n", label: "x_n" },
  { token: "\\alpha", label: "α" },
  { token: "\\beta", label: "β" },
  { token: "\\gamma", label: "γ" },
  { token: "\\delta", label: "δ" },
  { token: "\\pi", label: "π" },
  { token: "\\Sigma", label: "Σ" },
  { token: "\\int", label: "∫" },
  { token: "\\sum", label: "∑" },
  { token: "\\infty", label: "∞" },
  { token: "\\leq", label: "≤" },
  { token: "\\geq", label: "≥" },
  { token: "\\neq", label: "≠" },
  { token: "\\approx", label: "≈" },
  { token: "\\cdot", label: "·" },
  { token: "\\times", label: "×" },
  { token: "\\div", label: "÷" },
  { token: "\\to", label: "→" },
  { token: "\\Rightarrow", label: "⇒" },
];

export function MathBuilder({ onInsert }: MathBuilderProps) {
  const [latex, setLatex] = useState("");

  const insert = (token: string) => {
    setLatex((cur) => cur + (cur && !cur.endsWith(" ") ? " " : "") + token);
  };

  const copy = async () => {
    if (!latex.trim()) return;
    try {
      await navigator.clipboard.writeText(`$${latex}$`);
      toast.success("Copied LaTeX to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div className="space-y-3 rounded-md border bg-secondary/30 p-3">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Equation builder</p>
      </div>
      <div className="flex flex-wrap gap-1">
        {TOKENS.map((t) => (
          <button
            key={t.token}
            onClick={() => insert(t.token)}
            className="rounded border bg-card px-2 py-0.5 font-serif text-xs hover:border-primary/40"
            title={t.token}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        <Label htmlFor="math-input">LaTeX</Label>
        <Input
          id="math-input"
          value={latex}
          onChange={(e) => setLatex(e.target.value)}
          placeholder="x^2 + y^2 = r^2"
          className="font-mono text-sm"
        />
      </div>
      <div className="rounded-md bg-card p-3 text-center font-serif text-lg">
        <RichText text={`$${latex || "?"}$`} as="div" />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={copy} disabled={!latex.trim()}>
          <Copy className="h-3.5 w-3.5" /> Copy as $LaTeX$
        </Button>
        {onInsert && (
          <Button size="sm" onClick={() => onInsert(`$${latex}$`)} disabled={!latex.trim()}>
            Insert
          </Button>
        )}
      </div>
    </div>
  );
}
