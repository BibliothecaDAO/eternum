import { getFactorySqlBaseUrl as getFactorySqlBaseUrlRuntime } from "@/runtime/world";
import {
  DEFAULT_FACTORY_NAMESPACE,
  FACTORY_ADDRESSES as SHARED_FACTORY_ADDRESSES,
  getFactoryExplorerTxUrl,
  resolveFactoryConfigDefaultVersion,
} from "@/ui/features/factory/shared/factory-metadata";
import { getSeasonAddresses, type Chain } from "@contracts";
import { env } from "../../../../env";
import type { ChainType } from "./utils/manifest-loader";

// Storage keys
export const WORLD_NAMES_STORAGE_KEY = "eternum_world_names";
export const CURRENT_WORLD_NAME_KEY = "eternum_current_world_name";
export const INDEXER_CREATION_COOLDOWN_KEY = "eternum_indexer_cooldown";
export const CONFIGURED_WORLDS_KEY = "eternum_configured_worlds";
export const WORLD_DEPLOYED_ADDRESS_MAP_KEY = "eternum_world_deployed_address_map";
export const WORLD_SERIES_METADATA_KEY = "eternum_world_series_metadata";

// Defaults
export const getDefaultVersion = resolveFactoryConfigDefaultVersion;
export const DEFAULT_NAMESPACE = DEFAULT_FACTORY_NAMESPACE;
export const INDEXER_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// External endpoints (env-backed with safe defaults)
export const CARTRIDGE_API_BASE = env.VITE_PUBLIC_CARTRIDGE_API_BASE || "https://api.cartridge.gg";
export const TORII_CREATOR_URL =
  env.VITE_PUBLIC_TORII_CREATOR_URL || "https://torii-creator.zerocredence.workers.dev/dispatch/torii";

// Explorer helpers
export const getExplorerTxUrl = (chain: Chain | ChainType, txHash: string) =>
  getFactoryExplorerTxUrl(chain as Chain, txHash);

// Factory addresses by chain (single source of truth for UI)
export const FACTORY_ADDRESSES: Record<ChainType, string> = SHARED_FACTORY_ADDRESSES;

// Default max actions per chain (mirrors FACTORY_ADDRESSES pattern)
const DEFAULT_MAX_ACTIONS_BY_CHAIN: Record<ChainType, number> = {
  mainnet: 70,
  sepolia: 20,
  slot: 300,
  slottest: 300,
  local: 300,
};

export const getDefaultMaxActionsForChain = (chain: ChainType): number => DEFAULT_MAX_ACTIONS_BY_CHAIN[chain];

const parsePositiveInt = (value?: string): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const DEFAULT_FACTORY_DEPLOY_REPEATS_BY_CHAIN: Record<ChainType, number> = {
  mainnet: 3,
  sepolia: 1,
  slot: 1,
  slottest: 1,
  local: 1,
};

export const getFactoryDeployRepeatsForChain = (chain: ChainType): number => {
  const override = parsePositiveInt(env.VITE_PUBLIC_FACTORY_DEPLOY_REPEATS);
  return override ?? DEFAULT_FACTORY_DEPLOY_REPEATS_BY_CHAIN[chain];
};

interface BlitzRegistrationDefaults {
  amount: string;
  precision: number;
  token: string;
}

export const getDefaultBlitzRegistrationConfig = (chain: ChainType): BlitzRegistrationDefaults => {
  const addresses = getSeasonAddresses(chain as Chain);
  return {
    amount: chain === "mainnet" ? "250" : "0.000000000000001",
    precision: 18,
    token: chain === "mainnet" ? addresses.lords : addresses.strk,
  };
};

// Public API: reuse runtime helper for SQL base URL
export const getFactorySqlBaseUrl = (chain: Chain) => getFactorySqlBaseUrlRuntime(chain);

// Bank creation config (eternum only)
export const BANK_STEPS_FROM_CENTER = 15 * 21;
export const BANK_NAME_PREFIX = "Central Bank";
export const BANK_COUNT = 6;

// Torii RPC per environment (admin usage)
export const getRpcUrlForChain = (chain: Chain | ChainType): string => {
  switch (chain) {
    case "mainnet":
      return `${CARTRIDGE_API_BASE}/x/starknet/mainnet`;
    case "sepolia":
      return `${CARTRIDGE_API_BASE}/x/starknet/sepolia`;
    case "slot":
      return `${CARTRIDGE_API_BASE}/x/eternum-blitz-slot-4/katana`;
    case "slottest":
      return `${CARTRIDGE_API_BASE}/x/eternum-blitz-slot-test/katana`;
    default:
      return env.VITE_PUBLIC_NODE_URL as string;
  }
};
