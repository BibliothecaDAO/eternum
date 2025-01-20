import { RESOURCE_PRECISION } from "@bibliothecadao/eternum";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatNumber = (num: number, decimals: number): string => {
  return num.toFixed(decimals).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
};

export const currencyFormat = (num: number, decimals: number): string => {
  return formatNumber(divideByPrecision(num), decimals);
};

export function displayAddress(string: string) {
  if (string === undefined) return "unknown";
  return string.substring(0, 6) + "..." + string.substring(string.length - 4);
}

export function multiplyByPrecision(value: number): number {
  return Math.floor(value * RESOURCE_PRECISION);
}

export function divideByPrecision(value: number): number {
  return value / RESOURCE_PRECISION;
}
