"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Disc3,
  Library,
  Loader2,
  Plus,
  Trash2,
  Flame,
  X,
} from "lucide-react";
import {
  DeskActionButton,
  DeskButton,
  DeskPaneLabel,
  DeskStrip,
} from "@/components/desk/chrome";
import {
  CD_MEDIA,
  DEFAULT_CD_MEDIA_ID,
  formatCdFill,
  getCdMedia,
  resolveCdCapacityBytes,
  sanitizeCdName,
  type CdMediaId,
} from "@/lib/cd";
import {
  DeskItem,
  deskItemFromLibraryTrack,
  deskItemFromPlaylistEntry,
  deskItemFromYoutubeLink,
} from "@/lib/desk";
import { fetchLibrary } from "@/lib/library";
import { useTransfers } from "@/lib/transfers";
import {
  downloadBatch,
  estimateMp3Bytes,
  formatBytes,
  formatDuration,
  resolveYoutubeInfo,
} from "@/lib/youtube";
import {
  BatchDownloadProgress,
  batchDownloadHint,
  openTransfersPane,
} from "@/components/ui/batch-download-progress";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "tubetocd-cd-draft-v1";

type CdDraft = {
  name: string;
  mediaId: CdMediaId;
  customMb: number;
  tracks: DeskItem[];
};

function trackBytes(item: DeskItem): number {
  return (
    item.sizeMp3 ||
    item.size ||
    estimateMp3Bytes(item.duration) ||
    0
  );
}

/** ~3.5 min @ 192 kbps when duration/size are unknown. */
function mbFallbackBytes(): number {
  return estimateMp3Bytes(210) || 5 * 1024 * 1024;
}

function loadDraft(): CdDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CdDraft;
    if (!parsed || !Array.isArray(parsed.tracks)) return null;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "My CD",
      mediaId: parsed.mediaId || DEFAULT_CD_MEDIA_ID,
      customMb: Number(parsed.customMb) > 0 ? Number(parsed.customMb) : 700,
      tracks: parsed.tracks,
    };
  } catch {
    return null;
  }
}

export function DeskCd() {
  const transfers = useTransfers();
  const [name, setName] = useState("My CD");
  const [mediaId, setMediaId] = useState<CdMediaId>(DEFAULT_CD_MEDIA_ID);
  const [customMb, setCustomMb] = useState(700);
  const [tracks, setTracks] = useState<DeskItem[]>([]);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [burning, setBurning] = useState(false);
  const [activeTransferId, setActiveTransferId] = useState<string | null>(null);
  const [readyBatch, setReadyBatch] = useState<{
    filename: string;
    downloadAgain: () => Promise<string>;
    release: () => Promise<void>;
  } | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryTracks, setLibraryTracks] = useState<DeskItem[]>([]);
  const [libraryFilter, setLibraryFilter] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setName(draft.name);
      setMediaId(draft.mediaId);
      setCustomMb(draft.customMb);
      setTracks(draft.tracks);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const draft: CdDraft = { name, mediaId, customMb, tracks };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // ignore quota
    }
  }, [name, mediaId, customMb, tracks, hydrated]);

  const readyBatchRef = useRef(readyBatch);
  readyBatchRef.current = readyBatch;

  useEffect(() => {
    return () => {
      void readyBatchRef.current?.release();
    };
  }, []);

  const capacityBytes = useMemo(
    () => resolveCdCapacityBytes(mediaId, customMb),
    [mediaId, customMb],
  );

  const usedBytes = useMemo(
    () => tracks.reduce((sum, t) => sum + trackBytes(t), 0),
    [tracks],
  );

  const usedDuration = useMemo(
    () => tracks.reduce((sum, t) => sum + (t.duration || 0), 0),
    [tracks],
  );

  const remainingBytes = Math.max(0, capacityBytes - usedBytes);
  const fillRatio = capacityBytes > 0 ? usedBytes / capacityBytes : 0;
  const overCapacity = usedBytes > capacityBytes;
  const media = getCdMedia(mediaId);

  const existingKeys = useMemo(
    () => new Set(tracks.map((t) => t.videoId || t.url)),
    [tracks],
  );

  const tryAddTracks = useCallback(
    (incoming: DeskItem[], opts?: { fillUntilFull?: boolean }) => {
      const playable = incoming.filter(
        (item) => item.kind !== "playlist" && item.url,
      );
      if (!playable.length) {
        toast.error("No playable tracks to add");
        return;
      }

      const keys = new Set(tracks.map((t) => t.videoId || t.url));
      let used = tracks.reduce((sum, t) => sum + trackBytes(t), 0);
      const next = [...tracks];
      let added = 0;
      let skippedDup = 0;
      let skippedFit = 0;

      for (const item of playable) {
        const key = item.videoId || item.url;
        if (keys.has(key)) {
          skippedDup += 1;
          continue;
        }
        // Unknown size: assume ~4 MB so capacity still has teeth
        const bytes = trackBytes(item) || mbFallbackBytes();
        if (used + bytes > capacityBytes) {
          skippedFit += 1;
          if (opts?.fillUntilFull) continue;
          break;
        }
        keys.add(key);
        used += bytes;
        next.push(
          trackBytes(item)
            ? item
            : { ...item, size: bytes, sizeMp3: bytes, sizeEstimated: true },
        );
        added += 1;
      }

      if (added === 0) {
        if (skippedDup && !skippedFit) {
          toast.message("Those tracks are already on the disc");
        } else if (skippedFit) {
          toast.error("Not enough room left on this CD");
        } else {
          toast.error("Nothing was added");
        }
        return;
      }

      setTracks(next);
      const bits = [`Added ${added}`];
      if (skippedFit) bits.push(`${skippedFit} didn’t fit`);
      if (skippedDup) bits.push(`${skippedDup} already on disc`);
      toast.success(bits.join(" · "));
    },
    [capacityBytes, tracks],
  );

  const addFromUrl = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        toast.error("Paste a YouTube video or playlist URL");
        return;
      }
      setAdding(true);
      try {
        const info = await resolveYoutubeInfo(trimmed);
        if (info.type === "playlist" || info.type === "channel") {
          tryAddTracks(
            info.entries.map((entry) =>
              deskItemFromPlaylistEntry(entry, info.playlistId),
            ),
            { fillUntilFull: true },
          );
        } else {
          tryAddTracks([
            deskItemFromPlaylistEntry(
              {
                id: info.videoId || info.url,
                title: info.title,
                uploader: info.uploader,
                filename: info.filename,
                url: info.url,
                duration: info.duration,
                filesize: info.filesize,
                filesizeEstimated: info.filesizeEstimated,
                viewCount: info.viewCount,
                thumbnail: info.thumbnail,
                index: 1,
              },
              null,
            ),
          ]);
        }
        setUrl("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not resolve URL");
      } finally {
        setAdding(false);
      }
    },
    [tryAddTracks],
  );

  const openLibrary = useCallback(async () => {
    setLibraryOpen(true);
    setLibraryLoading(true);
    try {
      const data = await fetchLibrary({ type: "all" });
      setLibraryTracks([
        ...data.tracks.map(deskItemFromLibraryTrack),
        ...data.videos.map(deskItemFromYoutubeLink),
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load library");
      setLibraryOpen(false);
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  const filteredLibrary = useMemo(() => {
    const needle = libraryFilter.trim().toLowerCase();
    return libraryTracks.filter((item) => {
      if (!item.url) return false;
      if (existingKeys.has(item.videoId || item.url)) return false;
      if (!needle) return true;
      return (
        item.title.toLowerCase().includes(needle) ||
        (item.channel || "").toLowerCase().includes(needle)
      );
    });
  }, [libraryTracks, libraryFilter, existingKeys]);

  const moveTrack = (index: number, delta: number) => {
    setTracks((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      const [row] = next.splice(index, 1);
      next.splice(target, 0, row);
      return next;
    });
  };

  const removeTrack = (key: string) => {
    setTracks((prev) => prev.filter((t) => t.key !== key));
  };

  const clearDisc = () => {
    setTracks([]);
    toast.message("Disc cleared");
  };

  const burnCd = async () => {
    if (!tracks.length) {
      toast.error("Add at least one track");
      return;
    }
    if (overCapacity) {
      toast.error("Disc is over capacity — remove tracks first");
      return;
    }

    const zipName = sanitizeCdName(name);
    openTransfersPane();
    const transferId = transfers.start({
      name: `${zipName} (${tracks.length} tracks)`,
      type: "zip",
      estimatedSize: usedBytes || null,
    });
    setActiveTransferId(transferId);
    setBurning(true);

    if (readyBatch) {
      void readyBatch.release();
      setReadyBatch(null);
    }

    const hint = batchDownloadHint(tracks.length);
    if (hint) toast.message(hint);

    try {
      const result = await downloadBatch(
        tracks.map((item, index) => ({
          url: item.url,
          filename: item.title,
          title: item.title,
          id: item.videoId || undefined,
          uploader: item.channel,
          thumbnail: item.thumbnail,
          index: index + 1,
        })),
        zipName,
        {
          format: "mp3",
          onProgress: (progress) => transfers.update(transferId, progress),
          onJobProgress: (job) =>
            transfers.updateJob(transferId, {
              done: job.completed,
              total: job.total,
              succeeded: job.succeeded,
              failed: job.failed,
              currentTitle: job.currentTitle,
            }),
        },
      );
      transfers.complete(transferId, result.filename);
      setReadyBatch({
        filename: result.filename,
        downloadAgain: result.downloadAgain,
        release: result.release,
      });
      toast.success(
        result.failed > 0
          ? `Burned ${result.succeeded} tracks (${result.failed} failed)`
          : `Burned “${zipName}” — ${result.succeeded} tracks ready to write`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Burn failed";
      transfers.fail(transferId, message);
      toast.error(message);
    } finally {
      setBurning(false);
      setActiveTransferId(null);
    }
  };

  const onSubmitUrl = (e: FormEvent) => {
    e.preventDefault();
    void addFromUrl(url);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DeskStrip>
        <Disc3 size={13} className="shrink-0" />
        <span>
          Build a CD — pick a blank size, load tracks until it fills, then burn
          one MP3 zip ready for your disc.
        </span>
      </DeskStrip>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        {/* Capacity / media panel */}
        <aside className="flex flex-col border-b border-border/70 lg:border-b-0 lg:border-r">
          <DeskPaneLabel>Blank disc</DeskPaneLabel>
          <div className="flex flex-col gap-2 px-2 pb-3">
            <label className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Disc name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="lw-inset mt-1 w-full px-2 py-1.5 font-mono text-xs text-foreground outline-none"
                maxLength={80}
              />
            </label>

            <div className="flex flex-col gap-1">
              {CD_MEDIA.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setMediaId(option.id)}
                  className={cn(
                    "lw-bevel flex flex-col items-start gap-0.5 px-2 py-1.5 text-left transition-colors",
                    mediaId === option.id
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.08em]">
                    {option.label}
                    {option.capacityBytes != null && (
                      <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground">
                        · {option.sizeLabel}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[0.62rem] text-muted-foreground">
                    {option.description}
                    {option.audioMinutes
                      ? ` · ~${option.audioMinutes} min audio`
                      : ""}
                  </span>
                </button>
              ))}
            </div>

            {mediaId === "custom" && (
              <label className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Capacity (MB)
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={customMb}
                  onChange={(e) =>
                    setCustomMb(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="lw-inset mt-1 w-full px-2 py-1.5 font-mono text-xs text-foreground outline-none"
                />
              </label>
            )}

            <div className="lw-inset mt-1 space-y-1.5 px-2 py-2">
              <div className="flex items-baseline justify-between font-mono text-[0.65rem]">
                <span className="text-muted-foreground">Fill</span>
                <span
                  className={cn(
                    "font-bold",
                    overCapacity ? "text-destructive" : "text-foreground",
                  )}
                >
                  {formatCdFill(usedBytes, capacityBytes)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-sm bg-muted">
                <div
                  className={cn(
                    "h-full transition-all",
                    overCapacity
                      ? "bg-destructive"
                      : fillRatio > 0.9
                        ? "bg-amber-500"
                        : "bg-primary",
                  )}
                  style={{
                    width: `${Math.min(100, Math.max(0, fillRatio * 100))}%`,
                  }}
                />
              </div>
              <div className="space-y-0.5 font-mono text-[0.62rem] text-muted-foreground">
                <p>
                  {formatBytes(usedBytes) || "0 B"} /{" "}
                  {formatBytes(capacityBytes)} ({media.sizeLabel}
                  {mediaId === "custom" ? ` · ${customMb} MB` : ""})
                </p>
                <p>
                  {tracks.length} track{tracks.length === 1 ? "" : "s"}
                  {usedDuration > 0
                    ? ` · ${formatDuration(usedDuration)} audio`
                    : ""}
                </p>
                <p>
                  {overCapacity
                    ? `${formatBytes(usedBytes - capacityBytes)} over`
                    : `${formatBytes(remainingBytes) || "0 B"} free`}
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Tracklist */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <DeskPaneLabel>Tracklist</DeskPaneLabel>

          <form
            onSubmit={onSubmitUrl}
            className="flex flex-wrap items-center gap-1.5 border-b border-border/60 px-2 pb-2"
          >
            <span className="lw-inset flex min-w-[12rem] flex-1 items-center gap-1.5 px-2">
              <Plus size={13} className="shrink-0 text-primary" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste YouTube video or playlist URL"
                aria-label="YouTube URL"
                className="min-w-0 flex-1 bg-transparent py-1.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground"
              />
            </span>
            <DeskButton
              type="submit"
              icon={
                adding ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Plus size={12} />
                )
              }
              disabled={adding || burning}
            >
              {adding ? "Adding" : "Add"}
            </DeskButton>
            <DeskButton
              type="button"
              icon={<Library size={12} />}
              onClick={() => void openLibrary()}
              disabled={burning}
            >
              From library
            </DeskButton>
            <DeskButton
              type="button"
              icon={<Trash2 size={12} />}
              onClick={clearDisc}
              disabled={!tracks.length || burning}
            >
              Clear
            </DeskButton>
          </form>

          <div className="min-h-0 flex-1 overflow-auto">
            {tracks.length === 0 ? (
              <p className="px-3 py-8 text-center font-mono text-xs text-muted-foreground">
                Empty disc — paste a URL or pull tracks from your library.
                Playlists fill until the CD is full.
              </p>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                  <tr className="border-b border-border/70 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted-foreground">
                    <th className="w-10 px-2 py-1.5">#</th>
                    <th className="px-2 py-1.5">Title</th>
                    <th className="hidden px-2 py-1.5 sm:table-cell">Channel</th>
                    <th className="w-16 px-2 py-1.5">Time</th>
                    <th className="w-16 px-2 py-1.5">Size</th>
                    <th className="w-24 px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {tracks.map((track, index) => {
                    const bytes = trackBytes(track);
                    return (
                      <tr
                        key={track.key}
                        className="border-b border-border/40 font-mono text-xs hover:bg-muted/40"
                      >
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {index + 1}
                        </td>
                        <td className="max-w-[14rem] truncate px-2 py-1.5 text-foreground">
                          {track.title}
                        </td>
                        <td className="hidden max-w-[10rem] truncate px-2 py-1.5 text-muted-foreground sm:table-cell">
                          {track.channel || "—"}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {formatDuration(track.duration) || "—"}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {formatBytes(bytes) || "—"}
                          {track.sizeEstimated && bytes ? "~" : ""}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              className="lw-bevel p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
                              onClick={() => moveTrack(index, -1)}
                              disabled={index === 0 || burning}
                              aria-label="Move up"
                            >
                              <ArrowUp size={11} />
                            </button>
                            <button
                              type="button"
                              className="lw-bevel p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
                              onClick={() => moveTrack(index, 1)}
                              disabled={index === tracks.length - 1 || burning}
                              aria-label="Move down"
                            >
                              <ArrowDown size={11} />
                            </button>
                            <button
                              type="button"
                              className="lw-bevel p-1 text-muted-foreground hover:text-destructive disabled:opacity-40"
                              onClick={() => removeTrack(track.key)}
                              disabled={burning}
                              aria-label="Remove"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-border/70 px-2 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <DeskActionButton
                icon={
                  burning ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Flame size={13} />
                  )
                }
                label={burning ? "Burning…" : "Burn CD"}
                onClick={() => void burnCd()}
                disabled={
                  burning || !tracks.length || overCapacity || adding
                }
              />
              <span className="font-mono text-[0.65rem] text-muted-foreground">
                Downloads one MP3 zip · folder “{sanitizeCdName(name)}”
              </span>
            </div>
            {tracks.length > 1 && (
              <p className="font-mono text-[0.65rem] text-muted-foreground">
                {batchDownloadHint(tracks.length) ||
                  `${tracks.length} tracks — larger discs take longer to convert.`}
              </p>
            )}
            {(burning || activeTransferId || readyBatch) && (
              <BatchDownloadProgress
                transferId={activeTransferId}
                trackCount={tracks.length}
                readyJob={readyBatch}
                onDownloadAgain={
                  readyBatch
                    ? () => {
                        void (async () => {
                          try {
                            const name = await readyBatch.downloadAgain();
                            toast.success(`Downloaded “${name}” again`);
                          } catch (err) {
                            toast.error(
                              err instanceof Error
                                ? err.message
                                : "Re-download failed",
                            );
                          }
                        })();
                      }
                    : undefined
                }
              />
            )}
          </div>
        </section>
      </div>

      {libraryOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
          <div className="lw-window flex max-h-[85dvh] w-full max-w-2xl flex-col">
            <div className="lw-titlebar flex items-center gap-2 px-2.5 py-1.5">
              <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.1em]">
                Add from library
              </p>
              <button
                type="button"
                className="ml-auto lw-bevel p-1 text-muted-foreground hover:text-foreground"
                onClick={() => setLibraryOpen(false)}
                aria-label="Close"
              >
                <X size={12} />
              </button>
            </div>
            <div className="border-b border-border/60 px-2 py-2">
              <input
                value={libraryFilter}
                onChange={(e) => setLibraryFilter(e.target.value)}
                placeholder="Filter library tracks"
                className="lw-inset w-full px-2 py-1.5 font-mono text-xs outline-none"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {libraryLoading ? (
                <p className="px-3 py-6 text-center font-mono text-xs text-muted-foreground">
                  Loading library…
                </p>
              ) : filteredLibrary.length === 0 ? (
                <p className="px-3 py-6 text-center font-mono text-xs text-muted-foreground">
                  No matching tracks left to add.
                </p>
              ) : (
                <ul className="divide-y divide-border/40">
                  {filteredLibrary.map((item) => {
                    const bytes = trackBytes(item);
                    const fits =
                      bytes <= 0 || usedBytes + bytes <= capacityBytes;
                    return (
                      <li
                        key={item.key}
                        className="flex items-center gap-2 px-2 py-1.5 font-mono text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-foreground">{item.title}</p>
                          <p className="truncate text-[0.65rem] text-muted-foreground">
                            {item.channel || "—"}
                            {bytes ? ` · ${formatBytes(bytes)}` : ""}
                            {item.duration
                              ? ` · ${formatDuration(item.duration)}`
                              : ""}
                          </p>
                        </div>
                        <DeskButton
                          type="button"
                          disabled={!fits || burning}
                          onClick={() => tryAddTracks([item])}
                        >
                          {fits ? "Add" : "Full"}
                        </DeskButton>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="border-t border-border/60 px-2 py-2">
              <DeskButton type="button" onClick={() => setLibraryOpen(false)}>
                Done
              </DeskButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
