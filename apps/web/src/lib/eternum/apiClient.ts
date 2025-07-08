import { env } from "../../../env";

const API_BASE_URL = env.VITE_TORII_API_URL + "/sql";

/**
 * Generic API client for making SQL queries to the backend.
 * Handles URL construction, error handling, and JSON parsing.
 * @param query - The SQL query string
 * @returns The parsed JSON response
 */
export async function fetchSQL<T = any>(query: string): Promise<T> {
  const url = `${API_BASE_URL}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }
  return await response.json();
}
