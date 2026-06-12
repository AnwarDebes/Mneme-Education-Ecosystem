"use client";
import { useEffect, useState } from "react";
import { Check, FileStack, Loader2, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { CARD_TEMPLATES, getTemplate } from "@/lib/card-templates";
import { addCustomCard } from "@/lib/custom-cards";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TemplateAddDialogProps {
  deckId: string;
  onAdded?: () => void;
}

export function TemplateAddDialog({ deckId, onAdded }: TemplateAddDialogProps) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState(CARD_TEMPLATES[0].id);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setTemplateId(CARD_TEMPLATES[0].id);
    setValues({});
  }, [open]);

  const template = getTemplate(templateId)!;

  const submit = () => {
    for (const f of template.fields) {
      if (!values[f.key]?.trim()) {
        toast.error(`Fill in: ${f.label}`);
        return;
      }
    }
    const built = template.build(values);
    addCustomCard(deckId, built);
    toast.success(`Card added (${template.name} template)`);
    setOpen(false);
    onAdded?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileStack className="h-4 w-4" /> From template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileStack className="h-5 w-5 text-primary" /> Add card from template
          </DialogTitle>
          <DialogDescription>
            Pick a shape, fill in the blanks, get a well-formed card. Each
            template tags itself so you can filter by type later.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-3">
          {CARD_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTemplateId(t.id);
                setValues({});
              }}
              className={cn(
                "rounded-lg border p-2 text-left text-xs transition-all",
                templateId === t.id ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-primary/40",
              )}
            >
              <p className="text-sm font-semibold">{t.name}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{t.description}</p>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {template.fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={`tpl-${f.key}`}>{f.label}</Label>
              {f.multiline ? (
                <Textarea
                  id={`tpl-${f.key}`}
                  rows={3}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                />
              ) : (
                <Input
                  id={`tpl-${f.key}`}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                />
              )}
            </div>
          ))}
        </div>

        <Preview template={template} values={values} />

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" /> Cancel
          </Button>
          <Button onClick={submit}>
            <Check className="h-4 w-4" /> Add card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Preview({ template, values }: { template: typeof CARD_TEMPLATES[number]; values: Record<string, string> }) {
  const allFilled = template.fields.every((f) => values[f.key]?.trim());
  if (!allFilled) return null;
  const built = template.build(values);
  return (
    <div className="rounded-md border bg-secondary/30 p-3 text-sm">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Preview</p>
      <p className="mt-1 font-medium">{built.question}</p>
      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{built.answer}</p>
      <div className="mt-1 flex gap-1">
        {built.tags.map((t) => (
          <Badge key={t} variant="outline" className="text-[10px]">
            #{t}
          </Badge>
        ))}
      </div>
    </div>
  );
}
