import { env } from "../../../env";

const API_BASE_URL = env.VITE_PUBLIC_TORII + "/sql";
const GAME_API_BASE_URL = env.VITE_PUBLIC_GAME_TORII + "/sql";

/**
 * Generic API client for making SQL queries to the backend.
 * Handles URL construction, error handling, and JSON parsing.
 * @param query - The SQL query string
 * @returns The parsed JSON response
 */
export async function fetchSQL<T = any>(query: string): Promise<T> {
  const url = `${API_BASE_URL}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  console.log(response);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }
  return await response.json();
}

export async function gameClientFetch<T = any>(query: string): Promise<T> {
  const url = `${GAME_API_BASE_URL}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  console.log(response);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }
  return await response.json();
}
