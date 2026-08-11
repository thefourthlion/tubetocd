"use client";

import { Loader2 } from "lucide-react";
import {
  transferPercent,
  useTransfersOptional,
  type Transfer,
} from "@/lib/transfers";
import { formatBytes, formatElapsed, formatSpeed } from "@/lib/youtube";
import { cn } from "@/lib/utils";

/** Ask the desk shell to expand the Transfers panel. */
export function openTransfersPane() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("tubetocd-transfers-open"));
}

export function batchDownloadHint(trackCount: number): string | null {
  if (trackCount <= 1) return null;
  if (trackCount >= 100) {
    return `Converting ${trackCount} tracks can take a long time (often 30+ minutes). Keep this tab open — you’ll see “N of ${trackCount}” progress below.`;
  }
  if (trackCount >= 25) {
    return `Converting ${trackCount} tracks usually takes several minutes. Keep this tab open while it runs.`;
  }
  if (trackCount >= 5) {
    return `Larger selections take longer. Progress shows each track as it finishes on the server.`;
  }
  return null;
}

type Props = {
  /** Active transfer id from useTransfers().start(...) */
  transferId: string | null;
  /** Fallback label while connecting. */
  label?: string;
  trackCount?: number;
  className?: string;
  /** When a zip is ready on the server for this page visit. */
  readyJob?: {
    filename: string;
    downloadAgain: () => Promise<string>;
  } | null;
  onDownloadAgain?: () => void;
};

/**
 * Inline progress card for playlist / convert / CD batch downloads.
 * Reads live state from TransfersProvider when available.
 */
export function BatchDownloadProgress({
  transferId,
  label = "Preparing download…",
  trackCount,
  className,
  readyJob,
  onDownloadAgain,
}: Props) {
  const transfers = useTransfersOptional();
  const transfer: Transfer | undefined = transferId
    ? transfers?.transfers.find((t) => t.id === transferId)
    : transfers?.active[0];

  if (!transfer && !transferId && !readyJob) return null;

  const now = transfers?.now ?? Date.now();
  const status = transfer?.status ?? (readyJob ? "complete" : "connecting");
  const percent = transfer ? transferPercent(transfer) : readyJob ? 100 : 0;
  const elapsed = transfer
    ? ((transfer.endedAt ?? now) - transfer.startedAt) / 1000
    : 0;

  const tracksDone = transfer?.tracksDone;
  const tracksTotal = transfer?.tracksTotal ?? trackCount ?? null;
  const hasTrackProgress =
    tracksDone != null && tracksTotal != null && tracksTotal > 0;

  const converting =
    status === "connecting" ||
    status === "queued" ||
    (status === "downloading" &&
      hasTrackProgress &&
      (tracksDone ?? 0) < (tracksTotal ?? 0) &&
      (transfer?.loaded || 0) < 1024);

  const title =
    status === "complete" || readyJob
      ? readyJob
        ? `Ready — ${readyJob.filename}`
        : "Download complete"
      : status === "error"
        ? "Download failed"
        : converting && hasTrackProgress
          ? `Converting ${tracksDone} of ${tracksTotal}…`
          : converting
            ? trackCount && trackCount > 1
              ? `Converting ${trackCount} tracks on the server…`
              : label
            : "Downloading zip…";

  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-card/80 px-3 py-3 shadow-sm",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        {status !== "complete" && status !== "error" && !readyJob && (
          <Loader2
            size={14}
            className="mt-0.5 shrink-0 animate-spin text-primary"
          />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="font-mono text-[0.65rem] text-muted-foreground">
              {hasTrackProgress
                ? `${tracksDone} / ${tracksTotal}`
                : formatElapsed(elapsed)}
              {transfer?.rate && status === "downloading" && !converting
                ? ` · ${formatSpeed(transfer.rate)}`
                : hasTrackProgress
                  ? ` · ${formatElapsed(elapsed)}`
                  : ""}
            </p>
          </div>

          <div className="lw-progress h-2.5 w-full overflow-hidden rounded-full">
            <div
              className={cn(
                "lw-progress-fill h-full rounded-full transition-[width] duration-300",
                converting && "animate-pulse",
              )}
              style={{
                width: `${
                  status === "error"
                    ? 0
                    : status === "complete" || readyJob
                      ? 100
                      : percent
                }%`,
              }}
            />
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[0.65rem] text-muted-foreground">
            {hasTrackProgress && (
              <span>
                {transfer?.tracksSucceeded ?? tracksDone} ok
                {(transfer?.tracksFailed || 0) > 0
                  ? ` · ${transfer?.tracksFailed} failed`
                  : ""}
              </span>
            )}
            {transfer?.currentTitle && converting && (
              <span className="truncate">Now: {transfer.currentTitle}</span>
            )}
            {!converting && transfer && (
              <span>
                {formatBytes(transfer.loaded || transfer.total) || "—"}
                {transfer.total && transfer.loaded
                  ? ` / ${formatBytes(transfer.total)}`
                  : transfer.estimated
                    ? " (est.)"
                    : ""}
              </span>
            )}
            {transfer?.error && (
              <span className="text-destructive">{transfer.error}</span>
            )}
          </div>

          {readyJob && onDownloadAgain && (
            <button
              type="button"
              onClick={onDownloadAgain}
              className="lw-bevel mt-1 px-2.5 py-1.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.08em] text-foreground"
            >
              Download zip again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
