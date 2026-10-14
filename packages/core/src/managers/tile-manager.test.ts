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
  return { create_building, place };
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
    await expect(place()).rejects.toMatchObject({ _tag: "OccupiedSpaceError", message: "space is occupied" });
  });
  it("preserves unrelated failures and successful transaction results", async () => {
    const { create_building, place } = setup();
    const error = new Error("insufficient resource balance");
    create_building.mockRejectedValueOnce(error);
    await expect(place()).rejects.toBe(error);
    await expect(place()).resolves.toEqual({ transaction_hash: "0x1" });
  });
});
