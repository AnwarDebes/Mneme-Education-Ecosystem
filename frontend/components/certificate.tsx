"use client";
import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Award, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CertificateProps {
  deckName: string;
  scorePct: number;
  totalQuestions: number;
  duration: string;
  date?: Date;
}

export function Certificate({
  deckName,
  scorePct,
  totalQuestions,
  duration,
  date = new Date(),
}: CertificateProps) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [pending, setPending] = useState(false);
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const svgString = useMemo(() => buildSvg({ deckName, scorePct, totalQuestions, duration, dateStr }), [
    deckName,
    scorePct,
    totalQuestions,
    duration,
    dateStr,
  ]);

  const downloadSvg = () => {
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mneme-certificate-${deckName.replace(/\W+/g, "-").toLowerCase()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPng = async () => {
    setPending(true);
    try {
      const img = new Image();
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("svg image load failed"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 800;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const pngUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `mneme-certificate-${deckName.replace(/\W+/g, "-").toLowerCase()}.png`;
        a.click();
        URL.revokeObjectURL(pngUrl);
      });
    } catch {
      /* fallback to svg */
      downloadSvg();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-3">
      <motion.div
        initial={{ opacity: 0, rotateX: -20 }}
        animate={{ opacity: 1, rotateX: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="overflow-hidden rounded-lg border shadow-lg"
      >
        <svg
          ref={ref}
          viewBox="0 0 1200 800"
          className="w-full"
          dangerouslySetInnerHTML={{ __html: svgString.match(/<svg[^>]*>([\s\S]*)<\/svg>/i)?.[1] ?? "" }}
        />
      </motion.div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={downloadSvg}>
          <Download className="h-3.5 w-3.5" /> Download SVG
        </Button>
        <Button size="sm" onClick={downloadPng} disabled={pending}>
          <Share2 className="h-3.5 w-3.5" /> Download PNG
        </Button>
      </div>
    </div>
  );
}

function buildSvg(opts: {
  deckName: string;
  scorePct: number;
  totalQuestions: number;
  duration: string;
  dateStr: string;
}): string {
  const tier =
    opts.scorePct >= 90
      ? { label: "Outstanding", color: "#7c3aed" }
      : opts.scorePct >= 75
      ? { label: "Strong", color: "#f59e0b" }
      : opts.scorePct >= 60
      ? { label: "Solid", color: "#10b981" }
      : { label: "Working on it", color: "#64748b" };

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fafaf7"/>
        <stop offset="100%" stop-color="#f3f0e8"/>
      </linearGradient>
      <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${tier.color}"/>
        <stop offset="100%" stop-color="#f59e0b"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="800" fill="url(#bg)"/>
    <rect x="40" y="40" width="1120" height="720" fill="none" stroke="${tier.color}" stroke-width="3" rx="20"/>
    <rect x="60" y="60" width="1080" height="680" fill="none" stroke="${tier.color}" stroke-opacity="0.3" stroke-width="1" rx="14"/>
    <text x="600" y="160" text-anchor="middle" font-family="Georgia, serif" font-size="32" fill="#475569">mneme</text>
    <text x="600" y="240" text-anchor="middle" font-family="Georgia, serif" font-size="56" font-weight="600" fill="#1e293b">Certificate of mastery</text>
    <text x="600" y="300" text-anchor="middle" font-family="Inter, sans-serif" font-size="20" fill="#64748b">awarded for performance on</text>
    <text x="600" y="370" text-anchor="middle" font-family="Georgia, serif" font-size="44" font-style="italic" fill="${tier.color}">${esc(opts.deckName)}</text>
    <line x1="200" y1="440" x2="1000" y2="440" stroke="${tier.color}" stroke-width="2"/>
    <text x="600" y="510" text-anchor="middle" font-family="Inter, sans-serif" font-size="64" font-weight="700" fill="url(#accent)">${opts.scorePct}%</text>
    <text x="600" y="555" text-anchor="middle" font-family="Inter, sans-serif" font-size="22" fill="#64748b">on ${opts.totalQuestions} questions, in ${esc(opts.duration)}</text>
    <text x="600" y="640" text-anchor="middle" font-family="Inter, sans-serif" font-size="28" font-weight="600" fill="${tier.color}">${tier.label}</text>
    <text x="600" y="700" text-anchor="middle" font-family="Inter, sans-serif" font-size="16" fill="#94a3b8">${esc(opts.dateStr)}</text>
    <text x="600" y="730" text-anchor="middle" font-family="Inter, sans-serif" font-size="11" fill="#94a3b8">generated locally - no data left this device</text>
  </svg>`;
}
