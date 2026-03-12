/**
 * create_army — create an army at a realm you own.
 *
 * The agent points at a realm on the map using row:col (same as other tools).
 * Everything else is automated:
 * - Troop type: chosen from the realm's biome (best combat bonus)
 * - Tier: T1 (upgradeable later when building queries exist)
 * - Spawn direction: first open adjacent hex
 *
 * Output: what was created, where it spawned, and available resources.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { EternumClient } from "@bibliothecadao/client";
import { getNeighborHexes, Direction, BiomeIdToType, RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { MapContext } from "../map/context.js";
import { type TxContext, addressesEqual, extractTxError } from "./tx-context.js";

// ── Biome → best troop type ──────────────────────────────────────────
// From BIOME_COMBAT_BONUS in strength.ts:
//   Paladin  +30%: biomes 5,6,8,9,11,14
//   Knight   +30%: biomes 10,12,13,15,16
//   Crossbow +30%: biomes 1,2,3,4,7

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

function bestTroopForBiome(biome: number): { name: string; category: number } {
  const name = BIOME_BEST_TROOP[biome] ?? "Knight";
  return { name, category: TROOP_NAME_TO_CATEGORY[name] };
}

// On-chain troop category: Knight=0, Paladin=1, Crossbowman=2
const TROOP_NAME_TO_CATEGORY: Record<string, number> = {
  Knight: 0,
  Paladin: 1,
  Crossbowman: 2,
};

// Target troop count — use up to 10K, or whatever is available
const TARGET_TROOP_AMOUNT = 10_000 * RESOURCE_PRECISION;


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
      "Create a new army at one of your realms. " +
      "Use the line:col of your realm from YOUR ENTITIES at the bottom of the map. " +
      "Troop type is auto-chosen based on terrain advantage. Spawns at the first open adjacent hex.",
    parameters: Type.Object({
      row: Type.Number({ description: "Line number of your realm on the map" }),
      col: Type.Number({ description: "Column of your realm on the map" }),
    }),
    async execute(_toolCallId, params, signal) {
      const { row, col } = params;

      if (signal?.aborted) throw new Error("Operation cancelled");

      // ── Validate map ──

      if (!mapCtx.snapshot) {
        throw new Error(
          "Map not loaded yet. Wait for the next tick — the map is included automatically in each tick prompt.",
        );
      }

      const hexCoords = mapCtx.snapshot.resolve(row, col);
      if (!hexCoords) {
        throw new Error(
          `Invalid position ${row}:${col}. Map is ${mapCtx.snapshot.rowCount} rows x ${mapCtx.snapshot.colCount} cols.`,
        );
      }

      // ── Get tile from snapshot ──

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

      // ── Verify ownership ──

      if (playerAddress && !addressesEqual(structure.ownerAddress, playerAddress)) {
        throw new Error(`Realm at ${row}:${col} is not yours (owner: ${structure.ownerAddress}).`);
      }

      // ── Check army cap ──

      const { explorerCount, maxExplorerCount } = structure;
      if (maxExplorerCount > 0 && explorerCount >= maxExplorerCount) {
        throw new Error(`Army cap reached at this realm (${explorerCount}/${maxExplorerCount}). Try another realm.`);
      }

      // ── Determine troop type from biome ──

      const biome = tile.biome;
      const biomeName = BiomeIdToType[biome] ?? "Unknown";
      const troop = bestTroopForBiome(biome);

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

      // ── Check resources ──

      const resources = structure.resources;

      if (resources.length === 0) {
        throw new Error(
          `No resources available at this realm to create army. Troop type would be: ${troop.name} (+30% on ${biomeName})`,
        );
      }

      const resourceSummary = resources.map((r) => `${r.amount.toLocaleString()} ${r.name}`).join(", ");

      // ── Determine troop amount (up to 10K, capped by available balance) ──

      const troopResName = `${troop.name} T1`;
      const available = resources.find((r) => r.name === troopResName)?.amount ?? 0;
      const troopAmount = Math.min(TARGET_TROOP_AMOUNT, available > 0 ? available : TARGET_TROOP_AMOUNT);

      if (troopAmount <= 0) {
        throw new Error(`No ${troop.name} T1 troops available at this realm. Build a ${troop.name} barracks first.`);
      }

      // ── Create army ──

      const troopTier = 0; // T1 on-chain
      const directionName = Direction[spawnDirection] ?? String(spawnDirection);
      const troopCount = Math.floor(troopAmount / RESOURCE_PRECISION);

      try {
        await tx.provider.explorer_create({
          for_structure_id: structure.entityId,
          category: troop.category,
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
              `Army created: ${troopCount.toLocaleString()} ${troop.name} T1 (+30% on ${biomeName})`,
              `Armies: ${explorerCount + 1}/${maxExplorerCount}`,
              `Spawn: ${directionName} of realm`,
              `Resources: ${resourceSummary}`,
            ].join("\n"),
          },
        ],
        details: {
          realmEntityId: structure.entityId,
          troopType: troop.name,
          troopTier: "T1",
          spawnDirection,
          biome,
          resources,
        },
      };
    },
  };
}
