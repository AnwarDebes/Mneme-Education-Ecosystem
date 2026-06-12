"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Headphones, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { addCustomCard } from "@/lib/custom-cards";
import {
  addBookmark,
  clearLecture,
  loadLecture,
  removeBookmark,
  saveLecture,
  type LectureBookmark,
} from "@/lib/lecture-audio";
import { useStorageVersion } from "@/lib/hooks";
import { toast } from "sonner";

interface LectureAudioPanelProps {
  deckId: string;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function LectureAudioPanel({ deckId }: LectureAudioPanelProps) {
  const version = useStorageVersion();
  const audio = useMemo(() => loadLecture(deckId), [deckId, version]);
  const ref = useRef<HTMLAudioElement | null>(null);
  const [now, setNow] = useState(0);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onTime = () => setNow(el.currentTime);
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [audio]);

  const upload = (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Audio over 4 MB; clip or compress first");
      return;
    }
    setPending(true);
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || "");
      const comma = data.indexOf(",");
      const b64 = comma >= 0 ? data.slice(comma + 1) : data;
      const probe = new Audio(`data:${file.type};base64,${b64}`);
      probe.onloadedmetadata = () => {
        saveLecture(deckId, {
          filename: file.name,
          mime: file.type || "audio/mpeg",
          data: b64,
          duration_sec: probe.duration || 0,
          bookmarks: audio?.bookmarks ?? [],
        });
        toast.success("Lecture attached");
        setPending(false);
      };
    };
    reader.readAsDataURL(file);
  };

  const cardAtTimestamp = () => {
    if (!audio || !note.trim()) {
      toast.error("Type a note for this moment first");
      return;
    }
    const cardId = `lecture-${Date.now().toString(36)}`;
    addCustomCard(deckId, {
      question: `At ${fmt(now)} in "${audio.filename}", what's discussed?`,
      answer: note.trim(),
      tags: ["lecture", "timestamp"],
    });
    addBookmark(deckId, { card_id: cardId, ts_sec: now, note: note.trim() });
    toast.success(`Card + bookmark at ${fmt(now)}`);
    setNote("");
  };

  return (
    <Card>
      <div className="flex items-center justify-between border-b bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-500/10 text-rose-600">
            <Headphones className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Lecture audio</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Attach an audio file + scrub to make timestamped cards
            </p>
          </div>
        </div>
        {audio && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (typeof window !== "undefined" && !window.confirm("Detach lecture audio?")) return;
              clearLecture(deckId);
              toast.success("Detached");
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <CardContent className="space-y-3 p-4">
        {!audio ? (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-muted/40 p-6 text-center">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm">Drop or pick an audio file (under 4 MB)</p>
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
            />
            {pending && <Loader2 className="mt-2 h-4 w-4 animate-spin text-muted-foreground" />}
          </label>
        ) : (
          <>
            <div className="space-y-1">
              <p className="text-xs font-medium">{audio.filename}</p>
              <audio
                ref={ref}
                controls
                src={`data:${audio.mime};base64,${audio.data}`}
                className="w-full"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={`Note at ${fmt(now)} (becomes a card)`}
                className="flex-1"
              />
              <Button size="sm" onClick={cardAtTimestamp}>
                <Plus className="h-3.5 w-3.5" /> Card at {fmt(now)}
              </Button>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Bookmarks ({audio.bookmarks.length})
              </p>
              <AnimatePresence>
                {audio.bookmarks.map((b) => (
                  <motion.div
                    key={b.card_id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 rounded border bg-card px-2 py-1 text-xs"
                  >
                    <Badge variant="outline" className="text-[10px]">
                      {fmt(b.ts_sec)}
                    </Badge>
                    <span className="flex-1 truncate">{b.note || "(no note)"}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => {
                        if (ref.current) ref.current.currentTime = b.ts_sec;
                      }}
                    >
                      <BookOpen className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => removeBookmark(deckId, b.card_id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
