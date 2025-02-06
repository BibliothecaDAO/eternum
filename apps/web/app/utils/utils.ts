import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { validateAndParseAddress } from "starknet";
import { ChainId } from "@realms-world/constants";
import { env } from "env";

export const SUPPORTED_L1_CHAIN_ID =
  env.VITE_PUBLIC_CHAIN == "sepolia" ? ChainId.SEPOLIA : ChainId.MAINNET;

export const SUPPORTED_L2_CHAIN_ID =
  SUPPORTED_L1_CHAIN_ID === ChainId.SEPOLIA
    ? ChainId.SN_SEPOLIA
    : ChainId.SN_MAIN;


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function shortenAddress(str = "") {
  let formatted = formatAddress(str);

  // Only remove extra zeros after "0x" if there's at least one non-zero digit.
  if (/[^0]/.test(formatted.slice(2))) {
    formatted = formatted.replace(/^(0x)0+/, "$1");
  }

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
export function formatNumber(
  amount: number | null | undefined,
  maximumFractionDigits = 2,
) {
  if (amount === null || amount === undefined) {
    return "-";
  }
  const formatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  });

  return formatter.format(amount);
}
export function abbreviateNumber(value: number | string): string {
  const num = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(num)) return "0";
  if (Math.abs(num) < 1e3) return num.toString();
  if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, "") + "b";
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, "") + "m";
  if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return num.toString();
}