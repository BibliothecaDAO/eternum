/**
 * attack tool — attack a target adjacent to one of your armies.
 *
 * Takes an army entity ID and a target world hex coordinate.
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
      "Your army must be 1 hex away from the target. " +
      "Returns: outcome, troops remaining, stamina after.",
    parameters: Type.Object({
      army_id: Type.Number({ description: "Entity ID of your army (from briefing or map_query)" }),
      target_x: Type.Number({ description: "Target world hex X coordinate" }),
      target_y: Type.Number({ description: "Target world hex Y coordinate" }),
    }),
    async execute(_toolCallId, params, signal) {
      const { army_id: armyId, target_x, target_y } = params;
      const targetHex = { x: target_x, y: target_y };

      if (signal?.aborted) throw new Error("Operation cancelled");

      // ── Validate map ──

      if (!mapCtx.snapshot) {
        throw new Error("Map not loaded yet. Wait for the next tick.");
      }

      // ── Find explorer by entity ID ──

      const explorer = await client.view.explorerInfo(armyId);
      if (!explorer) {
        throw new Error(`Army ${armyId} not found.`);
      }

      // ── Verify ownership ──

      if (playerAddress && (!explorer.ownerAddress || !addressesEqual(explorer.ownerAddress, playerAddress))) {
        throw new Error(`Army ${armyId} is not yours (owner: ${explorer.ownerAddress}).`);
      }

      // ── Check adjacency ──

      const direction = directionBetween(explorer.position, targetHex);
      if (direction === null) {
        throw new Error(
          `Army ${armyId} at (${explorer.position.x},${explorer.position.y}) is not adjacent to (${target_x},${target_y}). Use move_army first to get within 1 hex, then attack.`,
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

      const tile = mapCtx.snapshot.gridIndex.get(`${target_x},${target_y}`) ?? null;
      if (!tile) {
        throw new Error(`Tile (${target_x},${target_y}) is unexplored. Nothing to attack.`);
      }

      const occupierType = tile.occupierType;

      if (occupierType === 0) {
        throw new Error(`Tile (${target_x},${target_y}) is empty. Nothing to attack.`);
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

      throw new Error(`Cannot attack occupier type ${occupierType} at (${target_x},${target_y}).`);
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

  // Re-inspect to determine outcome
  const afterAttacker = await client.view.explorerInfo(attacker.entityId);
  const afterDefender = await client.view.explorerInfo(defenderId);
  const attackerSurvived = afterAttacker && afterAttacker.troopCount > 0;
  const defenderSurvived = afterDefender && afterDefender.troopCount > 0;

  let outcome: string;
  if (attackerSurvived && !defenderSurvived) {
    outcome = `VICTORY — enemy destroyed. You have ${afterAttacker!.troopCount.toLocaleString()} troops remaining.`;
  } else if (!attackerSurvived && defenderSurvived) {
    outcome = `DEFEAT — your army was destroyed. Enemy has ${afterDefender!.troopCount.toLocaleString()} troops remaining.`;
  } else if (attackerSurvived && defenderSurvived) {
    outcome = `DRAW — both survived. You: ${afterAttacker!.troopCount.toLocaleString()}, Enemy: ${afterDefender!.troopCount.toLocaleString()}.`;
  } else {
    outcome = `Both armies destroyed.`;
  }

  return {
    content: [
      {
        type: "text" as const,
        text: [
          `Attacked: ${attacker.troopType} ${attacker.troopTier} vs ${defender.troopType} ${defender.troopTier}`,
          `Pre-battle: ${attackerStrength.display} vs ${defenderStrength.display} (${ratio}x)`,
          outcome,
        ].join("\n"),
      },
    ],
    details: {
      attackerId: attacker.entityId,
      defenderId,
      direction,
      attackerStrength: attackerStrength.base,
      defenderStrength: defenderStrength.base,
      outcome,
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
          text: `${structure.category} captured — it was unguarded.`,
        },
      ],
      details: {
        attackerId: attacker.entityId,
        structureId: structure.entityId,
        direction,
        unguarded: true,
        outcome: "captured",
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

  // Re-inspect to determine outcome
  const afterAttacker = await client.view.explorerInfo(attacker.entityId);
  const afterStructure = await client.view.structureAt(target.x, target.y);
  const attackerSurvived = afterAttacker && afterAttacker.troopCount > 0;
  const guardsRemain = afterStructure?.guards.some((g) => g.count > 0) ?? false;

  let outcome: string;
  if (attackerSurvived && !guardsRemain) {
    outcome = `VICTORY — guards eliminated. You have ${afterAttacker!.troopCount.toLocaleString()} troops remaining. Attack again to capture.`;
  } else if (!attackerSurvived) {
    outcome = `DEFEAT — your army was destroyed.`;
  } else {
    const remainingGuards = afterStructure?.guards.filter((g) => g.count > 0).map((g) => `${g.count.toLocaleString()} ${g.troopType} ${g.troopTier}`).join(", ") ?? "unknown";
    outcome = `Guards weakened but still standing: ${remainingGuards}. You have ${afterAttacker!.troopCount.toLocaleString()} troops. Attack again or reinforce.`;
  }

  return {
    content: [
      {
        type: "text" as const,
        text: [
          `Attacked ${structure.category} guards: ${attacker.troopType} ${attacker.troopTier} vs guards`,
          `Pre-battle: ${attackerStrength.display} vs ${guardStrength.display} (${ratio}x)`,
          outcome,
        ].join("\n"),
      },
    ],
    details: {
      attackerId: attacker.entityId,
      structureId: structure.entityId,
      direction,
      attackerStrength: attackerStrength.base,
      guardStrength: guardStrength.base,
      outcome,
    },
  };
}
