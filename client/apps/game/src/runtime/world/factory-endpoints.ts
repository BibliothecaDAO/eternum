import type { Chain } from "@contracts";

// Factory SQL base endpoints by chain. Extend as needed.
export const getFactorySqlBaseUrl = (chain: Chain): string => {
  switch (chain) {
    case "sepolia":
      return "https://api.cartridge.gg/x/eternum-dojo-world-factory/torii/sql";
    // Placeholder mappings for future support
    case "local":
    case "slot":
    case "slottest":
    case "mainnet":
    default:
      return "";
  }
};
