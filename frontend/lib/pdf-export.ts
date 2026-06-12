// Build a printable PDF-friendly HTML document from a deck. Browsers can
// "Print to PDF" the page; this gives them an isolated, clean template.

import type { ResolvedCard } from "./cards";

export interface PdfOptions {
  deckName: string;
  cards: ResolvedCard[];
  layout: "two-up" | "list";
  hideAnswers: boolean;
  generatedAt?: Date;
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildPdfHtml(opts: PdfOptions): string {
  const dateStr = (opts.generatedAt ?? new Date()).toLocaleDateString();
  const cardsHtml =
    opts.layout === "two-up"
      ? opts.cards
          .map(
            (c, i) => `
        <div class="card">
          <div class="head"><span class="num">${i + 1}</span><span class="diff">${
            c.effective_difficulty ?? "unrated"
          }</span></div>
          <p class="q">${escape(c.question)}</p>
          ${opts.hideAnswers ? '<div class="blank"></div>' : `<p class="a">${escape(c.answer)}</p>`}
        </div>`,
          )
          .join("")
      : opts.cards
          .map(
            (c, i) => `
        <div class="row">
          <span class="n">${i + 1}.</span>
          <div class="content">
            <p class="q">${escape(c.question)}</p>
            ${opts.hideAnswers ? "" : `<p class="a">${escape(c.answer)}</p>`}
          </div>
        </div>`,
          )
          .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escape(opts.deckName)} - mneme</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Inter, system-ui, sans-serif; color: #1e293b; }
    header { border-bottom: 2px solid #7c3aed; padding-bottom: 8px; margin-bottom: 16px; }
    h1 { font-size: 22pt; margin: 0; }
    .meta { color: #64748b; font-size: 10pt; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; break-inside: avoid; }
    .head { display: flex; justify-content: space-between; font-size: 9pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .q { font-weight: 600; margin: 6px 0 4px; }
    .a { color: #475569; font-size: 11pt; margin: 6px 0 0; }
    .blank { height: 60px; border: 1px dashed #cbd5e1; border-radius: 4px; margin-top: 6px; }
    .row { display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px solid #e2e8f0; break-inside: avoid; }
    .n { color: #94a3b8; font-family: ui-monospace, monospace; font-size: 10pt; min-width: 28px; }
    footer { margin-top: 16px; color: #94a3b8; font-size: 9pt; text-align: center; }
  </style>
</head>
<body>
  <header>
    <h1>${escape(opts.deckName)}</h1>
    <p class="meta">${opts.cards.length} cards - generated ${escape(dateStr)} - via mneme (local)</p>
  </header>
  <main class="${opts.layout === "two-up" ? "two" : "list"}">${cardsHtml}</main>
  <footer>mneme - your data never left this device.</footer>
</body>
</html>`;
}

export function openPdfPreview(html: string): void {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 300);
}
