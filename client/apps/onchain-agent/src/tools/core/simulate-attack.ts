/**
 * Core logic for simulating a battle outcome.
 *
 * Pure function: looks up attacker/defender stats from the game state,
 * runs the combat math, returns the predicted result. No transactions.
 */

import type { ToolContext } from "./context.js";
import { toContractX, toContractY } from "./context.js";
import { simulateCombat, type CombatResult } from "../../world/combat.js";
import { projectExplorerStamina } from "../../world/stamina.js";
import { isExplorer, isStructure } from "../../world/occupier.js";

/** Input for a battle simulation (display coordinates). */
export interface SimulateAttackInput {
  armyId: number;
  targetX: number;
  targetY: number;
}

/** Result of a battle simulation. */
export interface SimulateAttackResult {
  success: boolean;
  /** Human-readable summary of the simulation. */
  message: string;
  /** Raw combat result, or null if target is unguarded/empty. */
  combat: CombatResult | null;
  /** Defender description for display. */
  defenderLabel: string | null;
}

/**
 * Simulate an attack without executing it.
 *
 * Looks up the attacker army and defender (explorer or structure guard),
 * runs the combat math, and returns the predicted outcome.
 */
export async function simulateAttack(input: SimulateAttackInput, ctx: ToolContext): Promise<SimulateAttackResult> {
  const targetRawX = toContractX(input.targetX, ctx.mapCenter);
  const targetRawY = toContractY(input.targetY, ctx.mapCenter);

  const explorer = await ctx.client.view.explorerInfo(input.armyId);
  if (!explorer) {
    return { success: false, message: `Army ${input.armyId} not found.`, combat: null, defenderLabel: null };
  }

  const projectedStamina = projectExplorerStamina(explorer, ctx.gameConfig.stamina);
  const tile = ctx.snapshot.gridIndex.get(`${targetRawX},${targetRawY}`);
  if (!tile || tile.occupierType === 0) {
    return {
      success: false,
      message: `Nothing to attack at (${input.targetX},${input.targetY}).`,
      combat: null,
      defenderLabel: null,
    };
  }

  const attackerInput = {
    troopCount: explorer.troopCount,
    troopType: explorer.troopType,
    troopTier: explorer.troopTier,
    stamina: projectedStamina,
  };

  let defenderInput: { troopCount: number; troopType: string; troopTier: string; stamina: number } | null = null;
  let defenderLabel: string | null = null;

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
      defenderLabel = `${defExplorer.troopCount.toLocaleString()} ${defExplorer.troopType} ${defExplorer.troopTier}`;
    }
  } else if (isStructure(tile.occupierType)) {
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
        defenderLabel = `${guard.count.toLocaleString()} ${guard.troopType} ${guard.troopTier}`;
      } else {
        return {
          success: true,
          message: `${structure.category} at (${input.targetX},${input.targetY}) is unguarded — free capture.`,
          combat: null,
          defenderLabel: null,
        };
      }
    }
  }

  if (!defenderInput || defenderInput.troopCount <= 0) {
    return {
      success: false,
      message: `No troops to fight at (${input.targetX},${input.targetY}).`,
      combat: null,
      defenderLabel: null,
    };
  }

  const combat = simulateCombat(attackerInput, defenderInput, tile.biome);

  const lines = [
    `SIMULATION — ${combat.winner === "attacker" ? "YOU WIN" : combat.winner === "defender" ? "YOU LOSE" : "DRAW"}`,
    `  Your ${explorer.troopCount.toLocaleString()} ${explorer.troopType} ${explorer.troopTier} vs ${defenderLabel}`,
    `  Biome: ${combat.biomeAdvantage}`,
    `  Your casualties: ${combat.attackerCasualties.toLocaleString()} | Surviving: ${combat.attackerSurviving.toLocaleString()}`,
    `  Enemy casualties: ${combat.defenderCasualties.toLocaleString()} | Surviving: ${combat.defenderSurviving.toLocaleString()}`,
  ];

  return { success: true, message: lines.join("\n"), combat, defenderLabel };
}
