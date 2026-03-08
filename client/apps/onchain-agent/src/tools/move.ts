/**
 * move_army tool — move one of your explorers to a target tile.
 *
 * The agent points at its army (from_row:from_col) and the destination (to_row:to_col).
 * Uses A* pathfinding over explored tiles, converts to direction array,
 * and executes via the provider's explorer_travel.
 *
 * Output follows the "immediately actionable" principle:
 * - Did the move succeed?
 * - Where am I now?
 * - How much stamina do I have left?
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { EternumClient } from "@bibliothecadao/client";
import { packTileSeed } from "@bibliothecadao/types";
import type { GameConfig, StaminaConfig } from "@bibliothecadao/torii";
import type { MapContext } from "../map/context.js";
import { type TxContext, addressesEqual, extractTxError } from "./tx-context.js";
import { isExplorer } from "../world/occupier.js";
import { findPath, buildTileIndex } from "../world/pathfinding.js";

/**
 * Get stamina cost to travel into a tile based on biome and troop type.
 * Matches the game's configManager.getTravelStaminaCost logic.
 */
function tileTravelCost(biomeId: number, troopType: string, stamina: StaminaConfig): number {
  const base = stamina.travelCost;
  const bonus = stamina.bonusValue;
  const isPaladin = troopType === "Paladin";

  switch (biomeId) {
    case 1:
    case 2: // DeepOcean, Ocean
      return base - bonus;
    case 4: // Scorched
      return base + bonus;
    case 5:
    case 6:
    case 8:
    case 9:
    case 11:
    case 14: // Bare, Tundra, TempDesert, Shrubland, Grassland, SubtropDesert
      return isPaladin ? base - bonus : base;
    case 10:
    case 12:
    case 13:
    case 15:
    case 16: // Taiga, TempDecidForest, TempRainForest, TropSeasonForest, TropRainForest
      return isPaladin ? base + bonus : base;
    default: // Beach(3), Snow(7), None(0), unknown
      return base;
  }
}

export function createMoveTool(
  client: EternumClient,
  mapCtx: MapContext,
  playerAddress: string,
  tx: TxContext,
  gameConfig: GameConfig,
): AgentTool<any> {
  return {
    name: "move_army",
    label: "Move Army",
    description:
      "Move one of your armies to a target tile. Can move through explored tiles or explore into adjacent unexplored tiles. " +
      "Use your army's line:col from YOUR ENTITIES as from_row:from_col, and the destination as to_row:to_col. " +
      "Pathfinds automatically around obstacles. Exploring new tiles may yield rewards. " +
      "Returns: success/failure, new position, stamina remaining.",
    parameters: Type.Object({
      from_row: Type.Number({ description: "Line number of your army on the map" }),
      from_col: Type.Number({ description: "Column of your army on the map" }),
      to_row: Type.Number({ description: "Target line number on the map" }),
      to_col: Type.Number({ description: "Target column on the map" }),
    }),
    async execute(_toolCallId, params, signal) {
      const { from_row, from_col, to_row, to_col } = params;

      if (signal?.aborted) throw new Error("Operation cancelled");

      // Allow one automatic retry on stale-map "is occupied" errors
      const MAX_ATTEMPTS = 2;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        // ── Validate map ──

        if (!mapCtx.snapshot) {
          throw new Error(
            "Map not loaded yet. Wait for the next tick — the map is included automatically in each tick prompt.",
          );
        }

        const fromHex = mapCtx.snapshot.resolve(from_row, from_col);
        if (!fromHex) {
          throw new Error(
            `Invalid army position ${from_row}:${from_col}. Map is ${mapCtx.snapshot.rowCount} rows x ${mapCtx.snapshot.colCount} cols.`,
          );
        }

        const target = mapCtx.snapshot.resolve(to_row, to_col);
        if (!target) {
          throw new Error(
            `Invalid target position ${to_row}:${to_col}. Map is ${mapCtx.snapshot.rowCount} rows x ${mapCtx.snapshot.colCount} cols.`,
          );
        }

        // ── Find explorer at from position ──

        const fromTile = mapCtx.snapshot.tileAt(from_row, from_col);
        if (!fromTile || !isExplorer(fromTile.occupierType)) {
          throw new Error(`No army at ${from_row}:${from_col}. Point at one of your armies on the map.`);
        }

        const explorer = await client.view.explorerInfo(fromTile.occupierId);
        if (!explorer) {
          throw new Error(`Explorer ${fromTile.occupierId} not found.`);
        }

        // ── Verify ownership ──

        if (playerAddress && (!explorer.ownerAddress || !addressesEqual(explorer.ownerAddress, playerAddress))) {
          throw new Error(`Army at ${from_row}:${from_col} is not yours (owner: ${explorer.ownerAddress}).`);
        }

        // ── Already there? ──

        const start = explorer.position;
        if (start.x === target.x && start.y === target.y) {
          throw new Error(`Already at ${to_row}:${to_col}.`);
        }

        // ── Pathfind ──

        const { explored, blocked } = buildTileIndex(mapCtx.snapshot.tiles);
        blocked.delete(`${start.x},${start.y}`);

        // Merge in positions of armies that moved earlier this tick but
        // whose new positions aren't yet reflected in the Torii snapshot.
        if (mapCtx.recentlyMoved) {
          for (const key of mapCtx.recentlyMoved) {
            blocked.add(key);
          }
        }

        if (explorer.stamina <= 0) {
          throw new Error(`Cannot move — no stamina (${explorer.stamina}). Wait for regeneration.`);
        }

        // Build biome lookup so the pathfinder can weight edges by stamina cost
        const biomeIndex = new Map<string, number>();
        for (const t of mapCtx.snapshot.tiles) {
          biomeIndex.set(`${t.position.x},${t.position.y}`, t.biome);
        }

        const tileCost = (tileKey: string): number => {
          const biome = biomeIndex.get(tileKey) ?? 0;
          return tileTravelCost(biome, explorer.troopType, gameConfig.stamina);
        };

        let pathResult = findPath(start, target, explored, blocked, explorer.stamina, tileCost);

        if (!pathResult) {
          throw new Error(`No path to ${to_row}:${to_col}. Target may be blocked, unexplored, or unreachable.`);
        }

        // If path exceeds stamina, truncate to move as far as we can afford
        if (pathResult.reachedLimit) {
          let budget = explorer.stamina;
          let truncateAt = 0; // how many steps we can take
          for (let i = 1; i < pathResult.path.length; i++) {
            const key = `${pathResult.path[i].x},${pathResult.path[i].y}`;
            const cost = tileCost(key);
            if (budget < cost) break;
            budget -= cost;
            truncateAt = i;
          }
          if (truncateAt === 0) {
            throw new Error(`Cannot move — stamina too low (${explorer.stamina}) for even the cheapest adjacent tile.`);
          }
          pathResult = {
            path: pathResult.path.slice(0, truncateAt + 1),
            directions: pathResult.directions.slice(0, truncateAt),
            distance: truncateAt,
            staminaCost: explorer.stamina - budget,
            reachedLimit: false,
          };
        }

        const staminaCost = pathResult.staminaCost;
        const reachedTarget =
          pathResult.path[pathResult.path.length - 1].x === target.x &&
          pathResult.path[pathResult.path.length - 1].y === target.y;

        // ── Determine if this is a travel or explore move ──

        const endPos = pathResult.path[pathResult.path.length - 1];
        const endKey = `${endPos.x},${endPos.y}`;
        const isExploreMove = !explored.has(endKey);

        const staminaAfter = explorer.stamina - staminaCost;
        const movesAfter = Math.floor(staminaAfter / gameConfig.stamina.travelCost);

        try {
          if (isExploreMove) {
            // explorer_explore only supports 1 direction (the final step into unexplored).
            // If the path is longer than 1 step, travel first, then explore.
            if (pathResult.directions.length > 1) {
              const travelDirs = pathResult.directions.slice(0, -1);
              await tx.provider.explorer_travel({
                explorer_id: explorer.entityId,
                directions: travelDirs,
                signer: tx.signer,
              });
            }
            const exploreDirs = [pathResult.directions[pathResult.directions.length - 1]];
            const vrf_source_salt = packTileSeed({ alt: false, col: endPos.x, row: endPos.y });
            await tx.provider.explorer_explore({
              explorer_id: explorer.entityId,
              directions: exploreDirs,
              signer: tx.signer,
              vrf_source_salt,
            });
          } else {
            await tx.provider.explorer_travel({
              explorer_id: explorer.entityId,
              directions: pathResult.directions,
              signer: tx.signer,
            });
          }
        } catch (err: any) {
          const errStr = extractTxError(err);

          if (errStr.includes("not explored")) {
            throw new Error(
              `Path to ${to_row}:${to_col} crosses unexplored tiles. Try a shorter move to an adjacent explored tile.`,
            );
          }
          if (errStr.includes("is occupied")) {
            // Refresh map and retry once with fresh pathfinding
            try {
              await mapCtx.refresh?.();
            } catch {
              /* non-fatal */
            }
            if (attempt < MAX_ATTEMPTS) continue; // retry with fresh map
            throw new Error(
              `Path to ${to_row}:${to_col} is blocked by another entity. The map has been refreshed — try a different destination.`,
            );
          }
          throw new Error(`Move failed: ${errStr}`);
        }

        // Track the new position so subsequent pathfinding in this tick
        // knows this tile is now occupied (even before Torii indexes it).
        if (!mapCtx.recentlyMoved) mapCtx.recentlyMoved = new Set();
        mapCtx.recentlyMoved.add(`${endPos.x},${endPos.y}`);
        // Remove the old position — the army left that tile.
        mapCtx.recentlyMoved.delete(`${start.x},${start.y}`);

        // Refresh map so subsequent moves see the updated positions.
        // Await refresh so the next tool call in this tick gets fresh data.
        try {
          await mapCtx.refresh?.();
        } catch {
          // Non-fatal — stale map is better than crashing
        }

        const action = isExploreMove ? "Explored" : "Moved";
        const statusLine = reachedTarget
          ? `${action} ${pathResult.distance} steps to ${to_row}:${to_col}.`
          : `${action} ${pathResult.distance} steps toward ${to_row}:${to_col} (ran out of stamina — call move_army again next turn to continue).`;
        return {
          content: [
            {
              type: "text" as const,
              text: [statusLine, `Stamina: ${explorer.stamina} → ${staminaAfter} (${movesAfter} moves remaining)`].join(
                "\n",
              ),
            },
          ],
          details: {
            from: start,
            to: endPos,
            directions: pathResult.directions,
            distance: pathResult.distance,
            staminaCost,
            staminaAfter,
            explored: isExploreMove,
          },
        };
      }

      // Should never reach here, but TypeScript needs it
      throw new Error(`Move failed after ${MAX_ATTEMPTS} attempts.`);
    },
  };
}
