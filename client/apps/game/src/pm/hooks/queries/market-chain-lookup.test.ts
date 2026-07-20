// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const globalChainMock = vi.hoisted(() => ({
  mainnetError: null as Error | null,
}));

vi.mock("@/config/global-chain", () => ({
  GLOBAL_TORII_BY_CHAIN: {
    get mainnet() {
      if (globalChainMock.mainnetError) {
        throw globalChainMock.mainnetError;
      }
      return "https://mainnet.test/torii";
    },
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
    globalChainMock.mainnetError = null;
  });

  it("returns on the preferred chain when found and does NOT probe the alternate", async () => {
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

  it("does NOT fall back to the alternate chain when preferred returns null", async () => {
    mockFetchMarketByPrizeAddress.mockResolvedValue(null);

    const result = await findMarketByPrizeAddressAcrossChains({
      preferredChain: "slot",
      prizeAddress: "0xabc",
    });

    expect(result.chain).toBeNull();
    expect(result.marketRow).toBeNull();
    expect(result.failures).toHaveLength(0);
    expect(mockFetchMarketByPrizeAddress).toHaveBeenCalledTimes(1);
  });

  it("falls back to the alternate chain when preferred throws (default fallbackOnError)", async () => {
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

  it("never falls back from mainnet to historical Slot after a request failure", async () => {
    const error = new Error("mainnet request failed");
    mockFetchMarketByPrizeAddress.mockRejectedValueOnce(error);

    const result = await findMarketByPrizeAddressAcrossChains({
      preferredChain: "mainnet",
      prizeAddress: "0xabc",
    });

    expect(result.chain).toBeNull();
    expect(result.marketRow).toBeNull();
    expect(result.failures).toEqual([{ chain: "mainnet", error }]);
    expect(mockFetchMarketByPrizeAddress).toHaveBeenCalledTimes(1);
  });

  it("fails closed without querying Slot when mainnet endpoint resolution fails", async () => {
    const error = new Error("Active Blitz game stack is unavailable");
    globalChainMock.mainnetError = error;

    const result = await findMarketByPrizeAddressAcrossChains({
      preferredChain: "mainnet",
      prizeAddress: "0xabc",
    });

    expect(result.chain).toBeNull();
    expect(result.marketRow).toBeNull();
    expect(result.failures).toEqual([{ chain: "mainnet", error }]);
    expect(mockFetchMarketByPrizeAddress).not.toHaveBeenCalled();
  });

  it("does NOT fall back to alternate chain when preferred throws if fallbackOnError is false", async () => {
    const error = new Error("fail");
    mockFetchMarketByPrizeAddress.mockRejectedValueOnce(error);

    const result = await findMarketByPrizeAddressAcrossChains({
      preferredChain: "slot",
      prizeAddress: "0xabc",
      fallbackOnError: false,
    });

    expect(mockFetchMarketByPrizeAddress).toHaveBeenCalledTimes(1);
    expect(result.chain).toBeNull();
    expect(result.marketRow).toBeNull();
    expect(result.failures).toHaveLength(1);
  });
});
