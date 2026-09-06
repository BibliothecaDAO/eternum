import { markGameEntryMilestone } from "@/ui/layouts/game-entry-timeline";
import { prefetchDashboardPlayAssets } from "@/ui/utils/prefetch-play-assets";

type GameRouteModule = typeof import("./game-route");

const schedule = (cb: () => void, delayMs: number = 0): void => {
  const idleCallback = (
    globalThis as typeof globalThis & {
      requestIdleCallback?: (fn: () => void) => number;
    }
  ).requestIdleCallback;

  if (typeof idleCallback === "function") {
    idleCallback(cb);
    return;
  }

  globalThis.setTimeout(cb, delayMs);
};

export const createPlayEntryRoutePrimer = ({
  preloadGameRouteModule,
}: {
  preloadGameRouteModule: () => Promise<GameRouteModule>;
}) => {
  return () => {
    schedule(() => {
      void preloadGameRouteModule();
    });
  };
};

export const createDashboardPlayAssetPrimer = ({
  prefetchDashboardPlayAssets,
}: {
  prefetchDashboardPlayAssets: () => void;
}) => {
  return () => {
    schedule(() => {
      prefetchDashboardPlayAssets();
    });
  };
};

const createWebGpuRendererModulePrimer = ({
  preloadWebGpuRendererModules,
}: {
  preloadWebGpuRendererModules: () => Promise<void> | void;
}) => {
  return () => {
    schedule(() => {
      void preloadWebGpuRendererModules();
    });
  };
};

// A dynamic import settles only after the backend chunk's own top-level awaits (the blockchain
// vendor chunk carries one), so the export is a function by the time it is called.
const preloadWebGpuRendererBackendModules = async (): Promise<void> => {
  const { preloadWebGpuRendererModules } = await import("./three/webgpu-renderer-backend");
  preloadWebGpuRendererModules();
};

const primeWebGpuRendererModules = createWebGpuRendererModulePrimer({
  preloadWebGpuRendererModules: preloadWebGpuRendererBackendModules,
});

export const createGameEntryPrimer = ({
  primeDashboardPlayAssets,
  primePlayEntryRoute,
  primeWebGpuRendererModules,
}: {
  primeDashboardPlayAssets: () => void;
  primePlayEntryRoute: () => void;
  primeWebGpuRendererModules: () => void;
}) => {
  return (stage: "dashboard" | "entry") => {
    primePlayEntryRoute();

    if (stage === "dashboard") {
      primeDashboardPlayAssets();
      return;
    }

    primeWebGpuRendererModules();
  };
};

export const createPlayRouteEntryLoader = <Module>({
  markPrefetchScheduled,
  preloadGameRouteModule,
  primeEntry,
}: {
  markPrefetchScheduled: () => void;
  preloadGameRouteModule: () => Promise<Module>;
  primeEntry: () => void;
}): (() => Promise<Module>) => {
  let loadPromise: Promise<Module> | null = null;

  return () => {
    if (loadPromise) {
      return loadPromise;
    }

    markPrefetchScheduled();
    primeEntry();
    loadPromise = preloadGameRouteModule();
    return loadPromise;
  };
};

let gameRoutePreloadPromise: Promise<GameRouteModule> | null = null;

const preloadGameRouteModule = (): Promise<GameRouteModule> => {
  if (!gameRoutePreloadPromise) {
    gameRoutePreloadPromise = import("./game-route").catch((error) => {
      gameRoutePreloadPromise = null;
      throw error;
    });
  }

  return gameRoutePreloadPromise;
};

const primePlayEntryRoute = createPlayEntryRoutePrimer({
  preloadGameRouteModule,
});

const primeDashboardPlayAssets = createDashboardPlayAssetPrimer({
  prefetchDashboardPlayAssets,
});

export const primeGameEntry = createGameEntryPrimer({
  primeDashboardPlayAssets,
  primePlayEntryRoute,
  primeWebGpuRendererModules,
});

export const loadGameRouteForPlayEntry = createPlayRouteEntryLoader({
  markPrefetchScheduled: () => markGameEntryMilestone("asset-prefetch-scheduled"),
  preloadGameRouteModule,
  primeEntry: () => primeGameEntry("entry"),
});
