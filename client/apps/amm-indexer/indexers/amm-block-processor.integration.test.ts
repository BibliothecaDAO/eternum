// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "../src/schema";
import {
  buildBlock,
  buildLiquidityAddedEvent,
  buildLiquidityRemovedEvent,
  buildPoolCreatedEvent,
  buildPoolFeeChangedEvent,
  buildSwapEvent,
} from "../test-support/amm-events";
import { createTestAmmDatabase } from "../test-support/test-database";
import { applyAmmBlockToDatabase } from "./amm-block-processor";

const AMM_ADDRESS = "0xaaa" as const;
const LORDS_ADDRESS = "0x1" as const;
const TOKEN_A = "0x2" as const;
const TOKEN_B = "0x3" as const;
const ALICE = "0xa" as const;
const LP_A = "0x22" as const;
const LP_B = "0x33" as const;

describe("applyAmmBlockToDatabase", () => {
  const cleanup: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      const close = cleanup.pop();
      if (close) {
        await close();
      }
    }
  });

  it("tracks the locked minimum liquidity on first add and full redeemable exit", async () => {
    const { db, close } = await createTestAmmDatabase();
    cleanup.push(close);

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
        ],
        1n,
      ),
    });

    const seededPool = (await db.select().from(schema.pools).where(eq(schema.pools.tokenAddress, TOKEN_A)).limit(1))[0];
    expect(seededPool).toMatchObject({
      lordsReserve: "5000",
      tokenReserve: "10000",
      totalLpSupply: "5000",
    });

    await applyAmmBlockToDatabase({
      txDb: db,
      lordsAddress: LORDS_ADDRESS,
      block: buildBlock(
        [
          buildLiquidityRemovedEvent({
            address: AMM_ADDRESS,
            token: TOKEN_A,
            provider: ALICE,
            lordsAmount: 4000n,
            tokenAmount: 8000n,
            lpBurned: 4000n,
          }),
        ],
        2n,
      ),
    });

    const remainingPool = (
      await db.select().from(schema.pools).where(eq(schema.pools.tokenAddress, TOKEN_A)).limit(1)
    )[0];
    expect(remainingPool).toMatchObject({
      lordsReserve: "1000",
      tokenReserve: "2000",
      totalLpSupply: "1000",
    });

    const liquidityRows = await db
      .select()
      .from(schema.liquidityEvents)
      .where(eq(schema.liquidityEvents.tokenAddress, TOKEN_A));
    expect(liquidityRows).toHaveLength(2);
    expect(liquidityRows.map((row) => row.lpAmount)).toEqual(["4000", "4000"]);
  });

  it("persists routed swaps into both touched pools and candle streams", async () => {
    const { db, close } = await createTestAmmDatabase();
    cleanup.push(close);

    await db.insert(schema.pools).values([
      {
        tokenAddress: TOKEN_A,
        lpTokenAddress: LP_A,
        lordsReserve: "10000",
        tokenReserve: "5000",
        totalLpSupply: "10000",
        lpFeeNum: "3",
        lpFeeDenom: "1000",
        protocolFeeNum: "1",
        protocolFeeDenom: "100",
        blockNumber: 1n,
        txHash: "0xseed-a",
      },
      {
        tokenAddress: TOKEN_B,
        lpTokenAddress: LP_B,
        lordsReserve: "8000",
        tokenReserve: "16000",
        totalLpSupply: "8000",
        lpFeeNum: "3",
        lpFeeDenom: "1000",
        protocolFeeNum: "1",
        protocolFeeDenom: "100",
        blockNumber: 1n,
        txHash: "0xseed-b",
      },
    ]);

    await applyAmmBlockToDatabase({
      txDb: db,
      lordsAddress: LORDS_ADDRESS,
      block: buildBlock(
        [
          buildSwapEvent({
            address: AMM_ADDRESS,
            user: ALICE,
            tokenIn: TOKEN_A,
            tokenOut: TOKEN_B,
            amountIn: 500n,
            amountOut: 1590n,
            protocolFee: 0n,
          }),
        ],
        3n,
      ),
    });

    const swaps = await db.select().from(schema.swaps).orderBy(schema.swaps.tokenAddress);
    expect(swaps).toHaveLength(2);
    expect(swaps.map((swap) => swap.tokenAddress)).toEqual([TOKEN_A, TOKEN_B]);

    const pools = await db.select().from(schema.pools).orderBy(schema.pools.tokenAddress);
    expect(pools[0].tokenReserve).toBe("5500");
    expect(BigInt(pools[0].lordsReserve)).toBeLessThan(10000n);
    expect(BigInt(pools[1].lordsReserve)).toBeGreaterThan(8000n);
    expect(BigInt(pools[1].tokenReserve)).toBeLessThan(16000n);

    const candles = await db.select().from(schema.priceCandles);
    expect(candles).toHaveLength(12);
  });

  it("records pool fee changes in history and current pool state", async () => {
    const { db, close } = await createTestAmmDatabase();
    cleanup.push(close);

    await db.insert(schema.pools).values({
      tokenAddress: TOKEN_A,
      lpTokenAddress: LP_A,
      lordsReserve: "1000",
      tokenReserve: "2000",
      totalLpSupply: "1000",
      lpFeeNum: "3",
      lpFeeDenom: "1000",
      protocolFeeNum: "1",
      protocolFeeDenom: "100",
      blockNumber: 1n,
      txHash: "0xseed",
    });

    await applyAmmBlockToDatabase({
      txDb: db,
      lordsAddress: LORDS_ADDRESS,
      block: buildBlock(
        [
          buildPoolFeeChangedEvent({
            address: AMM_ADDRESS,
            token: TOKEN_A,
            lpFeeNum: 5n,
            lpFeeDenom: 1000n,
            protocolFeeNum: 2n,
            protocolFeeDenom: 100n,
          }),
        ],
        4n,
      ),
    });

    const pool = (await db.select().from(schema.pools).where(eq(schema.pools.tokenAddress, TOKEN_A)).limit(1))[0];
    expect(pool).toMatchObject({
      lpFeeNum: "5",
      lpFeeDenom: "1000",
      protocolFeeNum: "2",
      protocolFeeDenom: "100",
    });

    const history = await db
      .select()
      .from(schema.poolFeeChanges)
      .where(eq(schema.poolFeeChanges.tokenAddress, TOKEN_A));
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      lpFeeNum: "5",
      protocolFeeNum: "2",
    });
  });
});
