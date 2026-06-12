"use client";
import { useEffect } from "react";
import Link from "next/link";
import { AlertOctagon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RouteError({ error, reset }: ErrorProps) {
  useEffect(() => {
    if (typeof console !== "undefined") {
      console.error("[mneme] route boundary caught:", error);
    }
  }, [error]);

  return (
    <div className="container py-16">
      <Card className="mx-auto max-w-xl border-destructive/40 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertOctagon className="h-5 w-5" /> Something broke on this page
          </CardTitle>
          <CardDescription>
            Your data is safe in local storage; only this view crashed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
            {error.message}
            {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => reset()}>
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
            <Button variant="outline" asChild>
              <Link href={"/library" as any}>Back to library</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
