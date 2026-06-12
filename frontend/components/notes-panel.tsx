"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Notebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { loadNotes, saveNotes } from "@/lib/notes-store";
import { renderMarkdown } from "@/lib/markdown";
import { useStorageVersion } from "@/lib/hooks";

interface NotesPanelProps {
  deckId: string;
}

const PLACEHOLDER = `# My notes for this deck

Markdown is supported: **bold**, *italic*, \`code\`,
[links](https://example.com), lists, blockquotes, code fences.

- Key concepts I want to remember
- Personal mnemonics
- Connections to other material`;

export function NotesPanel({ deckId }: NotesPanelProps) {
  const version = useStorageVersion();
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(true);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    setDraft(loadNotes(deckId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, version]);

  useEffect(() => {
    if (draft === loadNotes(deckId)) {
      setSaved(true);
      return;
    }
    setSaved(false);
    const id = setTimeout(() => {
      saveNotes(deckId, draft);
      setSaved(true);
    }, 700);
    return () => clearTimeout(id);
  }, [draft, deckId]);

  return (
    <Card>
      <div className="flex items-center justify-between border-b bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
            <Notebook className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Notes</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Markdown - auto-saves
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {saved ? (
            <span className="flex items-center gap-1 text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </span>
          ) : (
            <span>Saving...</span>
          )}
          <Button size="sm" variant="ghost" onClick={() => setPreview((p) => !p)}>
            {preview ? (
              <>
                <EyeOff className="h-3.5 w-3.5" /> Edit
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" /> Preview
              </>
            )}
          </Button>
        </div>
      </div>
      <CardContent className="p-4">
        {preview ? (
          <div
            className="prose-sm max-w-none [&_*]:leading-relaxed [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5"
            dangerouslySetInnerHTML={{
              __html:
                draft.trim() === ""
                  ? '<p class="italic text-muted-foreground">No notes yet.</p>'
                  : renderMarkdown(draft),
            }}
          />
        ) : (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={10}
            className="font-mono text-sm"
          />
        )}
      </CardContent>
    </Card>
  );
}
