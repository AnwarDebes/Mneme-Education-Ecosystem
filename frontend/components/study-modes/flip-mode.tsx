"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Edit3, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Flashcard } from "@/components/flashcard";
import { CardEditDialog } from "@/components/card-edit-dialog";
import { ExplainDialog } from "@/components/explain-dialog";
import { HintStrip } from "@/components/hint-strip";
import { RelatedCardsStrip } from "@/components/relations-picker";
import { SessionSummary } from "@/components/session-summary";
import { loadAnchors } from "@/lib/anchors";
import { pickVariantQuestion } from "@/lib/card-variants";
import { logConfidence } from "@/lib/confidence";
import { recordReview } from "@/lib/stats";
import { gradeCard as scheduleGrade, type Grade } from "@/lib/schedule";
import { gradeCard as remoteGrade } from "@/lib/api";
import { recordTagGrade } from "@/lib/tag-stats";
import { Sounds } from "@/lib/sound";
import { addXP } from "@/lib/xp";
import { bumpQuest } from "@/lib/quests";
import { recordTiming } from "@/lib/timing";
import { toggleCardFavorite } from "@/lib/deck-store";
import { setDeckLastStudied } from "@/lib/deck-store";
import type { ResolvedCard } from "@/lib/cards";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const GRADE_KEYS: Record<string, Grade> = {
  "1": "again",
  "2": "hard",
  "3": "good",
  "4": "easy",
};

interface FlipModeProps {
  deckId: string;
  cards: ResolvedCard[];
  model?: string;
}

export function FlipMode({ deckId, cards, model }: FlipModeProps) {
  // Reorder so anchored cards come first.
  const orderedCards = useMemo(() => {
    const anchorSet = new Set(loadAnchors(deckId));
    const anchors: ResolvedCard[] = [];
    const rest: ResolvedCard[] = [];
    for (const c of cards) {
      if (anchorSet.has(c.id)) anchors.push(c);
      else rest.push(c);
    }
    return [...anchors, ...rest];
  }, [cards, deckId]);
  const [order, setOrder] = useState<number[]>(() => orderedCards.map((_, i) => i));
  const [position, setPosition] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [grades, setGrades] = useState<Record<string, Grade>>({});
  const [editing, setEditing] = useState<ResolvedCard | null>(null);
  const [explaining, setExplaining] = useState<ResolvedCard | null>(null);
  const [startedAt] = useState(() => Date.now());
  const cardShownAt = useRef(Date.now());

  useEffect(() => {
    setDeckLastStudied(deckId);
  }, [deckId]);

  const baseCard = useMemo(() => {
    const idx = order[position];
    return idx == null ? null : orderedCards[idx] ?? null;
  }, [orderedCards, order, position]);

  // Substitute a variant question if any exist for this card.
  const card = useMemo(() => {
    if (!baseCard) return null;
    const phrasing = pickVariantQuestion(deckId, baseCard.id, baseCard.question);
    if (phrasing === baseCard.question) return baseCard;
    return { ...baseCard, question: phrasing };
  }, [baseCard, deckId]);

  // Confidence prediction (1-5), reset when card changes.
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  useEffect(() => setConfidence(null), [baseCard?.id]);

  const progressPct = useMemo(() => {
    if (cards.length === 0) return 0;
    return Math.round(((position + (flipped ? 0.5 : 0)) / cards.length) * 100);
  }, [cards.length, position, flipped]);

  const next = useCallback(() => {
    setFlipped(false);
    setPosition((p) => Math.min(cards.length, p + 1));
  }, [cards.length]);

  const prev = useCallback(() => {
    setFlipped(false);
    setPosition((p) => Math.max(0, p - 1));
  }, []);

  const submitGrade = useCallback(
    async (g: Grade) => {
      if (!card) return;
      setGrades((prev) => ({ ...prev, [card.id]: g }));
      const elapsed = Date.now() - cardShownAt.current;
      cardShownAt.current = Date.now();
      scheduleGrade(deckId, card.id, g);
      recordReview(g);
      recordTagGrade([...card.tags, ...card.customTags], g);
      recordTiming({ mode: "flip", grade: g, ms: elapsed });
      addXP(1 + (g === "good" || g === "easy" ? 1 : 0));
      bumpQuest("reviews", 1);
      if (confidence != null) {
        logConfidence({ deck_id: deckId, card_id: card.id, predicted: confidence, actual: g });
      }
      if (g === "again") Sounds.wrong();
      else if (g === "easy" || g === "good") Sounds.correct();
      try {
        await remoteGrade(deckId, card.id, g);
      } catch {
        /* offline grade is fine */
      }
      next();
    },
    [card, deckId, next],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (GRADE_KEYS[e.key] && flipped) {
        e.preventDefault();
        submitGrade(GRADE_KEYS[e.key]);
      } else if (e.key.toLowerCase() === "f" && card) {
        e.preventDefault();
        toggleCardFavorite(deckId, card.id);
      } else if (e.key.toLowerCase() === "e" && card) {
        e.preventDefault();
        setEditing(card);
      } else if (e.key.toLowerCase() === "s" && card) {
        // Skip without grading - useful when a card needs editing but
        // the user doesn't want to bake a wrong grade in the schedule.
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, next, prev, submitGrade, deckId, card]);

  const finished = position >= cards.length;

  if (finished) {
    const correct = Object.values(grades).filter((g) => g !== "again").length;
    const again = Object.values(grades).filter((g) => g === "again").length;
    return (
      <SessionSummary
        total={Object.keys(grades).length}
        correct={correct}
        again={again}
        elapsedSeconds={(Date.now() - startedAt) / 1000}
        deckId={deckId}
        onRestart={() => {
          setGrades({});
          setPosition(0);
          setFlipped(false);
          setOrder(cards.map((_, i) => i));
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Card {position + 1} of {cards.length}
          </span>
          <span>{Object.keys(grades).length} reviewed</span>
        </div>
        <Progress value={progressPct} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={card?.id ?? "empty"}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="flex justify-center"
        >
          {card && <Flashcard deckId={deckId} card={card} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />}
        </motion.div>
      </AnimatePresence>

      {card && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const fav = toggleCardFavorite(deckId, card.id);
              toast.success(fav ? "Favorited" : "Removed favorite");
            }}
          >
            <Heart className={cn("h-4 w-4", card.favorite && "fill-rose-500 text-rose-500")} />
            {card.favorite ? "Favorited" : "Favorite"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(card)}>
            <Edit3 className="h-4 w-4" /> Edit
          </Button>
          {model && (
            <Button variant="ghost" size="sm" onClick={() => setExplaining(card)}>
              <Edit3 className="h-4 w-4" /> Explain
            </Button>
          )}
          {card.customTags.concat(card.tags).slice(0, 4).map((t) => (
            <Badge key={t} variant="outline" className="text-[10px]">
              #{t}
            </Badge>
          ))}
        </div>
      )}

      {!flipped && card && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>Confidence:</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setConfidence(n as 1 | 2 | 3 | 4 | 5)}
              className={cn(
                "h-7 w-7 rounded-full border text-[10px] font-semibold",
                confidence === n ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:border-primary/40",
              )}
              aria-label={`predict ${n} of 5`}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {flipped ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <GradeButton onClick={() => submitGrade("again")} grade="again" hotkey="1" />
          <GradeButton onClick={() => submitGrade("hard")} grade="hard" hotkey="2" />
          <GradeButton onClick={() => submitGrade("good")} grade="good" hotkey="3" />
          <GradeButton onClick={() => submitGrade("easy")} grade="easy" hotkey="4" />
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={prev} disabled={position === 0}>
            <ArrowLeft className="h-4 w-4" /> Prev
          </Button>
          <Button size="lg" onClick={() => setFlipped(true)}>
            Show answer{" "}
            <span className="hidden text-xs opacity-70 sm:inline">(space)</span>
          </Button>
          <Button variant="ghost" onClick={next} disabled={position >= cards.length - 1}>
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {card && <HintStrip deckId={deckId} card={card} />}

      {card && <RelatedCardsStrip deckId={deckId} card={card} allCards={cards} />}

      {card?.source_fact && (
        <Card className="border-border/60 bg-secondary/30">
          <CardContent className="p-4 text-xs">
            <p className="font-medium text-foreground">Source fact</p>
            <p className="mt-1 italic text-muted-foreground">{card.source_fact}</p>
            {card.difficulty_rationale && (
              <>
                <p className="mt-3 font-medium text-foreground">Difficulty rationale</p>
                <p className="mt-1 text-muted-foreground">{card.difficulty_rationale}</p>
              </>
            )}
            {card.notes && (
              <>
                <p className="mt-3 font-medium text-foreground">Your notes</p>
                <p className="mt-1 text-muted-foreground">{card.notes}</p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <CardEditDialog
        deckId={deckId}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        card={editing}
        allCards={cards}
      />
      <ExplainDialog
        open={explaining !== null}
        onOpenChange={(o) => !o && setExplaining(null)}
        deckId={deckId}
        card={explaining}
        model={model ?? "qwen2.5:7b-instruct"}
      />
    </div>
  );
}

function GradeButton({ grade, hotkey, onClick }: { grade: Grade; hotkey: string; onClick: () => void }) {
  const styles: Record<Grade, string> = {
    again: "bg-destructive/15 text-destructive hover:bg-destructive/25",
    hard: "bg-warn/15 text-warn hover:bg-warn/25",
    good: "bg-primary/15 text-primary hover:bg-primary/25",
    easy: "bg-success/15 text-success hover:bg-success/25",
  };
  return (
    <Button onClick={onClick} variant="ghost" className={cn("h-14 capitalize", styles[grade])}>
      <span className="text-base font-semibold">{grade}</span>
      <span className="hidden text-xs opacity-70 sm:inline">({hotkey})</span>
    </Button>
  );
}
