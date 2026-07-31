"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DeskItem } from "@/lib/desk";
import { streamMp3Preview } from "@/lib/youtube";

export type PlayableTrack = {
  id: string;
  url: string;
  title: string;
  uploader?: string | null;
  thumbnail?: string | null;
  filename?: string | null;
  /**
   * The desk row this track was queued from, so the player bar can show the
   * same details sheet the search and library tables offer.
   */
  item?: DeskItem | null;
};

export type RepeatMode = "off" | "one" | "all";

type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "error";

type PlayerContextValue = {
  track: PlayableTrack | null;
  queue: PlayableTrack[];
  queueIndex: number;
  queueLength: number;
  shuffle: boolean;
  repeat: RepeatMode;
  status: PlayerStatus;
  error: string | null;
  currentTime: number;
  duration: number;
  volume: number;
  play: (track: PlayableTrack) => Promise<void>;
  playQueue: (
    tracks: PlayableTrack[],
    startIndex?: number,
    options?: { shuffle?: boolean },
  ) => Promise<void>;
  toggle: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

/** Transient YouTube/stream failures are common — retry lightly.
 *  The server already cycles player clients, so avoid stacking full converts. */
const LOAD_ATTEMPTS = 2;
const LOAD_RETRY_DELAYS_MS = [1500];

function isFatalStreamError(message: string): boolean {
  return /private|members-only|sign.?in|cookies|not a bot|403|blocked the stream/i.test(
    message,
  );
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isAbortError(err: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      err instanceof DOMException &&
      err.name === "AbortError") ||
    (err instanceof Error &&
      (err.name === "AbortError" || /aborted|cancell?ed/i.test(err.message)))
  );
}

/** Wait until the element can decode enough of `src` to start playback. */
function waitForAudioReady(
  audio: HTMLAudioElement,
  src: string,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    let settled = false;
    const timeout = window.setTimeout(() => {
      settle(() => reject(new Error("Audio took too long to load")));
    }, 30_000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("loadeddata", onReady);
      audio.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };
    const onReady = () => settle(() => resolve());
    const onError = () =>
      settle(() => reject(new Error("Could not decode audio")));
    const onAbort = () =>
      settle(() => reject(new DOMException("Aborted", "AbortError")));

    audio.addEventListener("canplay", onReady);
    audio.addEventListener("loadeddata", onReady);
    audio.addEventListener("error", onError);
    signal?.addEventListener("abort", onAbort, { once: true });

    audio.src = src;
    audio.load();

    // Some engines already have data ready synchronously.
    if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      settle(() => resolve());
    }
  });
}

function shuffleIndices(length: number, startIndex: number): number[] {
  const rest = Array.from({ length }, (_, i) => i).filter(
    (i) => i !== startIndex,
  );
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [startIndex, ...rest];
}

function sequentialIndices(length: number): number[] {
  return Array.from({ length }, (_, i) => i);
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const playbackErrorAttemptsRef = useRef(0);
  /** True only after audio is ready and playing — ignores errors from src clears. */
  const playbackArmedRef = useRef(false);

  const [track, setTrack] = useState<PlayableTrack | null>(null);
  const [queue, setQueue] = useState<PlayableTrack[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [orderPos, setOrderPos] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.9);

  const queueRef = useRef(queue);
  const orderRef = useRef(order);
  const orderPosRef = useRef(orderPos);
  const shuffleRef = useRef(shuffle);
  const repeatRef = useRef(repeat);
  const loadTrackRef = useRef<(next: PlayableTrack) => Promise<void>>(
    async () => undefined,
  );
  const advanceRef = useRef<() => void>(() => undefined);
  const skipFailedRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    orderRef.current = order;
  }, [order]);
  useEffect(() => {
    orderPosRef.current = orderPos;
  }, [orderPos]);
  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);
  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);

  const clearObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const loadTrack = useCallback(async (next: PlayableTrack) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Cancel any in-flight stream so retries/skips don't stack yt-dlp jobs.
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    const requestId = ++requestIdRef.current;
    playbackArmedRef.current = false;
    setTrack(next);
    setStatus("loading");
    setError(null);
    setCurrentTime(0);
    setDuration(0);
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    clearObjectUrl();

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= LOAD_ATTEMPTS; attempt += 1) {
      if (requestId !== requestIdRef.current || abort.signal.aborted) return;

      try {
        if (attempt > 1) {
          setError(`Retrying… (${attempt}/${LOAD_ATTEMPTS})`);
          setStatus("loading");
        }

        const result = await streamMp3Preview(next.url, {
          filename: next.filename || next.title,
          thumbnail: next.thumbnail,
          signal: abort.signal,
        });
        if (requestId !== requestIdRef.current || abort.signal.aborted) {
          URL.revokeObjectURL(result.objectUrl);
          return;
        }
        objectUrlRef.current = result.objectUrl;
        await waitForAudioReady(audio, result.objectUrl, abort.signal);
        if (requestId !== requestIdRef.current || abort.signal.aborted) return;
        await audio.play();
        if (requestId !== requestIdRef.current || abort.signal.aborted) return;
        setError(null);
        setStatus("playing");
        playbackErrorAttemptsRef.current = 0;
        playbackArmedRef.current = true;
        return;
      } catch (err) {
        if (isAbortError(err) || requestId !== requestIdRef.current) return;

        lastError = err;
        clearObjectUrl();
        audio.removeAttribute("src");
        audio.load();

        // Browser autoplay blocks won't succeed on retry — stop immediately.
        const message = err instanceof Error ? err.message : String(err);
        if (/NotAllowedError|user didn't interact|autoplay/i.test(message)) {
          break;
        }
        // Server already exhausted extractor clients / video is gated.
        if (isFatalStreamError(message)) {
          break;
        }

        if (attempt < LOAD_ATTEMPTS) {
          const delay = LOAD_RETRY_DELAYS_MS[attempt - 1] ?? 1500;
          setError(
            err instanceof Error
              ? `${err.message} — retrying…`
              : "Failed to prepare audio — retrying…",
          );
          await sleep(delay);
          continue;
        }
      }
    }

    if (requestId !== requestIdRef.current || abort.signal.aborted) return;
    setStatus("error");
    setError(
      lastError instanceof Error
        ? lastError.message
        : "Failed to prepare audio",
    );
    // Skip only after every retry on this track has failed.
    if (orderRef.current.length > 1) {
      window.setTimeout(() => {
        if (requestId !== requestIdRef.current) return;
        skipFailedRef.current();
      }, 800);
    }
  }, []);

  loadTrackRef.current = loadTrack;

  const playAtOrderPos = useCallback(
    (pos: number) => {
      const q = queueRef.current;
      const ord = orderRef.current;
      if (!q.length || !ord.length) return;
      const clamped = ((pos % ord.length) + ord.length) % ord.length;
      const trackIndex = ord[clamped];
      const nextTrack = q[trackIndex];
      if (!nextTrack) return;
      setOrderPos(clamped);
      orderPosRef.current = clamped;
      void loadTrackRef.current(nextTrack);
    },
    [],
  );

  const advance = useCallback((opts?: { forceNext?: boolean }) => {
    const audio = audioRef.current;
    const mode = repeatRef.current;
    const ord = orderRef.current;
    const pos = orderPosRef.current;

    if (mode === "one" && !opts?.forceNext) {
      if (audio) {
        audio.currentTime = 0;
        void audio.play();
        setStatus("playing");
        setCurrentTime(0);
      }
      return;
    }

    if (ord.length <= 1) {
      if (mode === "all" && ord.length === 1) {
        playAtOrderPos(0);
        return;
      }
      setStatus("paused");
      setCurrentTime(0);
      return;
    }

    const nextPos = pos + 1;
    if (nextPos >= ord.length) {
      if (mode === "all") {
        playAtOrderPos(0);
        return;
      }
      setStatus("paused");
      setCurrentTime(0);
      return;
    }

    playAtOrderPos(nextPos);
  }, [playAtOrderPos]);

  advanceRef.current = () => advance();
  skipFailedRef.current = () => advance({ forceNext: true });

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onMeta = () => setDuration(audio.duration || 0);
    const onPlay = () => setStatus("playing");
    const onPause = () => {
      if (!audio.ended) setStatus("paused");
    };
    const onEnded = () => {
      advanceRef.current();
    };
    const onError = () => {
      if (!playbackArmedRef.current) return;
      playbackArmedRef.current = false;
      const current = queueRef.current[orderRef.current[orderPosRef.current]];
      playbackErrorAttemptsRef.current += 1;
      // One soft reload of the same track; avoid 4× full re-converts.
      if (current && playbackErrorAttemptsRef.current <= 1) {
        setError("Playback glitched — reloading…");
        void loadTrackRef.current(current);
        return;
      }
      setStatus("error");
      setError("Playback failed");
      if (orderRef.current.length > 1) {
        window.setTimeout(() => {
          skipFailedRef.current();
        }, 800);
      }
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const playQueue = useCallback(
    async (
      tracks: PlayableTrack[],
      startIndex = 0,
      options?: { shuffle?: boolean },
    ) => {
      const playable = tracks.filter((t) => t.url);
      if (!playable.length) {
        setStatus("error");
        setError("No playable tracks in this playlist");
        return;
      }

      const start = Math.max(0, Math.min(startIndex, playable.length - 1));
      const useShuffle = options?.shuffle ?? shuffleRef.current;
      const nextOrder = useShuffle
        ? shuffleIndices(playable.length, start)
        : sequentialIndices(playable.length);
      const pos = useShuffle ? 0 : start;

      setQueue(playable);
      setOrder(nextOrder);
      setOrderPos(pos);
      setShuffle(useShuffle);
      queueRef.current = playable;
      orderRef.current = nextOrder;
      orderPosRef.current = pos;
      shuffleRef.current = useShuffle;

      const nextTrack = playable[nextOrder[pos]];
      if (nextTrack) await loadTrack(nextTrack);
    },
    [loadTrack],
  );

  const play = useCallback(
    async (next: PlayableTrack) => {
      await playQueue([next], 0, { shuffle: false });
    },
    [playQueue],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (status === "loading") return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  }, [status, track]);

  const stop = useCallback(() => {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    playbackArmedRef.current = false;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    clearObjectUrl();
    setTrack(null);
    setQueue([]);
    setOrder([]);
    setOrderPos(0);
    setStatus("idle");
    setError(null);
    setCurrentTime(0);
    setDuration(0);
    queueRef.current = [];
    orderRef.current = [];
    orderPosRef.current = 0;
  }, []);

  const next = useCallback(() => {
    const ord = orderRef.current;
    if (ord.length <= 1) {
      if (repeatRef.current === "all" || repeatRef.current === "one") {
        playAtOrderPos(0);
      }
      return;
    }
    const nextPos = orderPosRef.current + 1;
    if (nextPos >= ord.length) {
      if (repeatRef.current === "all" || repeatRef.current === "one") {
        playAtOrderPos(0);
      }
      return;
    }
    playAtOrderPos(nextPos);
  }, [playAtOrderPos]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    const ord = orderRef.current;
    if (ord.length <= 1) {
      if (audio) {
        audio.currentTime = 0;
        setCurrentTime(0);
      }
      return;
    }
    const prevPos = orderPosRef.current - 1;
    if (prevPos < 0) {
      if (repeatRef.current === "all") {
        playAtOrderPos(ord.length - 1);
      } else if (audio) {
        audio.currentTime = 0;
        setCurrentTime(0);
      }
      return;
    }
    playAtOrderPos(prevPos);
  }, [playAtOrderPos]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(time)) return;
    audio.currentTime = Math.max(0, Math.min(time, audio.duration || time));
    setCurrentTime(audio.currentTime);
  }, []);

  const setVolume = useCallback((value: number) => {
    setVolumeState(Math.max(0, Math.min(1, value)));
  }, []);

  const toggleShuffle = useCallback(() => {
    const q = queueRef.current;
    if (q.length <= 1) {
      setShuffle((s) => !s);
      shuffleRef.current = !shuffleRef.current;
      return;
    }

    const currentQueueIndex = orderRef.current[orderPosRef.current] ?? 0;
    const enabling = !shuffleRef.current;
    const nextOrder = enabling
      ? shuffleIndices(q.length, currentQueueIndex)
      : sequentialIndices(q.length);
    const nextPos = enabling
      ? 0
      : Math.max(0, nextOrder.indexOf(currentQueueIndex));

    setShuffle(enabling);
    setOrder(nextOrder);
    setOrderPos(nextPos);
    shuffleRef.current = enabling;
    orderRef.current = nextOrder;
    orderPosRef.current = nextPos;
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((mode) => {
      const nextMode: RepeatMode =
        mode === "off" ? "all" : mode === "all" ? "one" : "off";
      repeatRef.current = nextMode;
      return nextMode;
    });
  }, []);

  const queueIndex = order[orderPos] ?? 0;

  const value = useMemo(
    () => ({
      track,
      queue,
      queueIndex,
      queueLength: queue.length,
      shuffle,
      repeat,
      status,
      error,
      currentTime,
      duration,
      volume,
      play,
      playQueue,
      toggle,
      stop,
      next,
      prev,
      seek,
      setVolume,
      toggleShuffle,
      cycleRepeat,
    }),
    [
      track,
      queue,
      queueIndex,
      shuffle,
      repeat,
      status,
      error,
      currentTime,
      duration,
      volume,
      play,
      playQueue,
      toggle,
      stop,
      next,
      prev,
      seek,
      setVolume,
      toggleShuffle,
      cycleRepeat,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error("usePlayer must be used within PlayerProvider");
  }
  return ctx;
}

export function usePlayerOptional() {
  return useContext(PlayerContext);
}
