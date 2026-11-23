import {
  frontierPrizeHolders,
  prizeShares,
  type HeraldFrontierLeaderboardEntry,
  type HeraldFrontierPrize,
} from "@bibliothecadao/eternum/game-sync";

/**
 * Who holds a prize place: a player; "open" while no player who cleared a site does; "awarding" once the ledger fixed the
 * place's winner but has not paid it yet, so no receipt names them.
 */
export type PodiumHolder = { address: string } | "open" | "awarding";

/** A prize place on the season's podium: its place, its LORDS, and who holds it. */
export type PodiumPlace = { place: number; lords: number; holder: PodiumHolder };

/**
 * The season's podium from Herald's board: null while no prize pool is published. Until the winners are posted, the
 * game's `top_n` places and what each would take, each held by the board's next player who cleared a site
 * (frontierPrizeHolders, the rule the relay posts by) or open. Once posted, the `count` places the ledger fixed, each
 * named by its award receipt: the fixed list is the ledger's, never the board's again.
 */
export const seasonPodium = (board: {
  prize: HeraldFrontierPrize | null;
  entries: readonly Pick<HeraldFrontierLeaderboardEntry, "address" | "sites_cleared">[];
}): PodiumPlace[] | null => {
  const { prize } = board;
  if (!prize) return null;
  const places = prize.count ?? prize.top_n;
  if (places === 0) return [];
  const shares = prizeShares(BigInt(prize.pool), places);
  if (prize.count !== null)
    return shares.map((lords, index) => {
      const award = prize.awards.find((each) => each.rank === index + 1);
      return award
        ? { place: index + 1, lords: Number(award.lords), holder: { address: award.address } }
        : { place: index + 1, lords: Number(lords), holder: "awarding" };
    });
  const holders = frontierPrizeHolders(board.entries, places);
  return shares.map((lords, index) => ({
    place: index + 1,
    lords: Number(lords),
    holder: holders[index] ? { address: holders[index].address } : "open",
  }));
};

/**
 * Who won a season, as its podium names first place: once the winners are fixed, the ledger's receipt, "awarding" until
 * it lands; before, the board's first to clear a site. A season with no pool is its board's alone. None while no one
 * holds first place, or when the ledger fixed no winner.
 */
export const seasonWinner = (
  board: Parameters<typeof seasonPodium>[0],
): { address: string } | "awarding" | undefined => {
  const podium = seasonPodium(board);
  const first = podium ? podium[0]?.holder : frontierPrizeHolders(board.entries, 1)[0];
  if (first === undefined || first === "open") return undefined;
  return first === "awarding" ? first : { address: first.address };
};
