const Playlist = require("../models/Playlist");
const PlaylistTrack = require("../models/PlaylistTrack");
const youtubeLinks = require("../models/youtubeLinks");
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

exports.getLibrary = async (req, res) => {
  try {
    const userId = String(req.user.id);
    const q = String(req.query.q || "")
      .trim()
      .toLowerCase();
    const type = String(req.query.type || "all");

    const [playlists, tracks, links] = await Promise.all([
      Playlist.findAll({
        where: { user: userId },
        order: [["updatedAt", "DESC"]],
      }),
      PlaylistTrack.findAll({
        where: { user: userId },
        order: [
          ["trackIndex", "ASC"],
          ["updatedAt", "DESC"],
        ],
      }),
      youtubeLinks.findAll({
        where: { user: userId },
        order: [["updatedAt", "DESC"]],
      }),
    ]);

    const playlistMap = new Map(
      playlists.map((playlist) => [playlist.id, playlist.toJSON()]),
    );

    const downloadedByPlaylist = new Map();
    const totalsByPlaylist = new Map();
    for (const track of tracks) {
      if (track.downloaded) {
        downloadedByPlaylist.set(
          track.playlistId,
          (downloadedByPlaylist.get(track.playlistId) || 0) + 1,
        );
      }

      const current = totalsByPlaylist.get(track.playlistId) || {
        totalFilesize: 0,
        totalFilesizeMp4: 0,
        totalDuration: 0,
      };
      current.totalFilesize += trackBytesMp3(track);
      current.totalFilesizeMp4 += trackBytesMp4(track);
      current.totalDuration += Number(track.duration) || 0;
      totalsByPlaylist.set(track.playlistId, current);
    }

    const firstTrackByPlaylist = new Map();
    for (const track of tracks) {
      if (!firstTrackByPlaylist.has(track.playlistId)) {
        firstTrackByPlaylist.set(track.playlistId, track);
      }
    }

    let playlistResults = playlists.map((playlist) => {
      const firstTrack = firstTrackByPlaylist.get(playlist.id);
      const coverVideoId = firstTrack?.videoId || null;
      const thumbnail =
        firstTrack?.thumbnail ||
        (coverVideoId
          ? `https://i.ytimg.com/vi/${coverVideoId}/hqdefault.jpg`
          : null);
      const totals = totalsByPlaylist.get(playlist.id);
      const totalFilesize =
        totals?.totalFilesize > 0 ? totals.totalFilesize : null;
      const totalFilesizeMp4 =
        totals?.totalFilesizeMp4 > 0 ? totals.totalFilesizeMp4 : null;
      return {
        ...playlist.toJSON(),
        downloadedCount: downloadedByPlaylist.get(playlist.id) || 0,
        thumbnail,
        coverVideoId,
        totalFilesize,
        totalFilesizeMp3: totalFilesize,
        totalFilesizeMp4,
        totalDuration:
          totals?.totalDuration > 0 ? totals.totalDuration : null,
      };
    });

    let trackResults = tracks.map((track) => {
      const parent = playlistMap.get(track.playlistId);
      const json = track.toJSON();
      const filesizeMp3 = trackBytesMp3(json) || null;
      const filesizeMp4 = trackBytesMp4(json) || null;
      return {
        ...json,
        filesize: filesizeMp3,
        filesizeMp3,
        filesizeMp4,
        thumbnail:
          json.thumbnail ||
          (json.videoId
            ? `https://i.ytimg.com/vi/${json.videoId}/hqdefault.jpg`
            : null),
        playlistTitle: parent?.title || "Playlist",
        playlistYoutubeId: parent?.youtubePlaylistId || null,
      };
    });

    let linkResults = links.map((link) => {
      const json = link.toJSON();
      const videoId = json.videoId || null;
      return {
        ...json,
        thumbnail: videoId
          ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
          : null,
      };
    });

    if (q) {
      playlistResults = playlistResults.filter((item) => {
        const haystack = `${item.title} ${item.uploader || ""} ${item.sourceUrl}`.toLowerCase();
        return haystack.includes(q);
      });

      trackResults = trackResults.filter((item) => {
        const haystack =
          `${item.title} ${item.uploader || ""} ${item.filename || ""} ${item.playlistTitle} ${item.link}`.toLowerCase();
        return haystack.includes(q);
      });

      linkResults = linkResults.filter((item) => {
        const haystack = `${item.title || ""} ${item.link || ""}`.toLowerCase();
        return haystack.includes(q);
      });
    }

    if (type === "playlists") {
      trackResults = [];
      linkResults = [];
    } else if (type === "tracks") {
      playlistResults = [];
      linkResults = [];
    } else if (type === "videos") {
      playlistResults = [];
      trackResults = [];
    }

    res.json({
      query: q || null,
      type,
      stats: {
        playlists: playlistResults.length,
        tracks: trackResults.length,
        videos: linkResults.length,
        downloadedTracks: trackResults.filter((t) => t.downloaded).length,
      },
      playlists: playlistResults,
      tracks: trackResults,
      videos: linkResults,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
