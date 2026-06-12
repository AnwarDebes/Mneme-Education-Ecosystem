"use client";
import Link from "next/link";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  cta?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, cta, className }: EmptyStateProps) {
  const button = cta ? (
    cta.href ? (
      <Button asChild>
        <Link href={cta.href as any}>{cta.label}</Link>
      </Button>
    ) : (
      <Button onClick={cta.onClick}>{cta.label}</Button>
    )
  ) : null;
  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <Icon className="h-7 w-7" />
        </span>
        <div className="space-y-1">
          <p className="font-display text-xl font-semibold">{title}</p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
        </div>
        {button}
      </CardContent>
    </Card>
  );
}
