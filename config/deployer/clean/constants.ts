import { DEFAULT_FACTORY_CONFIG_VERSION } from "../../shared/factory-defaults";
import type { DeploymentEnvironment, DeploymentEnvironmentId } from "./types";

export const DEFAULT_VERSION = DEFAULT_FACTORY_CONFIG_VERSION;
// Madara world presets, registered on the fresh world of 2026-09-12:
// 1 = Eternum, 2 = Blitz Regular Fast (official-60), 3 = Blitz Duel (official-90).
// Dev mode and duration are per game at creation, so the Blitz sandbox is preset 2 with dev mode on.
// Presets are immutable per world; a new balance is a new id on the next world.
export const DEFAULT_MADARA_PRESET_ID = "2";
export const DEFAULT_ETERNUM_PRESET_ID = "1";
export const DEFAULT_APPCHAIN_GAME_INDEX_TIMEOUT_MS = 2 * 60 * 1_000;
export const DEFAULT_APPCHAIN_GAME_INDEX_POLL_MS = 2_000;
export const BLITZ_REGISTRATION_COUNT_CAP = 96;
export function defaultPresetForEnvironment(environment: DeploymentEnvironmentId): string {
  return environment === "madara.eternum" ? DEFAULT_ETERNUM_PRESET_ID : DEFAULT_MADARA_PRESET_ID;
}

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
  "madara.eternum": {
    id: "madara.eternum",
    chain: "madara",
    gameType: "eternum",
    toriiEnv: "madara",
    configPath: "config/generated/eternum.madara.json",
    world: { namespace: "s2", manifestPath: "contracts/l3/game/manifest_madara.json" },
  },
};
