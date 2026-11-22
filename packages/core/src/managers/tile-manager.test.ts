import { describe, expect, it, vi } from "vitest";
import { OccupiedSpaceError, TileManager } from "../index";
import type { NativeFactStore } from "../client/native-fact-store";
import { nativeResearchConstants as research } from "../../../../contracts/l3/world-native/schema/balance.gen";
import { BUILDINGS_CENTER, BuildingType, type GameplayAccount, type SystemCalls } from "@bibliothecadao/types";

const setup = (occupied = false) => {
  const create_building = vi.fn().mockResolvedValue({ transaction_hash: "0x1" });
  const store = {
    require: () => ({ entity_id: 1 }),
    get: () => (occupied ? { category: BuildingType.ResourceWheat } : undefined),
  } as unknown as NativeFactStore;
  const manager = TileManager.forStructure(store, { create_building } as unknown as SystemCalls, 1);
  const place = () =>
    manager.placeBuilding(
      { address: "0xabc" } as GameplayAccount,
      1,
      BuildingType.ResourceWheat,
      { col: BUILDINGS_CENTER[0] + 1, row: BUILDINGS_CENTER[1] },
      true,
    );
  return { create_building, place, manager };
};

describe("building occupancy errors", () => {
  it("tags native occupied tiles without submitting", async () => {
    const { create_building, place } = setup(true);
    await expect(place()).rejects.toBeInstanceOf(OccupiedSpaceError);
    expect(create_building).not.toHaveBeenCalled();
  });
  it("tags the occupied-space rejection at the provider boundary", async () => {
    const { create_building, place } = setup();
    create_building.mockRejectedValueOnce(new Error("execution reverted: space is occupied"));
    await expect(place()).rejects.toMatchObject({
      _tag: "OccupiedSpaceError",
      message: "This tile is occupied. Try another.",
    });
  });
  it("preserves unrelated failures and successful transaction results", async () => {
    const { create_building, place } = setup();
    const error = new Error("insufficient resource balance");
    create_building.mockRejectedValueOnce(error);
    await expect(place()).rejects.toBe(error);
    await expect(place()).resolves.toEqual({ transaction_hash: "0x1" });
  });
});

it("draws Farms, Workshops and Supply yards at their row's tier", () => {
  for (const [category, offset] of [
    [research.FARM, 0n],
    [research.WORKSHOP, 7n],
    [research.SUPPLY_YARD, 27n],
  ] as const) {
    for (let tier = 0; tier <= 5; tier++) {
      const store = {
        require: () => ({ entity_id: 1 }),
        get: (model: string, key: { inner_col?: number; inner_row?: number }) =>
          model === "RealmKnowledge"
            ? { learned: BigInt(tier) << offset }
            : model === "Building" && key.inner_col === BUILDINGS_CENTER[0] && key.inner_row === BUILDINGS_CENTER[1]
              ? { inner_col: key.inner_col, inner_row: key.inner_row, category, paused: false }
              : undefined,
      } as unknown as NativeFactStore;
      const manager = TileManager.forStructure(store, {} as SystemCalls, 1);
      expect(manager.existingBuildings()).toEqual([expect.objectContaining({ category, tier: Math.max(1, tier) })]);
    }
  }
});

it("builds a Scout producer without buying Scouting research", async () => {
  const { manager, create_building } = setup();
  await manager.placeBuilding(
    { address: "0xabc" } as GameplayAccount,
    1,
    BuildingType.ScoutsLodge,
    { col: 11, row: 10 },
    true,
  );
  expect(create_building).toHaveBeenCalledWith({
    signer: { address: "0xabc" },
    entity_id: 1,
    directions: expect.any(Array),
    building_category: BuildingType.ScoutsLodge,
    use_simple: true,
  });
});
