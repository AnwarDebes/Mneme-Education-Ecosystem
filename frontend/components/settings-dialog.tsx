"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, BellOff, CalendarDays, Download, HardDrive, Languages, Palette, RefreshCw, Settings as SettingsIcon, Trash2, Upload, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  loadNotificationSettings,
  notificationsSupported,
  requestNotificationPermission,
  saveNotificationSettings,
} from "@/lib/notifications";
import { makeBackup, restoreBackup, type BackupBlob } from "@/lib/backup";
import { clearMnemeStorage } from "@/lib/storage";
import { downloadText } from "@/lib/export";
import { buildStudyCalendar } from "@/lib/ics";
import { ShortcutsSection } from "@/components/shortcuts-section";
import { CustomCssSection } from "@/components/custom-css-section";
import { CustomAchievementsSection } from "@/components/custom-achievements-section";
import { ThemeDesigner } from "@/components/theme-designer";
import { isMuted, setMuted } from "@/lib/sound";
import { useStorageVersion } from "@/lib/hooks";
import { useThemeVariant, VARIANTS } from "@/lib/theme-variant";
import { useLocale, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [variant, setVariant] = useThemeVariant();
  const version = useStorageVersion();
  const [mute, setMute] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifHour, setNotifHour] = useState(9);
  const [perm, setPerm] = useState<NotificationPermission>("default");

  useEffect(() => {
    setMute(isMuted());
    const ns = loadNotificationSettings();
    setNotifEnabled(ns.enabled);
    setNotifHour(ns.dailyHourLocal);
    if (notificationsSupported()) setPerm(Notification.permission);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" /> Settings
          </DialogTitle>
          <DialogDescription>
            Theme, sound, and notification preferences. All saved on this device.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Theme variant</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {VARIANTS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setVariant(v.id);
                  toast.success(`Theme: ${v.label}`);
                }}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm transition-all",
                  variant === v.id
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "hover:border-primary/40",
                )}
              >
                <p className="font-medium">{v.label}</p>
                <p className="text-xs text-muted-foreground">{v.description}</p>
                {variant === v.id && (
                  <Badge variant="outline" className="text-[10px]">
                    Active
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Sound effects</p>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm">Play tones on grade</p>
              <p className="text-xs text-muted-foreground">
                Right/wrong feedback during flip and tutor modes.
              </p>
            </div>
            <Switch
              checked={!mute}
              onCheckedChange={(v) => {
                setMute(!v);
                setMuted(!v);
              }}
            />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            {notifEnabled ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
            <p className="text-sm font-semibold">Daily review reminder</p>
          </div>
          {!notificationsSupported() ? (
            <p className="rounded-md border bg-muted p-3 text-xs text-muted-foreground">
              Your browser doesn't support notifications.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm">Notify me when cards are due</p>
                  <p className="text-xs text-muted-foreground">
                    Fires once per day, after the hour you pick below. Permission:{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{perm}</code>
                  </p>
                </div>
                <Switch
                  checked={notifEnabled}
                  onCheckedChange={async (v) => {
                    if (v) {
                      const p = await requestNotificationPermission();
                      setPerm(p);
                      if (p !== "granted") {
                        toast.error("Permission denied. Enable in browser settings.");
                        return;
                      }
                    }
                    setNotifEnabled(v);
                    saveNotificationSettings({ enabled: v, dailyHourLocal: notifHour });
                  }}
                />
              </div>
              {notifEnabled && (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label htmlFor="hour">Earliest hour</Label>
                  <Select
                    value={String(notifHour)}
                    onValueChange={(v) => {
                      const h = parseInt(v, 10);
                      setNotifHour(h);
                      saveNotificationSettings({ enabled: notifEnabled, dailyHourLocal: h });
                    }}
                  >
                    <SelectTrigger id="hour" className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }).map((_, h) => (
                        <SelectItem key={h} value={String(h)}>
                          {h.toString().padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </section>

        <LocaleSection />

        <ShortcutsSection />

        <section className="space-y-2 rounded-md border p-3">
          <ThemeDesigner />
        </section>

        <CustomCssSection />

        <CustomAchievementsSection />

        <CalendarSection />

        <BackupSection />

        <ResetSection />
      </DialogContent>
    </Dialog>
  );
}

function LocaleSection() {
  const [locale, setLocale] = useLocale();
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Languages className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Language</p>
      </div>
      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <p className="text-sm">Interface language</p>
          <p className="text-xs text-muted-foreground">
            Navigation + study buttons. Card content stays in its original language.
          </p>
        </div>
        <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="es">Espanol</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}

function CalendarSection() {
  const exportIcs = () => {
    const ics = buildStudyCalendar({ hourLocal: 18, durationMin: 25 });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`mneme-study-${stamp}.ics`, "text/calendar", ics);
    toast.success("Calendar (.ics) downloaded");
  };
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Calendar export</p>
      </div>
      <div className="space-y-2 rounded-md border p-3 text-sm">
        <p>
          Download every active study plan + practice exam as an .ics file you
          can drop into Apple Calendar, Google Calendar, or Outlook.
        </p>
        <Button variant="outline" size="sm" onClick={exportIcs}>
          <Download className="h-4 w-4" /> Export .ics
        </Button>
      </div>
    </section>
  );
}

function BackupSection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const exportBackup = () => {
    const blob = makeBackup();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`mneme-backup-${stamp}.json`, "application/json", JSON.stringify(blob, null, 2));
    toast.success("Backup downloaded");
  };
  const importBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as BackupBlob;
        const result = restoreBackup(parsed);
        if (result.restored === 0) {
          toast.error("Nothing to restore", { description: result.errors.join("; ") });
          return;
        }
        toast.success(`Restored ${result.restored} keys. Reload to apply.`);
        if (typeof window !== "undefined" && window.confirm("Reload now to apply?")) {
          window.location.reload();
        }
      } catch (err: any) {
        toast.error("Invalid backup file", { description: err?.message || String(err) });
      }
    };
    reader.readAsText(file);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <HardDrive className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Backup &amp; restore</p>
      </div>
      <div className="space-y-2 rounded-md border p-3 text-sm">
        <p>
          Everything you've personalised (overrides, schedules, stats, plans,
          collections, notes, achievements) is in your browser. Snapshot it as
          a JSON file you can restore on another device.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportBackup}>
            <Download className="h-4 w-4" /> Export backup
          </Button>
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Restore from file
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importBackup(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    </section>
  );
}

function ResetSection() {
  const [phase, setPhase] = useState<"idle" | "confirm">("idle");
  const reset = () => {
    // Always auto-export the current state before nuking, so this is
    // recoverable even if the user clicks "OK" on the confirm too fast.
    try {
      const blob = makeBackup();
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadText(`mneme-pre-reset-${stamp}.json`, "application/json", JSON.stringify(blob, null, 2));
    } catch {
      toast.error("Pre-reset backup failed", { description: "Aborting reset. Try Export backup manually first." });
      return;
    }
    clearMnemeStorage();
    toast.success("All local data cleared. Reloading...");
    setTimeout(() => {
      if (typeof window !== "undefined") window.location.reload();
    }, 600);
  };
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <p className="text-sm font-semibold text-destructive">Reset all data</p>
      </div>
      <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
        <p>
          Wipes every browser-side key under the <code className="rounded bg-muted px-1.5 py-0.5 text-xs">mneme:</code> namespace:
          overrides, schedule, FSRS state, stats, achievements, plans, courses,
          collections, notes, snapshots, journal, sketches, voice memos,
          highlights, chains, variants, themes, banners, ICS calendars. Server
          decks stay; their <em>study state</em> goes back to zero.
        </p>
        <p className="text-xs text-muted-foreground">
          A backup .json file is downloaded automatically before the wipe so
          you can restore via Backup &amp; restore if you change your mind.
        </p>
        {phase === "idle" ? (
          <Button variant="outline" size="sm" onClick={() => setPhase("confirm")}>
            <Trash2 className="h-4 w-4 text-destructive" /> Reset all data
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" size="sm" onClick={reset}>
              <Trash2 className="h-4 w-4" /> Yes - download backup and reset
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPhase("idle")}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

export function SettingsTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        title="Settings"
      >
        <SettingsIcon className="h-4 w-4" />
      </Button>
      <SettingsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
