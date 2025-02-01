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