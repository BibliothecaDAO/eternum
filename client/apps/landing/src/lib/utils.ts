import { divideByPrecision } from "@bibliothecadao/eternum";
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
  // If the string is short enough, don't shorten it
  if (string.length <= 10) {
    return string;
  }
  return string.substring(0, 6) + "..." + string.substring(string.length - 4);
}

export const trimAddress = (addr?: string): string => {
  if (!addr || !addr.startsWith("0x")) return addr || "";
  return "0x" + addr.slice(2).replace(/^0+/, "");
};
