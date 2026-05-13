import type { WorldSummary } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { env } from "../../env";
import { WORLD_SUMMARY_QUERY_KEY } from "./world-list-queries";

export async function fetchWorldsSummary(realtimeBaseUrl: string): Promise<WorldSummary[]> {
  const url = `${realtimeBaseUrl.replace(/\/+$/, "")}/api/worlds/summary`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error(`Worlds summary fetch failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as WorldSummary[];
  if (!Array.isArray(data)) {
    throw new Error("Worlds summary returned non-array payload");
  }
  return data;
}

/**
 * Single shared query for the whole worlds summary. React Query deduplicates across components.
 * On boot there's one request; subsequent tabs share the cached response for `staleTime`.
 */
export const useWorldsSummary = () =>
  useQuery({
    queryKey: WORLD_SUMMARY_QUERY_KEY,
    queryFn: () => fetchWorldsSummary(env.VITE_PUBLIC_REALTIME_URL),
    staleTime: 25_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
