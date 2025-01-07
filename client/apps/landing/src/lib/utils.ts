import {
  BuildingType,
  ContractAddress,
  EternumGlobalConfig,
  type ID,
  type Position,
  type Resource,
} from "@bibliothecadao/eternum";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { Connector } from "@starknet-react/core";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export { getEntityIdFromKeys };

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const toHexString = (num: bigint) => {
  return `0x${num.toString(16)}`;
};

export const checkCartridgeConnector = (connector?: Connector) => {
  return connector?.id === "controller";
};

export const formatNumber = (num: number, decimals: number): string => {
  return num.toFixed(decimals).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
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

export function multiplyByPrecision(value: number): number {
  return Math.floor(value * EternumGlobalConfig.resources.resourcePrecision);
}

export function divideByPrecision(value: number): number {
  return value / EternumGlobalConfig.resources.resourcePrecision;
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
  return (sum % 5) + 1;
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

export enum TimeFormat {
  D = 1,
  H = 2,
  M = 4,
  S = 8,
}

export const formatTime = (
  seconds: number,
  format: TimeFormat = TimeFormat.D | TimeFormat.H | TimeFormat.M | TimeFormat.S,
): string => {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0 && format & TimeFormat.D) parts.push(`${days}d`);
  if (hours > 0 && format & TimeFormat.H) parts.push(`${hours}h`);
  if (minutes > 0 && format & TimeFormat.M) parts.push(`${minutes}m`);
  if (remainingSeconds > 0 && format & TimeFormat.S) parts.push(`${remainingSeconds}s`);

  return parts.join(" ");
};

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

export const isResourceProductionBuilding = (buildingId: BuildingType) => {
  return (
    buildingId === BuildingType.Resource ||
    buildingId === BuildingType.Farm ||
    buildingId === BuildingType.FishingVillage ||
    buildingId === BuildingType.Barracks ||
    buildingId === BuildingType.ArcheryRange ||
    buildingId === BuildingType.Stable
  );
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
