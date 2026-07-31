const OpenAI = require("openai");
const { sanitizeFilename } = require("../utils/youtube");

const SYSTEM_PROMPT = `You name music downloads for a personal library.

Return STRICT JSON only matching the schema. No markdown.

Industry-standard music file naming:
- Prefer: "Artist - Title"
- Folder/album: concise collection name like "Artist - Album", "Artist - Soundtrack", or a clean playlist name — not raw YouTube spam.
- Infer the real artist from the video title when present (e.g. Artist - Song, Artist "Song", "Song" by Artist, @Handle hints).
- If the title has no artist, use the channel/uploader name, but strip noise like "VEVO", "- Topic", "Official", "Records".
- Keep meaningful feat./ft./with credits.
- Strip YouTube noise from titles and folders: (Official Video), Official Audio, Lyrics, Lyric Video, Audio, HD, 4K, 1080p, MV, Music Video, Visualizer, Full Album, Soundtrack Video, Episode markers when they aren't part of the song name, emoji, hashtags, trailing channel spam.
- For soundtrack/OST playlists, prefer clean track titles and a consistent album/folder name; include episode/context only when it helps identify the cue.
- Do NOT include file extensions (.mp3, etc.).
- Do NOT include path separators or track numbers in filenames (the app already has track order).
- Keep each name under 120 characters.
- Return exactly one filename per input track id, same set of ids.
- If the user provides extra naming instructions, follow those for format/style (e.g. "Title only", "Artist_Title", include album year). Still strip YouTube spam and keep names filesystem-safe.`;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error(
      "OPENAI_API_KEY is not set. Add it to server/.env and restart the API.",
    );
    err.status = 503;
    throw err;
  }
  return new OpenAI({ apiKey });
}

function normalizeTrackInput(raw, index) {
  const id = String(raw?.id || "").trim();
  if (!id) return null;
  return {
    id,
    index: Number(raw?.index) || index + 1,
    title: String(raw?.title || "").trim() || `Track ${index + 1}`,
    uploader:
      raw?.uploader == null || raw?.uploader === ""
        ? null
        : String(raw.uploader).trim(),
    currentFilename:
      raw?.filename == null || raw?.filename === ""
        ? null
        : String(raw.filename).trim(),
  };
}

const MAX_INSTRUCTIONS = 2000;

/**
 * Suggest industry-standard folder + file names from YouTube metadata.
 * Body: {
 *   playlistTitle?, playlistUploader?, instructions?,
 *   tracks: [{ id, title, uploader?, index?, filename? }]
 * }
 */
exports.nameTracks = async (req, res) => {
  try {
    const tracksIn = Array.isArray(req.body?.tracks) ? req.body.tracks : [];
    if (tracksIn.length === 0) {
      return res.status(400).json({ error: "At least one track is required" });
    }

    const tracks = tracksIn
      .map((track, index) => normalizeTrackInput(track, index))
      .filter(Boolean);

    if (tracks.length === 0) {
      return res.status(400).json({ error: "Tracks need valid ids" });
    }

    const playlistTitle =
      req.body?.playlistTitle == null || req.body?.playlistTitle === ""
        ? null
        : String(req.body.playlistTitle).trim();
    const playlistUploader =
      req.body?.playlistUploader == null || req.body?.playlistUploader === ""
        ? null
        : String(req.body.playlistUploader).trim();
    const instructionsRaw =
      req.body?.instructions == null ? "" : String(req.body.instructions).trim();
    const instructions =
      instructionsRaw.length > MAX_INSTRUCTIONS
        ? instructionsRaw.slice(0, MAX_INSTRUCTIONS)
        : instructionsRaw || null;

    const client = getClient();
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            playlist: {
              title: playlistTitle,
              channel: playlistUploader,
            },
            userInstructions: instructions,
            tracks: tracks.map((track) => ({
              id: track.id,
              index: track.index,
              title: track.title,
              channel: track.uploader,
              currentFilename: track.currentFilename,
            })),
            respondWith: {
              folderName: "string — zip/album folder name",
              tracks: [{ id: "same as input id", filename: "Artist - Title" }],
            },
          }),
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: "AI returned invalid JSON" });
    }

    const byId = new Map(
      (Array.isArray(parsed.tracks) ? parsed.tracks : [])
        .filter((row) => row && row.id)
        .map((row) => [String(row.id), String(row.filename || "").trim()]),
    );

    const namedTracks = tracks.map((track) => {
      const suggested =
        byId.get(track.id) ||
        track.currentFilename ||
        (track.uploader
          ? `${track.uploader} - ${track.title}`
          : track.title);
      return {
        id: track.id,
        filename: sanitizeFilename(suggested),
      };
    });

    const folderFallback =
      playlistTitle ||
      (tracks.length === 1 ? namedTracks[0].filename : "y2m-playlist");
    const folderName = sanitizeFilename(
      String(parsed.folderName || folderFallback).trim() || folderFallback,
    );

    return res.json({
      folderName,
      tracks: namedTracks,
    });
  } catch (err) {
    console.error("AI name-tracks error:", err.message || err);
    const status = err.status || err.statusCode || 500;
    const message =
      status === 503
        ? err.message
        : /insufficient_quota|billing/i.test(String(err.message || ""))
          ? "OpenAI quota exceeded — check billing"
          : /invalid.?api.?key|authentication/i.test(String(err.message || ""))
            ? "OpenAI API key is invalid"
            : err.message || "Failed to generate names";
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: message,
    });
  }
};
