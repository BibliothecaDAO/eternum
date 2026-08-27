// @vitest-environment node

import { BuildingType, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildRealmBuilding } from "./realm-build-actions";

const mocks = vi.hoisted(() => ({
  placeBuilding: vi.fn(),
  isHexOccupied: vi.fn(),
  getBalance: vi.fn(),
  getBuildingCosts: vi.fn(),
  getComponentValue: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));
vi.mock("@bibliothecadao/eternum", () => ({
  TileManager: vi.fn().mockImplementation(() => ({
    getRealmLevel: () => 1,
    isHexOccupied: mocks.isHexOccupied,
    placeBuilding: mocks.placeBuilding,
  })),
  divideByPrecision: (value: bigint | number) => Number(value),
  getBlockTimestamp: () => ({ currentDefaultTick: 123 }),
  getBalance: mocks.getBalance,
  getBuildingCosts: mocks.getBuildingCosts,
  configManager: {
    getBuildingCategoryConfig: () => ({ population_cost: 1, capacity_grant: 0 }),
    getBasePopulationCapacity: () => 0,
  },
}));
vi.mock("@dojoengine/recs", () => ({ getComponentValue: mocks.getComponentValue }));
vi.mock("@dojoengine/utils", () => ({ getEntityIdFromKeys: (keys: bigint[]) => keys.join(":") }));

const buildableRealm = {
  category: StructureType.Realm,
  level: 1,
  resources: [ResourcesIds.Wheat],
  population: 1,
  capacity: 10,
  hasCapacity: true,
};

const buildOptions = () => ({
  entityId: 101,
  realmPosition: { x: 20, y: 30 },
  realm: buildableRealm,
  mode: { rules: { isBuildingTypeAllowed: () => true, autoAllocateHyperstructureShares: false } },
  target: { type: BuildingType.ResourceWheat },
  useSimpleCost: true,
  world: { account: {}, components: {}, systemCalls: {} },
});

describe("buildRealmBuilding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isHexOccupied.mockReturnValue(false);
    mocks.placeBuilding.mockResolvedValue({ transaction_hash: "0x1" });
    mocks.getBuildingCosts.mockReturnValue([{ resource: 1, amount: 10 }]);
    mocks.getBalance.mockReturnValue({ balance: 20n, resourceId: 1 });
    mocks.getComponentValue.mockReturnValue(undefined);
  });

  it("re-checks affordability before submitting", async () => {
    mocks.getBalance.mockReturnValueOnce({ balance: 5n, resourceId: 1 });

    await expect(buildRealmBuilding(buildOptions())).resolves.toBe(false);
    expect(mocks.placeBuilding).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith("Insufficient resources to build.");
  });

  it("uses the next authoritative-empty tile after an occupancy race", async () => {
    mocks.placeBuilding.mockRejectedValueOnce(new Error("space is occupied"));

    await expect(buildRealmBuilding(buildOptions())).resolves.toBe(true);
    expect(mocks.placeBuilding).toHaveBeenNthCalledWith(
      1,
      {},
      101,
      BuildingType.ResourceWheat,
      { col: 11, row: 10 },
      true,
    );
    expect(mocks.placeBuilding).toHaveBeenNthCalledWith(
      2,
      {},
      101,
      BuildingType.ResourceWheat,
      { col: 11, row: 11 },
      true,
    );
  });
});
