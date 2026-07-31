import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page";

export default function NotFound() {
  return (
    <PageShell width="sm">
      <div className="flex flex-col items-center py-16 text-center animate-fade-up">
        <span className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          404
        </span>
        <h1 className="mb-2 font-display text-3xl font-bold tracking-tight text-foreground">
          Page not found
        </h1>
        <p className="mb-6 max-w-sm text-sm text-muted-foreground">
          That route doesn’t exist — or it moved.
        </p>
        <Link href="/">
          <Button>Go home</Button>
        </Link>
      </div>
    </PageShell>
  );
}
