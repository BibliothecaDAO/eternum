import { EternumGlobalConfig } from "@bibliothecadao/eternum";

export function formatNumberWithSpaces(number: number): string {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

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
