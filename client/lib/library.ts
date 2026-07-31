import axios from "axios";
import { API_URL } from "@/lib/api-base";
import { getToken } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/api-error";
import { SavedPlaylist, SavedPlaylistTrack } from "@/lib/playlists";
import { YoutubeLink } from "@/lib/youtube";

export type LibraryTrack = SavedPlaylistTrack & {
  playlistTitle: string;
  playlistYoutubeId: string | null;
};

export type LibraryResponse = {
  query: string | null;
  type: string;
  stats: {
    playlists: number;
    tracks: number;
    videos: number;
    downloadedTracks: number;
  };
  playlists: SavedPlaylist[];
  tracks: LibraryTrack[];
  videos: YoutubeLink[];
};

export type LibraryType = "all" | "playlists" | "tracks" | "videos";

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

export async function fetchLibrary(options?: {
  q?: string;
  type?: LibraryType;
}): Promise<LibraryResponse> {
  try {
    const { data } = await api.get<LibraryResponse>("/api/library", {
      params: {
        q: options?.q || undefined,
        type: options?.type || "all",
      },
    });
    return data;
  } catch (err) {
    throw new Error(getErrorMessage(err, "Failed to load saved library"));
  }
}
