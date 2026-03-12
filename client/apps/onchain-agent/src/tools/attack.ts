/**
 * attack tool — attack a target adjacent to one of your armies.
 *
 * Point at your army (army_row:army_col) and the target (target_row:target_col).
 * The army must be 1 hex from the target.
 *
 * Output answers:
 * - Did I win?
 * - What's left of my army?
 * - Use inspect_tile to check the outcome.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { EternumClient, ExplorerInfo } from "@bibliothecadao/client";
import type { MapContext } from "../map/context.js";
import { type TxContext, addressesEqual, extractTxError } from "./tx-context.js";
import type { GameConfig } from "@bibliothecadao/torii";
import { isStructure, isExplorer } from "../world/occupier.js";
import { directionBetween } from "../world/pathfinding.js";
import { calculateStrength, calculateGuardStrength } from "../world/strength.js";
import { projectExplorerStamina } from "../world/stamina.js";

/**
 * Create the attack_target agent tool.
 *
 * @param client - Eternum client for fetching explorer and structure data.
 * @param mapCtx - Map context holding the current tile snapshot and stamina tracking.
 * @param playerAddress - Hex address of the player; used to verify army ownership.
 * @param tx - Transaction context with the provider and signer.
 * @param gameConfig - Game config including stamina regeneration rules.
 * @returns An AgentTool that attacks or claims an adjacent explorer or structure.
 */
export function createAttackTool(
  client: EternumClient,
  mapCtx: MapContext,
  playerAddress: string,
  tx: TxContext,
  gameConfig: GameConfig,
): AgentTool<any> {
  return {
    name: "attack_target",
    label: "Attack Target",
    description:
      "Attack OR CLAIM a target adjacent to one of your armies. " +
      "This is the ONLY way to capture hyperstructures, realms, villages, and mines — move adjacent then call this tool. " +
      "Unguarded structures are captured for free. " +
      "Use your army's row:col from YOUR ENTITIES as army_row:army_col, and the target as target_row:target_col. " +
      "Your army must be 1 hex away from the target. " +
      "Returns: outcome, troops remaining, stamina after.",
    parameters: Type.Object({
      army_row: Type.Number({ description: "Line number of your army on the map" }),
      army_col: Type.Number({ description: "Column of your army on the map" }),
      target_row: Type.Number({ description: "Target line number on the map" }),
      target_col: Type.Number({ description: "Target column on the map" }),
    }),
    async execute(_toolCallId, params, signal) {
      const { army_row, army_col, target_row, target_col } = params;

      if (signal?.aborted) throw new Error("Operation cancelled");

      // ── Validate map ──

      if (!mapCtx.snapshot) {
        throw new Error(
          "Map not loaded yet. Wait for the next tick — the map is included automatically in each tick prompt.",
        );
      }

      const armyHex = mapCtx.snapshot.resolve(army_row, army_col);
      if (!armyHex) {
        throw new Error(
          `Invalid army position ${army_row}:${army_col}. Map is ${mapCtx.snapshot.rowCount} rows x ${mapCtx.snapshot.colCount} cols.`,
        );
      }

      const targetHex = mapCtx.snapshot.resolve(target_row, target_col);
      if (!targetHex) {
        throw new Error(
          `Invalid target position ${target_row}:${target_col}. Map is ${mapCtx.snapshot.rowCount} rows x ${mapCtx.snapshot.colCount} cols.`,
        );
      }

      // ── Find explorer at army position ──

      const armyTile = mapCtx.snapshot.tileAt(army_row, army_col);
      if (!armyTile || !isExplorer(armyTile.occupierType)) {
        throw new Error(`No army at ${army_row}:${army_col}. Point at one of your armies on the map.`);
      }

      const explorer = await client.view.explorerInfo(armyTile.occupierId);
      if (!explorer) {
        throw new Error(`Explorer ${armyTile.occupierId} not found.`);
      }

      // ── Verify ownership ──

      if (playerAddress && (!explorer.ownerAddress || !addressesEqual(explorer.ownerAddress, playerAddress))) {
        throw new Error(`Army at ${army_row}:${army_col} is not yours (owner: ${explorer.ownerAddress}).`);
      }

      // ── Check adjacency ──

      const direction = directionBetween(explorer.position, targetHex);
      if (direction === null) {
        throw new Error(
          `Army at ${army_row}:${army_col} is not adjacent to ${target_row}:${target_col}. You MUST call move_army first to get within 1 hex, THEN attack.`,
        );
      }

      // ── Check stamina ──

      const baseProjected = projectExplorerStamina(explorer, gameConfig.stamina);
      const tracked = mapCtx.staminaSpent?.get(explorer.entityId);
      const alreadySpent = tracked && tracked.atTick === explorer.staminaUpdatedTick ? tracked.spent : 0;
      const projectedStamina = Math.max(0, baseProjected - alreadySpent);
      const STAMINA_ATTACK_REQ = 50;
      if (projectedStamina < STAMINA_ATTACK_REQ) {
        throw new Error(
          `Not enough stamina to attack (${projectedStamina}/${STAMINA_ATTACK_REQ}). Wait for regeneration.`,
        );
      }

      // ── Identify target ──

      const tile = mapCtx.snapshot.tileAt(target_row, target_col);
      if (!tile) {
        throw new Error(`Tile ${target_row}:${target_col} is unexplored. Nothing to attack.`);
      }

      const occupierType = tile.occupierType;

      if (occupierType === 0) {
        throw new Error(`Tile ${target_row}:${target_col} is empty. Nothing to attack.`);
      }

      if (isExplorer(occupierType)) {
        const result = await attackExplorer(client, tx, explorer, tile.occupierId, direction, tile.biome);
        try {
          await mapCtx.refresh?.();
        } catch {
          /* non-fatal */
        }
        return result;
      }

      if (isStructure(occupierType)) {
        const result = await attackStructure(client, tx, explorer, targetHex, direction, tile.biome);
        try {
          await mapCtx.refresh?.();
        } catch {
          /* non-fatal */
        }
        return result;
      }

      throw new Error(`Cannot attack occupier type ${occupierType} at ${target_row}:${target_col}.`);
    },
  };
}

// ── Attack an explorer ───────────────────────────────────────────────

async function attackExplorer(
  client: EternumClient,
  tx: TxContext,
  attacker: ExplorerInfo,
  defenderId: number,
  direction: number,
  biome: number,
) {
  const defender = await client.view.explorerInfo(defenderId);
  if (!defender) {
    throw new Error(`Target explorer ${defenderId} not found.`);
  }

  const attackerStrength = calculateStrength(attacker.troopCount, attacker.troopTier, attacker.troopType, biome);
  const defenderStrength = calculateStrength(defender.troopCount, defender.troopTier, defender.troopType, biome);

  const ratio = defenderStrength.base > 0 ? (attackerStrength.base / defenderStrength.base).toFixed(1) : "overwhelming";

  try {
    await tx.provider.attack_explorer_vs_explorer({
      aggressor_id: attacker.entityId,
      defender_id: defenderId,
      defender_direction: direction,
      steal_resources: [],
      signer: tx.signer,
    });
  } catch (err: any) {
    throw new Error(`Attack failed: ${extractTxError(err)}`);
  }

  return {
    content: [
      {
        type: "text" as const,
        text: [
          `Attacked explorer: ${attacker.troopType} ${attacker.troopTier} vs ${defender.troopType} ${defender.troopTier}`,
          `Your strength: ${attackerStrength.display}`,
          `Their strength: ${defenderStrength.display}`,
          `Ratio: ${ratio}x`,
          `Transaction submitted. Use inspect to check the outcome.`,
        ].join("\n"),
      },
    ],
    details: {
      attackerId: attacker.entityId,
      defenderId,
      direction,
      attackerStrength: attackerStrength.base,
      defenderStrength: defenderStrength.base,
    },
  };
}

// ── Attack a structure's guards ──────────────────────────────────────

async function attackStructure(
  client: EternumClient,
  tx: TxContext,
  attacker: ExplorerInfo,
  target: { x: number; y: number },
  direction: number,
  biome: number,
) {
  const structure = await client.view.structureAt(target.x, target.y);
  if (!structure) {
    throw new Error(`Structure at (${target.x},${target.y}) not found.`);
  }

  const nonEmptyGuards = structure.guards.filter((g) => g.count > 0);
  const attackerStrength = calculateStrength(attacker.troopCount, attacker.troopTier, attacker.troopType, biome);

  if (nonEmptyGuards.length === 0) {
    try {
      await tx.provider.attack_explorer_vs_guard({
        explorer_id: attacker.entityId,
        structure_id: structure.entityId,
        structure_direction: direction,
        signer: tx.signer,
      });
    } catch (err: any) {
      const msg = err?.baseError?.data?.execution_error ?? err?.message ?? String(err);
      throw new Error(`Attack failed: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
    }

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `${structure.category} is unguarded — attacking to capture.`,
            `Your strength: ${attackerStrength.display}`,
            `Transaction submitted. Use inspect to check the outcome.`,
          ].join("\n"),
        },
      ],
      details: {
        attackerId: attacker.entityId,
        structureId: structure.entityId,
        direction,
        unguarded: true,
      },
    };
  }

  const guardStrength = calculateGuardStrength(nonEmptyGuards, biome);

  const ratio = guardStrength.base > 0 ? (attackerStrength.base / guardStrength.base).toFixed(1) : "overwhelming";

  await tx.provider.attack_explorer_vs_guard({
    explorer_id: attacker.entityId,
    structure_id: structure.entityId,
    structure_direction: direction,
    signer: tx.signer,
  });

  return {
    content: [
      {
        type: "text" as const,
        text: [
          `Attacked ${structure.category} guards: ${attacker.troopType} ${attacker.troopTier} vs guards`,
          `Your strength: ${attackerStrength.display}`,
          `Guard strength: ${guardStrength.display}`,
          `Ratio: ${ratio}x`,
          `Transaction submitted. Use inspect to check the outcome.`,
        ].join("\n"),
      },
    ],
    details: {
      attackerId: attacker.entityId,
      structureId: structure.entityId,
      direction,
      attackerStrength: attackerStrength.base,
      guardStrength: guardStrength.base,
    },
  };
}
