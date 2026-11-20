import { expect, it } from "vitest";
import { planProductionRun, type ProductionRecipe } from "./production-run";

it("asks for the fewest cycles whose output reaches the wanted amount, at every output and wanted amount", () => {
  for (const outputUnits of [1n, 3n, 7n, 10n]) {
    const recipe: ProductionRecipe = { inputs: [{ resource: 1, units: 1n }], outputUnits };
    for (let wanted = 1n; wanted <= 60n; wanted += 1n) {
      let fewest = 1n;
      while (outputUnits * fewest < wanted) fewest += 1n;
      const run = planProductionRun(recipe, { by: "output", amount: Number(wanted) / 1e9 }, {});
      expect(run.cycles, `${outputUnits} a cycle, ${wanted} wanted`).toBe(fewest);
      expect(run.outputUnits).toBe(outputUnits * fewest);
    }
  }
});
