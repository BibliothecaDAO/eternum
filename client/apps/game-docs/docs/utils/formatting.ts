import { RESOURCE_PRECISION } from "@bibliothecadao/eternum";

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

export function formatNumberWithCommas(number: number): string {
  return number.toLocaleString("en-US");
}

export const currencyFormat = (num: number, decimals: number): string => {
  return formatNumber(num / RESOURCE_PRECISION, decimals);
};
