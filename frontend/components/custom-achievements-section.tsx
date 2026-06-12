"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Award, Plus, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { checkCustom, createCustom, deleteCustom, loadCustom, type CustomAchievement, type CustomMetric } from "@/lib/custom-achievements";
import { useStorageVersion } from "@/lib/hooks";
import { toast } from "sonner";

const METRIC_LABELS: Record<CustomMetric, string> = {
  total_reviews: "Total reviews",
  current_streak: "Current streak (days)",
  minutes: "Total minutes studied",
  days_studied: "Days studied",
};

export function CustomAchievementsSection() {
  const version = useStorageVersion();
  const [items, setItems] = useState<CustomAchievement[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [metric, setMetric] = useState<CustomMetric>("total_reviews");
  const [threshold, setThreshold] = useState(100);
  const [icon, setIcon] = useState("🏆");

  useEffect(() => {
    setItems(loadCustom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const submit = () => {
    if (!name.trim()) {
      toast.error("Pick a name");
      return;
    }
    createCustom(name, metric, threshold, icon);
    setName("");
    setShowForm(false);
    toast.success("Custom achievement created");
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-semibold">My achievements</p>
            <Badge variant="outline" className="text-[10px]">
              {items.length}
            </Badge>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowForm((s) => !s)}>
            <Plus className="h-3.5 w-3.5" /> New
          </Button>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-2 rounded-md border bg-secondary/30 p-3"
            >
              <div className="grid grid-cols-[auto_1fr] gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Icon</Label>
                  <Input value={icon} onChange={(e) => setIcon(e.target.value)} className="w-16 text-center" maxLength={2} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="MCAT challenger" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Metric</Label>
                  <Select value={metric} onValueChange={(v) => setMetric(v as CustomMetric)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(METRIC_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Threshold</Label>
                  <Input
                    type="number"
                    min="1"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={submit}>
                  <Sparkles className="h-3.5 w-3.5" /> Create
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ul className="space-y-1.5">
          {items.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              No custom achievements yet. Make one to gamify a personal target.
            </p>
          ) : (
            items.map((a) => {
              const { progress, achieved } = checkCustom(a);
              const pct = Math.min(100, Math.round((progress / a.threshold) * 100));
              return (
                <li
                  key={a.id}
                  className={`rounded-md border bg-card p-2 ${achieved ? "border-success/40 bg-success/5" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{a.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between">
                        <p className="text-sm font-medium">{a.name}</p>
                        <span className="text-[10px] text-muted-foreground">
                          {progress} / {a.threshold}
                        </span>
                      </div>
                      <Progress value={pct} className="mt-1 h-1.5" />
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {METRIC_LABELS[a.metric]}
                        {achieved && " - achieved"}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => {
                        deleteCustom(a.id);
                        toast.success("Achievement removed");
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
