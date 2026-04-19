import type { WorldSummary } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useWorldsSummary } from "./use-worlds-summary";

export interface WorldPartition {
  live: WorldSummary[];
  upcoming: WorldSummary[];
  ended: WorldSummary[];
  offline: WorldSummary[];
  unknown: WorldSummary[];
}

const EMPTY_PARTITION: WorldPartition = {
  live: [],
  upcoming: [],
  ended: [],
  offline: [],
  unknown: [],
};

export function partitionWorlds(summaries: WorldSummary[], nowSec: number): WorldPartition {
  const partition: WorldPartition = {
    live: [],
    upcoming: [],
    ended: [],
    offline: [],
    unknown: [],
  };

  for (const summary of summaries) {
    if (!summary.alive) {
      partition.offline.push(summary);
      continue;
    }
    if (summary.startMainAt == null) {
      partition.unknown.push(summary);
      continue;
    }
    if (summary.endAt != null && nowSec >= summary.endAt) {
      partition.ended.push(summary);
      continue;
    }
    if (nowSec < summary.startMainAt) {
      partition.upcoming.push(summary);
      continue;
    }
    partition.live.push(summary);
  }

  return partition;
}

/**
 * Hook consuming the shared worlds summary and partitioning by live/upcoming/ended/offline/unknown.
 * `nowSec` defaults to Date.now()/1000. Callers that need a reactive clock should pass their own.
 */
export function usePartitionedWorlds(nowSec?: number): {
  partition: WorldPartition;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isPending, error } = useWorldsSummary();
  const effectiveNow = nowSec ?? Math.floor(Date.now() / 1000);

  const partition = useMemo(() => {
    if (!data) return EMPTY_PARTITION;
    return partitionWorlds(data, effectiveNow);
  }, [data, effectiveNow]);

  return {
    partition,
    isLoading: isPending,
    error: (error as Error | null) ?? null,
  };
}
