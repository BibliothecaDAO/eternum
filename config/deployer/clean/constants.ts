import { DEFAULT_FACTORY_CONFIG_VERSION } from "../../shared/factory-defaults";
import type { DeploymentEnvironment, DeploymentEnvironmentId } from "./types";

export const DEFAULT_VERSION = DEFAULT_FACTORY_CONFIG_VERSION;
// Madara preset 8 = Regular Fast (official-60), 9 = Duel (official-90),
// registered 2026-09-03 from the standard-patched sheet. Retired immutable
// presets: 2/3 local dev balance, 4/5 registered WITHOUT balance profiles,
// 6/7 baked the base sheet's 24-tick spawn immunity — never offered again.
export const DEFAULT_APPCHAIN_PRESET_ID = "6";
export const DEFAULT_APPCHAIN_ETERNUM_PRESET_ID = "10";
export const DEFAULT_MADARA_PRESET_ID = "8";
export const DEFAULT_APPCHAIN_GAME_INDEX_TIMEOUT_MS = 2 * 60 * 1_000;
export const DEFAULT_APPCHAIN_GAME_INDEX_POLL_MS = 2_000;
export const BLITZ_REGISTRATION_COUNT_CAP = 96;
export const DEFAULT_GAME_LAUNCH_WORKFLOW_FILE = "game-launch.yml";
export const DEFAULT_FACTORY_RUN_STORE_BRANCH = "factory-runs";
export const DEFAULT_FACTORY_RUN_LEASE_DURATION_MS = 45 * 60 * 1000;
export const DEFAULT_FACTORY_ACCOUNT_LEASE_DURATION_MS = 10 * 60 * 1000;
export const DEFAULT_FACTORY_INDEX_TIMEOUT_MS = 5 * 60 * 1000;
export const DEFAULT_FACTORY_INDEX_POLL_MS = 5_000;
export const DEPLOYMENT_ENVIRONMENTS: Record<DeploymentEnvironmentId, DeploymentEnvironment> = {
  "madara.blitz": {
    id: "madara.blitz",
    chain: "madara",
    gameType: "blitz",
    toriiEnv: "madara",
    configPath: "config/generated/blitz.madara.json",
    world: {
      namespace: "s2",
      manifestPath: "contracts/l3/game/manifest_madara.json",
    },
  },
  "appchain.blitz": {
    id: "appchain.blitz",
    chain: "appchain",
    gameType: "blitz",
    toriiEnv: "appchain",
    configPath: "config/generated/blitz.appchain.json",
    world: {
      namespace: "s2",
      manifestPath: "contracts/l3/game/manifest_appchain_blitz.json",
      registrarAddress:
        process.env.APPCHAIN_BLITZ_REGISTRAR_ADDRESS ||
        "0x27853c5cafdfb2561e47fc0c250b51bc651cb441a3e3a846c99f29ad752b6f0",
    },
  },
  "appchain.eternum": {
    id: "appchain.eternum",
    chain: "appchain",
    gameType: "eternum",
    toriiEnv: "appchain",
    configPath: "config/generated/eternum.appchain.json",
    world: {
      namespace: "s2",
      manifestPath: "contracts/l3/game/manifest_appchain_eternum.json",
      registrarAddress:
        process.env.APPCHAIN_ETERNUM_REGISTRAR_ADDRESS ||
        "0x4b10e72d41ffe5edcf9254ab03f4ca58b5863b82bb2e2011ce4fdab849d939b",
    },
  },
};
