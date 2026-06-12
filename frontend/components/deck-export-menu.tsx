"use client";
import { useState } from "react";
import { Download, FileJson, FileSpreadsheet, FileText, Link2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShareDeckDialog } from "@/components/share-deck-dialog";
import { apkgUrl } from "@/lib/api";
import {
  cardsToCSV,
  cardsToJSON,
  cardsToTSV,
  downloadText,
} from "@/lib/export";
import type { ResolvedCard } from "@/lib/cards";
import { toast } from "sonner";

interface DeckExportMenuProps {
  deckId: string;
  deckName: string;
  cards: ResolvedCard[];
}

export function DeckExportMenu({ deckId, deckName, cards }: DeckExportMenuProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const base = deckName.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase() || "deck";
  const onCsv = () => {
    downloadText(`${base}.csv`, "text/csv", cardsToCSV(cards));
    toast.success("CSV downloaded");
  };
  const onTsv = () => {
    downloadText(`${base}.tsv`, "text/tab-separated-values", cardsToTSV(cards));
    toast.success("TSV (Quizlet-compatible) downloaded");
  };
  const onJson = () => {
    downloadText(`${base}.json`, "application/json", cardsToJSON(cards));
    toast.success("JSON downloaded");
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" /> Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Export deck</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href={apkgUrl(deckId)} download>
              <Package className="h-4 w-4" /> Anki package (.apkg)
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onCsv}>
            <FileSpreadsheet className="h-4 w-4" /> CSV
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onTsv}>
            <FileText className="h-4 w-4" /> TSV (Quizlet)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onJson}>
            <FileJson className="h-4 w-4" /> JSON
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setShareOpen(true)}>
            <Link2 className="h-4 w-4" /> Share URL
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ShareDeckDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        deckName={deckName}
        cards={cards.map((c) => ({
          question: c.question,
          answer: c.answer,
          tags: [...c.tags, ...c.customTags],
          difficulty: c.effective_difficulty || undefined,
          source_fact: c.source_fact || undefined,
        }))}
      />
    </>
  );
}
