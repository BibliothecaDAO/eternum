import { json } from "./http";

/** The shared paid-RPC ceiling applies across callers, not merely a public client's IP. */
export function ratingFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("budget exhausted")) return json({ error: "ratings_budget_exhausted" }, 429);
  return json({ error: "ratings_unavailable" }, 503);
}
