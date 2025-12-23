import type { Chain } from "./types";

export const DEFAULT_CARTRIDGE_API_BASE = "https://api.cartridge.gg";

export const getFactorySqlBaseUrl = (chain: Chain, cartridgeApiBase: string = DEFAULT_CARTRIDGE_API_BASE): string => {
  const base = cartridgeApiBase || DEFAULT_CARTRIDGE_API_BASE;
  switch (chain) {
    case "mainnet":
      return `${base}/x/eternum-factory-mainnet/torii/sql`;
    case "sepolia":
      return `${base}/x/eternum-factory-sepolia/torii/sql`;
    case "slot":
    case "slottest":
    case "local":
      return `${base}/x/eternum-factory-slot/torii/sql`;
    default:
      return "";
  }
};
