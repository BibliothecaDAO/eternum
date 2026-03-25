import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("../constants", () => ({
  BANK_COUNT: 6,
  BANK_NAME_PREFIX: "Central Bank",
  BANK_STEPS_FROM_CENTER: 15 * 21,
  CARTRIDGE_API_BASE: "https://api.cartridge.gg",
}));

const { buildAdminBanksForMapCenterOffset, fetchWorldMapCenterOffset } = await import("./world-banks");

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("world-banks", () => {
  test("parses map_center_offset from WorldConfig", async () => {
    globalThis.fetch = vi.fn(async () => Response.json([{ map_center_offset: "0x32" }])) as typeof fetch;

    await expect(fetchWorldMapCenterOffset("alpha")).resolves.toBe(50);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.cartridge.gg/x/alpha/torii/sql?query=SELECT%20%22map_center_offset%22%20AS%20map_center_offset%20FROM%20%22s1_eternum-WorldConfig%22%20LIMIT%201%3B",
    );
  });

  test("builds bank coordinates from the resolved map center offset", () => {
    const offsetBanks = buildAdminBanksForMapCenterOffset(50);
    const defaultBanks = buildAdminBanksForMapCenterOffset(0);

    expect(offsetBanks).toHaveLength(6);
    expect(offsetBanks[0]).toEqual({
      name: "Central Bank 1",
      coord: {
        alt: false,
        x: 2147483911,
        y: 2147483596,
      },
    });
    expect(offsetBanks[0]?.coord).not.toEqual(defaultBanks[0]?.coord);
  });
});
