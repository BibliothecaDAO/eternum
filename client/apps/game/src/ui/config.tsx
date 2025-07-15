import { BuildingType, FELT_CENTER, ResourceMiningTypes } from "@bibliothecadao/types";

export { FELT_CENTER };

export enum GraphicsSettings {
  LOW = "LOW",
  MID = "MID",
  HIGH = "HIGH",
}

const checkGraphicsSettings = async () => {
  // Handle migration from old LOW_GRAPHICS_FLAG
  const oldLowGraphicsFlag = localStorage.getItem("LOW_GRAPHICS_FLAG");
  if (oldLowGraphicsFlag !== null) {
    // Migrate old setting to new format
    const newSetting = oldLowGraphicsFlag === "true" ? GraphicsSettings.LOW : GraphicsSettings.HIGH;
    localStorage.setItem("GRAPHICS_SETTING", newSetting);
    localStorage.removeItem("LOW_GRAPHICS_FLAG"); // Clean up old setting
    return newSetting;
  }

  // Check if initial laptop check has been done
  if (!localStorage.getItem("INITIAL_LAPTOP_CHECK")) {
    try {
      const battery = await (navigator as any).getBattery();
      if (battery.charging && battery.chargingTime === 0) {
        // It's likely a desktop
        localStorage.setItem("GRAPHICS_SETTING", GraphicsSettings.HIGH);
      } else {
        // It's likely a laptop or mobile device
        localStorage.setItem("GRAPHICS_SETTING", GraphicsSettings.LOW);
      }
    } catch (error) {
      console.error("Error calling getBattery():", error);
      // Set default values if getBattery() is not supported
      localStorage.setItem("GRAPHICS_SETTING", GraphicsSettings.LOW);
    } finally {
      localStorage.setItem("INITIAL_LAPTOP_CHECK", "true");
    }
  }

  return (localStorage.getItem("GRAPHICS_SETTING") as GraphicsSettings) || GraphicsSettings.HIGH;
};

const getFlatMode = () => {
  const flatMode = localStorage.getItem("FLAT_MODE");
  return flatMode === null ? false : flatMode === "true";
};

export const GRAPHICS_SETTING = await checkGraphicsSettings();
export const IS_FLAT_MODE = getFlatMode();

export const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

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
  leaderboard: `${prefix}leaderboard.png`,
  worldMap: `${prefix}world.png`,
  squire: `${prefix}squire.png`,
  question: `${prefix}question.png`,
  scale: `${prefix}trade.png`,
  settings: `${prefix}support.png`,
  guild: `${prefix}guild.png`,
  trophy: `${prefix}trophy.png`,
  discord: `${prefix}discord.png`,
  rewards: `${prefix}rewards.png`,
  production: `${prefix}production.png`,
  home: `${prefix}home.png`,
  time: `${prefix}time.png`,
  leave: `${prefix}leave.png`,
  bridge: `${prefix}portal.png`,
  automation: `${prefix}robot.png`,
  logs: `${prefix}hourglass.png`,
  transfer: `${prefix}transfer.png`,
  relics: `${prefix}relics.png`,
};

export enum MenuEnum {
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
  logs = "logs",
  transfer = "transfer",
  relics = "relics",
}
