import { usesExperimentalWebGPUThreeBuild, type RendererBuildMode } from "@/three/renderer-build-mode";
import {
  GAME_ENTRY_TIMELINE_EVENT_NAME,
  getGameEntryTimelineSnapshot,
  type GameEntryTimelineSnapshot,
} from "@/ui/layouts/game-entry-timeline";
import { prefetchDashboardPlayAssets, prefetchPlayEntryAssets } from "@/ui/utils/prefetch-play-assets";

import { env } from "../env";

type GameRouteModule = typeof import("./game-route");
type WindowEventTarget = Pick<Window, "addEventListener" | "removeEventListener">;
type GameEntryMilestoneEvent = Event & {
  detail?: {
    name?: string;
  };
};

const RENDERER_READY_MILESTONES = new Set(["renderer-init-completed", "entry-ready"]);

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

export const createPlayEntryAssetPrimer = ({ prefetchPlayAssets }: { prefetchPlayAssets: () => void }) => {
  return () => {
    schedule(() => {
      prefetchPlayAssets();
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
  envBuildMode,
  preloadWebGpuRendererModules,
}: {
  envBuildMode: RendererBuildMode;
  preloadWebGpuRendererModules: () => Promise<void> | void;
}) => {
  return () => {
    if (!usesExperimentalWebGPUThreeBuild(envBuildMode)) {
      return;
    }

    schedule(() => {
      void preloadWebGpuRendererModules();
    });
  };
};

export const createRendererReadyPlayAssetPrimer = ({
  getTimelineSnapshot,
  primeDashboardPlayAssets,
  primePlayEntryAssets,
  windowObject = typeof window === "undefined" ? undefined : window,
}: {
  getTimelineSnapshot: () => GameEntryTimelineSnapshot;
  primeDashboardPlayAssets: () => void;
  primePlayEntryAssets: () => void;
  windowObject?: WindowEventTarget;
}) => {
  let isListening = false;
  let hasPrimed = false;

  const primePlayAssets = () => {
    if (hasPrimed) {
      return;
    }

    hasPrimed = true;
    if (windowObject && isListening) {
      windowObject.removeEventListener(GAME_ENTRY_TIMELINE_EVENT_NAME, handleMilestone as EventListener);
      isListening = false;
    }
    primeDashboardPlayAssets();
    primePlayEntryAssets();
  };

  const handleMilestone = (event: Event) => {
    const milestoneName = (event as GameEntryMilestoneEvent).detail?.name;
    if (milestoneName && RENDERER_READY_MILESTONES.has(milestoneName)) {
      primePlayAssets();
    }
  };

  return () => {
    if (hasPrimed) {
      return;
    }

    if (hasRendererReadyMilestone(getTimelineSnapshot())) {
      primePlayAssets();
      return;
    }

    if (!windowObject || isListening) {
      return;
    }

    windowObject.addEventListener(GAME_ENTRY_TIMELINE_EVENT_NAME, handleMilestone as EventListener);
    isListening = true;
  };
};

function hasRendererReadyMilestone(snapshot: GameEntryTimelineSnapshot): boolean {
  return snapshot.milestones.some((milestone) => RENDERER_READY_MILESTONES.has(milestone.name));
}

const preloadWebGpuRendererBackendModules = async (): Promise<void> => {
  await import("./three/preload-webgpu-renderer-backend");
};

const primeWebGpuRendererModules = createWebGpuRendererModulePrimer({
  envBuildMode: env.VITE_PUBLIC_RENDERER_BUILD_MODE,
  preloadWebGpuRendererModules: preloadWebGpuRendererBackendModules,
});

const createDefaultRendererReadyPlayAssetPrimer = ({
  primeDashboardPlayAssets,
  primePlayEntryAssets,
}: {
  primeDashboardPlayAssets: () => void;
  primePlayEntryAssets: () => void;
}) =>
  createRendererReadyPlayAssetPrimer({
    getTimelineSnapshot: getGameEntryTimelineSnapshot,
    primeDashboardPlayAssets,
    primePlayEntryAssets,
  });

export const createGameEntryPrimer = ({
  primeDashboardPlayAssets,
  primeRendererReadyPlayAssets,
  primePlayEntryRoute,
  primeWebGpuRendererModules,
}: {
  primeDashboardPlayAssets: () => void;
  primeRendererReadyPlayAssets: () => void;
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
    primeRendererReadyPlayAssets();
  };
};

let gameRoutePreloadPromise: Promise<GameRouteModule> | null = null;

export const preloadGameRouteModule = (): Promise<GameRouteModule> => {
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

const primePlayEntryAssets = createPlayEntryAssetPrimer({
  prefetchPlayAssets: prefetchPlayEntryAssets,
});

const primeDashboardPlayAssets = createDashboardPlayAssetPrimer({
  prefetchDashboardPlayAssets,
});

const primeRendererReadyPlayAssets = createDefaultRendererReadyPlayAssetPrimer({
  primeDashboardPlayAssets,
  primePlayEntryAssets,
});

export const primeGameEntry = createGameEntryPrimer({
  primeDashboardPlayAssets,
  primeRendererReadyPlayAssets,
  primePlayEntryRoute,
  primeWebGpuRendererModules,
});
