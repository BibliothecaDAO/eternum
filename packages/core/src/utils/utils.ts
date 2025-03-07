import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ClientConfigManager } from "..";
import { RESOURCE_PRECISION, ResourcesIds } from "../constants";
import { Position, ResourceMiningTypes, TickIds } from "../types";

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

export const formatTime = (
  seconds: number,
  format: TimeFormat = TimeFormat.D | TimeFormat.H | TimeFormat.M | TimeFormat.S,
  abbreviate: boolean = true,
  clock: boolean = false,
): string => {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  const parts = [];

  if (days > 0 && format & TimeFormat.D) parts.push(`${days}${abbreviate ? "d" : " day(s)"}`);

  if (clock) {
    const formattedHours = hours.toString().padStart(2, "0");
    const formattedMinutes = minutes.toString().padStart(2, "0");
    const formattedSeconds = remainingSeconds.toString().padStart(2, "0");
    parts.push(`${formattedHours}:${formattedMinutes}:${formattedSeconds}`);
  } else {
    if (hours > 0 && format & TimeFormat.H) parts.push(`${hours}${abbreviate ? "h" : " hour(s)"}`);
    if (minutes > 0 && format & TimeFormat.M) parts.push(`${minutes}${abbreviate ? "m" : " minute(s)"}`);
    if (remainingSeconds > 0 && format & TimeFormat.S)
      parts.push(`${remainingSeconds}${abbreviate ? "s" : " second(s)"}`);
  }

  return parts.join(" ");
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

export const gramToKg = (value: number) => {
  return value / 1000;
};

export const kgToGram = (value: number) => {
  return value * 1000;
};

export function multiplyByPrecision(value: number): number {
  return Math.floor(value * RESOURCE_PRECISION);
}

export function divideByPrecision(value: number): number {
  return value / RESOURCE_PRECISION;
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
