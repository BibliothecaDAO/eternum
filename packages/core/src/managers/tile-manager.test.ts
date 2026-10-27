import { describe, expect, it, vi } from "vitest";
import { OccupiedSpaceError, TileManager } from "../index";
import type { NativeFactStore } from "../client/native-fact-store";
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

it("supplies the realm model with the highest side tier, from Common through Legendary", () => {
  for (const [category, offset] of [
    [37, 0n],
    [25, 7n],
    [28, 14n],
  ] as const) {
    for (let a = 0; a <= 4; a++)
      for (let b = 0; b <= 4; b++) {
        const store = {
          require: () => ({ entity_id: 1 }),
          get: (model: string, key: { inner_col?: number; inner_row?: number }) =>
            model === "RealmKnowledge"
              ? { learned: (BigInt(a) << offset) | (BigInt(b) << (offset + 3n)) }
              : model === "Building" && key.inner_col === BUILDINGS_CENTER[0] && key.inner_row === BUILDINGS_CENTER[1]
                ? { inner_col: key.inner_col, inner_row: key.inner_row, category, paused: false }
                : undefined,
        } as unknown as NativeFactStore;
        const manager = TileManager.forStructure(store, {} as SystemCalls, 1);
        expect(manager.existingBuildings()).toEqual([expect.objectContaining({ category, tier: Math.max(a, b) + 1 })]);
      }
  }
});

it("requires the Scouts first kind and sends each choice with construction", async () => {
  const { manager, create_building } = setup();
  const build = (kind?: 0 | 1 | 2) =>
    manager.placeBuilding(
      { address: "0xabc" } as GameplayAccount,
      1,
      BuildingType.ScoutsLodge,
      { col: 11, row: 10 },
      true,
      kind,
    );
  await expect(build()).rejects.toThrow("Choose the Scouts");
  expect(create_building).not.toHaveBeenCalled();
  for (const kind of [0, 1, 2] as const) {
    await build(kind);
    expect(create_building).toHaveBeenLastCalledWith(
      expect.objectContaining({
        building_category: BuildingType.ScoutsLodge,
        scouting_kind: kind,
      }),
    );
  }
});
