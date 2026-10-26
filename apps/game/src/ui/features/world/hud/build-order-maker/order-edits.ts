import { BUILD_ORDER_LIMITS, type BuildOrder, type BuildOrderGoal } from "@bibliothecadao/eternum/automation";
import { REALM_LEVELS } from "@bibliothecadao/types";

/**
 * The maker's edits to an order, each giving a new order the language reads: steps stay rank by rank, a rank holds one
 * level up and Empire none, counts stay from 1 to 99 and an order at most 60 steps.
 */

/** Each step of a rank, with its place in the whole order. */
export const stepsOfRank = (order: BuildOrder, rank: number) =>
  order.steps.flatMap((step, index) => (step.rank === rank ? [{ step, index }] : []));

/** Whether a goal can be added to a rank now. */
export const canAdd = (order: BuildOrder, rank: number, goal: BuildOrderGoal): boolean =>
  order.steps.length < BUILD_ORDER_LIMITS.steps &&
  (goal !== "levelUp" ||
    (rank < REALM_LEVELS.length - 1 && !order.steps.some((step) => step.goal === "levelUp" && step.rank === rank)));

/**
 * A goal added at the end of its rank: one more than the most of it the order already asks for by then, so a farm
 * after "2 farm" asks for 3.
 */
export const addStep = (order: BuildOrder, rank: number, goal: BuildOrderGoal): BuildOrder => {
  if (!canAdd(order, rank, goal)) return order;
  const at = order.steps.findIndex((step) => step.rank > rank);
  const end = at === -1 ? order.steps.length : at;
  const before = order.steps.slice(0, end);
  const most = Math.max(0, ...before.filter((step) => step.goal === goal).map((step) => step.count));
  const count = goal === "levelUp" ? 1 : Math.min(most + 1, BUILD_ORDER_LIMITS.count);
  return { ...order, steps: [...before, { rank, goal, count }, ...order.steps.slice(end)] };
};

export const setCount = (order: BuildOrder, index: number, count: number): BuildOrder => ({
  ...order,
  steps: order.steps.map((step, at) =>
    at === index ? { ...step, count: Math.min(Math.max(Math.round(count), 1), BUILD_ORDER_LIMITS.count) } : step,
  ),
});

/** A step moved one place within its rank; at its rank's edge it stays. */
export const moveStep = (order: BuildOrder, index: number, by: -1 | 1): BuildOrder => {
  const other = index + by;
  if (order.steps[other]?.rank !== order.steps[index]?.rank) return order;
  const steps = [...order.steps];
  [steps[index], steps[other]] = [steps[other], steps[index]];
  return { ...order, steps };
};

export const removeStep = (order: BuildOrder, index: number): BuildOrder => ({
  ...order,
  steps: order.steps.filter((_, at) => at !== index),
});
