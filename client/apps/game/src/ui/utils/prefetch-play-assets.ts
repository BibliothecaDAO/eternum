// Auto-generated from the previous index.html prefetch list.
// Prefetch these assets only when entering /play to avoid blocking landing.

const PREFETCH_KEY = "playAssetsPrefetched";
const PREFETCH_BATCH_SIZE = 20;

const PREFETCH_PLAY_ASSETS = [
  "/images/map.svg",
  "/images/icons/cursor.png",
  "/images/icons/grab.png",
  "/images/logos/argent-x.svg",
  "/images/logos/daydreams.png",
  "/images/logos/eternum-animated.png",
  "/images/logos/braavos.svg",
  "/images/icons/cursor-cross.png",
  "/images/resources/1.png",
  "/images/resources/10.png",
  "/images/resources/11.png",
  "/images/resources/12.png",
  "/images/resources/13.png",
  "/images/resources/14.png",
  "/images/resources/15.png",
  "/images/resources/16.png",
  "/images/resources/17.png",
  "/images/resources/18.png",
  "/images/resources/19.png",
  "/images/resources/2.png",
  "/images/resources/20.png",
  "/images/resources/21.png",
  "/images/resources/22.png",
  "/images/resources/29.png",
  "/images/resources/30.png",
  "/images/resources/3.png",
  "/images/resources/4.png",
  "/images/resources/5.png",
  "/images/resources/6.png",
  "/images/resources/7.png",
  "/images/resources/8.png",
  "/images/resources/9.png",
  "/images/resources/23.png",
  "/images/resources/24.png",
  "/images/resources/25.png",
  "/images/resources/26.png",
  "/images/resources/27.png",
  "/images/resources/28.png",
  "/images/resources/31.png",
  "/images/resources/32.png",
  "/images/resources/33.png",
  "/images/resources/34.png",
  "/images/resources/35.png",
  "/images/resources/36.png",
  "/images/resources/37.png",
  "/images/resources/38.png",
  "/images/resources/39.png",
  "/images/resources/40.png",
  "/images/resources/41.png",
  "/images/resources/42.png",
  "/images/resources/43.png",
  "/images/resources/44.png",
  "/images/resources/45.png",
  "/images/resources/46.png",
  "/images/resources/47.png",
  "/images/resources/48.png",
  "/images/resources/49.png",
  "/images/resources/50.png",
  "/images/resources/51.png",
  "/images/resources/52.png",
  "/images/resources/53.png",
  "/images/resources/54.png",
  "/images/resources/55.png",
  "/images/resources/56.png",
  "/images/avatars/01.png",
  "/images/avatars/02.png",
  "/images/avatars/03.png",
  "/images/avatars/04.png",
  "/images/avatars/05.png",
  "/images/avatars/06.png",
  "/images/avatars/07.png",
  "/images/avatars/08.png",
  "/images/avatars/09.png",
  "/images/avatars/10.png",
  "/images/relic-chest/chest-opened.png",
  "/images/relic-chest/chest-closed.png",
  "/images/labels/army.png",
  "/images/labels/enemy_army.png",
  "/images/labels/allies_army.png",
  "/images/labels/enemy_realm.png",
  "/images/labels/enemy_village.png",
  "/images/labels/allies_realm.png",
  "/images/labels/allies_village.png",
  "/images/labels/realm.png",
  "/images/labels/village.png",
  "/images/labels/chest.png",
  "/images/labels/hyperstructure.png",
  "/images/labels/fragment_mine.png",
  "/images/labels/quest.png",
  "/images/labels/essence_rift.png",
  "/images/labels/chest.png",
  "/images/buildings/construction/archery.png",
  "/images/buildings/construction/barracks.png",
  "/images/buildings/construction/dragonhide.png",
  "/images/buildings/construction/farm.png",
  "/images/buildings/construction/fishing_village.png",
  "/images/buildings/construction/market.png",
  "/images/buildings/construction/mine.png",
  "/images/buildings/construction/stable.png",
  "/images/buildings/construction/storehouse.png",
  "/images/buildings/construction/workers_hut.png",
  "/images/buildings/construction/forge.png",
  "/images/buildings/construction/lumber_mill.png",
  "/images/buildings/construction/castleZero.png",
  "/images/buildings/construction/castleOne.png",
  "/images/buildings/construction/castleTwo.png",
  "/images/buildings/construction/castleThree.png",
  "/images/buildings/thumb/house.png",
  "/images/buildings/thumb/silo.png",
  "/textures/paper/worldmap-bg.png",
  "/images/textures/dark-wood.png",
  "/textures/aura2.png",
  "/textures/environment/models_env.hdr",
  "/image-icons/shortcuts.png",
  "/image-icons/military.png",
  "/image-icons/construction.png",
  "/image-icons/donkey.png",
  "/image-icons/resources.png",
  "/image-icons/world.png",
  "/image-icons/production.png",
  "/image-icons/home.png",
  "/image-icons/time.png",
  "/image-icons/leave.png",
  "/image-icons/portal.png",
  "/image-icons/robot.png",
  "/image-icons/hourglass.png",
  "/image-icons/transfer.png",
  "/image-icons/guild.png",
  "/image-icons/support.png",
  "/image-icons/relics.png",
  "/image-icons/latest-updates.png",
  "/images/covers/og-image.png",
  "/images/covers/blitz/01.png",
  "/images/covers/blitz/02.png",
  "/images/covers/blitz/03.png",
  "/images/covers/blitz/04.png",
  "/images/covers/blitz/05.png",
  "/images/covers/blitz/06.png",
  "/images/covers/blitz/07.png",
] as const;

type PrefetchAsset = (typeof PREFETCH_PLAY_ASSETS)[number];

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

const runBatchedPrefetch = (assets: readonly PrefetchAsset[], startIndex = 0): void => {
  const endIndex = Math.min(startIndex + PREFETCH_BATCH_SIZE, assets.length);
  for (let i = startIndex; i < endIndex; i += 1) {
    injectPrefetch(assets[i]);
  }

  if (endIndex < assets.length) {
    schedule(() => runBatchedPrefetch(assets, endIndex));
  }
};

export const prefetchPlayAssets = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  if (sessionStorage.getItem(PREFETCH_KEY) === "true") {
    return;
  }

  sessionStorage.setItem(PREFETCH_KEY, "true");
  schedule(() => runBatchedPrefetch(PREFETCH_PLAY_ASSETS));
};
