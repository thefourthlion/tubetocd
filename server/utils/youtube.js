const { spawn } = require("child_process");

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

const YT_DLP = process.env.YT_DLP_PATH || "yt-dlp";

/** Prefer Android/Web/TV clients — mitigates many YouTube HTTP 403s on media URLs. */
const YT_EXTRACTOR_ARGS =
  process.env.YT_DLP_EXTRACTOR_ARGS ||
  "youtube:player_client=android,web,tv_embedded";

function cookieArgs() {
  const args = [];
  const cookiesFile = process.env.YT_DLP_COOKIES;
  if (cookiesFile) {
    args.push("--cookies", cookiesFile);
  }
  const fromBrowser = process.env.YT_DLP_COOKIES_FROM_BROWSER;
  if (fromBrowser) {
    args.push("--cookies-from-browser", fromBrowser);
  }
  return args;
}

function ytDlpChildEnv() {
  const env = { ...process.env };
  // Cursor/sandbox and some shells inject proxies that break YouTube media fetches.
  for (const key of [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
    "SOCKS_PROXY",
    "SOCKS5_PROXY",
    "socks_proxy",
    "socks5_proxy",
    "GIT_HTTP_PROXY",
    "GIT_HTTPS_PROXY",
  ]) {
    delete env[key];
  }
  return env;
}

function parseYouTubeUrl(rawUrl) {
  try {
    return new URL(String(rawUrl).trim());
  } catch {
    return null;
  }
}

function extractVideoId(rawUrl) {
  const parsed = parseYouTubeUrl(rawUrl);
  if (!parsed || !YOUTUBE_HOSTS.has(parsed.hostname)) return null;

  if (parsed.hostname.includes("youtu.be")) {
    const id = parsed.pathname.replace(/^\//, "").split("/")[0];
    return id || null;
  }

  if (parsed.pathname.startsWith("/shorts/")) {
    return parsed.pathname.split("/")[2] || null;
  }

  if (parsed.pathname.startsWith("/embed/")) {
    return parsed.pathname.split("/")[2] || null;
  }

  return parsed.searchParams.get("v");
}

function extractPlaylistId(rawUrl) {
  const parsed = parseYouTubeUrl(rawUrl);
  if (!parsed || !YOUTUBE_HOSTS.has(parsed.hostname)) return null;
  return parsed.searchParams.get("list");
}

/**
 * Detect a channel home / videos / featured URL.
 * Returns null for watch, playlist, shorts, embed, etc.
 *
 * @returns {{ type: string, value: string, tab: string|null, canonicalUrl: string }|null}
 */
function extractChannelRef(rawUrl) {
  const parsed = parseYouTubeUrl(rawUrl);
  if (!parsed || !YOUTUBE_HOSTS.has(parsed.hostname)) return null;
  if (parsed.hostname.includes("youtu.be")) return null;

  // Watch / playlist / shorts / embed are not channel pages.
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
    const handle = parts[0];
    return {
      type: "handle",
      value: handle,
      tab: parts[1] || null,
      canonicalUrl: `https://www.youtube.com/${handle}/videos`,
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
}

function isValidYouTubeUrl(url) {
  return (
    !!extractVideoId(url) ||
    !!extractPlaylistId(url) ||
    !!extractChannelRef(url)
  );
}

/** Cap channel scrapes — uploads lists can be enormous. */
const CHANNEL_FETCH_LIMIT = 200;

function videoWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function sanitizeFilename(name) {
  const cleaned = String(name || "audio")
    .replace(/[\/\\]+/g, " - ")
    .replace(/[<>:"|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return cleaned || "audio";
}

function getUploaderName(info = {}) {
  return (
    info.uploader ||
    info.channel ||
    info.creator ||
    info.artist ||
    info.playlist_uploader ||
    null
  );
}

/** Default download name: "[youtuber] - [title]" */
function buildTrackFilename(info = {}) {
  const title = info.title || "Untitled";
  const uploader = getUploaderName(info);
  if (uploader) {
    return sanitizeFilename(`${uploader} - ${title}`);
  }
  return sanitizeFilename(title);
}

function estimateMp3Bytes(durationSeconds, bitrateKbps = 192) {
  if (durationSeconds == null || Number.isNaN(Number(durationSeconds))) {
    return null;
  }
  const seconds = Math.max(0, Number(durationSeconds));
  return Math.round((seconds * bitrateKbps * 1000) / 8);
}

/** Rough YouTube MP4 size (~2.5 Mbps) when format filesizes aren't available. */
function estimateMp4Bytes(durationSeconds, bitrateKbps = 2500) {
  if (durationSeconds == null || Number.isNaN(Number(durationSeconds))) {
    return null;
  }
  const seconds = Math.max(0, Number(durationSeconds));
  return Math.round((seconds * bitrateKbps * 1000) / 8);
}

function formatFilesize(format) {
  if (!format) return 0;
  return Number(format.filesize || format.filesize_approx || 0) || 0;
}

function pickAudioFilesize(info = {}) {
  if (info.filesize) return info.filesize;
  if (info.filesize_approx) return info.filesize_approx;

  const formats = Array.isArray(info.formats) ? info.formats : [];
  const audioFormats = formats.filter(
    (f) => f && (f.vcodec === "none" || f.acodec) && formatFilesize(f) > 0,
  );
  if (audioFormats.length === 0) {
    return estimateMp3Bytes(info.duration);
  }

  audioFormats.sort((a, b) => formatFilesize(b) - formatFilesize(a));
  return formatFilesize(audioFormats[0]) || estimateMp3Bytes(info.duration);
}

/**
 * Size for the MP4 we'd actually download: progressive mp4, else mp4+m4a.
 * Falls back to a duration estimate when yt-dlp didn't return format sizes.
 */
function pickVideoFilesize(info = {}) {
  const formats = Array.isArray(info.formats) ? info.formats : [];

  const progressive = formats
    .filter(
      (f) =>
        f &&
        f.ext === "mp4" &&
        f.vcodec &&
        f.vcodec !== "none" &&
        f.acodec &&
        f.acodec !== "none" &&
        formatFilesize(f) > 0,
    )
    .sort((a, b) => formatFilesize(b) - formatFilesize(a));
  if (progressive[0]) return formatFilesize(progressive[0]);

  const videos = formats
    .filter(
      (f) =>
        f &&
        f.ext === "mp4" &&
        f.vcodec &&
        f.vcodec !== "none" &&
        (!f.acodec || f.acodec === "none") &&
        formatFilesize(f) > 0,
    )
    .sort((a, b) => {
      const heightDiff = (b.height || 0) - (a.height || 0);
      return heightDiff !== 0 ? heightDiff : formatFilesize(b) - formatFilesize(a);
    });

  const audios = formats
    .filter(
      (f) =>
        f &&
        f.vcodec === "none" &&
        f.acodec &&
        f.acodec !== "none" &&
        (f.ext === "m4a" || String(f.acodec).includes("mp4a")) &&
        formatFilesize(f) > 0,
    )
    .sort((a, b) => formatFilesize(b) - formatFilesize(a));

  if (videos[0] && audios[0]) {
    return formatFilesize(videos[0]) + formatFilesize(audios[0]);
  }
  if (videos[0]) return formatFilesize(videos[0]);

  const anyCombined = formats
    .filter(
      (f) =>
        f &&
        f.vcodec &&
        f.vcodec !== "none" &&
        f.acodec &&
        f.acodec !== "none" &&
        formatFilesize(f) > 0,
    )
    .sort((a, b) => formatFilesize(b) - formatFilesize(a));
  if (anyCombined[0]) return formatFilesize(anyCombined[0]);

  return estimateMp4Bytes(info.duration);
}

function mediaFilesizes(info = {}, { duration = null } = {}) {
  const dur = duration ?? info.duration ?? null;
  const filesizeMp3 = estimateMp3Bytes(dur);
  const hasFormatSizes =
    Array.isArray(info.formats) &&
    info.formats.some((f) => formatFilesize(f) > 0);
  const filesizeMp4 = hasFormatSizes
    ? pickVideoFilesize(info) || estimateMp4Bytes(dur)
    : estimateMp4Bytes(dur);

  return {
    filesize: filesizeMp3,
    filesizeMp3,
    filesizeMp4,
    filesizeEstimated: true,
    filesizeMp4Estimated: !hasFormatSizes,
  };
}

function ensureMp3Extension(name) {
  const base = sanitizeFilename(String(name || "audio").replace(/\.mp3$/i, ""));
  return `${base}.mp3`;
}

function ensureMediaExtension(name, ext) {
  const extension = String(ext || "mp3").replace(/^\./, "").toLowerCase();
  const base = sanitizeFilename(
    String(name || "media").replace(
      /\.(mp3|m4a|opus|aac|wav|flac|mp4|webm|mkv|m4v)$/i,
      "",
    ),
  );
  return `${base}.${extension}`;
}

function contentTypeForExt(ext) {
  switch (String(ext || "").toLowerCase()) {
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "opus":
      return "audio/opus";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    default:
      return "application/octet-stream";
  }
}

function runYtDlp(args, { signal, extractorArgs } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const err = new Error("Aborted");
      err.code = "ABORT_ERR";
      reject(err);
      return;
    }

    const fullArgs = [
      ...cookieArgs(),
      "--extractor-args",
      extractorArgs || YT_EXTRACTOR_ARGS,
      "--retries",
      "3",
      "--fragment-retries",
      "3",
      ...args,
    ];
    const child = spawn(YT_DLP, fullArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      env: ytDlpChildEnv(),
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (fn) => {
      if (settled) return;
      settled = true;
      if (signal) signal.removeEventListener("abort", onAbort);
      fn();
    };

    const onAbort = () => {
      try {
        child.kill("SIGTERM");
      } catch {
        // ignore
      }
      // Ensure stubborn ffmpeg/yt-dlp children die.
      setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          // ignore
        }
      }, 1500).unref?.();
      const err = new Error("Aborted");
      err.code = "ABORT_ERR";
      finish(() => reject(err));
    };

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      finish(() =>
        reject(
          new Error(
            err.code === "ENOENT"
              ? "yt-dlp is not installed. Run: brew install yt-dlp ffmpeg"
              : err.message,
          ),
        ),
      );
    });
    child.on("close", (code) => {
      if (signal?.aborted) {
        const err = new Error("Aborted");
        err.code = "ABORT_ERR";
        finish(() => reject(err));
        return;
      }
      if (code === 0) {
        finish(() => resolve({ stdout, stderr }));
      } else {
        const detail =
          stderr.trim() || stdout.trim() || `yt-dlp exited with code ${code}`;
        const friendly = /403|Forbidden/i.test(detail)
          ? `${detail}\nYouTube blocked the download (403). Retry in a moment, or update yt-dlp: brew upgrade yt-dlp`
          : detail;
        finish(() => reject(new Error(friendly)));
      }
    });
  });
}

/**
 * Parse strings like "1,234,567 views", "1.2M views", "859K views".
 */
function parseViewCountText(text) {
  if (text == null || text === "") return null;
  const raw = String(text).trim().toLowerCase().replace(/,/g, "");
  const labeled = raw.match(/([\d.]+)\s*([kmb])?\s*views?/);
  if (labeled) {
    let n = Number(labeled[1]);
    if (!Number.isFinite(n)) return null;
    const suffix = labeled[2];
    if (suffix === "k") n *= 1e3;
    else if (suffix === "m") n *= 1e6;
    else if (suffix === "b") n *= 1e9;
    return Math.round(n);
  }
  const bare = Number(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(bare) ? Math.round(bare) : null;
}

function runsToText(runs) {
  if (!Array.isArray(runs)) return "";
  return runs.map((r) => r?.text || "").join("");
}

/** Prefer numeric view_count; fall back to YouTube's display strings. */
function pickViewCount(entry = {}) {
  const raw = entry.view_count ?? entry.viewCount ?? entry.views;
  if (raw != null && raw !== "" && !Number.isNaN(Number(raw))) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }

  const text =
    entry.view_count_text ||
    entry.short_view_count_text ||
    (typeof entry.viewCountText === "string" ? entry.viewCountText : null) ||
    entry.viewCountText?.simpleText ||
    runsToText(entry.viewCountText?.runs) ||
    entry.shortViewCountText?.simpleText ||
    runsToText(entry.shortViewCountText?.runs) ||
    null;

  return parseViewCountText(text);
}

function extractRendererViewCount(renderer) {
  if (!renderer) return null;
  return pickViewCount({
    view_count: renderer.viewCount,
    viewCountText: renderer.viewCountText,
    shortViewCountText: renderer.shortViewCountText,
  });
}

/**
 * Flat yt-dlp often omits view_count. YouTube's page JSON still has it on each
 * video renderer — scrape once and merge by video id.
 */
async function fetchPageVideoViewCounts(pageUrl) {
  const res = await fetch(String(pageUrl || "").trim(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) {
    throw new Error(`YouTube page returned ${res.status}`);
  }

  const html = await res.text();
  const match = html.match(/var ytInitialData = (\{.+?\});<\/script>/);
  if (!match) return new Map();

  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return new Map();
  }

  const views = new Map();

  function remember(videoId, count) {
    if (!videoId || count == null || views.has(String(videoId))) return;
    views.set(String(videoId), count);
  }

  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }

    for (const key of [
      "videoRenderer",
      "gridVideoRenderer",
      "compactVideoRenderer",
      "playlistVideoRenderer",
    ]) {
      const renderer = node[key];
      if (renderer?.videoId) {
        remember(renderer.videoId, extractRendererViewCount(renderer));
      }
    }

    // Newer lockup cards on channel / home shelves.
    if (
      node.contentType === "LOCKUP_CONTENT_TYPE_VIDEO" &&
      node.contentId
    ) {
      const metaRows =
        node.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel
          ?.metadataRows || [];
      for (const row of metaRows) {
        for (const part of row?.metadataParts || []) {
          const text = part?.text?.content || part?.text?.simpleText;
          const count = parseViewCountText(text);
          if (count != null) {
            remember(node.contentId, count);
            break;
          }
        }
      }
    }

    for (const value of Object.values(node)) walk(value);
  }

  walk(data);
  return views;
}

/**
 * Parse strings like "29 videos", "1 video", or a bare number into a count.
 */
function parseVideoCountText(text) {
  if (text == null || text === "") return null;
  const raw = String(text).trim();
  const labeled = raw.match(/([\d,]+)\s*videos?/i);
  if (labeled) {
    const n = Number(labeled[1].replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  const bare = Number(raw.replace(/,/g, ""));
  return Number.isFinite(bare) ? bare : null;
}

function extractLockupPlaylistCount(lockup) {
  const overlays =
    lockup?.contentImage?.collectionThumbnailViewModel?.primaryThumbnail
      ?.thumbnailViewModel?.overlays || [];
  for (const overlay of overlays) {
    const badges =
      overlay?.thumbnailOverlayBadgeViewModel?.thumbnailBadges || [];
    for (const badge of badges) {
      const count = parseVideoCountText(badge?.thumbnailBadgeViewModel?.text);
      if (count != null) return count;
    }
  }
  return null;
}

/**
 * yt-dlp's flat playlist search does not include video counts. YouTube's
 * results page embeds them on each playlist lockup badge ("29 videos"), so we
 * scrape once and merge by playlist id.
 */
async function fetchPlaylistSearchTrackCounts(query) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    String(query || "").trim(),
  )}&sp=EgIQAw%3D%3D`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) {
    throw new Error(`YouTube search page returned ${res.status}`);
  }

  const html = await res.text();
  const match = html.match(/var ytInitialData = (\{.+?\});<\/script>/);
  if (!match) return new Map();

  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return new Map();
  }

  const counts = new Map();

  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }

    if (
      node.contentType === "LOCKUP_CONTENT_TYPE_PLAYLIST" &&
      node.contentId
    ) {
      const count = extractLockupPlaylistCount(node);
      if (count != null && !counts.has(node.contentId)) {
        counts.set(String(node.contentId), count);
      }
    }

    // Older playlistRenderer shape, still seen occasionally.
    const renderer = node.playlistRenderer;
    if (renderer?.playlistId) {
      const count = parseVideoCountText(
        renderer.videoCount ||
          renderer.videoCountText?.simpleText ||
          renderer.videoCountShortText?.simpleText,
      );
      if (count != null && !counts.has(renderer.playlistId)) {
        counts.set(String(renderer.playlistId), count);
      }
    }

    for (const value of Object.values(node)) walk(value);
  }

  walk(data);
  return counts;
}

module.exports = {
  extractVideoId,
  extractPlaylistId,
  extractChannelRef,
  isValidYouTubeUrl,
  videoWatchUrl,
  sanitizeFilename,
  getUploaderName,
  buildTrackFilename,
  estimateMp3Bytes,
  estimateMp4Bytes,
  pickAudioFilesize,
  pickVideoFilesize,
  mediaFilesizes,
  ensureMp3Extension,
  ensureMediaExtension,
  contentTypeForExt,
  runYtDlp,
  fetchPlaylistSearchTrackCounts,
  fetchPageVideoViewCounts,
  pickViewCount,
  parseViewCountText,
  parseVideoCountText,
  CHANNEL_FETCH_LIMIT,
};
