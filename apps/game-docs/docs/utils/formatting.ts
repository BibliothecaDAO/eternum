import { RESOURCE_PRECISION } from "@bibliothecadao/types";

export function addSpacesBeforeCapitals(str: string): string {
  return str.replace(/([A-Z])/g, " $1").trim();
}

export function formatNumberWithSpaces(number: number): string {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export const formatAmount = (amount: number) => {
  if (amount < 1) {
    return `${amount * RESOURCE_PRECISION}`;
  } else if (amount < RESOURCE_PRECISION) {
    return `${amount.toFixed(amount % 1 === 0 ? 0 : (amount % 1) % 0.1 === 0 ? 1 : 2)}K`;
  } else {
    return `${(amount / RESOURCE_PRECISION).toFixed(amount % RESOURCE_PRECISION === 0 ? 0 : (amount % RESOURCE_PRECISION) % 10 === 0 ? 1 : 2)}M`;
  }
};

export const formatNumber = (num: number, decimals: number): string => {
  let str = num.toFixed(decimals);

  if (str.includes(".")) {
    str = str.replace(/\.?0+$/, "");
  }

  return str;
};

/** A number as pages write it. Anything else is a missing or misread value, and fails the build rather than reading 0. */
export function formatNumberWithCommas(number: number): string {
  if (typeof number !== "number" || !Number.isFinite(number)) {
    throw new Error(`formatNumberWithCommas was given ${String(number)}, not a number`);
  }
  return number.toLocaleString("en-US");
}

export const currencyFormat = (num: number, decimals: number): string => {
  return formatNumber(num / RESOURCE_PRECISION, decimals);
};
