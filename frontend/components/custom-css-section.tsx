"use client";
import { useState } from "react";
import { Paintbrush, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCustomCss } from "@/lib/custom-css";
import { toast } from "sonner";

const EXAMPLES = `/* Examples - delete or edit */
/* Larger headings */
.font-display { font-family: "Georgia", serif; }

/* Tighter cards */
.flashcard-perspective { perspective: 1800px; }

/* Override an HSL variable globally */
:root { --primary: 220 80% 50%; }
`;

export function CustomCssSection() {
  const [css, setCss] = useCustomCss();
  const [draft, setDraft] = useState(css);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Paintbrush className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Custom CSS</p>
      </div>
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-xs text-muted-foreground">
          Apply your own CSS on top of every page. Live-injected, capped at 10KB.
          Use sparingly; bad rules can break the layout.
        </p>
        <Textarea
          rows={6}
          value={draft || (css ? css : "")}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={EXAMPLES}
          className="font-mono text-xs"
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft("");
              setCss("");
              toast.success("Custom CSS cleared");
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Clear
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setCss(draft);
              toast.success("Custom CSS applied");
            }}
          >
            Apply
          </Button>
        </div>
      </div>
    </section>
  );
}
