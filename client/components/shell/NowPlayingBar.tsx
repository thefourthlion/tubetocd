"use client";

import { useState } from "react";
import {
  Pause,
  Play,
  Volume2,
  Loader2,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  X,
} from "lucide-react";
import { NowPlayingDetails } from "@/components/shell/now-playing-details";
import { usePlayer } from "@/lib/player";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/youtube";

function formatClock(seconds: number) {
  if (!seconds || !Number.isFinite(seconds)) return "0:00";
  return formatDuration(Math.floor(seconds)) || "0:00";
}

export function NowPlayingBar() {
  const {
    track,
    queueLength,
    queueIndex,
    shuffle,
    repeat,
    status,
    error,
    currentTime,
    duration,
    volume,
    toggle,
    stop,
    next,
    prev,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer();

  const [detailsOpen, setDetailsOpen] = useState(false);

  // Hide entirely when nothing is loaded (close / stop clears the track).
  if (!track && status === "idle") return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const loading = status === "loading";
  const playing = status === "playing";
  const hasQueue = queueLength > 1;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-2 pb-2 sm:px-3 sm:pb-3">
      <div
        className={cn(
          "lw-window pointer-events-auto relative mx-auto max-w-[88rem]",
          "bg-card/95 backdrop-blur-xl aero-panel",
        )}
      >
        <button
          type="button"
          aria-label="Close player"
          onClick={stop}
          className={cn(
            "lw-bevel absolute right-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center",
            "text-muted-foreground hover:text-foreground",
            "sm:right-2.5 sm:top-2.5",
          )}
        >
          <X size={12} />
        </button>

        <div className="lw-progress rounded-none border-x-0 border-t-0">
          <div
            className="lw-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex flex-col gap-3 px-2.5 py-2.5 pr-10 sm:flex-row sm:items-center sm:gap-4">
          <button
            type="button"
            disabled={!track}
            onClick={() => setDetailsOpen(true)}
            title={track ? "Show track details" : undefined}
            aria-label={track ? `Show details for ${track.title}` : undefined}
            className="group flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:cursor-default"
          >
            <div className="lw-inset h-11 w-11 shrink-0 overflow-hidden p-0">
              {track?.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={track.thumbnail}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-primary">
                  <Play size={14} fill="currentColor" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-mono text-xs font-bold text-foreground group-hover:text-primary group-hover:underline">
                {track?.title || "Nothing playing"}
              </p>
              <p
                className={cn(
                  "truncate font-mono text-[0.68rem]",
                  error ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {error
                  ? error
                  : loading
                    ? "Preparing MP3 preview…"
                    : [
                        track?.uploader,
                        hasQueue
                          ? `${queueIndex + 1}/${queueLength}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Select a track to listen"}
              </p>
            </div>
          </button>

          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              aria-label={shuffle ? "Disable shuffle" : "Enable shuffle"}
              aria-pressed={shuffle}
              disabled={!track || queueLength < 2}
              onClick={toggleShuffle}
              className={cn(
                "lw-bevel inline-flex h-7 w-7 items-center justify-center disabled:opacity-40",
                shuffle
                  ? "border-primary/60 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Shuffle size={13} />
            </button>
            <button
              type="button"
              aria-label="Previous"
              disabled={!track || loading}
              onClick={prev}
              className="lw-bevel inline-flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <SkipBack size={14} fill="currentColor" />
            </button>
            <button
              type="button"
              aria-label={playing ? "Pause" : "Play"}
              disabled={!track || loading}
              onClick={toggle}
              className={cn(
                "lw-bevel inline-flex h-9 w-10 items-center justify-center",
                "border-primary/60 text-primary disabled:opacity-40",
              )}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : playing ? (
                <Pause size={16} fill="currentColor" />
              ) : (
                <Play size={16} fill="currentColor" className="ml-0.5" />
              )}
            </button>
            <button
              type="button"
              aria-label="Next"
              disabled={!track || loading || (!hasQueue && repeat === "off")}
              onClick={next}
              className="lw-bevel inline-flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <SkipForward size={14} fill="currentColor" />
            </button>
            <button
              type="button"
              aria-label={
                repeat === "off"
                  ? "Repeat off"
                  : repeat === "all"
                    ? "Repeat all"
                    : "Repeat one"
              }
              aria-pressed={repeat !== "off"}
              disabled={!track}
              onClick={cycleRepeat}
              className={cn(
                "lw-bevel inline-flex h-7 w-7 items-center justify-center disabled:opacity-40",
                repeat !== "off"
                  ? "border-primary/60 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {repeat === "one" ? <Repeat1 size={13} /> : <Repeat size={13} />}
            </button>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-md sm:items-end">
            <div className="flex w-full items-center gap-2 font-mono text-[0.65rem] font-medium tabular-nums text-muted-foreground">
              <span>{formatClock(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                disabled={!track || !duration}
                onChange={(e) => seek(Number(e.target.value))}
                className="player-range min-w-0 flex-1"
                aria-label="Seek"
              />
              <span>{formatClock(duration)}</span>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-40">
              <Volume2 size={14} className="shrink-0 text-muted-foreground" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="player-range flex-1"
                aria-label="Volume"
              />
            </div>
          </div>
        </div>
      </div>

      {detailsOpen && track && (
        <NowPlayingDetails
          track={track}
          onClose={() => setDetailsOpen(false)}
        />
      )}
    </div>
  );
}
