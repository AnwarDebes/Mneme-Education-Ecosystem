"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { useStorageVersion } from "@/lib/hooks";
import { ThemeToggle } from "@/components/theme-toggle";
import { SoundToggle } from "@/components/sound-toggle";
import { SettingsTrigger } from "@/components/settings-dialog";
import { VoiceCommandToggle } from "@/components/voice-command";

const NAV_ITEMS = [
  { href: "/library", key: "nav.library" },
  { href: "/today", key: "nav.today" },
  { href: "/insights", key: "nav.insights" },
  { href: "/feed", key: "nav.feed" },
  { href: "/mistakes", key: "nav.mistakes" },
  { href: "/search", key: "nav.search" },
  { href: "/learn", key: "nav.learn" },
  { href: "/help", key: "nav.help" },
  { href: "/cards", key: "nav.cards" },
  { href: "/generator", key: "nav.generate" },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  useStorageVersion();
  return (
    <header
      role="banner"
      className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="container flex h-16 items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight"
        >
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
            <Brain className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>mneme</span>
          <span className="ml-1 hidden rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground md:inline">
            alpha
          </span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === "/library" && pathname.startsWith("/decks"));
            return (
              <Link
                key={item.href}
                href={item.href as any}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {t(item.key)}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
                );
              }
            }}
            className="ml-2 hidden items-center gap-2 rounded-md border bg-secondary/40 px-2 py-1 text-xs text-muted-foreground hover:text-foreground lg:flex"
            title="Open command palette (Cmd/Ctrl+K)"
          >
            <Search className="h-3.5 w-3.5" />
            Search
            <kbd className="rounded border bg-card px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
          </button>
          <div className="ml-1 flex items-center gap-0">
            <VoiceCommandToggle />
            <SoundToggle />
            <SettingsTrigger />
            <ThemeToggle />
          </div>
        </nav>
        <div className="flex items-center md:hidden">
          <VoiceCommandToggle />
          <SoundToggle />
          <SettingsTrigger />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
