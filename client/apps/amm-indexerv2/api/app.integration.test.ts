// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAmmV2ApiApp } from "./app";
import {
  buildBlock,
  buildMintEvent,
  buildPairCreatedEvent,
  buildSwapEvent,
  buildSyncEvent,
  buildTransferEvent,
} from "../test-support/ammv2-events";
import { createTestAmmV2Database } from "../test-support/test-database";
import { applyAmmV2BlockToDatabase } from "../indexers/ammv2-block-processor";

const FACTORY = "0xfac" as const;
const PAIR = "0xaaa" as const;
const TOKEN_0 = "0x01" as const;
const TOKEN_1 = "0x02" as const;
const LORDS = TOKEN_0;
const RESOURCE = TOKEN_1;
const ROUTER = "0x111" as const;
const ALICE = "0xa1" as const;
const BOB = "0xb1" as const;
const BURN = "0x1" as const;

describe("createAmmV2ApiApp", () => {
  const cleanup: Array<() => Promise<void>> = [];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-26T12:00:00.000Z"));
  });

  afterEach(async () => {
    vi.useRealTimers();

    while (cleanup.length > 0) {
      const close = cleanup.pop();
      if (close) {
        await close();
      }
    }
  });

  it("serves v2-native pair rows, history, candles, lookup, and stats", async () => {
    const { db, close } = await createTestAmmV2Database();
    cleanup.push(close);
    const indexedAt = new Date("2026-03-26T00:00:00.000Z");

    await applyAmmV2BlockToDatabase({
      txDb: db,
      factoryAddress: FACTORY,
      block: buildBlock(
        [
          buildPairCreatedEvent({
            address: FACTORY,
            token0: TOKEN_0,
            token1: TOKEN_1,
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
        indexedAt,
      ),
    });

    const app = createAmmV2ApiApp({ db });

    const pairsResponse = await app.request("http://ammv2.local/api/v1/pairs");
    const pairsJson = await pairsResponse.json();
    expect(pairsJson.data).toHaveLength(1);
    expect(pairsJson.data[0]).toMatchObject({
      pairAddress: PAIR,
      token0Address: "0x1",
      token1Address: "0x2",
      totalLpSupply: "10000",
      feeAmount: "997",
    });

    const lookupResponse = await app.request(
      `http://ammv2.local/api/v1/pairs/lookup?tokenA=${TOKEN_1}&tokenB=${TOKEN_0}`,
    );
    const lookupJson = await lookupResponse.json();
    expect(lookupJson.data).toMatchObject({
      pairAddress: PAIR,
    });

    const swapsResponse = await app.request(`http://ammv2.local/api/v1/pairs/${PAIR}/swaps`);
    const swapsJson = await swapsResponse.json();
    expect(swapsJson.data).toHaveLength(1);
    expect(swapsJson.data[0]).toMatchObject({
      initiatorAddress: BOB,
      amount0In: "2000",
      amount1Out: "4000",
    });

    const liquidityResponse = await app.request(`http://ammv2.local/api/v1/pairs/${PAIR}/liquidity`);
    const liquidityJson = await liquidityResponse.json();
    expect(liquidityJson.data).toHaveLength(1);
    expect(liquidityJson.data[0]).toMatchObject({
      providerAddress: ALICE,
      eventType: "add",
      lpAmount: "9000",
    });

    const candlesResponse = await app.request(`http://ammv2.local/api/v1/pairs/${PAIR}/candles?interval=1h`);
    const candlesJson = await candlesResponse.json();
    expect(candlesJson.data).toHaveLength(1);

    const statsResponse = await app.request(`http://ammv2.local/api/v1/pairs/${PAIR}/stats`);
    const statsJson = await statsResponse.json();
    expect(statsJson.data).toMatchObject({
      pairAddress: PAIR,
      reserve0: "22000",
      reserve1: "36000",
      totalLpSupply: "10000",
      volume0_24h: "2000",
      volume1_24h: "4000",
      lpFees0_24h: "6",
      lpFees1_24h: "0",
      swapCount24h: 1,
    });

    const alicePositionsResponse = await app.request(`http://ammv2.local/api/v1/users/${ALICE}/positions`);
    const alicePositionsJson = await alicePositionsResponse.json();
    expect(alicePositionsJson.data).toEqual([
      {
        pairAddress: PAIR,
        factoryAddress: FACTORY,
        token0Address: "0x1",
        token1Address: "0x2",
        lpTokenAddress: PAIR,
        lpBalance: "6000",
        totalLpSupply: "10000",
        poolShare: 60,
        amount0: "13200",
        amount1: "21600",
      },
    ]);

    const bobPositionsResponse = await app.request(`http://ammv2.local/api/v1/users/${BOB}/positions`);
    const bobPositionsJson = await bobPositionsResponse.json();
    expect(bobPositionsJson.data).toEqual([
      {
        pairAddress: PAIR,
        factoryAddress: FACTORY,
        token0Address: "0x1",
        token1Address: "0x2",
        lpTokenAddress: PAIR,
        lpBalance: "3000",
        totalLpSupply: "10000",
        poolShare: 30,
        amount0: "6600",
        amount1: "10800",
      },
    ]);
  });

  it("serves pair stats with resource token supply", async () => {
    const { db, close } = await createTestAmmV2Database();
    cleanup.push(close);
    const indexedAt = new Date("2026-03-26T00:00:00.000Z");
    const loadTokenTotalSupply = async (tokenAddress: string) => {
      expect(tokenAddress).toBe("0x2");
      return 123_456n;
    };

    await applyAmmV2BlockToDatabase({
      txDb: db,
      factoryAddress: FACTORY,
      block: buildBlock(
        [
          buildPairCreatedEvent({
            address: FACTORY,
            token0: LORDS,
            token1: RESOURCE,
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
        ],
        12n,
        indexedAt,
      ),
    });

    const app = createAmmV2ApiApp({
      db,
      lordsAddress: LORDS,
      loadTokenTotalSupply,
    });

    const statsResponse = await app.request(`http://ammv2.local/api/v1/pairs/${PAIR}/stats`);
    const statsJson = await statsResponse.json();

    expect(statsJson.data).toMatchObject({
      pairAddress: PAIR,
      resourceTokenSupply: "123456",
    });
  });

  it("includes lp holder count in pair stats", async () => {
    const { db, close } = await createTestAmmV2Database();
    cleanup.push(close);
    const indexedAt = new Date("2026-03-26T00:00:00.000Z");

    await applyAmmV2BlockToDatabase({
      txDb: db,
      factoryAddress: FACTORY,
      block: buildBlock(
        [
          buildPairCreatedEvent({
            address: FACTORY,
            token0: TOKEN_0,
            token1: TOKEN_1,
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
          buildTransferEvent({
            address: PAIR,
            from: ALICE,
            to: BOB,
            amount: 3_000n,
            eventIndex: 5,
            transactionHash: "0xmove",
          }),
        ],
        12n,
        indexedAt,
      ),
    });

    const app = createAmmV2ApiApp({ db });

    const statsResponse = await app.request(`http://ammv2.local/api/v1/pairs/${PAIR}/stats`);
    const statsJson = await statsResponse.json();

    expect(statsJson.data).toMatchObject({
      pairAddress: PAIR,
      lpHolderCount: 3,
    });
  });

  it("allows localhost browser origins", async () => {
    const { db, close } = await createTestAmmV2Database();
    cleanup.push(close);
    const app = createAmmV2ApiApp({ db });

    const response = await app.request("http://ammv2.local/api/v1/pairs", {
      headers: {
        Origin: "https://localhost:5176",
      },
    });

    expect(response.headers.get("access-control-allow-origin")).toBe("https://localhost:5176");
  });

  it("allows configured browser origins", async () => {
    const { db, close } = await createTestAmmV2Database();
    cleanup.push(close);
    const app = createAmmV2ApiApp({
      db,
      allowedOrigins: ["https://eternum.realms.world"],
    });

    const response = await app.request("http://ammv2.local/api/v1/pairs", {
      headers: {
        Origin: "https://eternum.realms.world",
      },
    });

    expect(response.headers.get("access-control-allow-origin")).toBe("https://eternum.realms.world");
  });

  it("allows first-party Realms browser origins without extra configuration", async () => {
    const { db, close } = await createTestAmmV2Database();
    cleanup.push(close);
    const app = createAmmV2ApiApp({ db });

    const response = await app.request("http://ammv2.local/api/v1/pairs", {
      headers: {
        Origin: "https://blitz.realms.world",
      },
    });

    expect(response.headers.get("access-control-allow-origin")).toBe("https://blitz.realms.world");
  });

  it("rejects lookalike browser origins", async () => {
    const { db, close } = await createTestAmmV2Database();
    cleanup.push(close);
    const app = createAmmV2ApiApp({ db });

    const response = await app.request("http://ammv2.local/api/v1/pairs", {
      headers: {
        Origin: "https://blitz.realms.world.attacker.example",
      },
    });

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});
