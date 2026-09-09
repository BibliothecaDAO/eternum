import { normalizeLeaderboardAddress } from "@/ui/features/social/player/finalized-blitz-leaderboard";
import type { PlayerLeaderboardActivityEntry } from "@/services/leaderboard/player-activity-breakdown-service";

type Standing = Pick<PlayerLeaderboardActivityEntry, "address" | "rank" | "totalPoints">;
export interface StandingsTick {
  tick: number;
  current: Map<string, number>;
  previous: Map<string, number>;
}

export function advanceStandingsTick(
  previous: StandingsTick | null,
  tick: number,
  entries: readonly Standing[],
): StandingsTick {
  const current = new Map(entries.map((entry) => [normalizeLeaderboardAddress(entry.address), entry.totalPoints]));
  if (!previous || tick < previous.tick) return { tick, current, previous: current };
  return { tick, current, previous: tick === previous.tick ? previous.previous : previous.current };
}

export function selectSpectatorStandings(
  entries: readonly Standing[],
  pinnedAddress: bigint | undefined,
  history: StandingsTick | null,
) {
  const pinnedKey = pinnedAddress ? normalizeLeaderboardAddress(pinnedAddress) : null;
  const ranked = entries.toSorted((left, right) => left.rank - right.rank);
  const visible = ranked.slice(0, 10);
  const pinned = ranked.find((entry) => normalizeLeaderboardAddress(entry.address) === pinnedKey);
  if (pinned && !visible.includes(pinned)) visible.push(pinned);
  return visible.map((entry) => {
    const address = normalizeLeaderboardAddress(entry.address);
    return {
      ...entry,
      address,
      pinned: address === pinnedKey,
      delta: entry.totalPoints - (history?.previous.get(address) ?? entry.totalPoints),
    };
  });
}
