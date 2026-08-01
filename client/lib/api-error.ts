import axios from "axios";
import { API_URL } from "@/lib/api-base";

const API_HINT = `Could not reach the API at ${API_URL}. If this is production, rebuild the client with NEXT_PUBLIC_API_URL set to your live API. Locally, start the server (npm run dev in server/).`;

/**
 * Turn Axios failures into actionable messages.
 * "Network Error" usually means the API process is down / unreachable.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err.message : fallback;
  }

  const data = err.response?.data;
  if (data && !(data instanceof Blob) && typeof data === "object") {
    const json = data as { error?: string };
    if (json.error) return json.error;
  }

  if (err.code === "ECONNABORTED") {
    return "Request timed out. Try again in a moment.";
  }

  if (!err.response && (err.message === "Network Error" || err.code === "ERR_NETWORK")) {
    return API_HINT;
  }

  return err.message || fallback;
}

export async function apiBlobErrorMessage(
  err: unknown,
  fallback: string,
): Promise<string> {
  if (axios.isAxiosError(err) && err.response?.data instanceof Blob) {
    try {
      const text = await err.response.data.text();
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) return parsed.error;
    } catch {
      // fall through
    }
  }
  if (axios.isAxiosError(err) && err.code === "ECONNABORTED") {
    return "Download timed out. Try a lower quality or shorter selection.";
  }
  return apiErrorMessage(err, fallback);
}
