import Link from "next/link";

export function SiteFooter() {
  return (
    <footer role="contentinfo" className="border-t border-border/60 bg-background/60">
      <div className="container flex flex-col items-center justify-between gap-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <div>
          <span className="font-medium text-foreground">mneme</span>
          {" "}- local-first AI flashcard generator. University of Agder.
        </div>
        <div className="flex items-center gap-4">
          <Link href="/about" className="hover:text-foreground">About</Link>
          <a
            href="https://github.com/AnwarDebes/Mneme-Education-Ecosystem"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-foreground"
          >
            GitHub
          </a>
          <span className="text-xs">MIT licensed</span>
        </div>
      </div>
    </footer>
  );
}
