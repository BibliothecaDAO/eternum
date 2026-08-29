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
  resources: [ResourcesIds.Wheat, ResourcesIds.Wood, ResourcesIds.Coal],
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

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

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

  it("serializes four quick clicks per realm and resolves each slot when its turn starts", async () => {
    const occupied = new Set<string>();
    const submissions = Array.from({ length: 4 }, () => deferred<{ transaction_hash: string }>());
    let submissionIndex = 0;
    mocks.isHexOccupied.mockImplementation((spot: { col: number; row: number }) =>
      occupied.has(`${spot.col},${spot.row}`),
    );
    mocks.placeBuilding.mockImplementation((_account, _entityId, _buildingType, spot: { col: number; row: number }) => {
      const submission = submissions[submissionIndex++]!;
      return submission.promise.then((result) => {
        occupied.add(`${spot.col},${spot.row}`);
        return result;
      });
    });

    const builds = [
      BuildingType.WorkersHut,
      BuildingType.Storehouse,
      BuildingType.ResourceWheat,
      BuildingType.ResourceWood,
    ].map((type) => buildRealmBuilding({ ...buildOptions(), target: { type } }));

    await vi.waitFor(() => expect(mocks.placeBuilding).toHaveBeenCalledTimes(1));
    for (let index = 0; index < submissions.length; index += 1) {
      submissions[index]!.resolve({ transaction_hash: `0x${index + 1}` });
      if (index + 1 < submissions.length) {
        await vi.waitFor(() => expect(mocks.placeBuilding).toHaveBeenCalledTimes(index + 2));
      }
    }

    await expect(Promise.all(builds)).resolves.toEqual([true, true, true, true]);
    const selectedSpots = mocks.placeBuilding.mock.calls.map((call) => call[3] as { col: number; row: number });
    expect(new Set(selectedSpots.map(({ col, row }) => `${col},${row}`)).size).toBe(4);
  });
});
