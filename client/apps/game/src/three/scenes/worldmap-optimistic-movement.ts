import type { ExplorerTroopsTileSystemUpdate } from "@bibliothecadao/eternum";
import type { HexPosition } from "@bibliothecadao/types";

import type { ArmyData } from "../types/common";

/**
 * Build a synthetic `ExplorerTroopsTileSystemUpdate` that drives the existing
 * `updateArmyHexes` + `ArmyManager.onTileUpdate` pipeline when the chain tx for a
 * local move confirms. Returns null when the tracked army is not available —
 * in that case the caller should wait for the authoritative indexer update.
 *
 * The output is intentionally minimal: it only needs the fields the cache sync
 * and army-manager transition path consume. Troop count / stamina / battle data
 * continue to converge through the real indexer stream. `battleData` is
 * deliberately omitted — travel can only originate from a non-battle state, so
 * there is no battle context to propagate optimistically, and downstream
 * `ArmyManager.onTileUpdate` destructures it with `|| {}` so the absence is
 * safe.
 */
export function buildOptimisticArmyTileUpdate(
  army: ArmyData | undefined,
  targetHex: HexPosition,
): ExplorerTroopsTileSystemUpdate | null {
  if (!army) {
    return null;
  }

  return {
    entityId: army.entityId,
    hexCoords: { col: targetHex.col, row: targetHex.row },
    troopType: army.category,
    troopTier: army.tier,
    isDaydreamsAgent: army.isDaydreamsAgent,
    ownerName: army.owner.ownerName,
    guildName: army.owner.guildName,
    ownerAddress: army.owner.address,
    ownerStructureId: army.owningStructureId,
    troopCount: army.troopCount,
    currentStamina: army.currentStamina,
    maxStamina: army.maxStamina,
    onChainStamina: army.onChainStamina,
  };
}
