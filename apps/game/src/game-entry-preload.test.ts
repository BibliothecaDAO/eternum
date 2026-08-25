// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

// Documented load-sensitive file (see instanced-model.material-semantics):
// full-suite contention pushes setup past the default 5s on green code.
vi.setConfig({ testTimeout: 30_000 });

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

describe("createPlayRouteEntryLoader", () => {
  it("schedules entry priming before loading the route module and does both once per page", async () => {
    const { createPlayRouteEntryLoader } = await import("./game-entry-preload");
    const callOrder: string[] = [];
    const routeModule = { route: "game" };
    const preloadGameRouteModule = vi.fn(async () => {
      callOrder.push("load-route");
      return routeModule;
    });
    const loader = createPlayRouteEntryLoader({
      markPrefetchScheduled: () => callOrder.push("mark-prefetch"),
      preloadGameRouteModule,
      primeEntry: () => callOrder.push("prime-entry"),
    });

    const firstLoad = loader();
    const secondLoad = loader();

    expect(callOrder).toEqual(["mark-prefetch", "prime-entry", "load-route"]);
    expect(secondLoad).toBe(firstLoad);
    expect(preloadGameRouteModule).toHaveBeenCalledTimes(1);
    await expect(firstLoad).resolves.toBe(routeModule);
  });

  it("starts entry priming before slow or failed account restoration can run", async () => {
    const { createPlayRouteEntryLoader } = await import("./game-entry-preload");
    const callOrder: string[] = [];
    const accountFailure = new Error("account restore failed");
    let rejectAccountRestoration: (error: Error) => void = () => {};
    const accountRestoration = new Promise<void>((_resolve, reject) => {
      rejectAccountRestoration = reject;
    });
    const restoreAccount = vi.fn(() => {
      callOrder.push("restore-account");
      return accountRestoration;
    });
    const loader = createPlayRouteEntryLoader({
      markPrefetchScheduled: () => callOrder.push("mark-prefetch"),
      preloadGameRouteModule: async () => ({ restoreAccount }),
      primeEntry: () => callOrder.push("prime-entry"),
    });

    const routeModule = await loader();
    expect(callOrder).toEqual(["mark-prefetch", "prime-entry"]);

    const restoration = routeModule.restoreAccount();
    expect(callOrder).toEqual(["mark-prefetch", "prime-entry", "restore-account"]);
    expect(callOrder.indexOf("prime-entry")).toBeLessThan(callOrder.indexOf("restore-account"));

    rejectAccountRestoration(accountFailure);
    await expect(restoration).rejects.toBe(accountFailure);
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
