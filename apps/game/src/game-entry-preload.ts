import { GAME_ENTRY_PREFETCH_MILESTONE, markGameEntryMilestone } from "@/ui/layouts/game-entry-timeline";
import { whenIdle } from "@/utils/when-idle";

type GameRouteModule = typeof import("./game-route");

export const createWebGpuRendererModulePrimer = ({
  preloadWebGpuRendererModules,
}: {
  preloadWebGpuRendererModules: () => Promise<void> | void;
}) => {
  return () => {
    whenIdle(() => {
      void Promise.resolve()
        .then(preloadWebGpuRendererModules)
        .catch(() => undefined);
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

/** The game's module graph and renderer load once a player heads into a game: a way in pressed, or the entry itself. */
export const loadGameRouteForPlayEntry = createPlayRouteEntryLoader({
  markPrefetchScheduled: () => markGameEntryMilestone(GAME_ENTRY_PREFETCH_MILESTONE),
  preloadGameRouteModule,
  primeEntry: primeWebGpuRendererModules,
});

export const primeGameEntry = (): void => {
  void loadGameRouteForPlayEntry().catch(() => undefined);
};
