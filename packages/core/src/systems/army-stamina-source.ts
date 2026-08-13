export type ArmyStaminaSourceKind = "pending" | "snapshot" | "live" | "cached";

// Lower value wins an updated-tick tie. "pending" is the player's own
// optimistic write, "snapshot" a fresh one-shot torii fetch, "live" the
// RECS-synced row, "cached" the up-to-a-poll-interval-stale SQL map row.
const SOURCE_PRIORITY: Record<ArmyStaminaSourceKind, number> = {
  pending: 0,
  snapshot: 1,
  live: 2,
  cached: 3,
};

export interface ArmyStaminaReading {
  source: ArmyStaminaSourceKind;
  updatedTick: number;
  capturedAtMs?: number;
}

/**
 * The single definition of "which army stamina reading is fresher".
 *
 * A higher on-chain updated tick always wins. On a tick tie the higher
 * priority source wins (pending > snapshot > live > cached); on a full tie
 * the most recently captured reading wins, preferring `left` when capture
 * times are equal too.
 */
export const pickFresherArmyStaminaReading = <T extends ArmyStaminaReading>(left: T, right: T): T => {
  if (left.updatedTick !== right.updatedTick) {
    return left.updatedTick > right.updatedTick ? left : right;
  }

  if (SOURCE_PRIORITY[left.source] !== SOURCE_PRIORITY[right.source]) {
    return SOURCE_PRIORITY[left.source] < SOURCE_PRIORITY[right.source] ? left : right;
  }

  return (left.capturedAtMs ?? 0) >= (right.capturedAtMs ?? 0) ? left : right;
};

interface ArmyStaminaSnapshot {
  onChainStamina?: {
    amount: bigint;
    updatedTick: number;
  };
}

const getArmyStaminaUpdatedTick = (snapshot: ArmyStaminaSnapshot | null | undefined): number => {
  const updatedTick = snapshot?.onChainStamina?.updatedTick;
  return Number.isFinite(updatedTick) ? Number(updatedTick) : 0;
};

/**
 * Picks between the live RECS snapshot and the map-data-store "enhanced" row
 * for the world-update path. The enhanced row shares provenance with the
 * client's "cached" source (SQL map data, up to a poll interval stale), so an
 * updated-tick tie resolves to the live reading.
 */
export const resolveFreshestArmyStaminaSource = (input: {
  liveSnapshot?: ArmyStaminaSnapshot | undefined;
  enhancedSnapshot?: ArmyStaminaSnapshot | undefined;
}): "live" | "enhanced" | undefined => {
  if (!input.liveSnapshot && !input.enhancedSnapshot) {
    return undefined;
  }

  if (!input.liveSnapshot) {
    return "enhanced";
  }

  if (!input.enhancedSnapshot) {
    return "live";
  }

  const liveReading: ArmyStaminaReading = {
    source: "live",
    updatedTick: getArmyStaminaUpdatedTick(input.liveSnapshot),
  };
  const enhancedReading: ArmyStaminaReading = {
    source: "cached",
    updatedTick: getArmyStaminaUpdatedTick(input.enhancedSnapshot),
  };

  return pickFresherArmyStaminaReading(liveReading, enhancedReading) === liveReading ? "live" : "enhanced";
};
