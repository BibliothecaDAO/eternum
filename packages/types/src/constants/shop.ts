/**
 * What the shop sells and what it costs, in dollars (the stores' unit): one source for the shop's screens, the day's
 * price and the store relay. A Fragment is 1 cent and refills 2 points of stamina outside the Deep; on the web an amount
 * of dollars is paid in LORDS at the day's market price (`lordsFor`).
 */
export const FRAGMENT = { cents: 1, staminaPoints: 2 } as const;

/** What a Fragment buys besides stamina, in Fragments: a quest reroll once a day; a name, a banner line or a badge. */
export const FRAGMENT_PRICES = { questReroll: 50, look: 200 } as const;

/**
 * Who the Ancient Seal's buyer is: a holder of nothing, of a Realm or a Devcon (regular) ticket home, or of a Wonder or a
 * golden ticket home. The last two have the labor bonus free; the Wonder or golden holder has the Fragments free too.
 */
export const SEAL_HOLDERS = ["none", "realm", "wonder"] as const;
type SealHolder = (typeof SEAL_HOLDERS)[number];

/** What the Ancient Seal's holder already has free, so is not paid for: the daily quest's labor bonus, its Fragments. */
export const SEAL_FREE = {
  none: { labor: false, fragments: false },
  realm: { labor: true, fragments: false },
  wonder: { labor: true, fragments: true },
} as const satisfies Record<SealHolder, { labor: boolean; fragments: boolean }>;

/** The seal's price in cents by where it is bought and who buys: $10 on the web (paid in LORDS) or $9.99 in a store; $4.99 for a holder. */
export const SEAL_CENTS = {
  web: { none: 1_000, realm: 499, wonder: 499 },
  store: { none: 999, realm: 499, wonder: 499 },
} as const satisfies Record<"web" | "store", Record<SealHolder, number>>;

/**
 * Whole LORDS that `cents` is worth at `usdPerLords`, rounded up so the shop never undercharges. A price that is not a
 * positive number is a fault: nothing quotes from a missing or broken price.
 */
export const lordsFor = (cents: number, usdPerLords: number): number => {
  if (!Number.isFinite(usdPerLords) || usdPerLords <= 0) throw new Error(`LORDS price ${usdPerLords} is not positive`);
  return Math.ceil(cents / 100 / usdPerLords);
};
