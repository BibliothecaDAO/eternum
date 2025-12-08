import { getFactorySqlBaseUrl as getFactorySqlBaseUrlRuntime } from "@/runtime/world";
import type { Chain } from "@contracts";
import { env } from "../../../../env";
import type { ChainType } from "./utils/manifest-loader";

// Storage keys
export const WORLD_NAMES_STORAGE_KEY = "eternum_world_names";
export const CURRENT_WORLD_NAME_KEY = "eternum_current_world_name";
export const INDEXER_CREATION_COOLDOWN_KEY = "eternum_indexer_cooldown";
export const CONFIGURED_WORLDS_KEY = "eternum_configured_worlds";
export const WORLD_DEPLOYED_ADDRESS_MAP_KEY = "eternum_world_deployed_address_map";

// Defaults
export const DEFAULT_VERSION = "180";
export const DEFAULT_NAMESPACE = "s1_eternum";
export const INDEXER_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// External endpoints (env-backed with safe defaults)
export const CARTRIDGE_API_BASE = env.VITE_PUBLIC_CARTRIDGE_API_BASE || "https://api.cartridge.gg";
export const TORII_CREATOR_URL =
  env.VITE_PUBLIC_TORII_CREATOR_URL || "https://torii-creator.zerocredence.workers.dev/dispatch/torii";

// Explorer helpers
export const EXPLORER_MAINNET = env.VITE_PUBLIC_EXPLORER_MAINNET || "https://voyager.online";
export const EXPLORER_SEPOLIA = env.VITE_PUBLIC_EXPLORER_SEPOLIA || "https://sepolia.voyager.online";

export const getExplorerTxUrl = (chain: Chain | ChainType, txHash: string) => {
  const base = chain === "sepolia" ? EXPLORER_SEPOLIA : EXPLORER_MAINNET;
  return `${base}/tx/${txHash}`;
};

// Factory addresses by chain (single source of truth for UI)
export const FACTORY_ADDRESSES: Record<ChainType, string> = {
  sepolia: "0x07A6F094f15f8C18704bfb19fFEBCBC70b87e41674dE97EbeC7cb7Ffe5c9581B",
  slot: "0x4b4e92fbcc6fdc40db899b345da2c08cf617df30660e71d1adcfb1301d5a06e",
  local: "",
  mainnet: "0x03f0207667f8a6f024513ba1224d1bb45a2075405a69bc21ae95a0812f56c0e8",
  slottest: "",
};

// Default max actions per chain (mirrors FACTORY_ADDRESSES pattern)
export const DEFAULT_MAX_ACTIONS_BY_CHAIN: Record<ChainType, number> = {
  mainnet: 20,
  sepolia: 20,
  slot: 300,
  slottest: 300,
  local: 300,
};

export const getDefaultMaxActionsForChain = (chain: ChainType): number => DEFAULT_MAX_ACTIONS_BY_CHAIN[chain];

// Public API: reuse runtime helper for SQL base URL
export const getFactorySqlBaseUrl = (chain: Chain) => getFactorySqlBaseUrlRuntime(chain);

// Torii RPC per environment (admin usage)
export const getRpcUrlForChain = (chain: Chain | ChainType): string => {
  switch (chain) {
    case "mainnet":
      return `${CARTRIDGE_API_BASE}/x/starknet/mainnet`;
    case "sepolia":
      return `${CARTRIDGE_API_BASE}/x/starknet/sepolia`;
    case "slot":
      return `${CARTRIDGE_API_BASE}/x/eternum-blitz-slot-3/katana`;
    case "slottest":
      return `${CARTRIDGE_API_BASE}/x/eternum-blitz-slot-test/katana`;
    default:
      return env.VITE_PUBLIC_NODE_URL as string;
  }
};

export const DEFAULT_TORII_NAMESPACE = DEFAULT_NAMESPACE;
