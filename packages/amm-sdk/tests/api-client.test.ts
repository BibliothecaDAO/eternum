import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AmmApiClient } from "../src/api/client";

const okJson = (payload: unknown) => ({
  ok: true,
  status: 200,
  statusText: "OK",
  json: async () => payload,
});

describe("AmmApiClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes the base URL to /api/v1 and decodes wrapped pools", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      okJson({
        data: [
          {
            tokenAddress: "0x2",
            lpTokenAddress: "0x100",
            lordsReserve: "1000",
            tokenReserve: "5000",
            totalLpSupply: "250",
            lpFeeNum: "3",
            lpFeeDenom: "1000",
            protocolFeeNum: "1",
            protocolFeeDenom: "1000",
          },
        ],
      }) as Response,
    );

    const client = new AmmApiClient("https://amm.example");
    const pools = await client.getPools();

    expect(fetchMock).toHaveBeenCalledWith("https://amm.example/api/v1/pools");
    expect(pools).toEqual([
      {
        tokenAddress: "0x2",
        lpTokenAddress: "0x100",
        lordsReserve: 1000n,
        tokenReserve: 5000n,
        totalLpSupply: 250n,
        feeNum: 3n,
        feeDenom: 1000n,
        protocolFeeNum: 1n,
        protocolFeeDenom: 1000n,
      },
    ]);
  });

  it("decodes wrapped paginated swap history into typed rows", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      okJson({
        data: [
          {
            txHash: "0xabc",
            userAddress: "0x123",
            tokenIn: "0x1",
            tokenOut: "0x2",
            amountIn: "300",
            amountOut: "270",
            protocolFee: "3",
            blockTimestamp: "2026-03-23T00:00:05.000Z",
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

    const client = new AmmApiClient("https://amm.example/api/v1");
    const swaps = await client.getSwapHistory("0x2", { limit: 50 });

    expect(fetchMock).toHaveBeenCalledWith("https://amm.example/api/v1/pools/0x2/swaps?limit=50");
    expect(swaps).toEqual({
      data: [
        {
          txHash: "0xabc",
          user: "0x123",
          tokenIn: "0x1",
          tokenOut: "0x2",
          amountIn: 300n,
          amountOut: 270n,
          protocolFee: 3n,
          timestamp: 1774224005,
        },
      ],
      pagination: {
        total: 1,
        limit: 50,
        offset: 0,
      },
    });
  });

  it("decodes wrapped candle payloads", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      okJson({
        data: [
          {
            openTime: "2026-03-23T00:00:00.000Z",
            open: "1.25",
            high: "1.40",
            low: "1.10",
            close: "1.35",
            volume: "999",
          },
        ],
      }) as Response,
    );

    const client = new AmmApiClient("https://amm.example");
    const candles = await client.getPriceHistory("0x2", "1h");

    expect(candles).toEqual([
      {
        timestamp: 1774224000,
        open: 1.25,
        high: 1.4,
        low: 1.1,
        close: 1.35,
        volume: 999n,
      },
    ]);
  });

  it("decodes wrapped user positions", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      okJson({
        data: [
          {
            tokenAddress: "0x2",
            lpBalance: "12",
            poolShare: 4.8,
            lordsValue: "200",
            tokenValue: "1000",
          },
        ],
      }) as Response,
    );

    const client = new AmmApiClient("https://amm.example");
    const positions = await client.getUserPositions("0xuser");

    expect(positions).toEqual([
      {
        tokenAddress: "0x2",
        lpBalance: 12n,
        poolShare: 4.8,
        lordsValue: 200n,
        tokenValue: 1000n,
      },
    ]);
  });
});
