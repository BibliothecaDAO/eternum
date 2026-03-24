// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "../schema";
import { createTestAmmDatabase } from "../../test-support/test-database";
import {
  DEFAULT_STANDALONE_AMM_LORDS_ADDRESS,
  STANDALONE_PREVIEW_PROVIDER_ADDRESS,
  seedStandalonePreviewDatabase,
} from "./standalone-preview";
import { createAmmApiApp } from "../../api/app";

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

  it("hydrates standalone resource pools with swaps, liquidity, candles, and positions", async () => {
    const { db, close } = await createTestAmmDatabase();
    cleanup.push(close);

    await seedStandalonePreviewDatabase({ db });

    const pools = await db.select().from(schema.pools);
    const swaps = await db.select().from(schema.swaps);
    const liquidityEvents = await db.select().from(schema.liquidityEvents);
    const candles = await db.select().from(schema.priceCandles);
    const woodPool = (
      await db
        .select()
        .from(schema.pools)
        .where(eq(schema.pools.tokenAddress, "0x40d8907cec0f7ae9c364dfb12485a1314d84c129bf1898d2f3d4b7fcc7d44f4"))
        .limit(1)
    )[0];

    expect(pools.length).toBeGreaterThan(20);
    expect(swaps.length).toBeGreaterThan(20);
    expect(liquidityEvents.length).toBeGreaterThan(20);
    expect(candles.length).toBeGreaterThan(20);
    expect(woodPool).toMatchObject({
      tokenAddress: "0x40d8907cec0f7ae9c364dfb12485a1314d84c129bf1898d2f3d4b7fcc7d44f4",
    });

    const app = createAmmApiApp({
      db,
      lordsAddress: DEFAULT_STANDALONE_AMM_LORDS_ADDRESS,
    });
    const positionsResponse = await app.request(
      `http://amm.local/api/v1/users/${STANDALONE_PREVIEW_PROVIDER_ADDRESS}/positions`,
    );
    const positionsJson = await positionsResponse.json();

    expect(positionsJson.data.length).toBeGreaterThan(10);
  }, 20_000);

  it("replaces existing preview rows on repeat runs instead of duplicating them", async () => {
    const { db, close } = await createTestAmmDatabase();
    cleanup.push(close);

    await seedStandalonePreviewDatabase({ db });
    const firstRunCounts = {
      pools: (await db.select().from(schema.pools)).length,
      swaps: (await db.select().from(schema.swaps)).length,
      candles: (await db.select().from(schema.priceCandles)).length,
    };

    await seedStandalonePreviewDatabase({ db });
    const secondRunCounts = {
      pools: (await db.select().from(schema.pools)).length,
      swaps: (await db.select().from(schema.swaps)).length,
      candles: (await db.select().from(schema.priceCandles)).length,
    };

    expect(secondRunCounts).toEqual(firstRunCounts);
  }, 20_000);
});
