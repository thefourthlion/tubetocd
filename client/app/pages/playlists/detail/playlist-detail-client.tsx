"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { DownloadButton } from "@/components/ui/download-button";
import { DownloadPreset } from "@/lib/download-presets";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Checkbox, MetaPill, SizeMetaPills } from "@/components/ui/meta";
import { LoadingBlock, PageShell } from "@/components/ui/page";
import { TrackRow } from "@/components/ui/track-row";

export default function PlaylistDetailClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = String(searchParams.get("id") || "");
  const player = usePlayerOptional();

  const [playlist, setPlaylist] = useState<SavedPlaylist | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadingVideoId, setDownloadingVideoId] = useState<string | null>(
    null,
  );
  const [namingAi, setNamingAi] = useState(false);
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [savingNames, setSavingNames] = useState(false);
  const [zipName, setZipName] = useState("");

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
    setPlaylist((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tracks: (prev.tracks || []).map((track) =>
          track.id === trackId ? { ...track, filename } : track,
        ),
      };
    });
  };

  const persistNames = async (options?: {
    title?: string;
    tracks?: SavedPlaylistTrack[];
    quiet?: boolean;
  }) => {
    if (!playlist) return null;
    const title = options?.title ?? zipName;
    const trackList = options?.tracks ?? tracks;
    setSavingNames(true);
    try {
      const updated = await updatePlaylistNames(playlist.id, {
        title: title.trim() || playlist.title,
        tracks: trackList.map((track) => ({
          id: track.id,
          filename: track.filename || track.title,
        })),
      });
      setPlaylist(updated);
      setZipName(updated.title || title);
      if (!options?.quiet) toast.success("Names saved");
      return updated;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save names");
      return null;
    } finally {
      setSavingNames(false);
    }
  };

  const handleAiAutoName = async (instructions = "") => {
    if (!playlist || namingAi || downloading || tracks.length === 0) return;
    setNamingAi(true);
    try {
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
      setZipName(result.folderName);
      setPlaylist((prev) =>
        prev ? { ...prev, title: result.folderName, tracks: nextTracks } : prev,
      );
      await persistNames({
        title: result.folderName,
        tracks: nextTracks,
        quiet: true,
      });
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

  const handleDownloadSelected = async (preset: DownloadPreset) => {
    if (selectedTracks.length === 0) {
      toast.error("Pick at least one track");
      return;
    }
    if (selectedTracks.length > 40) {
      toast.error("Select at most 40 tracks at a time");
      return;
    }

    setDownloading(true);
    try {
      // Persist any pending name edits before packing the zip.
      await persistNames({ quiet: true });

      if (selectedTracks.length === 1) {
        const track = selectedTracks[0];
        await downloadMp3(track.link, {
          filename: track.filename || track.title,
          artist: track.uploader,
          album: zipName || playlist?.title || track.uploader,
          thumbnail: track.thumbnail,
          format: preset.format,
          quality: preset.quality,
        });
      } else {
        await downloadBatch(
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
          { format: preset.format, quality: preset.quality },
        );
      }
      await markDownloaded(selectedTracks.map((t) => t.videoId));
      toast.success(
        selectedTracks.length === 1
          ? `Downloaded (${preset.label})`
          : `Downloaded ${selectedTracks.length} as ${preset.label}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
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
  const busy = downloading || namingAi || savingNames;

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
            hint="Used as the zip folder name when downloading multiple tracks"
            value={zipName}
            onChange={(e) => setZipName(e.target.value)}
            onBlur={() => {
              if (zipName.trim() && zipName.trim() !== playlist.title) {
                void persistNames({ quiet: true });
              }
            }}
            disabled={busy}
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
            <Button
              size="sm"
              variant="outline"
              loading={savingNames && !namingAi}
              disabled={busy}
              onClick={() => void persistNames()}
            >
              Save names
            </Button>
            <DownloadButton
              className="w-full sm:ml-auto sm:w-auto"
              loading={downloading}
              count={selectedTracks.length}
              onDownload={handleDownloadSelected}
            />
          </div>
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
              onBlur={() => void persistNames({ quiet: true })}
              disabled={busy || !selected.has(track.videoId)}
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
