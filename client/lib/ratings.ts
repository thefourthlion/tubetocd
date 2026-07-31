import axios from "axios";
import { API_URL } from "@/lib/api-base";
import { getToken } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/api-error";

/** Star counts keyed by rating subject, e.g. `{ "video:dQw4w9WgXcQ": 4 }`. */
export type RatingMap = Record<string, number>;

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

export async function fetchRatings(): Promise<RatingMap> {
  try {
    const { data } = await api.get<{ data: RatingMap }>("/api/ratings");
    return data.data ?? {};
  } catch (err) {
    throw new Error(getErrorMessage(err, "Failed to load your ratings"));
  }
}

/** Sets the signed-in user's rating for `subject`. Pass 0 stars to clear it. */
export async function saveRating(
  subject: string,
  stars: number,
): Promise<number | null> {
  try {
    const { data } = await api.put<{ subject: string; stars: number | null }>(
      "/api/ratings",
      { subject, stars },
    );
    return data.stars;
  } catch (err) {
    throw new Error(getErrorMessage(err, "Failed to save your rating"));
  }
}
