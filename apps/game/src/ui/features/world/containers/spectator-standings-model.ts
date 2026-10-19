import { normalizeLeaderboardAddress } from "@/ui/features/social/player/finalized-blitz-leaderboard";

/** A player's place and points as the native store holds them, the same standings the players panel ranks by. */
interface Standing {
  address: string;
  rank: number;
  totalPoints: number;
}

/** The top ten by rank, and the selected structure's owner pinned after them when they rank lower. */
export function selectSpectatorStandings(entries: readonly Standing[], pinnedAddress: bigint | undefined) {
  const pinnedKey = pinnedAddress ? normalizeLeaderboardAddress(pinnedAddress) : null;
  const ranked = entries.toSorted((left, right) => left.rank - right.rank);
  const visible = ranked.slice(0, 10);
  const pinned = ranked.find((entry) => normalizeLeaderboardAddress(entry.address) === pinnedKey);
  if (pinned && !visible.includes(pinned)) visible.push(pinned);
  return visible.map((entry) => {
    const address = normalizeLeaderboardAddress(entry.address);
    return { ...entry, address, pinned: address === pinnedKey };
  });
}
