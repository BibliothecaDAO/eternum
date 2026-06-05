import { FELT_CENTER as FELT_CENTER_IMPORT } from "@bibliothecadao/eternum";
import { BuildingType, ResourceMiningTypes } from "@bibliothecadao/types";

export const FELT_CENTER = FELT_CENTER_IMPORT;

export enum GraphicsSettings {
  ULTRA_LOW = "ULTRA_LOW",
  LOW = "LOW",
  MID = "MID",
  HIGH = "HIGH",
}

/**
 * Numeric rank for each graphics tier, lowest-spec first.
 *
 * Use this (via the helpers below) to compare tiers instead of scattering
 * ad-hoc `=== GraphicsSettings.LOW` / `!== GraphicsSettings.LOW` checks. Those
 * checks silently break when a tier is added *below* LOW: a lower tier still
 * satisfies `!== LOW`, so an expensive feature gated on "not low" would wrongly
 * turn back on for the weakest hardware. Ranking avoids that whole class of bug.
 */
const GRAPHICS_TIER_RANK: Record<GraphicsSettings, number> = {
  [GraphicsSettings.ULTRA_LOW]: 0,
  [GraphicsSettings.LOW]: 1,
  [GraphicsSettings.MID]: 2,
  [GraphicsSettings.HIGH]: 3,
};

/** True for LOW and any tier below it (e.g. a future ULTRA_LOW / "potato"). */
export const isLowOrBelow = (setting: GraphicsSettings): boolean =>
  GRAPHICS_TIER_RANK[setting] <= GRAPHICS_TIER_RANK[GraphicsSettings.LOW];

const getBrowserLocalStorage = (): Storage | null => {
  return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
};

const getBrowserNavigator = (): Navigator | null => {
  return typeof globalThis.navigator === "undefined" ? null : globalThis.navigator;
};

type DetectedGpuTier = "weak" | "mid" | "strong" | "unknown";

type CapabilityNavigator = Navigator & {
  deviceMemory?: number;
  getBattery?: () => Promise<{ charging: boolean }>;
};

// Software renderers (no real GPU acceleration): cannot run the full experience.
const SOFTWARE_GPU_PATTERN = /swiftshader|llvmpipe|softpipe|microsoft basic render/;
// Dedicated GPUs that comfortably handle the high tier.
const STRONG_GPU_PATTERN = /nvidia|geforce|\brtx\b|\bgtx\b|radeon\s*(?:rx|pro)\b|\barc\b|apple\s*m\d/;
// Integrated GPUs: capable but not gaming-grade.
const INTEGRATED_GPU_PATTERN = /intel|iris|hd graphics|uhd graphics|mali|adreno|powervr|radeon|vega/;

/**
 * Best-effort GPU classification from the WebGL renderer string. Returns "unknown"
 * when the string is masked (privacy browsers) or unavailable (SSR / no WebGL).
 */
const detectGpuTier = (): DetectedGpuTier => {
  try {
    if (typeof document === "undefined") {
      return "unknown";
    }
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    if (!gl) {
      return "unknown";
    }
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const rawRenderer: unknown = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "";
    // Release the throwaway context promptly.
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    const name = (typeof rawRenderer === "string" ? rawRenderer : "").toLowerCase();
    if (!name) {
      return "unknown";
    }
    if (SOFTWARE_GPU_PATTERN.test(name)) {
      return "weak";
    }
    if (STRONG_GPU_PATTERN.test(name)) {
      return "strong";
    }
    if (INTEGRATED_GPU_PATTERN.test(name)) {
      return "mid";
    }
    return "unknown";
  } catch (error) {
    console.error("Error detecting GPU tier:", error);
    return "unknown";
  }
};

/**
 * Recommend an initial graphics tier from device capability. Conservative: only
 * downgrades on clear evidence, since the user can always change it from settings.
 */
const recommendInitialGraphicsSetting = async (): Promise<GraphicsSettings> => {
  const browserNavigator = getBrowserNavigator() as CapabilityNavigator | null;
  const reportedCores = browserNavigator?.hardwareConcurrency;
  const reportedMemory = browserNavigator?.deviceMemory;
  const cores = typeof reportedCores === "number" ? reportedCores : undefined;
  const memory = typeof reportedMemory === "number" ? reportedMemory : undefined;
  const gpuTier = detectGpuTier();

  const veryLowCores = cores !== undefined && cores <= 2;
  const veryLowMemory = memory !== undefined && memory <= 2;
  const lowCores = cores !== undefined && cores <= 4;
  const lowMemory = memory !== undefined && memory <= 4;

  // Software rendering, or two independent strong "weak" signals => potato.
  if (gpuTier === "weak" || (veryLowCores && veryLowMemory)) {
    return GraphicsSettings.ULTRA_LOW;
  }

  // Clearly constrained hardware, or an integrated GPU plus one weak signal => low.
  if ((lowCores && lowMemory) || (gpuTier === "mid" && (lowCores || lowMemory))) {
    return GraphicsSettings.LOW;
  }

  // Final weak tie-breaker: an integrated GPU on battery power (likely a thin
  // laptop) leans low; otherwise default to high (the user can dial it down).
  if (gpuTier === "mid" && typeof browserNavigator?.getBattery === "function") {
    try {
      const battery = await browserNavigator.getBattery();
      if (!battery.charging) {
        return GraphicsSettings.LOW;
      }
    } catch (error) {
      console.error("Error calling getBattery():", error);
    }
  }

  return GraphicsSettings.HIGH;
};

export const shouldRecommendInitialGraphicsSetting = (
  storedGraphicsSetting: string | null,
  initialLaptopCheck: string | null,
): boolean => !storedGraphicsSetting && !initialLaptopCheck;

const checkGraphicsSettings = async () => {
  const browserLocalStorage = getBrowserLocalStorage();
  if (!browserLocalStorage) {
    return GraphicsSettings.HIGH;
  }

  // Handle migration from old LOW_GRAPHICS_FLAG
  const oldLowGraphicsFlag = browserLocalStorage.getItem("LOW_GRAPHICS_FLAG");
  if (oldLowGraphicsFlag !== null) {
    // Migrate old setting to new format
    const newSetting = oldLowGraphicsFlag === "true" ? GraphicsSettings.LOW : GraphicsSettings.HIGH;
    browserLocalStorage.setItem("GRAPHICS_SETTING", newSetting);
    browserLocalStorage.removeItem("LOW_GRAPHICS_FLAG"); // Clean up old setting
    return newSetting;
  }

  // On first load, pick a sensible default from the device's capability so weak
  // hardware lands on a low tier instead of always defaulting to HIGH. The choice
  // is then sticky in localStorage and the user can change it from settings.
  const storedGraphicsSetting = browserLocalStorage.getItem("GRAPHICS_SETTING");
  const initialLaptopCheck = browserLocalStorage.getItem("INITIAL_LAPTOP_CHECK");
  if (shouldRecommendInitialGraphicsSetting(storedGraphicsSetting, initialLaptopCheck)) {
    const recommended = await recommendInitialGraphicsSetting();
    browserLocalStorage.setItem("GRAPHICS_SETTING", recommended);
    browserLocalStorage.setItem("INITIAL_LAPTOP_CHECK", "true");
  } else if (!initialLaptopCheck) {
    browserLocalStorage.setItem("INITIAL_LAPTOP_CHECK", "true");
  }

  return (browserLocalStorage.getItem("GRAPHICS_SETTING") as GraphicsSettings) || GraphicsSettings.HIGH;
};

const getFlatMode = () => {
  const browserLocalStorage = getBrowserLocalStorage();
  if (!browserLocalStorage) {
    return false;
  }

  const flatMode = browserLocalStorage.getItem("FLAT_MODE");
  return flatMode === null ? false : flatMode === "true";
};

export const GRAPHICS_SETTING = await checkGraphicsSettings();
export const IS_FLAT_MODE = getFlatMode();

export const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
  getBrowserNavigator()?.userAgent ?? "",
);

export const CONTEXT_MENU_CONFIG = {
  radial: {
    maxActions: 8,
    radius: 112,
    innerRadius: 28,
    selectRadius: 72,
    gapDegrees: 4,
  },
  clampPadding: 12,
};

const BUILD_IMAGES_PREFIX = "/images/buildings/construction/";

export const BUILDING_IMAGES_PATH = {
  [BuildingType.ResourceLabor]: `${BUILD_IMAGES_PREFIX}castleZero.png`,
  [BuildingType.ResourceAncientFragment]: "",
  [BuildingType.ResourceStone]: `${BUILD_IMAGES_PREFIX}mine.png`,
  [BuildingType.ResourceCoal]: `${BUILD_IMAGES_PREFIX}mine.png`,
  [BuildingType.ResourceWood]: `${BUILD_IMAGES_PREFIX}lumber_mill.png`,
  [BuildingType.ResourceCopper]: `${BUILD_IMAGES_PREFIX}forge.png`,
  [BuildingType.ResourceIronwood]: `${BUILD_IMAGES_PREFIX}lumber_mill.png`,
  [BuildingType.ResourceObsidian]: `${BUILD_IMAGES_PREFIX}mine.png`,
  [BuildingType.ResourceGold]: `${BUILD_IMAGES_PREFIX}forge.png`,
  [BuildingType.ResourceSilver]: `${BUILD_IMAGES_PREFIX}forge.png`,
  [BuildingType.ResourceMithral]: `${BUILD_IMAGES_PREFIX}forge.png`,
  [BuildingType.ResourceAlchemicalSilver]: `${BUILD_IMAGES_PREFIX}forge.png`,
  [BuildingType.ResourceColdIron]: `${BUILD_IMAGES_PREFIX}forge.png`,
  [BuildingType.ResourceDeepCrystal]: `${BUILD_IMAGES_PREFIX}mine.png`,
  [BuildingType.ResourceRuby]: `${BUILD_IMAGES_PREFIX}mine.png`,
  [BuildingType.ResourceDiamonds]: `${BUILD_IMAGES_PREFIX}mine.png`,
  [BuildingType.ResourceHartwood]: `${BUILD_IMAGES_PREFIX}lumber_mill.png`,
  [BuildingType.ResourceIgnium]: `${BUILD_IMAGES_PREFIX}forge.png`,
  [BuildingType.ResourceTwilightQuartz]: `${BUILD_IMAGES_PREFIX}mine.png`,
  [BuildingType.ResourceTrueIce]: `${BUILD_IMAGES_PREFIX}mine.png`,
  [BuildingType.ResourceAdamantine]: `${BUILD_IMAGES_PREFIX}forge.png`,
  [BuildingType.ResourceSapphire]: `${BUILD_IMAGES_PREFIX}mine.png`,
  [BuildingType.ResourceEtherealSilica]: `${BUILD_IMAGES_PREFIX}mine.png`,
  [BuildingType.ResourceDragonhide]: `${BUILD_IMAGES_PREFIX}dragonhide.png`,
  [BuildingType.ResourceWheat]: `${BUILD_IMAGES_PREFIX}farm.png`,
  [BuildingType.ResourceFish]: `${BUILD_IMAGES_PREFIX}fishing_village.png`,
  [BuildingType.ResourceKnightT1]: `${BUILD_IMAGES_PREFIX}barracks.png`,
  [BuildingType.ResourceKnightT2]: `${BUILD_IMAGES_PREFIX}barracks.png`,
  [BuildingType.ResourceKnightT3]: `${BUILD_IMAGES_PREFIX}barracks.png`,
  [BuildingType.ResourcePaladinT1]: `${BUILD_IMAGES_PREFIX}stable.png`,
  [BuildingType.ResourcePaladinT2]: `${BUILD_IMAGES_PREFIX}stable.png`,
  [BuildingType.ResourcePaladinT3]: `${BUILD_IMAGES_PREFIX}stable.png`,
  [BuildingType.ResourceDonkey]: `${BUILD_IMAGES_PREFIX}market.png`,
  [BuildingType.ResourceCrossbowmanT1]: `${BUILD_IMAGES_PREFIX}archery.png`,
  [BuildingType.ResourceCrossbowmanT2]: `${BUILD_IMAGES_PREFIX}archery.png`,
  [BuildingType.ResourceCrossbowmanT3]: `${BUILD_IMAGES_PREFIX}archery.png`,
  [BuildingType.WorkersHut]: `${BUILD_IMAGES_PREFIX}workers_hut.png`,
  [BuildingType.Storehouse]: `${BUILD_IMAGES_PREFIX}storehouse.png`,
  [BuildingType.ResourceResearch]: `${BUILD_IMAGES_PREFIX}research_lab.png`,
  [ResourceMiningTypes.Forge]: `${BUILD_IMAGES_PREFIX}forge.png`,
  [ResourceMiningTypes.Mine]: `${BUILD_IMAGES_PREFIX}mine.png`,
  [ResourceMiningTypes.LumberMill]: `${BUILD_IMAGES_PREFIX}lumber_mill.png`,
  [ResourceMiningTypes.Dragonhide]: `${BUILD_IMAGES_PREFIX}dragonhide.png`,
};

const prefix = "/image-icons/";

export const BuildingThumbs = {
  hex: `${prefix}question.png`,
  military: `${prefix}military.png`,
  construction: `${prefix}construction.png`,
  trade: `${prefix}donkey.png`,
  resources: `${prefix}resources.png`,
  banks: `${prefix}banks.png`,
  worldStructures: `${prefix}world.png`,
  hyperstructures: `${prefix}hyperstructure.png`,
  leaderboard: "/images/buildings/thumb/leaderboard.png",
  worldMap: `${prefix}world.png`,
  squire: "/images/buildings/thumb/squire.png",
  question: `${prefix}shortcuts.png`,
  scale: `${prefix}trade.png`,
  settings: `${prefix}settings.png`,
  guild: `${prefix}guild.png`,
  trophy: `${prefix}trophy.png`,
  discord: `${prefix}discord.png`,
  rewards: "/images/buildings/thumb/rewards.png",
  production: `${prefix}production.png`,
  house: `${prefix}house.png`,
  home: `${prefix}home.png`,
  time: "/images/buildings/thumb/timeglass.png",
  leave: `${prefix}leave.png`,
  bridge: `${prefix}portal.png`,
  automation: `${prefix}robot.png`,
  transfer: `${prefix}transfer.png`,
  relics: `${prefix}relics.png`,
  latestUpdates: `${prefix}latest-updates.png`,
  storyEvents: `${prefix}chronicles.png`,
  predictionMarket: `${prefix}trade.png`,
};

enum MenuEnum {
  military = "military",
  construction = "construction",
  hyperstructures = "hyperstructures",
  entityDetails = "entityDetails",
  resourceArrivals = "resourceArrivals",
  trade = "trade",
  resourceTable = "resourceTable",
  production = "production",
  bridge = "bridge",
  automation = "automation",
  transfer = "transfer",
  relics = "relics",
  chat = "chat",
  storyEvents = "storyEvents",
  predictionMarket = "predictionMarket",
}
