import { ClientConfigManager, divideByPrecision } from "@bibliothecadao/eternum";

import { ContractAddress, ID, TickIds, type Position, type Resource } from "@bibliothecadao/types";
import { getEntityIdFromKeys } from "@dojoengine/utils";

export { getEntityIdFromKeys };

export const toInteger = (value: number): number => Math.floor(value);

export const toHexString = (num: bigint) => {
  return `0x${num.toString(16)}`;
};

export const formatNumber = (num: number, decimals: number): string => {
  // Convert to string with max decimals
  let str = num.toFixed(decimals);

  // Remove trailing zeros after decimal point
  if (str.includes(".")) {
    str = str.replace(/\.?0+$/, "");
  }

  return str;
};

export const currencyFormat = (num: number, decimals: number): string => {
  return formatNumber(divideByPrecision(num), decimals);
};

export function currencyIntlFormat(num: number, decimals: number = 2): string {
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: decimals,
  }).format(num || 0);
}

export function displayAddress(string: string) {
  if (string === undefined) return "unknown";
  return string.substring(0, 6) + "..." + string.substring(string.length - 4);
}

export function roundDownToPrecision(value: bigint, precision: number) {
  return BigInt(Number(value) - (Number(value) % Number(precision)));
}

export function roundUpToPrecision(value: bigint, precision: number) {
  return BigInt(Number(value) + (Number(precision) - (Number(value) % Number(precision))));
}

export function addressToNumber(address: string) {
  // Convert the address to a big integer
  let numericValue = ContractAddress(address);

  // Sum the digits of the numeric value
  let sum = 0;
  while (numericValue > 0) {
    sum += Number(numericValue % 5n);
    numericValue /= 5n;
  }

  // Map the sum to a number between 1 and 10
  const result = (sum % 5) + 1;

  // Pad with a 0 if the result is less than 10
  return result < 10 ? `0${result}` : result.toString();
}

export function calculateDistance(start: Position, destination: Position): number | undefined {
  // d = √((x2-x1)² + (y2-y1)²)

  if (start && destination) {
    // Calculate the difference in x and y coordinates
    const deltaX = Math.abs(start.x - destination.x);
    const deltaY = Math.abs(start.y - destination.y);

    // Calculate the distance using the Pythagorean theorem
    // Each tile is 1 km, so we don't need to divide by 10000 here
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    return distance;
  }
}

export const calculateOffset = (index: number, total: number, radius: number) => {
  if (total === 1) return { x: 0, y: 0 };

  const angleIncrement = (2 * Math.PI) / 6; // Maximum 6 points on the circumference for the first layer
  let angle = angleIncrement * (index % 6);
  let offsetRadius = radius;

  if (index >= 6) {
    // Adjustments for more than 6 armies, placing them in another layer
    offsetRadius += 0.5; // Increase radius for each new layer
    angle += angleIncrement / 2; // Offset angle to interleave with previous layer
  }

  return {
    x: offsetRadius * Math.cos(angle),
    z: offsetRadius * Math.sin(angle),
  };
};

// const pseudoRandom = (x: number, y: number) => {
//   const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
//   return n - Math.floor(n);
// };

// export const ResourceIdToMiningType: Partial<Record<ResourcesIds, ResourceMiningTypes>> = {
//   [ResourcesIds.Copper]: ResourceMiningTypes.Forge,
//   [ResourcesIds.ColdIron]: ResourceMiningTypes.Forge,
//   [ResourcesIds.Ignium]: ResourceMiningTypes.Forge,
//   [ResourcesIds.Gold]: ResourceMiningTypes.Forge,
//   [ResourcesIds.Silver]: ResourceMiningTypes.Forge,
//   [ResourcesIds.Diamonds]: ResourceMiningTypes.Mine,
//   [ResourcesIds.Sapphire]: ResourceMiningTypes.Mine,
//   [ResourcesIds.Ruby]: ResourceMiningTypes.Mine,
//   [ResourcesIds.DeepCrystal]: ResourceMiningTypes.Mine,
//   [ResourcesIds.TwilightQuartz]: ResourceMiningTypes.Mine,
//   [ResourcesIds.EtherealSilica]: ResourceMiningTypes.Mine,
//   [ResourcesIds.Stone]: ResourceMiningTypes.Mine,
//   [ResourcesIds.Coal]: ResourceMiningTypes.Mine,
//   [ResourcesIds.Obsidian]: ResourceMiningTypes.Mine,
//   [ResourcesIds.TrueIce]: ResourceMiningTypes.Mine,
//   [ResourcesIds.Wood]: ResourceMiningTypes.LumberMill,
//   [ResourcesIds.Hartwood]: ResourceMiningTypes.LumberMill,
//   [ResourcesIds.Ironwood]: ResourceMiningTypes.LumberMill,
//   [ResourcesIds.Mithral]: ResourceMiningTypes.Forge,
//   [ResourcesIds.Dragonhide]: ResourceMiningTypes.Dragonhide,
//   [ResourcesIds.AlchemicalSilver]: ResourceMiningTypes.Forge,
//   [ResourcesIds.Adamantine]: ResourceMiningTypes.Forge,
//   [ResourcesIds.AncientFragment]: ResourceMiningTypes.Mine,
// };

export enum TimeFormat {
  D = 1,
  H = 2,
  M = 4,
  S = 8,
}

export const copyPlayerAddressToClipboard = (address: ContractAddress, name: string) => {
  navigator.clipboard
    .writeText(address.toString())
    .then(() => {
      alert(`Address of ${name} copied to clipboard`);
    })
    .catch((err) => {
      console.error("Failed to copy: ", err);
    });
};

export const isRealmSelected = (structureEntityId: ID, structures: any) => {
  const selectedStructure = structures?.find((structure: any) => structure?.entity_id === structureEntityId);
  return selectedStructure?.category === "Realm";
};

export const formatSecondsInHoursMinutes = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${hours}h:${minutes}m`;
};

export const currentTickCount = (time: number) => {
  const configManager = ClientConfigManager.instance();
  const tickIntervalInSeconds = configManager.getTick(TickIds.Armies) || 1;
  return Number(time / tickIntervalInSeconds);
};

export function gramToKg(grams: number): number {
  return Number(grams) / 1000;
}

export function kgToGram(kg: number): number {
  return Number(kg) * 1000;
}

export const formatResources = (resources: any[]): Resource[] => {
  return resources
    .map((resource) => ({
      resourceId: Number(resource[0].value),
      amount: Number(resource[1].value),
    }))
    .filter((resource) => resource.amount > 0);
};

const accentsToAscii = (str: string) => {
  // Character map for transliteration to ASCII
  const charMap: Record<string, string> = {
    á: "a",
    ú: "u",
    é: "e",
    ä: "a",
    Š: "S",
    Ï: "I",
    š: "s",
    Í: "I",
    í: "i",
    ó: "o",
    ï: "i",
    ë: "e",
    ê: "e",
    â: "a",
    Ó: "O",
    ü: "u",
    Á: "A",
    Ü: "U",
    ô: "o",
    ž: "z",
    Ê: "E",
    ö: "o",
    č: "c",
    Â: "A",
    Ä: "A",
    Ë: "E",
    É: "E",
    Č: "C",
    Ž: "Z",
    Ö: "O",
    Ú: "U",
    Ô: "O",
    "‘": "'",
  };
  const transliterate = (str: string) => {
    return str
      .split("")
      .map((char) => charMap[char] || char)
      .join("");
  };
  return transliterate(str);
};

export const toValidAscii = (str: string) => {
  const intermediateString = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return accentsToAscii(intermediateString);
};

export const separateCamelCase = (str: string): string => {
  return str
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};
