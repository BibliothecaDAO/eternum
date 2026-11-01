import type { HeraldFrontierLeaderboardEntry } from "./herald-http-types";

/**
 * Who holds Frontier's prize places on a season board, best first: only a player who cleared at least one site is paid
 * (the owner, 30 October 2026), so the board's first `places` entries with a site cleared. The relay posts these at the
 * season's end and the ledger splits the prize over how many there are; the Season page names the same ones.
 */
export const frontierPrizeHolders = <Entry extends Pick<HeraldFrontierLeaderboardEntry, "sites_cleared">>(
  entries: readonly Entry[],
  places: number,
): Entry[] => entries.filter((entry) => entry.sites_cleared.total > 0).slice(0, places);

/**
 * What each prize place takes of the season's prize pool, first to last, as the ledger pays it
 * (frontier_prizes.cairo, prize_amount): rank r of `count` takes `count + 1 - r` shares of `count (count + 1) / 2`,
 * each place below the first rounded down, and the first takes what the others leave, so the rounding stays with it.
 */
export const prizeShares = (pool: bigint, count: number): bigint[] => {
  if (!Number.isInteger(count) || count <= 0 || count > 100) throw new Error(`invalid prize count ${count}`);
  const n = BigInt(count);
  const shares = (n * (n + 1n)) / 2n;
  const below = Array.from({ length: count - 1 }, (_, index) => (pool * (n - BigInt(index + 1))) / shares);
  return [pool - below.reduce((sum, share) => sum + share, 0n), ...below];
};
