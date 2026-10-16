// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { GameAmmClient } from "./game-amm-client";

const client = () => new GameAmmClient({ indexerUrl: "https://amm.test", lordsAddress: "0x1", routerAddress: "0x2" });
afterEach(() => vi.unstubAllGlobals());

it("keeps a missing pair separate from an unavailable indexer in every lookup consumer", async () => {
  const fetch = vi.fn().mockImplementation(async () => new Response(null, { status: 404 }));
  vi.stubGlobal("fetch", fetch);
  const api = client().api;
  expect(await api.getPoolStats("0x3")).toBeNull();
  expect(await api.getSwapHistory("0x3")).toEqual({ data: [], pagination: { total: 0, limit: 50, offset: 0 } });
  expect(await api.getLiquidityHistory("0x3")).toEqual({ data: [], pagination: { total: 0, limit: 50, offset: 0 } });
  expect(await api.getPriceHistory("0x3", "1h")).toEqual([]);
  fetch.mockImplementation(async () => new Response(null, { status: 503 }));
  for (const run of [
    () => api.getPoolStats("0x3"),
    () => api.getSwapHistory("0x3"),
    () => api.getLiquidityHistory("0x3"),
    () => api.getPriceHistory("0x3", "1h"),
  ]) {
    await expect(run()).rejects.toMatchObject({ _tag: "AmmApiFailure", kind: "http", status: 503 });
  }
});
