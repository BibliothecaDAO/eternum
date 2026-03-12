import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { EternumClient, StructureInfo, ExplorerInfo, GuardInfo, ResourceInfo } from "@bibliothecadao/client";
import { BiomeIdToType } from "@bibliothecadao/types";
import type { MapContext } from "../map/context.js";
import { isStructure, isExplorer, isChest } from "../world/occupier.js";
import { calculateStrength, calculateGuardStrength } from "../world/strength.js";

// --- Biome lookup ---

/** Split PascalCase into human-readable words: "TemperateDeciduousForest" → "Temperate Deciduous Forest" */
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

function formatStructure(info: StructureInfo, biome: number): string {
  const lines: string[] = [];

  const header = info.ownerAddress ? `${info.category} (Owner: ${info.ownerAddress})` : info.category;
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

function formatExplorer(info: ExplorerInfo, biome: number): string {
  const lines: string[] = [];

  const owner = info.ownerName ?? info.ownerAddress ?? "Unknown";
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

export function createInspectTool(client: EternumClient, ctx: MapContext): AgentTool<any> {
  return {
    name: "inspect_tile",
    label: "Inspect Tile",
    description:
      "Inspect any tile for detailed info: owner, guard composition and strength, resources, troop counts, biome. " +
      "Use before attacking to assess enemy strength. Use on your own structures to check reserves. " +
      "Coordinates are row:col from the map.",
    parameters: Type.Object({
      row: Type.Number({ description: "Line number from the map (left side)" }),
      col: Type.Number({ description: "Column number from the map" }),
    }),
    async execute(_toolCallId, params, signal) {
      if (signal?.aborted) throw new Error("Operation cancelled");
      const { row, col } = params;

      if (!ctx.snapshot) {
        throw new Error(
          "Map not loaded yet. Wait for the next tick — the map is included automatically in each tick prompt.",
        );
      }

      const hexCoords = ctx.snapshot.resolve(row, col);
      if (!hexCoords) {
        throw new Error(
          `Invalid position ${row}:${col}. Map is ${ctx.snapshot.rowCount} rows × ${ctx.snapshot.colCount} cols.`,
        );
      }

      const tile = ctx.snapshot.tileAt(row, col);

      // Unexplored
      if (!tile) {
        return {
          content: [{ type: "text" as const, text: "Unexplored territory" }],
          details: { row, col, hexCoords },
        };
      }

      const occupierType = tile.occupierType;
      let text: string;

      if (occupierType === 0) {
        // Explored but empty
        text = formatEmpty(tile.biome);
      } else if (isChest(occupierType)) {
        text = formatChest(tile.rewardExtracted);
      } else if (isStructure(occupierType)) {
        const info = await client.view.structureAt(hexCoords.x, hexCoords.y);
        if (info) {
          text = formatStructure(info, tile.biome);
        } else {
          text = formatEmpty(tile.biome);
        }
      } else if (isExplorer(occupierType)) {
        const info = await client.view.explorerInfo(tile.occupierId);
        if (info) {
          text = formatExplorer(info, tile.biome);
        } else {
          text = `Explorer (entity ${tile.occupierId}) — no data available`;
        }
      } else {
        // Quest (33), Spire (35), or unknown
        const labels: Record<number, string> = { 33: "Quest", 35: "Spire" };
        text = labels[occupierType] ?? `Unknown occupier (type ${occupierType})`;
      }

      return {
        content: [{ type: "text" as const, text }],
        details: { row, col, hexCoords },
      };
    },
  };
}
