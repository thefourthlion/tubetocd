const path = require("path");
const fs = require("fs");
const { randomUUID } = require("crypto");
const archiver = require("archiver");
const youtubeLinks = require("../models/youtubeLinks");
const {
  extractVideoId,
  extractPlaylistId,
  extractChannelRef,
  isValidYouTubeUrl,
  videoWatchUrl,
  sanitizeFilename,
  getUploaderName,
  buildTrackFilename,
  mediaFilesizes,
  ensureMp3Extension,
  ensureMediaExtension,
  contentTypeForExt,
  runYtDlp,
  fetchPlaylistSearchTrackCounts,
  fetchPageVideoViewCounts,
  pickViewCount,
  CHANNEL_FETCH_LIMIT,
} = require("../utils/youtube");
const { applyMusicTags } = require("../utils/musicTags");
const {
  readListenCache,
  writeListenCache,
} = require("../utils/listenCache");

const DOWNLOAD_DIR = path.join(__dirname, "../downloads");
const MAX_BATCH = 40;

const AUDIO_FORMATS = new Set(["mp3"]);
const VIDEO_FORMATS = new Set(["mp4"]);

function normalizeDownloadOptions(raw = {}) {
  const format = String(raw.format || "mp3").toLowerCase();
  if (!AUDIO_FORMATS.has(format) && !VIDEO_FORMATS.has(format)) {
    const err = new Error(`Unsupported format “${format}” — use mp3 or mp4`);
    err.status = 400;
    throw err;
  }

  const kind = VIDEO_FORMATS.has(format) ? "video" : "audio";
  return { format, quality: "best", kind };
}

function ytDlpArgsForOptions(options, outputTemplate) {
  const { kind, listen } = options;
  const common = [
    "--no-playlist",
    "--no-warnings",
    "--add-metadata",
    "-o",
    outputTemplate,
  ];

  if (kind === "video") {
    // Direct scrape: prefer a progressive MP4 (no ffmpeg), else mp4+m4a
    // merged via stream-copy remux only — never re-encode.
    return [
      "-f",
      "b[ext=mp4]/bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b",
      "--merge-output-format",
      "mp4",
      ...common,
    ];
  }

  // In-browser listen: skip thumbnails — faster 128k encode.
  if (listen) {
    return [
      "-x",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "128K",
      "--embed-metadata",
      ...common,
    ];
  }

  // YouTube has no native MP3; extract once at best quality (VBR).
  return [
    "-x",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "0",
    "--embed-metadata",
    ...common,
  ];
}

function ensureDownloadDir() {
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }
}

function cleanupFile(filePath) {
  if (!filePath) return;
  fs.promises.unlink(filePath).catch(() => {});
  // Drop companion thumbnails written by yt-dlp
  if (filePath) {
    const base = filePath.replace(/\.[^.]+$/, "");
    for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
      fs.promises.unlink(`${base}${ext}`).catch(() => {});
    }
  }
}

function cleanupFiles(paths) {
  (paths || []).forEach(cleanupFile);
}

function fetchFlatInfo(url, { playlist = false, limit = null, signal = null } = {}) {
  const args = ["--dump-single-json", "--no-warnings"];
  if (playlist) {
    args.push("--flat-playlist");
  } else {
    args.push("--no-playlist");
  }
  if (limit) {
    args.push("--playlist-end", String(limit));
  }
  args.push(url);
  return runYtDlp(args, signal ? { signal } : {}).then(({ stdout }) =>
    JSON.parse(stdout),
  );
}

async function downloadMediaToFile(url, jobId, meta = {}, options = {}, runOpts = {}) {
  const opts = normalizeDownloadOptions(options);
  if (options.listen) opts.listen = true;
  const outputTemplate = path.join(DOWNLOAD_DIR, `${jobId}.%(ext)s`);
  await runYtDlp([...ytDlpArgsForOptions(opts, outputTemplate), url], runOpts);

  const mediaPath = resolveOutputPath(jobId, opts.format);
  // Listen streams skip ID3 cover embedding — it's slow and not needed to play.
  if (
    mediaPath &&
    opts.format === "mp3" &&
    mediaPath.endsWith(".mp3") &&
    !opts.listen
  ) {
    await applyMusicTags(mediaPath, meta);
  }
  return { path: mediaPath, options: opts };
}

function resolveOutputPath(jobId, preferredExt = "mp3") {
  const preferred = path.join(DOWNLOAD_DIR, `${jobId}.${preferredExt}`);
  if (fs.existsSync(preferred)) return preferred;

  const matches = fs
    .readdirSync(DOWNLOAD_DIR)
    .filter(
      (f) =>
        f.startsWith(jobId) &&
        !/\.(jpe?g|png|webp|json|vtt|srt)$/i.test(f),
    );

  if (matches.length === 0) return null;

  const ranked = matches.sort((a, b) => {
    const aScore = a.endsWith(`.${preferredExt}`) ? 0 : 1;
    const bScore = b.endsWith(`.${preferredExt}`) ? 0 : 1;
    return aScore - bScore;
  });
  return path.join(DOWNLOAD_DIR, ranked[0]);
}

function pickThumbnail(info = {}) {
  return (
    info.thumbnail ||
    info.thumbnails?.[info.thumbnails.length - 1]?.url ||
    null
  );
}

function buildMusicMeta(info = {}, overrides = {}) {
  const artist =
    overrides.artist ||
    overrides.uploader ||
    getUploaderName(info) ||
    "Unknown Artist";
  const trackTitle = overrides.trackTitle || info.title || "Unknown Title";
  return {
    title: trackTitle,
    artist,
    album: overrides.album || overrides.playlistTitle || artist,
    albumArtist: overrides.albumArtist || artist,
    trackNumber: overrides.trackNumber ?? null,
    year: overrides.year || null,
    uploadDate: info.upload_date || overrides.uploadDate || null,
    thumbnail: overrides.thumbnail || pickThumbnail(info),
    sourceUrl: overrides.sourceUrl || null,
    genre: overrides.genre || "Music",
    comment: overrides.comment || undefined,
  };
}

async function saveLinkForUser(userId, { url, title, videoId }) {
  if (!userId) return null;

  const existing = videoId
    ? await youtubeLinks.findOne({
        where: { user: String(userId), videoId },
      })
    : null;

  if (existing) {
    await existing.update({ link: url, title });
    return existing;
  }

  return youtubeLinks.create({
    link: url,
    user: String(userId),
    title,
    videoId: videoId || null,
  });
}

function mapPlaylistEntries(info) {
  const entries = Array.isArray(info.entries) ? info.entries : [];
  const playlistUploader = getUploaderName(info);

  return entries
    .filter((entry) => entry && (entry.id || entry.url))
    .map((entry, index) => {
      const id = entry.id || extractVideoId(entry.url) || `track-${index + 1}`;
      const title = entry.title || `Track ${index + 1}`;
      const uploader = getUploaderName(entry) || playlistUploader;
      const duration = entry.duration ?? null;
      const sizes = mediaFilesizes(entry, { duration });
      const filename = buildTrackFilename({
        title,
        uploader,
        channel: uploader,
      });

      return {
        id: String(id),
        title,
        uploader,
        filename,
        url: entry.url?.startsWith("http")
          ? entry.url
          : videoWatchUrl(id),
        duration,
        filesize: sizes.filesizeMp3,
        filesizeMp3: sizes.filesizeMp3,
        filesizeMp4: sizes.filesizeMp4,
        filesizeEstimated: sizes.filesizeEstimated,
        filesizeMp4Estimated: sizes.filesizeMp4Estimated,
        viewCount: pickViewCount(entry),
        thumbnail: entry.thumbnails?.[0]?.url || entry.thumbnail || null,
        index: index + 1,
        trackCount: entry.playlist_count ?? entry.video_count ?? null,
      };
    });
}

function mergeScrapedViewCounts(entries, scraped) {
  if (!scraped || scraped.size === 0) return entries;
  for (const entry of entries) {
    if (entry.viewCount == null && scraped.has(entry.id)) {
      entry.viewCount = scraped.get(entry.id);
    }
  }
  return entries;
}

async function enrichEntriesWithPageViews(entries, pageUrl) {
  const missing = entries.some((e) => e.viewCount == null);
  if (!missing || !pageUrl) return entries;
  try {
    const scraped = await fetchPageVideoViewCounts(pageUrl);
    return mergeScrapedViewCounts(entries, scraped);
  } catch (err) {
    console.error("view count scrape error:", err.message || err);
    return entries;
  }
}

function mapVideoInfo(info, { videoId, sourceUrl }) {
  const title = info.title || videoId || "audio";
  const uploader = getUploaderName(info);
  const duration = info.duration ?? null;
  const sizes = mediaFilesizes(info, { duration });

  return {
    type: "video",
    videoId: videoId || info.id || null,
    title,
    uploader,
    filename: buildTrackFilename(info),
    url: videoId ? videoWatchUrl(videoId) : sourceUrl,
    duration,
    filesize: sizes.filesizeMp3,
    filesizeMp3: sizes.filesizeMp3,
    filesizeMp4: sizes.filesizeMp4,
    filesizeEstimated: sizes.filesizeEstimated,
    filesizeMp4Estimated: sizes.filesizeMp4Estimated,
    viewCount: pickViewCount(info),
    uploadDate: info.upload_date || null,
    thumbnail:
      info.thumbnail ||
      info.thumbnails?.[info.thumbnails.length - 1]?.url ||
      null,
    sourceUrl,
  };
}

exports.resolveInfo = async (req, res) => {
  try {
    const url = req.body?.url;
    if (!url || !isValidYouTubeUrl(url)) {
      return res.status(400).json({
        error:
          "A valid YouTube video, playlist, or channel URL is required",
      });
    }

    const playlistId = extractPlaylistId(url);
    const videoId = extractVideoId(url);
    const channelRef = extractChannelRef(url);

    if (playlistId) {
      let info;
      try {
        info = await fetchFlatInfo(url, { playlist: true });
      } catch (err) {
        console.error("playlist info error:", err.message || err);
        const detail = String(err.message || "");
        const notFound = /404|not found|requested entity/i.test(detail);
        return res.status(400).json({
          error: notFound
            ? "Playlist not found or is private. Check the link and try again."
            : "Could not load playlist. Check the link and try again.",
        });
      }

      const entries = await enrichEntriesWithPageViews(
        mapPlaylistEntries(info),
        url,
      );
      if (entries.length === 0) {
        return res.status(400).json({ error: "Playlist has no downloadable videos" });
      }

      const totalDuration = entries.reduce(
        (sum, entry) => sum + (entry.duration || 0),
        0,
      );
      const totalFilesize = entries.reduce(
        (sum, entry) => sum + (entry.filesizeMp3 || entry.filesize || 0),
        0,
      );
      const totalFilesizeMp4 = entries.reduce(
        (sum, entry) => sum + (entry.filesizeMp4 || 0),
        0,
      );

      return res.json({
        type: "playlist",
        playlistId,
        title: info.title || "Playlist",
        uploader: getUploaderName(info),
        count: entries.length,
        totalDuration: totalDuration || null,
        totalFilesize: totalFilesize || null,
        totalFilesizeMp3: totalFilesize || null,
        totalFilesizeMp4: totalFilesizeMp4 || null,
        entries,
        sourceUrl: url,
        currentVideoId: videoId || null,
      });
    }

    if (channelRef) {
      let info;
      try {
        info = await fetchFlatInfo(channelRef.canonicalUrl, {
          playlist: true,
          limit: CHANNEL_FETCH_LIMIT,
        });
      } catch (err) {
        console.error("channel info error:", err.message || err);
        const detail = String(err.message || "");
        const notFound = /404|not found|requested entity/i.test(detail);
        return res.status(400).json({
          error: notFound
            ? "Channel not found or is private. Check the link and try again."
            : "Could not load channel. Check the link and try again.",
        });
      }

      const entries = await enrichEntriesWithPageViews(
        mapPlaylistEntries(info),
        channelRef.canonicalUrl,
      );
      if (entries.length === 0) {
        return res.status(400).json({
          error: "Channel has no downloadable videos",
        });
      }

      const channelId =
        info.channel_id ||
        info.uploader_id ||
        (channelRef.type === "id" ? channelRef.value : null) ||
        null;
      const handleFromInfo =
        typeof info.uploader_url === "string"
          ? info.uploader_url.match(/@[\w.-]+/)?.[0] || null
          : null;
      const handle =
        channelRef.type === "handle"
          ? channelRef.value
          : handleFromInfo;
      // Stable library key — prefer UC… so re-pasting @handle /channel merges.
      const stableId =
        channelId ||
        (handle ? `handle:${handle}` : `channel:${channelRef.value}`);

      const totalDuration = entries.reduce(
        (sum, entry) => sum + (entry.duration || 0),
        0,
      );
      const totalFilesize = entries.reduce(
        (sum, entry) => sum + (entry.filesizeMp3 || entry.filesize || 0),
        0,
      );
      const totalFilesizeMp4 = entries.reduce(
        (sum, entry) => sum + (entry.filesizeMp4 || 0),
        0,
      );

      const title =
        info.channel ||
        info.uploader ||
        info.title ||
        (handle ? handle.replace(/^@/, "") : null) ||
        "Channel";

      return res.json({
        type: "channel",
        channelId,
        handle,
        playlistId: stableId,
        title,
        uploader: getUploaderName(info) || title,
        count: entries.length,
        truncated: entries.length >= CHANNEL_FETCH_LIMIT,
        limit: CHANNEL_FETCH_LIMIT,
        totalDuration: totalDuration || null,
        totalFilesize: totalFilesize || null,
        totalFilesizeMp3: totalFilesize || null,
        totalFilesizeMp4: totalFilesizeMp4 || null,
        entries,
        sourceUrl: channelRef.canonicalUrl,
      });
    }

    let info;
    try {
      info = await fetchFlatInfo(url, { playlist: false });
    } catch (err) {
      console.error("video info error:", err.message || err);
      return res.status(400).json({
        error: "Could not fetch video info. Check the link and try again.",
      });
    }

    return res.json(mapVideoInfo(info, { videoId, sourceUrl: url }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to resolve URL" });
  }
};

const SEARCH_SCOPES = new Set(["all", "video", "playlist"]);
const SEARCH_LIMIT_MAX = 30;

/**
 * `ytsearch:` only ever yields videos, so playlists come from YouTube's own
 * results page with its "playlist" type filter applied (`sp=EgIQAw%3D%3D`).
 */
const PLAYLIST_FILTER_PARAM = "EgIQAw%3D%3D";

/**
 * A mixed search weaves playlists into the video ranking — one playlist per
 * this many videos — so both kinds show up on the first page instead of the
 * playlists being buried behind every video.
 */
const VIDEOS_PER_PLAYLIST = 3;

async function searchVideoResults(query, limit) {
  const info = await fetchFlatInfo(`ytsearch${limit}:${query}`, {
    playlist: true,
  });
  return mapPlaylistEntries(info)
    .slice(0, limit)
    .map((entry) => ({ ...entry, resultType: "video" }));
}

async function searchPlaylistResults(query, limit) {
  const target = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    query,
  )}&sp=${PLAYLIST_FILTER_PARAM}`;

  // Flat yt-dlp rows omit video counts; scrape the same results page once for
  // the "N videos" badge on each playlist lockup.
  const [info, trackCounts] = await Promise.all([
    fetchFlatInfo(target, { playlist: true, limit }),
    fetchPlaylistSearchTrackCounts(query).catch((err) => {
      console.error(
        "playlist track count scrape error:",
        err.message || err,
      );
      return new Map();
    }),
  ]);

  const playlists = [];
  for (const entry of mapPlaylistEntries(info)) {
    const playlistId =
      extractPlaylistId(entry.url) ||
      (/^(?:PL|OLAK5uy_|RD|UU|LL|FL)/.test(String(entry.id))
        ? String(entry.id)
        : null);
    // The results page can still slip in a video or channel shelf; a row with
    // no list id is not something we can open as a playlist.
    if (!playlistId) continue;
    playlists.push({
      ...entry,
      id: playlistId,
      url: `https://www.youtube.com/playlist?list=${playlistId}`,
      // Duration / download size stay unknown until the playlist is opened.
      // Track count comes from the search-page badge when available.
      trackCount: trackCounts.get(playlistId) ?? entry.trackCount ?? null,
      duration: null,
      filesize: null,
      filesizeEstimated: false,
      viewCount: null,
      resultType: "playlist",
    });
    if (playlists.length >= limit) break;
  }
  return playlists;
}

function mergeSearchResults(videos, playlists) {
  const merged = [];
  let videoAt = 0;
  let playlistAt = 0;

  while (videoAt < videos.length || playlistAt < playlists.length) {
    for (let i = 0; i < VIDEOS_PER_PLAYLIST && videoAt < videos.length; i += 1) {
      merged.push(videos[videoAt++]);
    }
    if (playlistAt < playlists.length) {
      merged.push(playlists[playlistAt++]);
    }
  }

  return merged;
}

/**
 * Keyword search via yt-dlp. `type` picks what YouTube is asked for: videos
 * only, playlists only, or both merged into one ranking.
 * Body: { q: string, limit?: number, type?: "all" | "video" | "playlist" }
 */
exports.searchYoutube = async (req, res) => {
  try {
    const rawQuery = String(req.body?.q || req.query?.q || "").trim();
    if (!rawQuery) {
      return res.status(400).json({ error: "Search query is required" });
    }

    // If they pasted a URL, point them at resolve instead of searching.
    if (isValidYouTubeUrl(rawQuery)) {
      return res.status(400).json({
        error: "That looks like a YouTube URL — open Convert to load it.",
        isUrl: true,
        url: rawQuery,
      });
    }

    const limit = Math.min(
      SEARCH_LIMIT_MAX,
      Math.max(1, Number(req.body?.limit || req.query?.limit) || 12),
    );
    const requestedType = String(
      req.body?.type ?? req.query?.type ?? "all",
    ).toLowerCase();
    const type = SEARCH_SCOPES.has(requestedType) ? requestedType : "all";

    // Mixed searches keep the full video budget but only take enough playlists
    // to fill the weave, so "all" does not return twice the rows asked for.
    const playlistLimit =
      type === "all" ? Math.max(4, Math.ceil(limit / VIDEOS_PER_PLAYLIST)) : limit;

    const failures = [];
    const attempt = async (kind, run) => {
      try {
        return await run();
      } catch (err) {
        console.error(`youtube ${kind} search error:`, err.message || err);
        failures.push(kind);
        return [];
      }
    };

    const [videos, playlists] = await Promise.all([
      type === "playlist"
        ? []
        : attempt("video", () => searchVideoResults(rawQuery, limit)),
      type === "video"
        ? []
        : attempt("playlist", () => searchPlaylistResults(rawQuery, playlistLimit)),
    ]);

    const merged =
      type === "all"
        ? mergeSearchResults(videos, playlists)
        : [...videos, ...playlists];

    // A partial failure still returns what did come back; only a search with
    // nothing to show is reported as an error.
    if (failures.length > 0 && merged.length === 0) {
      return res.status(400).json({
        error: "YouTube search failed. Try another query.",
      });
    }

    const results = merged.map((entry, index) => ({
      ...entry,
      index: index + 1,
    }));

    return res.json({
      query: rawQuery,
      type,
      count: results.length,
      results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Search failed" });
  }
};

async function prepareDownloadResponse(req, res, { asAttachment = true } = {}) {
  let outputPath = null;
  const abort = new AbortController();
  // Detect client disconnect via the response socket — `req` "close" also fires
  // once the POST body is consumed, which would abort healthy downloads.
  const onClientGone = () => {
    if (!res.writableEnded && !abort.signal.aborted) {
      abort.abort();
    }
  };
  res.on("close", onClientGone);

  try {
    const url = req.body?.url || req.query?.url;
    if (!url || !extractVideoId(url)) {
      return res.status(400).json({
        error: "A valid YouTube video URL is required (not a playlist-only link)",
      });
    }

    let downloadOptions;
    try {
      downloadOptions = normalizeDownloadOptions({
        format: req.body?.format || req.query?.format,
        quality: req.body?.quality || req.query?.quality,
      });
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    // In-browser listen stream stays MP3 for maximum compatibility.
    if (!asAttachment) {
      downloadOptions = {
        format: "mp3",
        quality: "128",
        kind: "audio",
        listen: true,
      };
    }

    const videoId = extractVideoId(url);
    const watchUrl = videoWatchUrl(videoId);
    ensureDownloadDir();

    if (abort.signal.aborted) {
      return;
    }

    // Serve cached listen MP3s immediately — avoids re-running yt-dlp on every play.
    if (!asAttachment) {
      const cached = readListenCache(videoId);
      if (cached) {
        const displayName = sanitizeFilename(
          req.body?.filename ||
            req.query?.filename ||
            cached.title ||
            videoId ||
            "audio",
        );
        const filename = ensureMediaExtension(displayName, "mp3");
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Content-Length", String(cached.size));
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader(
          "Content-Disposition",
          `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
        );
        res.setHeader("X-Video-Title", encodeURIComponent(displayName));
        res.setHeader("X-Download-Format", "mp3");
        res.setHeader("X-Download-Quality", "128");
        res.setHeader("X-Video-Id", videoId);
        const thumb =
          req.body?.thumbnail || req.query?.thumbnail || cached.thumbnail;
        if (thumb) res.setHeader("X-Thumbnail", encodeURIComponent(thumb));
        res.setHeader(
          "Access-Control-Expose-Headers",
          "Content-Disposition, X-Video-Title, X-Video-Id, X-Saved-Id, X-Thumbnail, X-Download-Format, X-Download-Quality",
        );
        return fs.createReadStream(cached.path).pipe(res);
      }
    }

    let info = null;
    try {
      info = await fetchFlatInfo(watchUrl, {
        playlist: false,
        signal: abort.signal,
      });
    } catch (err) {
      if (err.code === "ABORT_ERR" || abort.signal.aborted) return;
      console.error("yt-dlp info error:", err.message || err);
      return res.status(400).json({
        error: "Could not fetch video info. Check the link and try again.",
      });
    }

    const jobId = randomUUID();
    const displayName = sanitizeFilename(
      req.body?.filename ||
        req.query?.filename ||
        buildTrackFilename(info) ||
        videoId ||
        "media",
    );
    const trackTitle = info.title || displayName;
    const musicMeta = buildMusicMeta(info, {
      trackTitle,
      artist: req.body?.artist || req.query?.artist || getUploaderName(info),
      album:
        req.body?.album ||
        req.query?.album ||
        getUploaderName(info) ||
        trackTitle,
      thumbnail:
        req.body?.thumbnail || req.query?.thumbnail || pickThumbnail(info),
      sourceUrl: watchUrl,
      uploadDate: info.upload_date,
    });

    const extractorAttempts = asAttachment
      ? [undefined]
      : [
          undefined,
          "youtube:player_client=android,tv_embedded",
          "youtube:player_client=web",
        ];

    let lastDownloadError = null;
    for (let i = 0; i < extractorAttempts.length; i += 1) {
      if (abort.signal.aborted) {
        cleanupFile(outputPath);
        return;
      }
      const attemptJobId = i === 0 ? jobId : randomUUID();
      try {
        const result = await downloadMediaToFile(
          watchUrl,
          attemptJobId,
          musicMeta,
          downloadOptions,
          {
            signal: abort.signal,
            extractorArgs: extractorAttempts[i],
          },
        );
        outputPath = result.path;
        downloadOptions = result.options;
        lastDownloadError = null;
        break;
      } catch (err) {
        if (err.code === "ABORT_ERR" || abort.signal.aborted) {
          cleanupFile(outputPath);
          cleanupFile(resolveOutputPath(attemptJobId, "mp3"));
          return;
        }
        lastDownloadError = err;
        console.error(
          `yt-dlp download error (attempt ${i + 1}/${extractorAttempts.length}):`,
          err.message || err,
        );
        cleanupFile(resolveOutputPath(attemptJobId, downloadOptions.format));
        // Brief pause before trying another player client.
        if (i < extractorAttempts.length - 1) {
          await new Promise((r) => setTimeout(r, 400 * (i + 1)));
        }
      }
    }

    if (lastDownloadError) {
      const msg = String(lastDownloadError.message || "");
      if (/sign in|login required|confirm you.re not a bot|age.restrict/i.test(msg)) {
        return res.status(403).json({
          error:
            "YouTube requires a signed-in browser for this video. Set YT_DLP_COOKIES_FROM_BROWSER=chrome in server/.env.",
        });
      }
      if (/private video|premium|members.?only/i.test(msg)) {
        return res.status(403).json({
          error: "This video is private or members-only and can’t be streamed.",
        });
      }
      if (/403|Forbidden/i.test(msg)) {
        return res.status(502).json({
          error:
            "YouTube blocked the stream (403). Wait a moment and try again, or add cookies via YT_DLP_COOKIES_FROM_BROWSER=chrome.",
        });
      }
      if (/ffmpeg|ffprobe/i.test(msg)) {
        return res.status(500).json({
          error: "Audio conversion failed. Make sure ffmpeg is installed.",
        });
      }
      return res.status(500).json({
        error: msg.slice(0, 280) || "Failed to prepare audio",
      });
    }

    if (!outputPath) {
      outputPath = resolveOutputPath(jobId, downloadOptions.format);
    }
    if (!outputPath) {
      return res.status(500).json({ error: "Download finished but file was not found" });
    }

    if (abort.signal.aborted) {
      cleanupFile(outputPath);
      return;
    }

    // Full downloads get ID3 tags; listen streams already skipped tagging.
    if (asAttachment && downloadOptions.format === "mp3") {
      await applyMusicTags(outputPath, musicMeta);
    }

    // Persist listen converts so the next play (or retry) is instant.
    if (!asAttachment) {
      const cached = writeListenCache(videoId, outputPath, {
        title: displayName,
        thumbnail: musicMeta.thumbnail,
      });
      if (cached) {
        cleanupFile(outputPath);
        outputPath = cached.path;
      }
      // If cache write fails, keep streaming the temp file (and delete after).
    }

    let saved = null;
    if (asAttachment) {
      saved = await saveLinkForUser(req.user?.id, {
        url: watchUrl,
        title: displayName,
        videoId,
      });
    }

    const ext = path.extname(outputPath).replace(/^\./, "") || downloadOptions.format;
    const filename = ensureMediaExtension(displayName, ext);
    const stat = fs.statSync(outputPath);

    if (!stat.size || stat.size < 256) {
      if (asAttachment) cleanupFile(outputPath);
      return res.status(500).json({ error: "Downloaded audio was empty" });
    }

    res.setHeader("Content-Type", contentTypeForExt(ext));
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader(
      "Content-Disposition",
      `${asAttachment ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.setHeader("X-Video-Title", encodeURIComponent(displayName));
    res.setHeader("X-Download-Format", downloadOptions.format);
    res.setHeader("X-Download-Quality", downloadOptions.quality);
    if (videoId) res.setHeader("X-Video-Id", videoId);
    if (saved) res.setHeader("X-Saved-Id", String(saved.id));
    const thumb = musicMeta.thumbnail;
    if (thumb) res.setHeader("X-Thumbnail", encodeURIComponent(thumb));
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Disposition, X-Video-Title, X-Video-Id, X-Saved-Id, X-Thumbnail, X-Download-Format, X-Download-Quality",
    );

    const stream = fs.createReadStream(outputPath);
    const cachedListenPath = !asAttachment
      ? readListenCache(videoId)?.path
      : null;
    const keepFile =
      !asAttachment && cachedListenPath && outputPath === cachedListenPath;
    // Keep listen-cache files; only wipe one-off download temps.
    stream.on("close", () => {
      if (!keepFile) cleanupFile(outputPath);
    });
    stream.on("error", (err) => {
      console.error("stream error:", err);
      if (!keepFile) cleanupFile(outputPath);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to stream file" });
      } else {
        res.end();
      }
    });
    stream.pipe(res);
  } catch (err) {
    if (err.code === "ABORT_ERR" || abort.signal.aborted) {
      cleanupFile(outputPath);
      return;
    }
    console.error(err);
    cleanupFile(outputPath);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Download failed" });
    }
  } finally {
    res.off("close", onClientGone);
  }
}

exports.downloadMp3 = async (req, res) => {
  return prepareDownloadResponse(req, res, { asAttachment: true });
};

/** Stream MP3 conversion for in-browser listening (inline, not saved). */
exports.streamMp3 = async (req, res) => {
  return prepareDownloadResponse(req, res, { asAttachment: false });
};

exports.downloadBatch = async (req, res) => {
  const createdFiles = [];

  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ error: "Select at least one track to download" });
    }
    if (items.length > MAX_BATCH) {
      return res.status(400).json({
        error: `You can download at most ${MAX_BATCH} tracks at once`,
      });
    }

    let downloadOptions;
    try {
      downloadOptions = normalizeDownloadOptions({
        format: req.body?.format,
        quality: req.body?.quality,
      });
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    ensureDownloadDir();

    const prepared = [];
    const usedNames = new Set();
    const albumName = sanitizeFilename(
      req.body?.zipName || req.body?.album || "TubeToCD Playlist",
    );

    for (const [index, item] of items.entries()) {
      const videoId = extractVideoId(item?.url) || item?.id;
      if (!videoId) {
        return res.status(400).json({
          error: `Item ${index + 1} is missing a valid YouTube video URL`,
        });
      }

      const watchUrl = videoWatchUrl(videoId);
      let baseName = sanitizeFilename(
        item.filename || item.title || `track-${index + 1}`,
      );

      let unique = baseName;
      let suffix = 2;
      while (usedNames.has(unique.toLowerCase())) {
        unique = `${baseName} (${suffix})`;
        suffix += 1;
      }
      usedNames.add(unique.toLowerCase());

      const jobId = randomUUID();
      let info = null;
      try {
        info = await fetchFlatInfo(watchUrl, { playlist: false });
      } catch {
        info = { title: item.title || unique };
      }

      const musicMeta = buildMusicMeta(info, {
        trackTitle: info.title || item.title || unique,
        artist: item.uploader || item.artist || getUploaderName(info),
        album: albumName,
        albumArtist: item.uploader || getUploaderName(info) || albumName,
        trackNumber: item.index || item.trackNumber || index + 1,
        thumbnail: item.thumbnail || pickThumbnail(info),
        sourceUrl: watchUrl,
        uploadDate: info.upload_date,
      });

      let outputPath;
      try {
        const result = await downloadMediaToFile(
          watchUrl,
          jobId,
          musicMeta,
          downloadOptions,
        );
        outputPath = result.path;
      } catch (err) {
        console.error(`batch download failed for ${videoId}:`, err.message || err);
        cleanupFiles(createdFiles);
        return res.status(500).json({
          error: `Failed to download “${unique}”. Try fewer tracks or retry.`,
        });
      }

      if (!outputPath) {
        outputPath = resolveOutputPath(jobId, downloadOptions.format);
      }
      if (!outputPath) {
        cleanupFiles(createdFiles);
        return res.status(500).json({
          error: `Download finished but file was missing for “${unique}”`,
        });
      }

      if (downloadOptions.format === "mp3") {
        await applyMusicTags(outputPath, musicMeta);
      }

      const ext =
        path.extname(outputPath).replace(/^\./, "") || downloadOptions.format;
      createdFiles.push(outputPath);
      prepared.push({
        path: outputPath,
        filename: ensureMediaExtension(unique, ext),
        watchUrl,
        videoId,
        title: unique,
        ext,
      });

      await saveLinkForUser(req.user?.id, {
        url: watchUrl,
        title: unique,
        videoId,
      });
    }

    if (prepared.length === 1) {
      const only = prepared[0];
      res.setHeader("Content-Type", contentTypeForExt(only.ext));
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(only.filename)}`,
      );
      res.setHeader("X-Video-Title", encodeURIComponent(only.title));
      res.setHeader("X-Download-Format", downloadOptions.format);
      res.setHeader("X-Download-Quality", downloadOptions.quality);
      res.setHeader(
        "Access-Control-Expose-Headers",
        "Content-Disposition, X-Video-Title, X-Download-Format, X-Download-Quality",
      );
      const stream = fs.createReadStream(only.path);
      stream.on("close", () => cleanupFiles(createdFiles));
      stream.on("error", () => {
        cleanupFiles(createdFiles);
        if (!res.headersSent) res.status(500).json({ error: "Failed to stream file" });
      });
      return stream.pipe(res);
    }

    const folderName = sanitizeFilename(req.body?.zipName || "y2m-playlist");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(`${folderName}.zip`)}`,
    );
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Disposition",
    );

    const archive = archiver("zip", { zlib: { level: 5 } });
    archive.on("error", (err) => {
      console.error("zip error:", err);
      cleanupFiles(createdFiles);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to create zip" });
      } else {
        res.end();
      }
    });
    res.on("close", () => cleanupFiles(createdFiles));
    archive.pipe(res);

    for (const file of prepared) {
      archive.file(file.path, { name: `${folderName}/${file.filename}` });
    }
    await archive.finalize();
  } catch (err) {
    console.error(err);
    cleanupFiles(createdFiles);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Batch download failed" });
    }
  }
};
