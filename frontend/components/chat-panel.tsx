"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  CircleAlert,
  Loader2,
  MessagesSquare,
  Send,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { chatWithDeck } from "@/lib/api";
import { appendChat, clearChat, loadChat, type StoredMessage } from "@/lib/chat-store";
import { useStorageVersion } from "@/lib/hooks";
import { renderMarkdown } from "@/lib/markdown";
import { cn, formatElapsed } from "@/lib/utils";
import { toast } from "sonner";

interface ChatPanelProps {
  deckId: string;
  deckTitle: string;
  defaultModel: string;
  factCount: number;
}

const SUGGESTIONS = [
  "Summarize the main ideas in this source.",
  "What's the most important fact here?",
  "Quiz me on the trickiest concept.",
  "Explain this for someone new to the topic.",
  "What did this source skip or leave unclear?",
];

export function ChatPanel({ deckId, deckTitle, defaultModel, factCount }: ChatPanelProps) {
  const version = useStorageVersion();
  const [history, setHistory] = useState<StoredMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setHistory(loadChat(deckId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, version]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history.length, pending]);

  const send = async (text: string) => {
    const value = text.trim();
    if (!value || pending) return;
    setError(null);
    appendChat(deckId, { role: "user", content: value });
    setDraft("");
    setPending(true);
    try {
      const resp = await chatWithDeck(
        deckId,
        loadChat(deckId).map((m) => ({ role: m.role, content: m.content })),
        { model: defaultModel },
      );
      appendChat(deckId, { role: "assistant", content: resp.content });
    } catch (err: any) {
      const msg = err?.message ? String(err.message) : String(err);
      setError(msg);
      toast.error("Chat failed", { description: msg });
    } finally {
      setPending(false);
      taRef.current?.focus();
    }
  };

  const empty = history.length === 0;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <MessagesSquare className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Chat with this deck's source</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Grounded on {factCount} atomic facts - via {defaultModel}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (history.length === 0) return;
            clearChat(deckId);
            setHistory([]);
          }}
          disabled={history.length === 0}
          title="Clear chat history"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <CardContent className="space-y-3 p-4">
        {empty ? (
          <EmptyState deckTitle={deckTitle} onPick={(t) => send(t)} />
        ) : (
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {history.map((m) => (
                <ChatBubble key={m.id} msg={m} />
              ))}
            </AnimatePresence>
            {pending && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                thinking...
              </motion.div>
            )}
            <div ref={endRef} />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <CircleAlert className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-end gap-2">
          <Textarea
            ref={taRef}
            rows={2}
            value={draft}
            disabled={pending}
            placeholder={`Ask anything about "${deckTitle}"...`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                send(draft);
              }
            }}
            className="resize-none"
          />
          <Button onClick={() => send(draft)} disabled={!draft.trim() || pending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Local LLM, grounded on this deck's source. Cmd/Ctrl+Enter to send.
        </p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ deckTitle, onPick }: { deckTitle: string; onPick: (s: string) => void }) {
  return (
    <div className="space-y-3 rounded-lg border border-dashed bg-muted/30 p-4 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
        <Sparkles className="h-6 w-6" />
      </span>
      <div>
        <p className="font-display text-base font-semibold">
          Talk to "{deckTitle}"
        </p>
        <p className="text-xs text-muted-foreground">
          The model has been briefed on this deck's atomic facts. Ask it anything.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5 pt-1">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-full border bg-card px-3 py-1 text-xs hover:border-primary/40 hover:text-primary"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatBubble({ msg }: { msg: StoredMessage }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Bot className="h-3.5 w-3.5" />
        </span>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        ) : (
          <div
            className="space-y-1.5 [&>p]:leading-relaxed [&_code]:rounded [&_code]:bg-card [&_code]:px-1 [&_code]:py-0.5 [&_strong]:font-semibold"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
          />
        )}
      </div>
      {isUser && (
        <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
          <User className="h-3.5 w-3.5" />
        </span>
      )}
    </motion.div>
  );
}
