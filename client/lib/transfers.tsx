"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { TransferProgress } from "@/lib/youtube";

export type TransferStatus =
  | "queued"
  | "connecting"
  | "downloading"
  | "complete"
  | "error";

export type Transfer = {
  id: string;
  name: string;
  type: string;
  status: TransferStatus;
  /** Bytes received so far. */
  loaded: number;
  /** Total bytes when the server reports Content-Length, else an estimate. */
  total: number | null;
  estimated: boolean;
  rate: number | null;
  startedAt: number;
  endedAt: number | null;
  error: string | null;
  /** Batch job track progress (server-side convert). */
  tracksDone?: number | null;
  tracksTotal?: number | null;
  tracksSucceeded?: number | null;
  tracksFailed?: number | null;
  currentTitle?: string | null;
};

type StartOptions = {
  name: string;
  type: string;
  /** Estimated size used for the progress bar while streaming. */
  estimatedSize?: number | null;
};

type TransfersContextValue = {
  transfers: Transfer[];
  active: Transfer[];
  /** Live clock tick so rows can show elapsed time while running. */
  now: number;
  start: (options: StartOptions) => string;
  update: (id: string, progress: TransferProgress) => void;
  updateJob: (
    id: string,
    job: {
      done: number;
      total: number;
      succeeded?: number;
      failed?: number;
      currentTitle?: string | null;
    },
  ) => void;
  complete: (id: string, name?: string) => void;
  fail: (id: string, error: string) => void;
  clearInactive: () => void;
  remove: (id: string) => void;
};

const TransfersContext = createContext<TransfersContextValue | null>(null);

export function TransfersProvider({ children }: { children: ReactNode }) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const counter = useRef(0);

  const hasActive = transfers.some(
    (t) => t.status !== "complete" && t.status !== "error",
  );

  useEffect(() => {
    if (!hasActive) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [hasActive]);

  const start = useCallback((options: StartOptions) => {
    counter.current += 1;
    const id = `tx-${counter.current}-${Date.now()}`;
    setTransfers((prev) => [
      {
        id,
        name: options.name,
        type: options.type,
        status: "connecting",
        loaded: 0,
        total: options.estimatedSize ?? null,
        estimated: options.estimatedSize != null,
        rate: null,
        startedAt: Date.now(),
        endedAt: null,
        error: null,
      },
      ...prev,
    ]);
    return id;
  }, []);

  const update = useCallback((id: string, progress: TransferProgress) => {
    setTransfers((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              status: "downloading",
              loaded: progress.loaded,
              total: progress.total ?? t.total,
              estimated: progress.total == null && t.estimated,
              rate: progress.rate,
            }
          : t,
      ),
    );
  }, []);

  const updateJob = useCallback(
    (
      id: string,
      job: {
        done: number;
        total: number;
        succeeded?: number;
        failed?: number;
        currentTitle?: string | null;
      },
    ) => {
      setTransfers((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                status: "downloading",
                tracksDone: job.done,
                tracksTotal: job.total,
                tracksSucceeded: job.succeeded ?? t.tracksSucceeded,
                tracksFailed: job.failed ?? t.tracksFailed,
                currentTitle: job.currentTitle ?? null,
              }
            : t,
        ),
      );
    },
    [],
  );

  const complete = useCallback((id: string, name?: string) => {
    setTransfers((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              status: "complete",
              name: name || t.name,
              total: t.loaded || t.total,
              estimated: false,
              endedAt: Date.now(),
            }
          : t,
      ),
    );
  }, []);

  const fail = useCallback((id: string, error: string) => {
    setTransfers((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: "error", error, endedAt: Date.now() }
          : t,
      ),
    );
  }, []);

  const clearInactive = useCallback(() => {
    setTransfers((prev) =>
      prev.filter((t) => t.status !== "complete" && t.status !== "error"),
    );
  }, []);

  const remove = useCallback((id: string) => {
    setTransfers((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const active = useMemo(
    () =>
      transfers.filter((t) => t.status !== "complete" && t.status !== "error"),
    [transfers],
  );

  const value = useMemo(
    () => ({
      transfers,
      active,
      now,
      start,
      update,
      updateJob,
      complete,
      fail,
      clearInactive,
      remove,
    }),
    [
      transfers,
      active,
      now,
      start,
      update,
      updateJob,
      complete,
      fail,
      clearInactive,
      remove,
    ],
  );

  return (
    <TransfersContext.Provider value={value}>
      {children}
    </TransfersContext.Provider>
  );
}

export function useTransfers() {
  const ctx = useContext(TransfersContext);
  if (!ctx) {
    throw new Error("useTransfers must be used within TransfersProvider");
  }
  return ctx;
}

export function useTransfersOptional() {
  return useContext(TransfersContext);
}

export function transferPercent(transfer: Transfer): number {
  if (transfer.status === "complete") return 100;
  if (
    transfer.tracksTotal &&
    transfer.tracksTotal > 0 &&
    transfer.tracksDone != null
  ) {
    // Prefer server track progress while converting.
    const trackPct = (transfer.tracksDone / transfer.tracksTotal) * 90;
    if (transfer.loaded > 0 && transfer.total && transfer.total > 0) {
      return Math.min(
        99,
        Math.round(90 + (transfer.loaded / transfer.total) * 9),
      );
    }
    return Math.min(90, Math.round(trackPct));
  }
  if (!transfer.total || transfer.total <= 0) {
    // No Content-Length: approach 90% asymptotically so the bar still moves.
    const mb = transfer.loaded / (1024 * 1024);
    return Math.min(90, Math.round((mb / (mb + 4)) * 100));
  }
  return Math.min(99, Math.round((transfer.loaded / transfer.total) * 100));
}
