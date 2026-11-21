import { CairoOption, CairoOptionVariant } from "starknet";
import { buildNativePreset } from "../../../../config/deployer/clean/config/native-preset";
import { loadNativePresetConfiguration } from "../../../../config/deployer/clean/registrar/native-preset";
import { gameRegistryEvent, rowEvent } from "./fixtures";
import { readReleaseDefinitions, releaseDefinitionText } from "./release-definition";

export function presetRelease(
  presetId: number,
  release = 1,
  amend?: (definition: ReturnType<typeof buildNativePreset>) => void,
) {
  const environment = presetId === 2 ? "madara.blitz" : "madara.frontier";
  const definition = buildNativePreset(loadNativePresetConfiguration(environment, presetId), presetId);
  amend?.(definition);
  return {
    presetId,
    release,
    definition,
    definitions: readReleaseDefinitions(JSON.parse(releaseDefinitionText(release, definition))),
  };
}

export const PRESET_FIXTURE_DURATION_SECONDS = 864000;

export function presetLaunch(preset: ReturnType<typeof presetRelease>, gameId: number, timestamp: number) {
  const game = String(gameId);
  const overrides = {
    registration_start: timestamp,
    biome_climate: preset.definition.rules.biome_climate_config,
    map: new CairoOption(CairoOptionVariant.None),
    map_center_offset: 0,
  };
  return [
    gameRegistryEvent({
      game_id: gameId,
      name: "0x706172697479",
      start_settling_at: String(timestamp),
      start_main_at: String(timestamp),
      scheduled_end_at: String(timestamp + PRESET_FIXTURE_DURATION_SECONDS),
      end_at: String(timestamp + PRESET_FIXTURE_DURATION_SECONDS),
    }),
    rowEvent("GameOverrides", [game], overrides),
    rowEvent("GameRelease", [game], { release_id: preset.release, created_release_id: preset.release }),
  ];
}
