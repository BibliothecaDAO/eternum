import type { WorldSummary } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";

import { getWorldDirectory } from "@/runtime/world/world-directory";
import { fetchAppchainWorldsSummary } from "./appchain-worlds-summary";
import { WORLD_SUMMARY_QUERY_KEY } from "./world-list-queries";

/**
 * The landing games list: the union of every directory world's GameRegistry
 * summary. One request per world (two at most — blitz + eternum share the MVP
 * chain); React Query deduplicates across components. A world whose herald is
 * unreachable contributes nothing rather than failing the whole list.
 */
export async function fetchWorldsSummary(): Promise<WorldSummary[]> {
  const perWorld = await Promise.all(
    getWorldDirectory().map((world) =>
      fetchAppchainWorldsSummary(world).catch((error) => {
        console.error(`[worlds-summary] world "${world.id}" Herald directory failed`, error);
        return [] as WorldSummary[];
      }),
    ),
  );
  return perWorld.flat();
}

export const useWorldsSummary = () =>
  useQuery({
    queryKey: WORLD_SUMMARY_QUERY_KEY,
    queryFn: fetchWorldsSummary,
    staleTime: 25_000,
    retry: 1,
  });
