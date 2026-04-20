import type { ExplorerTroopsTileSystemUpdate } from "@bibliothecadao/eternum";
import { Position } from "@bibliothecadao/eternum";
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

/**
 * Returns true if an authoritative Torii tile update for an entity that has
 * an unconverged optimistic resolution targets an EARLIER position than the
 * one the client is currently showing.
 *
 * Scenario this guards against:
 *
 *   t0  user moves A → B (optimistic). armies.hexCoords = B.
 *   t1  user moves B → C (optimistic). armies.hexCoords = C.
 *   t2  Torii finally delivers the tile update for the first tx (hex = B).
 *
 * Without this guard, the handler at t2 would call `updateArmyHexes(B)` and
 * `armyManager.onTileUpdate(B)` → `moveArmy(entity, B)`. Because the armies
 * Map was already advanced to C, `moveArmy`'s same-position early-return does
 * not fire, and the army animates C → B — the visible "ping-pong" users see.
 *
 * We detect the stale case by comparing the tracked army's current normalized
 * position (which equals the latest optimistic target) to the incoming
 * update's normalized position. A mismatch while the entity still holds an
 * unconverged optimistic marker means this update is behind the client.
 *
 * Relies on Torii's in-order delivery of tile updates for a single entity:
 * once the update for the latest target arrives and converges, we clear the
 * marker, so any still-later updates flow through the normal path (e.g., a
 * chain correction or a fresh on-chain move).
 */
export function isStaleOptimisticIndexerUpdate(
  army: ArmyData | undefined,
  update: { hexCoords: HexPosition },
): boolean {
  if (!army) {
    return false;
  }
  const currentNorm = army.hexCoords.getNormalized();
  const updateNorm = new Position({ x: update.hexCoords.col, y: update.hexCoords.row }).getNormalized();
  return currentNorm.x !== updateNorm.x || currentNorm.y !== updateNorm.y;
}
