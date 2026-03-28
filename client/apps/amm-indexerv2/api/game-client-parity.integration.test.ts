// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameAmmClient } from "../../game/src/services/amm/game-amm-client";
import { createAmmV2ApiApp } from "./app";
import { applyAmmV2BlockToDatabase } from "../indexers/ammv2-block-processor";
import {
  buildBlock,
  buildMintEvent,
  buildPairCreatedEvent,
  buildSwapEvent,
  buildSyncEvent,
  buildTransferEvent,
} from "../test-support/ammv2-events";
import { createTestAmmV2Database } from "../test-support/test-database";

const FACTORY = "0xfac" as const;
const PAIR = "0xaaa" as const;
const LORDS = "0x01" as const;
const WOOD = "0x02" as const;
const ROUTER = "0x111" as const;
const ALICE = "0xa1" as const;
const BOB = "0xb1" as const;
const BURN = "0x1" as const;
const INDEXED_AT = new Date("2026-03-26T00:00:00.000Z");
const EXPECTED_TIMESTAMP = Math.floor(INDEXED_AT.getTime() / 1000);
const EXPECTED_PRICE = 22_000 / 36_000;
const RESOURCE_SUPPLY = 36_000n;

describe("AMMv2 game client parity", () => {
  const cleanup: Array<() => Promise<void>> = [];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-26T12:00:00.000Z"));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.useRealTimers();

    while (cleanup.length > 0) {
      const close = cleanup.pop();
      if (close) {
        await close();
      }
    }
  });

  it("maps the indexer API into the SDK and game client contract without drift", async () => {
    const { db, close } = await createTestAmmV2Database();
    cleanup.push(close);

    await applyAmmV2BlockToDatabase({
      txDb: db,
      factoryAddress: FACTORY,
      block: buildBlock(
        [
          buildPairCreatedEvent({
            address: FACTORY,
            token0: LORDS,
            token1: WOOD,
            pair: PAIR,
            totalPairs: 1n,
            eventIndex: 0,
            transactionHash: "0xcreate",
          }),
          buildTransferEvent({
            address: PAIR,
            from: "0x0",
            to: BURN,
            amount: 1000n,
            eventIndex: 1,
            transactionHash: "0xmint",
          }),
          buildTransferEvent({
            address: PAIR,
            from: "0x0",
            to: ALICE,
            amount: 9000n,
            eventIndex: 2,
            transactionHash: "0xmint",
          }),
          buildSyncEvent({
            address: PAIR,
            reserve0: 20_000n,
            reserve1: 40_000n,
            eventIndex: 3,
            transactionHash: "0xmint",
          }),
          buildMintEvent({
            address: PAIR,
            sender: ROUTER,
            amount0: 20_000n,
            amount1: 40_000n,
            transactionSender: ALICE,
            eventIndex: 4,
            transactionHash: "0xmint",
          }),
          buildSyncEvent({
            address: PAIR,
            reserve0: 22_000n,
            reserve1: 36_000n,
            eventIndex: 5,
            transactionHash: "0xswap",
          }),
          buildSwapEvent({
            address: PAIR,
            sender: ROUTER,
            to: BOB,
            amount0In: 2_000n,
            amount1In: 0n,
            amount0Out: 0n,
            amount1Out: 4_000n,
            transactionSender: BOB,
            eventIndex: 6,
            transactionHash: "0xswap",
          }),
          buildTransferEvent({
            address: PAIR,
            from: ALICE,
            to: BOB,
            amount: 3_000n,
            eventIndex: 7,
            transactionHash: "0xmove",
          }),
        ],
        12n,
        INDEXED_AT,
      ),
    });

    const app = createAmmV2ApiApp({
      db,
      lordsAddress: LORDS,
      loadTokenTotalSupply: async (tokenAddress: string) => {
        expect(tokenAddress).toBe("0x2");
        return RESOURCE_SUPPLY;
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : new URL(input.url).toString();
        return app.request(url, init);
      }),
    );

    const client = new GameAmmClient({
      indexerUrl: "http://ammv2.local",
      lordsAddress: LORDS,
      routerAddress: ROUTER,
    });

    const pools = await client.api.getPools();
    expect(pools).toEqual([
      {
        pairAddress: PAIR,
        tokenAddress: "0x2",
        lpTokenAddress: PAIR,
        lordsReserve: 22_000n,
        tokenReserve: 36_000n,
        totalLpSupply: 10_000n,
        feeAmount: 997n,
        feeNum: 3n,
        feeDenom: 1000n,
        feeTo: "0x0",
      },
    ]);

    const stats = await client.api.getPoolStats(WOOD);
    expect(stats).toMatchObject({
      tokenAddress: "0x2",
      pairAddress: PAIR,
      tvlLords: 44_000n,
      volume24h: 2_000n,
      fees24h: 6n,
      swapCount24h: 1,
      feeTo: "0x0",
      resourceSupply: RESOURCE_SUPPLY,
      marketCapLords: 22_000n,
      lpHolderCount: 3,
    });
    expect(stats?.spotPrice).toBeCloseTo(EXPECTED_PRICE, 12);

    const swaps = await client.api.getSwapHistory(WOOD, { limit: 50 });
    expect(swaps.data).toEqual([
      {
        txHash: "0xswap",
        user: BOB,
        tokenIn: "0x1",
        tokenOut: "0x2",
        amountIn: 2_000n,
        amountOut: 4_000n,
        protocolFee: 0n,
        timestamp: EXPECTED_TIMESTAMP,
      },
    ]);

    const candles = await client.api.getPriceHistory(WOOD, "1h");
    expect(candles).toHaveLength(1);
    expect(candles[0]).toMatchObject({
      timestamp: EXPECTED_TIMESTAMP,
      volume: 2_000n,
    });
    expect(candles[0]?.open).toBeCloseTo(EXPECTED_PRICE, 12);
    expect(candles[0]?.close).toBeCloseTo(EXPECTED_PRICE, 12);
    expect(candles[0]?.high).toBeCloseTo(EXPECTED_PRICE, 12);
    expect(candles[0]?.low).toBeCloseTo(EXPECTED_PRICE, 12);

    const positions = await client.api.getUserPositions(ALICE);
    expect(positions).toEqual([
      {
        tokenAddress: "0x2",
        pairAddress: PAIR,
        lpTokenAddress: PAIR,
        lpBalance: 6_000n,
        poolShare: 60,
        lordsValue: 13_200n,
        tokenValue: 21_600n,
      },
    ]);
  }, 20_000);
});
