export type ArmyStaminaSourceKind = "pending" | "live";

// The optimistic write wins an updated-tick tie until live RECS confirms the
// same amount. Stamina spends within one armies tick reuse updated_tick, so
// this ordering is required for chained movement feedback.
const SOURCE_PRIORITY: Record<ArmyStaminaSourceKind, number> = {
  pending: 0,
  live: 1,
};

export interface ArmyStaminaReading {
  source: ArmyStaminaSourceKind;
  updatedTick: number;
}

/**
 * The single definition of "which army stamina reading is fresher".
 *
 * A higher on-chain updated tick always wins. On a tick tie the higher
 * priority source wins (pending > live). A full tie preserves `left`.
 */
export const pickFresherArmyStaminaReading = <T extends ArmyStaminaReading>(left: T, right: T): T => {
  if (left.updatedTick !== right.updatedTick) {
    return left.updatedTick > right.updatedTick ? left : right;
  }

  if (SOURCE_PRIORITY[left.source] !== SOURCE_PRIORITY[right.source]) {
    return SOURCE_PRIORITY[left.source] < SOURCE_PRIORITY[right.source] ? left : right;
  }

  return left;
};
