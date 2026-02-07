import { env } from "../../../../../../env";

const MARKETPLACE_API_URL = env.VITE_PUBLIC_MARKETPLACE_URL + "/sql";

/**
 * Generic API client for making SQL queries to the marketplace Torii.
 * Used for querying cosmetics and loot chests data.
 * @param query - The SQL query string
 * @returns The parsed JSON response
 */
export async function fetchSQL<T = unknown>(query: string): Promise<T> {
  const url = `${MARKETPLACE_API_URL}?query=${encodeURIComponent(query)}`;
  console.log({ url });
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }
  return await response.json();
}
