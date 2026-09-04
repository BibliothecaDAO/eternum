import { ActionPaths, ActionType, Position } from "@bibliothecadao/eternum";
import { getNeighborHexes } from "@bibliothecadao/types";
import type { ActionPath } from "@bibliothecadao/eternum";
import type { ExplorationStrategy, ExplorationStrategyContext } from "../types";

const getPathStaminaCost = (path: ActionPath[]): number =>
  path.reduce((total, step) => total + (step.staminaCost ?? 0), 0);

const comparePaths = (a: ActionPath[], b: ActionPath[]) => {
  const costA = getPathStaminaCost(a);
  const costB = getPathStaminaCost(b);
  if (costA !== costB) return costA - costB;
  if (a.length !== b.length) return a.length - b.length;
  const endA = a[a.length - 1].hex;
  const endB = b[b.length - 1].hex;
  if (endA.col !== endB.col) return endA.col - endB.col;
  return endA.row - endB.row;
};

const isFrontierTile = (context: ExplorationStrategyContext, target: { col: number; row: number }) => {
  const neighbors = getNeighborHexes(target.col, target.row);
  for (const neighbor of neighbors) {
    const normalized = new Position({ x: neighbor.col, y: neighbor.row }).getNormalized();
    const explored = context.exploredTiles.get(normalized.x)?.has(normalized.y) ?? false;
    if (!explored) {
      return true;
    }
  }
  return false;
};

export const basicFrontierStrategy: ExplorationStrategy = {
  id: "basic-frontier",
  label: "Basic frontier",
  selectNextAction: (context) => {
    const paths = Array.from(context.actionPaths.values());
    if (!paths.length) return null;

    const explorePaths = paths.filter((path) => ActionPaths.getActionType(path) === ActionType.Explore);
    explorePaths.sort(comparePaths);
    if (explorePaths.length > 0) {
      return { path: explorePaths[0], reason: "explore" };
    }

    const movePaths = paths.filter((path) => ActionPaths.getActionType(path) === ActionType.Move);
    if (!movePaths.length) return null;

    const frontierMoves = movePaths.filter((path) => {
      const end = path[path.length - 1].hex;
      return isFrontierTile(context, end);
    });

    const candidates = frontierMoves.length > 0 ? frontierMoves : movePaths;
    candidates.sort(comparePaths);
    return { path: candidates[0], reason: frontierMoves.length > 0 ? "frontier-move" : "move" };
  },
};
