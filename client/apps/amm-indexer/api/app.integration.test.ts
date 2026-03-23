// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";
import { getInputPrice } from "@bibliothecadao/amm-sdk";
import { createAmmApiApp } from "./app";
import {
  buildBlock,
  buildLiquidityAddedEvent,
  buildPoolCreatedEvent,
  buildSwapEvent,
} from "../test-support/amm-events";
import { createTestAmmDatabase } from "../test-support/test-database";
import { applyAmmBlockToDatabase } from "../indexers/amm-block-processor";

const AMM_ADDRESS = "0xaaa" as const;
const LORDS_ADDRESS = "0x1" as const;
const TOKEN_A = "0x2" as const;
const ALICE = "0xa" as const;
const LP_A = "0x22" as const;

describe("createAmmApiApp", () => {
  const cleanup: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      const close = cleanup.pop();
      if (close) {
        await close();
      }
    }
  });

  it("serves indexed pools, positions, stats, and direct quotes from persisted state", async () => {
    const { db, close } = await createTestAmmDatabase();
    cleanup.push(close);
    const indexedAt = new Date();

    await applyAmmBlockToDatabase({
      txDb: db,
      lordsAddress: LORDS_ADDRESS,
      block: buildBlock(
        [
          buildPoolCreatedEvent({
            address: AMM_ADDRESS,
            token: TOKEN_A,
            lpToken: LP_A,
            lpFeeNum: 3n,
            lpFeeDenom: 1000n,
            protocolFeeNum: 1n,
            protocolFeeDenom: 100n,
          }),
          buildLiquidityAddedEvent({
            address: AMM_ADDRESS,
            token: TOKEN_A,
            provider: ALICE,
            lordsAmount: 5000n,
            tokenAmount: 10_000n,
            lpMinted: 4000n,
            eventIndex: 1,
          }),
          buildSwapEvent({
            address: AMM_ADDRESS,
            user: "0xb",
            tokenIn: LORDS_ADDRESS,
            tokenOut: TOKEN_A,
            amountIn: 500n,
            amountOut: 450n,
            protocolFee: 50n,
            eventIndex: 2,
          }),
        ],
        10n,
        indexedAt,
      ),
    });

    const app = createAmmApiApp({
      db,
      lordsAddress: LORDS_ADDRESS,
    });

    const poolsResponse = await app.request("http://amm.local/api/v1/pools");
    const poolsJson = await poolsResponse.json();
    expect(poolsJson.data).toHaveLength(1);
    expect(poolsJson.data[0]).toMatchObject({
      tokenAddress: TOKEN_A,
      totalLpSupply: "5000",
    });

    const positionsResponse = await app.request(`http://amm.local/api/v1/users/${ALICE}/positions`);
    const positionsJson = await positionsResponse.json();
    expect(positionsJson.data).toEqual([
      {
        tokenAddress: TOKEN_A,
        lpBalance: "4000",
        poolShare: 80,
        lordsValue: "4400",
        tokenValue: "7600",
      },
    ]);

    const statsResponse = await app.request(`http://amm.local/api/v1/pools/${TOKEN_A}/stats`);
    const statsJson = await statsResponse.json();
    expect(statsJson.data).toMatchObject({
      tokenAddress: TOKEN_A,
      lordsReserve: "5500",
      tokenReserve: "9500",
      totalLpSupply: "5000",
      volume24h: "500",
      fees24h: "50",
      trades24h: 1,
      tvl: "11000",
    });

    const swapsResponse = await app.request(`http://amm.local/api/v1/pools/${TOKEN_A}/swaps`);
    const swapsJson = await swapsResponse.json();
    expect(swapsJson.data).toHaveLength(1);
    expect(swapsJson.data[0]).toMatchObject({
      tokenAddress: TOKEN_A,
      amountIn: "500",
      amountOut: "450",
      protocolFee: "50",
    });

    const candlesResponse = await app.request(`http://amm.local/api/v1/pools/${TOKEN_A}/candles?interval=1h`);
    const candlesJson = await candlesResponse.json();
    expect(candlesJson.data).toHaveLength(1);

    const amountIn = 500n;
    const grossOut = getInputPrice(3n, 1000n, amountIn, 5500n, 9500n);
    const expectedProtocolFee = (grossOut * 1n) / 100n;
    const expectedNetOut = grossOut - expectedProtocolFee;
    const quoteResponse = await app.request(
      `http://amm.local/api/v1/quote?tokenIn=${LORDS_ADDRESS}&tokenOut=${TOKEN_A}&amountIn=${amountIn.toString()}`,
    );
    const quoteJson = await quoteResponse.json();
    expect(quoteJson.data).toMatchObject({
      amountIn: "500",
      amountOut: expectedNetOut.toString(),
      protocolFee: expectedProtocolFee.toString(),
      route: [TOKEN_A],
    });
  });
});
