import { type ClientComponents } from "@/dojo/createClientComponents";
import { ClientConfigManager } from "@/dojo/modelManager/ConfigManager";
import { configManager } from "@/dojo/setup";
import { CapacityConfigCategory } from "@bibliothecadao/eternum";
import { env } from "../../../../env";

import {
  BuildingType,
  ContractAddress,
  EternumGlobalConfig,
  ResourcesIds,
  TickIds,
  type ID,
  type Position,
  type Resource,
} from "@bibliothecadao/eternum";
import { type ComponentValue } from "@dojoengine/recs";
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

export function multiplyByPrecision(value: number): number {
  return Math.floor(value * EternumGlobalConfig.resources.resourcePrecision);
}

export function divideByPrecision(value: number): number {
  return value / EternumGlobalConfig.resources.resourcePrecision;
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

// export const getHexagonCoordinates = (
//   instancedMesh: THREE.InstancedMesh,
//   instanceId: number,
// ): { hexCoords: HexPosition; position: THREE.Vector3 } => {
//   const matrix = new THREE.Matrix4();
//   instancedMesh.getMatrixAt(instanceId, matrix);
//   const position = new THREE.Vector3();
//   matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());

//   const hexCoords = getHexForWorldPosition(position);

//   return { hexCoords, position };
// };

// export const getWorldPositionForHex = (hexCoords: HexPosition, flat: boolean = true) => {
//   const hexRadius = HEX_SIZE;
//   const hexHeight = hexRadius * 2;
//   const hexWidth = Math.sqrt(3) * hexRadius;
//   const vertDist = hexHeight * 0.75;
//   const horizDist = hexWidth;

//   const col = hexCoords.col;
//   const row = hexCoords.row;
//   const rowOffset = ((row % 2) * Math.sign(row) * horizDist) / 2;
//   const x = col * horizDist - rowOffset;
//   const z = row * vertDist;
//   const y = flat ? 0 : pseudoRandom(x, z) * 2;
//   return new THREE.Vector3(x, y, z);
// };

// export const getHexForWorldPosition = (worldPosition: { x: number; y: number; z: number }): HexPosition => {
//   const hexRadius = HEX_SIZE;
//   const hexHeight = hexRadius * 2;
//   const hexWidth = Math.sqrt(3) * hexRadius;
//   const vertDist = hexHeight * 0.75;
//   const horizDist = hexWidth;

//   const row = Math.round(worldPosition.z / vertDist);
//   // hexception offsets hack
//   const rowOffset = ((row % 2) * Math.sign(row) * horizDist) / 2;
//   const col = Math.round((worldPosition.x + rowOffset) / horizDist);

//   return {
//     col,
//     row,
//   };
// };

// export const calculateDistanceInHexes = (start: Position, destination: Position): number | undefined => {
//   const distance = calculateDistance(start, destination);
//   if (distance) {
//     return Math.round(distance / HEX_SIZE / 2);
//   }
//   return undefined;
// };

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

export const formatTime = (
  seconds: number,
  format: TimeFormat = TimeFormat.D | TimeFormat.H | TimeFormat.M | TimeFormat.S,
  abbreviate: boolean = false,
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

  if (abbreviate) {
    return parts[0] || "0s";
  }

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

export const getTotalResourceWeight = (resources: Array<Resource | undefined>) => {
  const configManager = ClientConfigManager.instance();
  return resources.reduce(
    (total, resource) =>
      total + (resource ? resource.amount * configManager.getResourceWeight(resource.resourceId) || 0 : 0),
    0,
  );
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

export const computeTravelFoodCosts = (
  troops: ComponentValue<ClientComponents["Army"]["schema"]["troops"]> | undefined,
) => {
  const configManager = ClientConfigManager.instance();

  const paladinFoodConsumption = configManager.getTravelFoodCostConfig(ResourcesIds.Paladin);
  const knightFoodConsumption = configManager.getTravelFoodCostConfig(ResourcesIds.Knight);
  const crossbowmanFoodConsumption = configManager.getTravelFoodCostConfig(ResourcesIds.Crossbowman);

  const paladinCount = divideByPrecision(Number(troops?.paladin_count));
  const knightCount = divideByPrecision(Number(troops?.knight_count));
  const crossbowmanCount = divideByPrecision(Number(troops?.crossbowman_count));

  const paladinWheatConsumption = paladinFoodConsumption.travelWheatBurnAmount * paladinCount;
  const knightWheatConsumption = knightFoodConsumption.travelWheatBurnAmount * knightCount;
  const crossbowmanWheatConsumption = crossbowmanFoodConsumption.travelWheatBurnAmount * crossbowmanCount;

  const paladinFishConsumption = paladinFoodConsumption.travelFishBurnAmount * paladinCount;
  const knightFishConsumption = knightFoodConsumption.travelFishBurnAmount * knightCount;
  const crossbowmanFishConsumption = crossbowmanFoodConsumption.travelFishBurnAmount * crossbowmanCount;

  const wheatPayAmount = paladinWheatConsumption + knightWheatConsumption + crossbowmanWheatConsumption;
  const fishPayAmount = paladinFishConsumption + knightFishConsumption + crossbowmanFishConsumption;

  return {
    wheatPayAmount,
    fishPayAmount,
  };
};

export const computeExploreFoodCosts = (
  troops: ComponentValue<ClientComponents["Army"]["schema"]["troops"]> | undefined,
) => {
  const configManager = ClientConfigManager.instance();

  const paladinFoodConsumption = configManager.getTravelFoodCostConfig(ResourcesIds.Paladin);
  const knightFoodConsumption = configManager.getTravelFoodCostConfig(ResourcesIds.Knight);
  const crossbowmanFoodConsumption = configManager.getTravelFoodCostConfig(ResourcesIds.Crossbowman);

  const paladinCount = divideByPrecision(Number(troops?.paladin_count));
  const knightCount = divideByPrecision(Number(troops?.knight_count));
  const crossbowmanCount = divideByPrecision(Number(troops?.crossbowman_count));

  const paladinWheatConsumption = paladinFoodConsumption.exploreWheatBurnAmount * paladinCount;
  const knightWheatConsumption = knightFoodConsumption.exploreWheatBurnAmount * knightCount;
  const crossbowmanWheatConsumption = crossbowmanFoodConsumption.exploreWheatBurnAmount * crossbowmanCount;

  const paladinFishConsumption = paladinFoodConsumption.exploreFishBurnAmount * paladinCount;
  const knightFishConsumption = knightFoodConsumption.exploreFishBurnAmount * knightCount;
  const crossbowmanFishConsumption = crossbowmanFoodConsumption.exploreFishBurnAmount * crossbowmanCount;

  const wheatPayAmount = paladinWheatConsumption + knightWheatConsumption + crossbowmanWheatConsumption;
  const fishPayAmount = paladinFishConsumption + knightFishConsumption + crossbowmanFishConsumption;

  return {
    wheatPayAmount,
    fishPayAmount,
  };
};

export const separateCamelCase = (str: string): string => {
  return str
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export const calculateDonkeysNeeded = (orderWeight: number): number => {
  return Math.ceil(divideByPrecision(orderWeight) / configManager.getCapacityConfig(CapacityConfigCategory.Donkey));
};

export const getSeasonAddressesPath = () => {
  return `/resource_addresses/${env.VITE_PUBLIC_CHAIN}/resource_addresses.json`;
};
export const getJSONFile = async (filePath: string) => {
  const response = await fetch(filePath);
  const data = await response.json();
  return data;
};

export const getSeasonAddresses = async () => {
  try {
    const path = getSeasonAddressesPath();
    const data = await getJSONFile(path);
    return data;
  } catch (error) {
    console.error("Error loading season addresses:", error);
    return {};
  }
};
