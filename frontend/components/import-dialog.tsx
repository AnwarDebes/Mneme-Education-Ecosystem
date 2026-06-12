"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  FileJson,
  FileSpreadsheet,
  FileText,
  Link2,
  Loader2,
  Package,
  Upload,
} from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  decodeShare,
  parseDelimited,
  parseJSON,
  postImport,
  postImportApkg,
  type ParsedCard,
} from "@/lib/import";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Tab = "apkg" | "csv" | "json" | "share";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "apkg", label: "Anki .apkg", icon: Package },
  { id: "csv", label: "CSV / TSV", icon: FileSpreadsheet },
  { id: "json", label: "JSON", icon: FileJson },
  { id: "share", label: "Shared URL", icon: Link2 },
];

export function ImportDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("apkg");
  const [filename, setFilename] = useState("Imported deck");
  const [pending, setPending] = useState(false);

  // CSV / TSV state
  const [delim, setDelim] = useState<"," | "\t">(",");
  const [csvText, setCsvText] = useState("");

  // JSON state
  const [jsonText, setJsonText] = useState("");

  // Shared URL state
  const [shareUrl, setShareUrl] = useState("");

  // .apkg state
  const [apkgFile, setApkgFile] = useState<File | null>(null);

  const reset = () => {
    setCsvText("");
    setJsonText("");
    setShareUrl("");
    setApkgFile(null);
    setFilename("Imported deck");
    setDelim(",");
  };

  const submit = async () => {
    setPending(true);
    try {
      let parsedCards: ParsedCard[] | null = null;
      let nameOverride: string | undefined;

      if (tab === "apkg") {
        if (!apkgFile) {
          toast.error("Pick an .apkg file");
          return;
        }
        const job = await postImportApkg(apkgFile);
        toast.success(`Imported ${job.n_cards} cards`);
        router.push(`/decks/${job.id}` as any);
        setOpen(false);
        return;
      }

      if (tab === "csv") {
        if (!csvText.trim()) {
          toast.error("Paste some CSV/TSV first");
          return;
        }
        const result = parseDelimited(csvText, delim);
        if (result.errors.length > 0 && result.cards.length === 0) {
          toast.error(`Could not parse: ${result.errors[0]}`);
          return;
        }
        parsedCards = result.cards;
        if (result.errors.length > 0) {
          toast.warning(`Skipped ${result.errors.length} bad line${result.errors.length === 1 ? "" : "s"}`);
        }
      } else if (tab === "json") {
        if (!jsonText.trim()) {
          toast.error("Paste some JSON first");
          return;
        }
        const result = parseJSON(jsonText);
        if (result.errors.length > 0 && result.cards.length === 0) {
          toast.error(`Could not parse: ${result.errors[0]}`);
          return;
        }
        parsedCards = result.cards;
      } else if (tab === "share") {
        if (!shareUrl.trim()) {
          toast.error("Paste a share URL first");
          return;
        }
        const hash = shareUrl.split("#")[1] || shareUrl.trim();
        const blob = hash.startsWith("deck=") ? hash.slice("deck=".length) : hash;
        const decoded = decodeShare(blob);
        if (!decoded) {
          toast.error("That URL doesn't look like a mneme share link");
          return;
        }
        parsedCards = decoded.cards;
        nameOverride = decoded.name;
      }

      if (!parsedCards || parsedCards.length === 0) {
        toast.error("No cards found in that input");
        return;
      }
      const job = await postImport(nameOverride || filename, parsedCards);
      toast.success(`Imported ${job.n_cards} cards`);
      router.push(`/decks/${job.id}` as any);
      setOpen(false);
      reset();
    } catch (err: any) {
      const msg = err?.message ? String(err.message) : String(err);
      toast.error("Import failed", { description: msg });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : (setOpen(false), reset()))}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4" /> Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" /> Import a deck
          </DialogTitle>
          <DialogDescription>
            Bring decks in from Anki, Quizlet, or a shared mneme link. Cards land in
            your library as a regular deck.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="grid w-full grid-cols-4">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="text-xs sm:text-sm">
                <t.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="apkg" className="space-y-3">
            <div className="rounded-lg border border-dashed bg-muted/40 p-6 text-center">
              {apkgFile ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <Package className="h-5 w-5 text-primary" />
                  <span className="font-medium">{apkgFile.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => setApkgFile(null)}>
                    change
                  </Button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center gap-2">
                  <Package className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm">Pick a .apkg file from Anki</p>
                  <p className="text-xs text-muted-foreground">
                    First two fields become Question and Answer.
                  </p>
                  <input
                    type="file"
                    accept=".apkg,application/zip"
                    className="hidden"
                    onChange={(e) => setApkgFile(e.target.files?.[0] ?? null)}
                  />
                  <Button asChild variant="outline" size="sm">
                    <span>Choose file</span>
                  </Button>
                </label>
              )}
            </div>
          </TabsContent>

          <TabsContent value="csv" className="space-y-3">
            <div className="flex items-center gap-2 text-xs">
              <p className="text-muted-foreground">Delimiter:</p>
              <button
                onClick={() => setDelim(",")}
                className={cn(
                  "rounded border px-2 py-0.5",
                  delim === "," ? "border-primary bg-primary/10 text-primary" : "border-border",
                )}
              >
                Comma (.csv)
              </button>
              <button
                onClick={() => setDelim("\t")}
                className={cn(
                  "rounded border px-2 py-0.5",
                  delim === "\t" ? "border-primary bg-primary/10 text-primary" : "border-border",
                )}
              >
                Tab (.tsv, Quizlet)
              </button>
            </div>
            <Textarea
              rows={9}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={"question,answer,tags,difficulty\nWhat is H2O?,Water,chem|basic,easy"}
              className="font-mono text-xs"
            />
          </TabsContent>

          <TabsContent value="json" className="space-y-3">
            <Textarea
              rows={9}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder={'[\n  {"question": "What is 2+2?", "answer": "4"},\n  {"question": "Capital of France?", "answer": "Paris", "tags": ["geography"]}\n]'}
              className="font-mono text-xs"
            />
          </TabsContent>

          <TabsContent value="share" className="space-y-3">
            <Label htmlFor="share-url">Paste a mneme share URL</Label>
            <Input
              id="share-url"
              value={shareUrl}
              onChange={(e) => setShareUrl(e.target.value)}
              placeholder="https://...#deck=eyJ..."
            />
            <p className="text-xs text-muted-foreground">
              Share URLs encode the deck in the URL fragment so they never touch a server.
            </p>
          </TabsContent>
        </Tabs>

        {tab !== "apkg" && tab !== "share" && (
          <div className="space-y-1">
            <Label htmlFor="import-filename">Deck name</Label>
            <Input
              id="import-filename"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
