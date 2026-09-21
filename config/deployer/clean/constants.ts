import { DEFAULT_FACTORY_CONFIG_VERSION } from "../../shared/factory-defaults";
import type { DeploymentEnvironment, DeploymentEnvironmentId } from "./types";
import { nativePresets } from "../../source/native";

export const DEFAULT_VERSION = DEFAULT_FACTORY_CONFIG_VERSION;
// Madara world presets, registered on the fresh world of 2026-09-12:
// 1 = Eternum, 2 = Blitz Regular Fast (official-60), 3 = Blitz Duel (official-90).
// Dev mode and duration are per game at creation, so the Blitz sandbox is preset 2 with dev mode on.
// Presets are immutable per world; a new balance is a new id on the next world.
function defaultPresetId(gameType: "eternum" | "blitz"): string {
  const entry = Object.entries(nativePresets).find(
    ([, preset]) => preset.gameType === gameType && (gameType === "eternum" || preset.profile === "official-60"),
  );
  if (!entry) throw new Error(`No default native preset for ${gameType}`);
  return entry[0];
}

export const DEFAULT_MADARA_PRESET_ID = defaultPresetId("blitz");
export const DEFAULT_ETERNUM_PRESET_ID = defaultPresetId("eternum");
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
    configPath: "config/generated/blitz.madara.json",
  },
  "madara.eternum": {
    id: "madara.eternum",
    chain: "madara",
    gameType: "eternum",
    configPath: "config/generated/eternum.madara.json",
  },
};
