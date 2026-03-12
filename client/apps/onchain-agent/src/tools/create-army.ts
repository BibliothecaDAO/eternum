/**
 * create_army — create an army at a realm you own.
 *
 * The agent picks the realm (row:col), troop type, and tier.
 * Troop amount uses all available troops of that type/tier (up to 10K).
 * Spawn direction is auto-selected (first open adjacent hex).
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { EternumClient } from "@bibliothecadao/client";
import { getNeighborHexes, Direction, BiomeIdToType, RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { MapContext } from "../map/context.js";
import { type TxContext, addressesEqual, extractTxError } from "./tx-context.js";

// On-chain troop category: Knight=0, Paladin=1, Crossbowman=2
const TROOP_CATEGORY: Record<string, number> = {
  Knight: 0,
  Paladin: 1,
  Crossbowman: 2,
};

// On-chain tier values: T1=0, T2=1, T3=2
const TIER_VALUE: Record<number, number> = { 1: 0, 2: 1, 3: 2 };

// Resource name suffix per tier
const TIER_SUFFIX: Record<number, string> = { 1: "T1", 2: "T2", 3: "T3" };

// Target troop count — use up to 10K, or whatever is available
const TARGET_TROOP_AMOUNT = 10_000 * RESOURCE_PRECISION;

// Biome → best troop type (from BIOME_COMBAT_BONUS in strength.ts)
const BIOME_BEST_TROOP: Record<number, string> = {
  1: "Crossbowman", 2: "Crossbowman", 3: "Crossbowman", 4: "Crossbowman", 7: "Crossbowman",
  5: "Paladin", 6: "Paladin", 8: "Paladin", 9: "Paladin", 11: "Paladin", 14: "Paladin",
  10: "Knight", 12: "Knight", 13: "Knight", 15: "Knight", 16: "Knight",
};

// ── Tool ─────────────────────────────────────────────────────────────

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
      "Create a new army at one of your realms. Check YOUR ENTITIES in the map for available troop reserves and army slots. " +
      "Choose troop type (Knight, Paladin, Crossbowman), tier (1/2/3), and how many to deploy. " +
      "Biome bonuses: Knight +30% on forest/taiga, Paladin +30% on desert/grassland, Crossbowman +30% on ocean/snow. " +
      "Higher tiers are much stronger (T2 ~2.5x, T3 ~7x) but require T2/T3 barracks buildings. " +
      "After creating, use add_troops to reinforce or merge_armies to combine armies. " +
      "Spawns at the first open adjacent hex.",
    parameters: Type.Object({
      row: Type.Number({ description: "Line number of your realm on the map" }),
      col: Type.Number({ description: "Column of your realm on the map" }),
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
      const { row, col } = params;
      const tier = params.tier ?? 1;

      if (signal?.aborted) throw new Error("Operation cancelled");

      // ── Validate map ──

      if (!mapCtx.snapshot) {
        throw new Error("Map not loaded yet. Wait for the next tick.");
      }

      const hexCoords = mapCtx.snapshot.resolve(row, col);
      if (!hexCoords) {
        throw new Error(
          `Invalid position ${row}:${col}. Map is ${mapCtx.snapshot.rowCount} rows x ${mapCtx.snapshot.colCount} cols.`,
        );
      }

      const tile = mapCtx.snapshot.tileAt(row, col);
      if (!tile) {
        throw new Error(`Tile ${row}:${col} is unexplored.`);
      }

      // ── Fetch structure ──

      const { x, y } = hexCoords;
      const structure = await client.view.structureAt(x, y);

      if (!structure) {
        throw new Error(`No structure at ${row}:${col}. Point at one of your realms.`);
      }

      if (structure.category !== "Realm") {
        throw new Error(`${structure.category} at ${row}:${col} is not a realm. Only realms can create armies.`);
      }

      if (playerAddress && !addressesEqual(structure.ownerAddress, playerAddress)) {
        throw new Error(`Realm at ${row}:${col} is not yours (owner: ${structure.ownerAddress}).`);
      }

      // ── Check army cap ──

      const { explorerCount, maxExplorerCount } = structure;
      if (maxExplorerCount > 0 && explorerCount >= maxExplorerCount) {
        throw new Error(`Army cap reached at this realm (${explorerCount}/${maxExplorerCount}). Try another realm.`);
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
          `No ${troopResName} troops available at this realm. ` +
            `Available: ${resourceSummary || "none"}`,
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
