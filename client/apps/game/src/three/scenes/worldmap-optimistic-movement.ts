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
 * The output is the minimum set of fields the position-handoff path consumes:
 * entity id, destination hex, troop identity, and owner. We deliberately do NOT
 * propagate stamina, troop count, or battle data:
 *
 *   - Stamina is owned by two sources: `useArmyStaminaSourceStore` (pending,
 *     written at move submit with the debited amount + current tick) and the
 *     on-chain update delivered via `onExplorerTroopsUpdate`. The synthetic
 *     update's `army.onChainStamina` / `army.currentStamina` are stale cached
 *     snapshots from BEFORE the move and would desync the UI from the pending
 *     / on-chain sources if any path ever read them. Omitting them means the
 *     stamina display is driven end-to-end by pending (until on-chain catches
 *     up) with no chance of the optimistic path leaking pre-move values.
 *   - Troop count is only touched by battles, and travel never enters a battle
 *     tile — the authoritative explorer-troops update is the source of truth.
 *   - Battle data: travel can only originate from a non-battle state, so there
 *     is no battle context to propagate, and downstream `onTileUpdate`
 *     destructures `battleData` with `|| {}` so the absence is safe.
 *
 * The `onTileUpdate` handler's existing-army branch ignores these fields
 * anyway (it only calls `moveArmy` + `syncTrackedArmyOwnerState`), so omitting
 * them changes nothing for the happy path — it just closes the door on any
 * future reader picking up stale cached stamina from the optimistic update.
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
