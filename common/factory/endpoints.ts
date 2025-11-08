export type Chain = "slot" | "slottest" | "local" | "sepolia" | "mainnet" | string;

/**
 * Returns the Factory Torii SQL base URL for a given chain.
 * The Cartridge API base can be overridden; defaults to https://api.cartridge.gg.
 */
export function getFactorySqlBaseUrl(chain: Chain, cartridgeApiBase?: string): string {
  const base =
    cartridgeApiBase ||
    (typeof process !== "undefined" ? (process as any).env?.CARTRIDGE_API_BASE : undefined) ||
    "https://api.cartridge.gg";
  switch (chain) {
    case "sepolia":
      return `${base}/x/eternum-factory-sepolia/torii/sql`;
    case "slot":
    case "slottest":
    case "local":
      return `${base}/x/eternum-factory-slot/torii/sql`;
    default:
      return "";
  }
}
