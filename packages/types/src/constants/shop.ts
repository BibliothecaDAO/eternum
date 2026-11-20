export const FRAGMENT_CENTS = 1;
export const MIN_FRAGMENTS = 100;
export const FRAGMENTS_A_DAY = 10_000;
export const FRIEND_GLORY = 100;
export const FRIEND_FRAGMENTS = 100;
export const FRIENDS_LIMIT = 10;
export const FRIENDS_BONUS_FRAGMENTS = 1_000;

/** Every LORDS amount the shop shows or charges is a multiple of this, so a price ends in 5 or 0. */
const LORDS_STEP = 5;

/**
 * Whole LORDS for an amount in wei, rounded up to the next multiple of 5 so the shop never undercharges and a price ends
 * in 5 or 0. The amount is a market quote already, so only the rounding lives here. A result a number cannot hold exactly
 * is refused, never rounded again by the conversion.
 */
export const roundUpLords = (wei: bigint): number => {
  if (wei <= 0n) throw new Error(`LORDS amount ${wei} is not positive`);
  const step = BigInt(LORDS_STEP) * 10n ** 18n;
  const lords = ((wei + step - 1n) / step) * BigInt(LORDS_STEP);
  if (lords > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`LORDS amount ${lords} is more than a number holds`);
  return Number(lords);
};

export const STORE_PRODUCTS = {
  "fragments-100": { fragments: 100, cents: 99 },
  "fragments-500": { fragments: 500, cents: 499 },
  "fragments-1000": { fragments: 1_000, cents: 999 },
} as const satisfies Record<string, { fragments: number; cents: number }>;
