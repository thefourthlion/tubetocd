import type { LibraryTrack } from "@/lib/library";
import type { PlayableTrack } from "@/lib/player";
import type { SavedPlaylist, SavedPlaylistTrack } from "@/lib/playlists";
import {
  extractVideoId,
  resolveMediaSizes,
  resolveThumbnail,
  youtubeWatchUrl,
  type PlaylistEntry,
  type YoutubeLink,
} from "@/lib/youtube";

export type DeskItemKind = "video" | "playlist" | "track";

export type DeskItem = {
  key: string;
  videoId: string | null;
  playlistId: string | null;
  savedPlaylistId: number | null;
  url: string;
  title: string;
  channel: string | null;
  album: string | null;
  duration: number | null;
  size: number | null;
  sizeMp3: number | null;
  sizeMp4: number | null;
  sizeEstimated: boolean;
  views: number | null;
  thumbnail: string | null;
  kind: DeskItemKind;
  /** Result kind shown in the Type column (`video` or `playlist`). */
  type: string;
  downloaded: boolean;
  /** The signed-in user's star rating, or null while unrated. */
  quality: number | null;
  /**
   * Subject the rating is stored against, shared by every copy of the same
   * video or playlist. Null when the item has nothing stable to key on.
   */
  ratingKey: string | null;
  trackCount: number | null;
};

export type DeskSortKey =
  | "quality"
  | "index"
  | "title"
  | "type"
  | "size"
  | "duration"
  | "views"
  | "channel";

export type DeskSortDirection = "asc" | "desc";

export type DeskSort = { key: DeskSortKey; direction: DeskSortDirection };

function sortValue(
  item: DeskItem,
  index: number,
  key: DeskSortKey,
): string | number | null {
  switch (key) {
    case "quality":
      return item.quality;
    case "index":
      return index;
    case "title":
      return item.title;
    case "type":
      return item.type;
    case "size":
      // Prefer MP3 size for sorting; playlists fall back to track count.
      if (item.kind === "playlist") {
        return item.sizeMp3 ?? item.size ?? item.trackCount;
      }
      return item.sizeMp3 ?? item.size;
    case "duration":
      return item.duration;
    case "views":
      return item.views;
    case "channel":
      return item.channel;
  }
}

/**
 * Sorts a copy of `items` by the given column. Rows with no value for the
 * column stay at the bottom in both directions, and the original order breaks
 * ties so repeated sorts stay stable.
 */
export function sortDeskItems(
  items: DeskItem[],
  sort: DeskSort | null,
): DeskItem[] {
  if (!sort) return items;
  const factor = sort.direction === "asc" ? 1 : -1;
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const left = sortValue(a.item, a.index, sort.key);
      const right = sortValue(b.item, b.index, sort.key);
      if (left == null || left === "") {
        if (right == null || right === "") return a.index - b.index;
        return 1;
      }
      if (right == null || right === "") return -1;
      const delta =
        typeof left === "string" && typeof right === "string"
          ? left.localeCompare(right, undefined, { sensitivity: "base" })
          : Number(left) - Number(right);
      return delta * factor || a.index - b.index;
    })
    .map(({ item }) => item);
}

function videoRatingKey(videoId: string | null): string | null {
  return videoId ? `video:${videoId}` : null;
}

function playlistRatingKey(playlistId: string | null): string | null {
  return playlistId ? `playlist:${playlistId}` : null;
}

export function deskItemFromSearchResult(entry: PlaylistEntry): DeskItem {
  const isPlaylist = entry.resultType === "playlist";
  const videoId = isPlaylist ? null : entry.id;
  const sizes = resolveMediaSizes(entry);
  return {
    // A mixed search returns both kinds, so the kind is part of the row key.
    key: `search:${isPlaylist ? "playlist" : "video"}:${entry.id}`,
    videoId,
    playlistId: isPlaylist ? entry.id : null,
    savedPlaylistId: null,
    url: entry.url,
    title: entry.title,
    channel: entry.uploader,
    album: null,
    duration: entry.duration,
    size: sizes.mp3,
    sizeMp3: sizes.mp3,
    sizeMp4: sizes.mp4,
    sizeEstimated: entry.filesizeEstimated ?? true,
    views: entry.viewCount,
    thumbnail: resolveThumbnail(entry.thumbnail, videoId, entry.url),
    kind: isPlaylist ? "playlist" : "video",
    type: isPlaylist ? "playlist" : "video",
    downloaded: false,
    quality: null,
    ratingKey: isPlaylist
      ? playlistRatingKey(entry.id)
      : videoRatingKey(videoId),
    trackCount: entry.trackCount ?? null,
  };
}

export function deskItemFromPlaylistEntry(
  entry: PlaylistEntry,
  playlistId: string | null,
): DeskItem {
  const sizes = resolveMediaSizes(entry);
  return {
    key: `entry:${playlistId ?? "none"}:${entry.id}`,
    videoId: entry.id,
    playlistId,
    savedPlaylistId: null,
    url: entry.url,
    title: entry.title,
    channel: entry.uploader,
    album: null,
    duration: entry.duration,
    size: sizes.mp3,
    sizeMp3: sizes.mp3,
    sizeMp4: sizes.mp4,
    sizeEstimated: entry.filesizeEstimated ?? true,
    views: entry.viewCount,
    thumbnail: resolveThumbnail(entry.thumbnail, entry.id, entry.url),
    kind: "video",
    type: "video",
    downloaded: false,
    quality: null,
    ratingKey: videoRatingKey(entry.id),
    trackCount: null,
  };
}

export function deskItemFromLibraryTrack(track: LibraryTrack): DeskItem {
  const videoId = track.videoId || extractVideoId(track.link);
  const sizes = resolveMediaSizes(track);
  return {
    key: `track:${track.playlistId}:${track.id}`,
    videoId,
    playlistId: track.playlistYoutubeId,
    savedPlaylistId: track.playlistId ?? null,
    url: track.link || (videoId ? youtubeWatchUrl(videoId) : ""),
    title: track.title,
    channel: track.uploader,
    album: track.playlistTitle,
    duration: track.duration,
    size: sizes.mp3,
    sizeMp3: sizes.mp3,
    sizeMp4: sizes.mp4,
    sizeEstimated: true,
    views:
      track.viewCount != null && Number(track.viewCount) >= 0
        ? Number(track.viewCount)
        : null,
    thumbnail: resolveThumbnail(track.thumbnail, videoId, track.link),
    kind: "track",
    type: "video",
    downloaded: Boolean(track.downloaded),
    quality: null,
    ratingKey: videoRatingKey(videoId),
    trackCount: null,
  };
}

export function deskItemFromSavedPlaylistTrack(
  track: SavedPlaylistTrack,
): DeskItem {
  const videoId = track.videoId || extractVideoId(track.link);
  const sizes = resolveMediaSizes(track);
  return {
    key: `saved-track:${track.playlistId}:${track.id}`,
    videoId,
    playlistId: null,
    savedPlaylistId: track.playlistId ?? null,
    url: track.link || (videoId ? youtubeWatchUrl(videoId) : ""),
    title: track.title,
    channel: track.uploader,
    album: null,
    duration: track.duration,
    size: sizes.mp3,
    sizeMp3: sizes.mp3,
    sizeMp4: sizes.mp4,
    sizeEstimated: true,
    views:
      track.viewCount != null && Number(track.viewCount) >= 0
        ? Number(track.viewCount)
        : null,
    thumbnail: resolveThumbnail(track.thumbnail, videoId, track.link),
    kind: "track",
    type: "video",
    downloaded: Boolean(track.downloaded),
    quality: null,
    ratingKey: videoRatingKey(videoId),
    trackCount: null,
  };
}

/**
 * Last-resort row for a track that reached the player without one, such as a
 * one-off preview started from a link. Only the fields the player carries are
 * known, so the details sheet shows blanks for the rest.
 */
export function deskItemFromPlayableTrack(track: PlayableTrack): DeskItem {
  const videoId = extractVideoId(track.url);
  return {
    key: `playing:${track.id}`,
    videoId,
    playlistId: null,
    savedPlaylistId: null,
    url: track.url,
    title: track.title,
    channel: track.uploader ?? null,
    album: null,
    duration: null,
    size: null,
    sizeMp3: null,
    sizeMp4: null,
    sizeEstimated: false,
    views: null,
    thumbnail: resolveThumbnail(track.thumbnail, videoId, track.url),
    kind: "video",
    type: "video",
    downloaded: false,
    quality: null,
    ratingKey: videoRatingKey(videoId),
    trackCount: null,
  };
}

export function deskItemFromSavedPlaylist(playlist: SavedPlaylist): DeskItem {
  const sizeMp3 = playlist.totalFilesizeMp3 ?? playlist.totalFilesize ?? null;
  const sizeMp4 = playlist.totalFilesizeMp4 ?? null;
  const isChannel = playlist.kind === "channel";
  return {
    key: `playlist:${playlist.id}`,
    videoId: null,
    playlistId: playlist.youtubePlaylistId,
    savedPlaylistId: playlist.id,
    url: playlist.sourceUrl,
    title: playlist.title,
    channel: playlist.uploader || playlist.handle || null,
    album: playlist.title,
    duration: playlist.totalDuration ?? null,
    size: sizeMp3,
    sizeMp3,
    sizeMp4,
    sizeEstimated: sizeMp3 != null || sizeMp4 != null,
    views: null,
    thumbnail: playlist.thumbnail ?? null,
    kind: "playlist",
    type: isChannel ? "channel" : "playlist",
    downloaded: (playlist.downloadedCount ?? 0) > 0,
    quality: null,
    ratingKey:
      playlistRatingKey(playlist.youtubePlaylistId) ??
      `saved-playlist:${playlist.id}`,
    trackCount: playlist.trackCount ?? null,
  };
}

export function deskItemFromYoutubeLink(link: YoutubeLink): DeskItem {
  const videoId = link.videoId || extractVideoId(link.link);
  return {
    key: `link:${link.id}`,
    videoId,
    playlistId: null,
    savedPlaylistId: null,
    url: link.link,
    title: link.title || link.link,
    channel: null,
    album: null,
    duration: null,
    size: null,
    sizeMp3: null,
    sizeMp4: null,
    sizeEstimated: false,
    views: null,
    thumbnail: resolveThumbnail(link.thumbnail, videoId, link.link),
    kind: "video",
    type: "video",
    downloaded: true,
    quality: null,
    ratingKey: videoRatingKey(videoId) ?? `link:${link.id}`,
    trackCount: null,
  };
}
