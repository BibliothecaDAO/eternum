import { expect, it } from "vitest";
import { planProductionRun, type ProductionRecipe } from "./production-run";

/** The chain's output for some cycles: every cycle's, plus the bonus on the total rounded down (refill_output). */
const chainOutput = (recipe: ProductionRecipe, cycles: bigint) => {
  const output = recipe.outputUnits * cycles;
  return output + (output * recipe.bonusPercent) / 10_000n;
};

it("asks for the fewest cycles the chain's rounded output reaches, at every output, bonus and wanted amount", () => {
  for (const outputUnits of [1n, 3n, 7n, 10n]) {
    for (const bonusPercent of [0n, 1n, 1_500n, 3_333n, 9_999n]) {
      const recipe = { inputs: [{ resource: 1, units: 1n }], outputUnits, bonusPercent };
      for (let wanted = 1n; wanted <= 60n; wanted += 1n) {
        let fewest = 1n;
        while (chainOutput(recipe, fewest) < wanted) fewest += 1n;
        // The amount is read in whole resource units; 1e-9 of a unit is one chain unit.
        const run = planProductionRun(recipe, { by: "output", amount: Number(wanted) / 1e9 }, {});
        expect(run.cycles, `${outputUnits} a cycle, +${bonusPercent}, ${wanted} wanted`).toBe(fewest);
      }
    }
  }
});
