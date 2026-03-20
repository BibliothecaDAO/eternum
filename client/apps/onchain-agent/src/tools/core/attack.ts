/**
 * Core logic for attacking a target (explorer or structure guard).
 *
 * Validates ownership, adjacency, and target presence, runs the combat
 * simulation (deterministic — matches on-chain math), then executes
 * the appropriate provider call. Returns a typed result with the
 * battle outcome.
 */

import type { ToolContext } from "./context.js";
import { toContractX, toContractY } from "./context.js";
import { simulateCombat, type CombatResult } from "../../world/combat.js";
import { projectExplorerStamina } from "../../world/stamina.js";
import { isExplorer, isStructure } from "../../world/occupier.js";
import { directionBetween } from "../../world/pathfinding_v2.js";
import { addressesEqual, extractTxError } from "./tx-context.js";

// ── Input / Result types ────────────────────────────────────────────

/** Input for executing an attack (display coordinates). */
export interface AttackTargetInput {
  /** Entity ID of the attacking army. */
  armyId: number;
  /** Target display X coordinate. */
  targetX: number;
  /** Target display Y coordinate. */
  targetY: number;
}

/** Result of an attack execution. */
export interface AttackTargetResult {
  /** Whether the attack was successfully executed (tx sent). */
  success: boolean;
  /** Human-readable summary of the outcome. */
  message: string;
  /** Detailed combat result from simulation, or null for unguarded captures. */
  combat: CombatResult | null;
}

// ── Core function ───────────────────────────────────────────────────

/**
 * Attack a target adjacent to the given army.
 *
 * Handles both explorer-vs-explorer and explorer-vs-guard paths.
 * Runs a pre-attack combat simulation to report predicted casualties,
 * then executes the on-chain transaction.
 *
 * @param input - Army ID and target display coordinates.
 * @param ctx   - Shared tool context (client, provider, signer, config, snapshot).
 * @returns Typed result with success flag, message, and combat details.
 */
export async function attackTarget(input: AttackTargetInput, ctx: ToolContext): Promise<AttackTargetResult> {
  const { armyId, targetX: dispX, targetY: dispY } = input;
  const targetRawX = toContractX(dispX, ctx.mapCenter);
  const targetRawY = toContractY(dispY, ctx.mapCenter);

  // ── Validate attacker ──

  const explorer = await ctx.client.view.explorerInfo(armyId);
  if (!explorer) {
    return { success: false, message: `Army ${armyId} not found.`, combat: null };
  }
  if (!addressesEqual(explorer.ownerAddress ?? "", ctx.playerAddress)) {
    return { success: false, message: `Army ${armyId} is not yours.`, combat: null };
  }

  // ── Validate adjacency ──

  const targetHex = { x: targetRawX, y: targetRawY };
  const direction = directionBetween(explorer.position, targetHex);
  if (direction === null) {
    return { success: false, message: `Army not adjacent to (${dispX},${dispY}). Move first.`, combat: null };
  }

  // ── Validate target ──

  const tile = ctx.snapshot.gridIndex.get(`${targetRawX},${targetRawY}`);
  if (!tile || tile.occupierType === 0) {
    return { success: false, message: `Nothing to attack at (${dispX},${dispY}).`, combat: null };
  }

  // ── Build attacker input for simulation ──

  const projectedStamina = projectExplorerStamina(explorer, ctx.gameConfig.stamina);
  const attackerInput = {
    troopCount: explorer.troopCount,
    troopType: explorer.troopType,
    troopTier: explorer.troopTier,
    stamina: projectedStamina,
  };

  // ── Build defender input — explorer or structure guard ──

  let defenderInput: { troopCount: number; troopType: string; troopTier: string; stamina: number } | null = null;
  let isStructureTarget = false;

  if (isExplorer(tile.occupierType)) {
    const defExplorer = await ctx.client.view.explorerInfo(tile.occupierId);
    if (defExplorer) {
      const defStamina = projectExplorerStamina(defExplorer, ctx.gameConfig.stamina);
      defenderInput = {
        troopCount: defExplorer.troopCount,
        troopType: defExplorer.troopType,
        troopTier: defExplorer.troopTier,
        stamina: defStamina,
      };
    }
  } else if (isStructure(tile.occupierType)) {
    isStructureTarget = true;
    const structure = await ctx.client.view.structureAt(targetRawX, targetRawY);
    if (structure) {
      const guard = structure.guards?.find((g: any) => g.count > 0);
      if (guard) {
        defenderInput = {
          troopCount: guard.count,
          troopType: guard.troopType,
          troopTier: guard.troopTier,
          stamina: 100,
        };
      }
    }
  }

  // ── Simulate the battle ──

  let simResult: ReturnType<typeof simulateCombat> | null = null;
  if (defenderInput && defenderInput.troopCount > 0) {
    simResult = simulateCombat(attackerInput, defenderInput, tile.biome);
  }

  // ── Execute the attack ──

  try {
    if (isExplorer(tile.occupierType)) {
      await ctx.provider.attack_explorer_vs_explorer({
        aggressor_id: armyId,
        defender_id: tile.occupierId,
        defender_direction: direction,
        steal_resources: [],
        signer: ctx.signer,
      });
    } else if (isStructureTarget) {
      const structure = await ctx.client.view.structureAt(targetRawX, targetRawY);
      if (!structure) {
        return { success: false, message: "Structure not found.", combat: null };
      }
      await ctx.provider.attack_explorer_vs_guard({
        explorer_id: armyId,
        structure_id: structure.entityId,
        structure_direction: direction,
        signer: ctx.signer,
      });
    }
  } catch (err: any) {
    return { success: false, message: `Attack failed: ${extractTxError(err)}`, combat: null };
  }

  // ── Report outcome ──

  if (!simResult) {
    // Unguarded — free capture
    const targetLabel = isStructureTarget ? "structure" : "target";
    return {
      success: true,
      message: `Captured unguarded ${targetLabel} at (${dispX},${dispY}). ${explorer.troopCount.toLocaleString()} troops intact.`,
      combat: null,
    };
  }

  const lines = [
    `Battle at (${dispX},${dispY}) — ${simResult.winner === "attacker" ? "VICTORY" : simResult.winner === "defender" ? "DEFEAT" : "DRAW"}`,
    `  Your ${explorer.troopCount.toLocaleString()} ${explorer.troopType} ${explorer.troopTier} vs ${defenderInput!.troopCount.toLocaleString()} ${defenderInput!.troopType} ${defenderInput!.troopTier}`,
    `  Biome: ${simResult.biomeAdvantage}`,
    `  Your casualties: ${simResult.attackerCasualties.toLocaleString()} | Surviving: ${simResult.attackerSurviving.toLocaleString()}`,
    `  Enemy casualties: ${simResult.defenderCasualties.toLocaleString()} | Surviving: ${simResult.defenderSurviving.toLocaleString()}`,
  ];
  if (simResult.winner === "attacker" && isStructureTarget && simResult.defenderSurviving <= 0) {
    lines.push(`  Structure captured!`);
  }
  if (simResult.winner === "defender") {
    lines.push(`  Your army was destroyed.`);
  }

  return { success: true, message: lines.join("\n"), combat: simResult };
}
