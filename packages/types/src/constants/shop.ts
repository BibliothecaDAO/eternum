/**
 * What the shop sells and what it costs, in dollars (the stores' unit): one source for the shop's screens, the day's
 * price and the store relay. A Fragment is 1 cent and refills 2 points of stamina outside the Deep; on the web an amount
 * of dollars is paid in LORDS, rounded up to 5 (`lordsFor`), at the shop's one price: the market price read at the start
 * of the price day.
 */
export const FRAGMENT = { cents: 1, staminaPoints: 2 } as const;

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

/** Every LORDS amount the shop shows or charges is a multiple of this, so a price ends in 5 or 0. */
const LORDS_STEP = 5;

/**
 * LORDS that `cents` is worth at `usdPerLords`, rounded up to the next multiple of 5 so the shop never undercharges and
 * a price ends in 5 or 0. A price that is not a positive number is a fault: nothing quotes from a missing or broken
 * price.
 */
export const lordsFor = (cents: number, usdPerLords: number): number => {
  if (!Number.isFinite(usdPerLords) || usdPerLords <= 0) throw new Error(`LORDS price ${usdPerLords} is not positive`);
  return Math.ceil(cents / 100 / usdPerLords / LORDS_STEP) * LORDS_STEP;
};

/**
 * What the stores sell, by the product id the stores carry: a Fragment bundle (the Fragments and the cents the store
 * charges) or the Ancient Seal (at the store price of a buyer who holds nothing, or of a holder). The seal's prices are
 * the seal table's, so no price is written twice.
 */
export const STORE_PRODUCTS = {
  "fragments-100": { kind: "fragments", fragments: 100, cents: 99 },
  "fragments-500": { kind: "fragments", fragments: 500, cents: 499 },
  "fragments-1000": { kind: "fragments", fragments: 1_000, cents: 999 },
  seal: { kind: "seal", cents: SEAL_CENTS.store.none },
  "seal-holder": { kind: "seal", cents: SEAL_CENTS.store.realm },
} as const satisfies Record<
  string,
  { kind: "fragments"; fragments: number; cents: number } | { kind: "seal"; cents: number }
>;
