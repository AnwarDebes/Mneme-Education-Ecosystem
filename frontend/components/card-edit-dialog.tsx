"use client";
import { useEffect, useState } from "react";
import { Image as ImageIcon, Loader2, Sparkles, Save, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { suggestTagsForCard } from "@/lib/api";
import {
  clearEditSnapshot,
  loadEditHistory,
  pushEditSnapshot,
} from "@/lib/edit-history";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DrawingPad } from "@/components/drawing-pad";
import { CardMediaView } from "@/components/card-media";
import { CardStatsPanel } from "@/components/card-stats-panel";
import { RelationsPicker } from "@/components/relations-picker";
import { VariantsSection } from "@/components/variants-section";
import { VoiceMemo } from "@/components/voice-memo";
import { clearCardOverride, loadDeckMeta, saveDeckMeta, updateCardOverride } from "@/lib/deck-store";
import { clearCardMedia, getCardMedia, updateCardMedia } from "@/lib/media-store";
import type { ResolvedCard } from "@/lib/cards";
import { toast } from "sonner";

interface CardEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  card: ResolvedCard | null;
  allCards?: ResolvedCard[];
}

export function CardEditDialog({
  open,
  onOpenChange,
  deckId,
  card,
  allCards,
}: CardEditDialogProps) {
  const [tab, setTab] = useState<"basic" | "media" | "links">("basic");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [notes, setNotes] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "auto">("auto");
  const [customTagsRaw, setCustomTagsRaw] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageCaption, setImageCaption] = useState("");
  const [showPad, setShowPad] = useState(false);

  useEffect(() => {
    if (!card) return;
    setTab("basic");
    setQuestion(card.question);
    setAnswer(card.answer);
    setNotes(card.notes);
    setCustomTagsRaw(card.customTags.join(", "));
    setDifficulty(
      card.effective_difficulty === card.difficulty || card.effective_difficulty == null
        ? "auto"
        : (card.effective_difficulty as "easy" | "medium" | "hard"),
    );
    const media = getCardMedia(deckId, card.id);
    setImageUrl(media.image_url ?? "");
    setImageCaption(media.image_caption ?? "");
    setShowPad(false);
  }, [card, deckId]);

  if (!card) return null;
  const media = getCardMedia(deckId, card.id);

  const save = () => {
    // Snapshot the current persisted state before overwriting so the user
    // gets a one-step undo on the toast.
    const meta = loadDeckMeta(deckId);
    const prevOverride = meta.cards[card.id] ?? null;
    const prevMedia = getCardMedia(deckId, card.id);
    pushEditSnapshot(deckId, card.id, {
      override: prevOverride,
      media: prevMedia.image_url || prevMedia.image_caption ? prevMedia : null,
    });

    const tags = customTagsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updateCardOverride(deckId, card.id, {
      question: question !== card.question ? question : undefined,
      answer: answer !== card.answer ? answer : undefined,
      notes: notes || undefined,
      customTags: tags.length ? tags : undefined,
      difficultyOverride: difficulty === "auto" ? undefined : difficulty,
    });
    updateCardMedia(deckId, card.id, {
      image_url: imageUrl.trim() || undefined,
      image_caption: imageCaption.trim() || undefined,
    });
    toast.success("Card saved", {
      action: {
        label: "Undo",
        onClick: () => undoLastSave(),
      },
      duration: 8000,
    });
    onOpenChange(false);
  };

  const undoLastSave = () => {
    const snap = loadEditHistory(deckId, card.id);
    if (!snap) return;
    const meta = loadDeckMeta(deckId);
    if (snap.override) meta.cards[card.id] = snap.override;
    else delete meta.cards[card.id];
    saveDeckMeta(deckId, meta);
    if (snap.media) updateCardMedia(deckId, card.id, snap.media);
    else clearCardMedia(deckId, card.id);
    clearEditSnapshot(deckId, card.id);
    toast.success("Reverted last edit");
  };

  const revert = () => {
    clearCardOverride(deckId, card.id);
    clearCardMedia(deckId, card.id);
    toast.success("Card restored");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit card</DialogTitle>
          <DialogDescription>
            Tweaks live in your browser. The original generated card stays untouched on the backend.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "basic" | "media" | "links")}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basics</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="q">Question</Label>
              <Textarea id="q" rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="a">Answer</Label>
              <Textarea id="a" rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Difficulty</Label>
                <Select
                  value={difficulty}
                  onValueChange={(v) => setDifficulty(v as "easy" | "medium" | "hard" | "auto")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (model)</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <SuggestTagsInline
                    deckId={deckId}
                    question={question}
                    answer={answer}
                    existingRaw={customTagsRaw}
                    onSuggest={(t) => {
                      const cur = customTagsRaw
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                      const merged = Array.from(new Set([...cur, ...t]));
                      setCustomTagsRaw(merged.join(", "));
                    }}
                  />
                </div>
                <Input
                  id="tags"
                  value={customTagsRaw}
                  onChange={(e) => setCustomTagsRaw(e.target.value)}
                  placeholder="biology, chapter-3"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes">Personal notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Mnemonics, related facts, references."
              />
            </div>
          </TabsContent>

          <TabsContent value="media" className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="image-url" className="flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" /> Image URL
              </Label>
              <Input
                id="image-url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://upload.wikimedia.org/..."
              />
              <Input
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
                placeholder="Caption (optional)"
                className="mt-1"
              />
            </div>
            <CardMediaView deckId={deckId} cardId={card.id} size="sm" className="rounded-md" />

            <div className="space-y-1">
              <Label>Voice memo</Label>
              <VoiceMemo
                initial={
                  media.audio_data
                    ? { data: media.audio_data, mime: media.audio_mime ?? "audio/webm" }
                    : null
                }
                onSave={(memo) => {
                  updateCardMedia(deckId, card.id, {
                    audio_data: memo.data,
                    audio_mime: memo.mime,
                  });
                  toast.success("Voice memo saved");
                }}
                onRemove={() => {
                  updateCardMedia(deckId, card.id, {
                    audio_data: undefined,
                    audio_mime: undefined,
                  });
                  toast.success("Voice memo removed");
                }}
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Sketch</Label>
                <Button variant="ghost" size="sm" onClick={() => setShowPad((s) => !s)}>
                  {showPad ? "Hide pad" : media.drawing_svg ? "Edit sketch" : "Add sketch"}
                </Button>
              </div>
              {showPad ? (
                <DrawingPad
                  onSave={(svg) => {
                    updateCardMedia(deckId, card.id, { drawing_svg: svg });
                    toast.success("Sketch saved");
                    setShowPad(false);
                  }}
                />
              ) : media.drawing_svg ? (
                <div className="space-y-2">
                  <CardMediaView deckId={deckId} cardId={card.id} size="sm" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      updateCardMedia(deckId, card.id, { drawing_svg: undefined });
                      toast.success("Sketch removed");
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove sketch
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Add a sketch to illustrate this card. Great for diagrams.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="links" className="space-y-3">
            <CardStatsPanel deckId={deckId} cardId={card.id} />
            <VariantsSection deckId={deckId} cardId={card.id} originalQuestion={card.question} />
            {allCards && allCards.length > 1 ? (
              <RelationsPicker deckId={deckId} card={card} allCards={allCards} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Add more cards to start linking them as prerequisites or related.
              </p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="sm:justify-between">
          <div className="flex gap-2">
            <Button variant="ghost" onClick={revert}>
              <RotateCcw className="h-4 w-4" /> Restore original
            </Button>
            {loadEditHistory(deckId, card.id) && (
              <Button variant="ghost" onClick={undoLastSave} title="Revert your last save">
                <Undo2 className="h-4 w-4" /> Undo last save
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save}>
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuggestTagsInline({
  deckId,
  question,
  answer,
  existingRaw,
  onSuggest,
}: {
  deckId: string;
  question: string;
  answer: string;
  existingRaw: string;
  onSuggest: (tags: string[]) => void;
}) {
  const [pending, setPending] = useState(false);
  const run = async () => {
    if (!question.trim() || !answer.trim()) {
      toast.error("Fill in question and answer first");
      return;
    }
    setPending(true);
    try {
      const tags = existingRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const resp = await suggestTagsForCard(deckId, {
        question,
        answer,
        existing_tags: tags,
      });
      if (resp.tags.length === 0) {
        toast.info("No new tag ideas");
      } else {
        onSuggest(resp.tags);
        toast.success(`Added ${resp.tags.length} suggested tags`);
      }
    } catch (err: any) {
      toast.error("Could not suggest", { description: err?.message || String(err) });
    } finally {
      setPending(false);
    }
  };
  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-primary hover:underline disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
      AI suggest
    </button>
  );
}
