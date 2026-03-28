import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AmmV2ApiClient } from "../src/api/client";

const okJson = (payload: unknown) => ({
  ok: true,
  status: 200,
  statusText: "OK",
  json: async () => payload,
});

describe("AmmV2ApiClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes the base url and decodes wrapped pairs", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      okJson({
        data: [
          {
            pairAddress: "0xpair",
            factoryAddress: "0xfactory",
            token0Address: "0x1",
            token1Address: "0x2",
            lpTokenAddress: "0xpair",
            reserve0: "1000",
            reserve1: "500",
            totalLpSupply: "100",
            feeAmount: "997",
            feeTo: "0xfee",
          },
        ],
      }) as Response,
    );

    const client = new AmmV2ApiClient("https://ammv2.example");
    const pairs = await client.getPairs();

    expect(fetchMock).toHaveBeenCalledWith("https://ammv2.example/api/v1/pairs");
    expect(pairs).toEqual([
      {
        pairAddress: "0xpair",
        factoryAddress: "0xfactory",
        token0Address: "0x1",
        token1Address: "0x2",
        lpTokenAddress: "0xpair",
        reserve0: 1000n,
        reserve1: 500n,
        totalLpSupply: 100n,
        feeAmount: 997n,
        feeTo: "0xfee",
      },
    ]);
  });

  it("passes lookup query params and decodes the payload", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      okJson({
        data: {
          pairAddress: "0xpair",
          factoryAddress: "0xfactory",
          token0Address: "0x1",
          token1Address: "0x2",
          lpTokenAddress: "0xpair",
          reserve0: "1000",
          reserve1: "500",
          totalLpSupply: "100",
          feeAmount: "997",
          feeTo: "0xfee",
        },
      }) as Response,
    );

    const client = new AmmV2ApiClient("https://ammv2.example/api/v1");
    const pair = await client.lookupPair("0x2", "0x1");

    expect(fetchMock).toHaveBeenCalledWith("https://ammv2.example/api/v1/pairs/lookup?tokenA=0x2&tokenB=0x1");
    expect(pair?.pairAddress).toBe("0xpair");
  });

  it("decodes paginated swap history", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      okJson({
        data: [
          {
            pairAddress: "0xpair",
            txHash: "0xhash",
            initiatorAddress: "0xinit",
            callerAddress: "0xrouter",
            recipientAddress: "0xuser",
            amount0In: "10",
            amount1In: "0",
            amount0Out: "0",
            amount1Out: "20",
            feeAmount: "997",
            blockTimestamp: "2026-03-26T00:00:00.000Z",
          },
        ],
        pagination: {
          total: 1,
          limit: 50,
          offset: 0,
          hasMore: false,
        },
      }) as Response,
    );

    const client = new AmmV2ApiClient("https://ammv2.example");
    const swaps = await client.getSwapHistory("0xpair", { limit: 50 });

    expect(fetchMock).toHaveBeenCalledWith("https://ammv2.example/api/v1/pairs/0xpair/swaps?limit=50");
    expect(swaps.data[0]).toMatchObject({
      pairAddress: "0xpair",
      amount0In: 10n,
      amount1Out: 20n,
    });
  });

  it("decodes exact user positions", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      okJson({
        data: [
          {
            pairAddress: "0xpair",
            factoryAddress: "0xfactory",
            token0Address: "0x1",
            token1Address: "0x2",
            lpTokenAddress: "0xpair",
            lpBalance: "6000",
            totalLpSupply: "10000",
            poolShare: 60,
            amount0: "13200",
            amount1: "21600",
          },
        ],
      }) as Response,
    );

    const client = new AmmV2ApiClient("https://ammv2.example");
    const positions = await client.getUserPositions("0xalice");

    expect(fetchMock).toHaveBeenCalledWith("https://ammv2.example/api/v1/users/0xalice/positions");
    expect(positions).toEqual([
      {
        pairAddress: "0xpair",
        factoryAddress: "0xfactory",
        token0Address: "0x1",
        token1Address: "0x2",
        lpTokenAddress: "0xpair",
        lpBalance: 6000n,
        totalLpSupply: 10000n,
        poolShare: 60,
        amount0: 13200n,
        amount1: 21600n,
      },
    ]);
  });

  it("decodes pair stats with resource token supply", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      okJson({
        data: {
          pairAddress: "0xpair",
          reserve0: "1000",
          reserve1: "500",
          totalLpSupply: "100",
          feeAmount: "997",
          feeTo: "0xfee",
          spotPriceToken1PerToken0: 0.5,
          spotPriceToken0PerToken1: 2,
          volume0_24h: "10",
          volume1_24h: "20",
          lpFees0_24h: "1",
          lpFees1_24h: "0",
          swapCount24h: 4,
          resourceTokenSupply: "123456",
        },
      }) as Response,
    );

    const client = new AmmV2ApiClient("https://ammv2.example");
    const stats = await client.getPairStats("0xpair");

    expect(fetchMock).toHaveBeenCalledWith("https://ammv2.example/api/v1/pairs/0xpair/stats");
    expect(stats).toMatchObject({
      pairAddress: "0xpair",
      resourceTokenSupply: 123_456n,
    });
  });

  it("decodes pair stats with lp holder count", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      okJson({
        data: {
          pairAddress: "0xpair",
          reserve0: "1000",
          reserve1: "500",
          totalLpSupply: "100",
          feeAmount: "997",
          feeTo: "0xfee",
          spotPriceToken1PerToken0: 0.5,
          spotPriceToken0PerToken1: 2,
          volume0_24h: "10",
          volume1_24h: "20",
          lpFees0_24h: "1",
          lpFees1_24h: "0",
          swapCount24h: 4,
          resourceTokenSupply: null,
          lpHolderCount: 5,
        },
      }) as Response,
    );

    const client = new AmmV2ApiClient("https://ammv2.example");
    const stats = await client.getPairStats("0xpair");

    expect(stats).toMatchObject({
      pairAddress: "0xpair",
      lpHolderCount: 5,
    });
  });
});
