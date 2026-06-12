"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Play, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { postImport } from "@/lib/import";
import { SAMPLE_DECKS, type SampleDeck } from "@/lib/sample-decks";
import { toast } from "sonner";

interface SampleDecksProps {
  onImported?: () => void;
}

export function SampleDecksRow({ onImported }: SampleDecksProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-amber-500" />
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Try a sample deck
        </h2>
        <p className="text-xs text-muted-foreground">
          Pre-built, fully local. One click to add them to your library.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {SAMPLE_DECKS.map((deck, i) => (
          <SampleCard key={deck.id} deck={deck} delay={i * 0.08} onImported={onImported} />
        ))}
      </div>
    </section>
  );
}

function SampleCard({ deck, delay, onImported }: { deck: SampleDeck; delay: number; onImported?: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const tryIt = async () => {
    setPending(true);
    try {
      const job = await postImport(deck.name, deck.cards);
      toast.success(`Sample loaded: ${deck.name}`);
      onImported?.();
      router.push(`/decks/${job.id}` as any);
    } catch (err: any) {
      toast.error("Could not load sample", { description: err?.message || String(err) });
    } finally {
      setPending(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className="group h-full overflow-hidden">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start justify-between">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-card text-2xl shadow-sm ring-1 ring-border">
              {deck.emoji}
            </span>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {deck.topic}
            </Badge>
          </div>
          <div>
            <p className="font-display text-lg font-semibold leading-tight">{deck.name}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{deck.summary}</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{deck.cards.length} cards</p>
            <Button size="sm" onClick={tryIt} disabled={pending}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Add to library
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
