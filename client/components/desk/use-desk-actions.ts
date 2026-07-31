"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DeskItem } from "@/lib/desk";
import { deskItemFromPlaylistEntry } from "@/lib/desk";
import { usePlayer } from "@/lib/player";
import {
  fetchPlaylist,
  playlistDetailPath,
  playlistTracksToPlayable,
  savePlaylist,
} from "@/lib/playlists";
import { useTransfers } from "@/lib/transfers";
import {
  downloadBatch,
  downloadMp3,
  resolveYoutubeInfo,
  siteWatchPath,
} from "@/lib/youtube";

export type DeskActions = ReturnType<typeof useDeskActions>;

/**
 * Shared behaviour for the desk's action bar. `onLibraryChange` lets a view
 * refresh itself after a download or save mutates the library.
 */
export function useDeskActions(options?: {
  onLibraryChange?: () => void;
  /** Called when a YouTube playlist is expanded into its tracks. */
  onDrill?: (items: DeskItem[], title: string) => void;
}) {
  const router = useRouter();
  const player = usePlayer();
  const transfers = useTransfers();
  const [busy, setBusy] = useState(false);

  const onLibraryChange = options?.onLibraryChange;
  const onDrill = options?.onDrill;

  const openPlaylist = useCallback(
    async (item: DeskItem) => {
      if (item.savedPlaylistId != null) {
        router.push(playlistDetailPath(item.savedPlaylistId));
        return;
      }
      if (!item.url || !onDrill) return;
      setBusy(true);
      try {
        const info = await resolveYoutubeInfo(item.url);
        if (info.type !== "playlist") {
          toast.error("That link is not a playlist");
          return;
        }
        onDrill(
          info.entries.map((entry) =>
            deskItemFromPlaylistEntry(entry, info.playlistId),
          ),
          info.title,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to open");
      } finally {
        setBusy(false);
      }
    },
    [router, onDrill],
  );

  const listen = useCallback(
    async (item: DeskItem, context: DeskItem[]) => {
      if (item.kind === "playlist") {
        if (item.savedPlaylistId == null) {
          await openPlaylist(item);
          return;
        }
        try {
          const playlist = await fetchPlaylist(item.savedPlaylistId);
          const tracks = playlistTracksToPlayable(playlist.tracks ?? []);
          if (!tracks.length) {
            toast.error("This playlist has no playable tracks");
            return;
          }
          await player.playQueue(tracks, 0);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to play");
        }
        return;
      }

      if (!item.url) {
        toast.error("No source link for this item");
        return;
      }

      const queue = context.filter((i) => i.kind !== "playlist" && i.url);
      const startIndex = Math.max(
        0,
        queue.findIndex((i) => i.key === item.key),
      );
      await player.playQueue(
        queue.map((i) => ({
          id: i.videoId || i.url,
          url: i.url,
          title: i.title,
          uploader: i.channel,
          thumbnail: i.thumbnail,
          item: i,
        })),
        startIndex,
      );
    },
    [player, openPlaylist],
  );

  const download = useCallback(
    async (item: DeskItem) => {
      if (item.kind === "playlist") {
        toast.error("Open the playlist, then download its tracks");
        await openPlaylist(item);
        return;
      }
      if (!item.url) {
        toast.error("No source link for this item");
        return;
      }

      const transferId = transfers.start({
        name: item.title,
        type: item.type,
        estimatedSize: item.size,
      });
      setBusy(true);
      try {
        const result = await downloadMp3(item.url, {
          filename: item.title,
          artist: item.channel,
          album: item.album || item.channel,
          thumbnail: item.thumbnail,
          onProgress: (progress) => transfers.update(transferId, progress),
        });
        transfers.complete(transferId, result.title);
        toast.success(`Downloaded “${result.title}”`);
        onLibraryChange?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Download failed";
        transfers.fail(transferId, message);
        toast.error(message);
      } finally {
        setBusy(false);
      }
    },
    [transfers, onLibraryChange, openPlaylist],
  );

  const downloadAll = useCallback(
    async (items: DeskItem[], zipName: string) => {
      const targets = items.filter((i) => i.kind !== "playlist" && i.url);
      if (targets.length === 0) {
        toast.error("Nothing to download in this view");
        return;
      }
      if (targets.length > 40) {
        toast.error("Narrow the list to 40 items or fewer");
        return;
      }

      const transferId = transfers.start({
        name: `${zipName} (${targets.length} tracks)`,
        type: "zip",
        estimatedSize:
          targets.reduce((sum, i) => sum + (i.size || 0), 0) || null,
      });
      setBusy(true);
      try {
        const filename = await downloadBatch(
          targets.map((item, index) => ({
            url: item.url,
            filename: item.title,
            title: item.title,
            id: item.videoId || undefined,
            uploader: item.channel,
            thumbnail: item.thumbnail,
            index: index + 1,
          })),
          zipName,
          { onProgress: (progress) => transfers.update(transferId, progress) },
        );
        transfers.complete(transferId, filename);
        toast.success(`Downloaded ${targets.length} tracks`);
        onLibraryChange?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Download failed";
        transfers.fail(transferId, message);
        toast.error(message);
      } finally {
        setBusy(false);
      }
    },
    [transfers, onLibraryChange],
  );

  const saveList = useCallback(
    async (items: DeskItem[], title: string) => {
      const tracks = items.filter((i) => i.kind !== "playlist" && i.url);
      const playlistId = tracks.find((i) => i.playlistId)?.playlistId;
      if (!playlistId) {
        toast.error("Load a YouTube playlist to save it");
        return;
      }
      setBusy(true);
      try {
        await savePlaylist({
          youtubePlaylistId: playlistId,
          title,
          uploader: tracks[0]?.channel ?? null,
          sourceUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
          tracks: tracks.map((item, index) => ({
            videoId: item.videoId || undefined,
            url: item.url,
            title: item.title,
            uploader: item.channel,
            filename: item.title,
            duration: item.duration,
            filesize: item.size,
            viewCount: item.views,
            thumbnail: item.thumbnail,
            index: index + 1,
          })),
        });
        toast.success("Playlist saved to your library");
        onLibraryChange?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setBusy(false);
      }
    },
    [onLibraryChange],
  );

  const watch = useCallback(
    (item: DeskItem) => {
      router.push(
        siteWatchPath({
          videoId: item.videoId,
          playlistId: item.playlistId,
          savedPlaylistId: item.savedPlaylistId,
          title: item.title,
        }),
      );
    },
    [router],
  );

  return { busy, openPlaylist, listen, download, downloadAll, saveList, watch };
}
