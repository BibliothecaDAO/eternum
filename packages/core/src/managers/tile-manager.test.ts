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

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

describe("TileManager building placement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getComponentValue.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("reserves each submitted coordinate until indexed state catches up", async () => {
    const firstSubmit = deferred<{ transaction_hash: string }>();
    mocks.createBuilding.mockReturnValueOnce(firstSubmit.promise);
    const tileManager = new TileManager({ Building: {} } as never, { create_building: mocks.createBuilding } as never, {
      col: 20,
      row: 30,
    });

    const first = tileManager.placeBuilding({} as never, 101, BuildingType.WorkersHut, { col: 11, row: 10 }, true);
    await expect(
      tileManager.placeBuilding({} as never, 101, BuildingType.Storehouse, { col: 11, row: 10 }, true),
    ).rejects.toThrow("space is occupied");
    expect(mocks.createBuilding).toHaveBeenCalledTimes(1);
    expect(mocks.createBuilding).toHaveBeenCalledWith({
      signer: {},
      entity_id: 101,
      directions: [Direction.EAST],
      building_category: BuildingType.WorkersHut,
      use_simple: true,
    });

    firstSubmit.resolve({ transaction_hash: "0x1" });
    await expect(first).resolves.toEqual({ transaction_hash: "0x1" });

    await expect(
      tileManager.placeBuilding({} as never, 101, BuildingType.Storehouse, { col: 11, row: 10 }, true),
    ).rejects.toThrow("space is occupied");

    mocks.createBuilding.mockResolvedValueOnce({ transaction_hash: "0x2" });
    await expect(
      tileManager.placeBuilding({} as never, 101, BuildingType.Storehouse, { col: 11, row: 11 }, true),
    ).resolves.toEqual({ transaction_hash: "0x2" });
    expect(mocks.createBuilding).toHaveBeenLastCalledWith(
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

  it("expires a submitted coordinate when no indexed echo arrives", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T12:00:00Z"));
    mocks.createBuilding.mockResolvedValueOnce({ transaction_hash: "0x1" });
    mocks.createBuilding.mockResolvedValueOnce({ transaction_hash: "0x2" });
    const tileManager = new TileManager({ Building: {} } as never, { create_building: mocks.createBuilding } as never, {
      col: 60,
      row: 70,
    });

    await tileManager.placeBuilding({} as never, 303, BuildingType.WorkersHut, { col: 11, row: 10 }, true);
    await expect(
      tileManager.placeBuilding({} as never, 303, BuildingType.Storehouse, { col: 11, row: 10 }, true),
    ).rejects.toThrow("space is occupied");

    vi.advanceTimersByTime(30_001);
    await expect(
      tileManager.placeBuilding({} as never, 303, BuildingType.Storehouse, { col: 11, row: 10 }, true),
    ).resolves.toEqual({ transaction_hash: "0x2" });
  });
});
