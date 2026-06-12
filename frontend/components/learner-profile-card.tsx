"use client";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ARCHETYPE_LABEL, deriveProfile } from "@/lib/learner-profile";
import { useStorageVersion } from "@/lib/hooks";

export function LearnerProfileCard() {
  const version = useStorageVersion();
  const profile = useMemo(() => deriveProfile(), [version]);
  const meta = ARCHETYPE_LABEL[profile.archetype];

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b bg-gradient-to-br from-primary/15 via-accent/10 to-transparent px-4 py-3">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 230, damping: 18 }}
            className="grid h-12 w-12 place-items-center rounded-2xl bg-card text-2xl shadow-sm ring-1 ring-border"
          >
            {meta.emoji}
          </motion.div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Learner profile
            </p>
            <p className="font-display text-xl font-semibold">{meta.name}</p>
          </div>
        </div>
        <Badge variant="outline">{profile.total_reviews} reviews</Badge>
      </div>
      <CardContent className="space-y-3 p-4 text-sm">
        <p className="text-muted-foreground">{profile.archetype_reason}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {profile.preferred_mode && (
            <Tile label="Preferred mode" value={`${profile.preferred_mode.mode}`} hint={`${profile.preferred_mode.reviews} reviews`} />
          )}
          {profile.most_accurate_mode && (
            <Tile
              label="Sharpest mode"
              value={`${profile.most_accurate_mode.mode}`}
              hint={`${Math.round(profile.most_accurate_mode.accuracy * 100)}% accuracy`}
            />
          )}
          {profile.fastest_mode && (
            <Tile
              label="Fastest mode"
              value={`${profile.fastest_mode.mode}`}
              hint={`${Math.round(profile.fastest_mode.avg_ms / 1000)}s avg`}
            />
          )}
          {profile.best_hour != null && (
            <Tile
              label="Best hour"
              value={`${String(profile.best_hour).padStart(2, "0")}:00`}
              hint="when you're sharpest"
            />
          )}
        </div>
        {(profile.strongest_tags.length > 0 || profile.weakest_tags.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {profile.strongest_tags.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-success">
                  Strong topics
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {profile.strongest_tags.map((t) => (
                    <Badge key={t.tag} variant="outline" className="border-success/40 text-success">
                      #{t.tag} ({Math.round(t.accuracy * 100)}%)
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {profile.weakest_tags.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-destructive">
                  Weak topics
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {profile.weakest_tags.map((t) => (
                    <Badge key={t.tag} variant="outline" className="border-destructive/40 text-destructive">
                      #{t.tag} ({Math.round(t.accuracy * 100)}%)
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex items-start gap-2 rounded-md border bg-secondary/30 p-3 text-xs">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <p>
            <span className="font-semibold">Recommendation:</span> {meta.advice}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-md border bg-secondary/30 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-semibold capitalize leading-none">{value}</p>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}
