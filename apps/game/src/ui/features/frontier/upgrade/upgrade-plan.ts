/**
 * An upgrade as its sheet draws it (design §3.12, mockup 1): the thing now and next as art with its tier, what it gives
 * at each, the population it takes, and the price. Built from facts by the castle's reader; the sheet owns no rule.
 */
export interface UpgradePlan {
  /** A proper name: the building's, or the castle's level ("Kingdom"). */
  name: string;
  population: number | undefined;
  now: UpgradeStep;
  /** Nothing further to upgrade to. */
  next: UpgradeStep | null;
  price: readonly { resource: number; amount: number }[];
  /** The realm holds the price. */
  affordable: boolean;
}

export interface UpgradeStep {
  art: string;
  /** I to IV: the castle's level. */
  tier: 1 | 2 | 3 | 4;
  gain: { icon: string; value: number; perHour: boolean };
}
