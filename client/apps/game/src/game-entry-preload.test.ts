// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const stubBrowserPreloadGlobals = () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      json: async () => ({}),
      ok: true,
    })),
  );

  Object.defineProperty(navigator, "getBattery", {
    configurable: true,
    value: vi.fn(async () => ({ charging: true })),
  });
};

beforeEach(() => {
  vi.restoreAllMocks();
  stubBrowserPreloadGlobals();
});

describe("createPlayEntryRoutePrimer", () => {
  it("schedules the game route preload without touching play assets", async () => {
    const { createPlayEntryRoutePrimer } = await import("./game-entry-preload");
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
    const { createPlayEntryAssetPrimer } = await import("./game-entry-preload");
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

describe("createDashboardPlayAssetPrimer", () => {
  it("schedules the dashboard play asset prefetch independently of route preloading", async () => {
    const { createDashboardPlayAssetPrimer } = await import("./game-entry-preload");
    vi.useFakeTimers();
    const prefetchDashboardPlayAssets = vi.fn();

    createDashboardPlayAssetPrimer({
      prefetchDashboardPlayAssets,
    })();

    expect(prefetchDashboardPlayAssets).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(prefetchDashboardPlayAssets).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe("createGameEntryPrimer", () => {
  it("warms the shared route and dashboard assets for dashboard stage", async () => {
    const { createGameEntryPrimer } = await import("./game-entry-preload");
    const primeDashboardPlayAssets = vi.fn();
    const primePlayEntryAssets = vi.fn();
    const primePlayEntryRoute = vi.fn();
    const primeRendererReadyPlayAssets = vi.fn();
    const primeWebGpuRendererModules = vi.fn();

    createGameEntryPrimer({
      primeDashboardPlayAssets,
      primeRendererReadyPlayAssets,
      primePlayEntryRoute,
      primeWebGpuRendererModules,
    })("dashboard");

    expect(primePlayEntryRoute).toHaveBeenCalledTimes(1);
    expect(primeDashboardPlayAssets).toHaveBeenCalledTimes(1);
    expect(primePlayEntryAssets).not.toHaveBeenCalled();
    expect(primeRendererReadyPlayAssets).not.toHaveBeenCalled();
    expect(primeWebGpuRendererModules).not.toHaveBeenCalled();
  });

  it("warms renderer-critical modules immediately and defers non-critical play assets for entry stage", async () => {
    const { createGameEntryPrimer } = await import("./game-entry-preload");
    const primeDashboardPlayAssets = vi.fn();
    const primePlayEntryAssets = vi.fn();
    const primePlayEntryRoute = vi.fn();
    const primeRendererReadyPlayAssets = vi.fn();
    const primeWebGpuRendererModules = vi.fn();

    createGameEntryPrimer({
      primeDashboardPlayAssets,
      primeRendererReadyPlayAssets,
      primePlayEntryRoute,
      primeWebGpuRendererModules,
    })("entry");

    expect(primePlayEntryRoute).toHaveBeenCalledTimes(1);
    expect(primeWebGpuRendererModules).toHaveBeenCalledTimes(1);
    expect(primeRendererReadyPlayAssets).toHaveBeenCalledTimes(1);
    expect(primeDashboardPlayAssets).not.toHaveBeenCalled();
    expect(primePlayEntryAssets).not.toHaveBeenCalled();
  });
});

describe("createRendererReadyPlayAssetPrimer", () => {
  it("runs play asset prefetch once when renderer initialization completes", async () => {
    const { createRendererReadyPlayAssetPrimer } = await import("./game-entry-preload");
    const windowObject = new EventTarget() as Window;
    const primeDashboardPlayAssets = vi.fn();
    const primePlayEntryAssets = vi.fn();

    createRendererReadyPlayAssetPrimer({
      getTimelineSnapshot: () => ({ durations: {}, elapsedMs: 0, milestones: [] }),
      primeDashboardPlayAssets,
      primePlayEntryAssets,
      windowObject,
    })();

    windowObject.dispatchEvent(
      new CustomEvent("game-entry:milestone", {
        detail: { name: "renderer-init-completed" },
      }),
    );
    windowObject.dispatchEvent(
      new CustomEvent("game-entry:milestone", {
        detail: { name: "entry-ready" },
      }),
    );

    expect(primeDashboardPlayAssets).toHaveBeenCalledTimes(1);
    expect(primePlayEntryAssets).toHaveBeenCalledTimes(1);
  });
});
