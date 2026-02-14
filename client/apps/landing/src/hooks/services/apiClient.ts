import { env } from "../../../env";

const API_BASE_URL = env.VITE_PUBLIC_TORII + "/sql";
const GAME_API_BASE_URL = env.VITE_PUBLIC_GAME_TORII + "/sql";

interface RequestOptions {
  signal?: AbortSignal;
}

/**
 * Generic API client for making SQL queries to the backend.
 * Handles URL construction, error handling, and JSON parsing.
 * @param query - The SQL query string
 * @returns The parsed JSON response
 */
export async function fetchSQL<T = unknown>(query: string, options?: RequestOptions): Promise<T> {
  const url = `${API_BASE_URL}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, { signal: options?.signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }
  return await response.json();
}

export async function gameClientFetch<T = unknown>(query: string, options?: RequestOptions): Promise<T> {
  const url = `${GAME_API_BASE_URL}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, { signal: options?.signal });

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }
  return await response.json();
}
