import * as React from "react";
import { cn } from "@/lib/utils";

type PanelProps = React.HTMLAttributes<HTMLDivElement> & {
  inset?: boolean;
  glow?: boolean;
  padded?: boolean;
};

export function Panel({
  className,
  inset = false,
  glow = false,
  padded = true,
  children,
  ...props
}: PanelProps) {
  return (
    <div
      className={cn(
        inset ? "lw-inset" : "lw-window",
        "text-card-foreground",
        padded && "p-3 sm:p-4",
        glow && "border-primary/50",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-3 flex flex-col gap-1", className)} {...props} />
  );
}

export function PanelTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "font-mono text-[0.72rem] font-bold uppercase tracking-[0.1em] text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function PanelDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("font-mono text-[0.7rem] text-muted-foreground", className)}
      {...props}
    />
  );
}
