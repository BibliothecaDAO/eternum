// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "../src/schema";
import {
  buildBlock,
  buildBurnEvent,
  buildFeeAmountChangedEvent,
  buildMintEvent,
  buildPairCreatedEvent,
  buildSwapEvent,
  buildSyncEvent,
  buildTransferEvent,
} from "../test-support/ammv2-events";
import { createTestAmmV2Database } from "../test-support/test-database";
import { applyAmmV2BlockToDatabase } from "./ammv2-block-processor";

const FACTORY = "0xfac" as const;
const PAIR_A = "0xaaa" as const;
const PAIR_B = "0xbbb" as const;
const TOKEN_0 = "0x01" as const;
const TOKEN_1 = "0x02" as const;
const TOKEN_2 = "0x03" as const;
const ROUTER = "0x111" as const;
const ALICE = "0xa1" as const;
const BOB = "0xb1" as const;
const BURN = "0x1" as const;

describe("applyAmmV2BlockToDatabase", () => {
  const cleanup: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      const close = cleanup.pop();
      if (close) {
        await close();
      }
    }
  });

  it("tracks pair creation and factory fee updates", async () => {
    const { db, close } = await createTestAmmV2Database();
    cleanup.push(close);

    await applyAmmV2BlockToDatabase({
      txDb: db,
      factoryAddress: FACTORY,
      block: buildBlock(
        [
          buildPairCreatedEvent({
            address: FACTORY,
            token0: TOKEN_0,
            token1: TOKEN_1,
            pair: PAIR_A,
            totalPairs: 1n,
            eventIndex: 0,
          }),
          buildFeeAmountChangedEvent({
            address: FACTORY,
            oldFeeAmount: 997n,
            newFeeAmount: 996n,
            eventIndex: 1,
          }),
        ],
        10n,
      ),
    });

    const factory = (
      await db.select().from(schema.factories).where(eq(schema.factories.factoryAddress, FACTORY)).limit(1)
    )[0];
    const pair = (await db.select().from(schema.pairs).where(eq(schema.pairs.pairAddress, PAIR_A)).limit(1))[0];
    const feeHistory = await db.select().from(schema.factoryFeeChanges);

    expect(factory).toMatchObject({
      factoryAddress: FACTORY,
      feeAmount: "996",
      pairCount: 1n,
    });
    expect(pair).toMatchObject({
      pairAddress: PAIR_A,
      token0Address: "0x1",
      token1Address: "0x2",
      lpTokenAddress: PAIR_A,
    });
    expect(feeHistory).toHaveLength(1);
  });

  it("tracks exact LP balances across liquidity flows and direct transfers", async () => {
    const { db, close } = await createTestAmmV2Database();
    cleanup.push(close);

    await applyAmmV2BlockToDatabase({
      txDb: db,
      factoryAddress: FACTORY,
      block: buildBlock(
        [
          buildPairCreatedEvent({
            address: FACTORY,
            token0: TOKEN_0,
            token1: TOKEN_1,
            pair: PAIR_A,
            totalPairs: 1n,
          }),
        ],
        1n,
      ),
    });

    await applyAmmV2BlockToDatabase({
      txDb: db,
      factoryAddress: FACTORY,
      block: buildBlock(
        [
          buildTransferEvent({
            address: PAIR_A,
            from: "0x0",
            to: BURN,
            amount: 1000n,
            eventIndex: 0,
            transactionHash: "0xmint",
          }),
          buildTransferEvent({
            address: PAIR_A,
            from: "0x0",
            to: ALICE,
            amount: 9000n,
            eventIndex: 1,
            transactionHash: "0xmint",
          }),
          buildSyncEvent({
            address: PAIR_A,
            reserve0: 20_000n,
            reserve1: 40_000n,
            eventIndex: 2,
            transactionHash: "0xmint",
          }),
          buildMintEvent({
            address: PAIR_A,
            sender: ROUTER,
            amount0: 20_000n,
            amount1: 40_000n,
            transactionSender: ALICE,
            eventIndex: 3,
            transactionHash: "0xmint",
          }),
        ],
        2n,
      ),
    });

    await applyAmmV2BlockToDatabase({
      txDb: db,
      factoryAddress: FACTORY,
      block: buildBlock(
        [
          buildTransferEvent({
            address: PAIR_A,
            from: ALICE,
            to: BOB,
            amount: 2_000n,
            eventIndex: 0,
            transactionHash: "0xmove",
          }),
        ],
        3n,
      ),
    });

    await applyAmmV2BlockToDatabase({
      txDb: db,
      factoryAddress: FACTORY,
      block: buildBlock(
        [
          buildTransferEvent({
            address: PAIR_A,
            from: ALICE,
            to: PAIR_A,
            amount: 4_000n,
            eventIndex: 0,
            transactionHash: "0xburn",
          }),
          buildTransferEvent({
            address: PAIR_A,
            from: PAIR_A,
            to: "0x0",
            amount: 4_000n,
            eventIndex: 1,
            transactionHash: "0xburn",
          }),
          buildSyncEvent({
            address: PAIR_A,
            reserve0: 12_000n,
            reserve1: 24_000n,
            eventIndex: 2,
            transactionHash: "0xburn",
          }),
          buildBurnEvent({
            address: PAIR_A,
            sender: ROUTER,
            to: ALICE,
            amount0: 8_000n,
            amount1: 16_000n,
            transactionSender: ALICE,
            eventIndex: 3,
            transactionHash: "0xburn",
          }),
        ],
        4n,
      ),
    });

    const pair = (await db.select().from(schema.pairs).where(eq(schema.pairs.pairAddress, PAIR_A)).limit(1))[0];
    const liquidityRows = await db
      .select()
      .from(schema.pairLiquidityEvents)
      .orderBy(schema.pairLiquidityEvents.eventIndex);
    const lpTransferRows = await db.select().from(schema.pairLpTransfers);
    const lpBalances = await db.select().from(schema.pairLpBalances);
    const balancesByOwner = new Map(lpBalances.map((row: any) => [row.ownerAddress, row.balance]));

    expect(pair).toMatchObject({
      reserve0: "12000",
      reserve1: "24000",
      totalLpSupply: "6000",
    });
    expect(liquidityRows).toHaveLength(2);
    expect(liquidityRows[0]).toMatchObject({
      providerAddress: ALICE,
      eventType: "add",
      lpAmount: "9000",
    });
    expect(liquidityRows[1]).toMatchObject({
      providerAddress: ALICE,
      eventType: "remove",
      lpAmount: "4000",
    });
    expect(lpTransferRows).toHaveLength(5);
    expect(balancesByOwner.get(BURN)).toBe("1000");
    expect(balancesByOwner.get(ALICE)).toBe("3000");
    expect(balancesByOwner.get(BOB)).toBe("2000");
    expect(balancesByOwner.get(PAIR_A)).toBe("0");
  });

  it("records one swap row per touched pair and updates candles independently", async () => {
    const { db, close } = await createTestAmmV2Database();
    cleanup.push(close);

    await applyAmmV2BlockToDatabase({
      txDb: db,
      factoryAddress: FACTORY,
      block: buildBlock(
        [
          buildPairCreatedEvent({
            address: FACTORY,
            token0: TOKEN_0,
            token1: TOKEN_1,
            pair: PAIR_A,
            totalPairs: 1n,
            eventIndex: 0,
          }),
          buildPairCreatedEvent({
            address: FACTORY,
            token0: TOKEN_1,
            token1: TOKEN_2,
            pair: PAIR_B,
            totalPairs: 2n,
            eventIndex: 1,
          }),
        ],
        1n,
      ),
    });

    await db
      .update(schema.pairs)
      .set({
        reserve0: "10000",
        reserve1: "20000",
        totalLpSupply: "30000",
      })
      .where(eq(schema.pairs.pairAddress, PAIR_A));
    await db
      .update(schema.pairs)
      .set({
        reserve0: "15000",
        reserve1: "5000",
        totalLpSupply: "12000",
      })
      .where(eq(schema.pairs.pairAddress, PAIR_B));

    await applyAmmV2BlockToDatabase({
      txDb: db,
      factoryAddress: FACTORY,
      block: buildBlock(
        [
          buildSyncEvent({
            address: PAIR_A,
            reserve0: 12_000n,
            reserve1: 16_000n,
            eventIndex: 0,
            transactionHash: "0xroute",
          }),
          buildSwapEvent({
            address: PAIR_A,
            sender: ROUTER,
            to: ROUTER,
            amount0In: 2_000n,
            amount1In: 0n,
            amount0Out: 0n,
            amount1Out: 4_000n,
            transactionSender: BOB,
            eventIndex: 1,
            transactionHash: "0xroute",
          }),
          buildSyncEvent({
            address: PAIR_B,
            reserve0: 19_000n,
            reserve1: 4_000n,
            eventIndex: 2,
            transactionHash: "0xroute",
          }),
          buildSwapEvent({
            address: PAIR_B,
            sender: ROUTER,
            to: BOB,
            amount0In: 4_000n,
            amount1In: 0n,
            amount0Out: 0n,
            amount1Out: 1_000n,
            transactionSender: BOB,
            eventIndex: 3,
            transactionHash: "0xroute",
          }),
        ],
        3n,
      ),
    });

    const swaps = await db.select().from(schema.pairSwaps).orderBy(schema.pairSwaps.pairAddress);
    const candles = await db.select().from(schema.pairPriceCandles).orderBy(schema.pairPriceCandles.pairAddress);

    expect(swaps).toHaveLength(2);
    expect(swaps.map((swap: any) => swap.pairAddress)).toEqual([PAIR_A, PAIR_B]);
    expect(candles).toHaveLength(12);
  });
});
