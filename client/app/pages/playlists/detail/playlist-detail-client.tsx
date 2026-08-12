"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Trash2,
  ListMusic,
  CheckCircle2,
  Play,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { nameTracksWithAi } from "@/lib/ai";
import { getToken, isAuthenticated } from "@/lib/auth";
import {
  deletePlaylist,
  fetchPlaylist,
  markPlaylistDownloaded,
  playlistTracksToPlayable,
  updatePlaylistNames,
  SavedPlaylist,
  SavedPlaylistTrack,
} from "@/lib/playlists";
import { usePlayerOptional } from "@/lib/player";
import {
  downloadBatch,
  downloadMp3,
  estimateMp3Bytes,
  formatDuration,
  resolveMediaSizes,
  resolveThumbnail,
  siteWatchPath,
} from "@/lib/youtube";
import {
  YoutubeMediaLinks,
  YoutubeThumb,
} from "@/components/youtube-media-links";
import { AiRenamePromptModal } from "@/components/ai-rename-prompt-modal";
import { Button } from "@/components/ui/button";
import {
  BatchDownloadProgress,
  batchDownloadHint,
  openTransfersPane,
} from "@/components/ui/batch-download-progress";
import { DownloadButton } from "@/components/ui/download-button";
import { DownloadPreset } from "@/lib/download-presets";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Checkbox, MetaPill, SizeMetaPills } from "@/components/ui/meta";
import { LoadingBlock, PageShell } from "@/components/ui/page";
import { TrackRow } from "@/components/ui/track-row";
import { useTransfers } from "@/lib/transfers";

export default function PlaylistDetailClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = String(searchParams.get("id") || "");
  const player = usePlayerOptional();
  const transfers = useTransfers();

  const [playlist, setPlaylist] = useState<SavedPlaylist | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [activeTransferId, setActiveTransferId] = useState<string | null>(null);
  const [readyBatch, setReadyBatch] = useState<{
    filename: string;
    downloadAgain: () => Promise<string>;
    release: () => Promise<void>;
  } | null>(null);
  const [downloadingVideoId, setDownloadingVideoId] = useState<string | null>(
    null,
  );
  const [namingAi, setNamingAi] = useState(false);
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [savingCount, setSavingCount] = useState(0);
  const [namesSavedFlash, setNamesSavedFlash] = useState(false);
  const [zipName, setZipName] = useState("");

  /** Local edits not yet confirmed by the server — never clobber these on save response. */
  const dirtyFilenamesRef = useRef<Map<number, string>>(new Map());
  const dirtyTitleRef = useRef<string | null>(null);
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const playlistIdRef = useRef(id);
  playlistIdRef.current = id;

  const load = useCallback(async () => {
    if (!id) {
      router.replace("/pages/saved");
      return;
    }
    if (!getToken()) {
      router.push("/pages/login");
      return;
    }
    setLoading(true);
    try {
      const data = await fetchPlaylist(id);
      dirtyFilenamesRef.current.clear();
      dirtyTitleRef.current = null;
      setPlaylist(data);
      setZipName(data.title || "playlist");
      setSelected(new Set((data.tracks || []).map((track) => track.videoId)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
      router.push("/pages/saved");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/pages/login");
      return;
    }
    void load();
  }, [load, router]);

  const tracks = playlist?.tracks || [];
  const playableQueue = useMemo(
    () => playlistTracksToPlayable(tracks),
    [tracks],
  );

  const handlePlayInOrder = () => {
    if (!player || !playableQueue.length) {
      toast.error("No playable tracks");
      return;
    }
    void player.playQueue(playableQueue, 0, { shuffle: false });
  };

  const handleShufflePlay = () => {
    if (!player || !playableQueue.length) {
      toast.error("No playable tracks");
      return;
    }
    void player.playQueue(playableQueue, 0, { shuffle: true });
  };

  const selectedTracks = useMemo(
    () => tracks.filter((track) => selected.has(track.videoId)),
    [tracks, selected],
  );

  const toggle = (videoId: string, value: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (value) next.add(videoId);
      else next.delete(videoId);
      return next;
    });
  };

  const setAll = (value: boolean) => {
    setSelected(value ? new Set(tracks.map((t) => t.videoId)) : new Set());
  };

  const updateTrackFilename = (trackId: number, filename: string) => {
    dirtyFilenamesRef.current.set(trackId, filename);
    setPlaylist((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tracks: (prev.tracks || []).map((track) =>
          track.id === trackId ? { ...track, filename } : track,
        ),
      };
    });
    scheduleTrackSave(trackId, filename);
  };

  const clearSaveTimer = (key: string) => {
    const timer = saveTimersRef.current.get(key);
    if (timer) {
      clearTimeout(timer);
      saveTimersRef.current.delete(key);
    }
  };

  const applyServerPlaylist = useCallback((updated: SavedPlaylist) => {
    setPlaylist((prev) => {
      if (!prev) return updated;
      const dirty = dirtyFilenamesRef.current;
      const tracks = (updated.tracks || []).map((track) => {
        if (dirty.has(track.id)) {
          return { ...track, filename: dirty.get(track.id)! };
        }
        return track;
      });
      const title =
        dirtyTitleRef.current != null ? dirtyTitleRef.current : updated.title;
      return { ...updated, title, tracks };
    });
    if (dirtyTitleRef.current == null) {
      setZipName(updated.title || "");
    }
  }, []);

  const flashSaved = useCallback(() => {
    setNamesSavedFlash(true);
    window.setTimeout(() => setNamesSavedFlash(false), 1200);
  }, []);

  const saveTrackName = useCallback(
    async (trackId: number, filename: string) => {
      const playlistId = playlistIdRef.current;
      if (!playlistId) return;
      if (dirtyFilenamesRef.current.get(trackId) !== filename) return;

      setSavingCount((n) => n + 1);
      try {
        const updated = await updatePlaylistNames(playlistId, {
          tracks: [{ id: trackId, filename: filename.trim() || null }],
        });
        if (dirtyFilenamesRef.current.get(trackId) === filename) {
          dirtyFilenamesRef.current.delete(trackId);
        }
        applyServerPlaylist(updated);
        flashSaved();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save name",
        );
      } finally {
        setSavingCount((n) => Math.max(0, n - 1));
      }
    },
    [applyServerPlaylist, flashSaved],
  );

  const saveFolderName = useCallback(
    async (title: string) => {
      const playlistId = playlistIdRef.current;
      if (!playlistId) return;
      const trimmed = title.trim();
      if (!trimmed) return;
      if (dirtyTitleRef.current !== title && dirtyTitleRef.current !== trimmed) {
        // A newer edit superseded this save.
        if (dirtyTitleRef.current != null) return;
      }

      setSavingCount((n) => n + 1);
      try {
        const updated = await updatePlaylistNames(playlistId, {
          title: trimmed,
        });
        if (
          dirtyTitleRef.current === title ||
          dirtyTitleRef.current === trimmed
        ) {
          dirtyTitleRef.current = null;
        }
        applyServerPlaylist(updated);
        flashSaved();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save folder name",
        );
      } finally {
        setSavingCount((n) => Math.max(0, n - 1));
      }
    },
    [applyServerPlaylist, flashSaved],
  );

  const scheduleTrackSave = (trackId: number, filename: string) => {
    const key = `track:${trackId}`;
    clearSaveTimer(key);
    saveTimersRef.current.set(
      key,
      setTimeout(() => {
        saveTimersRef.current.delete(key);
        void saveTrackName(trackId, filename);
      }, 450),
    );
  };

  const scheduleFolderSave = (title: string) => {
    const key = "folder";
    clearSaveTimer(key);
    saveTimersRef.current.set(
      key,
      setTimeout(() => {
        saveTimersRef.current.delete(key);
        void saveFolderName(title);
      }, 450),
    );
  };

  /** Flush debounced edits immediately (before download / AI rename). */
  const flushPendingNameSaves = async () => {
    for (const key of [...saveTimersRef.current.keys()]) {
      clearSaveTimer(key);
    }

    const pendingTracks = [...dirtyFilenamesRef.current.entries()];
    const pendingTitle = dirtyTitleRef.current;
    const playlistId = playlistIdRef.current;
    if (!playlistId) return;

    if (pendingTracks.length === 0 && pendingTitle == null) return;

    setSavingCount((n) => n + 1);
    try {
      const updated = await updatePlaylistNames(playlistId, {
        ...(pendingTitle != null
          ? { title: pendingTitle.trim() || undefined }
          : {}),
        tracks: pendingTracks.map(([trackId, filename]) => ({
          id: trackId,
          filename: filename.trim() || null,
        })),
      });
      for (const [trackId, filename] of pendingTracks) {
        if (dirtyFilenamesRef.current.get(trackId) === filename) {
          dirtyFilenamesRef.current.delete(trackId);
        }
      }
      if (
        pendingTitle != null &&
        dirtyTitleRef.current === pendingTitle
      ) {
        dirtyTitleRef.current = null;
      }
      applyServerPlaylist(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save names");
    } finally {
      setSavingCount((n) => Math.max(0, n - 1));
    }
  };

  useEffect(() => {
    return () => {
      for (const key of [...saveTimersRef.current.keys()]) {
        clearSaveTimer(key);
      }
    };
  }, []);

  const handleAiAutoName = async (instructions = "") => {
    if (!playlist || namingAi || downloading || tracks.length === 0) return;
    setNamingAi(true);
    try {
      await flushPendingNameSaves();
      const result = await nameTracksWithAi({
        playlistTitle: playlist.title,
        playlistUploader: playlist.uploader,
        instructions: instructions || null,
        tracks: tracks.map((track) => ({
          id: String(track.id),
          title: track.title,
          uploader: track.uploader,
          index: track.trackIndex,
          filename: track.filename,
        })),
      });
      const byId = new Map(
        result.tracks.map((row) => [row.id, row.filename]),
      );
      const nextTracks = tracks.map((track) => ({
        ...track,
        filename: byId.get(String(track.id)) || track.filename || track.title,
      }));
      dirtyFilenamesRef.current.clear();
      dirtyTitleRef.current = null;
      setZipName(result.folderName);
      setPlaylist((prev) =>
        prev ? { ...prev, title: result.folderName, tracks: nextTracks } : prev,
      );

      setSavingCount((n) => n + 1);
      try {
        const updated = await updatePlaylistNames(playlist.id, {
          title: result.folderName,
          tracks: nextTracks.map((track) => ({
            id: track.id,
            filename: track.filename || track.title,
          })),
        });
        applyServerPlaylist(updated);
      } finally {
        setSavingCount((n) => Math.max(0, n - 1));
      }

      setAiPromptOpen(false);
      toast.success("AI renamed folder and tracks");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI naming failed");
    } finally {
      setNamingAi(false);
    }
  };

  const markDownloaded = async (videoIds: string[]) => {
    if (!playlist) return;
    await markPlaylistDownloaded(playlist.id, videoIds);
    setPlaylist((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tracks: (prev.tracks || []).map((track) =>
          videoIds.includes(track.videoId)
            ? { ...track, downloaded: true }
            : track,
        ),
        downloadedCount: new Set([
          ...(prev.tracks || [])
            .filter((t) => t.downloaded)
            .map((t) => t.videoId),
          ...videoIds,
        ]).size,
      };
    });
  };

  const handleDownloadOne = async (
    track: SavedPlaylistTrack,
    preset: DownloadPreset,
  ) => {
    setDownloadingVideoId(track.videoId);
    try {
      const result = await downloadMp3(track.link, {
        filename: track.filename || track.title,
        artist: track.uploader,
        album: zipName || playlist?.title || track.uploader,
        thumbnail: track.thumbnail,
        format: preset.format,
        quality: preset.quality,
      });
      await markDownloaded([track.videoId]);
      toast.success(`Downloaded “${result.title}” (${preset.label})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingVideoId(null);
    }
  };

  const readyBatchRef = useRef(readyBatch);
  readyBatchRef.current = readyBatch;

  useEffect(() => {
    return () => {
      void readyBatchRef.current?.release();
    };
  }, []);

  const handleDownloadSelected = async (preset: DownloadPreset) => {
    if (selectedTracks.length === 0) {
      toast.error("Pick at least one track");
      return;
    }

    // Persist any pending name edits before packing the zip.
    await flushPendingNameSaves();

    // Clear previous zip cache for this page.
    if (readyBatch) {
      void readyBatch.release();
      setReadyBatch(null);
    }

    const estimatedSize = selectedTracks.reduce((sum, track) => {
      const sizes = resolveMediaSizes({
        duration: track.duration,
        filesize: track.filesize,
        filesizeMp3: track.filesizeMp3,
        filesizeMp4: track.filesizeMp4,
      });
      const bytes =
        preset.format === "mp4"
          ? sizes.mp4
          : sizes.mp3 || estimateMp3Bytes(track.duration);
      return sum + (bytes || 0);
    }, 0);

    openTransfersPane();
    const transferId = transfers.start({
      name:
        selectedTracks.length === 1
          ? selectedTracks[0].title
          : `${zipName || playlist?.title || "playlist"} (${selectedTracks.length} tracks)`,
      type: selectedTracks.length === 1 ? preset.format : "zip",
      estimatedSize: estimatedSize || null,
    });
    setActiveTransferId(transferId);
    setDownloading(true);

    const hint = batchDownloadHint(selectedTracks.length);
    if (hint) toast.message(hint);

    try {
      if (selectedTracks.length === 1) {
        const track = selectedTracks[0];
        const result = await downloadMp3(track.link, {
          filename: track.filename || track.title,
          artist: track.uploader,
          album: zipName || playlist?.title || track.uploader,
          thumbnail: track.thumbnail,
          format: preset.format,
          quality: preset.quality,
          onProgress: (progress) => transfers.update(transferId, progress),
        });
        transfers.complete(transferId, result.title);
        toast.success(`Downloaded (${preset.label})`);
      } else {
        const result = await downloadBatch(
          selectedTracks.map((track) => ({
            url: track.link,
            filename: track.filename || track.title,
            title: track.title,
            id: track.videoId,
            uploader: track.uploader,
            thumbnail: track.thumbnail,
            index: track.trackIndex,
          })),
          zipName || playlist?.title || "playlist",
          {
            format: preset.format,
            quality: preset.quality,
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
            ? `Downloaded ${result.succeeded} tracks (${result.failed} failed)`
            : `Downloaded ${result.succeeded} as ${preset.label}`,
        );
      }
      await markDownloaded(selectedTracks.map((t) => t.videoId));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Download failed";
      transfers.fail(transferId, message);
      toast.error(message);
    } finally {
      setDownloading(false);
      setActiveTransferId(null);
    }
  };

  const handleDelete = async () => {
    if (!playlist) return;
    try {
      await deletePlaylist(playlist.id);
      toast.success("Playlist removed");
      router.push("/pages/saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  if (loading) {
    return (
      <PageShell>
        <LoadingBlock label="Loading playlist…" />
      </PageShell>
    );
  }

  if (!playlist) return null;

  const downloadedCount =
    playlist.downloadedCount ??
    tracks.filter((track) => track.downloaded).length;
  const busy = downloading || namingAi;
  const namesSaving = savingCount > 0;

  return (
    <PageShell>
      <div className="flex flex-wrap items-center gap-2 animate-fade-up">
        <Link href="/pages/saved">
          <Button size="sm" variant="secondary" leftIcon={<ArrowLeft size={14} />}>
            Back
          </Button>
        </Link>
        <Button
          size="sm"
          variant="danger"
          leftIcon={<Trash2 size={14} />}
          onClick={handleDelete}
        >
          Delete playlist
        </Button>
      </div>

      <Panel className="animate-fade-up-delay-1">
        <div className="flex items-start gap-3">
          <YoutubeThumb
            src={resolveThumbnail(
              playlist.thumbnail,
              playlist.coverVideoId || tracks[0]?.videoId,
            )}
            alt={playlist.title}
            href={siteWatchPath({
              videoId: playlist.coverVideoId || tracks[0]?.videoId,
              playlistId: playlist.youtubePlaylistId,
              savedPlaylistId: playlist.id,
              title: playlist.title,
            })}
            className="h-28 w-48 shrink-0 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <ListMusic className="shrink-0 text-primary" size={20} />
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                {playlist.title}
              </h1>
            </div>
            {playlist.uploader && (
              <p className="mt-1 text-sm text-muted-foreground">
                {playlist.uploader}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <MetaPill>{playlist.trackCount} tracks</MetaPill>
              {playlist.totalDuration != null && (
                <MetaPill>{formatDuration(playlist.totalDuration)}</MetaPill>
              )}
              <SizeMetaPills
                mp3={
                  playlist.totalFilesizeMp3 ?? playlist.totalFilesize ?? null
                }
                mp4={playlist.totalFilesizeMp4 ?? null}
              />
              <MetaPill tone="success">{downloadedCount} downloaded</MetaPill>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                leftIcon={<Play size={14} />}
                disabled={!playableQueue.length || !player}
                onClick={handlePlayInOrder}
              >
                Play
              </Button>
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Shuffle size={14} />}
                disabled={!playableQueue.length || !player}
                onClick={handleShufflePlay}
              >
                Shuffle
              </Button>
            </div>
            <YoutubeMediaLinks
              className="mt-3"
              videoId={playlist.coverVideoId || tracks[0]?.videoId}
              playlistId={playlist.youtubePlaylistId}
              savedPlaylistId={playlist.id}
              title={playlist.title}
              queue={playableQueue}
              queueIndex={0}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <Input
            label="Folder name"
            hint={
              namesSaving
                ? "Saving…"
                : namesSavedFlash
                  ? "Saved"
                  : "Used as the zip folder name when downloading multiple tracks · saves automatically"
            }
            value={zipName}
            onChange={(e) => {
              const next = e.target.value;
              dirtyTitleRef.current = next;
              setZipName(next);
              scheduleFolderSave(next);
            }}
            disabled={namingAi}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAll(true)}
              disabled={busy}
            >
              Select all
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAll(false)}
              disabled={busy}
            >
              Select none
            </Button>
            <Button
              size="sm"
              variant="outline"
              loading={namingAi}
              disabled={busy || tracks.length === 0}
              leftIcon={<Sparkles size={14} />}
              onClick={() => setAiPromptOpen(true)}
            >
              AI auto name
            </Button>
            <DownloadButton
              className="w-full sm:ml-auto sm:w-auto"
              loading={downloading}
              count={selectedTracks.length}
              onDownload={handleDownloadSelected}
              disabled={busy && !downloading}
            />
          </div>

          {selectedTracks.length > 1 && (
            <p className="font-mono text-[0.7rem] text-muted-foreground">
              {batchDownloadHint(selectedTracks.length) ||
                `${selectedTracks.length} tracks selected — larger batches take longer to convert.`}
            </p>
          )}

          {(downloading || activeTransferId || readyBatch) && (
            <BatchDownloadProgress
              transferId={activeTransferId}
              trackCount={selectedTracks.length}
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
      </Panel>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {tracks.map((track, index) => (
          <TrackRow
            key={track.id}
            selected={selected.has(track.videoId)}
            checkbox={
              <Checkbox
                checked={selected.has(track.videoId)}
                disabled={busy}
                onChange={(e) => toggle(track.videoId, e.target.checked)}
              />
            }
            thumb={
              <YoutubeThumb
                src={resolveThumbnail(
                  track.thumbnail,
                  track.videoId,
                  track.link,
                )}
                alt={track.title}
                href={siteWatchPath({
                  videoId: track.videoId,
                  playlistId: playlist.youtubePlaylistId,
                  savedPlaylistId: playlist.id,
                  title: track.title,
                  index,
                })}
                className="h-14 w-20 shrink-0 rounded-md object-cover"
              />
            }
            actions={
              <DownloadButton
                compact
                loading={downloadingVideoId === track.videoId}
                onDownload={(preset) => handleDownloadOne(track, preset)}
              />
            }
          >
            <div className="flex items-start gap-2">
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {track.trackIndex}.
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {track.title}
                </p>
                {track.uploader && (
                  <p className="truncate text-xs text-muted-foreground">
                    {track.uploader}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {track.duration != null && (
                    <MetaPill>{formatDuration(track.duration)}</MetaPill>
                  )}
                  <SizeMetaPills
                    {...resolveMediaSizes({
                      duration: track.duration,
                      filesize: track.filesize,
                      filesizeMp3: track.filesizeMp3,
                      filesizeMp4: track.filesizeMp4,
                    })}
                  />
                  {track.downloaded && (
                    <MetaPill tone="success">
                      <CheckCircle2 size={11} />
                      Downloaded
                    </MetaPill>
                  )}
                </div>
                <YoutubeMediaLinks
                  className="mt-2"
                  compact
                  videoId={track.videoId}
                  playlistId={playlist.youtubePlaylistId}
                  savedPlaylistId={playlist.id}
                  url={track.link}
                  title={track.title}
                  thumbnail={track.thumbnail}
                  queue={playableQueue}
                  queueIndex={Math.max(
                    0,
                    playableQueue.findIndex((t) => t.id === track.videoId),
                  )}
                />
              </div>
            </div>
            <Input
              label="File name"
              value={track.filename || track.title}
              onChange={(e) => updateTrackFilename(track.id, e.target.value)}
              disabled={namingAi || !selected.has(track.videoId)}
              className="h-9 text-xs"
            />
          </TrackRow>
        ))}
      </ul>

      <AiRenamePromptModal
        open={aiPromptOpen}
        busy={namingAi}
        onClose={() => {
          if (!namingAi) setAiPromptOpen(false);
        }}
        onConfirm={(instructions) => void handleAiAutoName(instructions)}
      />
    </PageShell>
  );
}
