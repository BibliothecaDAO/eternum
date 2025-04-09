import type { Config as EternumGlobalConfig } from "@bibliothecadao/types";

export const shortHexAddress = (address: string | undefined | null): string => {
  if (!address) return "Not set";
  if (!address.startsWith("0x")) {
    address = "0x" + BigInt(address).toString(16);
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const addCommas = (amount: number | bigint) => {
  try {
    return BigInt(amount).toLocaleString();
  } catch (e) {
    return amount.toString();
  }
};

export const inGameAmount = (amount: number, config: EternumGlobalConfig) => {
  amount = amount / config.resources.resourcePrecision;
  return addCommas(amount);
};

export const hourMinutesSeconds = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${hours}h ${minutes}m ${remainingSeconds}s`;
};
