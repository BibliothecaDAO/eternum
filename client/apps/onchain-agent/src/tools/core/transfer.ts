/**
 * Core resource and troop transfer functions.
 *
 * Four operations extracted from the MCP server:
 * - sendResources — structure-to-structure via donkey caravan (send or pickup)
 * - transferToStructure — army to adjacent structure (loot, relics)
 * - transferToArmy — army to adjacent army (loot, relics)
 * - transferTroops — army to adjacent army (troops, not resources)
 *
 * Each function takes typed input + ToolContext and returns a typed result.
 * No MCP/PI-agent framework dependencies.
 */

import type { ToolContext } from "./context.js";
import { directionBetween } from "../../world/pathfinding_v2.js";
import { extractTxError } from "./tx-context.js";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

// ── Constants ────────────────────────────────────────────────────────

/** Default donkey cargo capacity when not supplied via ToolContext. */
const DEFAULT_DONKEY_CAPACITY_GRAMS = 50_000;

/** Fallback per-unit weight when the resource is unknown: 1kg. */
const DEFAULT_WEIGHT_GRAMS = 0;

// ── Shared types ─────────────────────────────────────────────────────

/** A single resource amount, human-readable (not precision-scaled). */
export interface ResourceAmount {
  resourceId: number;
  amount: number;
}

// ── sendResources ────────────────────────────────────────────────────

/** Input for sending resources between two structures via donkey caravan. */
export interface SendResourcesInput {
  fromStructureId: number;
  toStructureId: number;
  resources: ResourceAmount[];
}

/** Result of a sendResources call. */
export interface SendResourcesResult {
  success: boolean;
  message: string;
  /** How the caravan was routed. */
  mode?: "send" | "pickup";
  donkeysNeeded?: number;
}

/**
 * Send resources between two owned structures via donkey caravan.
 *
 * Computes total cargo weight, checks donkey availability on both sides,
 * and routes via the sender's donkeys (send) or the recipient's (pickup).
 */
export async function sendResources(
  input: SendResourcesInput,
  ctx: ToolContext,
): Promise<SendResourcesResult> {
  const { fromStructureId, toStructureId, resources } = input;

  if (fromStructureId === toStructureId) {
    return { success: false, message: "Cannot send to the same structure." };
  }
  if (resources.length === 0) {
    return { success: false, message: "No resources specified." };
  }

  // Scale to on-chain precision
  const scaledResources = resources.map((r) => ({
    resource: r.resourceId,
    amount: Math.floor(r.amount * RESOURCE_PRECISION),
  }));

  // ── Compute donkey cost from resource weights ──

  const donkeyCapacity = ctx.donkeyCapacityGrams ?? DEFAULT_DONKEY_CAPACITY_GRAMS;
  const weightMap = ctx.resourceWeightGrams;

  let totalWeightGrams = 0;
  for (const r of resources) {
    const weightPerUnit = weightMap?.get(r.resourceId) ?? DEFAULT_WEIGHT_GRAMS;
    totalWeightGrams += r.amount * weightPerUnit;
  }
  const donkeysNeeded = donkeyCapacity > 0 ? Math.ceil(totalWeightGrams / donkeyCapacity) : 0;

  // ── Check donkey balance on both structures ──

  let senderDonkeys = 0;
  let recipientDonkeys = 0;
  try {
    for (const t of ctx.snapshot?.tiles ?? []) {
      if (t.occupierId === fromStructureId) {
        const info = await ctx.client.view.structureAt(t.position.x, t.position.y);
        senderDonkeys = info?.resources.find((r: any) => r.name === "Donkey")?.amount ?? 0;
        break;
      }
    }
    for (const t of ctx.snapshot?.tiles ?? []) {
      if (t.occupierId === toStructureId) {
        const info = await ctx.client.view.structureAt(t.position.x, t.position.y);
        recipientDonkeys = info?.resources.find((r: any) => r.name === "Donkey")?.amount ?? 0;
        break;
      }
    }
  } catch {
    /* non-critical — will try send first */
  }

  if (donkeysNeeded > 0 && senderDonkeys < donkeysNeeded && recipientDonkeys < donkeysNeeded) {
    return {
      success: false,
      message: `Need ${donkeysNeeded} donkeys but sender has ${senderDonkeys} and recipient has ${recipientDonkeys}. Produce more donkeys first.`,
      donkeysNeeded,
    };
  }

  const summary = resources.map((r) => `${r.amount.toLocaleString()} of resource ${r.resourceId}`).join(", ");
  const donkeyNote = donkeysNeeded > 0 ? ` (${donkeysNeeded} donkeys burned)` : "";

  // ── Try send (sender's donkeys) ──

  if (senderDonkeys >= donkeysNeeded) {
    try {
      await ctx.provider.send_resources({
        sender_entity_id: fromStructureId,
        recipient_entity_id: toStructureId,
        resources: scaledResources,
        signer: ctx.signer,
      });
      return {
        success: true,
        message: `Sent ${summary} from ${fromStructureId} to ${toStructureId}${donkeyNote}. Sender's donkeys dispatched.`,
        mode: "send",
        donkeysNeeded,
      };
    } catch (err: any) {
      const msg = extractTxError(err);
      // If the error is donkey-related, fall through to pickup mode
      if (!msg.toLowerCase().includes("donkey")) {
        return { success: false, message: `Send failed: ${msg}` };
      }
    }
  }

  // ── Try pickup (recipient's donkeys) ──

  if (recipientDonkeys >= donkeysNeeded) {
    try {
      await ctx.provider.pickup_resources({
        recipient_entity_id: toStructureId,
        owner_entity_id: fromStructureId,
        resources: scaledResources,
        signer: ctx.signer,
      });
      return {
        success: true,
        message: `Picking up ${summary} from ${fromStructureId} to ${toStructureId}${donkeyNote}. Recipient's donkeys dispatched.`,
        mode: "pickup",
        donkeysNeeded,
      };
    } catch (err: any) {
      return { success: false, message: `Pickup failed: ${extractTxError(err)}` };
    }
  }

  return {
    success: false,
    message: `Neither structure has enough donkeys (need ${donkeysNeeded}). Sender: ${senderDonkeys}, Recipient: ${recipientDonkeys}.`,
    donkeysNeeded,
  };
}

// ── transferToStructure ──────────────────────────────────────────────

/** Input for transferring resources from an army to an adjacent structure. */
export interface TransferToStructureInput {
  armyId: number;
  structureId: number;
  resources: ResourceAmount[];
}

/** Result of a transferToStructure call. */
export interface TransferToStructureResult {
  success: boolean;
  message: string;
}

/**
 * Transfer resources (relics, loot, etc.) from an army to an adjacent structure.
 *
 * The army must be on a hex adjacent to the structure.
 */
export async function transferToStructure(
  input: TransferToStructureInput,
  ctx: ToolContext,
): Promise<TransferToStructureResult> {
  const { armyId, structureId, resources } = input;

  if (resources.length === 0) {
    return { success: false, message: "No resources specified." };
  }

  const explorer = await ctx.client.view.explorerInfo(armyId);
  if (!explorer) {
    return { success: false, message: `Army ${armyId} not found.` };
  }

  // Find structure position from snapshot
  let structPos: { x: number; y: number } | null = null;
  for (const t of ctx.snapshot?.tiles ?? []) {
    if (t.occupierId === structureId) {
      structPos = t.position;
      break;
    }
  }
  if (!structPos) {
    return { success: false, message: `Structure ${structureId} not found.` };
  }

  const direction = directionBetween(explorer.position, structPos);
  if (direction === null) {
    return { success: false, message: "Army not adjacent to structure. Move first." };
  }

  const scaledResources = resources.map((r) => ({
    resourceId: r.resourceId,
    amount: Math.floor(r.amount * RESOURCE_PRECISION),
  }));

  try {
    await ctx.provider.troop_structure_adjacent_transfer({
      from_explorer_id: armyId,
      to_structure_id: structureId,
      resources: scaledResources,
      signer: ctx.signer,
    });
  } catch (err: any) {
    return { success: false, message: `Transfer failed: ${extractTxError(err)}` };
  }

  const summary = resources.map((r) => `${r.amount.toLocaleString()} of resource ${r.resourceId}`).join(", ");
  return { success: true, message: `Transferred ${summary} from army ${armyId} to structure ${structureId}.` };
}

// ── transferToArmy ───────────────────────────────────────────────────

/** Input for transferring resources between two adjacent armies. */
export interface TransferToArmyInput {
  fromArmyId: number;
  toArmyId: number;
  resources: ResourceAmount[];
}

/** Result of a transferToArmy call. */
export interface TransferToArmyResult {
  success: boolean;
  message: string;
}

/**
 * Transfer resources (relics, loot, etc.) between two adjacent armies.
 *
 * Both armies must be on adjacent hexes.
 */
export async function transferToArmy(
  input: TransferToArmyInput,
  ctx: ToolContext,
): Promise<TransferToArmyResult> {
  const { fromArmyId, toArmyId, resources } = input;

  if (resources.length === 0) {
    return { success: false, message: "No resources specified." };
  }

  const fromExplorer = await ctx.client.view.explorerInfo(fromArmyId);
  if (!fromExplorer) {
    return { success: false, message: `Army ${fromArmyId} not found.` };
  }

  const toExplorer = await ctx.client.view.explorerInfo(toArmyId);
  if (!toExplorer) {
    return { success: false, message: `Army ${toArmyId} not found.` };
  }

  const direction = directionBetween(fromExplorer.position, toExplorer.position);
  if (direction === null) {
    return { success: false, message: "Armies are not adjacent. Move them next to each other first." };
  }

  const scaledResources = resources.map((r) => ({
    resourceId: r.resourceId,
    amount: Math.floor(r.amount * RESOURCE_PRECISION),
  }));

  try {
    await ctx.provider.troop_troop_adjacent_transfer({
      from_troop_id: fromArmyId,
      to_troop_id: toArmyId,
      resources: scaledResources,
      signer: ctx.signer,
    });
  } catch (err: any) {
    return { success: false, message: `Transfer failed: ${extractTxError(err)}` };
  }

  const summary = resources.map((r) => `${r.amount.toLocaleString()} of resource ${r.resourceId}`).join(", ");
  return { success: true, message: `Transferred ${summary} from army ${fromArmyId} to army ${toArmyId}.` };
}

// ── transferTroops ───────────────────────────────────────────────────

/** Input for transferring troops between two adjacent armies (same type/tier). */
export interface TransferTroopsInput {
  fromArmyId: number;
  toArmyId: number;
  /** Number of troops to transfer (human-readable, not precision-scaled). */
  amount: number;
}

/** Result of a transferTroops call. */
export interface TransferTroopsResult {
  success: boolean;
  message: string;
}

/**
 * Transfer troops between two adjacent armies of the same type and tier.
 *
 * Uses the `explorer_explorer_swap` provider call. Both armies must be
 * on adjacent hexes. Use this to consolidate small armies into one big one.
 */
export async function transferTroops(
  input: TransferTroopsInput,
  ctx: ToolContext,
): Promise<TransferTroopsResult> {
  const { fromArmyId, toArmyId, amount } = input;

  const fromExplorer = await ctx.client.view.explorerInfo(fromArmyId);
  if (!fromExplorer) {
    return { success: false, message: `Army ${fromArmyId} not found.` };
  }

  const toExplorer = await ctx.client.view.explorerInfo(toArmyId);
  if (!toExplorer) {
    return { success: false, message: `Army ${toArmyId} not found.` };
  }

  const direction = directionBetween(fromExplorer.position, toExplorer.position);
  if (direction === null) {
    return { success: false, message: "Armies are not adjacent. Move them next to each other first." };
  }

  const scaledAmount = Math.floor(amount * RESOURCE_PRECISION);

  try {
    await ctx.provider.explorer_explorer_swap({
      from_explorer_id: fromArmyId,
      to_explorer_id: toArmyId,
      to_explorer_direction: direction,
      count: scaledAmount,
      signer: ctx.signer,
    });
  } catch (err: any) {
    return { success: false, message: `Transfer failed: ${extractTxError(err)}` };
  }

  return { success: true, message: `Transferred ${amount.toLocaleString()} troops from army ${fromArmyId} to army ${toArmyId}.` };
}
