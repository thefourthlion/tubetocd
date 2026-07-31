const path = require("path");
const fs = require("fs");

const LISTEN_CACHE_DIR = path.join(__dirname, "../downloads/listen-cache");
const LISTEN_CACHE_TTL_MS = Number(process.env.LISTEN_CACHE_TTL_MS) || 48 * 60 * 60 * 1000;

/** videoId -> Promise<{ path, title, thumbnail }> */
const inflight = new Map();

function ensureListenCacheDir() {
  if (!fs.existsSync(LISTEN_CACHE_DIR)) {
    fs.mkdirSync(LISTEN_CACHE_DIR, { recursive: true });
  }
}

function cachePaths(videoId) {
  const id = String(videoId || "").replace(/[^a-zA-Z0-9_-]/g, "");
  return {
    mp3: path.join(LISTEN_CACHE_DIR, `${id}.mp3`),
    meta: path.join(LISTEN_CACHE_DIR, `${id}.json`),
  };
}

function readListenCache(videoId) {
  if (!videoId) return null;
  ensureListenCacheDir();
  const { mp3, meta } = cachePaths(videoId);
  if (!fs.existsSync(mp3)) return null;

  try {
    const stat = fs.statSync(mp3);
    if (!stat.size || stat.size < 256) {
      fs.unlinkSync(mp3);
      if (fs.existsSync(meta)) fs.unlinkSync(meta);
      return null;
    }
    if (Date.now() - stat.mtimeMs > LISTEN_CACHE_TTL_MS) {
      fs.unlinkSync(mp3);
      if (fs.existsSync(meta)) fs.unlinkSync(meta);
      return null;
    }

    let title = null;
    let thumbnail = null;
    if (fs.existsSync(meta)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(meta, "utf8"));
        title = parsed.title || null;
        thumbnail = parsed.thumbnail || null;
      } catch {
        // ignore corrupt meta
      }
    }

    return { path: mp3, size: stat.size, title, thumbnail, cached: true };
  } catch {
    return null;
  }
}

function writeListenCache(videoId, sourcePath, { title, thumbnail } = {}) {
  if (!videoId || !sourcePath || !fs.existsSync(sourcePath)) return null;
  ensureListenCacheDir();
  const { mp3, meta } = cachePaths(videoId);
  try {
    fs.copyFileSync(sourcePath, mp3);
    fs.writeFileSync(
      meta,
      JSON.stringify({
        title: title || null,
        thumbnail: thumbnail || null,
        cachedAt: new Date().toISOString(),
      }),
    );
    const stat = fs.statSync(mp3);
    return { path: mp3, size: stat.size, title, thumbnail, cached: true };
  } catch (err) {
    console.error("listen cache write failed:", err.message || err);
    return null;
  }
}

/**
 * Share one convert job across concurrent Listen clicks for the same video.
 */
function withListenInflight(videoId, run) {
  const key = String(videoId || "");
  if (!key) return run();
  const existing = inflight.get(key);
  if (existing) return existing;

  const job = Promise.resolve()
    .then(run)
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, job);
  return job;
}

module.exports = {
  LISTEN_CACHE_DIR,
  ensureListenCacheDir,
  readListenCache,
  writeListenCache,
  withListenInflight,
};
