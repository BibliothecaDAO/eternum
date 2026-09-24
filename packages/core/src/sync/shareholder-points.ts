/** A hyperstructure's share allocation as its HyperstructureShares fact carries it. */
export interface ShareAllocation {
  start_at: bigint | number | string;
  multiplier: bigint | number | string;
  shareholders: readonly { player: bigint | number | string; bps: bigint | number | string }[];
}

/** Outside development mode, share points stop accruing at the game's end. */
export const sharePointCutoff = (
  game: { dev_mode_on: boolean; end_at: bigint | number | string },
  now: bigint,
): bigint => (!game.dev_mode_on && now > BigInt(game.end_at) ? BigInt(game.end_at) : now);

/**
 * A hyperstructure's points per second, shared among its shareholders, at contract precision (points × 1e6): the
 * game's grant rate times the multiplier the allocation holds.
 */
export const hyperstructurePointsPerSecond = (
  pointsPerSecond: bigint | number | string,
  multiplier: bigint | number | string,
): bigint => BigInt(pointsPerSecond) * BigInt(multiplier);

/**
 * Points each shareholder has earned since the allocation's last checkpoint, at contract precision (points × 1e6).
 * This is the contract's hyperstructure checkpoint: every share rounds on its own, so the leaderboard, Herald and
 * the chain agree to the unit.
 */
export function unclaimedSharePoints(
  allocation: ShareAllocation,
  pointsPerSecond: bigint | number | string,
  cutoff: bigint,
): { player: bigint; points: bigint }[] {
  const elapsed = cutoff - BigInt(allocation.start_at);
  if (elapsed <= 0n) return [];
  const rate = hyperstructurePointsPerSecond(pointsPerSecond, allocation.multiplier);
  return allocation.shareholders.map((share) => ({
    player: BigInt(share.player),
    points: (elapsed * rate * BigInt(share.bps)) / 10_000n,
  }));
}
