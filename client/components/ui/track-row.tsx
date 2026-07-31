import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type TrackRowProps = {
  selected?: boolean;
  checkbox?: React.ReactNode;
  thumb?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  href?: string;
};

export function TrackRow({
  selected,
  checkbox,
  thumb,
  children,
  actions,
  className,
}: TrackRowProps) {
  return (
    <li
      className={cn(
        "group flex gap-2.5 rounded-[3px] border p-2 transition-colors duration-150",
        selected
          ? "border-primary/50 bg-primary/[0.12]"
          : "border-border/70 bg-card hover:border-border",
        className,
      )}
    >
      {checkbox && (
        <div className="flex shrink-0 items-start pt-1">{checkbox}</div>
      )}
      {thumb}
      <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2 self-center">
          {actions}
        </div>
      )}
    </li>
  );
}

export function MediaThumb({
  src,
  alt = "",
  href,
  className,
}: {
  src: string | null;
  alt?: string;
  href?: string;
  className?: string;
}) {
  const base = cn(
    "shrink-0 overflow-hidden rounded-[3px] object-cover",
    "ring-1 ring-border",
    className || "h-14 w-20",
  );

  const inner = src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={cn(base, "block")} />
  ) : (
    <div
      className={cn(
        base,
        "flex items-center justify-center bg-muted text-muted-foreground",
      )}
      aria-hidden
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5.14v14l11-7-11-7z" />
      </svg>
    </div>
  );

  if (!href) return inner;

  return (
    <Link
      href={href}
      className="shrink-0 overflow-hidden rounded-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {inner}
    </Link>
  );
}
