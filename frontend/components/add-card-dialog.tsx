"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { addCustomCard } from "@/lib/custom-cards";
import { toast } from "sonner";

interface AddCardDialogProps {
  deckId: string;
  onAdded?: () => void;
}

export function AddCardDialog({ deckId, onAdded }: AddCardDialogProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [difficulty, setDifficulty] = useState<"auto" | "easy" | "medium" | "hard">("auto");
  const [tagsRaw, setTagsRaw] = useState("custom");

  const submit = () => {
    if (!question.trim() || !answer.trim()) {
      toast.error("Question and answer are both required");
      return;
    }
    addCustomCard(deckId, {
      question,
      answer,
      tags: tagsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      difficulty: difficulty === "auto" ? null : difficulty,
    });
    toast.success("Card added");
    setQuestion("");
    setAnswer("");
    setTagsRaw("custom");
    setDifficulty("auto");
    setOpen(false);
    onAdded?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4" /> Add card
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a custom card</DialogTitle>
          <DialogDescription>
            Stays in this deck on your device. Shows up alongside generated cards in study modes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cq">Question</Label>
            <Textarea
              id="cq"
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Your question"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ca">Answer</Label>
            <Textarea
              id="ca"
              rows={2}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="The answer"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as typeof difficulty)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Unrated</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ctags">Tags</Label>
              <Input
                id="ctags"
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>
            <Plus className="h-4 w-4" /> Add card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
