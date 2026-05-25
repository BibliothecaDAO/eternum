import {
  DASHBOARD_SHARED_PLAY_FETCH_ASSETS,
  DASHBOARD_SHARED_PLAY_IMAGE_ASSETS,
  DASHBOARD_SHARED_PLAY_MODEL_ASSETS,
  ENTRY_ONLY_PLAY_ASSETS,
} from "./play-asset-manifest";

const DASHBOARD_PREFETCH_KEY = "playDashboardAssetsPrefetched";
const ENTRY_PREFETCH_KEY = "playEntryAssetsPrefetched";
const FETCH_PREFETCH_BATCH_SIZE = 8;
const MODEL_PREFETCH_BATCH_SIZE = 8;
const IMAGE_PREFETCH_BATCH_SIZE = 20;
const DASHBOARD_PRELOAD_STARTED_MARK = "dashboard-play-assets-prefetch-started";
const DASHBOARD_PRELOAD_COMPLETED_MARK = "dashboard-play-assets-prefetch-completed";
const inFlightPrefetchSessionKeys = new Set<string>();

type PrefetchAsset = string;

const hasPrefetchLink = (href: string): boolean =>
  Boolean(document.querySelector(`link[rel="prefetch"][href="${href}"]`));

const resolveAsType = (href: string): string | undefined => {
  if (href.endsWith(".png") || href.endsWith(".jpg") || href.endsWith(".jpeg") || href.endsWith(".svg")) {
    return "image";
  }
  if (href.endsWith(".hdr") || href.endsWith(".glb") || href.endsWith(".gltf")) {
    return "fetch";
  }
  if (href.endsWith(".mp4")) {
    return "video";
  }
  return undefined;
};

const injectPrefetch = (href: PrefetchAsset): void => {
  if (hasPrefetchLink(href)) {
    return;
  }

  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = href;
  const asType = resolveAsType(href);
  if (asType) {
    link.as = asType;
  }
  document.head.appendChild(link);
};

const schedule = (cb: () => void): void => {
  if (typeof globalThis === "undefined") {
    return;
  }

  const idleCallback = (
    globalThis as typeof globalThis & {
      requestIdleCallback?: (fn: () => void) => number;
    }
  ).requestIdleCallback;

  if (typeof idleCallback === "function") {
    idleCallback(cb);
    return;
  }

  globalThis.setTimeout(cb, 1500);
};

const markPreload = (name: string): void => {
  if (typeof performance === "undefined") {
    return;
  }

  try {
    performance.mark(name);
  } catch {
    // Ignore duplicate or unsupported marks.
  }
};

const runBatchedPrefetch = (
  assets: readonly PrefetchAsset[],
  batchSize: number,
  onComplete?: () => void,
  startIndex = 0,
): void => {
  const endIndex = Math.min(startIndex + batchSize, assets.length);
  for (let i = startIndex; i < endIndex; i += 1) {
    injectPrefetch(assets[i]);
  }

  if (endIndex < assets.length) {
    schedule(() => runBatchedPrefetch(assets, batchSize, onComplete, endIndex));
    return;
  }

  onComplete?.();
};

const runPrefetchGroups = (
  groups: readonly { assets: readonly PrefetchAsset[]; batchSize: number }[],
  onComplete?: () => void,
  index = 0,
): void => {
  const group = groups[index];
  if (!group) {
    onComplete?.();
    return;
  }

  if (group.assets.length === 0) {
    schedule(() => runPrefetchGroups(groups, onComplete, index + 1));
    return;
  }

  runBatchedPrefetch(group.assets, group.batchSize, () => {
    schedule(() => runPrefetchGroups(groups, onComplete, index + 1));
  });
};

const prefetchAssetsForSession = ({
  completionMarkName,
  groups,
  sessionKey,
  startMarkName,
}: {
  completionMarkName?: string;
  groups: readonly { assets: readonly PrefetchAsset[]; batchSize: number }[];
  sessionKey: string;
  startMarkName?: string;
}): void => {
  if (typeof window === "undefined") {
    return;
  }

  if (window.sessionStorage.getItem(sessionKey) === "true") {
    return;
  }

  if (inFlightPrefetchSessionKeys.has(sessionKey)) {
    return;
  }

  inFlightPrefetchSessionKeys.add(sessionKey);

  if (startMarkName) {
    markPreload(startMarkName);
  }

  schedule(() => {
    runPrefetchGroups(groups, () => {
      inFlightPrefetchSessionKeys.delete(sessionKey);
      window.sessionStorage.setItem(sessionKey, "true");

      if (completionMarkName) {
        markPreload(completionMarkName);
      }
    });
  });
};

export const prefetchDashboardPlayAssets = (): void => {
  prefetchAssetsForSession({
    sessionKey: DASHBOARD_PREFETCH_KEY,
    startMarkName: DASHBOARD_PRELOAD_STARTED_MARK,
    completionMarkName: DASHBOARD_PRELOAD_COMPLETED_MARK,
    groups: [
      { assets: DASHBOARD_SHARED_PLAY_FETCH_ASSETS, batchSize: FETCH_PREFETCH_BATCH_SIZE },
      { assets: DASHBOARD_SHARED_PLAY_MODEL_ASSETS, batchSize: MODEL_PREFETCH_BATCH_SIZE },
      { assets: DASHBOARD_SHARED_PLAY_IMAGE_ASSETS, batchSize: IMAGE_PREFETCH_BATCH_SIZE },
    ],
  });
};

export const prefetchPlayEntryAssets = (): void => {
  prefetchAssetsForSession({
    sessionKey: ENTRY_PREFETCH_KEY,
    groups: [{ assets: ENTRY_ONLY_PLAY_ASSETS, batchSize: IMAGE_PREFETCH_BATCH_SIZE }],
  });
};
