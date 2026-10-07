/**
 * Homecoming, as contracts/l3/world-native/src/logic/troops.cairo returns it: an army the day has ended sends its
 * Homecoming tier's share of its surviving troops back to the realm's stock, in whole troops and as much as fits. The
 * contract credits them at the realm's next deploy; until then the troop store a player sees must count them.
 */

/** The share of surviving troops each Homecoming tier returns, in basis points (rules.cairo); common returns none. */
const HOMECOMING_BPS: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 300, 3: 900, 4: 1_800, 5: 3_000 };

/** Whole troops one army sends home: its whole surviving troops times its tier's share, rounded down. */
export const homecomingReturn = (survivingTroops: number, tier: 1 | 2 | 3 | 4 | 5): number =>
  Math.floor((Math.floor(survivingTroops) * HOMECOMING_BPS[tier]) / 10_000);

/**
 * What the troop store holds once the day's ended armies have come home: the stock, plus every return that fits under
 * the store's limit. An unknown limit takes every return, as an unlimited store would.
 */
export const troopsAfterHomecoming = (
  stock: number,
  ended: readonly { survivingTroops: number; tier: 1 | 2 | 3 | 4 | 5 }[],
  limit: number | undefined,
): number => {
  const returned = ended.reduce((total, army) => total + homecomingReturn(army.survivingTroops, army.tier), 0);
  return limit === undefined ? stock + returned : Math.max(stock, Math.min(limit, stock + returned));
};
