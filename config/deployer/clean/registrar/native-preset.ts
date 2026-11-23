import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/balance.gen";
import { resolveDeploymentEnvironment } from "../environment";
import { mergeConfigPatches } from "../../../source/common/merge-config";
import { nativePresetForId } from "../../../source/native";
import { configurationOf, type StoredConfiguration } from "../config/config-loader";
import blitz from "../../../generated/blitz.madara.json";
import frontier from "../../../generated/frontier.madara.json";
import type { DeploymentEnvironmentId } from "../types";
import { CairoOption, CairoOptionVariant } from "starknet";
import type { Config } from "@bibliothecadao/types";
import { buildCreateGameParams, type CreateGamePayloadInput } from "./preset";
import { clockScaled, gameClockScale } from "../../../source/common/season-clock";

/** Open-entry games only: a fixed roster is frozen and launched by the launch service when its slot closes. */
export function buildNativeGameParams(config: Config, input: CreateGamePayloadInput) {
  if (nativePresetForId(input.presetId).entryRule === nativeRuleConstants.ENTRY_ROSTER)
    throw new Error("Fixed-roster games launch from a closed slot");
  const common = buildCreateGameParams(config, { ...input, startMainAt: nativeSeasonStart(config, input) });
  return {
    name: common.name,
    family: common.family,
    start_settling_at: common.start_settling_at,
    start_main_at: common.start_main_at,
    duration_seconds: common.duration_seconds,
    dev_mode_on: common.dev_mode_on,
    registration_start: common.registration_start_at,
    biome_climate: common.biome_climate_config,
    map_override: new CairoOption(
      input.useMapOverride ? CairoOptionVariant.Some : CairoOptionVariant.None,
      common.map_override,
    ),
    // Calendar and map layout metadata; gameplay draws use the stamped transaction root.
    seed: common.seed,
    clock_scale: common.clock_scale,
  };
}

/**
 * A season with days starts on an armies tick, rounded up, so every day rolls over on one: the contract refuses any
 * other start.
 */
function nativeSeasonStart(config: Config, input: Pick<CreateGamePayloadInput, "presetId" | "startMainAt">): number {
  const preset = nativePresetForId(input.presetId);
  if (preset.dayUnitSeconds === 0) return input.startMainAt;
  const tick = clockScaled(config.tick.armiesTickIntervalInSeconds, gameClockScale(preset), "armies tick");
  return Math.ceil(input.startMainAt / tick) * tick;
}

// Imported rather than read from disk, so the launch Worker carries the same preset configurations as the CLIs. Each
// load is a copy, as a file read was: launches apply their overrides to the configuration they get.
const NATIVE_CONFIGURATIONS = { blitz, frontier } as unknown as Record<string, StoredConfiguration>;

export function loadNativePresetConfiguration(environment: DeploymentEnvironmentId, presetId: number): Config {
  const target = resolveDeploymentEnvironment(environment);
  const preset = nativePresetForId(presetId);
  const stored = target.chain === "madara" ? NATIVE_CONFIGURATIONS[preset.gameType] : undefined;
  if (preset.environmentGameType !== target.gameType || !stored)
    throw new Error(`No native preset definition for ${environment} preset ${presetId}`);
  const loaded = configurationOf(structuredClone(stored), `config/generated/${preset.gameType}.madara.json`);
  const config = preset.balance ? mergeConfigPatches<Config>(loaded, preset.balance) : loaded;
  // A scaled preset's season lasts as many of its shorter bags as its mode's: the length scales with the day unit.
  config.season.durationSeconds = clockScaled(config.season.durationSeconds, gameClockScale(preset), "season duration");
  return config;
}
