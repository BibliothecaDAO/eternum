import { ActionType } from "@bibliothecadao/eternum";

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
