import type { Chain } from "../types";

/**
 * Returns the Factory Torii SQL base URL for a given chain.
 * The Cartridge API base can be overridden; defaults to https://api.cartridge.gg.
 */
export function getFactorySqlBaseUrl(chain: Chain, cartridgeApiBase?: string): string {
  const base = cartridgeApiBase || "https://api.cartridge.gg";
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
}

/**
 * Build a Torii base URL for a given world name
 */
export function buildToriiBaseUrl(worldName: string, cartridgeApiBase?: string): string {
  const base = cartridgeApiBase || "https://api.cartridge.gg";
  return `${base}/x/${worldName}/torii`;
}

/**
 * Normalize chain values (slottest/local -> slot for factory purposes)
 */
export function normalizeFactoryChain(chain: Chain): Chain {
  if (chain === "slottest" || chain === "local") return "slot";
  return chain;
}

/**
 * Get a unique key for a world (chain:name or just name)
 */
export function getWorldKey(world: { name: string; chain?: string }): string {
  return world.chain ? `${world.chain}:${world.name}` : world.name;
}

/**
 * Get the Cartridge API base URL
 */
export function getCartridgeApiBase(): string {
  return "https://api.cartridge.gg";
}

/**
 * Get the RPC URL for a given chain and optional world name
 */
export function getRpcUrlForChain(chain: Chain, worldName?: string, cartridgeApiBase?: string): string {
  const base = cartridgeApiBase || getCartridgeApiBase();
  switch (chain) {
    case "mainnet":
      return `${base}/x/starknet/mainnet`;
    case "sepolia":
      return `${base}/x/starknet/sepolia`;
    case "slot":
    case "slottest":
      // For slot chains, use the world's katana if available
      if (worldName) {
        return `${base}/x/${worldName}/katana`;
      }
      return `${base}/x/starknet/mainnet`;
    case "local":
      return "http://localhost:5050";
    default:
      return `${base}/x/starknet/mainnet`;
  }
}
