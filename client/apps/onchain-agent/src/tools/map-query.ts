/**
 * map_query tool — structured queries over the game world.
 *
 * Single tool, multiple operations — mirrors LSP's shape:
 *
 *   LSP                             map_query
 *   ────────────────────────        ────────────────────────────
 *   hover(file, line, col)       →  tile_info(x, y)
 *   findReferences(symbol)       →  nearby(x, y, radius?)
 *   goToDefinition(symbol)       →  entity_info(entity_id)
 *   workspaceSymbol(query)       →  find(type, ref_x?, ref_y?)
 *
 * Diagnostics (threats, opportunities) are pushed automatically each
 * tick — the agent doesn't need to query for them.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { MapContext } from "../map/context.js";
import type { FindTargetType, NearbyResult, TileInfoResult, EntityInfoResult, FindResult } from "../map/protocol.js";

// ── Formatters: structured data → natural language ────────────────────

function formatTileInfo(r: TileInfoResult): string {
  if (!r.explored) return `Unexplored tile at (${r.position.x},${r.position.y}).`;

  const lines: string[] = [`(${r.position.x},${r.position.y}) — ${r.biome}`];

  if (!r.entity) {
    lines[0] += " — empty";
    return lines.join("\n");
  }

  // Full entity details
  return lines[0] + "\n" + formatEntityInfo(r.entity);
}

function formatNearby(r: NearbyResult): string {
  const lines: string[] = [`Nearby (${r.center.x},${r.center.y}), radius ${r.radius}:`];

  const section = (label: string, entities: typeof r.ownedArmies) => {
    if (entities.length === 0) return;
    lines.push(`  ${label} (${entities.length}):`);
    for (const e of entities) {
      const str = e.occupier.strength ? ` | str ${e.occupier.strength.display}` : "";
      lines.push(`    ${e.occupier.label} at (${e.position.x},${e.position.y}) — ${e.distance} hexes${str}`);
    }
  };

  section("Your armies", r.ownedArmies);
  section("Your structures", r.ownedStructures);
  section("Enemy armies", r.enemyArmies);
  section("Enemy structures", r.enemyStructures);
  section("Chests", r.chests);
  section("Other", r.other);

  if (r.ownedArmies.length + r.ownedStructures.length + r.enemyArmies.length +
      r.enemyStructures.length + r.chests.length + r.other.length === 0) {
    lines.push("  Nothing nearby.");
  }

  return lines.join("\n");
}

function formatEntityInfo(r: EntityInfoResult): string {
  const lines: string[] = [];

  if (r.explorer) {
    const e = r.explorer;
    lines.push(`${e.troopCount.toLocaleString()} ${e.troopType} ${e.troopTier} (entity ${r.entityId})`);
    lines.push(`Strength: ${e.strength.display}`);
    lines.push(`Stamina: ${e.stamina}`);
    lines.push(`Position: (${r.position.x},${r.position.y}) — ${r.biome}`);
    lines.push(`Owner: ${e.owner}`);
  } else if (r.structure) {
    const s = r.structure;
    lines.push(`${s.category} lv${s.level} (entity ${r.entityId})`);
    lines.push(`Position: (${r.position.x},${r.position.y}) — ${r.biome}`);
    lines.push(`Owner: ${s.owner}`);
    lines.push(`Armies: ${s.explorerCount}/${s.maxExplorerCount}`);
    if (s.guards.length > 0) {
      lines.push(`Guards: ${s.guards.map((g) => `${g.count.toLocaleString()} ${g.troopType} ${g.troopTier} (${g.slot})`).join(", ")}`);
      lines.push(`Guard strength: ${s.guardStrength.display}`);
    } else {
      lines.push("Guards: none");
    }
    if (s.resources.length > 0) {
      lines.push(`Resources: ${s.resources.map((res) => `${res.amount.toLocaleString()} ${res.name}`).join(", ")}`);
    }
  } else if (r.chest) {
    lines.push(`Chest (entity ${r.entityId}) — ${r.chest.opened ? "opened" : "unopened"}`);
    lines.push(`Position: (${r.position.x},${r.position.y}) — ${r.biome}`);
  } else {
    // Quest, spire, or unknown
    lines.push(`${r.kind} (entity ${r.entityId})`);
    lines.push(`Position: (${r.position.x},${r.position.y}) — ${r.biome}`);
  }

  return lines.join("\n");
}

function formatFind(results: FindResult[], type: string): string {
  if (results.length === 0) return `No ${type} found.`;

  const lines: string[] = [`Found ${results.length} ${type}:`];
  for (const r of results) {
    const dist = r.distance != null ? ` — ${r.distance} hexes` : "";
    const str = r.strength ? ` | str ${r.strength.display}` : "";
    lines.push(`  ${r.label} (${r.entityId}) at (${r.position.x},${r.position.y})${dist}${str}`);
  }
  return lines.join("\n");
}

// ── Valid operation + target type sets ─────────────────────────────────

const VALID_OPS = new Set(["tile_info", "nearby", "entity_info", "find"]);
const VALID_FIND_TYPES = new Set([
  "hyperstructure", "mine", "village", "chest",
  "enemy_army", "enemy_structure", "own_army", "own_structure",
]);

// ── Tool ──────────────────────────────────────────────────────────────

/**
 * Create the map_query agent tool.
 *
 * @param mapCtx - Map context holding the protocol instance, updated each refresh.
 * @returns An AgentTool exposing structured map queries: tile_info, nearby, entity_info, find.
 */
export function createMapQueryTool(mapCtx: MapContext): AgentTool<any> {
  return {
    name: "map_query",
    label: "Map Query",
    description:
      "Query the game map for structured information. One tool, multiple operations:\n" +
      "\n" +
      "  tile_info(x, y)                    — What's at this position? Biome, occupier, strength.\n" +
      "  nearby(x, y, radius?)              — What's around here? Grouped: your armies, enemies, structures, chests. Default radius 5.\n" +
      "  entity_info(entity_id)             — Full details on an entity: troops, stamina, guards, level.\n" +
      "  find(type, ref_x?, ref_y?)         — Find all entities of a type. Types: hyperstructure, mine, village, chest, enemy_army, enemy_structure, own_army, own_structure. Sorted by distance from ref position if given.\n" +
      "\n" +
      "Coordinates are world hex (x,y) — use positions from the tick briefing or from previous query results.\n" +
      "Threats and opportunities are pushed automatically each tick — no need to query for those.",
    parameters: Type.Object({
      operation: Type.Union(
        [
          Type.Literal("tile_info"),
          Type.Literal("nearby"),
          Type.Literal("entity_info"),
          Type.Literal("find"),
        ],
        { description: "Which query to run" },
      ),
      x: Type.Optional(Type.Number({ description: "World hex X coordinate (for tile_info, nearby, find ref)" })),
      y: Type.Optional(Type.Number({ description: "World hex Y coordinate (for tile_info, nearby, find ref)" })),
      entity_id: Type.Optional(Type.Number({ description: "Entity ID (for entity_info)" })),
      radius: Type.Optional(Type.Number({ description: "Search radius in hexes (for nearby, default 5)" })),
      type: Type.Optional(
        Type.Union(
          [
            Type.Literal("hyperstructure"),
            Type.Literal("mine"),
            Type.Literal("village"),
            Type.Literal("chest"),
            Type.Literal("enemy_army"),
            Type.Literal("enemy_structure"),
            Type.Literal("own_army"),
            Type.Literal("own_structure"),
          ],
          { description: "Target type (for find)" },
        ),
      ),
    }),
    async execute(_toolCallId, params) {
      if (!mapCtx.protocol) {
        throw new Error("Map not loaded yet. Wait for the next tick.");
      }

      const { operation } = params;

      switch (operation) {
        case "tile_info": {
          if (params.x == null || params.y == null) {
            throw new Error("tile_info requires x and y coordinates.");
          }
          const result = await mapCtx.protocol.tileInfo(params.x, params.y);
          return {
            content: [{ type: "text" as const, text: formatTileInfo(result) }],
            details: result,
          };
        }

        case "nearby": {
          if (params.x == null || params.y == null) {
            throw new Error("nearby requires x and y coordinates.");
          }
          const result = await mapCtx.protocol.nearby(params.x, params.y, params.radius ?? 5);
          return {
            content: [{ type: "text" as const, text: formatNearby(result) }],
            details: result,
          };
        }

        case "entity_info": {
          if (params.entity_id == null) {
            throw new Error("entity_info requires entity_id.");
          }
          const result = await mapCtx.protocol.entityInfo(params.entity_id);
          if (!result) {
            throw new Error(`Entity ${params.entity_id} not found on any explored tile.`);
          }
          return {
            content: [{ type: "text" as const, text: formatEntityInfo(result) }],
            details: result,
          };
        }

        case "find": {
          if (!params.type) {
            throw new Error(`find requires type. Options: ${[...VALID_FIND_TYPES].join(", ")}`);
          }
          const ref = params.x != null && params.y != null ? { x: params.x, y: params.y } : undefined;
          const results = await mapCtx.protocol.find(params.type as FindTargetType, ref);
          return {
            content: [{ type: "text" as const, text: formatFind(results, params.type) }],
            details: results,
          };
        }

        default:
          throw new Error(`Unknown operation "${operation}". Options: ${[...VALID_OPS].join(", ")}`);
      }
    },
  };
}
