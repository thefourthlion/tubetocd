import axios from "axios";
import { API_URL } from "@/lib/api-base";
import { getToken } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/api-error";
import { deskItemFromSavedPlaylistTrack } from "@/lib/desk";
import type { PlayableTrack } from "@/lib/player";

export type SavedPlaylistTrack = {
  id: number;
  playlistId: number;
  user: string;
  videoId: string;
  link: string;
  title: string;
  uploader: string | null;
  filename: string | null;
  duration: number | null;
  filesize: number | null;
  filesizeMp3?: number | null;
  filesizeMp4?: number | null;
  viewCount?: number | null;
  thumbnail: string | null;
  trackIndex: number;
  downloaded: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SavedPlaylist = {
  id: number;
  user: string;
  youtubePlaylistId: string;
  kind?: "playlist" | "channel";
  youtubeChannelId?: string | null;
  handle?: string | null;
  title: string;
  uploader: string | null;
  sourceUrl: string;
  trackCount: number;
  totalFilesize?: number | null;
  totalFilesizeMp3?: number | null;
  totalFilesizeMp4?: number | null;
  totalDuration?: number | null;
  downloadedCount?: number;
  thumbnail?: string | null;
  coverVideoId?: string | null;
  createdAt: string;
  updatedAt: string;
  tracks?: SavedPlaylistTrack[];
};

export type SavePlaylistPayload = {
  youtubePlaylistId: string;
  kind?: "playlist" | "channel";
  youtubeChannelId?: string | null;
  handle?: string | null;
  title: string;
  uploader?: string | null;
  sourceUrl: string;
  tracks: Array<{
    id?: string;
    videoId?: string;
    url?: string;
    link?: string;
    title: string;
    uploader?: string | null;
    filename?: string | null;
    duration?: number | null;
    filesize?: number | null;
    viewCount?: number | null;
    thumbnail?: string | null;
    index?: number;
    downloaded?: boolean;
  }>;
};

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

/** Static-export-safe detail URL (no dynamic path segments). */
export function playlistDetailPath(id: number | string): string {
  return `/pages/playlists/detail?id=${encodeURIComponent(String(id))}`;
}

export function playlistTrackToPlayable(
  track: SavedPlaylistTrack,
): PlayableTrack {
  return {
    id: track.videoId || track.link,
    url: track.link,
    title: track.title,
    uploader: track.uploader,
    thumbnail: track.thumbnail,
    filename: track.filename,
    item: deskItemFromSavedPlaylistTrack(track),
  };
}

export function playlistTracksToPlayable(
  tracks: SavedPlaylistTrack[],
): PlayableTrack[] {
  return [...tracks]
    .sort((a, b) => a.trackIndex - b.trackIndex)
    .filter((track) => Boolean(track.link))
    .map(playlistTrackToPlayable);
}

export async function fetchPlaylists(): Promise<SavedPlaylist[]> {
  try {
    const { data } = await api.get<{ data: SavedPlaylist[] }>("/api/playlists");
    return data.data;
  } catch (err) {
    throw new Error(getErrorMessage(err, "Failed to load playlists"));
  }
}

export async function fetchPlaylist(id: number | string): Promise<SavedPlaylist> {
  try {
    const { data } = await api.get<SavedPlaylist>(`/api/playlists/${id}`);
    return data;
  } catch (err) {
    throw new Error(getErrorMessage(err, "Failed to load playlist"));
  }
}

export async function savePlaylist(
  payload: SavePlaylistPayload,
): Promise<SavedPlaylist> {
  try {
    const { data } = await api.post<SavedPlaylist>("/api/playlists", payload);
    return data;
  } catch (err) {
    throw new Error(getErrorMessage(err, "Failed to save playlist"));
  }
}

export async function markPlaylistDownloaded(
  playlistId: number | string,
  videoIds: string[],
): Promise<void> {
  try {
    await api.post(`/api/playlists/${playlistId}/downloaded`, { videoIds });
  } catch (err) {
    throw new Error(getErrorMessage(err, "Failed to update downloads"));
  }
}

export async function updatePlaylistNames(
  playlistId: number | string,
  payload: {
    title?: string;
    tracks?: Array<{
      id?: number;
      videoId?: string;
      filename: string | null;
    }>;
  },
): Promise<SavedPlaylist> {
  try {
    const { data } = await api.patch<SavedPlaylist>(
      `/api/playlists/${playlistId}/names`,
      payload,
    );
    return data;
  } catch (err) {
    throw new Error(getErrorMessage(err, "Failed to save names"));
  }
}

export async function deletePlaylist(id: number | string): Promise<void> {
  try {
    await api.delete(`/api/playlists/${id}`);
  } catch (err) {
    throw new Error(getErrorMessage(err, "Failed to delete playlist"));
  }
}

export type PlaylistTrackInput = SavePlaylistPayload["tracks"][number];

export type AddTracksResult = SavedPlaylist & {
  added?: number;
  skipped?: number;
};

export async function addTracksToPlaylist(
  playlistId: number | string,
  tracks: PlaylistTrackInput | PlaylistTrackInput[],
): Promise<AddTracksResult> {
  try {
    const list = Array.isArray(tracks) ? tracks : [tracks];
    const { data } = await api.post<AddTracksResult>(
      `/api/playlists/${playlistId}/tracks`,
      { tracks: list },
    );
    return data;
  } catch (err) {
    throw new Error(getErrorMessage(err, "Failed to add to playlist"));
  }
}

export async function createLocalPlaylist(
  title: string,
): Promise<SavedPlaylist> {
  try {
    const { data } = await api.post<SavedPlaylist>("/api/playlists/local", {
      title,
    });
    return data;
  } catch (err) {
    throw new Error(getErrorMessage(err, "Failed to create playlist"));
  }
}
