import { ResourceMiningTypes } from "@/types";
import { BuildingType, FELT_CENTER } from "@bibliothecadao/eternum";

export { FELT_CENTER };

export enum GraphicsSettings {
  LOW = "LOW",
  MID = "MID",
  HIGH = "HIGH"
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

  return localStorage.getItem("GRAPHICS_SETTING") as GraphicsSettings || GraphicsSettings.HIGH;
};

export const GRAPHICS_SETTING = await checkGraphicsSettings();

export const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const BUILD_IMAGES_PREFIX = "/images/buildings/construction/";

export const BUILDING_IMAGES_PATH = {
  [BuildingType.Castle]: "",
  [BuildingType.Bank]: "",
  [BuildingType.FragmentMine]: "",
  [BuildingType.Resource]: `${BUILD_IMAGES_PREFIX}mine.png`,
  [BuildingType.Farm]: `${BUILD_IMAGES_PREFIX}farm.png`,
  [BuildingType.FishingVillage]: `${BUILD_IMAGES_PREFIX}fishing_village.png`,
  [BuildingType.Barracks]: `${BUILD_IMAGES_PREFIX}barracks.png`,
  [BuildingType.Stable]: `${BUILD_IMAGES_PREFIX}stable.png`,
  [BuildingType.Market]: `${BUILD_IMAGES_PREFIX}market.png`,
  [BuildingType.ArcheryRange]: `${BUILD_IMAGES_PREFIX}archery.png`,
  [BuildingType.TradingPost]: `${BUILD_IMAGES_PREFIX}trading_post.png`,
  [BuildingType.WorkersHut]: `${BUILD_IMAGES_PREFIX}workers_hut.png`,
  [BuildingType.WatchTower]: `${BUILD_IMAGES_PREFIX}watch_tower.png`,
  [BuildingType.Walls]: `${BUILD_IMAGES_PREFIX}walls.png`,
  [BuildingType.Storehouse]: `${BUILD_IMAGES_PREFIX}storehouse.png`,
  [ResourceMiningTypes.Forge]: `${BUILD_IMAGES_PREFIX}forge.png`,
  [ResourceMiningTypes.Mine]: `${BUILD_IMAGES_PREFIX}mine.png`,
  [ResourceMiningTypes.LumberMill]: `${BUILD_IMAGES_PREFIX}lumber_mill.png`,
  [ResourceMiningTypes.Dragonhide]: `${BUILD_IMAGES_PREFIX}dragonhide.png`,
};

export const BuildingThumbs = {
  hex: "/images/buildings/thumb/question.png",
  military: "/images/buildings/thumb/sword.png",
  construction: "/images/buildings/thumb/crane.png",
  trade: "/images/buildings/thumb/trade.png",
  resources: "/images/buildings/thumb/resources.png",
  banks: "/images/buildings/thumb/banks.png",
  worldStructures: "/images/buildings/thumb/world-map.png",
  leaderboard: "/images/buildings/thumb/leaderboard.png",
  worldMap: "/images/buildings/thumb/world-map.png",
  squire: "/images/buildings/thumb/squire.png",
  question: "/images/buildings/thumb/question-wood.png",
  scale: "/images/buildings/thumb/scale.png",
  settings: "/images/buildings/thumb/settings.png",
  guild: "/images/buildings/thumb/guilds.png",
  trophy: "/images/buildings/thumb/trophy.png",
  discord: "/images/buildings/thumb/discord.png",
  rewards: "/images/buildings/thumb/rewards.png",
};

export enum MenuEnum {
  military = "military",
  construction = "construction",
  worldStructures = "worldStructures",
  entityDetails = "entityDetails",
  resourceArrivals = "resourceArrivals",
  trade = "trade",
  resourceTable = "resourceTable",
}
