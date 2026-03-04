import { BUILDINGS_CENTER, BuildingType } from "@bibliothecadao/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetOptimisticBuildRegistryForTests } from "./optimistic-build-registry";
import { TileManager } from "./tile-manager";

vi.mock("@dojoengine/recs", () => ({
  Has: vi.fn(),
  HasValue: vi.fn(),
  NotValue: vi.fn(),
  getComponentValue: (component: unknown, entity: unknown) => {
    if (component instanceof Map) {
      return component.get(entity);
    }

    return undefined;
  },
  runQuery: () => new Set(),
}));

vi.mock("@dojoengine/utils", () => ({
  getEntityIdFromKeys: (keys: bigint[]) => keys.join(","),
}));

vi.mock("..", () => ({
  DEFAULT_COORD_ALT: 0,
  FELT_CENTER: () => 0,
  ResourceManager: class {
    optimisticResourceUpdate() {
      return () => {};
    }
  },
  getBuildingCosts: () => [],
  getBuildingCount: () => 0,
  getTileAt: () => undefined,
  setBuildingCount: (_buildingType: number, packedValues: bigint[]) => packedValues,
}));

function createTestTileManager(createBuildingImpl: () => Promise<unknown>) {
  const systemCalls = {
    create_building: vi.fn(createBuildingImpl),
  } as any;

  const components = {
    StructureBuildings: new Map(),
    Building: new Map(),
  } as any;

  const tileManager = new TileManager(components, systemCalls, {
    col: 10,
    row: 20,
  });

  const removeOverride = vi.fn();
  (tileManager as any)._optimisticBuilding = vi.fn(() => removeOverride);

  return { tileManager, removeOverride };
}

describe("TileManager optimistic build persistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetOptimisticBuildRegistryForTests();
  });

  afterEach(() => {
    __resetOptimisticBuildRegistryForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps optimistic build active after tx success until authoritative confirmation", async () => {
    const { tileManager, removeOverride } = createTestTileManager(async () => ({ transaction_hash: "0x123" }));

    await tileManager.placeBuilding(
      {} as any,
      777,
      BuildingType.ResourceWheat,
      { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] },
      false,
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(removeOverride).not.toHaveBeenCalled();
    expect(tileManager.isHexOccupied({ col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] })).toBe(true);
  });

  it("cleans optimistic build immediately when tx creation fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { tileManager, removeOverride } = createTestTileManager(async () => {
      throw new Error("tx failed");
    });

    await expect(
      tileManager.placeBuilding(
        {} as any,
        888,
        BuildingType.ResourceWheat,
        { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] },
        false,
      ),
    ).rejects.toThrow("tx failed");

    expect(removeOverride).toHaveBeenCalledTimes(1);
    expect(tileManager.isHexOccupied({ col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] })).toBe(false);
  });

  it("reconciles pending optimistic build on authoritative structure update", async () => {
    const { tileManager, removeOverride } = createTestTileManager(async () => ({ transaction_hash: "0x456" }));

    await tileManager.placeBuilding(
      {} as any,
      999,
      BuildingType.ResourceWheat,
      { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] },
      false,
    );

    const secondManager = new TileManager((tileManager as any).components, {} as any, {
      col: 10,
      row: 20,
    });
    expect(secondManager.isHexOccupied({ col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] })).toBe(true);

    TileManager.reconcilePendingBuildsForStructure(999, [
      { buildingType: BuildingType.ResourceWheat, buildingCount: 1 },
    ]);

    expect(removeOverride).toHaveBeenCalledTimes(1);
    expect(secondManager.isHexOccupied({ col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] })).toBe(false);
  });

  it("exposes structure-scoped pending build counts for UI continuity", async () => {
    const { tileManager } = createTestTileManager(async () => ({ transaction_hash: "0x999" }));

    await tileManager.placeBuilding(
      {} as any,
      1234,
      BuildingType.ResourceWheat,
      { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] },
      false,
    );

    expect(TileManager.getPendingOptimisticBuildCountForStructureAndType(1234, BuildingType.ResourceWheat)).toBe(1);
    expect(TileManager.getPendingOptimisticBuildCountForStructureAndType(9999, BuildingType.ResourceWheat)).toBe(0);
  });
});
