import { divideByPrecision } from "@bibliothecadao/eternum";
import { ResourceCost, ResourcesIds } from "@bibliothecadao/types";
import { getEntityIdFromKeys } from "@bibliothecadao/eternum";

export { getEntityIdFromKeys };

/** A raw balance for display: undefined when it is not known here, which shows as "—", never as zero. */
export const knownBalance = (raw: bigint | number | undefined): number | undefined =>
  raw === undefined ? undefined : divideByPrecision(Number(raw));

/**
 * A raw amount as it is written: divided out exactly, never floored, so a fraction reaches the words module ("<1",
 * "0.25 LORDS"). Undefined when it is not known here. knownBalance floors it for what a player can spend.
 */
export const knownAmount = (raw: bigint | number | undefined): number | undefined =>
  raw === undefined ? undefined : divideByPrecision(Number(raw), false);

export function displayAddress(string: string) {
  if (string === undefined) return "unknown";
  return string.substring(0, 6) + "..." + string.substring(string.length - 4);
}

/** A list's sort: the key it sorts on, and which way (none keeps the list's own order). */
export type SortInterface = {
  sortKey: string;
  sort: "asc" | "desc" | "none";
};

export function sortItems<T>(items: T[], activeSort: SortInterface, defaultSortKey: SortInterface): T[] {
  const compareValues = (a: T, b: T, sortKey: string, sortDirection: "asc" | "desc" | "none"): number => {
    const valueA = getNestedPropertyValue(a, sortKey);
    const valueB = getNestedPropertyValue(b, sortKey);

    let comparison = 0;

    if (sortKey === "age" && typeof valueA === "string" && typeof valueB === "string") {
      comparison = timeStringToSeconds(valueA) - timeStringToSeconds(valueB);
    } else if (typeof valueA === "string" && typeof valueB === "string") {
      comparison = valueA.localeCompare(valueB);
    } else if (typeof valueA === "number" && typeof valueB === "number") {
      comparison = valueA - valueB;
    }

    return sortDirection === "asc" ? comparison : -comparison;
  };

  if (activeSort.sort !== "none") {
    return items.toSorted((a, b) => compareValues(a, b, activeSort.sortKey, activeSort.sort));
  } else {
    return items.toSorted((a, b) => compareValues(a, b, defaultSortKey.sortKey, defaultSortKey.sort));
  }
}

function getNestedPropertyValue<T>(item: T, propertyPath: string) {
  return propertyPath
    .split(".")
    .reduce(
      (currentObject, propertyName) =>
        currentObject ? (currentObject as Record<string, any>)[propertyName] : undefined,
      item,
    );
}

function timeStringToSeconds(timeStr: string): number {
  const value = parseInt(timeStr);
  const unit = timeStr.slice(-1).toLowerCase();

  switch (unit) {
    case "d":
      return value * 86400;
    case "h":
      return value * 3600;
    case "m":
      return value * 60;
    case "s":
      return value;
    default:
      return 0;
  }
}

export const getRandomBackgroundImage = () => {
  const timestamp = Math.floor(Date.now() / 1000);
  const imageNumber = (timestamp % 7) + 1;
  const paddedNumber = imageNumber.toString().padStart(2, "0");
  return paddedNumber;
};

export const adjustWonderLordsCost = (cost: ResourceCost[]): ResourceCost[] => {
  return cost.map((item) => (item.resource === ResourcesIds.Lords ? { ...item, amount: item.amount * 0.1 } : item));
};
