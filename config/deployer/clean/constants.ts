import { DEFAULT_FACTORY_CONFIG_VERSION } from "../../shared/factory-defaults";
import type { DeploymentEnvironment, DeploymentEnvironmentId } from "./types";

export const DEFAULT_VERSION = DEFAULT_FACTORY_CONFIG_VERSION;
// Preset 6 = Regular Fast (official-60 profile applied at registration).
// Preset 7 = Duel (official-90 profile). Presets 2/3 carried local dev balance
// and 4/5 were registered WITHOUT their balance profiles (base sheet only) —
// all immutable, retired, never offered again.
export const DEFAULT_APPCHAIN_PRESET_ID = "6";
export const DEFAULT_APPCHAIN_ETERNUM_PRESET_ID = "10";
export const DEFAULT_MADARA_PRESET_ID = "1";
export const DEFAULT_APPCHAIN_GAME_INDEX_TIMEOUT_MS = 2 * 60 * 1_000;
export const DEFAULT_APPCHAIN_GAME_INDEX_POLL_MS = 2_000;
export const BLITZ_REGISTRATION_COUNT_CAP = 96;
export const DEFAULT_GAME_LAUNCH_WORKFLOW_FILE = "game-launch.yml";
export const DEFAULT_FACTORY_RUN_STORE_BRANCH = "factory-runs";
export const DEFAULT_FACTORY_RUN_LEASE_DURATION_MS = 45 * 60 * 1000;
export const DEFAULT_FACTORY_ACCOUNT_LEASE_DURATION_MS = 10 * 60 * 1000;
export const DEFAULT_FACTORY_INDEX_TIMEOUT_MS = 5 * 60 * 1000;
export const DEFAULT_FACTORY_INDEX_POLL_MS = 5_000;
// Realms dev appchain (chain id WP_REALMS_DEV) — see docs/plans/appchain-phase-1.md.
// Override with APPCHAIN_RPC_URL / --rpc-url once the stable hostname lands.
export const DEFAULT_APPCHAIN_RPC_URL = process.env.APPCHAIN_RPC_URL || "http://52.54.98.119";
export const DEFAULT_MADARA_RPC_URL = process.env.RPC_URL || "http://127.0.0.1:5050/rpc/v0_9_0";

export const DEFAULT_CHAIN_RPC_URLS: Record<string, string> = {
  madara: DEFAULT_MADARA_RPC_URL,
  appchain: DEFAULT_APPCHAIN_RPC_URL,
};

export function resolveDefaultRpcUrl(chain: string): string {
  const rpcUrl = DEFAULT_CHAIN_RPC_URLS[chain];
  if (!rpcUrl) {
    throw new Error(`No default RPC URL configured for chain "${chain}"`);
  }
  return rpcUrl;
}

const APPCHAIN_DEFAULTS = {
  rpcUrl: DEFAULT_APPCHAIN_RPC_URL,
};

const MADARA_DEFAULTS = {
  rpcUrl: DEFAULT_MADARA_RPC_URL,
};

export const DEPLOYMENT_ENVIRONMENTS: Record<DeploymentEnvironmentId, DeploymentEnvironment> = {
  "madara.blitz": {
    id: "madara.blitz",
    chain: "madara",
    gameType: "blitz",
    toriiEnv: "madara",
    configPath: "config/generated/blitz.madara.json",
    world: {
      namespace: "s2",
      manifestPath: "contracts/game/manifest_madara.json",
      registrarAddress: "0x23d89ba402b33599107413ddb0f33f0cc38e57dcff4aa3b1989cba12076e9a5",
    },
    ...MADARA_DEFAULTS,
  },
  "appchain.blitz": {
    id: "appchain.blitz",
    chain: "appchain",
    gameType: "blitz",
    toriiEnv: "appchain",
    configPath: "config/generated/blitz.appchain.json",
    world: {
      namespace: "s2",
      manifestPath: "contracts/game/manifest_appchain_blitz.json",
      registrarAddress:
        process.env.APPCHAIN_BLITZ_REGISTRAR_ADDRESS ||
        "0x27853c5cafdfb2561e47fc0c250b51bc651cb441a3e3a846c99f29ad752b6f0",
    },
    ...APPCHAIN_DEFAULTS,
  },
  "appchain.eternum": {
    id: "appchain.eternum",
    chain: "appchain",
    gameType: "eternum",
    toriiEnv: "appchain",
    configPath: "config/generated/eternum.appchain.json",
    world: {
      namespace: "s2",
      manifestPath: "contracts/game/manifest_appchain_eternum.json",
      registrarAddress:
        process.env.APPCHAIN_ETERNUM_REGISTRAR_ADDRESS ||
        "0x4b10e72d41ffe5edcf9254ab03f4ca58b5863b82bb2e2011ce4fdab849d939b",
    },
    ...APPCHAIN_DEFAULTS,
  },
};
