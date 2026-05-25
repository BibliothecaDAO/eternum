import { describe, expect, it, vi } from "vitest";

import {
  recordVisibleCosmeticStructureModelInstance,
  recordVisibleStructureModelInstance,
} from "./structure-visible-instance-binding";

type MockModel = {
  setMatrixAt: ReturnType<typeof vi.fn>;
};

describe("recordVisibleStructureModelInstance", () => {
  it("binds realm structures by level and records wonder ownership separately", () => {
    const stageModel: MockModel = { setMatrixAt: vi.fn() };
    const levelModel: MockModel = { setMatrixAt: vi.fn() };
    const spareModel: MockModel = { setMatrixAt: vi.fn() };
    const wonderModel: MockModel = { setMatrixAt: vi.fn() };
    const models = [stageModel, stageModel, levelModel, spareModel, wonderModel];
    const modelInstanceCounts = new Map<MockModel, number>([[wonderModel, 2]]);
    const activeModels = new Set<MockModel>();
    const entityIdMaps = new Map<string, Map<number, number>>();
    const wonderEntityIdMap = new Map<number, number>();

    recordVisibleStructureModelInstance({
      structure: { entityId: 7, stage: 0, level: 2, hasWonder: true },
      structureType: "Realm",
      isRealmStructure: true,
      models,
      wonderModelIndex: 4,
      matrix: "matrix",
      modelInstanceCounts,
      activeModels,
      entityIdMaps,
      wonderEntityIdMap,
    });

    expect(levelModel.setMatrixAt).toHaveBeenCalledWith(0, "matrix");
    expect(wonderModel.setMatrixAt).toHaveBeenCalledWith(2, "matrix");
    expect(modelInstanceCounts.get(levelModel)).toBe(1);
    expect(modelInstanceCounts.get(wonderModel)).toBe(3);
    expect(activeModels.has(levelModel)).toBe(true);
    expect(activeModels.has(wonderModel)).toBe(true);
    expect(entityIdMaps.get("Realm")?.get(0)).toBe(7);
    expect(wonderEntityIdMap.get(2)).toBe(7);
  });

  it("binds non-realm structures by stage without wonder bookkeeping", () => {
    const stageZeroModel: MockModel = { setMatrixAt: vi.fn() };
    const stageOneModel: MockModel = { setMatrixAt: vi.fn() };
    const modelInstanceCounts = new Map<MockModel, number>([[stageOneModel, 4]]);
    const activeModels = new Set<MockModel>();
    const entityIdMaps = new Map<string, Map<number, number>>();
    const wonderEntityIdMap = new Map<number, number>();

    recordVisibleStructureModelInstance({
      structure: { entityId: 12, stage: 1, level: 0, hasWonder: false },
      structureType: "Village",
      isRealmStructure: false,
      models: [stageZeroModel, stageOneModel],
      wonderModelIndex: 4,
      matrix: "matrix",
      modelInstanceCounts,
      activeModels,
      entityIdMaps,
      wonderEntityIdMap,
    });

    expect(stageOneModel.setMatrixAt).toHaveBeenCalledWith(4, "matrix");
    expect(modelInstanceCounts.get(stageOneModel)).toBe(5);
    expect(activeModels.has(stageOneModel)).toBe(true);
    expect(entityIdMaps.get("Village")?.get(4)).toBe(12);
    expect(wonderEntityIdMap.size).toBe(0);
  });
});

describe("recordVisibleCosmeticStructureModelInstance", () => {
  it("binds cosmetic structures to the cosmetic entity map", () => {
    const cosmeticModel: MockModel = { setMatrixAt: vi.fn() };
    const modelInstanceCounts = new Map<MockModel, number>([[cosmeticModel, 1]]);
    const activeModels = new Set<MockModel>();
    const cosmeticEntityIdMaps = new Map<string, Map<number, number>>();

    recordVisibleCosmeticStructureModelInstance({
      cosmeticId: "gold",
      entityId: 99,
      models: [cosmeticModel],
      matrix: "matrix",
      modelInstanceCounts,
      activeModels,
      cosmeticEntityIdMaps,
    });

    expect(cosmeticModel.setMatrixAt).toHaveBeenCalledWith(1, "matrix");
    expect(modelInstanceCounts.get(cosmeticModel)).toBe(2);
    expect(activeModels.has(cosmeticModel)).toBe(true);
    expect(cosmeticEntityIdMaps.get("gold")?.get(1)).toBe(99);
  });
});
