import { markGameEntryMilestone } from "@/ui/layouts/game-entry-timeline";

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

/** The game's module graph and renderer load only once a player enters a game, never from the shell. */
export const loadGameRouteForPlayEntry = createPlayRouteEntryLoader({
  markPrefetchScheduled: () => markGameEntryMilestone("asset-prefetch-scheduled"),
  preloadGameRouteModule,
  primeEntry: primeWebGpuRendererModules,
});
