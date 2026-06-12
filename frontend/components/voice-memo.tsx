"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, Pause, Play, Save, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoiceMemoProps {
  initial?: { data: string; mime: string } | null;
  onSave: (memo: { data: string; mime: string }) => void;
  onRemove?: () => void;
  className?: string;
}

function recorderAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export function VoiceMemo({ initial, onSave, onRemove, className }: VoiceMemoProps) {
  const [available, setAvailable] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pending, setPending] = useState<{ data: string; mime: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const startedAt = useRef(0);
  const tick = useRef<number | null>(null);

  useEffect(() => {
    setAvailable(recorderAvailable());
  }, []);

  const start = async () => {
    setError(null);
    setPending(null);
    chunks.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = async () => {
        try {
          const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
          if (blob.size > 1.5 * 1024 * 1024) {
            setError("Recording is over 1.5 MB; please re-record a shorter memo.");
            return;
          }
          const data = await blobToBase64(blob);
          setPending({ data, mime: rec.mimeType || "audio/webm" });
        } finally {
          stream.getTracks().forEach((t) => t.stop());
        }
      };
      rec.start();
      recorderRef.current = rec;
      startedAt.current = Date.now();
      setRecording(true);
      tick.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
      }, 250);
    } catch (err) {
      setError(`Mic access denied or unavailable: ${(err as Error).message}`);
    }
  };

  const stop = () => {
    try {
      recorderRef.current?.stop();
    } catch {
      /* ignore */
    }
    setRecording(false);
    if (tick.current != null) {
      window.clearInterval(tick.current);
      tick.current = null;
    }
  };

  if (!available) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Voice memos need MediaRecorder; your browser doesn't expose it.
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {recording ? (
          <Button variant="destructive" size="sm" onClick={stop}>
            <Square className="h-3.5 w-3.5" /> Stop ({elapsed}s)
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={start}>
            <Mic className="h-3.5 w-3.5" /> {initial || pending ? "Re-record" : "Record memo"}
          </Button>
        )}
        {recording && (
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="text-xs text-destructive"
          >
            REC
          </motion.span>
        )}
      </div>

      {(pending || initial) && !recording && (
        <div className="space-y-2 rounded-md border bg-secondary/30 p-3">
          <audio
            controls
            src={
              pending
                ? `data:${pending.mime};base64,${pending.data}`
                : `data:${initial!.mime};base64,${initial!.data}`
            }
            className="w-full"
          />
          <div className="flex flex-wrap justify-end gap-2">
            {onRemove && (
              <Button variant="ghost" size="sm" onClick={onRemove}>
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            )}
            {pending && (
              <Button size="sm" onClick={() => onSave(pending)}>
                <Save className="h-3.5 w-3.5" /> Save memo
              </Button>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const data = String(reader.result || "");
      const comma = data.indexOf(",");
      resolve(comma >= 0 ? data.slice(comma + 1) : data);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
