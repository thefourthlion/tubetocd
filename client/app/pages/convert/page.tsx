"use client";

import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Link2,
  ListMusic,
  Search,
  BookmarkPlus,
  Sparkles,
} from "lucide-react";
import { isAuthenticated } from "@/lib/auth";
import { nameTracksWithAi } from "@/lib/ai";
import {
  downloadBatch,
  downloadMp3,
  fetchMyLinks,
  formatBytes,
  formatDuration,
  formatUploadDate,
  formatViews,
  resolveMediaSizes,
  resolveThumbnail,
  resolveYoutubeInfo,
  siteWatchPath,
  YoutubeLink,
} from "@/lib/youtube";
import {
  BatchDownloadProgress,
  batchDownloadHint,
  openTransfersPane,
} from "@/components/ui/batch-download-progress";
import { useTransfersOptional } from "@/lib/transfers";
import {
  fetchPlaylists,
  markPlaylistDownloaded,
  savePlaylist,
  SavedPlaylist,
} from "@/lib/playlists";
import {
  YoutubeMediaLinks,
  YoutubeThumb,
} from "@/components/youtube-media-links";
import { AiRenamePromptModal } from "@/components/ai-rename-prompt-modal";
import { Button } from "@/components/ui/button";
import { DownloadButton } from "@/components/ui/download-button";
import { DownloadPreset } from "@/lib/download-presets";
import { Input } from "@/components/ui/input";
import { Panel, PanelDescription, PanelTitle } from "@/components/ui/panel";
import { MetaPill, Checkbox, SizeMetaPills } from "@/components/ui/meta";
import { PageHeader, PageShell } from "@/components/ui/page";
import { TrackRow } from "@/components/ui/track-row";
import { cn } from "@/lib/utils";

type PickerTrack = {
  id: string;
  index: number;
  title: string;
  uploader: string | null;
  filename: string;
  url: string;
  duration: number | null;
  filesize: number | null;
  filesizeMp3: number | null;
  filesizeMp4: number | null;
  filesizeEstimated: boolean;
  viewCount: number | null;
  thumbnail: string | null;
  selected: boolean;
};

type SingleMeta = {
  videoId: string | null;
  title: string;
  uploader: string | null;
  duration: number | null;
  filesize: number | null;
  filesizeMp3: number | null;
  filesizeMp4: number | null;
  filesizeEstimated: boolean;
  viewCount: number | null;
  uploadDate: string | null;
  thumbnail: string | null;
};

function ConvertPage() {
  const searchParams = useSearchParams();
  const bootstrapped = useRef(false);
  const transfers = useTransfersOptional();
  const [url, setUrl] = useState("");
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeTransferId, setActiveTransferId] = useState<string | null>(null);
  const [readyBatch, setReadyBatch] = useState<{
    filename: string;
    downloadAgain: () => Promise<string>;
    release: () => Promise<void>;
  } | null>(null);
  const readyBatchRef = useRef(readyBatch);
  readyBatchRef.current = readyBatch;

  useEffect(() => {
    return () => {
      void readyBatchRef.current?.release();
    };
  }, []);

  const [namingAi, setNamingAi] = useState(false);
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [links, setLinks] = useState<YoutubeLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [playlists, setPlaylists] = useState<SavedPlaylist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [savingPlaylist, setSavingPlaylist] = useState(false);

  const [mode, setMode] = useState<"idle" | "video" | "playlist" | "channel">(
    "idle",
  );
  const [playlistTitle, setPlaylistTitle] = useState("");
  const [playlistUploader, setPlaylistUploader] = useState<string | null>(null);
  const [playlistYoutubeId, setPlaylistYoutubeId] = useState<string | null>(
    null,
  );
  const [playlistSourceUrl, setPlaylistSourceUrl] = useState("");
  const [channelMeta, setChannelMeta] = useState<{
    channelId: string | null;
    handle: string | null;
    truncated: boolean;
  } | null>(null);
  const [savedPlaylistDbId, setSavedPlaylistDbId] = useState<number | null>(
    null,
  );
  const [playlistTotals, setPlaylistTotals] = useState<{
    duration: number | null;
    filesize: number | null;
    filesizeMp4: number | null;
  }>({ duration: null, filesize: null, filesizeMp4: null });
  const [zipName, setZipName] = useState("y2m-playlist");
  const [tracks, setTracks] = useState<PickerTrack[]>([]);
  const [singleFilename, setSingleFilename] = useState("");
  const [singleUrl, setSingleUrl] = useState("");
  const [singleMeta, setSingleMeta] = useState<SingleMeta | null>(null);

  const syncAuth = useCallback(() => {
    setAuthed(isAuthenticated());
  }, []);

  const loadLinks = useCallback(async () => {
    if (!isAuthenticated()) {
      setLinks([]);
      setPlaylists([]);
      return;
    }
    setLinksLoading(true);
    setPlaylistsLoading(true);
    try {
      const [linkData, playlistData] = await Promise.all([
        fetchMyLinks(),
        fetchPlaylists(),
      ]);
      setLinks(linkData);
      setPlaylists(playlistData);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load library",
      );
    } finally {
      setLinksLoading(false);
      setPlaylistsLoading(false);
    }
  }, []);

  useEffect(() => {
    syncAuth();
    loadLinks();
    const onAuth = () => {
      syncAuth();
      loadLinks();
    };
    window.addEventListener("auth-changed", onAuth);
    window.addEventListener("storage", onAuth);
    return () => {
      window.removeEventListener("auth-changed", onAuth);
      window.removeEventListener("storage", onAuth);
    };
  }, [syncAuth, loadLinks]);

  const selectedTracks = useMemo(
    () => tracks.filter((track) => track.selected),
    [tracks],
  );

  const selectedTotals = useMemo(() => {
    const duration = selectedTracks.reduce(
      (sum, track) => sum + (track.duration || 0),
      0,
    );
    const filesize = selectedTracks.reduce(
      (sum, track) => sum + (track.filesizeMp3 || track.filesize || 0),
      0,
    );
    const filesizeMp4 = selectedTracks.reduce(
      (sum, track) => sum + (track.filesizeMp4 || 0),
      0,
    );
    return {
      duration: duration || null,
      filesize: filesize || null,
      filesizeMp4: filesizeMp4 || null,
    };
  }, [selectedTracks]);

  const loadFromUrl = useCallback(async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      toast.error("Paste a YouTube link first");
      return;
    }

    setUrl(trimmed);
    setLoadingInfo(true);
    setMode("idle");
    setTracks([]);
    setSingleMeta(null);
    try {
      const info = await resolveYoutubeInfo(trimmed);
      if (info.type === "playlist" || info.type === "channel") {
        const isChannel = info.type === "channel";
        setMode(isChannel ? "channel" : "playlist");
        setPlaylistTitle(info.title);
        setPlaylistUploader(info.uploader);
        setPlaylistYoutubeId(info.playlistId);
        setPlaylistSourceUrl(info.sourceUrl);
        setSavedPlaylistDbId(null);
        setChannelMeta(
          isChannel
            ? {
                channelId: info.channelId,
                handle: info.handle,
                truncated: Boolean(info.truncated),
              }
            : null,
        );
        setPlaylistTotals({
          duration: info.totalDuration,
          filesize: info.totalFilesizeMp3 ?? info.totalFilesize,
          filesizeMp4: info.totalFilesizeMp4 ?? null,
        });
        setZipName(info.title || (isChannel ? "y2m-channel" : "y2m-playlist"));
        setTracks(
          info.entries.map((entry) => {
            const sizes = resolveMediaSizes(entry);
            return {
              id: entry.id,
              index: entry.index,
              title: entry.title,
              uploader: entry.uploader,
              filename: entry.filename,
              url: entry.url,
              duration: entry.duration,
              filesize: sizes.mp3,
              filesizeMp3: sizes.mp3,
              filesizeMp4: sizes.mp4,
              filesizeEstimated: entry.filesizeEstimated,
              viewCount: entry.viewCount,
              thumbnail: resolveThumbnail(entry.thumbnail, entry.id, entry.url),
              selected: true,
            };
          }),
        );
        const label = isChannel ? "videos from channel" : "tracks from";
        toast.success(
          isChannel
            ? `Loaded ${info.count} ${label} “${info.title}”${info.truncated ? ` (first ${info.limit})` : ""}`
            : `Loaded ${info.count} tracks from “${info.title}”`,
        );
      } else {
        setMode("video");
        setSingleUrl(info.url);
        setSingleFilename(info.filename);
        setPlaylistYoutubeId(null);
        setPlaylistSourceUrl("");
        setSavedPlaylistDbId(null);
        setChannelMeta(null);
        const sizes = resolveMediaSizes(info);
        setSingleMeta({
          videoId: info.videoId,
          title: info.title,
          uploader: info.uploader,
          duration: info.duration,
          filesize: sizes.mp3,
          filesizeMp3: sizes.mp3,
          filesizeMp4: sizes.mp4,
          filesizeEstimated: info.filesizeEstimated,
          viewCount: info.viewCount,
          uploadDate: info.uploadDate,
          thumbnail: resolveThumbnail(info.thumbnail, info.videoId, info.url),
        });
        setTracks([]);
        toast.success(`Loaded “${info.title}”`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load link");
    } finally {
      setLoadingInfo(false);
    }
  }, []);

  const handleLoad = (e?: FormEvent) => {
    e?.preventDefault();
    void loadFromUrl(url);
  };

  useEffect(() => {
    if (bootstrapped.current) return;
    const initial = searchParams.get("url");
    if (!initial?.trim()) return;
    bootstrapped.current = true;
    void loadFromUrl(initial);
  }, [searchParams, loadFromUrl]);

  const handleSavePlaylist = async (downloadedVideoIds: string[] = []) => {
    if (!isAuthenticated()) {
      toast.error("Sign in to save to your library");
      return null;
    }
    if (!playlistYoutubeId || tracks.length === 0) {
      toast.error(
        mode === "channel" ? "Load a channel first" : "Load a playlist first",
      );
      return null;
    }

    setSavingPlaylist(true);
    try {
      const downloadedSet = new Set(downloadedVideoIds);
      const isChannel = mode === "channel";
      const saved = await savePlaylist({
        youtubePlaylistId: playlistYoutubeId,
        kind: isChannel ? "channel" : "playlist",
        youtubeChannelId: channelMeta?.channelId ?? null,
        handle: channelMeta?.handle ?? null,
        title: playlistTitle || zipName || (isChannel ? "Channel" : "Playlist"),
        uploader: playlistUploader,
        sourceUrl: playlistSourceUrl || url,
        tracks: tracks.map((track) => ({
          id: track.id,
          videoId: track.id,
          url: track.url,
          title: track.title,
          uploader: track.uploader,
          filename: track.filename,
          duration: track.duration,
          filesize: track.filesize,
          viewCount: track.viewCount,
          thumbnail: track.thumbnail,
          index: track.index,
          downloaded: downloadedSet.has(track.id),
        })),
      });
      setSavedPlaylistDbId(saved.id);
      if (downloadedVideoIds.length > 0) {
        await markPlaylistDownloaded(saved.id, downloadedVideoIds);
      }
      await loadLinks();
      return saved;
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : mode === "channel"
            ? "Failed to save channel"
            : "Failed to save playlist",
      );
      return null;
    } finally {
      setSavingPlaylist(false);
    }
  };

  const handleDownloadSelected = async (preset: DownloadPreset) => {
    if (mode === "video") {
      if (!singleUrl) {
        toast.error("Load a video first");
        return;
      }
      openTransfersPane();
      const transferId = transfers?.start({
        name: singleFilename || singleMeta?.title || "track",
        type: preset.format,
        estimatedSize:
          resolveMediaSizes({
            duration: singleMeta?.duration,
            filesize: singleMeta?.filesize,
            filesizeMp3: singleMeta?.filesizeMp3,
            filesizeMp4: singleMeta?.filesizeMp4,
          })[preset.format === "mp4" ? "mp4" : "mp3"] || null,
      });
      if (transferId) setActiveTransferId(transferId);
      setDownloading(true);
      try {
        const result = await downloadMp3(singleUrl, {
          filename: singleFilename,
          artist: singleMeta?.uploader,
          album: singleMeta?.uploader || singleMeta?.title,
          thumbnail: singleMeta?.thumbnail,
          format: preset.format,
          quality: preset.quality,
          onProgress: (progress) => {
            if (transferId) transfers?.update(transferId, progress);
          },
        });
        if (transferId) transfers?.complete(transferId, result.title);
        toast.success(`Downloaded “${result.title}” (${preset.label})`);
        if (isAuthenticated()) await loadLinks();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Download failed";
        if (transferId) transfers?.fail(transferId, message);
        toast.error(message);
      } finally {
        setDownloading(false);
        setActiveTransferId(null);
      }
      return;
    }

    if (selectedTracks.length === 0) {
      toast.error("Pick at least one track");
      return;
    }

    openTransfersPane();
    const transferId = transfers?.start({
      name:
        selectedTracks.length === 1
          ? selectedTracks[0].title
          : `${zipName || playlistTitle || "playlist"} (${selectedTracks.length} tracks)`,
      type: selectedTracks.length === 1 ? preset.format : "zip",
      estimatedSize:
        (preset.format === "mp4"
          ? selectedTotals.filesizeMp4
          : selectedTotals.filesize) || null,
    });
    if (transferId) setActiveTransferId(transferId);
    setDownloading(true);

    if (readyBatch) {
      void readyBatch.release();
      setReadyBatch(null);
    }

    const hint = batchDownloadHint(selectedTracks.length);
    if (hint) toast.message(hint);

    try {
      const result = await downloadBatch(
        selectedTracks.map((track) => ({
          url: track.url,
          filename: track.filename,
          title: track.title,
          id: track.id,
          uploader: track.uploader,
          thumbnail: track.thumbnail,
          index: track.index,
        })),
        zipName,
        {
          format: preset.format,
          quality: preset.quality,
          onProgress: (progress) => {
            if (transferId) transfers?.update(transferId, progress);
          },
          onJobProgress: (job) => {
            if (transferId) {
              transfers?.updateJob(transferId, {
                done: job.completed,
                total: job.total,
                succeeded: job.succeeded,
                failed: job.failed,
                currentTitle: job.currentTitle,
              });
            }
          },
        },
      );
      if (transferId) transfers?.complete(transferId, result.filename);
      setReadyBatch({
        filename: result.filename,
        downloadAgain: result.downloadAgain,
        release: result.release,
      });
      toast.success(
        result.failed > 0
          ? `Downloaded ${result.succeeded} tracks (${result.failed} failed)`
          : selectedTracks.length === 1
            ? `Downloaded “${result.filename}” (${preset.label})`
            : `Downloaded ${result.succeeded} tracks as ${preset.label}`,
      );
      if (isAuthenticated() && playlistYoutubeId) {
        const saved = await handleSavePlaylist(
          selectedTracks.map((track) => track.id),
        );
        if (saved) {
          toast.success(
            mode === "channel"
              ? "Channel saved to your library"
              : "Playlist saved to your library",
          );
        }
      } else if (isAuthenticated()) {
        await loadLinks();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Download failed";
      if (transferId) transfers?.fail(transferId, message);
      toast.error(message);
    } finally {
      setDownloading(false);
      setActiveTransferId(null);
    }
  };

  const setAllSelected = (selected: boolean) => {
    setTracks((prev) => prev.map((track) => ({ ...track, selected })));
  };

  const updateTrackFilename = (id: string, filename: string) => {
    setTracks((prev) =>
      prev.map((track) => (track.id === id ? { ...track, filename } : track)),
    );
  };

  const handleAiAutoName = async (instructions = "") => {
    if (namingAi || downloading) return;

    if (mode === "playlist" || mode === "channel") {
      if (tracks.length === 0) {
        toast.error(
          mode === "channel" ? "Load a channel first" : "Load a playlist first",
        );
        return;
      }
      setNamingAi(true);
      try {
        const result = await nameTracksWithAi({
          playlistTitle,
          playlistUploader,
          instructions: instructions || null,
          tracks: tracks.map((track) => ({
            id: track.id,
            title: track.title,
            uploader: track.uploader,
            index: track.index,
            filename: track.filename,
          })),
        });
        const byId = new Map(
          result.tracks.map((row) => [row.id, row.filename]),
        );
        setZipName(result.folderName);
        setTracks((prev) =>
          prev.map((track) => ({
            ...track,
            filename: byId.get(track.id) || track.filename,
          })),
        );
        setAiPromptOpen(false);
        toast.success("AI renamed folder and tracks");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "AI naming failed");
      } finally {
        setNamingAi(false);
      }
      return;
    }

    if (mode === "video" && singleMeta) {
      setNamingAi(true);
      try {
        const result = await nameTracksWithAi({
          playlistTitle: singleMeta.title,
          playlistUploader: singleMeta.uploader,
          instructions: instructions || null,
          tracks: [
            {
              id: singleMeta.videoId || "single",
              title: singleMeta.title,
              uploader: singleMeta.uploader,
              index: 1,
              filename: singleFilename,
            },
          ],
        });
        const named =
          result.tracks[0]?.filename || result.folderName || singleFilename;
        setSingleFilename(named);
        setAiPromptOpen(false);
        toast.success("AI renamed file");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "AI naming failed");
      } finally {
        setNamingAi(false);
      }
    }
  };

  const toggleTrack = (id: string, selected: boolean) => {
    setTracks((prev) =>
      prev.map((track) => (track.id === id ? { ...track, selected } : track)),
    );
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Transfer tool"
        title="Convert"
        description="Paste a YouTube video, playlist, or channel. TubeToCD loads tracks, lets you rename them, and presses clean MP3 or MP4 files."
      />

      <Panel glow className="animate-fade-up-delay-1">
        <form className="flex flex-col gap-3" onSubmit={handleLoad}>
          <Input
            label="YouTube link"
            placeholder="Video, playlist, or channel URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            leftIcon={<Link2 size={16} />}
            disabled={loadingInfo || downloading}
            autoComplete="off"
          />
          <Button
            type="submit"
            fullWidth
            size="lg"
            loading={loadingInfo}
            leftIcon={<Search size={18} />}
          >
            {loadingInfo ? "Loading…" : "Load"}
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          {authed ? (
            "Signed in — downloads land in your library for quick re-pull."
          ) : (
            <>
              <Link href="/pages/login" className="u-link font-medium">
                Sign in
              </Link>{" "}
              to keep playlists and downloads in{" "}
              <Link href="/pages/saved" className="u-link font-medium">
                Saved
              </Link>
              .
            </>
          )}
        </p>
      </Panel>

      {mode === "video" && singleMeta && (
        <Panel className="animate-fade-up">
          <div className="flex gap-3 sm:gap-4">
            <YoutubeThumb
              src={singleMeta.thumbnail}
              alt={singleMeta.title}
              href={siteWatchPath({
                videoId: singleMeta.videoId,
                title: singleMeta.title,
              })}
              className="h-24 w-40 shrink-0 rounded-lg object-cover sm:h-28 sm:w-48"
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-semibold text-foreground">
                {singleMeta.title}
              </h2>
              {singleMeta.uploader && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {singleMeta.uploader}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {singleMeta.duration != null && (
                  <MetaPill>{formatDuration(singleMeta.duration)}</MetaPill>
                )}
                <SizeMetaPills
                  mp3={singleMeta.filesizeMp3 ?? singleMeta.filesize}
                  mp4={singleMeta.filesizeMp4}
                  estimated={singleMeta.filesizeEstimated}
                />
                {singleMeta.viewCount != null && (
                  <MetaPill>
                    {formatViews(singleMeta.viewCount)} views
                  </MetaPill>
                )}
                {formatUploadDate(singleMeta.uploadDate) && (
                  <MetaPill>
                    {formatUploadDate(singleMeta.uploadDate)}
                  </MetaPill>
                )}
              </div>
              <YoutubeMediaLinks
                className="mt-3"
                videoId={singleMeta.videoId}
                title={singleMeta.title}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <Input
              label="File name"
              hint="Saved as Channel - Title.mp3"
              value={singleFilename}
              onChange={(e) => setSingleFilename(e.target.value)}
              disabled={downloading || namingAi}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                loading={namingAi}
                disabled={downloading}
                leftIcon={<Sparkles size={14} />}
                onClick={() => setAiPromptOpen(true)}
              >
                AI auto name
              </Button>
              <DownloadButton
                size="lg"
                variant="primary"
                className="w-full flex-1 [&>div]:w-full [&>div>button:first-child]:flex-1 sm:w-auto"
                loading={downloading}
                onDownload={handleDownloadSelected}
              />
            </div>
          </div>
        </Panel>
      )}

      {(mode === "playlist" || mode === "channel") && (
        <Panel className="animate-fade-up">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <YoutubeThumb
                src={resolveThumbnail(
                  tracks[0]?.thumbnail,
                  tracks[0]?.id,
                  tracks[0]?.url,
                )}
                alt={playlistTitle || (mode === "channel" ? "Channel" : "Playlist")}
                href={siteWatchPath({
                  videoId: tracks[0]?.id,
                  playlistId:
                    mode === "playlist" ? playlistYoutubeId : null,
                  title: playlistTitle,
                })}
                className="h-24 w-40 shrink-0 rounded-lg object-cover sm:h-28 sm:w-48"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ListMusic size={18} className="shrink-0 text-primary" />
                  <h2 className="truncate font-display text-lg font-semibold text-foreground">
                    {playlistTitle ||
                      (mode === "channel" ? "Channel" : "Playlist")}
                  </h2>
                </div>
                {playlistUploader && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {playlistUploader}
                    {channelMeta?.handle ? ` · ${channelMeta.handle}` : ""}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <MetaPill tone={mode === "channel" ? "primary" : "default"}>
                    {mode === "channel" ? "Channel" : "Playlist"}
                  </MetaPill>
                  <MetaPill>{tracks.length} videos</MetaPill>
                  {channelMeta?.truncated && (
                    <MetaPill>First 200 loaded</MetaPill>
                  )}
                  {playlistTotals.duration != null && (
                    <MetaPill>
                      {formatDuration(playlistTotals.duration)} total
                    </MetaPill>
                  )}
                  <SizeMetaPills
                    mp3={playlistTotals.filesize}
                    mp4={playlistTotals.filesizeMp4}
                  />
                </div>
                <YoutubeMediaLinks
                  className="mt-3"
                  videoId={tracks[0]?.id}
                  playlistId={
                    mode === "playlist" ? playlistYoutubeId : null
                  }
                  title={playlistTitle}
                />
              </div>
            </div>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {selectedTracks.length}/{tracks.length} selected
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <Input
              label="Folder name"
              hint="Tracks pack into a zip with this name"
              value={zipName}
              onChange={(e) => setZipName(e.target.value)}
              disabled={downloading || namingAi}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setAllSelected(true)}
              >
                Select all
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setAllSelected(false)}
              >
                Select none
              </Button>
              <Button
                size="sm"
                variant="outline"
                loading={namingAi}
                disabled={downloading || tracks.length === 0}
                leftIcon={<Sparkles size={14} />}
                onClick={() => setAiPromptOpen(true)}
              >
                AI auto name
              </Button>
              {authed && (
                <Button
                  size="sm"
                  variant="outline"
                  loading={savingPlaylist}
                  leftIcon={<BookmarkPlus size={14} />}
                  onClick={async () => {
                    const saved = await handleSavePlaylist();
                    if (saved) {
                      toast.success(
                        mode === "channel"
                          ? "Channel saved to library"
                          : "Playlist saved",
                      );
                    }
                  }}
                >
                  {savedPlaylistDbId
                    ? "Update saved"
                    : mode === "channel"
                      ? "Save channel"
                      : "Save playlist"}
                </Button>
              )}
              <div className="flex w-full flex-col gap-1 sm:ml-auto sm:w-auto sm:items-end">
                {selectedTracks.length > 0 && (
                  <span className="font-mono text-[0.68rem] text-muted-foreground">
                    {selectedTotals.duration
                      ? formatDuration(selectedTotals.duration)
                      : "—"}
                    {selectedTotals.filesize
                      ? ` · ${formatBytes(selectedTotals.filesize)} MP3`
                      : ""}
                    {selectedTotals.filesizeMp4
                      ? ` · ${formatBytes(selectedTotals.filesizeMp4)} MP4`
                      : ""}
                  </span>
                )}
                <DownloadButton
                  className="w-full sm:w-auto"
                  loading={downloading}
                  count={selectedTracks.length}
                  onDownload={handleDownloadSelected}
                />
              </div>
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

            <ul className="m-0 flex max-h-[32rem] list-none flex-col gap-2 overflow-auto p-0">
              {tracks.map((track) => (
                <TrackRow
                  key={track.id}
                  selected={track.selected}
                  checkbox={
                    <Checkbox
                      checked={track.selected}
                      disabled={downloading}
                      onChange={(e) =>
                        toggleTrack(track.id, e.target.checked)
                      }
                      aria-label={`Select ${track.title}`}
                    />
                  }
                  thumb={
                    <YoutubeThumb
                      src={resolveThumbnail(
                        track.thumbnail,
                        track.id,
                        track.url,
                      )}
                      alt={track.title}
                      href={siteWatchPath({
                        videoId: track.id,
                        playlistId: playlistYoutubeId,
                        title: track.title,
                      })}
                      className="h-14 w-20 shrink-0 rounded-md object-cover"
                    />
                  }
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="shrink-0 pt-0.5 font-mono text-xs text-muted-foreground">
                        {track.index}.
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
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 pl-5">
                      {track.duration != null && (
                        <MetaPill>
                          {formatDuration(track.duration)}
                        </MetaPill>
                      )}
                      <SizeMetaPills
                        mp3={track.filesizeMp3 ?? track.filesize}
                        mp4={track.filesizeMp4}
                        estimated={track.filesizeEstimated}
                      />
                      {track.viewCount != null && (
                        <MetaPill>
                          {formatViews(track.viewCount)} views
                        </MetaPill>
                      )}
                    </div>
                    <YoutubeMediaLinks
                      className="mt-2 pl-5"
                      compact
                      videoId={track.id}
                      playlistId={playlistYoutubeId}
                      title={track.title}
                    />
                  </div>
                  <Input
                    label="File name"
                    value={track.filename}
                    onChange={(e) =>
                      updateTrackFilename(track.id, e.target.value)
                    }
                    disabled={downloading || namingAi || !track.selected}
                    className="h-9 text-xs"
                  />
                </TrackRow>
              ))}
            </ul>
          </div>
        </Panel>
      )}

      {authed && (
        <Panel className="animate-fade-up-delay-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <PanelTitle>Your library</PanelTitle>
              <PanelDescription className="mt-1">
                {(playlistsLoading || linksLoading) && "Loading counts…"}
                {!playlistsLoading && !linksLoading && (
                  <>
                    {playlists.length} playlists · {links.length} videos saved
                  </>
                )}
              </PanelDescription>
            </div>
            <Link href="/pages/saved" className={cn("w-full sm:w-auto")}>
              <Button
                variant="primary"
                className="w-full sm:w-auto"
                leftIcon={<ListMusic size={14} />}
              >
                Open library
              </Button>
            </Link>
          </div>
        </Panel>
      )}

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

export default function ConvertPageRoute() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="py-16 text-center font-mono text-xs text-muted-foreground">
            Loading converter…
          </p>
        </PageShell>
      }
    >
      <ConvertPage />
    </Suspense>
  );
}
