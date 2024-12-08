import { EternumGlobalConfig } from "@bibliothecadao/eternum";

export function formatNumberWithSpaces(number: number): string {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export const formatAmount = (amount: number): string => {
  if (!amount || amount < 0) return "0";
  if (amount < 1000) return amount.toString();
  if (amount < 1000000) return `${(amount / 1000).toFixed(1)}K`;
  return `${(amount / 1000000).toFixed(1)}M`;
};

export const formatNumber = (num: number, decimals: number): string => {
  let str = num.toFixed(decimals);

  if (str.includes(".")) {
    str = str.replace(/\.?0+$/, "");
  }

  return str;
};

export const currencyFormat = (num: number, decimals: number): string => {
  return formatNumber(num / EternumGlobalConfig.resources.resourcePrecision, decimals);
};

export function multiplyByPrecision(value: number): number {
  return Math.floor(value * EternumGlobalConfig.resources.resourcePrecision);
}

export function divideByPrecision(value: number): number {
  return value / EternumGlobalConfig.resources.resourcePrecision;
}
