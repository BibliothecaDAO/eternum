/** One cycle of a recipe: what it burns, and what it makes with the realm's bonus applied. */
export interface ProductionRecipe {
  inputs: readonly { resource: number; amount: number }[];
  outputPerCycle: number;
}

/** A manual production order as the chain runs it: whole cycles, what they burn and what they make. */
export interface ProductionRun {
  cycles: number;
  output: number;
  inputs: { resource: number; amount: number }[];
}

// A count of cycles read back from an amount that is a whole number of cycles can land a hair off the whole number in
// floating point (0.6 / 0.2 is 2.9999999999999996); this much is never a real fraction of a cycle.
const CYCLE_SLACK = 1e-9;

/**
 * The run asked for an output. The chain takes whole cycles only, so the run is the fewest cycles that make at least
 * what was asked: asking for 1 where a cycle makes 10 runs one cycle, makes 10 and burns one cycle's inputs, never
 * nothing.
 */
export const planProductionRun = (recipe: ProductionRecipe, requested: number): ProductionRun => {
  const cycles =
    requested > 0 && recipe.outputPerCycle > 0 ? Math.ceil(requested / recipe.outputPerCycle - CYCLE_SLACK) : 0;
  return {
    cycles,
    output: cycles * recipe.outputPerCycle,
    inputs: recipe.inputs.map(({ resource, amount }) => ({ resource, amount: amount * cycles })),
  };
};

/** The output of the most whole cycles the balances cover, and at least one cycle's, so Max always names a run. */
export const maxProductionOutput = (recipe: ProductionRecipe, balances: Record<number, number>): number => {
  const cycles = Math.min(
    ...recipe.inputs.map(({ resource, amount }) => Math.floor((balances[resource] ?? 0) / amount + CYCLE_SLACK)),
  );
  return Math.max(1, cycles) * recipe.outputPerCycle;
};

/** Whether the realm holds every input the run burns; an unknown balance covers nothing. */
export const coversRun = (run: ProductionRun, balances: Record<number, number>): boolean =>
  run.inputs.every(({ resource, amount }) => balances[resource] !== undefined && amount <= balances[resource]);
