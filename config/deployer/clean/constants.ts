import { DEFAULT_FACTORY_CONFIG_VERSION } from "../../shared/factory-defaults";
import type { DeploymentEnvironment, DeploymentEnvironmentId } from "./types";

export const DEFAULT_VERSION = DEFAULT_FACTORY_CONFIG_VERSION;
// Madara preset 8 = Regular Fast (official-60), 9 = Duel (official-90),
// registered 2026-09-03 from the standard-patched sheet. Retired immutable
// presets: 2/3 local dev balance, 4/5 registered WITHOUT balance profiles,
// 6/7 baked the base sheet's 24-tick spawn immunity — never offered again.
export const DEFAULT_MADARA_PRESET_ID = "8";
export const DEFAULT_APPCHAIN_GAME_INDEX_TIMEOUT_MS = 2 * 60 * 1_000;
export const DEFAULT_APPCHAIN_GAME_INDEX_POLL_MS = 2_000;
export const BLITZ_REGISTRATION_COUNT_CAP = 96;
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
};
