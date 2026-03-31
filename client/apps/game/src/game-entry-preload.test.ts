// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { createPlayEntryAssetPrimer, createPlayEntryRoutePrimer } from "./game-entry-preload";

describe("createPlayEntryRoutePrimer", () => {
  it("schedules the game route preload without touching play assets", async () => {
    vi.useFakeTimers();
    const preloadGameRouteModule = vi.fn<() => Promise<typeof import("./game-route")>>(
      async () => (await import("./game-route")) as typeof import("./game-route"),
    );
    const prefetchPlayAssets = vi.fn();

    createPlayEntryRoutePrimer({
      preloadGameRouteModule,
    })();

    expect(preloadGameRouteModule).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(preloadGameRouteModule).toHaveBeenCalledTimes(1);
    expect(prefetchPlayAssets).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("createPlayEntryAssetPrimer", () => {
  it("schedules the play asset prefetch independently of route preloading", async () => {
    vi.useFakeTimers();
    const prefetchPlayAssets = vi.fn();

    createPlayEntryAssetPrimer({
      prefetchPlayAssets,
    })();

    expect(prefetchPlayAssets).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(prefetchPlayAssets).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
