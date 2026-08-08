import { DEFAULT_FACTORY_CONFIG_VERSION } from "../../shared/factory-defaults";
import type { DeploymentEnvironment, DeploymentEnvironmentId } from "./types";

export const DEFAULT_NAMESPACE = "s1_eternum";
export const DEFAULT_VERSION = DEFAULT_FACTORY_CONFIG_VERSION;
// MEASURED, do not raise without re-testing: 20 lands reliably (~15s/batch,
// full world in ~10 batches / ~2.5 min). 50 and 300 do NOT — katana returns a
// transaction hash but the transaction is never mined, so the client waits
// forever. Suspected cause is fee estimation on an idle chain (katana's gas
// oracle needs recent V3 traffic; the fallback resource bounds cover a small
// transaction but not a large one). Mainnet's 50 does not transfer here.
export const DEFAULT_APPCHAIN_MAX_ACTIONS = 20;
export const DEFAULT_MAINNET_MAX_ACTIONS = 50;
export const DEFAULT_MAINNET_CREATE_GAME_SUBMISSION_COUNT = 3;
// ~10 batches of 20 complete a world; 15 leaves margin (the launcher stops
// early once the factory cursor reports completion).
export const DEFAULT_APPCHAIN_CREATE_GAME_SUBMISSION_COUNT = 15;
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
export const DEFAULT_VRF_PROVIDER_ADDRESS = "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f";
export const DEFAULT_MAINNET_FACTORY_ADDRESS = "0x525410a4d0ebd4a313e2125ac986710cd8f1bd08d47379b7f45c8b9c71b4da";
export const DEFAULT_MAINNET_RPC_URL = "https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_9";
export const DEFAULT_SEPOLIA_RPC_URL = "https://api.cartridge.gg/x/starknet/sepolia/rpc/v0_9";
// Realms dev appchain (chain id WP_REALMS_DEV) — see docs/plans/appchain-phase-1.md.
// Override with APPCHAIN_RPC_URL / --rpc-url once the stable hostname lands.
export const DEFAULT_APPCHAIN_RPC_URL =
  process.env.APPCHAIN_RPC_URL || "http://Realms-Alb16-vyiZTcVBQthr-325094656.us-east-1.elb.amazonaws.com";
export const DEFAULT_LOCAL_RPC_URL = "http://127.0.0.1:5050/rpc/v0_9";
// katana dev seed-0 account 0 — dev chain, no real value.
// wf-factory from contracts/factory/manifest_appchain.json
export const DEFAULT_APPCHAIN_FACTORY_ADDRESS = "0x4c50ced3c1fd6f2f4cef779e28adafb234ed9773dda3e0e39918f24f2936350";
export const DEFAULT_APPCHAIN_ACCOUNT_ADDRESS = "0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec";
export const DEFAULT_APPCHAIN_PRIVATE_KEY = "0xc5b2fcab997346f3ea1c00b002ecf6f382c5f9c9659a3894eb783c5320f912";

export const DEFAULT_CHAIN_RPC_URLS: Record<string, string> = {
  mainnet: DEFAULT_MAINNET_RPC_URL,
  sepolia: DEFAULT_SEPOLIA_RPC_URL,
  appchain: DEFAULT_APPCHAIN_RPC_URL,
  local: DEFAULT_LOCAL_RPC_URL,
};

export function resolveDefaultRpcUrl(chain: string): string {
  const rpcUrl = DEFAULT_CHAIN_RPC_URLS[chain];
  if (!rpcUrl) {
    throw new Error(`No default RPC URL configured for chain "${chain}"`);
  }
  return rpcUrl;
}

const APPCHAIN_DEFAULTS = {
  factoryAddress: DEFAULT_APPCHAIN_FACTORY_ADDRESS,
  rpcUrl: DEFAULT_APPCHAIN_RPC_URL,
  accountAddress: DEFAULT_APPCHAIN_ACCOUNT_ADDRESS,
  privateKey: DEFAULT_APPCHAIN_PRIVATE_KEY,
  createGame: {
    maxActions: DEFAULT_APPCHAIN_MAX_ACTIONS,
    submissionCount: DEFAULT_APPCHAIN_CREATE_GAME_SUBMISSION_COUNT,
    retryCount: DEFAULT_CREATE_GAME_RETRY_COUNT,
    retryDelayMs: DEFAULT_CREATE_GAME_RETRY_DELAY_MS,
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
  "appchain.blitz": {
    id: "appchain.blitz",
    chain: "appchain",
    gameType: "blitz",
    toriiEnv: "appchain",
    configPath: "config/generated/blitz.appchain.json",
    ...APPCHAIN_DEFAULTS,
  },
  "appchain.eternum": {
    id: "appchain.eternum",
    chain: "appchain",
    gameType: "eternum",
    toriiEnv: "appchain",
    configPath: "config/generated/eternum.appchain.json",
    ...APPCHAIN_DEFAULTS,
  },
};
