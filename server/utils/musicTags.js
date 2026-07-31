const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const NodeID3 = require("node-id3");

function readFileIfExists(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
  } catch {
    // ignore
  }
  return null;
}

function findSiblingThumbnail(mp3Path) {
  const base = mp3Path.replace(/\.mp3$/i, "");
  const candidates = [
    `${base}.jpg`,
    `${base}.jpeg`,
    `${base}.png`,
    `${base}.webp`,
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const dir = path.dirname(mp3Path);
  const stem = path.basename(base);
  try {
    const match = fs
      .readdirSync(dir)
      .find(
        (name) =>
          name.startsWith(stem) &&
          /\.(jpe?g|png|webp)$/i.test(name) &&
          name !== path.basename(mp3Path),
      );
    return match ? path.join(dir, match) : null;
  } catch {
    return null;
  }
}

function fetchBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (!url || redirects > 5) {
      return reject(new Error("Invalid thumbnail URL"));
    }
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { timeout: 20000 }, (res) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        res.resume();
        return resolve(fetchBuffer(res.headers.location, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Thumbnail HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Thumbnail request timed out"));
    });
  });
}

function pickMime(buffer, fallbackUrl = "") {
  if (buffer?.[0] === 0xff && buffer?.[1] === 0xd8) return "image/jpeg";
  if (
    buffer?.[0] === 0x89 &&
    buffer?.[1] === 0x50 &&
    buffer?.[2] === 0x4e &&
    buffer?.[3] === 0x47
  ) {
    return "image/png";
  }
  if (/\.png(\?|$)/i.test(fallbackUrl)) return "image/png";
  return "image/jpeg";
}

/**
 * Write ID3 music tags + front cover art onto an MP3.
 * @returns {{ tagged: boolean, coverEmbedded: boolean }}
 */
async function applyMusicTags(mp3Path, meta = {}) {
  const result = { tagged: false, coverEmbedded: false };
  if (!mp3Path || !fs.existsSync(mp3Path)) return result;

  const title = meta.title || meta.trackTitle || "Unknown Title";
  const artist = meta.artist || meta.uploader || "Unknown Artist";
  const album = meta.album || meta.playlistTitle || artist;
  const trackNumber = meta.trackNumber || meta.track || null;
  const year =
    meta.year ||
    (meta.uploadDate && String(meta.uploadDate).slice(0, 4)) ||
    null;

  let imageBuffer = null;
  let imageMime = "image/jpeg";
  let localThumb = null;

  localThumb = findSiblingThumbnail(mp3Path);
  if (localThumb) {
    imageBuffer = readFileIfExists(localThumb);
    imageMime = pickMime(imageBuffer, localThumb);
  }

  if (!imageBuffer && meta.thumbnail) {
    try {
      imageBuffer = await fetchBuffer(meta.thumbnail);
      imageMime = pickMime(imageBuffer, meta.thumbnail);
    } catch (err) {
      console.warn("cover fetch failed:", err.message || err);
    }
  }

  // Prefer a square-ish JPEG-compatible buffer; node-id3 accepts jpeg/png
  const tags = {
    title: String(title).slice(0, 200),
    artist: String(artist).slice(0, 200),
    album: String(album).slice(0, 200),
    genre: meta.genre || "Music",
    comment: {
      language: "eng",
      text: meta.comment || meta.sourceUrl || "Downloaded with TubeToCD",
    },
  };

  if (year && /^\d{4}$/.test(String(year))) {
    tags.year = String(year);
  }
  if (trackNumber != null && !Number.isNaN(Number(trackNumber))) {
    tags.trackNumber = String(trackNumber);
  }
  if (meta.albumArtist) {
    tags.performerInfo = String(meta.albumArtist).slice(0, 200);
  }

  if (imageBuffer && imageBuffer.length > 0) {
    tags.image = {
      mime: imageMime,
      type: { id: 3, name: "front cover" },
      description: "Cover",
      imageBuffer,
    };
    result.coverEmbedded = true;
  }

  const ok = NodeID3.write(tags, mp3Path);
  result.tagged = ok === true;

  if (localThumb) {
    fs.promises.unlink(localThumb).catch(() => {});
  }

  return result;
}

module.exports = {
  applyMusicTags,
  findSiblingThumbnail,
};
