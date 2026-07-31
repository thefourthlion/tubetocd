import * as React from "react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/youtube";

export function MetaPill({
  children,
  className,
  tone = "default",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "success" | "primary";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5",
        "font-mono text-[0.65rem] font-semibold tracking-tight",
        tone === "default" &&
          "border-border bg-muted text-muted-foreground dark:bg-muted/80",
        tone === "success" && "border-success/30 bg-success/15 text-success",
        tone === "primary" &&
          "border-primary/40 bg-primary/15 text-accent-foreground dark:text-primary",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SizeMetaPills({
  mp3,
  mp4,
  estimated = true,
  className,
}: {
  mp3?: number | null;
  mp4?: number | null;
  estimated?: boolean;
  className?: string;
}) {
  const suffix = estimated ? " est." : "";
  const mp3Label = mp3 != null ? formatBytes(mp3) : "";
  const mp4Label = mp4 != null ? formatBytes(mp4) : "";
  if (!mp3Label && !mp4Label) return null;

  return (
    <>
      {mp3Label ? (
        <MetaPill className={className}>
          {mp3Label}
          {suffix} MP3
        </MetaPill>
      ) : null}
      {mp4Label ? (
        <MetaPill className={className}>
          {mp4Label}
          {suffix} MP4
        </MetaPill>
      ) : null}
    </>
  );
}

export function FilterChip({
  active,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "lw-bevel inline-flex h-7 items-center px-2.5",
        "font-mono text-[0.65rem] font-bold uppercase tracking-[0.06em]",
        active
          ? "border-primary/60 text-foreground"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Checkbox({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "h-3.5 w-3.5 shrink-0 cursor-pointer rounded-[2px] border-border",
        "accent-primary",
        className,
      )}
      {...props}
    />
  );
}
