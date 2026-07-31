import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function PageShell({
  children,
  className,
  width = "md",
}: {
  children: React.ReactNode;
  className?: string;
  width?: "sm" | "md" | "lg" | "xl";
}) {
  // Only auth-style forms stay narrow; everything else fills the desk window.
  const widths = {
    sm: "mx-auto max-w-lg",
    md: "w-full",
    lg: "w-full",
    xl: "w-full",
  };

  return (
    <section
      className={cn(
        "relative flex w-full flex-1 flex-col gap-2.5 p-2 sm:p-3",
        widths[width],
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  action,
  className,
  align = "left",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={cn(
        "lw-window animate-fade-up flex flex-col gap-2 px-3 py-2.5",
        align === "center" && "items-center text-center",
        action && "sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-col gap-1",
          align === "center" && "items-center",
        )}
      >
        {eyebrow && (
          <span className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
            {eyebrow}
          </span>
        )}
        <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-xl font-mono text-[0.7rem] text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  className,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("lw-inset animate-fade-up px-4 py-10 text-center", className)}
    >
      <p className="font-mono text-[0.75rem] font-bold uppercase tracking-[0.08em] text-foreground">
        {title}
      </p>
      <p className="mx-auto mt-1.5 max-w-sm font-mono text-[0.7rem] text-muted-foreground">
        {description}
      </p>
      {actionLabel && actionHref && (
        <div className="mt-4 flex justify-center">
          <Link href={actionHref}>
            <Button variant="primary" size="md">
              {actionLabel}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

export function LoadingBlock({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="lw-inset flex flex-col items-center justify-center gap-2.5 py-12">
      <span
        className="h-4 w-4 rounded-full border-2 border-primary border-r-transparent animate-spin-wire"
        aria-hidden
      />
      <p className="animate-soft-pulse font-mono text-[0.7rem] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
