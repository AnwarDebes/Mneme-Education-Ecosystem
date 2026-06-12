"use client";
import { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Shortcut {
  keys: string[];
  label: string;
  context: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ["?"], label: "Show this overlay", context: "Anywhere" },
  { keys: ["Cmd/Ctrl+K"], label: "Command palette", context: "Anywhere" },
  { keys: ["/"], label: "Focus the page's main search box", context: "Anywhere" },
  { keys: ["Esc"], label: "Close overlay / exit focus mode", context: "Anywhere" },

  { keys: ["Space", "Enter"], label: "Flip the card", context: "Flip mode" },
  { keys: ["1", "2", "3", "4"], label: "Grade Again / Hard / Good / Easy", context: "Flip mode" },
  { keys: ["F"], label: "Favorite the current card", context: "Flip mode" },
  { keys: ["E"], label: "Edit the current card", context: "Flip mode" },
  { keys: ["S"], label: "Skip the card without grading", context: "Flip mode" },
  { keys: ["Arrow keys"], label: "Previous / next card", context: "Flip mode" },

  { keys: ["P"], label: "Pause / resume", context: "Speed mode" },
  { keys: ["Y", "N"], label: "Got it / missed", context: "Speed mode" },
];

// Trigger that lives invisibly on every page. Listens for "?" globally
// (outside form fields), opens an overlay listing every shortcut so the
// user doesn't have to memorize them.
export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLElement && e.target.isContentEditable) return;
      // ? key. On most layouts Shift+/ produces "?" - check the resulting key.
      if (e.key === "?") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "/") {
        // Focus the first visible input that looks like a search box.
        const input = document.querySelector<HTMLInputElement>(
          'input[placeholder*="earch"], input[type="search"]',
        );
        if (input) {
          e.preventDefault();
          input.focus();
          input.select();
        }
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Group by context.
  const groups = SHORTCUTS.reduce<Record<string, Shortcut[]>>((acc, s) => {
    (acc[s.context] ??= []).push(s);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" /> Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Press <kbd className="rounded border bg-card px-1.5">?</kbd> any time to open this list.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {Object.entries(groups).map(([ctx, list]) => (
            <section key={ctx} className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{ctx}</p>
              <ul className="space-y-1">
                {list.map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="flex gap-1">
                      {s.keys.map((k) => (
                        <kbd
                          key={k}
                          className="rounded border bg-card px-1.5 py-0.5 font-mono text-[10px]"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
