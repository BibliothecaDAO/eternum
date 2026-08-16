import { describe, expect, it, vi } from "vitest";

import { finalizeVisibleStructureModelPass } from "./structure-visible-pass-finalizer";

type CountableModel = {
  setCount: ReturnType<typeof vi.fn>;
};

describe("finalizeVisibleStructureModelPass", () => {
  it("hides stale models, hands off active model sets, applies bounds, and ends point batches", () => {
    const structureModelA: CountableModel = { setCount: vi.fn() };
    const structureModelB: CountableModel = { setCount: vi.fn() };
    const staleStructureModel: CountableModel = { setCount: vi.fn() };
    const staleCosmeticModel: CountableModel = { setCount: vi.fn() };
    const nextActiveStructureModels = new Set([structureModelA]);
    const nextActiveCosmeticStructureModels = new Set([structureModelB]);
    const applyPendingModelBounds = vi.fn();
    const endPointBatches = vi.fn();

    const result = finalizeVisibleStructureModelPass({
      modelInstanceCounts: new Map([
        [structureModelA, 4],
        [structureModelB, 2],
      ]),
      previouslyActiveStructureModels: new Set([structureModelA, staleStructureModel]),
      previouslyActiveCosmeticStructureModels: new Set([structureModelB, staleCosmeticModel]),
      nextActiveStructureModels,
      nextActiveCosmeticStructureModels,
      applyPendingModelBounds,
      endPointBatches,
    });

    expect(staleStructureModel.setCount).toHaveBeenCalledWith(0);
    expect(staleCosmeticModel.setCount).toHaveBeenCalledWith(0);
    expect(structureModelA.setCount).toHaveBeenCalledWith(4);
    expect(structureModelB.setCount).toHaveBeenCalledWith(2);
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
      previouslyActiveStructureModels: new Set<CountableModel>(),
      previouslyActiveCosmeticStructureModels: new Set<CountableModel>(),
      nextActiveStructureModels: new Set<CountableModel>([model]),
      nextActiveCosmeticStructureModels: new Set<CountableModel>(),
      applyPendingModelBounds,
    });

    expect(model.setCount).toHaveBeenCalledWith(1);
    expect(applyPendingModelBounds).toHaveBeenCalledTimes(1);
  });

  it("does not hide active models while removing stale ones", () => {
    const activeModel: CountableModel = { setCount: vi.fn() };
    const staleModel: CountableModel = { setCount: vi.fn() };

    finalizeVisibleStructureModelPass({
      modelInstanceCounts: new Map([[activeModel, 3]]),
      previouslyActiveStructureModels: new Set([activeModel, staleModel]),
      previouslyActiveCosmeticStructureModels: new Set<CountableModel>(),
      nextActiveStructureModels: new Set([activeModel]),
      nextActiveCosmeticStructureModels: new Set<CountableModel>(),
      applyPendingModelBounds: vi.fn(),
    });

    expect(activeModel.setCount).toHaveBeenCalledWith(3);
    expect(staleModel.setCount).toHaveBeenCalledWith(0);
  });
});
