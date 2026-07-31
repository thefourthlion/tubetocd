"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { isAuthenticated } from "@/lib/auth";
import type { DeskItem } from "@/lib/desk";
import { fetchLibrary } from "@/lib/library";
import { deletePlaylist, savePlaylist } from "@/lib/playlists";
import {
  deleteLink,
  resolveYoutubeInfo,
  saveLink,
} from "@/lib/youtube";

export type SavedHeartKey = string;

/** Stable key for a heartable video or playlist row. */
export function heartKeyForItem(item: DeskItem): SavedHeartKey | null {
  if (item.kind === "playlist") {
    return item.playlistId ? `playlist:${item.playlistId}` : null;
  }
  return item.videoId ? `video:${item.videoId}` : null;
}

type SavedMaps = {
  /** youtubeLinks.id by videoId */
  videos: Map<string, number>;
  /** playlists.id by youtubePlaylistId */
  playlists: Map<string, number>;
  /** videoIds that appear as tracks inside saved playlists */
  playlistTrackVideos: Set<string>;
};

function emptyMaps(): SavedMaps {
  return {
    videos: new Map(),
    playlists: new Map(),
    playlistTrackVideos: new Set(),
  };
}

function isLibraryRow(item: DeskItem): boolean {
  return (
    item.key.startsWith("link:") ||
    item.key.startsWith("track:") ||
    item.key.startsWith("playlist:") ||
    item.savedPlaylistId != null
  );
}

/**
 * Heart / save state for desk rows. Videos go to youtubeLinks; playlists are
 * resolved then stored with their tracks so they can be downloaded later.
 */
export function useSavedHearts(options?: { onLibraryChange?: () => void }) {
  const [signedIn, setSignedIn] = useState(false);
  const [saved, setSaved] = useState<SavedMaps>(emptyMaps);
  const [pending, setPending] = useState<Set<SavedHeartKey>>(new Set());
  const onLibraryChange = options?.onLibraryChange;

  const load = useCallback(() => {
    if (!isAuthenticated()) {
      setSignedIn(false);
      setSaved(emptyMaps());
      return;
    }
    setSignedIn(true);
    fetchLibrary({ type: "all" })
      .then((library) => {
        const videos = new Map<string, number>();
        for (const video of library.videos) {
          if (video.videoId) videos.set(video.videoId, video.id);
        }
        const playlists = new Map<string, number>();
        for (const playlist of library.playlists) {
          if (playlist.youtubePlaylistId) {
            playlists.set(playlist.youtubePlaylistId, playlist.id);
          }
        }
        const playlistTrackVideos = new Set<string>();
        for (const track of library.tracks) {
          if (track.videoId) playlistTrackVideos.add(track.videoId);
        }
        setSaved({ videos, playlists, playlistTrackVideos });
      })
      .catch(() => {
        // Hearts stay empty until the next refresh; saving still works.
      });
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("auth-changed", load);
    return () => window.removeEventListener("auth-changed", load);
  }, [load]);

  const isSaved = useCallback(
    (item: DeskItem) => {
      // Library page rows are already in the account.
      if (isLibraryRow(item)) return true;

      if (item.kind === "playlist") {
        return Boolean(item.playlistId && saved.playlists.has(item.playlistId));
      }

      if (!item.videoId) return false;
      return (
        saved.videos.has(item.videoId) ||
        saved.playlistTrackVideos.has(item.videoId)
      );
    },
    [saved],
  );

  const isPending = useCallback(
    (item: DeskItem) => {
      const key = heartKeyForItem(item);
      return key ? pending.has(key) : false;
    },
    [pending],
  );

  const toggle = useCallback(
    async (item: DeskItem) => {
      if (!isAuthenticated()) {
        toast.error("Sign in to save for later");
        return;
      }

      const key = heartKeyForItem(item);
      if (!key) {
        toast.error("Nothing to save on this row");
        return;
      }

      if (pending.has(key)) return;

      // Playlist tracks live inside a saved playlist — remove the playlist
      // itself rather than a single track heart.
      if (item.key.startsWith("track:") || item.kind === "track") {
        if (item.savedPlaylistId != null) {
          toast.message("This track is saved with its playlist");
          return;
        }
      }

      setPending((current) => new Set(current).add(key));

      try {
        if (item.kind === "playlist") {
          const playlistId = item.playlistId;
          if (!playlistId) {
            toast.error("Playlist is missing an id");
            return;
          }

          const existingId =
            item.savedPlaylistId ?? saved.playlists.get(playlistId) ?? null;

          if (existingId != null) {
            await deletePlaylist(existingId);
            setSaved((current) => {
              const playlists = new Map(current.playlists);
              playlists.delete(playlistId);
              return { ...current, playlists };
            });
            toast.success("Removed from your library");
            onLibraryChange?.();
            return;
          }

          if (!item.url) {
            toast.error("No playlist link to save");
            return;
          }

          toast.message(
            item.type === "channel" ? "Saving channel…" : "Saving playlist…",
          );
          const info = await resolveYoutubeInfo(item.url);
          if (info.type !== "playlist" && info.type !== "channel") {
            toast.error("That link is not a playlist or channel");
            return;
          }

          const savedPlaylist = await savePlaylist({
            youtubePlaylistId: info.playlistId || playlistId,
            kind: info.type === "channel" ? "channel" : "playlist",
            youtubeChannelId:
              info.type === "channel" ? info.channelId : null,
            handle: info.type === "channel" ? info.handle : null,
            title: info.title || item.title,
            uploader: info.uploader ?? item.channel,
            sourceUrl: info.sourceUrl || item.url,
            tracks: info.entries.map((entry, index) => ({
              videoId: entry.id,
              url: entry.url,
              title: entry.title,
              uploader: entry.uploader,
              filename: entry.filename,
              duration: entry.duration,
              filesize: entry.filesize,
              viewCount: entry.viewCount,
              thumbnail: entry.thumbnail,
              index: entry.index || index + 1,
            })),
          });

          setSaved((current) => {
            const playlists = new Map(current.playlists);
            playlists.set(savedPlaylist.youtubePlaylistId, savedPlaylist.id);
            const playlistTrackVideos = new Set(current.playlistTrackVideos);
            for (const entry of info.entries) {
              if (entry.id) playlistTrackVideos.add(entry.id);
            }
            return { ...current, playlists, playlistTrackVideos };
          });
          toast.success(
            info.type === "channel"
              ? "Channel saved for later"
              : "Playlist saved for later",
          );
          onLibraryChange?.();
          return;
        }

        const videoId = item.videoId;
        if (!videoId || !item.url) {
          toast.error("No video link to save");
          return;
        }

        const existingId =
          item.key.startsWith("link:")
            ? Number(item.key.slice("link:".length)) ||
              saved.videos.get(videoId) ||
              null
            : saved.videos.get(videoId) ?? null;

        if (existingId != null) {
          await deleteLink(existingId);
          setSaved((current) => {
            const videos = new Map(current.videos);
            videos.delete(videoId);
            return { ...current, videos };
          });
          toast.success("Removed from your library");
          onLibraryChange?.();
          return;
        }

        if (saved.playlistTrackVideos.has(videoId)) {
          toast.message("This video is already saved inside a playlist");
          return;
        }

        const record = await saveLink({
          link: item.url,
          title: item.title,
          videoId,
        });
        setSaved((current) => {
          const videos = new Map(current.videos);
          videos.set(videoId, record.id);
          return { ...current, videos };
        });
        toast.success("Saved for later");
        onLibraryChange?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setPending((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
    },
    [pending, saved, onLibraryChange],
  );

  return {
    canSave: signedIn,
    isSaved,
    isPending,
    toggle,
    refresh: load,
  };
}
