import { normalizeLeaderboardAddress } from "@/ui/features/social/player/finalized-blitz-leaderboard";

/** A player's place and points as the native store holds them, the same standings the players panel ranks by. */
interface Standing {
  address: string;
  rank: number;
  totalPoints: number;
}

/**
 * Every player by rank, the viewer's own row marked `own`, as on Results: a tie is never lit as someone's first place.
 */
export function selectSpectatorStandings(entries: readonly Standing[], viewer: string | null | undefined) {
  const ownKey = viewer ? normalizeLeaderboardAddress(viewer) : null;
  return entries
    .map((entry) => ({ ...entry, address: normalizeLeaderboardAddress(entry.address) }))
    .toSorted((left, right) => left.rank - right.rank)
    .map((entry) => ({ ...entry, own: entry.address === ownKey }));
}
