/** The kit's one way to write an amount. Unknown is a dash, never zero. */

const exact = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/**
 * A known amount, exact while a player still counts it against a price ("1,250 labor") and compact past ten
 * thousand; an unknown one is "—", never zero.
 */
export const formatAmount = (value: number | undefined): string => {
  if (value === undefined) return "—";
  return Math.abs(value) < 10_000 ? exact.format(value) : compact.format(value);
};

/** A price, and what is held against it, always exact ("10,000 wheat"): the player counts it to the unit. */
export const formatExact = (value: number | undefined): string => (value === undefined ? "—" : exact.format(value));
