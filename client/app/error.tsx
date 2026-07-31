"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageShell width="sm">
      <div className="flex flex-col items-center py-16 text-center animate-fade-up">
        <span className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-destructive">
          Error
        </span>
        <h2 className="mb-2 font-display text-2xl font-bold tracking-tight text-foreground">
          Something went wrong
        </h2>
        <p className="mb-6 max-w-sm text-sm text-muted-foreground">
          An unexpected error occurred. Try again.
        </p>
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </PageShell>
  );
}
