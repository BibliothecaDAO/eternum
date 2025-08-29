import { divideByPrecision } from "@bibliothecadao/eternum";
import clsx, { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { AppRoute } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper to ensure type-safety when using routes
export const getRoute = (route: AppRoute): AppRoute => route;

export function displayAddress(string: string) {
  if (string === undefined) return "unknown";
  return string.substring(0, 6) + "..." + string.substring(string.length - 4);
}

export const formatNumber = (num: number, decimals: number = 0): string => {
  // Convert to string with max decimals
  let str = num.toFixed(decimals);

  // Remove trailing zeros after decimal point
  if (str.includes(".")) {
    str = str.replace(/\.?0+$/, "");
  }

  return str;
};

export const currencyFormat = (num: number, decimals: number = 0): string => {
  const formattedDecimals = formatNumber(divideByPrecision(num), decimals);
  return Number(formattedDecimals).toLocaleString();
};

export function currencyIntlFormat(num: number, decimals: number = 2): string {
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: decimals,
  }).format(num || 0);
}
