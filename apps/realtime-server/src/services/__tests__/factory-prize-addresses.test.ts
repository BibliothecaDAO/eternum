import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchFactoryPrizeAddresses } from "../factory-prize-addresses";

const mockFetch = vi.fn<typeof globalThis.fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  mockFetch.mockReset();
  vi.restoreAllMocks();
});

describe("fetchFactoryPrizeAddresses", () => {
  it("returns worldName → prizeAddress map for valid rows", async () => {
    // "alpha" = 0x616c706861, "beta" = 0x62657461
    const rows = [
      { name: "0x616c706861", contract_address: "0x1111" },
      { name: "0x62657461", contract_address: "0x2222" },
    ];
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(rows), { status: 200 }));

    const map = await fetchFactoryPrizeAddresses("mainnet", 5000);

    expect(map.size).toBe(2);
    expect(map.get("alpha")).toBe("0x1111");
    expect(map.get("beta")).toBe("0x2222");
  });

  it("skips rows with zero / missing addresses", async () => {
    const rows = [
      { name: "0x616c706861", contract_address: "0x0" },
      { name: "0x62657461", contract_address: "0x2222" },
    ];
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(rows), { status: 200 }));

    const map = await fetchFactoryPrizeAddresses("mainnet", 5000);

    expect(map.has("alpha")).toBe(false);
    expect(map.get("beta")).toBe("0x2222");
  });

  it("returns an empty map when the factory query fails", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

    const map = await fetchFactoryPrizeAddresses("mainnet", 5000);

    expect(map.size).toBe(0);
  });

  it("returns an empty map when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network down"));

    const map = await fetchFactoryPrizeAddresses("mainnet", 5000);

    expect(map.size).toBe(0);
  });

  it("returns an empty map when chain has no factory URL configured", async () => {
    const map = await fetchFactoryPrizeAddresses("unknown-chain", 5000);

    expect(map.size).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
