"use client";
import { useMemo } from "react";
import { renderRich, looksLikeRich } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

interface RichTextProps {
  text: string;
  className?: string;
  as?: "p" | "span" | "div";
}

export function RichText({ text, className, as = "p" }: RichTextProps) {
  const html = useMemo(() => renderRich(text), [text]);
  // If the text has no rich markup at all, fall back to a plain element so
  // the dom is simpler and a11y tools see the raw string.
  if (!looksLikeRich(text)) {
    if (as === "span") return <span className={className}>{text}</span>;
    if (as === "div") return <div className={className}>{text}</div>;
    return <p className={className}>{text}</p>;
  }
  if (as === "span") {
    return (
      <span className={cn(className)} dangerouslySetInnerHTML={{ __html: html }} />
    );
  }
  if (as === "div") {
    return <div className={cn(className)} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <p className={cn(className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
