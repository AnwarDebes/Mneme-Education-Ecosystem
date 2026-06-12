"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Award, Brain, Calendar, Check, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { jobDetail, listJobs } from "@/lib/api";
import { resolveDeck, type ResolvedCard } from "@/lib/cards";
import { loadDeckMeta } from "@/lib/deck-store";
import { notifyStorageChange, readJSON, writeJSON } from "@/lib/storage";
import { addXP } from "@/lib/xp";
import { isoDate } from "@/lib/stats";
import { fireConfetti } from "@/lib/confetti";
import { RichText } from "@/components/rich-text";
import { toast } from "sonner";

interface DailyChallengeRecord {
  date: string;
  completed: boolean;
  picked: string | null;
}

const KEY = "daily-challenge:v1";

function loadRecord(): DailyChallengeRecord {
  const cur = readJSON<DailyChallengeRecord | null>(KEY, null);
  if (cur && cur.date === isoDate()) return cur;
  return { date: isoDate(), completed: false, picked: null };
}

function saveRecord(r: DailyChallengeRecord): void {
  writeJSON(KEY, r);
  notifyStorageChange();
}

function hashDate(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return h;
}

interface Picked {
  card: ResolvedCard;
  deckId: string;
  deckName: string;
}

export function DailyChallenge() {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [record, setRecord] = useState<DailyChallengeRecord>(loadRecord());

  useEffect(() => {
    listJobs()
      .then(async (js) => {
        const done = js.filter((j) => j.status === "done");
        if (done.length === 0) return;
        const seed = hashDate(isoDate() + "-challenge");
        const deck = done[seed % done.length];
        try {
          const d = await jobDetail(deck.id);
          const cards = resolveDeck(deck.id, d.cards).filter(
            (c) => !c.archived && (c.effective_difficulty === "hard" || c.effective_difficulty === "medium"),
          );
          if (cards.length === 0) return;
          const card = cards[seed % cards.length];
          setPicked({ card, deckId: deck.id, deckName: loadDeckMeta(deck.id).alias || deck.filename });
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
  }, []);

  const mark = (correct: boolean) => {
    if (record.completed) return;
    const r: DailyChallengeRecord = {
      date: isoDate(),
      completed: true,
      picked: picked?.card.id ?? null,
    };
    saveRecord(r);
    setRecord(r);
    if (correct) {
      addXP(30);
      fireConfetti({ particles: 50, durationMs: 1500 });
      toast.success("+30 XP - daily challenge cleared");
    } else {
      addXP(10);
      toast.success("+10 XP for showing up");
    }
  };

  if (!picked) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="overflow-hidden border-amber-400/40 bg-gradient-to-br from-amber-100/20 via-orange-100/10 to-transparent dark:from-amber-500/10">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="gap-1.5">
              <Calendar className="h-3 w-3" /> Daily challenge
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {picked.deckName}
            </Badge>
          </div>
          <RichText text={picked.card.question} className="font-display text-xl font-medium leading-snug" />
          {revealed ? (
            <RichText text={picked.card.answer} className="rounded-md bg-card p-3 text-sm shadow-sm" />
          ) : (
            <Button variant="outline" onClick={() => setRevealed(true)}>
              Reveal answer
            </Button>
          )}
          {!record.completed ? (
            revealed && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <p className="text-xs text-muted-foreground">Did you get it without peeking?</p>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => mark(false)}>
                    <X className="h-3.5 w-3.5" /> Not really
                  </Button>
                  <Button size="sm" onClick={() => mark(true)}>
                    <Check className="h-3.5 w-3.5" /> Got it
                  </Button>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-center justify-between border-t pt-3 text-xs text-success">
              <span>
                <Award className="inline h-3.5 w-3.5" /> Today's challenge complete.
              </span>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/decks/${picked.deckId}` as any}>
                  Open deck <Brain className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
