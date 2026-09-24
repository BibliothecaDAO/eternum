import { DEFAULT_FACTORY_CONFIG_VERSION } from "../../shared/factory-defaults";
import type { DeploymentEnvironment, DeploymentEnvironmentId } from "./types";
import { nativePresetIdFor } from "../../source/native";

export const DEFAULT_VERSION = DEFAULT_FACTORY_CONFIG_VERSION;
function defaultPresetId(gameType: import("../../source/common/types").GameType): string {
  return String(nativePresetIdFor(gameType));
}

export const DEFAULT_MADARA_PRESET_ID = defaultPresetId("blitz");
export const DEFAULT_ETERNUM_PRESET_ID = defaultPresetId("eternum");
export const DEFAULT_APPCHAIN_GAME_INDEX_TIMEOUT_MS = 2 * 60 * 1_000;
export const DEFAULT_APPCHAIN_GAME_INDEX_POLL_MS = 2_000;
export const BLITZ_REGISTRATION_COUNT_CAP = 96;
export function defaultPresetForEnvironment(environment: DeploymentEnvironmentId): string {
  return defaultPresetId(DEPLOYMENT_ENVIRONMENTS[environment].gameType);
}

export const DEPLOYMENT_ENVIRONMENTS: Record<DeploymentEnvironmentId, DeploymentEnvironment> = {
  "madara.blitz": {
    id: "madara.blitz",
    chain: "madara",
    gameType: "blitz",
    configPath: "config/generated/blitz.madara.json",
  },
  "madara.eternum": {
    id: "madara.eternum",
    chain: "madara",
    gameType: "eternum",
    configPath: "config/generated/eternum.madara.json",
  },
  "madara.frontier": {
    id: "madara.frontier",
    chain: "madara",
    gameType: "frontier",
    configPath: "config/generated/frontier.madara.json",
  },
};
