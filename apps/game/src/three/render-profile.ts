import { readGraphicsPreferences, type GraphicsPreferences } from "./graphics-preferences";
export type RenderMode = "uncapped" | "capped";

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

interface RenderProfile {
  mode: RenderMode;
  maxFps: number | null;
  visuals: RenderVisualProfile;
}

export const RENDER_MODE_OPTIONS: ReadonlyArray<{ label: string; mode: RenderMode }> = [
  { label: "Uncapped", mode: "uncapped" },
  { label: "60 FPS", mode: "capped" },
];

export const RENDER_MODE_DESCRIPTION =
  "Choose display refresh or a 60 FPS limit. Visual detail stays the same. Changing mode reloads the page.";

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
    return "uncapped";
  }

  // Read once before deletion so old clients complete the migration even when
  // a newer mode key is already present.
  storage.getItem(LEGACY_TIER_STORAGE_KEY);
  storage.removeItem(LEGACY_TIER_STORAGE_KEY);
  storage.removeItem("LOW_GRAPHICS_FLAG");
  storage.removeItem(LEGACY_DEVICE_CHECK_STORAGE_KEY);

  const storedMode = storage.getItem(RENDER_MODE_STORAGE_KEY);
  if (storedMode === "uncapped" || storedMode === "capped") {
    return storedMode;
  }

  // Preserve a frame limit for players who previously chose Battery.
  const mode = storedMode === "battery" ? "capped" : "uncapped";
  storage.setItem(RENDER_MODE_STORAGE_KEY, mode);
  return mode;
}

export function writeRenderMode(storage: Pick<Storage, "setItem"> | null, mode: RenderMode): void {
  storage?.setItem(RENDER_MODE_STORAGE_KEY, mode);
}

export function createRenderProfile(
  mode: RenderMode,
  preferences: GraphicsPreferences = { quality: "high", shadows: true },
): RenderProfile {
  const visuals = { ...QUALITY_VISUALS, shadows: preferences.shadows };
  if (preferences.quality === "balanced") {
    visuals.pixelRatio = 1;
    visuals.shadowMapSize = 512;
  }
  return { mode, maxFps: mode === "uncapped" ? null : 60, visuals };
}

const browserStorage = typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;

export const renderProfile = createRenderProfile(
  readRenderMode(browserStorage),
  readGraphicsPreferences(browserStorage),
);
