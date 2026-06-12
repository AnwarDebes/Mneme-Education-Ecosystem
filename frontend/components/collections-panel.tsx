"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  FolderOpen,
  FolderPlus,
  GraduationCap,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  addDeckToCollection,
  createCollection,
  deleteCollection,
  loadCollections,
  removeDeckFromCollection,
  renameCollection,
  type Collection,
} from "@/lib/collections";
import { loadDeckMeta } from "@/lib/deck-store";
import { useStorageVersion } from "@/lib/hooks";
import type { JobSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CollectionsPanelProps {
  jobs: JobSummary[];
}

export function CollectionsPanel({ jobs }: CollectionsPanelProps) {
  const version = useStorageVersion();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [manage, setManage] = useState<Collection | null>(null);
  useEffect(() => {
    setCollections(loadCollections());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  if (collections.length === 0 && jobs.length < 2) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-display text-2xl font-semibold tracking-tight">Collections</h2>
          {collections.length > 0 && <Badge variant="outline">{collections.length}</Badge>}
        </div>
        <NewCollectionDialog />
      </div>
      {collections.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="px-6 py-10 text-center text-sm text-muted-foreground">
            Group your decks into courses (e.g. "Bio 101", "MCAT prep"). Click
            "New collection" to make one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <CollectionCard
              key={c.id}
              collection={c}
              jobs={jobs}
              onManage={() => setManage(c)}
            />
          ))}
        </div>
      )}
      <ManageCollectionDialog
        collection={manage}
        jobs={jobs}
        onClose={() => setManage(null)}
      />
    </section>
  );
}

function CollectionCard({
  collection,
  jobs,
  onManage,
}: {
  collection: Collection;
  jobs: JobSummary[];
  onManage: () => void;
}) {
  const decks = jobs.filter((j) => collection.deck_ids.includes(j.id));
  const totalCards = decks.reduce((acc, j) => acc + j.n_cards, 0);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
    >
      <Card className="group h-full overflow-hidden">
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-20 bg-gradient-to-br opacity-70",
            collection.color || "from-violet-500/25 to-indigo-400/15",
          )}
          aria-hidden
        />
        <CardContent className="relative space-y-3 p-5">
          <div className="flex items-start justify-between">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-card shadow-sm ring-1 ring-border">
              <FolderOpen className="h-5 w-5 text-primary" />
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onManage} title="Manage">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold leading-tight">
              {collection.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              {decks.length} {decks.length === 1 ? "deck" : "decks"} - {totalCards} cards
            </p>
          </div>
          {decks.length > 0 && (
            <ul className="space-y-1 text-xs">
              {decks.slice(0, 3).map((d) => {
                const m = loadDeckMeta(d.id);
                return (
                  <li key={d.id}>
                    <Link href={`/decks/${d.id}` as any} className="hover:underline">
                      - {m.alias || d.filename}
                    </Link>
                  </li>
                );
              })}
              {decks.length > 3 && (
                <li className="text-muted-foreground">+{decks.length - 3} more</li>
              )}
            </ul>
          )}
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="flex-1" onClick={onManage}>
              Manage
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/courses/${collection.id}` as any}>
                <GraduationCap className="h-3.5 w-3.5" /> Course
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function NewCollectionDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FolderPlus className="h-4 w-4" /> New collection
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New collection</DialogTitle>
          <DialogDescription>
            Groups of decks. Think "course", "subject", or "exam".
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cname">Name</Label>
            <Input
              id="cname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="MCAT prep"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cdesc">Description (optional)</Label>
            <Input
              id="cdesc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Spring 2026"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!name.trim()) return;
              createCollection(name, desc || undefined);
              toast.success("Collection created");
              setName("");
              setDesc("");
              setOpen(false);
            }}
          >
            <Plus className="h-4 w-4" /> Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageCollectionDialog({
  collection,
  jobs,
  onClose,
}: {
  collection: Collection | null;
  jobs: JobSummary[];
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (collection) setName(collection.name);
  }, [collection]);
  if (!collection) return null;
  const members = new Set(collection.deck_ids);
  return (
    <Dialog open={!!collection} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage "{collection.name}"</DialogTitle>
          <DialogDescription>
            Add or remove decks. Rename or delete the collection.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="newname">Name</Label>
            <div className="flex gap-2">
              <Input id="newname" value={name} onChange={(e) => setName(e.target.value)} />
              <Button
                onClick={() => {
                  renameCollection(collection.id, name);
                  toast.success("Renamed");
                }}
              >
                Save
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Decks in this collection</Label>
            <div className="max-h-[300px] space-y-1.5 overflow-y-auto rounded-md border p-2">
              {jobs.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                  No decks yet.
                </p>
              ) : (
                jobs.map((j) => {
                  const meta = loadDeckMeta(j.id);
                  const inSet = members.has(j.id);
                  return (
                    <label
                      key={j.id}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/40"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={inSet}
                          onChange={() => {
                            if (inSet) removeDeckFromCollection(collection.id, j.id);
                            else addDeckToCollection(collection.id, j.id);
                          }}
                          className="h-4 w-4 rounded border-primary text-primary focus:ring-primary"
                        />
                        {meta.alias || j.filename}
                      </span>
                      <span className="text-xs text-muted-foreground">{j.n_cards}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              if (typeof window !== "undefined" && !window.confirm(`Delete "${collection.name}"? Decks stay intact.`)) return;
              deleteCollection(collection.id);
              toast.success("Collection deleted");
              onClose();
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete collection
          </Button>
          <Button onClick={onClose}>
            <X className="h-4 w-4" /> Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
