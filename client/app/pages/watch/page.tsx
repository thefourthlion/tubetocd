"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ExternalLink,
  Headphones,
  SkipBack,
  SkipForward,
  Shuffle,
  ListOrdered,
  Loader2,
} from "lucide-react";
import {
  siteListenPath,
  youtubeEmbedSrc,
  youtubePlaylistUrl,
  youtubeWatchUrl,
} from "@/lib/youtube";
import {
  fetchPlaylist,
  playlistTracksToPlayable,
  type SavedPlaylistTrack,
} from "@/lib/playlists";
import { usePlayerOptional } from "@/lib/player";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { LoadingBlock, PageShell } from "@/components/ui/page";
import { cn } from "@/lib/utils";

function shuffleOrder(length: number, startIndex: number): number[] {
  const rest = Array.from({ length }, (_, i) => i).filter(
    (i) => i !== startIndex,
  );
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [startIndex, ...rest];
}

function WatchPlayer() {
  const searchParams = useSearchParams();
  const videoIdParam = searchParams.get("v");
  const playlistId = searchParams.get("list");
  const savedId = searchParams.get("saved");
  const titleParam = searchParams.get("title") || "Watch / Listen";
  const startIndexParam = Number(searchParams.get("i") || "0");

  const player = usePlayerOptional();

  const [tracks, setTracks] = useState<SavedPlaylistTrack[]>([]);
  const [playlistTitle, setPlaylistTitle] = useState(titleParam);
  const [loadingSaved, setLoadingSaved] = useState(Boolean(savedId));
  const [order, setOrder] = useState<number[]>([]);
  const [orderPos, setOrderPos] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [listenLoading, setListenLoading] = useState(false);

  useEffect(() => {
    if (!savedId) {
      setTracks([]);
      setLoadingSaved(false);
      return;
    }

    let cancelled = false;
    setLoadingSaved(true);
    fetchPlaylist(savedId)
      .then((playlist) => {
        if (cancelled) return;
        const list = [...(playlist.tracks || [])].sort(
          (a, b) => a.trackIndex - b.trackIndex,
        );
        setTracks(list);
        setPlaylistTitle(playlist.title || titleParam);
        const start = Math.max(
          0,
          Math.min(
            Number.isFinite(startIndexParam) ? startIndexParam : 0,
            Math.max(0, list.length - 1),
          ),
        );
        setOrder(Array.from({ length: list.length }, (_, i) => i));
        setOrderPos(start);
        setShuffle(false);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(
          err instanceof Error ? err.message : "Failed to load playlist",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingSaved(false);
      });

    return () => {
      cancelled = true;
    };
  }, [savedId, startIndexParam, titleParam]);

  const savedMode = Boolean(savedId) && tracks.length > 0;
  const currentTrack = savedMode ? tracks[order[orderPos] ?? 0] : null;
  const activeVideoId = currentTrack?.videoId || videoIdParam;

  const embedSrc = useMemo(() => {
    if (savedMode && activeVideoId) {
      // Single-video embeds so we control order/shuffle (not YouTube's list player).
      return youtubeEmbedSrc({ videoId: activeVideoId });
    }
    return youtubeEmbedSrc({ videoId: videoIdParam, playlistId });
  }, [savedMode, activeVideoId, videoIdParam, playlistId]);

  const displayTitle = savedMode
    ? currentTrack?.title || playlistTitle
    : titleParam;

  const youtubeHref = activeVideoId
    ? youtubeWatchUrl(activeVideoId)
    : playlistId
      ? youtubePlaylistUrl(playlistId)
      : null;

  const listenHref = siteListenPath({
    videoId: activeVideoId,
    url: currentTrack?.link,
    title: displayTitle,
    thumbnail: currentTrack?.thumbnail,
  });

  const goTo = useCallback(
    (pos: number) => {
      if (!order.length) return;
      const next = ((pos % order.length) + order.length) % order.length;
      setOrderPos(next);
    },
    [order.length],
  );

  const handleNext = () => {
    if (!order.length) return;
    goTo(orderPos + 1);
  };

  const handlePrev = () => {
    if (!order.length) return;
    goTo(orderPos - 1);
  };

  const handleToggleShuffle = () => {
    if (tracks.length < 2) {
      setShuffle((s) => !s);
      return;
    }
    const currentIndex = order[orderPos] ?? 0;
    if (!shuffle) {
      const nextOrder = shuffleOrder(tracks.length, currentIndex);
      setOrder(nextOrder);
      setOrderPos(0);
      setShuffle(true);
    } else {
      setOrder(Array.from({ length: tracks.length }, (_, i) => i));
      setOrderPos(currentIndex);
      setShuffle(false);
    }
  };

  const handlePlayInOrder = () => {
    if (!tracks.length) return;
    const currentIndex = order[orderPos] ?? 0;
    setOrder(Array.from({ length: tracks.length }, (_, i) => i));
    setOrderPos(currentIndex);
    setShuffle(false);
  };

  const handleListenQueue = async (shuffled: boolean) => {
    if (!player) {
      toast.error("Sign in to listen in the player");
      return;
    }
    const playable = playlistTracksToPlayable(tracks);
    if (!playable.length && activeVideoId) {
      void player.play({
        id: activeVideoId,
        url: currentTrack?.link || youtubeWatchUrl(activeVideoId),
        title: displayTitle,
        thumbnail: currentTrack?.thumbnail,
      });
      return;
    }
    if (!playable.length) {
      toast.error("No playable tracks");
      return;
    }
    setListenLoading(true);
    try {
      const start = savedMode ? (order[orderPos] ?? 0) : 0;
      const startInPlayable = Math.max(
        0,
        playable.findIndex((t) => t.id === tracks[start]?.videoId),
      );
      await player.playQueue(
        playable,
        startInPlayable >= 0 ? startInPlayable : 0,
        { shuffle: shuffled },
      );
    } finally {
      setListenLoading(false);
    }
  };

  if (loadingSaved) {
    return (
      <PageShell>
        <LoadingBlock label="Loading playlist…" />
      </PageShell>
    );
  }

  if (!embedSrc) {
    return (
      <PageShell>
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No video or playlist selected.</p>
          <Link href="/home" className="mt-4 inline-block">
            <Button variant="soft">Back to desk</Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell width="lg">
      <div className="flex flex-wrap items-center gap-2 animate-fade-up">
        <Link href={savedId ? `/pages/playlists/detail?id=${savedId}` : "/home"}>
          <Button size="sm" variant="secondary" leftIcon={<ArrowLeft size={14} />}>
            Back to desk
          </Button>
        </Link>
        {youtubeHref && (
          <a href={youtubeHref} target="_blank" rel="noopener noreferrer">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<ExternalLink size={14} />}
            >
              Open on YouTube
            </Button>
          </a>
        )}
        {savedMode ? (
          <>
            <Button
              size="sm"
              variant="outline"
              leftIcon={
                listenLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Headphones size={14} />
                )
              }
              disabled={listenLoading}
              onClick={() => void handleListenQueue(false)}
            >
              Listen in order
            </Button>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Shuffle size={14} />}
              disabled={listenLoading}
              onClick={() => void handleListenQueue(true)}
            >
              Shuffle listen
            </Button>
          </>
        ) : (
          activeVideoId && (
            <Link href={listenHref}>
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Headphones size={14} />}
              >
                Listen (MP3)
              </Button>
            </Link>
          )
        )}
      </div>

      <div className="animate-fade-up-delay-1">
        <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {displayTitle}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {savedMode
            ? `${playlistTitle} · ${orderPos + 1}/${tracks.length}${
                shuffle ? " · shuffled" : " · in order"
              }`
            : "Stream below, or open on YouTube / preview the MP3."}
        </p>
      </div>

      <Panel
        padded={false}
        className="overflow-hidden bg-black animate-fade-up-delay-2"
      >
        <div className="relative aspect-video w-full">
          <iframe
            key={activeVideoId || embedSrc}
            src={embedSrc}
            title={displayTitle}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </Panel>

      {savedMode && (
        <div className="flex flex-wrap items-center justify-center gap-2 animate-fade-up-delay-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<ListOrdered size={14} />}
            aria-pressed={!shuffle}
            className={cn(!shuffle && "border-primary/40 text-primary")}
            onClick={handlePlayInOrder}
          >
            In order
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Shuffle size={14} />}
            aria-pressed={shuffle}
            className={cn(shuffle && "border-primary/40 text-primary")}
            onClick={handleToggleShuffle}
          >
            Shuffle
          </Button>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<SkipBack size={14} />}
            onClick={handlePrev}
            disabled={tracks.length < 2}
          >
            Prev
          </Button>
          <Button
            size="sm"
            variant="outline"
            rightIcon={<SkipForward size={14} />}
            onClick={handleNext}
            disabled={tracks.length < 2}
          >
            Next
          </Button>
        </div>
      )}

      {savedMode && tracks.length > 0 && (
        <Panel className="animate-fade-up-delay-2">
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Up next
          </h2>
          <ul className="m-0 flex max-h-72 list-none flex-col gap-1 overflow-y-auto p-0">
            {order.map((trackIndex, pos) => {
              const track = tracks[trackIndex];
              if (!track) return null;
              const active = pos === orderPos;
              return (
                <li key={`${track.videoId}-${pos}`}>
                  <button
                    type="button"
                    onClick={() => setOrderPos(pos)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                      active
                        ? "bg-primary/15 text-foreground"
                        : "hover:bg-muted/70 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="w-6 shrink-0 font-mono text-xs tabular-nums opacity-70">
                      {pos + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {track.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </PageShell>
  );
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <LoadingBlock label="Loading player…" />
        </PageShell>
      }
    >
      <WatchPlayer />
    </Suspense>
  );
}
