import type { ActionPath } from "@bibliothecadao/eternum";
import { ActionPaths, ActionType } from "@bibliothecadao/eternum";

export const getPathStaminaCost = (path: ReadonlyArray<{ staminaCost?: number }>): number =>
  path.reduce((total, step) => total + (step.staminaCost ?? 0), 0);

export const computeEffectiveStaminaCost = (
  path: ReadonlyArray<{ staminaCost?: number }>,
  actionType: ActionType | undefined,
  exploreStaminaCost: number,
): number => {
  const pathCost = getPathStaminaCost(path);
  if (pathCost > 0) return pathCost;
  if (actionType !== ActionType.Explore) return pathCost;
  return exploreStaminaCost;
};

export const shouldRepeatExplore = (
  actionType: ActionType | undefined,
  remainingStamina: number,
  exploreStaminaCost: number,
): boolean => actionType === ActionType.Explore && remainingStamina >= exploreStaminaCost;

export const normalizeExplorationNextRunAt = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const selectDueEntries = <T extends { nextRunAt?: number | null | undefined }>(
  entries: readonly T[],
  nowMs: number,
): T[] =>
  entries.filter((entry) => {
    const nextRunAt = normalizeExplorationNextRunAt(entry.nextRunAt);
    if (nextRunAt === null) return true;
    return nextRunAt <= nowMs;
  });

export const filterFreshExplorationPaths = (
  actionPathMap: Map<string, ActionPath[]>,
  recentlyExplored: Set<string>,
  normalizeHex: (hex: { col: number; row: number }) => { x: number; y: number },
): Map<string, ActionPath[]> => {
  const filtered = new Map<string, ActionPath[]>();
  actionPathMap.forEach((path, key) => {
    if (ActionPaths.getActionType(path) !== ActionType.Explore) return;
    const endHex = path[path.length - 1]?.hex;
    if (!endHex) return;
    const normalized = normalizeHex(endHex);
    if (recentlyExplored.has(`${normalized.x},${normalized.y}`)) return;
    filtered.set(key, path);
  });
  return filtered;
};
