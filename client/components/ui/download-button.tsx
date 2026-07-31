"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Download, Film, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_DOWNLOAD_PRESET,
  DOWNLOAD_PRESETS,
  DownloadPreset,
  presetLabel,
} from "@/lib/download-presets";
import { cn } from "@/lib/utils";

const PRESET_STORAGE_KEY = "y2m-download-preset";

const LEGACY_PRESET_IDS: Record<string, string> = {
  "mp3-best": "mp3",
  "mp3-192": "mp3",
  "mp3-128": "mp3",
  "m4a-best": "mp3",
  "opus-best": "mp3",
  "mp4-1080": "mp4",
  "mp4-720": "mp4",
  "mp4-480": "mp4",
};

function readStoredPreset(): DownloadPreset {
  if (typeof window === "undefined") return DEFAULT_DOWNLOAD_PRESET;
  try {
    const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
    const id = LEGACY_PRESET_IDS[raw || ""] || raw;
    const found = DOWNLOAD_PRESETS.find((p) => p.id === id);
    return found || DEFAULT_DOWNLOAD_PRESET;
  } catch {
    return DEFAULT_DOWNLOAD_PRESET;
  }
}

function storePreset(preset: DownloadPreset) {
  try {
    window.localStorage.setItem(PRESET_STORAGE_KEY, preset.id);
  } catch {
    // ignore
  }
}

type Props = {
  loading?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "soft" | "outline" | "secondary";
  /** Compact label like "MP3" instead of "Download MP3" */
  compact?: boolean;
  className?: string;
  count?: number;
  onDownload: (preset: DownloadPreset) => void | Promise<void>;
};

export function DownloadButton({
  loading,
  disabled,
  size = "sm",
  variant = "soft",
  compact = false,
  className,
  count = 1,
  onDownload,
}: Props) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<DownloadPreset>(DEFAULT_DOWNLOAD_PRESET);
  const [menuPos, setMenuPos] = useState<{
    top?: number;
    bottom?: number;
    right: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPreset(readStoredPreset());
  }, []);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setMenuPos(null);
      return;
    }
    const rect = rootRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 160;
    setMenuPos({
      right: Math.max(8, window.innerWidth - rect.right),
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const runDownload = async (next: DownloadPreset) => {
    setPreset(next);
    storePreset(next);
    setOpen(false);
    await onDownload(next);
  };

  const primaryLabel = (() => {
    if (loading) return "Downloading…";
    if (count > 1) {
      return compact
        ? `${preset.format.toUpperCase()} ×${count}`
        : `Download ${count} (${preset.label})`;
    }
    return compact ? preset.format.toUpperCase() : `Download ${preset.label}`;
  })();

  const audioPresets = DOWNLOAD_PRESETS.filter((p) => p.kind === "audio");
  const videoPresets = DOWNLOAD_PRESETS.filter((p) => p.kind === "video");

  const menu =
    open &&
    menuPos &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={menuRef}
        style={{
          position: "fixed",
          right: menuPos.right,
          top: menuPos.top,
          bottom: menuPos.bottom,
        }}
        className={cn(
          "z-[80] w-60 overflow-hidden rounded-xl border border-border/70",
          "bg-card shadow-panel dark:shadow-panel-dark animate-fade-up",
        )}
      >
        <div className="flex items-center gap-1.5 border-b border-border/60 px-3 py-2">
          <Music2 size={12} className="text-muted-foreground" />
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Audio
          </p>
        </div>
        <ul className="m-0 list-none p-1">
          {audioPresets.map((item) => (
            <PresetItem
              key={item.id}
              preset={item}
              active={preset.id === item.id}
              onSelect={() => void runDownload(item)}
            />
          ))}
        </ul>
        <div className="flex items-center gap-1.5 border-y border-border/60 px-3 py-2">
          <Film size={12} className="text-muted-foreground" />
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Video
          </p>
        </div>
        <ul className="m-0 list-none p-1">
          {videoPresets.map((item) => (
            <PresetItem
              key={item.id}
              preset={item}
              active={preset.id === item.id}
              onSelect={() => void runDownload(item)}
            />
          ))}
        </ul>
      </div>,
      document.body,
    );

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <div className="inline-flex overflow-hidden rounded-md shadow-sm">
        <Button
          size={size}
          variant={variant}
          loading={loading}
          disabled={disabled}
          leftIcon={!loading ? <Download size={14} /> : undefined}
          className="rounded-r-none border-r-0"
          onClick={() => void runDownload(preset)}
        >
          {primaryLabel}
        </Button>
        <Button
          size={size === "lg" ? "md" : size}
          variant={variant}
          disabled={disabled || loading}
          aria-label="Choose format"
          aria-expanded={open}
          className={cn(
            "rounded-l-none px-2",
            size === "sm" && "h-8 w-8",
            size === "md" && "h-10 w-9",
            size === "lg" && "h-12 w-10",
          )}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown size={14} />
        </Button>
      </div>
      {menu}
    </div>
  );
}

function PresetItem({
  preset,
  active,
  onSelect,
}: {
  preset: DownloadPreset;
  active?: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left",
          "transition-colors hover:bg-primary/10",
          active && "bg-primary/10",
          preset.default && !active && "bg-primary/5",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">
            {presetLabel(preset)}
            {preset.default ? (
              <span className="ml-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
                Default
              </span>
            ) : null}
          </span>
          <span className="block text-xs text-muted-foreground">
            {preset.description}
          </span>
        </span>
      </button>
    </li>
  );
}
