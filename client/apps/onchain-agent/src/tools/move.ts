/**
 * move_army tool — move one of your explorers to a target tile.
 *
 * Point at your army (from_row:from_col) and the destination (to_row:to_col).
 * Uses A* pathfinding over explored tiles, converts to a direction array,
 * and executes via the provider's explorer_travel.
 *
 * Output answers:
 * - Did the move succeed?
 * - Where am I now?
 * - How much stamina do I have left?
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { EternumClient, Position } from "@bibliothecadao/client";
import { packTileSeed, getNeighborOffsets } from "@bibliothecadao/types";
import type { GameConfig, StaminaConfig } from "@bibliothecadao/torii";
import type { MapContext } from "../map/context.js";
import { type TxContext, addressesEqual, extractTxError } from "./tx-context.js";
import { isExplorer, isStructure, isChest } from "../world/occupier.js";
import { findPath, buildTileIndex } from "../world/pathfinding.js";
import { projectExplorerStamina } from "../world/stamina.js";

/**
 * Return the stamina cost to travel into a tile, based on biome and troop type.
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

function describeOccupier(occupierType: number): string {
  if (isStructure(occupierType)) return "structure";
  if (isExplorer(occupierType)) return "army";
  if (isChest(occupierType)) return "chest";
  if (occupierType === 33) return "quest";
  if (occupierType === 35) return "spire";
  return "entity";
}

function describeAdjacent(
  pos: { x: number; y: number },
  tiles: Map<string, { occupierType: number; biome: number }>,
  explored: Set<string>,
): string {
  const offsets = getNeighborOffsets(pos.y);
  const counts = { unexplored: 0, empty: 0, structures: 0, armies: 0, chests: 0, other: 0 };

  for (const { i, j } of offsets) {
    const key = `${pos.x + i},${pos.y + j}`;
    if (!explored.has(key)) {
      counts.unexplored++;
      continue;
    }
    const t = tiles.get(key);
    if (!t || t.occupierType === 0) {
      counts.empty++;
      continue;
    }
    if (isStructure(t.occupierType)) counts.structures++;
    else if (isExplorer(t.occupierType)) counts.armies++;
    else if (isChest(t.occupierType)) counts.chests++;
    else counts.other++;
  }

  const parts: string[] = [];
  if (counts.unexplored > 0) parts.push(`${counts.unexplored} unexplored`);
  if (counts.structures > 0) parts.push(`${counts.structures} structures`);
  if (counts.armies > 0) parts.push(`${counts.armies} armies`);
  if (counts.chests > 0) parts.push(`${counts.chests} chests`);
  if (counts.empty > 0) parts.push(`${counts.empty} empty`);
  if (counts.other > 0) parts.push(`${counts.other} other`);
  return parts.length > 0 ? `Adjacent: ${parts.join(", ")}` : "Adjacent: nothing visible";
}

/**
 * Create the move_army agent tool.
 *
 * @param client - Eternum client for fetching explorer data.
 * @param mapCtx - Map context holding the tile snapshot, stamina tracking, and recently-moved state.
 * @param playerAddress - Hex address of the player; used to verify army ownership.
 * @param tx - Transaction context with the provider and signer.
 * @param gameConfig - Game config including stamina costs and explore cost.
 * @returns An AgentTool that moves an explorer army along an A*-computed path, exploring new tiles as needed.
 */
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
      "If the target is occupied (structure, army, chest), automatically stops 1 hex away. " +
      "Use your army's line:col from YOUR ENTITIES as army_row:army_col, and the destination as target_row:target_col. " +
      "Pathfinds automatically around obstacles. Exploring new tiles may yield rewards. " +
      "Returns: success/failure, new position, stamina remaining, adjacent tiles.",
    parameters: Type.Object({
      army_row: Type.Number({ description: "Line number of your army on the map" }),
      army_col: Type.Number({ description: "Column of your army on the map" }),
      target_row: Type.Number({ description: "Target line number on the map" }),
      target_col: Type.Number({ description: "Target column on the map" }),
    }),
    async execute(_toolCallId, params, signal) {
      const { army_row: from_row, army_col: from_col, target_row: to_row, target_col: to_col } = params;

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

        let fromTile = mapCtx.snapshot.tileAt(from_row, from_col);
        let explorerId: number | undefined;

        // Check snapshot first
        if (fromTile && isExplorer(fromTile.occupierType)) {
          explorerId = fromTile.occupierId;
        }

        // Fallback: check recentlyMoved — the army may have been moved here
        // but Torii hasn't indexed it yet, so the snapshot still shows the old position.
        if (!explorerId && mapCtx.recentlyMoved) {
          const worldCoords = mapCtx.snapshot.resolve(from_row, from_col);
          if (worldCoords) {
            const key = `${worldCoords.x},${worldCoords.y}`;
            const movedEntityId = mapCtx.recentlyMoved.get(key);
            if (movedEntityId) explorerId = movedEntityId;
          }
        }

        if (!explorerId) {
          throw new Error(`No army at ${from_row}:${from_col}. Point at one of your armies on the map.`);
        }

        const explorer = await client.view.explorerInfo(explorerId);
        if (!explorer) {
          throw new Error(`Explorer ${explorerId} not found.`);
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

        // Merge in positions of armies that moved recently but
        // whose new positions aren't yet reflected in the Torii snapshot.
        if (mapCtx.recentlyMoved) {
          for (const [key] of mapCtx.recentlyMoved) {
            blocked.add(key);
          }
        }

        // Merge in tiles explored recently but not yet in Torii's snapshot.
        // This prevents explorer_explore on tiles we already explored this tick.
        if (mapCtx.recentlyExplored) {
          for (const key of mapCtx.recentlyExplored) {
            explored.add(key);
          }
        }

        // Project stamina forward, then subtract any stamina already spent
        // since the last on-chain update (before Torii indexes the new tx).
        const baseProjected = projectExplorerStamina(explorer, gameConfig.stamina);
        const tracked = mapCtx.staminaSpent?.get(explorer.entityId);
        // If Torii has indexed a newer tick, our tracked spend is stale — discard it.
        const alreadySpent = tracked && tracked.atTick === explorer.staminaUpdatedTick ? tracked.spent : 0;
        const projectedStamina = Math.max(0, baseProjected - alreadySpent);

        if (projectedStamina <= 0) {
          throw new Error(`Cannot move — no stamina (${projectedStamina}). Wait for regeneration.`);
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

        let pathResult = findPath(
          start,
          target,
          explored,
          blocked,
          projectedStamina,
          tileCost,
          gameConfig.stamina.exploreCost,
        );

        if (!pathResult) {
          throw new Error(`No path to ${to_row}:${to_col}. Target may be blocked, unexplored, or unreachable.`);
        }

        // If destination is occupied, stop 1 hex before (can't move onto occupied tiles)
        const targetTile = mapCtx.snapshot.tileAt(to_row, to_col);
        const targetIsOccupied = targetTile && targetTile.occupierType !== 0;

        if (targetIsOccupied) {
          if (pathResult.path.length <= 2) {
            // Path is [start, target] — already adjacent, no move needed
            const occupier = describeOccupier(targetTile.occupierType);
            const actions = ["inspect_tile"];
            if (isStructure(targetTile.occupierType)) {
              actions.push(
                "attack_target (to capture)",
                "reinforce_army (if your army)",
                "defend_structure (if yours)",
              );
            } else if (isExplorer(targetTile.occupierType)) {
              actions.push("attack_target", "reinforce_army (if yours, merges same type/tier)");
            } else if (isChest(targetTile.occupierType)) {
              actions.push("open_chest");
            }
            throw new Error(`Already adjacent to ${occupier} at ${to_row}:${to_col}. You can: ${actions.join(", ")}.`);
          }

          // Trim the last step — stop adjacent to the target
          const trimmedPath = pathResult.path.slice(0, -1);
          const trimmedDirs = pathResult.directions.slice(0, -1);

          let trimmedCost = 0;
          for (let i = 1; i < trimmedPath.length; i++) {
            const key = `${trimmedPath[i].x},${trimmedPath[i].y}`;
            trimmedCost += tileCost(key);
          }

          pathResult = {
            path: trimmedPath,
            directions: trimmedDirs,
            distance: trimmedDirs.length,
            staminaCost: trimmedCost,
            reachedLimit: false,
          };
        }

        // If path exceeds stamina, truncate to move as far as we can afford
        if (pathResult.reachedLimit) {
          let budget = projectedStamina;
          let truncateAt = 0; // how many steps we can take
          for (let i = 1; i < pathResult.path.length; i++) {
            const key = `${pathResult.path[i].x},${pathResult.path[i].y}`;
            // Final step into unexplored tile costs exploreCost, not travel cost
            const isExploreStep = i === pathResult.path.length - 1 && !explored.has(key);
            const cost = isExploreStep ? gameConfig.stamina.exploreCost : tileCost(key);
            if (budget < cost) break;
            budget -= cost;
            truncateAt = i;
          }
          if (truncateAt === 0) {
            throw new Error(`Cannot move — stamina too low (${projectedStamina}) for even the cheapest adjacent tile.`);
          }
          pathResult = {
            path: pathResult.path.slice(0, truncateAt + 1),
            directions: pathResult.directions.slice(0, truncateAt),
            distance: truncateAt,
            staminaCost: projectedStamina - budget,
            reachedLimit: false,
          };
        }

        const endPos = pathResult.path[pathResult.path.length - 1];
        // Compute total stamina cost (pathfinder already uses correct explore cost)
        const staminaCost = pathResult.staminaCost;
        const reachedTarget = endPos.x === target.x && endPos.y === target.y;
        const staminaAfter = projectedStamina - staminaCost;
        const movesAfter = Math.floor(staminaAfter / gameConfig.stamina.travelCost);

        // Split path into segments: runs of explored tiles (travel) and
        // individual unexplored tiles (explore one at a time).
        // Also track which tiles we explored for context updates.
        const exploredTiles: Position[] = [];

        try {
          let segStart = 0;
          while (segStart < pathResult.directions.length) {
            // Find the next unexplored step
            const nextStepPos = pathResult.path[segStart + 1];
            const nextStepKey = `${nextStepPos.x},${nextStepPos.y}`;
            const nextIsUnexplored = !explored.has(nextStepKey) && !mapCtx.recentlyExplored?.has(nextStepKey);

            if (!nextIsUnexplored) {
              // Collect consecutive explored steps into one travel call
              let segEnd = segStart + 1;
              while (segEnd < pathResult.directions.length) {
                const futurePos = pathResult.path[segEnd + 1];
                const futureKey = `${futurePos.x},${futurePos.y}`;
                if (!explored.has(futureKey) && !mapCtx.recentlyExplored?.has(futureKey)) break;
                segEnd++;
              }
              const travelDirs = pathResult.directions.slice(segStart, segEnd);
              await tx.provider.explorer_travel({
                explorer_id: explorer.entityId,
                directions: travelDirs,
                signer: tx.signer,
              });
              segStart = segEnd;
            } else {
              // Single explore step
              const exploreDir = pathResult.directions[segStart];
              const explorePos = pathResult.path[segStart + 1];
              const vrf_source_salt = packTileSeed({ alt: false, col: explorePos.x, row: explorePos.y });
              try {
                await tx.provider.explorer_explore({
                  explorer_id: explorer.entityId,
                  directions: [exploreDir],
                  signer: tx.signer,
                  vrf_source_salt,
                });
              } catch (err: any) {
                const errStr = extractTxError(err);
                if (errStr.includes("already explored")) {
                  // Another player explored it — retry as travel
                  await tx.provider.explorer_travel({
                    explorer_id: explorer.entityId,
                    directions: [exploreDir],
                    signer: tx.signer,
                  });
                } else {
                  throw err;
                }
              }
              exploredTiles.push(explorePos);
              // Mark as explored so subsequent segments treat it as travel
              if (!mapCtx.recentlyExplored) mapCtx.recentlyExplored = new Set();
              mapCtx.recentlyExplored.add(`${explorePos.x},${explorePos.y}`);
              segStart++;
            }
          }
        } catch (err: any) {
          // Extract error details from WASM JsControllerError objects
          try {
            const errData = typeof err?.data === "function" ? err.data() : err?.data;
            const errMsg = typeof err?.message === "function" ? err.message() : err?.message;
            const errCode = typeof err?.code === "function" ? err.code() : err?.code;
            if (errData) console.error(`[MOVE] data: ${typeof errData === "string" ? errData : JSON.stringify(errData).slice(0, 500)}`);
            console.error(`[MOVE] code=${errCode} msg=${errMsg}`);
          } catch { /* */ }
          const errStr = extractTxError(err);
          if (errStr.includes("is occupied")) {
            try {
              await mapCtx.refresh?.();
            } catch {
              /* non-fatal */
            }
            if (attempt < MAX_ATTEMPTS) continue; // retry with fresh map
            throw new Error(
              `Path to ${to_row}:${to_col} is blocked by an entity. Map refreshed — try a different destination.`,
            );
          }
          throw new Error(`Move failed: ${errStr}`);
        }

        const isExploreMove = exploredTiles.length > 0;

        // Track the new position so subsequent pathfinding knows this tile
        // is occupied (even before Torii indexes it). Also remove the old
        // position — the army left that tile.
        if (!mapCtx.recentlyMoved) mapCtx.recentlyMoved = new Map();
        mapCtx.recentlyMoved.set(`${endPos.x},${endPos.y}`, explorer.entityId);
        mapCtx.recentlyMoved.delete(`${start.x},${start.y}`);

        // Track explored tiles so subsequent moves treat them as travel, not explore.
        for (const ep of exploredTiles) {
          if (!mapCtx.recentlyExplored) mapCtx.recentlyExplored = new Set();
          mapCtx.recentlyExplored.add(`${ep.x},${ep.y}`);
        }

        // Track stamina consumed so subsequent moves for this army see
        // accurate remaining stamina (before Torii indexes the tx).
        if (!mapCtx.staminaSpent) mapCtx.staminaSpent = new Map();
        mapCtx.staminaSpent.set(explorer.entityId, {
          spent: alreadySpent + staminaCost,
          atTick: explorer.staminaUpdatedTick,
        });

        // Don't refresh the map here — Torii hasn't indexed the move yet,
        // so a refresh would show the army at its OLD position and confuse
        // subsequent tool calls. The recentlyMoved tracking patches pathfinding,
        // and the background map loop (every 10s) will pick up the new position
        // once Torii has caught up.

        // Describe what's adjacent to the new position
        const gridLookup = new Map<string, { occupierType: number; biome: number }>();
        if (mapCtx.snapshot) {
          for (const t of mapCtx.snapshot.tiles) {
            gridLookup.set(`${t.position.x},${t.position.y}`, t);
          }
        }
        const adjacentInfo = mapCtx.snapshot ? describeAdjacent(endPos, gridLookup, explored) : "";

        const action = isExploreMove ? "Explored" : "Moved";
        let statusLine: string;
        if (targetIsOccupied) {
          const occType = targetTile!.occupierType;
          const occName = describeOccupier(occType);
          const nextActions = ["inspect_tile"];
          if (isStructure(occType))
            nextActions.push("attack_target", "reinforce_army (if your army)", "defend_structure (if yours)");
          else if (isExplorer(occType)) nextActions.push("attack_target", "reinforce_army (if yours)");
          else if (isChest(occType)) nextActions.push("open_chest");
          statusLine = `${action} ${pathResult.distance} steps to adjacent tile of ${occName} at ${to_row}:${to_col}. You can: ${nextActions.join(", ")}.`;
        } else if (reachedTarget) {
          statusLine = `${action} ${pathResult.distance} steps to ${to_row}:${to_col}.`;
        } else {
          statusLine = `${action} ${pathResult.distance} steps toward ${to_row}:${to_col} (ran out of stamina — call move_army again next turn to continue).`;
        }

        const responseLines = [
          statusLine,
          `Stamina: ${projectedStamina} → ${staminaAfter} (${movesAfter} moves remaining)`,
        ];
        if (adjacentInfo) responseLines.push(adjacentInfo);

        return {
          content: [
            {
              type: "text" as const,
              text: responseLines.join("\n"),
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
            stoppedAdjacentTo: targetIsOccupied ? describeOccupier(targetTile!.occupierType) : undefined,
          },
        };
      }

      // Should never reach here, but TypeScript needs it
      throw new Error(`Move failed after ${MAX_ATTEMPTS} attempts.`);
    },
  };
}
