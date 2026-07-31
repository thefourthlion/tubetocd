/** Default local API — production uses NEXT_PUBLIC_API_URL=https://api.tubetocd.com */
export const DEFAULT_API_URL = "http://localhost:3025";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || DEFAULT_API_URL;
