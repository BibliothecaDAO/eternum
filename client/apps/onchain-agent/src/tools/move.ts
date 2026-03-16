/**
 * move_army tool — move one of your explorers to a target tile.
 *
 * Takes an army entity ID and a target world hex coordinate.
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
import { findPath as findPathV2, buildH3TileIndex, travelStaminaCostById, type H3TileIndex, type FindPathOptions, type PathResult as PathResultV2 } from "../world/pathfinding_v2.js";
import { projectExplorerStamina } from "../world/stamina.js";
import { getNeighborHexes } from "@bibliothecadao/types";

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
      "Pathfinds automatically around obstacles. Exploring new tiles may yield rewards. " +
      "Returns: success/failure, new position (x,y), stamina remaining, adjacent tiles.",
    parameters: Type.Object({
      army_id: Type.Number({ description: "Entity ID of your army (from briefing or map_query)" }),
      target_x: Type.Number({ description: "Target world hex X coordinate" }),
      target_y: Type.Number({ description: "Target world hex Y coordinate" }),
    }),
    async execute(_toolCallId, params, signal) {
      const { army_id: armyId, target_x, target_y } = params;
      const target = { x: target_x, y: target_y };

      if (signal?.aborted) throw new Error("Operation cancelled");

      // Allow one automatic retry on stale-map "is occupied" errors
      const MAX_ATTEMPTS = 2;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        // ── Validate map ──

        if (!mapCtx.snapshot) {
          throw new Error("Map not loaded yet. Wait for the next tick.");
        }

        // ── Find explorer by entity ID ──

        const explorer = await client.view.explorerInfo(armyId);
        if (!explorer) {
          throw new Error(`Army ${armyId} not found.`);
        }

        // ── Verify ownership ──

        if (playerAddress && (!explorer.ownerAddress || !addressesEqual(explorer.ownerAddress, playerAddress))) {
          throw new Error(`Army ${armyId} is not yours (owner: ${explorer.ownerAddress}).`);
        }

        // ── Already there? ──

        const start = explorer.position;
        if (start.x === target.x && start.y === target.y) {
          throw new Error(`Already at (${target.x},${target.y}).`);
        }

        // ── Stamina ──

        const known = mapCtx.knownStamina?.get(explorer.entityId);
        const knownValid = known && (Date.now() - known.time) < 120_000;
        let projectedStamina: number;

        if (knownValid) {
          const elapsedSec = (Date.now() - known.time) / 1000;
          const armiesTickSec = gameConfig.stamina.armiesTickInSeconds || 1;
          const elapsedTicks = Math.floor(elapsedSec / armiesTickSec);
          const regen = elapsedTicks * gameConfig.stamina.gainPerTick;
          const baseMax = gameConfig.stamina.knightMaxStamina;
          projectedStamina = Math.min(known.stamina + regen, baseMax + 40);
        } else {
          const baseProjected = projectExplorerStamina(explorer, gameConfig.stamina);
          const tracked = mapCtx.staminaSpent?.get(explorer.entityId);
          const alreadySpent = tracked && tracked.atTick === explorer.staminaUpdatedTick ? tracked.spent : 0;
          projectedStamina = Math.max(0, baseProjected - alreadySpent);
        }

        if (projectedStamina <= 0) {
          throw new Error(`Cannot move — no stamina (${projectedStamina}). Wait for regeneration.`);
        }

        // ── Build H3 tile index ──

        // Start with snapshot tiles, then patch with recent context
        const tilesToIndex = [...mapCtx.snapshot.tiles];

        // Patch: mark recently moved army positions as occupied
        // (Torii may not have indexed these yet)
        if (mapCtx.recentlyMoved) {
          for (const [key, entityId] of mapCtx.recentlyMoved) {
            const [kx, ky] = key.split(",").map(Number);
            // Add a synthetic occupied tile if not already in the snapshot
            const existing = mapCtx.snapshot.gridIndex.get(key);
            if (!existing) {
              tilesToIndex.push({
                position: { x: kx, y: ky },
                biome: 0,
                occupierId: entityId,
                occupierType: 15, // explorer
                occupierIsStructure: false,
                rewardExtracted: false,
              });
            }
          }
        }

        const h3Index = buildH3TileIndex(tilesToIndex);

        // Remove the start tile from occupier index (the army is leaving)
        const startH3 = h3Index.keyToH3.get(`${start.x},${start.y}`);
        if (startH3) h3Index.h3ToOccupier.set(startH3, 0);

        // Explorer troopType is already a string matching TroopType enum values
        const troopEnum = explorer.troopType as any;

        const pathOptions: FindPathOptions = {
          troop: troopEnum,
          maxStamina: projectedStamina,
          staminaConfig: {
            gainPerTick: gameConfig.stamina.gainPerTick,
            travelCost: gameConfig.stamina.travelCost,
            exploreCost: gameConfig.stamina.exploreCost,
            bonusValue: gameConfig.stamina.bonusValue,
            maxKnight: gameConfig.stamina.knightMaxStamina,
            maxPaladin: gameConfig.stamina.paladinMaxStamina,
            maxCrossbowman: gameConfig.stamina.crossbowmanMaxStamina,
          },
        };

        // ── Pathfind ──

        // Check if target is occupied — if so, pathfind to best adjacent tile instead
        const targetTile = mapCtx.snapshot.gridIndex.get(`${target.x},${target.y}`) ?? null;
        const targetIsOccupied = targetTile && targetTile.occupierType !== 0;

        let pathResult: PathResultV2 | null = null;
        let actualTarget = target;

        if (targetIsOccupied) {
          // Check if already adjacent
          const neighbors = getNeighborHexes(target.x, target.y);
          const isAlreadyAdjacent = neighbors.some(n => n.col === start.x && n.row === start.y);

          if (isAlreadyAdjacent) {
            const occupier = describeOccupier(targetTile.occupierType);
            const actions = ["inspect_tile"];
            if (isStructure(targetTile.occupierType)) {
              actions.push("attack_target (to capture)", "reinforce_army (if your army)", "defend_structure (if yours)");
            } else if (isExplorer(targetTile.occupierType)) {
              actions.push("attack_target", "reinforce_army (if yours, merges same type/tier)");
            } else if (isChest(targetTile.occupierType)) {
              actions.push("open_chest");
            }
            throw new Error(`Already adjacent to ${occupier} at (${target.x},${target.y}). You can: ${actions.join(", ")}.`);
          }

          // Try each adjacent tile as a destination, pick the cheapest reachable one
          let bestPath: any = null;
          for (const n of neighbors) {
            const adjTarget = { x: n.col, y: n.row };
            const adjTile = mapCtx.snapshot.gridIndex.get(`${n.col},${n.row}`);
            // Adjacent tile must be explored and unoccupied
            if (!adjTile || adjTile.occupierType !== 0) continue;

            const candidate = findPathV2(start, adjTarget, h3Index, pathOptions);
            if (candidate && !candidate.reachedLimit) {
              if (!bestPath || candidate.staminaCost < bestPath.staminaCost) {
                bestPath = candidate;
                actualTarget = adjTarget;
              }
            }
          }

          pathResult = bestPath;
          if (!pathResult) {
            throw new Error(`No path to any tile adjacent to (${target.x},${target.y}). All approaches may be blocked.`);
          }
        } else {
          // Target is unoccupied — pathfind directly
          pathResult = findPathV2(start, target, h3Index, pathOptions);
        }

        if (!pathResult) {
          throw new Error(`No path to (${target.x},${target.y}). Target may be blocked, unexplored, or unreachable.`);
        }

        // If path exceeds stamina, truncate to move as far as we can afford
        if (pathResult.reachedLimit) {
          const config = pathOptions.staminaConfig!;
          let budget = projectedStamina;
          let truncateAt = 0;
          for (let i = 1; i < pathResult.path.length; i++) {
            const key = `${pathResult.path[i].x},${pathResult.path[i].y}`;
            const h3 = h3Index.keyToH3.get(key);
            const biomeId = h3 ? (h3Index.h3ToBiome.get(h3) ?? 0) : 0;
            const isExploredTile = biomeId !== 0;
            const cost = isExploredTile ? travelStaminaCostById(biomeId, troopEnum, config) : config.exploreCost;
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

        // Build explored set for segment splitting
        const explored = new Set<string>();
        for (const t of mapCtx.snapshot.tiles) {
          if (t.biome !== 0) explored.add(`${t.position.x},${t.position.y}`);
        }
        if (mapCtx.recentlyExplored) {
          for (const key of mapCtx.recentlyExplored) explored.add(key);
        }

        const endPos = pathResult.path[pathResult.path.length - 1];
        // Compute total stamina cost (pathfinder already uses correct explore cost)
        const staminaCost = pathResult.staminaCost;
        const reachedTarget = endPos.x === target.x && endPos.y === target.y;
        const staminaAfter = Math.max(0, projectedStamina - staminaCost);
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
            // Parse the execution_error for a clean message
            if (errData) {
              let parsed: any;
              try { parsed = typeof errData === "string" ? JSON.parse(errData) : errData; } catch { parsed = null; }
              const execErr = parsed?.execution_error ?? (typeof errData === "string" ? errData : "");
              if (typeof execErr === "string") {
                const reasons = [...execErr.matchAll(/"([^"]{10,})"/g)]
                  .map((m) => m[1])
                  .filter((r) => !r.startsWith("0x"));
                if (reasons.length > 0) {
                  // If stamina error, record actual stamina so we don't retry
                  const staminaMatch = reasons[0].match(/insufficient stamina.*have:\s*(\d+)/);
                  if (staminaMatch && explorer) {
                    const actualStamina = parseInt(staminaMatch[1], 10);
                    if (!mapCtx.knownStamina) mapCtx.knownStamina = new Map();
                    mapCtx.knownStamina.set(explorer.entityId, { stamina: actualStamina, time: Date.now() });
                  }
                  throw new Error(`Move failed: ${reasons[0]}`);
                }
              }
            }
          } catch (extractErr: any) {
            if (extractErr?.message?.startsWith("Move failed:")) throw extractErr;
          }
          const errStr = extractTxError(err);
          if (errStr.includes("is occupied")) {
            try {
              await mapCtx.refresh?.();
            } catch {
              /* non-fatal */
            }
            if (attempt < MAX_ATTEMPTS) continue; // retry with fresh map
            throw new Error(
              `Path to (${target.x},${target.y}) is blocked by an entity. Map refreshed — try a different destination.`,
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

        // Record actual remaining stamina after this move so subsequent
        // moves see the correct value (instead of Torii's stale projection).
        const staminaAfterMove = projectedStamina - staminaCost;
        if (!mapCtx.knownStamina) mapCtx.knownStamina = new Map();
        mapCtx.knownStamina.set(explorer.entityId, { stamina: Math.max(0, staminaAfterMove), time: Date.now() });

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
          statusLine = `${action} ${pathResult.distance} steps to adjacent tile of ${occName} at (${target.x},${target.y}). You can: ${nextActions.join(", ")}.`;
        } else if (reachedTarget) {
          statusLine = `${action} ${pathResult.distance} steps to (${target.x},${target.y}).`;
        } else {
          statusLine = `${action} ${pathResult.distance} steps toward (${target.x},${target.y}) (ran out of stamina — call move_army again next turn to continue).`;
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
