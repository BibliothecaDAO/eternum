/**
 * Core logic for the `move_army` tool.
 *
 * Pathfinds from the explorer's current position to a target using native
 * offset-hex A*, splits the route into travel/explore segments, executes
 * each via the provider, and reports the result. Handles occupied targets
 * (pathfinds to adjacent), stamina truncation, and partial progress.
 *
 * Framework-agnostic — both the MCP server and PI agent call this with
 * a {@link ToolContext}.
 */

import type { ToolContext } from "./context.js";
import { toContractX, toContractY, toDisplayX, toDisplayY } from "./context.js";
import { findPathNative, gridIndexFromSnapshot, type GridIndex, type PathResult } from "../../world/pathfinding_v2.js";
import { getNeighborHexes, packTileSeed } from "@bibliothecadao/types";
import { projectExplorerStamina } from "../../world/stamina.js";
import { addressesEqual, extractTxError } from "./tx-context.js";

// ── Input / Result Types ─────────────────────────────────────────────

/** Input for the move_army tool (display coordinates). */
export interface MoveArmyInput {
  /** Entity ID of the army to move. */
  armyId: number;
  /** Target X in display coordinates. */
  targetX: number;
  /** Target Y in display coordinates. */
  targetY: number;
}

/** Result returned by {@link moveArmy}. */
export interface MoveArmyResult {
  /** Whether the move completed (fully or partially). */
  success: boolean;
  /** Human-readable summary of what happened. */
  message: string;
  /** Final position of the army in display coordinates, or null on total failure. */
  endPosition: { x: number; y: number } | null;
  /** Number of tiles explored during the move. */
  exploreCount: number;
  /** Number of tiles traveled (already explored) during the move. */
  travelCount: number;
  /** True if the army stopped before reaching the target (stamina, error). */
  stoppedEarly: boolean;
}

// ── Core Function ────────────────────────────────────────────────────

/**
 * Move an army to a target position.
 *
 * 1. Look up the explorer, verify ownership, check stamina.
 * 2. Build a grid index from the snapshot and inject synthetic unexplored
 *    tiles via BFS so the pathfinder can route through fog-of-war.
 * 3. Use `findPathNative` for A* pathfinding with correct explore vs travel costs.
 * 4. Handle occupied targets by pathfinding to the best adjacent tile.
 * 5. Truncate the path if the stamina budget is exceeded.
 * 6. Execute movement segments (travel vs explore, with "already explored" fallback).
 * 7. Track explore/travel counts and handle partial progress on stamina exhaustion.
 *
 * @param input - Army ID and target display coordinates.
 * @param ctx - Shared tool context with client, provider, snapshot, config.
 * @returns Typed result with success flag, message, end position, and step counts.
 */
export async function moveArmy(
  input: MoveArmyInput,
  ctx: ToolContext,
): Promise<MoveArmyResult> {
  const { armyId, targetX: dispX, targetY: dispY } = input;

  // Convert display coords to raw contract coords for all internal operations
  const targetRawX = toContractX(dispX, ctx.mapCenter);
  const targetRawY = toContractY(dispY, ctx.mapCenter);

  // ── 1. Look up explorer, check ownership, check stamina ──

  const explorer = await ctx.client.view.explorerInfo(armyId);
  if (!explorer) {
    return fail(`Army ${armyId} not found.`);
  }
  if (!addressesEqual(explorer.ownerAddress ?? "", ctx.playerAddress)) {
    return fail(`Army ${armyId} is not yours.`);
  }

  const target = { x: targetRawX, y: targetRawY };
  const start = explorer.position;
  if (start.x === target.x && start.y === target.y) {
    return fail(`Already at (${dispX},${dispY}).`);
  }

  const projectedStamina = projectExplorerStamina(explorer, ctx.gameConfig.stamina);
  if (projectedStamina <= 0) {
    return fail(`No stamina (${projectedStamina}). Wait for regen.`);
  }

  // ── 2. Build grid index + inject synthetic unexplored tiles via BFS ──

  const snapshotGrid = ctx.snapshot.gridIndex;
  const syntheticTiles = new Map<string, number>(); // "x,y" → biome (1 = generic explored)

  // BFS outward from the explored frontier toward target
  {
    const explored = new Set<string>();
    for (const t of ctx.snapshot.tiles) {
      if (t.biome !== 0) explored.add(`${t.position.x},${t.position.y}`);
    }
    const maxDist = Math.abs(targetRawX - start.x) + Math.abs(targetRawY - start.y) + 5;
    const frontier = [...explored];
    for (let wave = 0; wave < maxDist && frontier.length > 0; wave++) {
      const next: string[] = [];
      for (const key of frontier) {
        const [fx, fy] = key.split(",").map(Number);
        for (const n of getNeighborHexes(fx, fy)) {
          const nk = `${n.col},${n.row}`;
          if (explored.has(nk) || syntheticTiles.has(nk)) continue;
          syntheticTiles.set(nk, 1);
          next.push(nk);
        }
      }
      frontier.length = 0;
      frontier.push(...next);
      if (syntheticTiles.has(`${targetRawX},${targetRawY}`)) break;
    }
  }

  // Wrap snapshot + synthetic tiles into a GridIndex
  const grid = gridIndexFromSnapshot(snapshotGrid);
  const augmentedGrid: GridIndex = {
    getBiome: (x: number, y: number) => {
      const b = grid.getBiome(x, y);
      if (b > 0) return b;
      return syntheticTiles.get(`${x},${y}`) ?? 0;
    },
    getOccupier: (x: number, y: number) => grid.getOccupier(x, y),
    has: (x: number, y: number) => grid.has(x, y) || syntheticTiles.has(`${x},${y}`),
    isSynthetic: (x: number, y: number) => syntheticTiles.has(`${x},${y}`),
  };

  // Unblock self position so the pathfinder doesn't treat us as an obstacle
  const gridForPath: GridIndex = {
    ...augmentedGrid,
    getOccupier: (x: number, y: number) => {
      if (x === start.x && y === start.y) return 0;
      return augmentedGrid.getOccupier(x, y);
    },
  };

  // ── 3. Build stamina config + pathfinding options ──

  const staminaConfig = {
    gainPerTick: ctx.gameConfig.stamina.gainPerTick,
    travelCost: ctx.gameConfig.stamina.travelCost,
    exploreCost: ctx.gameConfig.stamina.exploreCost,
    bonusValue: ctx.gameConfig.stamina.bonusValue,
    maxKnight: ctx.gameConfig.stamina.knightMaxStamina,
    maxPaladin: ctx.gameConfig.stamina.paladinMaxStamina,
    maxCrossbowman: ctx.gameConfig.stamina.crossbowmanMaxStamina,
  };

  const pathOptions = {
    troop: explorer.troopType as any,
    maxStamina: projectedStamina,
    staminaConfig,
  };

  // ── 4. Handle occupied targets — pathfind to adjacent instead ──

  const targetTile = snapshotGrid.get(`${targetRawX},${targetRawY}`);
  const targetIsOccupied = targetTile && targetTile.occupierType !== 0;

  let pathResult: PathResult | null = null;
  if (targetIsOccupied) {
    const neighbors = getNeighborHexes(targetRawX, targetRawY);
    for (const n of neighbors) {
      const adjKey = `${n.col},${n.row}`;
      const adjTile = snapshotGrid.get(adjKey);
      const inSynthetic = syntheticTiles.has(adjKey);
      if (!adjTile && !inSynthetic) continue;
      if (adjTile && adjTile.occupierType !== 0) continue;
      const candidate = findPathNative(start, { x: n.col, y: n.row }, gridForPath, pathOptions);
      if (candidate) {
        if (!pathResult || candidate.staminaCost < pathResult.staminaCost) pathResult = candidate;
      }
    }
    if (!pathResult) {
      return fail(`No path to any tile adjacent to (${dispX},${dispY}).`);
    }
  } else {
    pathResult = findPathNative(start, target, gridForPath, pathOptions);
  }

  if (!pathResult) {
    return fail(`No path to (${dispX},${dispY}).`);
  }

  // ── 5. Truncate path if stamina budget exceeded ──

  if (pathResult.reachedLimit && projectedStamina > 0) {
    let cost = 0;
    let truncateAt = 0;
    for (let i = 0; i < pathResult.directions.length; i++) {
      const stepPos = pathResult.path[i + 1];
      const stepKey = `${stepPos.x},${stepPos.y}`;
      const isExplore = !(snapshotGrid.get(stepKey)?.biome);
      const stepCost = isExplore
        ? (staminaConfig.exploreCost || 30)
        : (staminaConfig.travelCost || 20);
      if (cost + stepCost > projectedStamina) break;
      cost += stepCost;
      truncateAt = i + 1;
    }
    if (truncateAt === 0) {
      return fail(
        `Not enough stamina (${projectedStamina}) for even 1 step. Need ${staminaConfig.exploreCost || 30}.`,
      );
    }
    pathResult = {
      ...pathResult,
      path: pathResult.path.slice(0, truncateAt + 1),
      directions: pathResult.directions.slice(0, truncateAt),
      distance: truncateAt,
      staminaCost: cost,
      reachedLimit: true,
    };
  }

  // ── 6. Execute movement segments ──

  // Build explored set for segment splitting (travel vs explore)
  const explored = new Set<string>();
  for (const t of ctx.snapshot.tiles) {
    if (t.biome !== 0) explored.add(`${t.position.x},${t.position.y}`);
  }

  let exploreCount = 0;
  let travelCount = 0;
  let lastReachedIdx = 0; // index into pathResult.path of last confirmed position
  let stoppedEarly = false;
  let stopReason = "";

  let segStart = 0;
  while (segStart < pathResult.directions.length) {
    const nextPos = pathResult.path[segStart + 1];
    const nextKey = `${nextPos.x},${nextPos.y}`;
    const isUnexplored = !explored.has(nextKey);

    try {
      if (!isUnexplored) {
        // Batch consecutive travel steps into a single transaction
        let segEnd = segStart + 1;
        while (segEnd < pathResult.directions.length) {
          const futurePos = pathResult.path[segEnd + 1];
          if (!explored.has(`${futurePos.x},${futurePos.y}`)) break;
          segEnd++;
        }
        await ctx.provider.explorer_travel({
          explorer_id: armyId,
          directions: pathResult.directions.slice(segStart, segEnd),
          signer: ctx.signer,
        });
        travelCount += segEnd - segStart;
        lastReachedIdx = segEnd;
        segStart = segEnd;
      } else {
        // Explore a single unexplored tile
        const dir = pathResult.directions[segStart];
        const vrf_source_salt = packTileSeed({ alt: false, col: nextPos.x, row: nextPos.y });
        try {
          await ctx.provider.explorer_explore({
            explorer_id: armyId,
            directions: [dir],
            signer: ctx.signer,
            vrf_source_salt,
          });
          exploreCount++;
        } catch (err: any) {
          // Tile may already be explored (race with another explorer or stale snapshot)
          if (extractTxError(err).includes("already explored")) {
            await ctx.provider.explorer_travel({
              explorer_id: armyId,
              directions: [dir],
              signer: ctx.signer,
            });
            travelCount++;
          } else {
            throw err;
          }
        }
        lastReachedIdx = segStart + 1;
        segStart++;
      }
    } catch (err: any) {
      stoppedEarly = true;
      stopReason = extractTxError(err);
      break;
    }
  }

  // ── 7. Build result ──

  const totalSteps = exploreCount + travelCount;
  const endPos = pathResult.path[lastReachedIdx];
  const endDisplayX = toDisplayX(endPos.x, ctx.mapCenter);
  const endDisplayY = toDisplayY(endPos.y, ctx.mapCenter);

  const stepsDetail =
    exploreCount > 0 && travelCount > 0
      ? `${totalSteps} steps (${exploreCount} explored, ${travelCount} traveled)`
      : exploreCount > 0
        ? `${totalSteps} steps (all explored)`
        : `${totalSteps} steps (all traveled)`;

  if (totalSteps === 0 && stoppedEarly) {
    return {
      success: false,
      message: `Move failed: ${stopReason}`,
      endPosition: null,
      exploreCount: 0,
      travelCount: 0,
      stoppedEarly: true,
    };
  }

  let msg = `Moved ${stepsDetail} to (${endDisplayX},${endDisplayY}).`;
  if (stoppedEarly) {
    const remaining = pathResult.directions.length - lastReachedIdx;
    msg += ` Ran out of stamina — ${remaining} steps remaining to target.`;
  }

  return {
    success: true,
    message: msg,
    endPosition: { x: endDisplayX, y: endDisplayY },
    exploreCount,
    travelCount,
    stoppedEarly,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Shorthand for building a failure result. */
function fail(message: string): MoveArmyResult {
  return {
    success: false,
    message,
    endPosition: null,
    exploreCount: 0,
    travelCount: 0,
    stoppedEarly: false,
  };
}
