import type { ServerAvailabilityVerdict } from "./connection-disconnect-classification";

/**
 * Phase 2 correlation: ask the realtime-server whether THIS world's Torii is
 * reachable from server-side infrastructure, independent of the client's own
 * network path.
 *
 * - `alive`  => server can reach the world's Torii => a client outage is most
 *               likely LOCAL or stream-specific, not a world-wide outage.
 * - `dead`   => server also cannot reach it => REMOTE.
 * - `unknown` => could not determine (network error, world not listed, timeout);
 *               classification falls back to client-only signals.
 *
 * Reuses the existing `/api/worlds/summary` endpoint (see use-worlds-summary.ts)
 * but with a short timeout because it runs inside disconnect classification.
 */

const DEFAULT_TIMEOUT_MS = 4_000;

interface ServerWorldAvailabilityOptions {
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

interface WorldSummaryAvailabilityRow {
  name?: unknown;
  alive?: unknown;
}

export async function fetchServerWorldAvailability(
  realtimeBaseUrl: string | null | undefined,
  worldName: string | null | undefined,
  { timeoutMs = DEFAULT_TIMEOUT_MS, fetchFn = fetch }: ServerWorldAvailabilityOptions = {},
): Promise<ServerAvailabilityVerdict> {
  const baseUrl = realtimeBaseUrl?.trim();
  const name = worldName?.trim();
  if (!baseUrl || !name) {
    return "unknown";
  }

  try {
    const url = `${baseUrl.replace(/\/+$/, "")}/api/worlds/summary`;
    const response = await fetchFn(url, {
      method: "GET",
      signal: timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined,
    });
    if (!response.ok) {
      return "unknown";
    }

    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) {
      return "unknown";
    }

    const match = (data as WorldSummaryAvailabilityRow[]).find((row) => row?.name === name);
    if (!match || typeof match.alive !== "boolean") {
      return "unknown";
    }

    return match.alive ? "alive" : "dead";
  } catch {
    return "unknown";
  }
}
