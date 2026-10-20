import { RESOURCE_PRECISION } from "@bibliothecadao/types";

/**
 * A recipe as the chain runs it, in its integer resource units: what each cycle burns, what it makes, and the realm's
 * active bonus on that output in ten-thousandths (0 when none is running).
 */
export interface ProductionRecipe {
  inputs: readonly { resource: number; units: bigint }[];
  outputUnits: bigint;
  bonusPercent: bigint;
}

/** What sizes a run: the output typed, an input's budget typed, or Max (the most whole cycles the holdings cover). */
export type RunSizing =
  | { by: "output"; amount: number }
  | { by: "input"; resource: number; amount: number }
  | { by: "max" };

/** A manual production order: its whole cycles, what they burn and what they make, in resource units. */
export interface ProductionRun {
  cycles: bigint;
  outputUnits: bigint;
  inputs: { resource: number; units: bigint }[];
}

const BONUS_SCALE = 10_000n;

/** An amount a player typed, in resource units: the precision every balance and charge settles to. */
const toUnits = (amount: number): bigint => BigInt(Math.round(amount * RESOURCE_PRECISION));
/** Resource units as the amount a player reads. */
export const fromUnits = (units: bigint): number => Number(units) / RESOURCE_PRECISION;

/** The output a run makes: every cycle's, plus the bonus on the total, rounded down as refill_output's percentage. */
const bonusOutput = (recipe: ProductionRecipe, cycles: bigint): bigint => {
  const output = recipe.outputUnits * cycles;
  return output + (output * recipe.bonusPercent) / BONUS_SCALE;
};

const runOf = (recipe: ProductionRecipe, cycles: bigint): ProductionRun => ({
  cycles,
  outputUnits: bonusOutput(recipe, cycles),
  inputs: recipe.inputs.map(({ resource, units }) => ({ resource, units: units * cycles })),
});

/**
 * The fewest whole cycles whose output reaches the wanted amount: the chain runs whole cycles only. The output with its
 * bonus is the exact product rounded down to a unit, and the wanted amount is whole units, so the exact quotient's
 * ceiling is already the answer.
 */
const cyclesForOutput = (recipe: ProductionRecipe, wanted: bigint): bigint => {
  if (wanted <= 0n) return 0n;
  const perCycle = recipe.outputUnits * (BONUS_SCALE + recipe.bonusPercent);
  return (wanted * BONUS_SCALE + perCycle - 1n) / perCycle;
};

/** The whole cycles a budget of one input pays for; none when the recipe does not burn it. */
const cyclesForBudget = (recipe: ProductionRecipe, resource: number, budget: bigint): bigint => {
  const input = recipe.inputs.find((each) => each.resource === resource);
  return input && budget > 0n ? budget / input.units : 0n;
};

/** The most whole cycles the balances cover; an unknown balance covers none. */
const maxCycles = (recipe: ProductionRecipe, balances: Record<number, bigint>): bigint =>
  recipe.inputs.reduce<bigint | null>((most, { resource, units }) => {
    const covered = (balances[resource] ?? 0n) / units;
    return most === null || covered < most ? covered : most;
  }, null) ?? 0n;

/**
 * The run a sizing asks for. Asked by output, it is the fewest whole cycles that make at least that much (asking for 1
 * where a cycle makes 10 runs one cycle); by an input's budget, the whole cycles the budget pays for, and the burn
 * the run takes, which may be less than the budget; by Max, the most whole cycles the balances cover.
 */
export const planProductionRun = (
  recipe: ProductionRecipe,
  sizing: RunSizing,
  balances: Record<number, bigint>,
): ProductionRun => {
  if (sizing.by === "max") return runOf(recipe, maxCycles(recipe, balances));
  if (sizing.by === "input") return runOf(recipe, cyclesForBudget(recipe, sizing.resource, toUnits(sizing.amount)));
  return runOf(recipe, cyclesForOutput(recipe, toUnits(sizing.amount)));
};

/** Whether the realm holds every input the run burns, unit for unit as the chain spends them. */
export const coversRun = (run: ProductionRun, balances: Record<number, bigint>): boolean =>
  run.inputs.every(({ resource, units }) => balances[resource] !== undefined && units <= balances[resource]);

/** One cycle's burn of an input: the least budget that runs anything. */
export const oneCycleOf = (recipe: ProductionRecipe, resource: number): bigint =>
  recipe.inputs.find((each) => each.resource === resource)?.units ?? 0n;
