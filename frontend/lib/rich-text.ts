// Render flashcard text as a mix of:
//   - inline math: $x^2 + 1$  (formatted with sub/sup HTML)
//   - block math: $$ \int ... $$  (centered, in a code-like box)
//   - inline code: `foo`
//   - fenced code: ```python ... ```
//
// We deliberately avoid shipping KaTeX (50+ KB) and use a tiny formatter that
// supports the formulas you actually see in study materials: powers,
// subscripts, fractions (\frac), Greek letters, sqrt, common operators. For
// anything heavier the source is preserved verbatim.

const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", zeta: "ζ",
  eta: "η", theta: "θ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν",
  xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ", phi: "φ",
  chi: "χ", psi: "ψ", omega: "ω",
  Alpha: "Α", Beta: "Β", Gamma: "Γ", Delta: "Δ", Epsilon: "Ε", Zeta: "Ζ",
  Eta: "Η", Theta: "Θ", Iota: "Ι", Kappa: "Κ", Lambda: "Λ", Mu: "Μ", Nu: "Ν",
  Xi: "Ξ", Pi: "Π", Rho: "Ρ", Sigma: "Σ", Tau: "Τ", Upsilon: "Υ", Phi: "Φ",
  Chi: "Χ", Psi: "Ψ", Omega: "Ω",
};

const OPS: Record<string, string> = {
  times: "×", div: "÷", pm: "±", mp: "∓",
  leq: "≤", geq: "≥", neq: "≠", approx: "≈", equiv: "≡",
  cdot: "·", to: "→", rightarrow: "→", leftarrow: "←",
  Rightarrow: "⇒", Leftarrow: "⇐",
  infty: "∞", sum: "∑", prod: "∏", int: "∫",
  partial: "∂", nabla: "∇", in: "∈", notin: "∉", subset: "⊂", supset: "⊃",
  cup: "∪", cap: "∩", forall: "∀", exists: "∃",
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderMath(src: string): string {
  let out = escapeHtml(src);
  // \frac{a}{b}
  out = out.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_m, a, b) =>
    `<span class="inline-flex flex-col items-center align-middle leading-none mx-0.5">
       <span class="text-[0.9em]">${a}</span>
       <span class="border-t border-current w-full text-[0.9em]">${b}</span>
     </span>`);
  // \sqrt{x}
  out = out.replace(/\\sqrt\{([^{}]+)\}/g, (_m, a) =>
    `<span class="inline-flex items-center align-middle">√<span class="border-t border-current">${a}</span></span>`);
  // Greek and ops: \name
  out = out.replace(/\\([a-zA-Z]+)/g, (_m, name) => {
    if (GREEK[name]) return GREEK[name];
    if (OPS[name]) return OPS[name];
    return _m;
  });
  // Superscripts: x^2 or x^{12}
  out = out.replace(/\^(\{[^{}]+\}|[A-Za-z0-9+\-])/g, (_m, body) => {
    const inner = body.startsWith("{") ? body.slice(1, -1) : body;
    return `<sup>${inner}</sup>`;
  });
  // Subscripts: x_2 or x_{12}
  out = out.replace(/_(\{[^{}]+\}|[A-Za-z0-9+\-])/g, (_m, body) => {
    const inner = body.startsWith("{") ? body.slice(1, -1) : body;
    return `<sub>${inner}</sub>`;
  });
  return out;
}

function renderCode(lang: string, body: string): string {
  const escaped = escapeHtml(body);
  // Very small syntax highlight: highlight keywords + strings + numbers
  const keywords =
    /(\b)(def|class|return|import|from|if|elif|else|for|while|in|try|except|with|as|lambda|None|True|False|let|const|var|function|interface|type|export|import|from|null|undefined|public|private|static|new|this|enum|fn|use|pub|impl)(\b)/g;
  const numbers = /\b(\d+\.?\d*)\b/g;
  const strings = /(&quot;[^&]*?&quot;|'[^']*?')/g;
  let h = escaped
    .replace(strings, '<span class="text-emerald-600 dark:text-emerald-400">$1</span>')
    .replace(numbers, '<span class="text-violet-600 dark:text-violet-400">$1</span>')
    .replace(keywords, '$1<span class="text-rose-600 dark:text-rose-400">$2</span>$3');
  return `<pre class="my-2 overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs ring-1 ring-border"><code class="font-mono">${
    lang ? `<span class="text-[10px] uppercase text-muted-foreground">${lang}</span>\n` : ""
  }${h}</code></pre>`;
}

export function renderRich(text: string): string {
  if (!text) return "";
  const parts: string[] = [];
  let i = 0;
  // Walk the string and dispatch into math / code / plain regions.
  while (i < text.length) {
    // Fenced code: ```lang\n...\n```
    if (text.slice(i, i + 3) === "```") {
      const end = text.indexOf("```", i + 3);
      if (end > 0) {
        const block = text.slice(i + 3, end);
        const newline = block.indexOf("\n");
        const lang = newline >= 0 ? block.slice(0, newline).trim() : "";
        const body = newline >= 0 ? block.slice(newline + 1) : block;
        parts.push(renderCode(lang, body));
        i = end + 3;
        continue;
      }
    }
    // Block math: $$ ... $$
    if (text.slice(i, i + 2) === "$$") {
      const end = text.indexOf("$$", i + 2);
      if (end > 0) {
        const body = text.slice(i + 2, end);
        parts.push(`<div class="my-2 rounded-md bg-muted px-3 py-2 text-center font-serif">${renderMath(body)}</div>`);
        i = end + 2;
        continue;
      }
    }
    // Inline math: $...$
    if (text[i] === "$") {
      const end = text.indexOf("$", i + 1);
      if (end > 0 && end - i < 200) {
        const body = text.slice(i + 1, end);
        parts.push(`<span class="font-serif">${renderMath(body)}</span>`);
        i = end + 1;
        continue;
      }
    }
    // Inline code: `...`
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > 0) {
        const body = text.slice(i + 1, end);
        parts.push(`<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.92em]">${escapeHtml(body)}</code>`);
        i = end + 1;
        continue;
      }
    }
    // Plain run: walk until the next special char
    let j = i;
    while (j < text.length && text[j] !== "$" && text[j] !== "`" && text.slice(j, j + 3) !== "```") {
      j++;
    }
    parts.push(escapeHtml(text.slice(i, j)));
    i = j;
  }
  return parts.join("");
}

export function looksLikeRich(text: string): boolean {
  return /\$|`|\\frac|\\sqrt|```/.test(text);
}
