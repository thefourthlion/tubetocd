"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DeskWindow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("lw-window", className)}>{children}</div>;
}

export function DeskTitleBar({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="lw-titlebar flex items-center gap-2 px-2.5 py-1.5">
      <span className="flex gap-1.5" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[inset_0_1px_0_hsl(0_0%_100%/0.6)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/35" />
        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/35" />
      </span>
      <p className="truncate font-mono text-[0.7rem] font-bold uppercase tracking-[0.1em] text-foreground">
        {title}
      </p>
      {subtitle && (
        <p className="truncate font-mono text-[0.68rem] text-muted-foreground">
          {subtitle}
        </p>
      )}
      <div className="ml-auto flex items-center gap-1.5">{right}</div>
    </div>
  );
}

/** Amber notice strip — LimeWire's "official communications" band. */
export function DeskStrip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "lw-strip flex items-center gap-2 px-2.5 py-1 font-mono text-[0.68rem] font-semibold",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DeskPaneLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "px-2 pb-1 pt-2 font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

type DeskButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  active?: boolean;
};

export function DeskButton({
  icon,
  active,
  className,
  children,
  ...props
}: DeskButtonProps) {
  return (
    <button
      type="button"
      data-active={active ? "true" : undefined}
      className={cn(
        "lw-bevel inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5",
        "font-mono text-[0.7rem] font-bold uppercase tracking-[0.06em] text-foreground",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        active && "border-primary/60 text-primary",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

/** Big stacked action button like LimeWire's Download / Browse Host row. */
export function DeskActionButton({
  icon,
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "lw-bevel group flex min-w-[4.5rem] flex-col items-center gap-1 px-3 py-2",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <span className="text-primary transition-transform group-active:translate-y-px">
        {icon}
      </span>
      <span className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.08em] text-foreground">
        {label}
      </span>
    </button>
  );
}

export function DeskTab({
  active,
  icon,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button type="button" className="lw-tab" data-active={active} {...props}>
      {icon}
      {children}
    </button>
  );
}

const STARS = [1, 2, 3, 4, 5];

function starLabel(stars: number) {
  return `${stars} star${stars === 1 ? "" : "s"}`;
}

/**
 * Five-star quality column, LimeWire's result confidence indicator — here it
 * holds the signed-in user's own rating. With `onRate` the stars become
 * clickable: hovering previews a score, clicking commits it, and clicking the
 * current score again clears the rating. Without it they are read-only.
 */
export function QualityStars({
  score,
  onRate,
  label,
}: {
  score: number | null;
  onRate?: (stars: number) => void;
  /** Names the row being rated for screen readers. */
  label?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const rating = score == null ? 0 : Math.max(0, Math.min(5, Math.round(score)));

  if (!onRate) {
    return (
      <span
        className="inline-flex gap-[1px] text-[0.6rem] leading-none"
        title={rating ? `${starLabel(rating)} of 5` : "Not rated"}
      >
        {STARS.map((value) => (
          <span
            key={value}
            className={
              value <= rating ? "text-amber-500" : "text-muted-foreground/30"
            }
          >
            ★
          </span>
        ))}
      </span>
    );
  }

  const preview = hovered ?? rating;

  return (
    <span
      role="radiogroup"
      aria-label={label ?? "Quality rating"}
      className="inline-flex gap-[1px] text-[0.62rem] leading-none"
      onMouseLeave={() => setHovered(null)}
      onKeyDown={(event) => {
        // Keep Enter/Space and the arrows from reaching the row, which would
        // start playback or move the table selection.
        if (event.key === "Enter" || event.key === " ") {
          event.stopPropagation();
          return;
        }
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        event.stopPropagation();
        const next =
          event.key === "ArrowRight"
            ? Math.min(5, rating + 1)
            : Math.max(0, rating - 1);
        if (next !== rating) onRate(next);
      }}
    >
      {STARS.map((value) => {
        const clears = value === rating;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={clears}
            aria-label={
              clears ? "Clear rating" : `Rate ${starLabel(value)}`
            }
            title={clears ? "Click to clear rating" : `Rate ${starLabel(value)}`}
            tabIndex={value === (rating || 1) ? 0 : -1}
            className={cn(
              "cursor-pointer transition-colors",
              value <= preview
                ? hovered
                  ? "text-amber-400"
                  : "text-amber-500"
                : "text-muted-foreground/30 hover:text-amber-500/50",
            )}
            onMouseEnter={() => setHovered(value)}
            onFocus={() => setHovered(value)}
            onBlur={() => setHovered(null)}
            onDoubleClick={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onRate(clears ? 0 : value);
            }}
          >
            ★
          </button>
        );
      })}
    </span>
  );
}
