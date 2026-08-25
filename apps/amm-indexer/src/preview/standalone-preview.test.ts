// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";
import { createAmmV2ApiApp } from "../../api/app";
import * as schema from "../schema";
import { createTestAmmV2Database } from "../../test-support/test-database";
import {
  DEFAULT_STANDALONE_AMMV2_FACTORY_ADDRESS,
  STANDALONE_PREVIEW_PROVIDER_ADDRESS,
  seedStandalonePreviewDatabase,
} from "./standalone-preview";
import { DEFAULT_STANDALONE_AMMV2_LORDS_ADDRESS } from "@bibliothecadao/ammv2-sdk";

const PREVIEW_SEEDED_AT = new Date("2026-03-26T12:00:00.000Z");

describe("seedStandalonePreviewDatabase", () => {
  const cleanup: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      const close = cleanup.pop();
      if (close) {
        await close();
      }
    }
  });

  it("hydrates the v2 preview API with pairs, swaps, liquidity, candles, and positions", async () => {
    const { db, close } = await createTestAmmV2Database();
    cleanup.push(close);

    await seedStandalonePreviewDatabase({ db, now: PREVIEW_SEEDED_AT });

    const pairs = await db.select().from(schema.pairs);
    const swaps = await db.select().from(schema.pairSwaps);
    const liquidityEvents = await db.select().from(schema.pairLiquidityEvents);
    const candles = await db.select().from(schema.pairPriceCandles);
    const lpTransfers = await db.select().from(schema.pairLpTransfers);

    expect(pairs.length).toBeGreaterThan(10);
    expect(swaps.length).toBeGreaterThan(20);
    expect(liquidityEvents.length).toBeGreaterThan(10);
    expect(candles.length).toBeGreaterThan(20);
    expect(lpTransfers.length).toBeGreaterThan(15);

    const firstPair = pairs.find((pair) => pair.pairAddress === "0x91") ?? pairs[0];
    const app = createAmmV2ApiApp({ db });

    const pairsResponse = await app.request("http://ammv2.local/api/v1/pairs");
    const pairsJson = await pairsResponse.json();
    expect(pairsJson.data.length).toBe(pairs.length);
    expect(pairsJson.data[0].factoryAddress).toBe(DEFAULT_STANDALONE_AMMV2_FACTORY_ADDRESS);
    expect(
      pairsJson.data.every(
        (pair: { token0Address: string; token1Address: string }) =>
          pair.token0Address === DEFAULT_STANDALONE_AMMV2_LORDS_ADDRESS ||
          pair.token1Address === DEFAULT_STANDALONE_AMMV2_LORDS_ADDRESS,
      ),
    ).toBe(true);

    const lookupResponse = await app.request(
      `http://ammv2.local/api/v1/pairs/lookup?tokenA=${firstPair.token1Address}&tokenB=${firstPair.token0Address}`,
    );
    const lookupJson = await lookupResponse.json();
    expect(lookupJson.data).toMatchObject({
      pairAddress: firstPair.pairAddress,
      token0Address: firstPair.token0Address,
      token1Address: firstPair.token1Address,
    });

    const swapsResponse = await app.request(`http://ammv2.local/api/v1/pairs/${firstPair.pairAddress}/swaps`);
    const swapsJson = await swapsResponse.json();
    expect(swapsJson.data.length).toBeGreaterThan(0);

    const candlesResponse = await app.request(
      `http://ammv2.local/api/v1/pairs/${firstPair.pairAddress}/candles?interval=1h`,
    );
    const candlesJson = await candlesResponse.json();
    expect(candlesJson.data.length).toBeGreaterThan(0);

    const positionsResponse = await app.request(
      `http://ammv2.local/api/v1/users/${STANDALONE_PREVIEW_PROVIDER_ADDRESS}/positions`,
    );
    const positionsJson = await positionsResponse.json();
    expect(positionsJson.data.length).toBeGreaterThan(10);
  }, 20_000);

  it("replaces existing preview rows on repeat runs instead of duplicating them", async () => {
    const { db, close } = await createTestAmmV2Database();
    cleanup.push(close);

    await seedStandalonePreviewDatabase({ db, now: PREVIEW_SEEDED_AT });
    const firstRunCounts = {
      pairs: (await db.select().from(schema.pairs)).length,
      swaps: (await db.select().from(schema.pairSwaps)).length,
      candles: (await db.select().from(schema.pairPriceCandles)).length,
      positions: (await db.select().from(schema.pairLpBalances)).length,
    };

    await seedStandalonePreviewDatabase({ db, now: PREVIEW_SEEDED_AT });
    const secondRunCounts = {
      pairs: (await db.select().from(schema.pairs)).length,
      swaps: (await db.select().from(schema.pairSwaps)).length,
      candles: (await db.select().from(schema.pairPriceCandles)).length,
      positions: (await db.select().from(schema.pairLpBalances)).length,
    };

    expect(secondRunCounts).toEqual(firstRunCounts);
  }, 20_000);
});
