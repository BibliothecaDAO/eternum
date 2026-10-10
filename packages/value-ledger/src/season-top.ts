/** Seasonal rating descending, then wallet ascending, exactly like the ledger's outranks rule. */
export function computeSeasonTop(ratings: readonly { wallet: string; mmr: string }[], paidFraction: number): string[] {
  if (!Number.isInteger(paidFraction) || paidFraction <= 0 || paidFraction > 10000)
    throw new Error("invalid_season_paid_fraction");
  const players = ratings.map(({ wallet, mmr }) => ({ wallet, address: BigInt(wallet), rating: BigInt(mmr) }));
  if (players.some(({ address, rating }) => address <= 0n || rating < 0n || rating >= 2n ** 128n))
    throw new Error("invalid_season_participant");
  if (new Set(players.map(({ address }) => address.toString())).size !== players.length)
    throw new Error("duplicate_season_participant");
  players.sort((a, b) => (a.rating !== b.rating ? (a.rating > b.rating ? -1 : 1) : a.address < b.address ? -1 : 1));
  const count = Number((BigInt(players.length) * BigInt(paidFraction) + 9999n) / 10000n);
  return players.slice(0, count).map(({ wallet }) => wallet);
}
