"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  deleteSnapshot,
  listSnapshots,
  restoreSnapshot,
  takeSnapshot,
  type SnapshotMeta,
} from "@/lib/snapshots";
import { useStorageVersion } from "@/lib/hooks";
import type { ResolvedCard } from "@/lib/cards";
import { toast } from "sonner";

interface SnapshotsPanelProps {
  deckId: string;
  cards: ResolvedCard[];
}

export function SnapshotsPanel({ deckId, cards }: SnapshotsPanelProps) {
  const version = useStorageVersion();
  const [list, setList] = useState<SnapshotMeta[]>([]);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setList(listSnapshots(deckId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, version]);

  const take = () => {
    setPending(true);
    try {
      const meta = takeSnapshot(deckId, name, cards.length);
      toast.success(`Snapshot "${meta.name}" saved`);
      setName("");
    } catch (err: any) {
      toast.error("Snapshot failed", { description: err?.message || String(err) });
    } finally {
      setPending(false);
    }
  };

  const restore = (m: SnapshotMeta) => {
    if (typeof window !== "undefined" && !window.confirm(`Restore "${m.name}"? This overwrites the current overlay state for this deck.`)) return;
    const ok = restoreSnapshot(m.id);
    if (ok) toast.success("Restored. Reload to see all panels refresh.");
    else toast.error("Could not restore");
  };

  return (
    <Card>
      <div className="flex items-center justify-between border-b bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500/10 text-violet-600">
            <Camera className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Snapshots</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Point-in-time backups of edits / schedule / notes / hints / ratings
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {list.length} / 20
        </Badge>
      </div>
      <CardContent className="space-y-3 p-4">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Snapshot name (optional)"
          />
          <Button onClick={take} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            Take snapshot
          </Button>
        </div>
        {list.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">
            No snapshots yet. Useful before bulk-edits or experimental study runs.
          </p>
        ) : (
          <AnimatePresence>
            {list.map((m) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card p-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-medium">{m.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleString()} - {m.cards_count} cards
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => restore(m)}>
                    <RotateCcw className="h-3.5 w-3.5" /> Restore
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      if (typeof window !== "undefined" && !window.confirm("Delete this snapshot?")) return;
                      deleteSnapshot(deckId, m.id);
                      toast.success("Snapshot deleted");
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  );
}
