// Tiny zero-dependency markdown -> safe HTML.
// Supports: # / ## / ### headings, bold, italic, code spans, code fences,
// unordered and ordered lists, blockquotes, links. Anything fancier
// falls through as escaped plain text.
//
// We deliberately do NOT support raw HTML. Sources/notes come from the
// user, and dangerouslySetInnerHTML on hostile input is a bad idea even
// for a local-only app.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(text: string): string {
  let out = escapeHtml(text);
  // Code spans first to avoid clashing with stars
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, (_, c) => `<strong>${c}</strong>`);
  out = out.replace(/__([^_]+)__/g, (_, c) => `<strong>${c}</strong>`);
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, (_, pre, c) => `${pre}<em>${c}</em>`);
  out = out.replace(/(^|[^_])_([^_]+)_/g, (_, pre, c) => `${pre}<em>${c}</em>`);
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, label, url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer" class="underline">${label}</a>`,
  );
  return out;
}

export function renderMarkdown(md: string): string {
  if (!md) return "";
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  let inUL = false;
  let inOL = false;
  let inBQ = false;

  const closeLists = () => {
    if (inUL) {
      out.push("</ul>");
      inUL = false;
    }
    if (inOL) {
      out.push("</ol>");
      inOL = false;
    }
  };
  const closeBQ = () => {
    if (inBQ) {
      out.push("</blockquote>");
      inBQ = false;
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    // Code fence
    if (/^```/.test(line)) {
      closeLists();
      closeBQ();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(escapeHtml(lines[i]));
        i++;
      }
      out.push(`<pre class="rounded-md bg-muted px-3 py-2 text-xs overflow-x-auto"><code>${buf.join("\n")}</code></pre>`);
      i++;
      continue;
    }
    // Headings
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      closeLists();
      closeBQ();
      const level = h[1].length;
      const tag = `h${Math.min(6, level)}`;
      out.push(`<${tag} class="font-display font-semibold mt-3 mb-1">${inline(h[2])}</${tag}>`);
      i++;
      continue;
    }
    // Blockquote
    if (/^>\s?/.test(line)) {
      closeLists();
      if (!inBQ) {
        out.push('<blockquote class="border-l-2 border-primary/40 pl-3 italic text-muted-foreground">');
        inBQ = true;
      }
      out.push(`<p>${inline(line.replace(/^>\s?/, ""))}</p>`);
      i++;
      continue;
    } else {
      closeBQ();
    }
    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      if (inOL) {
        out.push("</ol>");
        inOL = false;
      }
      if (!inUL) {
        out.push('<ul class="list-disc pl-5 space-y-0.5">');
        inUL = true;
      }
      out.push(`<li>${inline(line.replace(/^\s*[-*+]\s+/, ""))}</li>`);
      i++;
      continue;
    }
    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      if (inUL) {
        out.push("</ul>");
        inUL = false;
      }
      if (!inOL) {
        out.push('<ol class="list-decimal pl-5 space-y-0.5">');
        inOL = true;
      }
      out.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ""))}</li>`);
      i++;
      continue;
    }
    closeLists();
    // Blank line = paragraph break
    if (line.trim() === "") {
      i++;
      continue;
    }
    out.push(`<p class="leading-relaxed">${inline(line)}</p>`);
    i++;
  }
  closeLists();
  closeBQ();
  return out.join("\n");
}
