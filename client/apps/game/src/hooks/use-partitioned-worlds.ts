import type { WorldSummary } from "@bibliothecadao/types";

export interface WorldPartition {
  live: WorldSummary[];
  upcoming: WorldSummary[];
  ended: WorldSummary[];
  offline: WorldSummary[];
  unknown: WorldSummary[];
}

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
