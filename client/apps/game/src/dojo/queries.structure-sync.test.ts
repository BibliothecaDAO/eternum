import { beforeEach, describe, expect, it, vi } from "vitest";

const { debouncedGetBuildingsFromToriiMock, debouncedGetEntitiesFromToriiMock, debouncedGetOwnedArmiesFromToriiMock } =
  vi.hoisted(() => ({
    debouncedGetBuildingsFromToriiMock: vi.fn(async (..._args: unknown[]) => undefined),
    debouncedGetEntitiesFromToriiMock: vi.fn(async (..._args: unknown[]) => undefined),
    debouncedGetOwnedArmiesFromToriiMock: vi.fn(async (..._args: unknown[]) => undefined),
  }));

vi.mock("./debounced-queries", () => ({
  debouncedGetBuildingsFromTorii: debouncedGetBuildingsFromToriiMock,
  debouncedGetEntitiesFromTorii: debouncedGetEntitiesFromToriiMock,
  debouncedGetOwnedArmiesFromTorii: debouncedGetOwnedArmiesFromToriiMock,
}));

import { getStructuresDataFromTorii } from "./queries";

describe("getStructuresDataFromTorii", () => {
  beforeEach(() => {
    debouncedGetBuildingsFromToriiMock.mockClear();
    debouncedGetEntitiesFromToriiMock.mockClear();
    debouncedGetOwnedArmiesFromToriiMock.mockClear();
    debouncedGetEntitiesFromToriiMock.mockImplementation(async () => undefined);
  });

  it("continues when optional structure model groups are unsupported", async () => {
    debouncedGetEntitiesFromToriiMock.mockImplementation(async (...args: unknown[]) => {
      const entityModels = args[3] as string[];

      if (entityModels.includes("s1_eternum-ResourceArrival")) {
        throw new Error("no such table: s1_eternum-ResourceArrival");
      }

      if (entityModels.includes("s1_eternum-ProductionBoostBonus")) {
        throw new Error("no rows returned by a query that expected to return at least one row");
      }
    });

    await expect(
      getStructuresDataFromTorii({} as never, [] as never, [
        { entityId: 4294967289, position: { col: 2147483756, row: 2147483426 } },
      ]),
    ).resolves.toEqual(expect.any(Array));

    expect(debouncedGetEntitiesFromToriiMock).toHaveBeenCalledWith(
      {} as never,
      [] as never,
      [4294967289],
      ["s1_eternum-Structure"],
    );
    expect(debouncedGetOwnedArmiesFromToriiMock).toHaveBeenCalledTimes(1);
    expect(debouncedGetBuildingsFromToriiMock).toHaveBeenCalledTimes(1);
  });

  it("still rejects when the base structure sync fails", async () => {
    debouncedGetEntitiesFromToriiMock.mockImplementation(async (...args: unknown[]) => {
      const entityModels = args[3] as string[];

      if (entityModels.includes("s1_eternum-Structure")) {
        throw new Error("upstream torii unavailable");
      }
    });

    await expect(
      getStructuresDataFromTorii({} as never, [] as never, [
        { entityId: 4294967289, position: { col: 2147483756, row: 2147483426 } },
      ]),
    ).rejects.toThrow("upstream torii unavailable");
  });
});
