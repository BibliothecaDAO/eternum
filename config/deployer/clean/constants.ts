import { DEFAULT_FACTORY_CONFIG_VERSION } from "../../shared/factory-defaults";
import { buildSharedChainRuntimeAlias, resolveRuntimeEndpointAlias } from "../../../common/factory/runtime-registry";
import { resolveCanonicalAddress } from "../../source/common/canonical-addresses";
import type { DeploymentEnvironment, DeploymentEnvironmentId } from "./types";
import { CARTRIDGE_VRF_RELEASE } from "./vrf/release";

export const DEFAULT_NAMESPACE = "s1_eternum";
export const DEFAULT_VERSION = DEFAULT_FACTORY_CONFIG_VERSION;
export const DEFAULT_SLOT_MAX_ACTIONS = 300;
export const DEFAULT_MAINNET_MAX_ACTIONS = 50;
export const DEFAULT_MAINNET_CREATE_GAME_SUBMISSION_COUNT = 3;
export const DEFAULT_CREATE_GAME_RETRY_COUNT = 5;
export const DEFAULT_CREATE_GAME_RETRY_DELAY_MS = 10_000;
export const DEFAULT_GAME_LAUNCH_WORKFLOW_FILE = "game-launch.yml";
export const DEFAULT_FACTORY_RUN_STORE_BRANCH = "factory-runs";
export const DEFAULT_FACTORY_RUN_LEASE_DURATION_MS = 45 * 60 * 1000;
export const DEFAULT_FACTORY_ACCOUNT_LEASE_DURATION_MS = 10 * 60 * 1000;
export const DEFAULT_FACTORY_INDEX_TIMEOUT_MS = 5 * 60 * 1000;
export const DEFAULT_FACTORY_INDEX_POLL_MS = 5_000;
export const DEFAULT_CARTRIDGE_API_BASE = "https://api.cartridge.gg";
export const DEFAULT_TORII_WORKFLOW_FILE = "factory-torii-deployer.yml";
export const DEFAULT_INDEXER_MAINTENANCE_WORKFLOW_FILE = "factory-indexer-maintenance.yml";
export const DEFAULT_INDEXER_WORKFLOW_TIMEOUT_MS = 20 * 60 * 1000;
export const DEFAULT_INDEXER_WORKFLOW_POLL_MS = 5_000;
export const DEFAULT_TORII_VERSION = "v1.8.16";
export const DEFAULT_KATANA_VERSION = "v1.7.1";
export const DEFAULT_TORII_SLOT_TEAM = "realms-eternum";
export const DEFAULT_RUNTIME_PROVIDER = "aws";
export const DEFAULT_AWS_RUNTIME_DOMAIN = "runtime.realms.world";
export const DEFAULT_VRF_PROVIDER_ADDRESS = CARTRIDGE_VRF_RELEASE.providerAddress;
export const DEFAULT_MAINNET_FACTORY_ADDRESS = resolveCanonicalAddress("mainnet", "factory");
export const DEFAULT_SLOT_FACTORY_ADDRESS = resolveCanonicalAddress("slot", "factory");
export const DEFAULT_SLOTTEST_FACTORY_ADDRESS = resolveCanonicalAddress("slottest", "factory");
export const DEFAULT_MAINNET_RPC_URL = resolveRuntimeEndpointAlias(buildSharedChainRuntimeAlias("mainnet"));
export const DEFAULT_SEPOLIA_RPC_URL = resolveRuntimeEndpointAlias(buildSharedChainRuntimeAlias("sepolia"));
export const DEFAULT_SLOT_RPC_URL = resolveRuntimeEndpointAlias(buildSharedChainRuntimeAlias("slot"));
export const DEFAULT_SLOTTEST_RPC_URL = resolveRuntimeEndpointAlias(buildSharedChainRuntimeAlias("slottest"));
export const DEFAULT_LOCAL_RPC_URL = "http://127.0.0.1:5050/rpc/v0_9";
export const DEFAULT_SLOT_ACCOUNT_ADDRESS = "0x6677fe62ee39c7b07401f754138502bab7fac99d2d3c5d37df7d1c6fab10819";
export const DEFAULT_SLOT_PRIVATE_KEY = "0x3e3979c1ed728490308054fe357a9f49cf67f80f9721f44cc57235129e090f4";

export const DEFAULT_CHAIN_RPC_URLS: Record<string, string> = {
  mainnet: DEFAULT_MAINNET_RPC_URL,
  sepolia: DEFAULT_SEPOLIA_RPC_URL,
  slot: DEFAULT_SLOT_RPC_URL,
  slottest: DEFAULT_SLOTTEST_RPC_URL,
  local: DEFAULT_LOCAL_RPC_URL,
};

export function resolveDefaultRpcUrl(chain: string): string {
  const rpcUrl = DEFAULT_CHAIN_RPC_URLS[chain];
  if (!rpcUrl) {
    throw new Error(`No default RPC URL configured for chain "${chain}"`);
  }
  return rpcUrl;
}

const SLOT_DEFAULTS = {
  runtimeProvider: "slot" as const,
  runtimeDomain: DEFAULT_AWS_RUNTIME_DOMAIN,
  factoryAddress: DEFAULT_SLOT_FACTORY_ADDRESS,
  rpcUrl: DEFAULT_SLOT_RPC_URL,
  accountAddress: DEFAULT_SLOT_ACCOUNT_ADDRESS,
  privateKey: DEFAULT_SLOT_PRIVATE_KEY,
  createGame: {
    maxActions: DEFAULT_SLOT_MAX_ACTIONS,
    submissionCount: 1,
    retryCount: DEFAULT_CREATE_GAME_RETRY_COUNT,
    retryDelayMs: 0,
  },
};

const SLOTTEST_DEFAULTS = {
  ...SLOT_DEFAULTS,
  factoryAddress: DEFAULT_SLOTTEST_FACTORY_ADDRESS,
  rpcUrl: DEFAULT_SLOTTEST_RPC_URL,
};

const MAINNET_DEFAULTS = {
  runtimeProvider: "aws" as const,
  runtimeDomain: DEFAULT_AWS_RUNTIME_DOMAIN,
  factoryAddress: DEFAULT_MAINNET_FACTORY_ADDRESS,
  rpcUrl: DEFAULT_MAINNET_RPC_URL,
  createGame: {
    maxActions: DEFAULT_MAINNET_MAX_ACTIONS,
    submissionCount: DEFAULT_MAINNET_CREATE_GAME_SUBMISSION_COUNT,
    retryCount: DEFAULT_CREATE_GAME_RETRY_COUNT,
    retryDelayMs: DEFAULT_CREATE_GAME_RETRY_DELAY_MS,
  },
};

const SEPOLIA_DEFAULTS = {
  ...MAINNET_DEFAULTS,
  factoryAddress: undefined,
  rpcUrl: DEFAULT_SEPOLIA_RPC_URL,
};

const LOCAL_DEFAULTS = {
  ...MAINNET_DEFAULTS,
  factoryAddress: undefined,
  rpcUrl: DEFAULT_LOCAL_RPC_URL,
};

export const DEPLOYMENT_ENVIRONMENTS: Record<DeploymentEnvironmentId, DeploymentEnvironment> = {
  "local.blitz": {
    id: "local.blitz",
    chain: "local",
    gameType: "blitz",
    toriiEnv: "local",
    configPath: "config/generated/blitz.local.json",
    ...LOCAL_DEFAULTS,
  },
  "local.eternum": {
    id: "local.eternum",
    chain: "local",
    gameType: "eternum",
    toriiEnv: "local",
    configPath: "config/generated/eternum.local.json",
    ...LOCAL_DEFAULTS,
  },
  "sepolia.blitz": {
    id: "sepolia.blitz",
    chain: "sepolia",
    gameType: "blitz",
    toriiEnv: "sepolia",
    configPath: "config/generated/blitz.sepolia.json",
    ...SEPOLIA_DEFAULTS,
  },
  "sepolia.eternum": {
    id: "sepolia.eternum",
    chain: "sepolia",
    gameType: "eternum",
    toriiEnv: "sepolia",
    configPath: "config/generated/eternum.sepolia.json",
    ...SEPOLIA_DEFAULTS,
  },
  "mainnet.blitz": {
    id: "mainnet.blitz",
    chain: "mainnet",
    gameType: "blitz",
    toriiEnv: "mainnet",
    configPath: "config/generated/blitz.mainnet.json",
    ...MAINNET_DEFAULTS,
  },
  "mainnet.eternum": {
    id: "mainnet.eternum",
    chain: "mainnet",
    gameType: "eternum",
    toriiEnv: "mainnet",
    configPath: "config/generated/eternum.mainnet.json",
    ...MAINNET_DEFAULTS,
  },
  "slot.blitz": {
    id: "slot.blitz",
    chain: "slot",
    gameType: "blitz",
    toriiEnv: "slot",
    configPath: "config/generated/blitz.slot.json",
    ...SLOT_DEFAULTS,
  },
  "slot.eternum": {
    id: "slot.eternum",
    chain: "slot",
    gameType: "eternum",
    toriiEnv: "slot",
    configPath: "config/generated/eternum.slot.json",
    ...SLOT_DEFAULTS,
  },
  "slottest.blitz": {
    id: "slottest.blitz",
    chain: "slottest",
    gameType: "blitz",
    toriiEnv: "slottest",
    configPath: "config/generated/blitz.slottest.json",
    ...SLOTTEST_DEFAULTS,
  },
  "slottest.eternum": {
    id: "slottest.eternum",
    chain: "slottest",
    gameType: "eternum",
    toriiEnv: "slottest",
    configPath: "config/generated/eternum.slottest.json",
    ...SLOTTEST_DEFAULTS,
  },
};
