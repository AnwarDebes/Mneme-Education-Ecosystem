import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { MobileNav } from "@/components/mobile-nav";
import { OnboardingDialog } from "@/components/onboarding-dialog";
import { CommandPaletteProvider } from "@/components/command-palette";
import { ShortcutsOverlay } from "@/components/shortcuts-overlay";
import { AppBoot } from "@/components/app-boot";
import { QuickCaptureFab } from "@/components/quick-capture-fab";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { SkipLink } from "@/components/skip-link";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg" },
  title: {
    default: "mneme - local-first AI flashcards",
    template: "%s - mneme",
  },
  description:
    "Drop a textbook chapter in, get an Anki deck out. mneme is a local-first AI flashcard generator: all processing runs on your machine, no cloud API, no per-card cost.",
  keywords: [
    "Anki",
    "flashcards",
    "spaced repetition",
    "FSRS",
    "Ollama",
    "local AI",
    "study",
  ],
  authors: [{ name: "Anwar (University of Agder)" }],
  creator: "Anwar",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1019" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppBoot />
          <ServiceWorkerRegister />
          <CommandPaletteProvider>
            <SkipLink />
            <div className="flex min-h-screen flex-col pb-14 md:pb-0">
              <SiteNav />
              <main id="main-content" className="flex-1">{children}</main>
              <SiteFooter />
            </div>
            <MobileNav />
            <OnboardingDialog />
            <QuickCaptureFab />
            <ShortcutsOverlay />
          </CommandPaletteProvider>
          <Toaster richColors closeButton position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
