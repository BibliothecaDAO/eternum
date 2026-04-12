import { prefetchDashboardPlayAssets, prefetchPlayEntryAssets } from "@/ui/utils/prefetch-play-assets";

type GameRouteModule = typeof import("./game-route");

export const createPlayEntryRoutePrimer = ({
  preloadGameRouteModule,
}: {
  preloadGameRouteModule: () => Promise<GameRouteModule>;
}) => {
  return () => {
    const idleCallback = (
      globalThis as typeof globalThis & {
        requestIdleCallback?: (fn: () => void) => number;
      }
    ).requestIdleCallback;

    if (typeof idleCallback === "function") {
      idleCallback(() => {
        void preloadGameRouteModule();
      });
      return;
    }

    globalThis.setTimeout(() => {
      void preloadGameRouteModule();
    }, 0);
  };
};

export const createPlayEntryAssetPrimer = ({ prefetchPlayAssets }: { prefetchPlayAssets: () => void }) => {
  return () => {
    const idleCallback = (
      globalThis as typeof globalThis & {
        requestIdleCallback?: (fn: () => void) => number;
      }
    ).requestIdleCallback;

    if (typeof idleCallback === "function") {
      idleCallback(() => {
        prefetchPlayAssets();
      });
      return;
    }

    globalThis.setTimeout(() => {
      prefetchPlayAssets();
    }, 0);
  };
};

export const createDashboardPlayAssetPrimer = ({
  prefetchDashboardPlayAssets,
}: {
  prefetchDashboardPlayAssets: () => void;
}) => {
  return () => {
    const idleCallback = (
      globalThis as typeof globalThis & {
        requestIdleCallback?: (fn: () => void) => number;
      }
    ).requestIdleCallback;

    if (typeof idleCallback === "function") {
      idleCallback(() => {
        prefetchDashboardPlayAssets();
      });
      return;
    }

    globalThis.setTimeout(() => {
      prefetchDashboardPlayAssets();
    }, 0);
  };
};

let gameRoutePreloadPromise: Promise<GameRouteModule> | null = null;

export const preloadGameRouteModule = (): Promise<GameRouteModule> => {
  if (!gameRoutePreloadPromise) {
    gameRoutePreloadPromise = import("./game-route");
  }

  return gameRoutePreloadPromise;
};

export const primePlayEntryRoute = createPlayEntryRoutePrimer({
  preloadGameRouteModule,
});

export const primePlayEntryAssets = createPlayEntryAssetPrimer({
  prefetchPlayAssets: prefetchPlayEntryAssets,
});

export const primeDashboardPlayAssets = createDashboardPlayAssetPrimer({
  prefetchDashboardPlayAssets,
});
