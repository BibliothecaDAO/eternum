/**
 * inspect_tile tool — fetch detailed information about any tile on the map.
 *
 * Supports structures (guards, resources, level), explorers (troops, strength, stamina),
 * chests (open/unopened), quests, spires, and empty explored tiles. Returns a
 * human-readable summary the agent can act on immediately.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { EternumClient, StructureInfo, ExplorerInfo, GuardInfo, ResourceInfo } from "@bibliothecadao/client";
import { BiomeIdToType } from "@bibliothecadao/types";
import type { MapContext } from "../map/context.js";
import { isStructure, isExplorer, isChest } from "../world/occupier.js";
import { calculateStrength, calculateGuardStrength } from "../world/strength.js";
import { addressesEqual } from "./tx-context.js";

// --- Biome lookup ---

/** Split PascalCase into space-separated words: "TemperateDeciduousForest" → "Temperate Deciduous Forest" */
function biomeName(biomeId: number): string {
  const type = BiomeIdToType[biomeId];
  if (!type) return "Unknown";
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

// --- Natural language formatters ---

function formatGuards(guards: GuardInfo[], biome: number): string {
  if (guards.length === 0) return "Unguarded";
  const nonEmpty = guards.filter((g) => g.count > 0);
  if (nonEmpty.length === 0) return "Unguarded";
  const guardLines = nonEmpty
    .map((g) => `${g.count.toLocaleString()} ${g.troopType} ${g.troopTier} (${g.slot})`)
    .join(", ");
  const strength = calculateGuardStrength(nonEmpty, biome);
  return `${guardLines}\nStrength: ${strength.display}`;
}

function formatResources(resources: ResourceInfo[]): string {
  if (resources.length === 0) return "None";
  return resources.map((r) => `${r.amount.toLocaleString()} ${r.name}`).join(", ");
}

function formatOwner(address: string | null, name: string | null, playerAddress?: string): string {
  if (!address) return "Unknown";
  try { if (BigInt(address) === 0n) return "The Vanguard"; } catch {}
  if (playerAddress && addressesEqual(address, playerAddress)) return "You";
  if (name) return name;
  // Try to decode as a felt short string (Cartridge controller names are stored as felts)
  try {
    const n = BigInt(address);
    if (n > 0n && n < 2n ** 248n) {
      const bytes: number[] = [];
      let val = n;
      while (val > 0n) {
        bytes.unshift(Number(val & 0xffn));
        val >>= 8n;
      }
      const decoded = String.fromCharCode(...bytes);
      if (/^[\x20-\x7e]+$/.test(decoded)) return decoded;
    }
  } catch {}
  return address.slice(0, 10) + "...";
}

function formatStructure(info: StructureInfo, biome: number, playerAddress?: string): string {
  const lines: string[] = [];

  const owner = formatOwner(info.ownerAddress, null, playerAddress);
  const header = `${info.category} (Owner: ${owner})`;
  lines.push(header);

  if (info.category === "Realm" || info.category === "Village") {
    lines.push(`Level: ${info.level}`);
  }

  if (info.maxExplorerCount > 0) {
    lines.push(`Armies: ${info.explorerCount}/${info.maxExplorerCount}`);
  }

  lines.push(`Guards: ${formatGuards(info.guards, biome)}`);
  lines.push(`Resources: ${formatResources(info.resources)}`);

  return lines.join("\n");
}

function formatExplorer(info: ExplorerInfo, biome: number, playerAddress?: string): string {
  const lines: string[] = [];

  const owner = formatOwner(info.ownerAddress, info.ownerName, playerAddress);
  lines.push(`${info.troopType} ${info.troopTier} (Owner: ${owner})`);
  lines.push(`Troops: ${info.troopCount.toLocaleString()} ${info.troopType} ${info.troopTier}`);
  const strength = calculateStrength(info.troopCount, info.troopTier, info.troopType, biome);
  lines.push(`Strength: ${strength.display}`);
  lines.push(`Stamina: ${info.stamina}`);

  return lines.join("\n");
}

function formatEmpty(biome: number): string {
  return `Empty tile — ${biomeName(biome)}`;
}

function formatChest(rewardExtracted: boolean): string {
  return rewardExtracted ? "Chest (opened)" : "Chest (unopened)";
}

// --- Tool ---

/**
 * Create the inspect_tile agent tool.
 *
 * @param client - Eternum client for fetching structure and explorer data.
 * @param ctx - Map context holding the current tile snapshot.
 * @returns An AgentTool that inspects a tile by row/col and returns a text summary.
 */
export function createInspectTool(client: EternumClient, ctx: MapContext, playerAddress?: string): AgentTool<any> {
  return {
    name: "inspect_tile",
    label: "Inspect Tile",
    description:
      "Inspect any tile for detailed info: owner, guard composition and strength, resources, troop counts, biome. " +
      "Use before attacking to assess enemy strength. Use on your own structures to check reserves. " +
      "Coordinates are world hex (x, y) from the briefing or map_query results.",
    parameters: Type.Object({
      x: Type.Number({ description: "World hex X coordinate" }),
      y: Type.Number({ description: "World hex Y coordinate" }),
    }),
    async execute(_toolCallId, params, signal) {
      if (signal?.aborted) throw new Error("Operation cancelled");
      const { x, y } = params;

      if (!ctx.snapshot) {
        throw new Error("Map not loaded yet. Wait for the next tick.");
      }

      const tile = ctx.snapshot.gridIndex.get(`${x},${y}`);

      // Unexplored
      if (!tile) {
        return {
          content: [{ type: "text" as const, text: `Unexplored territory at (${x},${y})` }],
          details: { x, y },
        };
      }

      const occupierType = tile.occupierType;
      let text: string;

      if (occupierType === 0) {
        text = formatEmpty(tile.biome);
      } else if (isChest(occupierType)) {
        text = formatChest(tile.rewardExtracted);
      } else if (isStructure(occupierType)) {
        const info = await client.view.structureAt(x, y);
        if (info) {
          text = formatStructure(info, tile.biome, playerAddress);
        } else {
          text = formatEmpty(tile.biome);
        }
      } else if (isExplorer(occupierType)) {
        const info = await client.view.explorerInfo(tile.occupierId);
        if (info) {
          text = formatExplorer(info, tile.biome, playerAddress);
        } else {
          text = `Explorer (entity ${tile.occupierId}) — no data available`;
        }
      } else {
        const labels: Record<number, string> = { 33: "Quest", 35: "Spire" };
        text = labels[occupierType] ?? `Unknown occupier (type ${occupierType})`;
      }

      return {
        content: [{ type: "text" as const, text }],
        details: { x, y },
      };
    },
  };
}
