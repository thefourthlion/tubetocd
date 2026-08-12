"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Headphones,
  ListMusic,
  Music4,
  X,
  Youtube,
} from "lucide-react";
import { DeskActionButton, QualityStars } from "@/components/desk/chrome";
import {
  AddToPlaylistButton,
  playlistTrackFromDeskItem,
} from "@/components/ui/add-to-playlist-button";
import type { DeskItem, DeskItemKind } from "@/lib/desk";
import type { SavedPlaylist } from "@/lib/playlists";
import { formatBytes, formatDuration, formatViews } from "@/lib/youtube";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<DeskItemKind, string> = {
  video: "Video",
  playlist: "Playlist",
  track: "Track",
};

/**
 * `navigator.clipboard` is missing outside secure contexts — which is how the
 * desk is reached when it is served over plain http on the LAN — and rejects
 * when the document is not focused, so fall back to a throwaway textarea.
 */
async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "-100vh";
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/**
 * Details sheet for a single row of the desk table. Shows everything we know
 * about the item and offers the same actions as the desk's action bar.
 */
export function ItemDetailsModal({
  item,
  busy,
  onClose,
  onDownload,
  onListen,
  onWatch,
  onOpenList,
  onRate,
  playlists,
  onPlaylistsChange,
}: {
  item: DeskItem;
  busy?: boolean;
  onClose: () => void;
  onDownload: () => void;
  onListen: () => void;
  onWatch: () => void;
  onOpenList: () => void;
  onRate?: (stars: number) => void;
  playlists?: SavedPlaylist[];
  onPlaylistsChange?: (playlists: SavedPlaylist[]) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const copyTimer = useRef<number>();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
  }, [item.key]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const isPlaylist = item.kind === "playlist";
  const playlistTrack =
    !isPlaylist && playlists ? playlistTrackFromDeskItem(item) : null;

  // Actions either navigate or hand off to the transfers pane, so the sheet
  // gets out of the way as soon as one is picked.
  const run = useCallback(
    (action: () => void) => {
      onClose();
      action();
    },
    [onClose],
  );

  const copyLink = useCallback(async () => {
    if (!item.url) {
      toast.error("No source link for this item");
      return;
    }
    if (!(await writeToClipboard(item.url))) {
      toast.error("Could not copy the link");
      return;
    }
    setCopied(true);
    toast.success("Link copied");
    copyTimer.current = window.setTimeout(() => setCopied(false), 1500);
  }, [item.url]);

  if (!mounted) return null;

  const subtitle = [item.channel, isPlaylist ? item.album : null]
    .filter((value, index, all) => value && all.indexOf(value) === index)
    .join("  ·  ");

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-background/70 p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-details-title"
        className="lw-window animate-fade-up flex max-h-[86vh] w-full max-w-xl flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lw-titlebar flex items-center gap-2 px-2.5 py-1.5">
          {isPlaylist ? (
            <ListMusic size={12} className="shrink-0 text-primary" />
          ) : (
            <Music4 size={12} className="shrink-0 text-primary" />
          )}
          <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.1em] text-foreground">
            {KIND_LABEL[item.kind]} details
          </p>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close details"
            onClick={onClose}
            className="lw-bevel ml-auto flex h-6 w-6 items-center justify-center text-foreground"
          >
            <X size={12} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
          <div className="flex gap-3">
            <div className="lw-inset aspect-video w-32 shrink-0 overflow-hidden p-0">
              {item.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbnail}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                  {isPlaylist ? <ListMusic size={18} /> : <Music4 size={18} />}
                </span>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2
                id="item-details-title"
                className="break-words font-mono text-sm font-bold leading-snug text-foreground"
              >
                {item.title}
              </h2>
              {subtitle && (
                <p className="break-words font-mono text-[0.68rem] text-muted-foreground">
                  {subtitle}
                </p>
              )}
              <span className="mt-auto flex items-center gap-1.5">
                <QualityStars
                  score={item.quality}
                  label={`Your rating for ${item.title}`}
                  onRate={onRate}
                />
                {item.downloaded && (
                  <span className="inline-flex items-center gap-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.08em] text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={11} />
                    In library
                  </span>
                )}
              </span>
            </div>
          </div>

          <dl className="lw-inset grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1.5 px-2.5 py-2">
            <DetailRow
              label="Type"
              value={
                item.type === "channel"
                  ? "CHANNEL"
                  : isPlaylist
                    ? "PLAYLIST"
                    : "VIDEO"
              }
            />
            {isPlaylist ? (
              <>
                <DetailRow
                  label="Tracks"
                  value={
                    item.trackCount != null
                      ? `${item.trackCount} track${item.trackCount === 1 ? "" : "s"}`
                      : null
                  }
                />
                <DetailRow
                  label="MP3"
                  value={
                    item.sizeMp3 ?? item.size
                      ? `${formatBytes(item.sizeMp3 ?? item.size)}${item.sizeEstimated ? " (estimated)" : ""}`
                      : null
                  }
                />
                <DetailRow
                  label="MP4"
                  value={
                    item.sizeMp4
                      ? `${formatBytes(item.sizeMp4)}${item.sizeEstimated ? " (estimated)" : ""}`
                      : null
                  }
                />
              </>
            ) : (
              <>
                <DetailRow
                  label="MP3"
                  value={
                    item.sizeMp3 ?? item.size
                      ? `${formatBytes(item.sizeMp3 ?? item.size)}${item.sizeEstimated ? " (estimated)" : ""}`
                      : null
                  }
                />
                <DetailRow
                  label="MP4"
                  value={
                    item.sizeMp4
                      ? `${formatBytes(item.sizeMp4)}${item.sizeEstimated ? " (estimated)" : ""}`
                      : null
                  }
                />
              </>
            )}
            <DetailRow label="Length" value={formatDuration(item.duration)} />
            <DetailRow label="Views" value={formatViews(item.views)} />
            <DetailRow label="Channel" value={item.channel} />
            <DetailRow label="Album" value={item.album} />
            <DetailRow label="Video ID" value={item.videoId} />
            <DetailRow label="List ID" value={item.playlistId} />
            <DetailRow
              label="Source"
              value={
                item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-primary underline-offset-2 hover:underline"
                  >
                    {item.url}
                  </a>
                ) : null
              }
            />
          </dl>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-border/60 p-2">
          <p className="px-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            What do you want to do?
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <DeskActionButton
              icon={<Download size={16} />}
              label="Download"
              title={
                isPlaylist
                  ? "Open the playlist, then download its tracks"
                  : undefined
              }
              disabled={isPlaylist || busy || !item.url}
              onClick={() => run(onDownload)}
            />
            <DeskActionButton
              icon={<Headphones size={16} />}
              label="Listen"
              onClick={() => run(onListen)}
            />
            <DeskActionButton
              icon={<Youtube size={16} />}
              label="Watch"
              onClick={() => run(onWatch)}
            />
            {isPlaylist && (
              <DeskActionButton
                icon={<ListMusic size={16} />}
                label="Open list"
                disabled={busy}
                onClick={() => run(onOpenList)}
              />
            )}
            {playlistTrack && playlists && (
              <AddToPlaylistButton
                size="sm"
                track={playlistTrack}
                playlists={playlists}
                onPlaylistsChange={onPlaylistsChange}
              />
            )}
            <DeskActionButton
              icon={copied ? <Check size={16} /> : <Copy size={16} />}
              label={copied ? "Copied" : "Copy link"}
              disabled={!item.url}
              onClick={() => void copyLink()}
            />
            <DeskActionButton
              className="ml-auto"
              icon={<ExternalLink size={16} />}
              label="YouTube"
              disabled={!item.url}
              onClick={() =>
                window.open(item.url, "_blank", "noopener,noreferrer")
              }
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <>
      <dt className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "min-w-0 break-words font-mono text-[0.7rem]",
          value ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {value || "—"}
      </dd>
    </>
  );
}
