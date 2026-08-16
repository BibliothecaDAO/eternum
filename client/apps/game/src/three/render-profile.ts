export type RenderMode = "quality" | "battery";

export interface RenderVisualProfile {
  animationCullDistance: number;
  animationFps: number;
  bloom: boolean;
  bloomIntensity: number;
  chromaticAberration: boolean;
  fxaa: boolean;
  labelRenderDistance: number;
  pixelRatio: number;
  shadowMapSize: number;
  shadows: boolean;
  vignette: boolean;
}

export interface RenderProfile {
  animation: {
    distantBucketStrideMultiplier: number;
    distantIntervalMultiplier: number;
  };
  mode: RenderMode;
  pacing: {
    idleAfterMs: number;
    idleFps: number | null;
    maxFps: number;
  };
  prefetch: {
    areaBoundaryLookaheadLimit: number;
    forwardDepthLimit: number;
    maxAheadLimit: number;
    maxConcurrentLimit: number;
    sideRadiusLimit: number;
  };
  shadows: {
    minimumRefreshIntervalMs: number;
  };
  visuals: RenderVisualProfile;
}

export const RENDER_MODE_STORAGE_KEY = "RENDER_MODE";
export const RENDERER_PIXEL_RATIO_CAP = 1.25;
const LEGACY_TIER_STORAGE_KEY = ["GRAPHICS", "SETTING"].join("_");
const LEGACY_DEVICE_CHECK_STORAGE_KEY = "INITIAL_LAPTOP_CHECK";

const QUALITY_VISUALS: RenderVisualProfile = {
  animationCullDistance: 120,
  animationFps: 24,
  bloom: false,
  bloomIntensity: 0,
  chromaticAberration: false,
  fxaa: false,
  labelRenderDistance: 160,
  pixelRatio: RENDERER_PIXEL_RATIO_CAP,
  shadowMapSize: 1024,
  shadows: true,
  vignette: false,
};

export function readRenderMode(storage: Pick<Storage, "getItem" | "removeItem" | "setItem"> | null): RenderMode {
  if (!storage) {
    return "quality";
  }

  // Read once before deletion so old clients complete the migration even when
  // a newer mode key is already present.
  storage.getItem(LEGACY_TIER_STORAGE_KEY);
  storage.removeItem(LEGACY_TIER_STORAGE_KEY);
  storage.removeItem("LOW_GRAPHICS_FLAG");
  storage.removeItem(LEGACY_DEVICE_CHECK_STORAGE_KEY);

  const storedMode = storage.getItem(RENDER_MODE_STORAGE_KEY);
  if (storedMode === "quality" || storedMode === "battery") {
    return storedMode;
  }

  // Every retired tier maps to Quality. The migration is deliberately one-way:
  // Battery is an explicit player choice, never a hardware recommendation.
  storage.setItem(RENDER_MODE_STORAGE_KEY, "quality");
  return "quality";
}

export function writeRenderMode(storage: Pick<Storage, "setItem"> | null, mode: RenderMode): void {
  storage?.setItem(RENDER_MODE_STORAGE_KEY, mode);
}

export function createRenderProfile(mode: RenderMode): RenderProfile {
  const isBattery = mode === "battery";
  const unlimited = Number.POSITIVE_INFINITY;

  return {
    animation: {
      distantBucketStrideMultiplier: isBattery ? 2 : 1,
      distantIntervalMultiplier: isBattery ? 2 : 1,
    },
    mode,
    pacing: {
      idleAfterMs: 2_000,
      idleFps: isBattery ? 30 : null,
      // Both modes cap at 60: above that, high-refresh displays spend the
      // whole frame budget re-rendering and starve streaming/compile work,
      // which reads as unsteady fps rather than extra smoothness.
      maxFps: 60,
    },
    prefetch: {
      areaBoundaryLookaheadLimit: isBattery ? 1 : unlimited,
      forwardDepthLimit: isBattery ? 1 : unlimited,
      maxAheadLimit: isBattery ? 2 : unlimited,
      maxConcurrentLimit: isBattery ? 1 : unlimited,
      sideRadiusLimit: isBattery ? 0 : unlimited,
    },
    shadows: {
      minimumRefreshIntervalMs: isBattery ? 250 : 100,
    },
    visuals: QUALITY_VISUALS,
  };
}

const browserStorage = typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;

export const renderProfile = createRenderProfile(readRenderMode(browserStorage));
