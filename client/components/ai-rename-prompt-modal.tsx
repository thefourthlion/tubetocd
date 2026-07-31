"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

type AiRenamePromptModalProps = {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (instructions: string) => void;
};

/**
 * Asks whether to add custom naming instructions before AI rename runs.
 * Empty instructions keeps the default Artist - Title style.
 */
export function AiRenamePromptModal({
  open,
  busy,
  onClose,
  onConfirm,
}: AiRenamePromptModalProps) {
  const [mounted, setMounted] = useState(false);
  const [instructions, setInstructions] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setInstructions("");
    const t = window.setTimeout(() => areaRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-background/70 p-3 backdrop-blur-sm"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="lw-window animate-fade-up flex w-full max-w-md flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lw-titlebar flex items-center gap-2 px-2.5 py-1.5">
          <Sparkles size={12} className="shrink-0 text-primary" />
          <p
            id={titleId}
            className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.1em] text-foreground"
          >
            AI auto name
          </p>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
            className="lw-bevel ml-auto flex h-6 w-6 items-center justify-center text-foreground disabled:opacity-45"
          >
            <X size={12} />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-3">
          <p className="font-mono text-[0.72rem] leading-relaxed text-muted-foreground">
            Want to customize the naming? Add instructions below, or leave blank
            for the default{" "}
            <span className="text-foreground">Artist - Title</span> format.
          </p>

          <Textarea
            ref={areaRef}
            label="Extra instructions (optional)"
            placeholder={`Examples:\n• Title only — no artist\n• Artist_Title with underscores\n• Include album year in the folder name\n• Japanese titles, romaji filenames`}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            disabled={busy}
            rows={5}
            maxLength={2000}
          />

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={busy}
              leftIcon={<Sparkles size={14} />}
              onClick={() => onConfirm(instructions.trim())}
            >
              Rename
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
