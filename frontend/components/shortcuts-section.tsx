"use client";
import { useEffect, useState } from "react";
import { Keyboard, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStorageVersion } from "@/lib/hooks";
import {
  comboFromEvent,
  loadShortcuts,
  resetShortcuts,
  setShortcut,
  SHORTCUT_ACTIONS,
} from "@/lib/shortcuts";
import { toast } from "sonner";

export function ShortcutsSection() {
  const version = useStorageVersion();
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    setBindings(loadShortcuts());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setEditing(null);
        return;
      }
      const combo = comboFromEvent(e);
      setShortcut(editing, combo);
      toast.success(`Bound ${editing} to ${combo}`);
      setEditing(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [editing]);

  const grouped: Record<string, typeof SHORTCUT_ACTIONS> = {};
  for (const a of SHORTCUT_ACTIONS) {
    if (!grouped[a.category]) grouped[a.category] = [];
    grouped[a.category].push(a);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Keyboard shortcuts</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            resetShortcuts();
            toast.success("Shortcuts reset to defaults");
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </Button>
      </div>
      <div className="space-y-3 rounded-md border p-3 text-sm">
        {Object.entries(grouped).map(([cat, actions]) => (
          <div key={cat}>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {cat}
            </p>
            <ul className="mt-1 space-y-1">
              {actions.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-secondary/40"
                >
                  <span>{a.label}</span>
                  <button
                    onClick={() => setEditing(a.id)}
                    className="rounded border bg-card px-2 py-0.5 font-mono text-xs hover:border-primary/40"
                  >
                    {editing === a.id ? "press a key..." : bindings[a.id] || "(none)"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground">
          Click any binding, then press the key combo you want. Esc to cancel.
        </p>
      </div>
    </section>
  );
}
