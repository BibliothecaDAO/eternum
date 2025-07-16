import { SortInterface } from "@/ui/design-system/atoms/sort-button";
import { getBlockTimestamp } from "@/utils/timestamp";
import { divideByPrecision, toHexString } from "@bibliothecadao/eternum";
import { ContractAddress, ResourceCost, ResourcesIds } from "@bibliothecadao/types";
import { getEntityIdFromKeys } from "@dojoengine/utils";

export { getEntityIdFromKeys };

export const formatStringNumber = (number: number, decimals: number): string => {
  return number.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
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
  const formattedDecimals = formatNumber(divideByPrecision(num, false), decimals);
  return Number(formattedDecimals).toLocaleString();
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

export function divideByPrecisionFormatted(value: number): string {
  return divideByPrecision(value).toLocaleString("en-US");
}

// keep this for later
// export function roundDownToPrecision(value: bigint, precision: number) {
//   return BigInt(Number(value) - (Number(value) % Number(precision)));
// }

// export function roundUpToPrecision(value: bigint, precision: number) {
//   return BigInt(Number(value) + (Number(precision) - (Number(value) % Number(precision))));
// }

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

export const copyPlayerAddressToClipboard = (address: ContractAddress, name: string, hex: boolean = false) => {
  navigator.clipboard
    .writeText(hex ? toHexString(address) : address.toString())
    .then(() => {
      alert(`Address of ${name} copied to clipboard`);
    })
    .catch((err) => {
      console.error("Failed to copy: ", err);
    });
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
    return items.sort((a, b) => compareValues(a, b, activeSort.sortKey, activeSort.sort));
  } else {
    return items.sort((a, b) => compareValues(a, b, defaultSortKey.sortKey, defaultSortKey.sort));
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
  const imageNumber = (timestamp % 6) + 1;
  const paddedNumber = imageNumber.toString().padStart(2, "0");
  return paddedNumber;
};

export const adjustWonderLordsCost = (cost: ResourceCost[]): ResourceCost[] => {
  return cost.map((item) => (item.resource === ResourcesIds.Lords ? { ...item, amount: item.amount * 0.1 } : item));
};

export const normalizeDiacriticalMarks = (str: string) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export const calculateArrivalTime = (travelTimeMinutes: number | undefined) => {
  if (travelTimeMinutes === undefined) return null;

  const currentBlockTimestampMs = getBlockTimestamp().currentBlockTimestamp * 1000;
  const travelTimeMs = travelTimeMinutes * 60 * 1000;
  const arrivalTimeMs = currentBlockTimestampMs + travelTimeMs;

  // Round up to the next hour boundary
  const arrivalDate = new Date(arrivalTimeMs);
  const nextHourDate = new Date(arrivalDate);
  nextHourDate.setHours(arrivalDate.getHours() + 1, 0, 0, 0);

  return nextHourDate;
};

export const formatArrivalTime = (date: Date | null) => {
  if (!date) return "";

  const hours = date.getHours();
  const minutes = date.getMinutes();

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} `;
};
