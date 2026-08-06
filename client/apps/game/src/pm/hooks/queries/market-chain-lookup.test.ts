// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/global-chain", () => ({
  GLOBAL_TORII_BY_CHAIN: {
    mainnet: "https://mainnet.test/torii",
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

  it("returns the market when the prediction market chain has it", async () => {
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

  it("returns a null result without extra probes when the market does not exist", async () => {
    mockFetchMarketByPrizeAddress.mockResolvedValue(null);

    const result = await findMarketByPrizeAddressAcrossChains({
      preferredChain: "mainnet",
      prizeAddress: "0xabc",
    });

    expect(result.chain).toBeNull();
    expect(result.marketRow).toBeNull();
    expect(result.failures).toHaveLength(0);
    expect(mockFetchMarketByPrizeAddress).toHaveBeenCalledTimes(1);
  });

  it("records the failure and reports it through onChainError when the lookup throws", async () => {
    const error = new Error("network down");
    mockFetchMarketByPrizeAddress.mockRejectedValueOnce(error);
    const onChainError = vi.fn();

    const result = await findMarketByPrizeAddressAcrossChains({
      preferredChain: "mainnet",
      prizeAddress: "0xabc",
      onChainError,
    });

    expect(result.chain).toBeNull();
    expect(result.marketRow).toBeNull();
    expect(result.failures).toEqual([{ chain: "mainnet", error }]);
    expect(onChainError).toHaveBeenCalledWith({ chain: "mainnet", error });
    expect(mockFetchMarketByPrizeAddress).toHaveBeenCalledTimes(1);
  });
});
