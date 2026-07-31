const Playlist = require("../models/Playlist");
const PlaylistTrack = require("../models/PlaylistTrack");
const { estimateMp3Bytes, estimateMp4Bytes } = require("../utils/youtube");

function trackBytesMp3(track) {
  const raw = track?.filesize;
  if (raw != null && raw !== "") {
    const n = Number(raw);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return estimateMp3Bytes(track?.duration) || 0;
}

function trackBytesMp4(track) {
  return estimateMp4Bytes(track?.duration) || 0;
}

function sumTrackTotals(tracks = []) {
  let totalFilesize = 0;
  let totalFilesizeMp4 = 0;
  let totalDuration = 0;
  for (const track of tracks) {
    totalFilesize += trackBytesMp3(track);
    totalFilesizeMp4 += trackBytesMp4(track);
    totalDuration += Number(track?.duration) || 0;
  }
  return {
    totalFilesize: totalFilesize > 0 ? totalFilesize : null,
    totalFilesizeMp3: totalFilesize > 0 ? totalFilesize : null,
    totalFilesizeMp4: totalFilesizeMp4 > 0 ? totalFilesizeMp4 : null,
    totalDuration: totalDuration > 0 ? totalDuration : null,
  };
}

function withPlaylistTotals(playlistJson, tracks = []) {
  const totals = sumTrackTotals(tracks);
  return {
    ...playlistJson,
    totalFilesize: totals.totalFilesize,
    totalFilesizeMp3: totals.totalFilesizeMp3,
    totalFilesizeMp4: totals.totalFilesizeMp4,
    totalDuration: totals.totalDuration,
  };
}

function enrichTrackSizes(track) {
  const json = typeof track.toJSON === "function" ? track.toJSON() : { ...track };
  const filesizeMp3 = trackBytesMp3(json) || null;
  const filesizeMp4 = trackBytesMp4(json) || null;
  return {
    ...json,
    filesize: filesizeMp3,
    filesizeMp3,
    filesizeMp4,
  };
}

function mapTrackInput(track, userId, playlistId, index) {
  const videoId = String(track.videoId || track.id || "");
  const link =
    track.link ||
    track.url ||
    (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null);

  if (!videoId || !link) {
    throw new Error("Each track needs a video id and link");
  }

  const duration = track.duration ?? null;
  const filesize =
    track.filesize != null && Number(track.filesize) > 0
      ? Number(track.filesize)
      : estimateMp3Bytes(duration);
  const viewRaw = track.viewCount ?? track.view_count ?? null;
  const viewCount =
    viewRaw != null && viewRaw !== "" && !Number.isNaN(Number(viewRaw))
      ? Number(viewRaw)
      : null;

  return {
    playlistId,
    user: String(userId),
    videoId,
    link,
    title: track.title || "Untitled",
    uploader: track.uploader || null,
    filename: track.filename || null,
    duration,
    filesize,
    viewCount,
    thumbnail: track.thumbnail || null,
    trackIndex: track.index ?? track.trackIndex ?? index + 1,
    downloaded: !!track.downloaded,
  };
}

function sequelizeErrorMessage(err) {
  if (err?.name === "SequelizeUniqueConstraintError") {
    const field = err.errors?.[0]?.path;
    if (field === "youtubePlaylistId" || field === "user") {
      return "This playlist is already saved. Try again — the library was repaired for re-saves.";
    }
    return "Playlist already exists for this account";
  }
  if (err?.name === "SequelizeValidationError") {
    return (
      err.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
      "Validation error"
    );
  }
  return err?.message || "Failed to save playlist";
}

exports.listPlaylists = async (req, res) => {
  try {
    const userId = String(req.user.id);
    const playlists = await Playlist.findAll({
      where: { user: userId },
      order: [["updatedAt", "DESC"]],
    });

    const tracks = await PlaylistTrack.findAll({
      where: { user: userId },
      attributes: [
        "playlistId",
        "filesize",
        "duration",
        "downloaded",
        "thumbnail",
        "videoId",
        "trackIndex",
      ],
      order: [["trackIndex", "ASC"]],
    });

    const byPlaylist = new Map();
    for (const track of tracks) {
      const list = byPlaylist.get(track.playlistId) || [];
      list.push(track);
      byPlaylist.set(track.playlistId, list);
    }

    const withCounts = playlists.map((playlist) => {
      const playlistTracks = byPlaylist.get(playlist.id) || [];
      const firstTrack = playlistTracks[0];
      const videoId = firstTrack?.videoId || null;
      const thumbnail =
        firstTrack?.thumbnail ||
        (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null);

      return withPlaylistTotals(
        {
          ...playlist.toJSON(),
          downloadedCount: playlistTracks.filter((t) => t.downloaded).length,
          thumbnail,
          coverVideoId: videoId,
        },
        playlistTracks,
      );
    });

    res.json({ data: withCounts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.getPlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findOne({
      where: { id: req.params.id, user: String(req.user.id) },
      include: [
        {
          model: PlaylistTrack,
          as: "tracks",
          separate: true,
          order: [["trackIndex", "ASC"]],
        },
      ],
    });

    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    const json = playlist.toJSON();
    const tracks = (json.tracks || []).map(enrichTrackSizes);
    const enriched = withPlaylistTotals({ ...json, tracks }, tracks);
    enriched.downloadedCount = tracks.filter((t) => t.downloaded).length;
    const firstTrack = tracks[0];
    enriched.coverVideoId = firstTrack?.videoId || null;
    enriched.thumbnail =
      firstTrack?.thumbnail ||
      (firstTrack?.videoId
        ? `https://i.ytimg.com/vi/${firstTrack.videoId}/hqdefault.jpg`
        : null);
    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.savePlaylist = async (req, res) => {
  try {
    const {
      youtubePlaylistId,
      title,
      uploader,
      sourceUrl,
      tracks,
      kind: rawKind,
      youtubeChannelId,
      handle,
    } = req.body;

    if (!youtubePlaylistId || !title || !sourceUrl) {
      return res.status(400).json({
        error: "youtubePlaylistId, title, and sourceUrl are required",
      });
    }

    const trackList = Array.isArray(tracks) ? tracks : [];
    if (trackList.length === 0) {
      return res.status(400).json({ error: "Playlist must include tracks" });
    }

    const kind = rawKind === "channel" ? "channel" : "playlist";
    const userId = String(req.user.id);
    const ytId = String(youtubePlaylistId);
    const channelId = youtubeChannelId ? String(youtubeChannelId) : null;
    const channelHandle = handle ? String(handle) : null;

    const meta = {
      title,
      uploader: uploader || null,
      sourceUrl,
      trackCount: trackList.length,
      kind,
      youtubeChannelId: channelId,
      handle: channelHandle,
    };

    let playlist = await Playlist.findOne({
      where: { user: userId, youtubePlaylistId: ytId },
    });

    if (playlist) {
      await playlist.update(meta);

      // Preserve downloaded flags for existing videoIds
      const existing = await PlaylistTrack.findAll({
        where: { playlistId: playlist.id },
      });
      const downloadedMap = new Map(
        existing
          .filter((t) => t.downloaded)
          .map((t) => [t.videoId, true]),
      );

      await PlaylistTrack.destroy({ where: { playlistId: playlist.id } });

      await PlaylistTrack.bulkCreate(
        trackList.map((track, index) => {
          const mapped = mapTrackInput(track, userId, playlist.id, index);
          mapped.downloaded =
            downloadedMap.has(mapped.videoId) || !!track.downloaded;
          return mapped;
        }),
      );
    } else {
      try {
        playlist = await Playlist.create({
          user: userId,
          youtubePlaylistId: ytId,
          ...meta,
        });
      } catch (createErr) {
        // Concurrent save for same user+playlist — update instead
        if (createErr?.name !== "SequelizeUniqueConstraintError") {
          throw createErr;
        }
        playlist = await Playlist.findOne({
          where: { user: userId, youtubePlaylistId: ytId },
        });
        if (!playlist) throw createErr;
        await playlist.update(meta);
        await PlaylistTrack.destroy({ where: { playlistId: playlist.id } });
      }

      await PlaylistTrack.bulkCreate(
        trackList.map((track, index) =>
          mapTrackInput(track, userId, playlist.id, index),
        ),
      );
    }

    const full = await Playlist.findByPk(playlist.id, {
      include: [
        {
          model: PlaylistTrack,
          as: "tracks",
          separate: true,
          order: [["trackIndex", "ASC"]],
        },
      ],
    });

    const json = full.toJSON();
    const savedTracks = json.tracks || [];
    const enriched = withPlaylistTotals(json, savedTracks);
    enriched.downloadedCount = savedTracks.filter((t) => t.downloaded).length;
    res.status(201).json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: sequelizeErrorMessage(err) });
  }
};

exports.markTracksDownloaded = async (req, res) => {
  try {
    const playlist = await Playlist.findOne({
      where: { id: req.params.id, user: String(req.user.id) },
    });
    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    const videoIds = Array.isArray(req.body?.videoIds)
      ? req.body.videoIds.map(String)
      : [];
    if (videoIds.length === 0) {
      return res.status(400).json({ error: "videoIds are required" });
    }

    await PlaylistTrack.update(
      { downloaded: true },
      {
        where: {
          playlistId: playlist.id,
          user: String(req.user.id),
          videoId: videoIds,
        },
      },
    );

    await playlist.changed("updatedAt", true);
    await playlist.save();

    res.json({ message: "Tracks marked downloaded", videoIds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Update download folder title and/or per-track filenames without rebuilding
 * the whole playlist.
 * Body: { title?: string, tracks?: [{ id?: number, videoId?: string, filename: string }] }
 */
exports.updatePlaylistNames = async (req, res) => {
  try {
    const playlist = await Playlist.findOne({
      where: { id: req.params.id, user: String(req.user.id) },
    });
    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    if (req.body?.title != null) {
      const title = String(req.body.title).trim();
      if (!title) {
        return res.status(400).json({ error: "title cannot be empty" });
      }
      await playlist.update({ title });
    }

    const trackUpdates = Array.isArray(req.body?.tracks) ? req.body.tracks : [];
    for (const row of trackUpdates) {
      const filename =
        row?.filename == null ? null : String(row.filename).trim() || null;
      const where = {
        playlistId: playlist.id,
        user: String(req.user.id),
      };
      if (row?.id != null) where.id = Number(row.id);
      else if (row?.videoId) where.videoId = String(row.videoId);
      else continue;

      await PlaylistTrack.update({ filename }, { where });
    }

    await playlist.changed("updatedAt", true);
    await playlist.save();

    const full = await Playlist.findByPk(playlist.id, {
      include: [
        {
          model: PlaylistTrack,
          as: "tracks",
          separate: true,
          order: [["trackIndex", "ASC"]],
        },
      ],
    });

    const json = full.toJSON();
    const tracks = json.tracks || [];
    const enriched = withPlaylistTotals(json, tracks);
    enriched.downloadedCount = tracks.filter((t) => t.downloaded).length;
    const firstTrack = tracks[0];
    enriched.coverVideoId = firstTrack?.videoId || null;
    enriched.thumbnail =
      firstTrack?.thumbnail ||
      (firstTrack?.videoId
        ? `https://i.ytimg.com/vi/${firstTrack.videoId}/hqdefault.jpg`
        : null);

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.deletePlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findOne({
      where: { id: req.params.id, user: String(req.user.id) },
    });
    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    await PlaylistTrack.destroy({ where: { playlistId: playlist.id } });
    await playlist.destroy();
    res.json({ message: "Playlist deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
