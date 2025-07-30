import { Position, RESOURCE_PRECISION, ResourceMiningTypes, ResourcesIds, TickIds } from "@bibliothecadao/types";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ClientConfigManager, configManager } from "..";

export { getEntityIdFromKeys };

export const toHexString = (num: bigint) => {
  return `0x${num.toString(16)}`;
};

export enum TimeFormat {
  D = 1,
  H = 2,
  M = 4,
  S = 8,
}

export const formatTime = (seconds: number) => {
  // Handle invalid or infinite values
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "N/A";
  }

  // Cap at 999 days to avoid unreasonably large numbers
  const maxDays = 999;
  if (seconds > maxDays * 24 * 60 * 60) {
    return `${maxDays}d+`;
  }

  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  // Only show the two most significant units
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
};

export const ResourceIdToMiningType: Partial<Record<ResourcesIds, ResourceMiningTypes>> = {
  [ResourcesIds.Copper]: ResourceMiningTypes.Forge,
  [ResourcesIds.ColdIron]: ResourceMiningTypes.Forge,
  [ResourcesIds.Ignium]: ResourceMiningTypes.Forge,
  [ResourcesIds.Gold]: ResourceMiningTypes.Forge,
  [ResourcesIds.Silver]: ResourceMiningTypes.Forge,
  [ResourcesIds.Diamonds]: ResourceMiningTypes.Mine,
  [ResourcesIds.Sapphire]: ResourceMiningTypes.Mine,
  [ResourcesIds.Ruby]: ResourceMiningTypes.Mine,
  [ResourcesIds.DeepCrystal]: ResourceMiningTypes.Mine,
  [ResourcesIds.TwilightQuartz]: ResourceMiningTypes.Mine,
  [ResourcesIds.EtherealSilica]: ResourceMiningTypes.Mine,
  [ResourcesIds.Stone]: ResourceMiningTypes.Mine,
  [ResourcesIds.Coal]: ResourceMiningTypes.Mine,
  [ResourcesIds.Obsidian]: ResourceMiningTypes.Mine,
  [ResourcesIds.TrueIce]: ResourceMiningTypes.Mine,
  [ResourcesIds.Wood]: ResourceMiningTypes.LumberMill,
  [ResourcesIds.Hartwood]: ResourceMiningTypes.LumberMill,
  [ResourcesIds.Ironwood]: ResourceMiningTypes.LumberMill,
  [ResourcesIds.Mithral]: ResourceMiningTypes.Forge,
  [ResourcesIds.Dragonhide]: ResourceMiningTypes.Dragonhide,
  [ResourcesIds.AlchemicalSilver]: ResourceMiningTypes.Forge,
  [ResourcesIds.Adamantine]: ResourceMiningTypes.Forge,
  [ResourcesIds.AncientFragment]: ResourceMiningTypes.Mine,
};

export const toInteger = (value: number): number => Math.floor(value);

export const currentTickCount = (time: number) => {
  const configManager = ClientConfigManager.instance();
  const tickIntervalInSeconds = configManager.getTick(TickIds.Armies) || 1;
  return Number(time / tickIntervalInSeconds);
};

export function calculateDistance(start: Position, destination: Position): number {
  // d = √((x2-x1)² + (y2-y1)²)

  // Calculate the difference in x and y coordinates
  const deltaX = Math.abs(start.x - destination.x);
  const deltaY = Math.abs(start.y - destination.y);

  // Calculate the distance using the Pythagorean theorem
  // Each tile is 1 km, so we don't need to divide by 10000 here
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  return distance;
}

export const nanogramToKg = (value: number) => {
  return value / 10 ** 12;
};

export const kgToNanogram = (value: number) => {
  return value * 10 ** 12;
};

export const gramToKg = (value: number) => {
  return value / 1000;
};

export const kgToGram = (value: number) => {
  return value * 1000;
};

export function multiplyByPrecision(value: number): number {
  return Math.floor(value * RESOURCE_PRECISION);
}

export function divideByPrecision(value: number, floor: boolean = true): number {
  return floor ? Math.floor(value / RESOURCE_PRECISION) : value / RESOURCE_PRECISION;
}

export function divideWithPrecision(
  numerator: bigint,
  denominator: bigint,
  decimalPlaces: number = 5,
  round: number = 2,
) {
  // Scale up by multiplying by 10^decimalPlaces
  const scaleFactor = 10n ** BigInt(decimalPlaces);
  const scaledNumerator = numerator * scaleFactor;

  // Perform the division
  const quotient = scaledNumerator / denominator;

  // Convert to string and insert decimal point
  let result = quotient.toString();

  // Pad with leading zeros if needed
  while (result.length <= decimalPlaces) {
    result = "0" + result;
  }

  // Insert decimal point
  const insertAt = result.length - decimalPlaces;
  let a = result.slice(0, insertAt) + "." + result.slice(insertAt);

  // convert to decimal
  return Number(Number(a).toFixed(round));
}

export const getIsBlitz = () => !!configManager.getBlitzConfig()?.blitz_mode_on;
