import { FELT_CENTER as FELT_CENTER_IMPORT } from "@bibliothecadao/eternum";
import { BuildingType, ResourceMiningTypes } from "@bibliothecadao/types";

export const FELT_CENTER = FELT_CENTER_IMPORT;

const getBrowserLocalStorage = (): Storage | null => {
  return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
};

const getBrowserNavigator = (): Navigator | null => {
  return typeof globalThis.navigator === "undefined" ? null : globalThis.navigator;
};

const getFlatMode = () => {
  const browserLocalStorage = getBrowserLocalStorage();
  if (!browserLocalStorage) {
    return false;
  }

  const flatMode = browserLocalStorage.getItem("FLAT_MODE");
  return flatMode === null ? false : flatMode === "true";
};

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
