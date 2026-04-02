import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/global-chain", () => ({
  GLOBAL_TORII_BY_CHAIN: {
    mainnet: "https://mainnet.test/torii",
    slot: "https://slot.test/torii",
  },
}));

const mockFetchMarketByPrizeAddress = vi.fn();

vi.mock("./pm-sql-api", () => ({
  getPmSqlApiForUrl: () => ({
    fetchMarketByPrizeAddress: mockFetchMarketByPrizeAddress,
  }),
}));

import { findMarketByPrizeAddressAcrossChains } from "./market-chain-lookup";

const FAKE_ROW = { market_id: "0x1" } as never;

describe("findMarketByPrizeAddressAcrossChains", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockFetchMarketByPrizeAddress.mockReset();
  });

  it("returns on the preferred chain when found", async () => {
    mockFetchMarketByPrizeAddress.mockResolvedValueOnce(FAKE_ROW);

    const result = await findMarketByPrizeAddressAcrossChains({
      preferredChain: "mainnet",
      prizeAddress: "0xabc",
    });

    expect(result.chain).toBe("mainnet");
    expect(result.marketRow).toBe(FAKE_ROW);
    expect(result.failures).toHaveLength(0);
    expect(mockFetchMarketByPrizeAddress).toHaveBeenCalledTimes(1);
  });

  it("falls back to the second chain when preferred returns null", async () => {
    mockFetchMarketByPrizeAddress.mockResolvedValueOnce(null).mockResolvedValueOnce(FAKE_ROW);

    const result = await findMarketByPrizeAddressAcrossChains({
      preferredChain: "slot",
      prizeAddress: "0xabc",
    });

    expect(result.chain).toBe("mainnet");
    expect(result.marketRow).toBe(FAKE_ROW);
    expect(mockFetchMarketByPrizeAddress).toHaveBeenCalledTimes(2);
  });

  it("returns null chain and row when both chains return null", async () => {
    mockFetchMarketByPrizeAddress.mockResolvedValue(null);

    const result = await findMarketByPrizeAddressAcrossChains({
      preferredChain: "mainnet",
      prizeAddress: "0xabc",
    });

    expect(result.chain).toBeNull();
    expect(result.marketRow).toBeNull();
    expect(result.failures).toHaveLength(0);
  });

  it("collects failure and calls onChainError when a chain throws", async () => {
    const error = new Error("network down");
    mockFetchMarketByPrizeAddress.mockRejectedValueOnce(error).mockResolvedValueOnce(FAKE_ROW);
    const onChainError = vi.fn();

    const result = await findMarketByPrizeAddressAcrossChains({
      preferredChain: "slot",
      prizeAddress: "0xabc",
      onChainError,
    });

    expect(result.chain).toBe("mainnet");
    expect(result.marketRow).toBe(FAKE_ROW);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toEqual({ chain: "slot", error });
    expect(onChainError).toHaveBeenCalledWith({ chain: "slot", error });
  });

  it("returns all failures when both chains throw", async () => {
    const err1 = new Error("fail 1");
    const err2 = new Error("fail 2");
    mockFetchMarketByPrizeAddress.mockRejectedValueOnce(err1).mockRejectedValueOnce(err2);

    const result = await findMarketByPrizeAddressAcrossChains({
      preferredChain: "mainnet",
      prizeAddress: "0xabc",
    });

    expect(result.chain).toBeNull();
    expect(result.marketRow).toBeNull();
    expect(result.failures).toHaveLength(2);
    expect(result.failures[0].chain).toBe("mainnet");
    expect(result.failures[1].chain).toBe("slot");
  });
});
