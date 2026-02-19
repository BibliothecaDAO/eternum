/**
 * Move executor — bridges agent intent to action execution.
 *
 * Agent says: "move explorer X to (col, row)"
 * This module: pathfinds → batches → executes each action sequentially.
 *
 * No opinions. No filtering. Computes path, executes it, reports results.
 */

import type { EternumClient } from "@bibliothecadao/client";
import type { Account } from "starknet";
import type { ActionResult } from "@bibliothecadao/game-agent";
import { findPath, type TileInfo, type PathResult, type ActionBatch } from "./pathfinder";
import { executeAction } from "./action-registry";
import type { EternumWorldState } from "./world-state";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MoveRequest {
  explorerId: number;
  targetCol: number;
  targetRow: number;
}

export interface MoveStepResult {
  batch: ActionBatch;
  result: ActionResult;
}

export interface MoveResult {
  /** Whether the full path was computed successfully. */
  pathFound: boolean;
  /** The computed path details. */
  pathResult: PathResult;
  /** Whether all actions executed successfully. */
  success: boolean;
  /** Per-batch execution results. */
  steps: MoveStepResult[];
  /** If execution stopped early, which step failed. */
  failedAtStep?: number;
  /** Human-readable summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

/**
 * Move an explorer to a target coordinate.
 *
 * 1. Finds the explorer's current position from world state
 * 2. Runs A* pathfinding
 * 3. Executes each action batch (travel/explore) sequentially
 * 4. Stops on first failure and reports where it stopped
 *
 * @param client - EternumClient for action execution
 * @param signer - Account for signing transactions
 * @param request - Move request with explorer ID and target
 * @param worldState - Current world state with tile map and entities
 * @returns MoveResult with full execution details
 */
export async function moveExplorer(
  client: EternumClient,
  signer: Account,
  request: MoveRequest,
  worldState: EternumWorldState,
): Promise<MoveResult> {
  // Find explorer's current position
  const explorer = worldState.entities.find(
    (e) => e.entityId === request.explorerId && e.type === "army",
  );

  if (!explorer) {
    return {
      pathFound: false,
      pathResult: { found: false, path: [], totalCost: Infinity, actionBatches: [] },
      success: false,
      steps: [],
      summary: `Explorer ${request.explorerId} not found in world state.`,
    };
  }

  const startCol = explorer.position.x;
  const startRow = explorer.position.y;

  // Run pathfinding
  const pathResult = findPath(
    startCol,
    startRow,
    request.targetCol,
    request.targetRow,
    worldState.tileMap,
  );

  if (!pathResult.found) {
    return {
      pathFound: false,
      pathResult,
      success: false,
      steps: [],
      summary: `No path found from (${startCol},${startRow}) to (${request.targetCol},${request.targetRow}).`,
    };
  }

  if (pathResult.actionBatches.length === 0) {
    return {
      pathFound: true,
      pathResult,
      success: true,
      steps: [],
      summary: `Explorer ${request.explorerId} is already at (${request.targetCol},${request.targetRow}).`,
    };
  }

  // Execute each action batch sequentially
  const steps: MoveStepResult[] = [];

  for (let i = 0; i < pathResult.actionBatches.length; i++) {
    const batch = pathResult.actionBatches[i];

    const actionType = batch.type === "travel" ? "travel_explorer" : "explore";
    const result = await executeAction(client, signer, {
      type: actionType,
      params: {
        explorerId: request.explorerId,
        directions: batch.directions,
      },
    });

    steps.push({ batch, result });

    if (!result.success) {
      return {
        pathFound: true,
        pathResult,
        success: false,
        steps,
        failedAtStep: i,
        summary:
          `Move failed at step ${i + 1}/${pathResult.actionBatches.length} ` +
          `(${actionType} [${batch.directions.join(",")}]): ${result.error}`,
      };
    }
  }

  const travelSteps = pathResult.actionBatches.filter((b) => b.type === "travel").length;
  const exploreSteps = pathResult.actionBatches.filter((b) => b.type === "explore").length;

  return {
    pathFound: true,
    pathResult,
    success: true,
    steps,
    summary:
      `Explorer ${request.explorerId} moved from (${startCol},${startRow}) to ` +
      `(${request.targetCol},${request.targetRow}) in ${pathResult.actionBatches.length} actions ` +
      `(${travelSteps} travel, ${exploreSteps} explore). Total cost: ${pathResult.totalCost}.`,
  };
}
