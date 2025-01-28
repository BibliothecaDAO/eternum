import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { validateAndParseAddress } from "starknet";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function shortenAddress(str = "") {
  const formatted = formatAddress(str);

  return `${formatted.slice(0, 6)}...${formatted.slice(formatted.length - 4)}`;
}
export function formatAddress(address: string) {
  //if (address.length === 42) return getAddress(address);
  try {
    return validateAndParseAddress(address);
  } catch {
    return address;
  }
}