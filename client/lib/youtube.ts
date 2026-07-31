import axios from "axios";
import { API_URL } from "@/lib/api-base";
import { getToken } from "@/lib/auth";
import { apiBlobErrorMessage, apiErrorMessage } from "@/lib/api-error";

export type YoutubeLink = {
  id: number;
  link: string;
  user: string;
  title: string | null;
  videoId: string | null;
  thumbnail?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type YoutubeLinksResponse = {
  data: YoutubeLink[];
  total: number;
  page: number;
  limit: number;
};

export type PlaylistEntry = {
  id: string;
  title: string;
  uploader: string | null;
  filename: string;
  url: string;
  duration: number | null;
  filesize: number | null;
  filesizeMp3?: number | null;
  filesizeMp4?: number | null;
  filesizeEstimated: boolean;
  filesizeMp4Estimated?: boolean;
  viewCount: number | null;
  thumbnail: string | null;
  index: number;
  resultType?: "video" | "playlist";
  trackCount?: number | null;
};

/** What a keyword search asks YouTube for. */
export type SearchScope = "all" | "video" | "playlist";

export type YoutubeSearchResponse = {
  query: string;
  type: SearchScope;
  count: number;
  results: PlaylistEntry[];
};

export type ResolveVideoInfo = {
  type: "video";
  videoId: string | null;
  title: string;
  uploader: string | null;
  filename: string;
  url: string;
  duration: number | null;
  filesize: number | null;
  filesizeMp3?: number | null;
  filesizeMp4?: number | null;
  filesizeEstimated: boolean;
  filesizeMp4Estimated?: boolean;
  viewCount: number | null;
  uploadDate: string | null;
  thumbnail: string | null;
  sourceUrl: string;
};

export type ResolvePlaylistInfo = {
  type: "playlist";
  playlistId: string;
  title: string;
  uploader: string | null;
  count: number;
  totalDuration: number | null;
  totalFilesize: number | null;
  totalFilesizeMp3?: number | null;
  totalFilesizeMp4?: number | null;
  entries: PlaylistEntry[];
  sourceUrl: string;
  currentVideoId: string | null;
};

export type ResolveChannelInfo = {
  type: "channel";
  channelId: string | null;
  handle: string | null;
  /** Stable id used when saving to the library (UC… or handle:…). */
  playlistId: string;
  title: string;
  uploader: string | null;
  count: number;
  truncated?: boolean;
  limit?: number;
  totalDuration: number | null;
  totalFilesize: number | null;
  totalFilesizeMp3?: number | null;
  totalFilesizeMp4?: number | null;
  entries: PlaylistEntry[];
  sourceUrl: string;
};

export type ResolveInfo =
  | ResolveVideoInfo
  | ResolvePlaylistInfo
  | ResolveChannelInfo;

export type BatchItem = {
  url: string;
  filename?: string;
  title?: string;
  id?: string;
  uploader?: string | null;
  artist?: string | null;
  thumbnail?: string | null;
  index?: number;
  trackNumber?: number;
};

export type TransferProgress = {
  loaded: number;
  total: number | null;
  /** Bytes per second, averaged over the transfer. */
  rate: number | null;
};

export type DownloadMp3Options = {
  filename?: string;
  artist?: string | null;
  album?: string | null;
  thumbnail?: string | null;
  format?: string;
  quality?: string;
  onProgress?: (progress: TransferProgress) => void;
};

export type DownloadMediaOptions = DownloadMp3Options;

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

function getErrorMessage(err: unknown, fallback: string): string {
  return apiErrorMessage(err, fallback);
}

async function blobErrorMessage(err: unknown, fallback: string): Promise<string> {
  return apiBlobErrorMessage(err, fallback);
}

/**
 * The download endpoints stream while transcoding, so `total` is often absent.
 * Rate is derived from the wall clock rather than axios' estimate.
 */
function progressReporter(onProgress?: (progress: TransferProgress) => void) {
  if (!onProgress) return undefined;
  const startedAt = Date.now();
  return (event: { loaded: number; total?: number }) => {
    const elapsed = (Date.now() - startedAt) / 1000;
    onProgress({
      loaded: event.loaded,
      total: event.total ?? null,
      rate: elapsed > 0.25 ? event.loaded / elapsed : null,
    });
  };
}

function parseFilename(disposition?: string): string | null {
  if (!disposition) return null;
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch {
      return utfMatch[1];
    }
  }
  const plainMatch = disposition.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1] || null;
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

async function handleFileResponse(
  data: Blob,
  headers: Record<string, string>,
  fallbackName: string,
) {
  if (data.type && data.type.includes("application/json")) {
    const text = await data.text();
    const parsed = JSON.parse(text) as { error?: string };
    throw new Error(parsed.error || "Download failed");
  }

  const filename = parseFilename(headers["content-disposition"]) || fallbackName;
  const contentType =
    headers["content-type"] ||
    (filename.endsWith(".zip") ? "application/zip" : "audio/mpeg");

  triggerBrowserDownload(new Blob([data], { type: contentType }), filename);
  return filename;
}

export async function resolveYoutubeInfo(url: string): Promise<ResolveInfo> {
  try {
    const { data } = await api.post<ResolveInfo>(
      "/api/download/info",
      { url },
      { timeout: 2 * 60 * 1000 },
    );
    return data;
  } catch (err) {
    throw new Error(getErrorMessage(err, "Failed to load link"));
  }
}

export async function searchYoutube(
  q: string,
  options?: { limit?: number; type?: SearchScope },
): Promise<YoutubeSearchResponse> {
  try {
    const { data } = await api.post<YoutubeSearchResponse>(
      "/api/download/search",
      {
        q,
        limit: options?.limit ?? 12,
        type: options?.type ?? "all",
      },
      { timeout: 90 * 1000 },
    );
    return data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const payload = err.response?.data as
        | { error?: string; isUrl?: boolean; url?: string }
        | undefined;
      if (payload?.isUrl && payload.url) {
        const redirectErr = new Error(payload.error || "URL detected") as Error & {
          isUrl?: boolean;
          url?: string;
        };
        redirectErr.isUrl = true;
        redirectErr.url = payload.url;
        throw redirectErr;
      }
    }
    throw new Error(getErrorMessage(err, "YouTube search failed"));
  }
}

export async function downloadMp3(
  url: string,
  filenameOrOptions?: string | DownloadMp3Options,
): Promise<{ title: string; savedId?: string; format?: string }> {
  const options: DownloadMp3Options =
    typeof filenameOrOptions === "string"
      ? { filename: filenameOrOptions }
      : filenameOrOptions || {};

  const format = options.format || "mp3";
  const quality = options.quality || "best";

  try {
    const { data, headers } = await api.post(
      "/api/download",
      {
        url,
        filename: options.filename,
        artist: options.artist,
        album: options.album,
        thumbnail: options.thumbnail,
        format,
        quality,
      },
      {
        responseType: "blob",
        timeout: 15 * 60 * 1000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onDownloadProgress: progressReporter(options.onProgress),
      },
    );

    const downloadedName = await handleFileResponse(
      data,
      headers as Record<string, string>,
      `audio.${format === "mp4" ? "mp4" : format}`,
    );
    const titleHeader = headers["x-video-title"];
    const title = titleHeader
      ? decodeURIComponent(String(titleHeader))
      : downloadedName.replace(/\.(mp3|m4a|opus|mp4)$/i, "");

    return {
      title,
      savedId: headers["x-saved-id"] ? String(headers["x-saved-id"]) : undefined,
      format: headers["x-download-format"]
        ? String(headers["x-download-format"])
        : format,
    };
  } catch (err) {
    throw new Error(await blobErrorMessage(err, "Download failed"));
  }
}

export async function downloadBatch(
  items: BatchItem[],
  zipName?: string,
  options?: {
    format?: string;
    quality?: string;
    onProgress?: (progress: TransferProgress) => void;
  },
): Promise<string> {
  const format = options?.format || "mp3";
  const quality = options?.quality || "best";

  try {
    const { data, headers } = await api.post(
      "/api/download/batch",
      { items, zipName, album: zipName, format, quality },
      {
        responseType: "blob",
        timeout: 45 * 60 * 1000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onDownloadProgress: progressReporter(options?.onProgress),
      },
    );

    return handleFileResponse(
      data,
      headers as Record<string, string>,
      items.length > 1 ? "y2m-playlist.zip" : `audio.${format}`,
    );
  } catch (err) {
    throw new Error(await blobErrorMessage(err, "Batch download failed"));
  }
}

export async function fetchMyLinks(options?: {
  limit?: number;
}): Promise<YoutubeLink[]> {
  try {
    const { data } = await api.get<YoutubeLinksResponse>("/api/youtubeLinks/read", {
      params: { limit: options?.limit ?? 100 },
    });
    return data.data;
  } catch (err) {
    throw new Error(getErrorMessage(err, "Failed to load saved links"));
  }
}

export async function saveLink(payload: {
  link: string;
  title?: string | null;
  videoId?: string | null;
}): Promise<YoutubeLink> {
  try {
    const { data } = await api.post<YoutubeLink>("/api/youtubeLinks/create", {
      link: payload.link,
      title: payload.title ?? null,
      videoId: payload.videoId ?? null,
    });
    return data;
  } catch (err) {
    throw new Error(getErrorMessage(err, "Failed to save video"));
  }
}

export async function deleteLink(id: number): Promise<void> {
  try {
    await api.delete(`/api/youtubeLinks/delete/${id}`);
  } catch (err) {
    throw new Error(getErrorMessage(err, "Failed to delete link"));
  }
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "";
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = value >= 10 || unit === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

export function estimateMp3Bytes(
  durationSeconds: number | null | undefined,
  bitrateKbps = 192,
): number | null {
  if (durationSeconds == null || Number.isNaN(Number(durationSeconds))) {
    return null;
  }
  return Math.round((Math.max(0, Number(durationSeconds)) * bitrateKbps * 1000) / 8);
}

export function estimateMp4Bytes(
  durationSeconds: number | null | undefined,
  bitrateKbps = 2500,
): number | null {
  if (durationSeconds == null || Number.isNaN(Number(durationSeconds))) {
    return null;
  }
  return Math.round((Math.max(0, Number(durationSeconds)) * bitrateKbps * 1000) / 8);
}

/** Resolve MP3/MP4 display sizes from API fields or duration fallback. */
export function resolveMediaSizes(input: {
  duration?: number | null;
  filesize?: number | null;
  filesizeMp3?: number | null;
  filesizeMp4?: number | null;
}): { mp3: number | null; mp4: number | null } {
  const mp3 =
    input.filesizeMp3 ??
    input.filesize ??
    estimateMp3Bytes(input.duration ?? null);
  const mp4 = input.filesizeMp4 ?? estimateMp4Bytes(input.duration ?? null);
  return { mp3: mp3 || null, mp4: mp4 || null };
}

export function formatSpeed(bytesPerSecond: number | null | undefined): string {
  if (!bytesPerSecond || bytesPerSecond <= 0) return "";
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatViews(count: number | null | undefined): string {
  if (count == null || Number.isNaN(count)) return "";
  return new Intl.NumberFormat("en", { notation: "compact" }).format(count);
}

export function formatUploadDate(raw: string | null | undefined): string {
  if (!raw || raw.length !== 8) return "";
  const y = raw.slice(0, 4);
  const m = raw.slice(4, 6);
  const d = raw.slice(6, 8);
  return `${y}-${m}-${d}`;
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

export function extractVideoId(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(String(rawUrl).trim());
    if (!YOUTUBE_HOSTS.has(parsed.hostname)) return null;
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace(/^\//, "").split("/")[0] || null;
    }
    if (parsed.pathname.startsWith("/shorts/")) {
      return parsed.pathname.split("/")[2] || null;
    }
    if (parsed.pathname.startsWith("/embed/")) {
      return parsed.pathname.split("/")[2] || null;
    }
    return parsed.searchParams.get("v");
  } catch {
    return null;
  }
}

export function extractPlaylistId(
  rawUrl: string | null | undefined,
): string | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(String(rawUrl).trim());
    if (!YOUTUBE_HOSTS.has(parsed.hostname)) return null;
    return parsed.searchParams.get("list");
  } catch {
    return null;
  }
}

export type ChannelRef = {
  type: string;
  value: string;
  tab: string | null;
  canonicalUrl: string;
};

/** Detect @handle / channel / c / user URLs (not watch or playlist). */
export function extractChannelRef(
  rawUrl: string | null | undefined,
): ChannelRef | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(String(rawUrl).trim());
    if (!YOUTUBE_HOSTS.has(parsed.hostname)) return null;
    if (parsed.hostname.includes("youtu.be")) return null;

    if (
      extractVideoId(rawUrl) ||
      extractPlaylistId(rawUrl) ||
      parsed.pathname.startsWith("/shorts/") ||
      parsed.pathname.startsWith("/embed/") ||
      parsed.pathname.startsWith("/watch") ||
      parsed.pathname.startsWith("/playlist")
    ) {
      return null;
    }

    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return null;

    if (parts[0].startsWith("@")) {
      return {
        type: "handle",
        value: parts[0],
        tab: parts[1] || null,
        canonicalUrl: `https://www.youtube.com/${parts[0]}/videos`,
      };
    }

    if (parts[0] === "channel" && parts[1]) {
      return {
        type: "id",
        value: parts[1],
        tab: parts[2] || null,
        canonicalUrl: `https://www.youtube.com/channel/${parts[1]}/videos`,
      };
    }

    if ((parts[0] === "c" || parts[0] === "user") && parts[1]) {
      return {
        type: parts[0],
        value: parts[1],
        tab: parts[2] || null,
        canonicalUrl: `https://www.youtube.com/${parts[0]}/${parts[1]}/videos`,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function isValidYouTubeUrl(rawUrl: string | null | undefined): boolean {
  return (
    !!extractVideoId(rawUrl) ||
    !!extractPlaylistId(rawUrl) ||
    !!extractChannelRef(rawUrl)
  );
}

export function youtubeThumbnailUrl(
  videoId: string | null | undefined,
  quality: "hqdefault" | "mqdefault" | "sddefault" = "hqdefault",
): string | null {
  if (!videoId) return null;
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
}

export function resolveThumbnail(
  thumbnail: string | null | undefined,
  videoId: string | null | undefined,
  fallbackUrl?: string | null,
): string | null {
  if (thumbnail) return thumbnail;
  const id = videoId || extractVideoId(fallbackUrl);
  return youtubeThumbnailUrl(id);
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubePlaylistUrl(playlistId: string): string {
  return `https://www.youtube.com/playlist?list=${playlistId}`;
}

export function siteWatchPath(opts: {
  videoId?: string | null;
  playlistId?: string | null;
  /** Saved library playlist — enables in-app order/shuffle watch. */
  savedPlaylistId?: number | string | null;
  title?: string | null;
  index?: number | null;
}): string {
  const params = new URLSearchParams();
  if (opts.videoId) params.set("v", opts.videoId);
  if (opts.playlistId) params.set("list", opts.playlistId);
  if (opts.savedPlaylistId != null && opts.savedPlaylistId !== "") {
    params.set("saved", String(opts.savedPlaylistId));
  }
  if (opts.title) params.set("title", opts.title);
  if (opts.index != null && opts.index >= 0) {
    params.set("i", String(opts.index));
  }
  const qs = params.toString();
  return qs ? `/pages/watch?${qs}` : "/pages/watch";
}

export function siteListenPath(opts: {
  videoId?: string | null;
  url?: string | null;
  title?: string | null;
  thumbnail?: string | null;
}): string {
  const params = new URLSearchParams();
  const url =
    opts.url || (opts.videoId ? youtubeWatchUrl(opts.videoId) : null);
  if (url) params.set("url", url);
  if (opts.videoId) params.set("v", opts.videoId);
  if (opts.title) params.set("title", opts.title);
  if (opts.thumbnail) params.set("thumb", opts.thumbnail);
  const qs = params.toString();
  return qs ? `/pages/listen?${qs}` : "/pages/listen";
}

/** Build a playable object URL for in-browser listening. */
export async function streamMp3Preview(
  url: string,
  options?: {
    filename?: string;
    thumbnail?: string | null;
    signal?: AbortSignal;
  },
): Promise<{ objectUrl: string; title: string; thumbnail: string | null }> {
  try {
    if (options?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const { data, headers } = await api.post(
      "/api/download/stream",
      {
        url,
        filename: options?.filename,
        thumbnail: options?.thumbnail || undefined,
      },
      {
        responseType: "blob",
        timeout: 5 * 60 * 1000,
        signal: options?.signal,
      },
    );

    if (options?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    if (data.type && data.type.includes("application/json")) {
      const text = await data.text();
      const parsed = JSON.parse(text) as { error?: string };
      throw new Error(parsed.error || "Failed to prepare audio");
    }

    const size = data instanceof Blob ? data.size : 0;
    if (!size || size < 256) {
      throw new Error("Audio stream was empty");
    }

    const titleHeader = headers["x-video-title"];
    const title = titleHeader
      ? decodeURIComponent(String(titleHeader))
      : "Audio preview";
    const thumbHeader = headers["x-thumbnail"];
    const thumbnail = thumbHeader
      ? decodeURIComponent(String(thumbHeader))
      : options?.thumbnail || null;

    const objectUrl = URL.createObjectURL(
      new Blob([data], { type: "audio/mpeg" }),
    );
    return { objectUrl, title, thumbnail };
  } catch (err) {
    if (
      (typeof DOMException !== "undefined" &&
        err instanceof DOMException &&
        err.name === "AbortError") ||
      (axios.isAxiosError(err) &&
        (err.code === "ERR_CANCELED" || err.name === "CanceledError"))
    ) {
      throw new DOMException("Aborted", "AbortError");
    }
    throw new Error(await blobErrorMessage(err, "Failed to prepare audio"));
  }
}

export function youtubeEmbedSrc(opts: {
  videoId?: string | null;
  playlistId?: string | null;
}): string | null {
  if (opts.videoId && opts.playlistId) {
    return `https://www.youtube.com/embed/${opts.videoId}?list=${opts.playlistId}&rel=0`;
  }
  if (opts.videoId) {
    return `https://www.youtube.com/embed/${opts.videoId}?rel=0`;
  }
  if (opts.playlistId) {
    return `https://www.youtube.com/embed/videoseries?list=${opts.playlistId}&rel=0`;
  }
  return null;
}
