"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SpeakButton } from "@/components/speak-button";
import { RichText } from "@/components/rich-text";
import { CardMediaView } from "@/components/card-media";
import { cn, difficultyTone } from "@/lib/utils";
import type { Card as CardData } from "@/lib/types";

interface FlashcardProps {
  card: CardData;
  flipped: boolean;
  onFlip: () => void;
  deckId?: string;
}

export function Flashcard({ card, flipped, onFlip, deckId }: FlashcardProps) {
  const tone = difficultyTone(card.difficulty);

  return (
    <div className="flashcard-perspective relative aspect-[3/2] w-full max-w-2xl">
      <button
        type="button"
        onClick={onFlip}
        aria-label={flipped ? "Show question" : "Show answer"}
        className={cn(
          "flashcard-flip-inner relative h-full w-full",
          flipped && "is-flipped",
        )}
      >
        <Face
          side="front"
          tone={tone}
          text={card.question}
          hint="Tap to reveal the answer"
          media={deckId ? <CardMediaView deckId={deckId} cardId={card.id} size="sm" /> : null}
        />
        <Face
          side="back"
          tone={tone}
          text={card.answer}
          hint="Tap to flip back"
          media={deckId ? <CardMediaView deckId={deckId} cardId={card.id} size="sm" /> : null}
        />
      </button>
    </div>
  );
}

interface FaceProps {
  side: "front" | "back";
  tone: ReturnType<typeof difficultyTone>;
  text: string;
  hint: string;
  media?: React.ReactNode;
}

function Face({ side, tone, text, hint, media }: FaceProps) {
  return (
    <Card
      className={cn(
        "flashcard-face absolute inset-0 flex h-full w-full flex-col justify-between p-8 sm:p-10",
        "paper select-none",
        side === "back" && "flashcard-face--back",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline" className="text-xs capitalize">
          {side === "front" ? "Question" : "Answer"}
        </Badge>
        <div className="flex items-center gap-1">
          <SpeakButton text={text} className="h-7 w-7" />
          <Badge className={cn(tone.bg, tone.fg, "capitalize")}>{tone.label}</Badge>
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-2">
        <motion.div
          key={text}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="text-balance text-center font-display text-2xl font-medium leading-snug sm:text-3xl"
        >
          <RichText text={text} as="div" />
        </motion.div>
        {media && <div className="w-full max-w-md">{media}</div>}
      </div>
      <p className="text-center text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}
