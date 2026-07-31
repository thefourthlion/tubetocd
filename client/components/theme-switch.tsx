"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { MoonFilledIcon, SunFilledIcon } from "@/components/icons";

export function ThemeSwitch({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-lg",
        "border border-border/70 bg-card text-muted-foreground",
        "transition-all duration-200 ease-apple",
        "hover:border-primary/35 hover:text-foreground hover:shadow-wire",
        "active:scale-95",
        className,
      )}
    >
      <span className="relative h-4 w-4">
        <SunFilledIcon
          size={16}
          className={cn(
            "absolute inset-0 transition-all duration-300 ease-apple",
            isDark
              ? "rotate-90 scale-0 opacity-0"
              : "rotate-0 scale-100 opacity-100",
          )}
        />
        <MoonFilledIcon
          size={16}
          className={cn(
            "absolute inset-0 transition-all duration-300 ease-apple",
            isDark
              ? "rotate-0 scale-100 opacity-100"
              : "-rotate-90 scale-0 opacity-0",
          )}
        />
      </span>
    </button>
  );
}
