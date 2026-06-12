"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { listJobs } from "@/lib/api";
import { addCustomCard } from "@/lib/custom-cards";
import { loadDeckMeta } from "@/lib/deck-store";
import type { JobSummary } from "@/lib/types";
import { toast } from "sonner";

// Floating "+" that opens an inline form to capture a card from any page,
// straight into any existing deck. Saves to that deck's custom-cards store.
export function QuickCaptureFab() {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [deckId, setDeckId] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open || jobs !== null) return;
    listJobs()
      .then((js) => {
        const done = js.filter((j) => j.status === "done");
        setJobs(done);
        if (!deckId && done[0]) setDeckId(done[0].id);
      })
      .catch(() => setJobs([]));
  }, [open, jobs, deckId]);

  const submit = () => {
    if (!deckId || !question.trim() || !answer.trim()) {
      toast.error("Pick a deck and fill in Q + A");
      return;
    }
    setPending(true);
    addCustomCard(deckId, {
      question: question.trim(),
      answer: answer.trim(),
      tags: ["quick"],
    });
    toast.success("Card captured");
    setQuestion("");
    setAnswer("");
    setPending(false);
    setOpen(false);
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-20 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/40 hover:bg-primary/90 md:bottom-6"
        aria-label="Quick capture card"
      >
        <Plus className="h-6 w-6" />
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-end bg-background/70 backdrop-blur-sm p-4 md:place-items-center"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              className="w-full max-w-md space-y-3 rounded-xl border bg-card p-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 font-display text-lg font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" /> Quick capture
                </p>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1">
                <Label>Deck</Label>
                <Select value={deckId} onValueChange={setDeckId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a deck" />
                  </SelectTrigger>
                  <SelectContent>
                    {(jobs ?? []).map((j) => {
                      const m = loadDeckMeta(j.id);
                      return (
                        <SelectItem key={j.id} value={j.id}>
                          {m.alias || j.filename}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Question</Label>
                <Textarea rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Answer</Label>
                <Textarea rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} />
              </div>
              <Button onClick={submit} disabled={pending} className="w-full">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Add card
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
