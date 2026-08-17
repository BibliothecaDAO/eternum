import { describe, expect, test } from "bun:test";

import { createAppchainIndexer, paddedWorldAddress, type AppchainIndexerOptions } from "../indexing/appchain-indexer";
import type { IndexerRequest } from "../types";

const REQUEST: IndexerRequest = {
  env: "appchain",
  rpcUrl: "https://katana.example",
  namespaces: "s1_eternum",
  worldName: "bltz-hot-add",
  worldAddress: "0xabc",
};

const PADDED = paddedWorldAddress(REQUEST.worldAddress);

const jsonResponse = (rows: unknown[]): Response =>
  new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } });

const createClock = () => {
  let nowMs = 0;
  const options: Pick<AppchainIndexerOptions, "now" | "sleep"> = {
    now: () => nowMs,
    sleep: async (durationMs) => {
      nowMs += durationMs;
    },
  };
  return { options };
};

describe("appchain indexer", () => {
  test("pads world addresses the way torii stores them", () => {
    expect(paddedWorldAddress("0xabc")).toBe(`0x${"abc".padStart(64, "0")}`);
  });

  test("waits for auto-registration and served data without any AWS calls", async () => {
    const fetchedQueries: string[] = [];
    let pollCount = 0;
    const clock = createClock();

    const result = await createAppchainIndexer(REQUEST, {
      ...clock.options,
      toriiUrl: "https://torii.example/",
      fetchImpl: (async (url: RequestInfo | URL) => {
        const query = decodeURIComponent(String(url).split("query=")[1] ?? "");
        fetchedQueries.push(query);
        pollCount += 1;

        // First poll: not registered yet. Then registered but no data. Then served.
        if (query.includes("FROM contracts")) {
          return jsonResponse(pollCount > 1 ? [{ ok: 1 }] : []);
        }
        return jsonResponse(pollCount > 3 ? [{ ok: 1 }] : []);
      }) as typeof fetch,
    });

    expect(result).toEqual({ mode: "github-actions", action: "already-live" });
    expect(fetchedQueries.some((query) => query.includes(`contract_address = '${PADDED}'`))).toBe(true);
    expect(fetchedQueries.some((query) => query.includes(`world_address = '${PADDED}'`))).toBe(true);
  });

  test("fails with a diagnostic when torii never discovers the world", async () => {
    const clock = createClock();

    await expect(
      createAppchainIndexer(REQUEST, {
        ...clock.options,
        toriiUrl: "https://torii.example",
        indexingTimeoutMs: 10_000,
        indexingPollMs: 5_000,
        fetchImpl: (async () => jsonResponse([])) as typeof fetch,
      }),
    ).rejects.toThrow(/auto-registration never happened/);
  });

  test("distinguishes a registered world whose data never arrives", async () => {
    const clock = createClock();

    await expect(
      createAppchainIndexer(REQUEST, {
        ...clock.options,
        toriiUrl: "https://torii.example",
        indexingTimeoutMs: 10_000,
        indexingPollMs: 5_000,
        fetchImpl: (async (url: RequestInfo | URL) =>
          jsonResponse(String(url).includes("FROM%20contracts") ? [{ ok: 1 }] : [])) as typeof fetch,
      }),
    ).rejects.toThrow(/no entity data arrived/);
  });
});
