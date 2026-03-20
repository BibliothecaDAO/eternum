/**
 * Core logic for guard management — adding, swapping, and removing
 * troops from structure guard slots.
 *
 * Three operations:
 * - guardFromStorage: assign troops from a structure's own storage into a guard slot
 * - guardFromArmy: move troops from an adjacent army into a guard slot
 * - unguardToArmy: move troops from a guard slot to an adjacent army
 */

import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { directionBetween } from "../../world/pathfinding_v2.js";
import type { ToolContext } from "./context.js";
import { extractTxError } from "./tx-context.js";

// ── Shared constants ────────────────────────────────────────────────

const SLOT_NAMES = ["Alpha", "Bravo", "Charlie", "Delta"] as const;
const TIER_SUFFIXES = ["T1", "T2", "T3"] as const;

// ── guardFromStorage ────────────────────────────────────────────────

/** Input for adding guards from a structure's own resource storage. */
export interface GuardFromStorageInput {
  /** Entity ID of the structure to guard. */
  structureId: number;
  /** Guard slot (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta). */
  slot: number;
  /** Troop type: "Knight" | "Paladin" | "Crossbowman". */
  troopType: "Knight" | "Paladin" | "Crossbowman";
  /** Troop tier (1-3). */
  tier: number;
  /** Number of troops to assign as guards (unscaled). */
  amount: number;
}

/** Result of a guardFromStorage operation. */
export interface GuardFromStorageResult {
  success: boolean;
  message: string;
}

/**
 * Add troops from a structure's own resource storage into one of its guard slots.
 *
 * Structures can have up to 4 guard slots (Alpha=0, Bravo=1, Charlie=2, Delta=3).
 * Larger groups in one slot are disproportionately stronger — concentrate troops
 * in fewer slots.
 */
export async function guardFromStorage(
  input: GuardFromStorageInput,
  ctx: ToolContext,
): Promise<GuardFromStorageResult> {
  const category = { Knight: 0, Paladin: 1, Crossbowman: 2 }[input.troopType] ?? 0;
  const tierValue = (input.tier ?? 1) - 1;
  const scaledAmount = Math.floor(input.amount * RESOURCE_PRECISION);
  const tierSuffix = TIER_SUFFIXES[tierValue] ?? "T1";

  try {
    await ctx.provider.guard_add({
      for_structure_id: input.structureId,
      slot: input.slot,
      category,
      tier: tierValue,
      amount: scaledAmount,
      signer: ctx.signer,
    });
  } catch (err: any) {
    return { success: false, message: `Guard failed: ${extractTxError(err)}` };
  }

  return {
    success: true,
    message: `Added ${input.amount.toLocaleString()} ${input.troopType} ${tierSuffix} to ${SLOT_NAMES[input.slot] ?? `slot ${input.slot}`} guard on structure ${input.structureId}.`,
  };
}

// ── guardFromArmy ───────────────────────────────────────────────────

/** Input for moving troops from an adjacent army into a structure's guard slot. */
export interface GuardFromArmyInput {
  /** Entity ID of the army donating troops. */
  armyId: number;
  /** Entity ID of the structure to garrison. */
  structureId: number;
  /** Guard slot (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta). */
  slot: number;
  /** Number of troops to move into the guard slot (unscaled). */
  amount: number;
}

/** Result of a guardFromArmy operation. */
export interface GuardFromArmyResult {
  success: boolean;
  message: string;
}

/**
 * Move troops from an adjacent army into a structure's guard slot.
 *
 * The army must be adjacent to the structure. Looks up both positions,
 * computes the direction, and calls `explorer_guard_swap`.
 */
export async function guardFromArmy(
  input: GuardFromArmyInput,
  ctx: ToolContext,
): Promise<GuardFromArmyResult> {
  // Find structure position from the map snapshot
  let structPos: { x: number; y: number } | null = null;
  for (const t of ctx.snapshot?.tiles ?? []) {
    if (t.occupierId === input.structureId) {
      structPos = t.position;
      break;
    }
  }

  const explorer = await ctx.client.view.explorerInfo(input.armyId);
  if (!explorer) {
    return { success: false, message: `Army ${input.armyId} not found.` };
  }

  if (structPos) {
    const adjacencyCheck = directionBetween(explorer.position, structPos);
    if (adjacencyCheck === null) {
      return { success: false, message: `Army ${input.armyId} is not adjacent to structure ${input.structureId}. Move first.` };
    }
  }

  const direction = structPos ? directionBetween(explorer.position, structPos) : null;
  if (direction === null) {
    return { success: false, message: `Cannot determine direction to structure.` };
  }

  const scaledAmount = Math.floor(input.amount * RESOURCE_PRECISION);

  try {
    await ctx.provider.explorer_guard_swap({
      from_explorer_id: input.armyId,
      to_structure_id: input.structureId,
      to_structure_direction: direction,
      to_guard_slot: input.slot,
      count: scaledAmount,
      signer: ctx.signer,
    });
  } catch (err: any) {
    return { success: false, message: `Garrison failed: ${extractTxError(err)}` };
  }

  return {
    success: true,
    message: `Garrisoned ${input.amount.toLocaleString()} troops from army ${input.armyId} into ${SLOT_NAMES[input.slot] ?? `slot ${input.slot}`} on structure ${input.structureId}.`,
  };
}

// ── unguardToArmy ───────────────────────────────────────────────────

/** Input for moving troops from a guard slot to an adjacent army. */
export interface UnguardToArmyInput {
  /** Entity ID of the structure. */
  structureId: number;
  /** Guard slot (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta). */
  slot: number;
  /** Entity ID of the receiving army. */
  armyId: number;
  /** Number of troops to move out of the guard slot (unscaled). */
  amount: number;
}

/** Result of an unguardToArmy operation. */
export interface UnguardToArmyResult {
  success: boolean;
  message: string;
}

/**
 * Move troops from a structure's guard slot to an adjacent army.
 *
 * The army must be adjacent to the structure and have the same troop type/tier.
 * Computes the direction from structure to army and calls `guard_explorer_swap`.
 */
export async function unguardToArmy(
  input: UnguardToArmyInput,
  ctx: ToolContext,
): Promise<UnguardToArmyResult> {
  // Find structure position from the map snapshot
  let structPos: { x: number; y: number } | null = null;
  for (const t of ctx.snapshot?.tiles ?? []) {
    if (t.occupierId === input.structureId) {
      structPos = t.position;
      break;
    }
  }

  const explorer = await ctx.client.view.explorerInfo(input.armyId);
  if (!explorer) {
    return { success: false, message: `Army ${input.armyId} not found.` };
  }

  if (!structPos) {
    return { success: false, message: `Structure ${input.structureId} not found on map.` };
  }

  const direction = directionBetween(structPos, explorer.position);
  if (direction === null) {
    return { success: false, message: `Army ${input.armyId} is not adjacent to structure ${input.structureId}. Move first.` };
  }

  const scaledAmount = Math.floor(input.amount * RESOURCE_PRECISION);

  try {
    await ctx.provider.guard_explorer_swap({
      from_structure_id: input.structureId,
      from_guard_slot: input.slot,
      to_explorer_id: input.armyId,
      to_explorer_direction: direction,
      count: scaledAmount,
      signer: ctx.signer,
    });
  } catch (err: any) {
    return { success: false, message: `Unguard failed: ${extractTxError(err)}` };
  }

  return {
    success: true,
    message: `Moved ${input.amount.toLocaleString()} troops from ${SLOT_NAMES[input.slot] ?? `slot ${input.slot}`} on structure ${input.structureId} to army ${input.armyId}.`,
  };
}
