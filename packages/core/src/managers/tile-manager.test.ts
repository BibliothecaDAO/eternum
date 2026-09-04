import { BuildingType, Direction } from "@bibliothecadao/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createBuilding: vi.fn(),
  getComponentValue: vi.fn(),
}));

vi.mock("@dojoengine/recs", () => ({ getComponentValue: mocks.getComponentValue }));
vi.mock("..", () => ({
  DEFAULT_COORD_ALT: false,
  FELT_CENTER: () => 0,
  getTileAt: vi.fn(),
}));

import { TileManager } from "./tile-manager";

describe("TileManager building placement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getComponentValue.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits the requested coordinate without maintaining a parallel occupancy record", async () => {
    mocks.createBuilding
      .mockResolvedValueOnce({ transaction_hash: "0x1" })
      .mockResolvedValueOnce({ transaction_hash: "0x2" });
    const tileManager = new TileManager({ Building: {} } as never, { create_building: mocks.createBuilding } as never, {
      col: 20,
      row: 30,
    });

    await expect(
      tileManager.placeBuilding({} as never, 101, BuildingType.WorkersHut, { col: 11, row: 10 }, true),
    ).resolves.toEqual({ transaction_hash: "0x1" });
    await expect(
      tileManager.placeBuilding({} as never, 101, BuildingType.Storehouse, { col: 11, row: 11 }, true),
    ).resolves.toEqual({ transaction_hash: "0x2" });

    expect(mocks.createBuilding).toHaveBeenNthCalledWith(1, {
      signer: {},
      entity_id: 101,
      directions: [Direction.EAST],
      building_category: BuildingType.WorkersHut,
      use_simple: true,
    });
    expect(mocks.createBuilding).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ directions: [Direction.NORTH_EAST] }),
    );
  });

  it("releases a coordinate immediately when submission fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.createBuilding.mockRejectedValueOnce(new Error("submit failed"));
    mocks.createBuilding.mockResolvedValueOnce({ transaction_hash: "0x2" });
    const tileManager = new TileManager({ Building: {} } as never, { create_building: mocks.createBuilding } as never, {
      col: 40,
      row: 50,
    });

    await expect(
      tileManager.placeBuilding({} as never, 202, BuildingType.WorkersHut, { col: 11, row: 10 }, true),
    ).rejects.toThrow("submit failed");
    await expect(
      tileManager.placeBuilding({} as never, 202, BuildingType.Storehouse, { col: 11, row: 10 }, true),
    ).resolves.toEqual({ transaction_hash: "0x2" });
  });
});
