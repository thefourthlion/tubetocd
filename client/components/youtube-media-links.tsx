"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Play, Headphones, Loader2 } from "lucide-react";
import {
  siteListenPath,
  siteWatchPath,
  youtubePlaylistUrl,
  youtubeWatchUrl,
} from "@/lib/youtube";
import {
  usePlayerOptional,
  type PlayableTrack,
} from "@/lib/player";
import {
  fetchPlaylist,
  playlistTracksToPlayable,
} from "@/lib/playlists";
import { toast } from "sonner";

type Props = {
  videoId?: string | null;
  playlistId?: string | null;
  /** Saved DB playlist id — Listen loads the full queue. */
  savedPlaylistId?: number | null;
  url?: string | null;
  title?: string | null;
  thumbnail?: string | null;
  /** When set, Listen plays this queue from queueIndex. */
  queue?: PlayableTrack[];
  queueIndex?: number;
  className?: string;
  compact?: boolean;
};

export function YoutubeMediaLinks({
  videoId,
  playlistId,
  savedPlaylistId,
  url,
  title,
  thumbnail,
  queue,
  queueIndex = 0,
  className = "",
  compact = false,
}: Props) {
  const player = usePlayerOptional();
  const [loadingListen, setLoadingListen] = useState(false);

  if (!videoId && !playlistId && !url && !savedPlaylistId) return null;

  const watchHref = siteWatchPath({
    videoId,
    playlistId,
    savedPlaylistId,
    title,
  });
  const canListen =
    Boolean(queue?.length) ||
    Boolean(savedPlaylistId) ||
    Boolean(videoId || url);
  const listenHref =
    videoId || url
      ? siteListenPath({ videoId, url, title, thumbnail })
      : savedPlaylistId
        ? `/pages/playlists/detail?id=${savedPlaylistId}`
        : null;
  const youtubeHref = videoId
    ? youtubeWatchUrl(videoId)
    : playlistId
      ? youtubePlaylistUrl(playlistId)
      : null;

  const sourceUrl = url || (videoId ? youtubeWatchUrl(videoId) : null);

  const linkClass = compact
    ? "inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    : "inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/80";

  const handleListen = async (e: React.MouseEvent) => {
    if (!player) return;

    if (queue && queue.length > 0) {
      e.preventDefault();
      void player.playQueue(queue, queueIndex);
      return;
    }

    if (savedPlaylistId) {
      e.preventDefault();
      setLoadingListen(true);
      try {
        const playlist = await fetchPlaylist(savedPlaylistId);
        const tracks = playlistTracksToPlayable(playlist.tracks || []);
        if (!tracks.length) {
          toast.error("No playable tracks in this playlist");
          return;
        }
        await player.playQueue(tracks, 0);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load playlist",
        );
      } finally {
        setLoadingListen(false);
      }
      return;
    }

    if (!sourceUrl) return;
    e.preventDefault();
    void player.play({
      id: videoId || sourceUrl,
      url: sourceUrl,
      title: title || "Audio preview",
      thumbnail,
    });
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Link href={watchHref} className={linkClass}>
        <Play size={compact ? 12 : 14} />
        Watch here
      </Link>
      {canListen && listenHref && (
        <Link
          href={listenHref}
          className={linkClass}
          onClick={(e) => {
            void handleListen(e);
          }}
          aria-busy={loadingListen}
        >
          {loadingListen ? (
            <Loader2 size={compact ? 12 : 14} className="animate-spin" />
          ) : (
            <Headphones size={compact ? 12 : 14} />
          )}
          Listen
        </Link>
      )}
      {youtubeHref && (
        <a
          href={youtubeHref}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          <ExternalLink size={compact ? 12 : 14} />
          YouTube
        </a>
      )}
    </div>
  );
}

type ThumbProps = {
  src: string | null;
  alt?: string;
  href?: string;
  className?: string;
};

export function YoutubeThumb({
  src,
  alt = "",
  href,
  className = "h-14 w-20 shrink-0 rounded-md object-cover",
}: ThumbProps) {
  if (!src) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-muted text-muted-foreground`}
        aria-hidden
      >
        <Play size={18} />
      </div>
    );
  }

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  );

  if (!href) return image;

  return (
    <Link href={href} className="shrink-0 overflow-hidden rounded-md">
      {image}
    </Link>
  );
}
