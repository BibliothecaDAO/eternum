/**
 * Decision for how `WorldmapScene.updateArmyHexes` should treat an army's owner
 * before touching the spatial/clickability cache (`armiesPositions`,
 * `armyHexes`, the worker hex map). Pure so it can be unit-tested in isolation —
 * the scene itself cannot be instantiated headless.
 */
export type ArmyOwnerCacheAction = { kind: "write"; owner: bigint } | { kind: "evict" } | { kind: "skip" };

export interface ArmyOwnerCacheResolutionInput {
  /** Owner address carried by the incoming update. */
  ownerAddress: bigint;
  /** Whether this army already has a cached spatial position. */
  isAlreadyCached: boolean;
  /**
   * Non-zero owner recovered from the existing spatial cache, if any. Only
   * meaningful for an already-cached army whose incoming owner is 0n.
   */
  cachedOwner?: bigint;
  /**
   * Owner resolved from the ECS Structure component, if the lookup ran and
   * succeeded. Only meaningful for a brand-new army whose incoming owner is 0n.
   */
  ecsResolvedOwner?: bigint;
}

/**
 * A non-zero incoming owner is always authoritative. A 0n owner means
 * "defeated/deleted OR not-yet-synced":
 *  - already-cached army: preserve its last known non-zero owner, else evict it.
 *  - brand-new army: use the ECS fallback if it produced a non-zero owner, else
 *    SKIP the write entirely. Persisting owner:0n would mis-flag the army as
 *    unowned/defeated for clicks and ownership coloring; skipping lets the next
 *    authoritative update (which carries a real owner) register it.
 */
export function resolveArmyOwnerCacheAction(input: ArmyOwnerCacheResolutionInput): ArmyOwnerCacheAction {
  const { ownerAddress, isAlreadyCached, cachedOwner, ecsResolvedOwner } = input;

  if (ownerAddress !== 0n) {
    return { kind: "write", owner: ownerAddress };
  }

  if (isAlreadyCached) {
    if (cachedOwner !== undefined && cachedOwner !== 0n) {
      return { kind: "write", owner: cachedOwner };
    }
    return { kind: "evict" };
  }

  if (ecsResolvedOwner !== undefined && ecsResolvedOwner !== 0n) {
    return { kind: "write", owner: ecsResolvedOwner };
  }

  return { kind: "skip" };
}
