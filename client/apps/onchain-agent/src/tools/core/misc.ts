/**
 * Miscellaneous core tools: open_chest, attack_from_guard, raid_target,
 * reinforce_army, apply_relic.
 */

import type { ToolContext } from "./context.js";
import { toContractX, toContractY } from "./context.js";
import { simulateCombat, type CombatResult } from "../../world/combat.js";
import { projectExplorerStamina } from "../../world/stamina.js";
import { directionBetween } from "../../world/pathfinding_v2.js";
import { isStructure } from "../../world/occupier.js";
import { extractTxError, addressesEqual } from "./tx-context.js";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

// ── Open Chest ──

export interface OpenChestInput {
  armyId: number;
  chestX: number;
  chestY: number;
}

export interface OpenChestResult {
  success: boolean;
  message: string;
}

export async function openChest(input: OpenChestInput, ctx: ToolContext): Promise<OpenChestResult> {
  const chestRawX = toContractX(input.chestX, ctx.mapCenter);
  const chestRawY = toContractY(input.chestY, ctx.mapCenter);

  const explorer = await ctx.client.view.explorerInfo(input.armyId);
  if (!explorer) return { success: false, message: `Army ${input.armyId} not found.` };

  const direction = directionBetween(explorer.position, { x: chestRawX, y: chestRawY });
  if (direction === null) return { success: false, message: "Army not adjacent to chest." };

  try {
    await ctx.provider.open_chest({
      explorer_id: input.armyId,
      chest_coord: { alt: false, x: chestRawX, y: chestRawY },
      signer: ctx.signer,
    });
  } catch (err: any) {
    return { success: false, message: `Open chest failed: ${extractTxError(err)}` };
  }

  return { success: true, message: `Opened chest at (${input.chestX},${input.chestY}). Relics granted!` };
}

// ── Attack From Guard ──

export interface AttackFromGuardInput {
  structureId: number;
  slot: number;
  targetArmyId: number;
}

export interface AttackFromGuardResult {
  success: boolean;
  message: string;
  combat: CombatResult | null;
}

export async function attackFromGuard(input: AttackFromGuardInput, ctx: ToolContext): Promise<AttackFromGuardResult> {
  let structPos: { x: number; y: number } | null = null;
  for (const t of ctx.snapshot.tiles) {
    if (t.occupierId === input.structureId) { structPos = t.position; break; }
  }
  if (!structPos) return { success: false, message: `Structure ${input.structureId} not found.`, combat: null };

  const targetExplorer = await ctx.client.view.explorerInfo(input.targetArmyId);
  if (!targetExplorer) return { success: false, message: `Enemy army ${input.targetArmyId} not found.`, combat: null };

  const direction = directionBetween(structPos, targetExplorer.position);
  if (direction === null) return { success: false, message: "Enemy army is not adjacent to structure.", combat: null };

  // Simulate
  const structInfo = await ctx.client.view.structureAt(structPos.x, structPos.y);
  const slotNames = ["Alpha", "Bravo", "Charlie", "Delta"];
  const guard = structInfo?.guards?.find((g: any) => g.slot === slotNames[input.slot]);
  const tile = ctx.snapshot.gridIndex.get(`${structPos.x},${structPos.y}`);
  const biome = tile?.biome ?? 0;

  let combat: CombatResult | null = null;
  if (guard && guard.count > 0) {
    const defStamina = projectExplorerStamina(targetExplorer, ctx.gameConfig.stamina);
    combat = simulateCombat(
      { troopCount: guard.count, troopType: guard.troopType, troopTier: guard.troopTier, stamina: 100 },
      { troopCount: targetExplorer.troopCount, troopType: targetExplorer.troopType, troopTier: targetExplorer.troopTier, stamina: defStamina },
      biome,
    );
  }

  try {
    await ctx.provider.attack_guard_vs_explorer({
      structure_id: input.structureId,
      structure_guard_slot: input.slot,
      explorer_id: input.targetArmyId,
      explorer_direction: direction,
      signer: ctx.signer,
    });
  } catch (err: any) {
    return { success: false, message: `Attack failed: ${extractTxError(err)}`, combat: null };
  }

  if (!combat) {
    return { success: true, message: `Attacked enemy army ${input.targetArmyId} from ${slotNames[input.slot]} guard.`, combat: null };
  }

  const lines = [
    `Guard attack — ${combat.winner === "attacker" ? "VICTORY" : combat.winner === "defender" ? "DEFEAT" : "DRAW"}`,
    `  Your ${guard!.count.toLocaleString()} ${guard!.troopType} ${guard!.troopTier} (${slotNames[input.slot]}) vs ${targetExplorer.troopCount.toLocaleString()} ${targetExplorer.troopType} ${targetExplorer.troopTier}`,
    `  Your casualties: ${combat.attackerCasualties.toLocaleString()} | Surviving: ${combat.attackerSurviving.toLocaleString()}`,
    `  Enemy casualties: ${combat.defenderCasualties.toLocaleString()} | Surviving: ${combat.defenderSurviving.toLocaleString()}`,
  ];
  return { success: true, message: lines.join("\n"), combat };
}

// ── Raid Target ──

export interface RaidTargetInput {
  armyId: number;
  targetX: number;
  targetY: number;
  stealResources?: Array<{ resourceId: number; amount: number }>;
}

export interface RaidTargetResult {
  success: boolean;
  message: string;
}

export async function raidTarget(input: RaidTargetInput, ctx: ToolContext): Promise<RaidTargetResult> {
  const targetRawX = toContractX(input.targetX, ctx.mapCenter);
  const targetRawY = toContractY(input.targetY, ctx.mapCenter);

  const explorer = await ctx.client.view.explorerInfo(input.armyId);
  if (!explorer) return { success: false, message: `Army ${input.armyId} not found.` };

  const direction = directionBetween(explorer.position, { x: targetRawX, y: targetRawY });
  if (direction === null) return { success: false, message: `Army not adjacent to (${input.targetX},${input.targetY}). Move first.` };

  const tile = ctx.snapshot.gridIndex.get(`${targetRawX},${targetRawY}`);
  if (!tile || !isStructure(tile.occupierType)) {
    return { success: false, message: `No structure at (${input.targetX},${input.targetY}). Raids only work on structures.` };
  }

  const structure = await ctx.client.view.structureAt(targetRawX, targetRawY);
  if (!structure) return { success: false, message: "Structure not found." };

  const scaledSteal = (input.stealResources ?? []).map((r) => ({
    resourceId: r.resourceId,
    amount: Math.floor(r.amount * RESOURCE_PRECISION),
  }));

  try {
    await ctx.provider.raid_explorer_vs_guard({
      explorer_id: input.armyId,
      structure_id: structure.entityId,
      structure_direction: direction,
      steal_resources: scaledSteal,
      signer: ctx.signer,
    });
  } catch (err: any) {
    return { success: false, message: `Raid failed: ${extractTxError(err)}` };
  }

  const stealSummary = (input.stealResources?.length ?? 0) > 0
    ? ` Attempted to steal: ${input.stealResources!.map((r) => `${r.amount} of resource ${r.resourceId}`).join(", ")}.`
    : "";
  return { success: true, message: `Raided structure at (${input.targetX},${input.targetY}). 10% damage dealt.${stealSummary}` };
}

// ── Reinforce Army ──

export interface ReinforceArmyInput {
  armyId: number;
  amount: number;
}

export interface ReinforceArmyResult {
  success: boolean;
  message: string;
}

export async function reinforceArmy(input: ReinforceArmyInput, ctx: ToolContext): Promise<ReinforceArmyResult> {
  const explorer = await ctx.client.view.explorerInfo(input.armyId);
  if (!explorer) return { success: false, message: `Army ${input.armyId} not found.` };

  // Find an adjacent owned structure to reinforce from
  let homePos: { x: number; y: number } | null = null;
  for (const t of ctx.snapshot.tiles) {
    if (t.occupierId > 0 && t.occupierType >= 1 && t.occupierType <= 14) {
      const dir = directionBetween(explorer.position, t.position);
      if (dir !== null) {
        const structInfo = await ctx.client.view.structureAt(t.position.x, t.position.y);
        if (structInfo && addressesEqual(structInfo.ownerAddress, ctx.playerAddress)) {
          homePos = t.position;
          break;
        }
      }
    }
  }

  if (!homePos) return { success: false, message: `Army ${input.armyId} is not adjacent to any of your structures. Move it home first.` };

  const homeDirection = directionBetween(explorer.position, homePos);
  if (homeDirection === null) return { success: false, message: "Cannot determine direction to home structure." };

  const scaledAmount = Math.floor(input.amount * RESOURCE_PRECISION);

  try {
    await ctx.provider.explorer_add({
      to_explorer_id: input.armyId,
      amount: scaledAmount,
      home_direction: homeDirection,
      signer: ctx.signer,
    });
  } catch (err: any) {
    return { success: false, message: `Reinforce failed: ${extractTxError(err)}` };
  }

  return { success: true, message: `Reinforced army ${input.armyId} with ${input.amount.toLocaleString()} troops.` };
}

// ── Apply Relic ──

export interface ApplyRelicInput {
  entityId: number;
  relicResourceId: number;
  recipientType: number;
}

export interface ApplyRelicResult {
  success: boolean;
  message: string;
}

export async function applyRelic(input: ApplyRelicInput, ctx: ToolContext): Promise<ApplyRelicResult> {
  const recipientNames = ["Explorer (army)", "Structure Guard", "Structure Production"];

  try {
    await ctx.provider.apply_relic({
      entity_id: input.entityId,
      relic_resource_id: input.relicResourceId,
      recipient_type: input.recipientType,
      signer: ctx.signer,
    });
  } catch (err: any) {
    return { success: false, message: `Apply relic failed: ${extractTxError(err)}` };
  }

  return { success: true, message: `Applied relic ${input.relicResourceId} to entity ${input.entityId} as ${recipientNames[input.recipientType] ?? `type ${input.recipientType}`}.` };
}
