/**
 * create_army — create an army at a realm you own.
 *
 * Pick the realm (row:col), troop type, and tier.
 * Deploys all available troops of that type/tier (up to 10K).
 * Auto-selects the spawn direction (first open adjacent hex).
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { EternumClient } from "@bibliothecadao/client";
import { getNeighborHexes, Direction, BiomeIdToType, RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { MapContext } from "../map/context.js";
import { type TxContext, addressesEqual, extractTxError } from "./tx-context.js";

/** Maps troop names to their on-chain category index (Knight=0, Paladin=1, Crossbowman=2). */
const TROOP_CATEGORY: Record<string, number> = {
  Knight: 0,
  Paladin: 1,
  Crossbowman: 2,
};

/** Maps user-facing tier numbers (1/2/3) to on-chain tier values (0/1/2). */
const TIER_VALUE: Record<number, number> = { 1: 0, 2: 1, 3: 2 };

/** Maps tier numbers to the resource name suffix in structure resource lists (e.g. "T1"). */
const TIER_SUFFIX: Record<number, string> = { 1: "T1", 2: "T2", 3: "T3" };

/** Default maximum troop count to deploy when no explicit amount is provided (10,000 troops). */
const TARGET_TROOP_AMOUNT = 10_000 * RESOURCE_PRECISION;

/** Maps biome IDs to the troop type that gets a +30% combat bonus in that biome. */
const BIOME_BEST_TROOP: Record<number, string> = {
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

// ── Tool ─────────────────────────────────────────────────────────────

/**
 * Create the create_army agent tool.
 *
 * @param client - Eternum client for fetching structure data and available resources.
 * @param mapCtx - Map context holding the current tile snapshot for spawn-hex selection.
 * @param playerAddress - Hex address of the player; used to verify realm ownership.
 * @param tx - Transaction context with the provider and signer.
 * @returns An AgentTool that creates a new explorer army at an owned realm.
 */
export function createCreateArmyTool(
  client: EternumClient,
  mapCtx: MapContext,
  playerAddress: string,
  tx: TxContext,
): AgentTool<any> {
  return {
    name: "create_army",
    label: "Create Army",
    description:
      "Create a new army at one of your realms. " +
      "Choose troop type (Knight, Paladin, Crossbowman), tier (1/2/3), and how many to deploy. " +
      "Biome bonuses: Knight +30% on forest/taiga, Paladin +30% on desert/grassland, Crossbowman +30% on ocean/snow. " +
      "Higher tiers are much stronger (T2 ~2.5x, T3 ~7x) but require T2/T3 barracks buildings. " +
      "Spawns at the first open adjacent hex.",
    parameters: Type.Object({
      structure_id: Type.Number({ description: "Entity ID of your realm (from briefing or map_query)" }),
      troop_type: Type.Optional(
        Type.Union([Type.Literal("Knight"), Type.Literal("Paladin"), Type.Literal("Crossbowman")], {
          description: "Troop type. If omitted, auto-selects best type for the realm's biome.",
        }),
      ),
      tier: Type.Optional(
        Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)], {
          description: "Troop tier (1, 2, or 3). Higher = stronger. Defaults to 1.",
        }),
      ),
      amount: Type.Optional(
        Type.Number({ description: "Number of troops to deploy (default: all available, up to 10K)" }),
      ),
    }),
    async execute(_toolCallId, params, signal) {
      const { structure_id: structureId } = params;
      const tier = params.tier ?? 1;

      if (signal?.aborted) throw new Error("Operation cancelled");

      if (!mapCtx.snapshot) {
        throw new Error("Map not loaded yet. Wait for the next tick.");
      }

      // ── Find structure tile by entity ID ──

      let tile = null as any;
      for (const t of mapCtx.snapshot.tiles) {
        if (t.occupierId === structureId) { tile = t; break; }
      }
      if (!tile) {
        throw new Error(`Structure ${structureId} not found on the map.`);
      }

      // ── Fetch structure ──

      const { x, y } = tile.position;
      const structure = await client.view.structureAt(x, y);

      if (!structure) {
        throw new Error(`Structure ${structureId} not found.`);
      }

      if (structure.category !== "Realm") {
        throw new Error(`${structure.category} ${structureId} is not a realm. Only realms can create armies.`);
      }

      if (playerAddress && !addressesEqual(structure.ownerAddress, playerAddress)) {
        throw new Error(`Realm ${structureId} is not yours (owner: ${structure.ownerAddress}).`);
      }

      // ── Check army cap ──

      const { explorerCount, maxExplorerCount } = structure;
      if (maxExplorerCount > 0 && explorerCount >= maxExplorerCount) {
        throw new Error(`Army cap reached at realm ${structureId} (${explorerCount}/${maxExplorerCount}). Try another realm.`);
      }

      // ── Determine troop type ──

      const biome = tile.biome;
      const biomeName = BiomeIdToType[biome] ?? "Unknown";
      const troopName = params.troop_type ?? BIOME_BEST_TROOP[biome] ?? "Knight";
      const category = TROOP_CATEGORY[troopName];
      if (category === undefined) {
        throw new Error(`Unknown troop type: ${troopName}. Use Knight, Paladin, or Crossbowman.`);
      }

      const biomeBonus = BIOME_BEST_TROOP[biome] === troopName ? "+30%" : "no bonus";

      // ── Find open spawn hex ──

      const neighbors = getNeighborHexes(x, y);
      let spawnDirection: number | null = null;
      for (const n of neighbors) {
        const neighborTile = mapCtx.snapshot.gridIndex.get(`${n.col},${n.row}`);
        if (neighborTile && neighborTile.occupierType === 0) {
          spawnDirection = n.direction;
          break;
        }
      }

      if (spawnDirection === null) {
        throw new Error("No open hex adjacent to this realm for spawning. All 6 neighbors are occupied.");
      }

      // ── Check resources & determine amount ──

      const resources = structure.resources;
      const resourceSummary = resources.map((r) => `${r.amount.toLocaleString()} ${r.name}`).join(", ");

      const tierSuffix = TIER_SUFFIX[tier] ?? "T1";
      const troopResName = `${troopName} ${tierSuffix}`;
      const availableDisplay = resources.find((r) => r.name === troopResName)?.amount ?? 0;
      const availableRaw = availableDisplay > 0 ? Math.floor(availableDisplay * RESOURCE_PRECISION) : 0;
      const requestedRaw = params.amount ? Math.floor(params.amount * RESOURCE_PRECISION) : TARGET_TROOP_AMOUNT;
      const troopAmount = availableRaw > 0 ? Math.min(requestedRaw, availableRaw) : requestedRaw;

      if (availableDisplay <= 0) {
        throw new Error(
          `No ${troopResName} troops available at this realm. ` + `Available: ${resourceSummary || "none"}`,
        );
      }

      // ── Create army ──

      const troopTier = TIER_VALUE[tier] ?? 0;
      const directionName = Direction[spawnDirection] ?? String(spawnDirection);
      const troopCount = Math.floor(troopAmount / RESOURCE_PRECISION);

      try {
        await tx.provider.explorer_create({
          for_structure_id: structure.entityId,
          category,
          tier: troopTier,
          amount: troopAmount,
          spawn_direction: spawnDirection,
          signer: tx.signer,
        });
      } catch (err: any) {
        throw new Error(`Create army failed: ${extractTxError(err)}`);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Army created: ${troopCount.toLocaleString()} ${troopResName} (${biomeBonus} on ${biomeName})`,
              `Armies: ${explorerCount + 1}/${maxExplorerCount}`,
              `Spawn: ${directionName} of realm`,
              `Resources: ${resourceSummary}`,
            ].join("\n"),
          },
        ],
        details: {
          realmEntityId: structure.entityId,
          troopType: troopName,
          troopTier: tierSuffix,
          troopCount,
          spawnDirection,
          biome,
          resources,
        },
      };
    },
  };
}
