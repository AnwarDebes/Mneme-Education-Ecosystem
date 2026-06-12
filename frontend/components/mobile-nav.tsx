"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  Home,
  Library as LibraryIcon,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { useStorageVersion } from "@/lib/hooks";

const MOBILE_NAV = [
  { href: "/", key: "nav.home", icon: Home },
  { href: "/library", key: "nav.library", icon: LibraryIcon },
  { href: "/today", key: "nav.today", icon: CalendarDays },
  { href: "/generator", key: "nav.generate", icon: Sparkles },
  { href: "/study", key: "nav.study", icon: BookOpen },
];

export function MobileNav() {
  const pathname = usePathname();
  useStorageVersion();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
    >
      <ul className="grid grid-cols-5 gap-0.5 p-1.5">
        {MOBILE_NAV.map(({ href, key, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <li key={href}>
              <Link
                href={href as any}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-[10px]",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-md transition-colors",
                    active ? "bg-primary/10" : "bg-transparent",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
