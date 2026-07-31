import axios from "axios";
import { API_URL } from "@/lib/api-base";
import { getToken } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/api-error";

export type AiNameTrackInput = {
  id: string;
  title: string;
  uploader?: string | null;
  index?: number;
  filename?: string | null;
};

export type AiNameTracksRequest = {
  playlistTitle?: string | null;
  playlistUploader?: string | null;
  /** Optional extra naming instructions from the user (format, style, etc.). */
  instructions?: string | null;
  tracks: AiNameTrackInput[];
};

export type AiNameTracksResponse = {
  folderName: string;
  tracks: Array<{ id: string; filename: string }>;
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

/**
 * Ask the server (OpenAI) for industry-standard folder + file names from
 * YouTube playlist/video metadata.
 */
export async function nameTracksWithAi(
  payload: AiNameTracksRequest,
): Promise<AiNameTracksResponse> {
  try {
    const { data } = await api.post<AiNameTracksResponse>(
      "/api/ai/name-tracks",
      payload,
      { timeout: 90_000 },
    );
    return data;
  } catch (err) {
    throw new Error(apiErrorMessage(err, "AI naming failed"));
  }
}
