"use client";
import { useEffect, useMemo, useState } from "react";
import { Snowflake, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { consumeFreeze, loadFreezes, syncFreezesFromXP } from "@/lib/streak-freeze";
import { useStorageVersion } from "@/lib/hooks";
import { loadXP } from "@/lib/xp";
import { toast } from "sonner";

export function StreakFreezeCard() {
  const version = useStorageVersion();
  const [state, setState] = useState(loadFreezes());

  useEffect(() => {
    // Sync milestones whenever XP changes.
    const xp = loadXP();
    setState(syncFreezesFromXP(xp.total));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const use = () => {
    if (!consumeFreeze()) {
      toast.error("Nothing to consume right now");
      return;
    }
    toast.success("Streak frozen for today; you can skip without losing it");
  };

  const xpForNext = useMemo(() => {
    const xp = loadXP().total;
    const milestones = [200, 500, 1000, 2000, 4000];
    const next = milestones.find((m) => xp < m);
    return next ? next - xp : 0;
  }, [version]);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Snowflake className="h-4 w-4 text-sky-500" />
            <p className="text-sm font-semibold">Streak freezes</p>
          </div>
          <Badge variant="outline">{state.available} available</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Earn a freeze at every XP milestone (200, 500, 1000, 2000, 4000).
          Spend one to skip a day without breaking your streak.
        </p>
        {xpForNext > 0 && (
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {xpForNext} XP to next freeze
          </p>
        )}
        <Button onClick={use} disabled={state.available === 0} size="sm">
          <Sparkles className="h-3.5 w-3.5" /> Use a freeze
        </Button>
      </CardContent>
    </Card>
  );
}
