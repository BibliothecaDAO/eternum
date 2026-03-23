import type { DeploymentEnvironment, DeploymentEnvironmentId } from "./types";

export const DEFAULT_NAMESPACE = "s1_eternum";
export const DEFAULT_VERSION = "180";
export const DEFAULT_SLOT_MAX_ACTIONS = 300;
export const DEFAULT_MAINNET_MAX_ACTIONS = 70;
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
export const DEFAULT_INDEXER_WORKFLOW_TIMEOUT_MS = 20 * 60 * 1000;
export const DEFAULT_INDEXER_WORKFLOW_POLL_MS = 5_000;
export const DEFAULT_VRF_PROVIDER_ADDRESS = "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f";
export const DEFAULT_MAINNET_FACTORY_ADDRESS = "0x525410a4d0ebd4a313e2125ac986710cd8f1bd08d47379b7f45c8b9c71b4da";
export const DEFAULT_SLOT_FACTORY_ADDRESS = "0x242226ce5f17914fc148cb111980b24e2bda624379877cda66f7e76884d2deb";
export const DEFAULT_MAINNET_RPC_URL = "https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_9";
export const DEFAULT_SEPOLIA_RPC_URL = "https://api.cartridge.gg/x/starknet/sepolia/rpc/v0_9";
export const DEFAULT_SLOT_RPC_URL = "https://api.cartridge.gg/x/eternum-blitz-slot-4/katana/rpc/v0_9";
export const DEFAULT_SLOTTEST_RPC_URL = "https://api.cartridge.gg/x/eternum-blitz-slot-test/katana/rpc/v0_9";
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

const MAINNET_DEFAULTS = {
  factoryAddress: DEFAULT_MAINNET_FACTORY_ADDRESS,
  rpcUrl: DEFAULT_MAINNET_RPC_URL,
  createGame: {
    maxActions: DEFAULT_MAINNET_MAX_ACTIONS,
    submissionCount: DEFAULT_MAINNET_CREATE_GAME_SUBMISSION_COUNT,
    retryCount: DEFAULT_CREATE_GAME_RETRY_COUNT,
    retryDelayMs: DEFAULT_CREATE_GAME_RETRY_DELAY_MS,
  },
};

export const DEPLOYMENT_ENVIRONMENTS: Record<DeploymentEnvironmentId, DeploymentEnvironment> = {
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
};
