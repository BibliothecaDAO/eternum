import { describe, expect, it, vi } from "vitest";

import { finalizeVisibleStructureModelPass } from "./structure-visible-pass-finalizer";

type CountableModel = {
  setCount: ReturnType<typeof vi.fn>;
};

describe("finalizeVisibleStructureModelPass", () => {
  it("flushes model counts, hands off active model sets, applies bounds, and ends point batches", () => {
    const structureModelA: CountableModel = { setCount: vi.fn() };
    const structureModelB: CountableModel = { setCount: vi.fn() };
    const nextActiveStructureModels = new Set([structureModelA]);
    const nextActiveCosmeticStructureModels = new Set([structureModelB]);
    const applyPendingModelBounds = vi.fn();
    const endPointBatches = vi.fn();

    const result = finalizeVisibleStructureModelPass({
      modelInstanceCounts: new Map([
        [structureModelA, 3],
        [structureModelB, 7],
      ]),
      nextActiveStructureModels,
      nextActiveCosmeticStructureModels,
      applyPendingModelBounds,
      endPointBatches,
    });

    expect(structureModelA.setCount).toHaveBeenCalledWith(3);
    expect(structureModelB.setCount).toHaveBeenCalledWith(7);
    expect(applyPendingModelBounds).toHaveBeenCalledTimes(1);
    expect(endPointBatches).toHaveBeenCalledTimes(1);
    expect(result.activeStructureModels).toBe(nextActiveStructureModels);
    expect(result.activeCosmeticStructureModels).toBe(nextActiveCosmeticStructureModels);
  });

  it("skips point batch teardown when no callback is provided", () => {
    const model: CountableModel = { setCount: vi.fn() };
    const applyPendingModelBounds = vi.fn();

    finalizeVisibleStructureModelPass({
      modelInstanceCounts: new Map([[model, 1]]),
      nextActiveStructureModels: new Set([model]),
      nextActiveCosmeticStructureModels: new Set(),
      applyPendingModelBounds,
    });

    expect(model.setCount).toHaveBeenCalledWith(1);
    expect(applyPendingModelBounds).toHaveBeenCalledTimes(1);
  });
});
