// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { hash } from "starknet";
import { BuildingType, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { resolveConstructionBuildability } from "@bibliothecadao/eternum/automation";

const {
  getBalance,
  getBuildingCosts,
  getBlockTimestamp,
  divideByPrecision,
  getBuildingCategoryConfig,
  getBasePopulationCapacity,
} = vi.hoisted(() => ({
  getBalance: vi.fn(),
  getBuildingCosts: vi.fn(),
  getBlockTimestamp: vi.fn(() => ({ currentDefaultTick: 100 })),
  divideByPrecision: vi.fn((value: bigint | number) => Number(value)),
  getBuildingCategoryConfig: vi.fn(),
  getBasePopulationCapacity: vi.fn(() => 0),
}));

vi.mock("@bibliothecadao/eternum", () => ({
  getBalance,
  getBuildingCosts,
  getBlockTimestamp,
  divideByPrecision,
  configManager: {
    getActiveGameId: () => 1,
    getBuildingCategoryConfig,
    getBasePopulationCapacity,
  },
}));

let store: NativeFactStore;
const setPopulation = (current: number, max: number) =>
  store.applyEntityOperations([
    {
      type: "upsert",
      entities: [
        {
          hashed_keys: hash.computePoseidonHashOnElements([1, 101]),
          models: {
            StructureBuildings: {
              game_id: 1,
              entity_id: 101,
              packed_counts_1: "0",
              packed_counts_2: "0",
              packed_counts_3: "0",
              population: { current, max },
            },
          },
        },
      ],
    },
  ]);

const allowAllMode = {
  rules: {
    isBuildingTypeAllowed: vi.fn(() => true),
    autoAllocateHyperstructureShares: false,
  },
};

const buildableRealm = {
  category: StructureType.Realm,
  level: 1,
  resources: [ResourcesIds.Wood],
  population: 1,
  capacity: 10,
  hasCapacity: true,
};

const buildabilityInput = (overrides: Partial<Parameters<typeof resolveConstructionBuildability>[0]> = {}) => ({
  entityId: 101,
  buildingType: BuildingType.ResourceWood,
  useSimpleCost: true,
  store,
  realm: buildableRealm,
  mode: allowAllMode,
  ...overrides,
});

describe("resolveConstructionBuildability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBuildingCosts.mockReturnValue([{ resource: ResourcesIds.Wood, amount: 10 }]);
    getBalance.mockReturnValue({ balance: 20n });
    getBuildingCategoryConfig.mockReturnValue({ population_cost: 1, capacity_grant: 0 });
    getBasePopulationCapacity.mockReturnValue(0);
    store = new NativeFactStore();
    setPopulation(1, 10);
    allowAllMode.rules.isBuildingTypeAllowed.mockReturnValue(true);
  });

  it("allows a locally valid construction request", () => {
    expect(resolveConstructionBuildability(buildabilityInput())).toMatchObject({
      canSubmit: true,
      reason: undefined,
    });
  });

  it("rejects non-production structures before submission", () => {
    const result = resolveConstructionBuildability(
      buildabilityInput({
        realm: {
          ...buildableRealm,
          category: StructureType.Hyperstructure,
        },
      }),
    );

    expect(result).toMatchObject({
      canSubmit: false,
      code: "invalid_structure",
    });
  });

  it("rejects center-tile construction", () => {
    const result = resolveConstructionBuildability(buildabilityInput({ targetSpot: { col: 10, row: 10 } }));

    expect(result).toMatchObject({
      canSubmit: false,
      code: "center_tile",
    });
  });

  it("rejects occupied tiles", () => {
    const occupiedResult = resolveConstructionBuildability(
      buildabilityInput({
        targetSpot: { col: 11, row: 10 },
        tileManager: { isHexOccupied: () => true },
      }),
    );
    expect(occupiedResult).toMatchObject({ canSubmit: false, code: "occupied_tile" });
  });

  it("rejects out-of-radius tiles", () => {
    const result = resolveConstructionBuildability(
      buildabilityInput({
        realm: { ...buildableRealm, level: 0 },
        targetSpot: { col: 14, row: 10 },
      }),
    );

    expect(result).toMatchObject({
      canSubmit: false,
      code: "out_of_radius",
    });
  });

  it("rejects missing costs and insufficient resources", () => {
    getBuildingCosts.mockReturnValueOnce(undefined);
    const noCostResult = resolveConstructionBuildability(buildabilityInput());

    getBuildingCosts.mockReturnValueOnce([{ resource: ResourcesIds.Wood, amount: 10 }]);
    getBalance.mockReturnValueOnce({ balance: 5n });
    const insufficientResourceResult = resolveConstructionBuildability(buildabilityInput());

    expect(noCostResult).toMatchObject({ canSubmit: false, code: "missing_cost" });
    expect(insufficientResourceResult).toMatchObject({ canSubmit: false, code: "insufficient_resources" });
  });

  it("rejects insufficient capacity and population", () => {
    setPopulation(10, 10);
    const noCapacityResult = resolveConstructionBuildability(
      buildabilityInput({
        realm: { ...buildableRealm, hasCapacity: false },
      }),
    );

    getBuildingCategoryConfig.mockReturnValueOnce({ population_cost: 2, capacity_grant: 0 });
    setPopulation(9, 10);
    const noPopulationResult = resolveConstructionBuildability(
      buildabilityInput({
        realm: { ...buildableRealm, population: 9, capacity: 10, hasCapacity: true },
      }),
    );

    expect(noCapacityResult).toMatchObject({ canSubmit: false, code: "insufficient_capacity" });
    expect(noPopulationResult).toMatchObject({ canSubmit: false, code: "insufficient_population" });
  });

  it("uses native population instead of stale realm input", () => {
    setPopulation(10, 10);

    const result = resolveConstructionBuildability(
      buildabilityInput({
        realm: { ...buildableRealm, population: 1, capacity: 10, hasCapacity: true },
      }),
    );

    expect(result).toMatchObject({
      canSubmit: false,
      code: "insufficient_capacity",
    });
  });

  it("rejects resource producers not supported by the structure resource set", () => {
    const result = resolveConstructionBuildability(
      buildabilityInput({
        buildingType: BuildingType.ResourceStone,
        realm: { ...buildableRealm, resources: [ResourcesIds.Wood] },
      }),
    );

    expect(result).toMatchObject({
      canSubmit: false,
      code: "invalid_resource_for_structure",
    });
  });

  it("rejects labor-mode locks and mode exclusions", () => {
    const laborLockedResult = resolveConstructionBuildability(
      buildabilityInput({
        buildingType: BuildingType.ResourceDragonhide,
        realm: { ...buildableRealm, resources: [ResourcesIds.Dragonhide] },
      }),
    );

    allowAllMode.rules.isBuildingTypeAllowed.mockReturnValueOnce(false);
    const excludedByModeResult = resolveConstructionBuildability(
      buildabilityInput({
        buildingType: BuildingType.ResourceFish,
        realm: { ...buildableRealm, resources: [ResourcesIds.Fish] },
      }),
    );

    expect(laborLockedResult).toMatchObject({ canSubmit: false, code: "simple_cost_locked" });
    expect(excludedByModeResult).toMatchObject({ canSubmit: false, code: "mode_excluded" });
  });
});
