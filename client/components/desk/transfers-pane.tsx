"use client";

import { Eraser, X } from "lucide-react";
import { DeskButton, DeskPaneLabel } from "@/components/desk/chrome";
import { transferPercent, useTransfers } from "@/lib/transfers";
import { formatBytes, formatElapsed, formatSpeed } from "@/lib/youtube";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  connecting: "Connecting…",
  downloading: "Downloading",
  complete: "Complete",
  error: "Failed",
};

export function TransfersPane({ className }: { className?: string }) {
  const { transfers, now, clearInactive, remove } = useTransfers();

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-center justify-between gap-2 pr-2">
        <DeskPaneLabel>
          Downloads ({transfers.filter((t) => t.status !== "complete").length}{" "}
          active)
        </DeskPaneLabel>
        <DeskButton
          icon={<Eraser size={12} />}
          onClick={clearInactive}
          disabled={!transfers.some((t) => t.status === "complete" || t.status === "error")}
          className="mt-1"
        >
          Clear inactive
        </DeskButton>
      </div>

      {transfers.length === 0 ? (
        <div className="lw-inset flex min-h-[5rem] items-center justify-center">
          <p className="font-mono text-xs text-muted-foreground">
            No transfers yet — pick a result and hit Download.
          </p>
        </div>
      ) : (
        <div className="lw-inset max-h-52 overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="lw-colhead">Name</th>
                <th className="lw-colhead w-20">Size</th>
                <th className="lw-colhead w-28">Status</th>
                <th className="lw-colhead w-32">Progress</th>
                <th className="lw-colhead w-20">Speed</th>
                <th className="lw-colhead w-16">Time</th>
                <th className="lw-colhead w-8" />
              </tr>
            </thead>
            <tbody>
              {transfers.map((transfer) => {
                const percent = transferPercent(transfer);
                const elapsed =
                  ((transfer.endedAt ?? now) - transfer.startedAt) / 1000;
                return (
                  <tr key={transfer.id} className="lw-row">
                    <td className="lw-cell max-w-0">
                      <span className="truncate font-medium">
                        {transfer.name}
                      </span>
                    </td>
                    <td className="lw-cell font-mono text-muted-foreground">
                      {formatBytes(transfer.loaded || transfer.total) || "—"}
                    </td>
                    <td
                      className={cn(
                        "lw-cell font-mono",
                        transfer.status === "complete" &&
                          "text-emerald-600 dark:text-emerald-400",
                        transfer.status === "error" && "text-destructive",
                        transfer.status !== "complete" &&
                          transfer.status !== "error" &&
                          "text-muted-foreground",
                      )}
                      title={transfer.error || undefined}
                    >
                      {transfer.error
                        ? transfer.error
                        : STATUS_LABEL[transfer.status]}
                    </td>
                    <td className="lw-cell">
                      <span className="flex items-center gap-1.5">
                        <span className="lw-progress w-full min-w-[3rem]">
                          <span
                            className="lw-progress-fill block"
                            style={{
                              width: `${transfer.status === "error" ? 0 : percent}%`,
                            }}
                          />
                        </span>
                        <span className="shrink-0 font-mono text-[0.62rem] text-muted-foreground">
                          {percent}%
                        </span>
                      </span>
                    </td>
                    <td className="lw-cell font-mono text-muted-foreground">
                      {transfer.status === "downloading"
                        ? formatSpeed(transfer.rate) || "—"
                        : "—"}
                    </td>
                    <td className="lw-cell font-mono text-muted-foreground">
                      {formatElapsed(elapsed)}
                    </td>
                    <td className="lw-cell">
                      <button
                        type="button"
                        aria-label={`Remove ${transfer.name}`}
                        onClick={() => remove(transfer.id)}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <X size={11} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
