"use client";
// A11y: hidden-until-focused "Skip to main content" anchor at the very top
// of the DOM. Lets keyboard users bypass the nav.

export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only absolute left-2 top-2 z-50 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground focus:not-sr-only focus:ring-2 focus:ring-ring"
    >
      Skip to main content
    </a>
  );
}
