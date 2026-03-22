/**
 * Core logic for creating a new army at a player's realm.
 *
 * Auto-selects the biome-optimal troop type, checks troop availability,
 * finds an open spawn hex, and calls `provider.explorer_create`.
 */

import type { ToolContext } from "./context.js";
import { toDisplayX, toDisplayY, displayDirection } from "./context.js";
import { addressesEqual, extractTxError } from "./tx-context.js";
import { getNeighborHexes, RESOURCE_PRECISION } from "@bibliothecadao/types";

// ── Biome → best troop type mapping ──
// Biome IDs: 1–4,7 → Crossbowman; 5,6,8,9,11,14 → Paladin; 10,12,13,15,16 → Knight
const BIOME_BEST: Record<number, string> = {
  1: "Crossbowman",
  2: "Crossbowman",
  3: "Crossbowman",
  4: "Crossbowman",
  7: "Crossbowman",
  5: "Paladin",
  6: "Paladin",
  8: "Paladin",
  9: "Paladin",
  11: "Paladin",
  14: "Paladin",
  10: "Knight",
  12: "Knight",
  13: "Knight",
  15: "Knight",
  16: "Knight",
};

/** Troop type name → on-chain category enum value. */
const TROOP_CATEGORY: Record<string, number> = {
  Knight: 0,
  Paladin: 1,
  Crossbowman: 2,
};

/** Tier number (1-based) → display suffix. */
const TIER_SUFFIX = ["T1", "T2", "T3"];

/** Default troop count when no amount is specified — deploys all available. */

// ── Input / Result interfaces ──

/** Input for creating an army. */
export interface CreateArmyInput {
  /** Entity ID of the realm to create the army at. */
  structureId: number;
  /** Override troop type ("Knight" | "Paladin" | "Crossbowman"). If omitted, auto-selects by biome. */
  troopType?: string;
  /** Troop tier 1–3. Defaults to 1. */
  tier?: number;
  /** Number of troops. Defaults to all available. */
  amount?: number;
}

/** Detailed info about the newly created army. */
export interface CreateArmyDetails {
  /** Troop name including tier, e.g. "Crossbowman T1". */
  troopName: string;
  /** Tier suffix: "T1", "T2", or "T3". */
  tierSuffix: string;
  /** Number of troops in the army. */
  troopCount: number;
  /** Direction from the structure where the army spawned, e.g. "EAST". */
  spawnDirection: string;
  /** Display coordinates where the army spawned. */
  spawnPosition: { x: number; y: number };
  /** Number of explorers the structure now has (including the new one). */
  explorerCount: number;
  /** Maximum explorers the structure can support. */
  maxExplorerCount: number;
}

/** Result of a create-army operation. */
export interface CreateArmyResult {
  success: boolean;
  /** Human-readable summary of the outcome. */
  message: string;
  /** Details about the created army, or null on failure. */
  armyDetails: CreateArmyDetails | null;
}

/**
 * Create a new army at the player's realm.
 *
 * 1. Finds the structure tile by entity ID in the map snapshot.
 * 2. Looks up structure info (must be a realm owned by the player).
 * 3. Picks the biome-optimal troop type unless overridden.
 * 4. Checks troop availability in the structure's resources.
 * 5. Finds an unoccupied adjacent hex for spawning.
 * 6. Calls `provider.explorer_create` to create the army on-chain.
 */
export async function createArmy(input: CreateArmyInput, ctx: ToolContext): Promise<CreateArmyResult> {
  const { structureId, troopType: troopTypeOverride, tier: rawTier, amount: requestedAmount } = input;

  // ── Find structure tile by entity ID ──
  let structTile = null as any;
  for (const t of ctx.snapshot.tiles) {
    if (t.occupierId === structureId) {
      structTile = t;
      break;
    }
  }
  if (!structTile) {
    return { success: false, message: `Structure ${structureId} not found.`, armyDetails: null };
  }

  // ── Look up structure info ──
  const info = await ctx.client.view.structureAt(structTile.position.x, structTile.position.y);
  if (!info) {
    return { success: false, message: `Structure ${structureId} not found.`, armyDetails: null };
  }
  if (info.category !== "Realm") {
    return { success: false, message: `${info.category} is not a realm.`, armyDetails: null };
  }
  if (!addressesEqual(info.ownerAddress, ctx.playerAddress)) {
    return { success: false, message: "Not yours.", armyDetails: null };
  }

  // ── Pick troop type ──
  const troopName = troopTypeOverride ?? BIOME_BEST[structTile.biome] ?? "Knight";
  const category = TROOP_CATEGORY[troopName] ?? 0;
  const tierValue = (rawTier ?? 1) - 1; // 0-indexed for provider
  const tierSuffix = TIER_SUFFIX[tierValue];
  const resName = `${troopName} ${tierSuffix}`;

  // ── Check availability ──
  const available = info.resources.find((r: any) => r.name === resName)?.amount ?? 0;
  if (available <= 0) {
    const availableList = info.resources
      .filter((r: any) => r.amount > 0)
      .map((r: any) => `${r.amount.toLocaleString()} ${r.name}`)
      .join(", ");
    return {
      success: false,
      message: `No ${resName} available. Resources: ${availableList}`,
      armyDetails: null,
    };
  }

  const troopCount = requestedAmount ?? available;
  if (troopCount > available) {
    return {
      success: false,
      message: `Only ${available.toLocaleString()} ${resName} available, requested ${troopCount.toLocaleString()}.`,
      armyDetails: null,
    };
  }
  const scaledAmount = Math.floor(troopCount * RESOURCE_PRECISION);

  // ── Find open spawn hex ──
  const neighbors = getNeighborHexes(structTile.position.x, structTile.position.y);
  let spawnDir: number | null = null;
  let spawnRawX = 0;
  let spawnRawY = 0;
  for (const n of neighbors) {
    const nt = ctx.snapshot.gridIndex.get(`${n.col},${n.row}`);
    if (nt && nt.occupierType === 0) {
      spawnDir = n.direction;
      spawnRawX = n.col;
      spawnRawY = n.row;
      break;
    }
  }
  if (spawnDir === null) {
    return { success: false, message: "No open spawn hex.", armyDetails: null };
  }

  // ── Execute on-chain ──
  try {
    await ctx.provider.explorer_create({
      for_structure_id: structureId,
      category,
      tier: tierValue,
      amount: scaledAmount,
      spawn_direction: spawnDir,
      signer: ctx.signer,
    });
  } catch (err: any) {
    return { success: false, message: `Create failed: ${extractTxError(err)}`, armyDetails: null };
  }

  const spawnDirectionName = displayDirection(spawnDir);
  const spawnDispX = toDisplayX(spawnRawX, ctx.mapCenter);
  const spawnDispY = toDisplayY(spawnRawY, ctx.mapCenter);
  const details: CreateArmyDetails = {
    troopName: resName,
    tierSuffix,
    troopCount,
    spawnDirection: spawnDirectionName,
    spawnPosition: { x: spawnDispX, y: spawnDispY },
    explorerCount: info.explorerCount + 1,
    maxExplorerCount: info.maxExplorerCount,
  };

  return {
    success: true,
    message: `Army created: ${troopCount.toLocaleString()} ${resName} at ${spawnDirectionName} of realm (${spawnDispX},${spawnDispY}). Armies: ${details.explorerCount}/${details.maxExplorerCount}. Use 'map find own_army' to get the entity ID.`,
    armyDetails: details,
  };
}
