import { expect, it } from "vitest";
import { CallData, type Abi } from "starknet";
import { nativePresets } from "../../../../config/source/native";
import { buildNativePreset } from "../../../../config/deployer/clean/config/native-preset";
import { loadNativePresetConfiguration } from "../../../../config/deployer/clean/registrar/native-preset";
import { schema } from "./fixtures";
import { currentPresetFixture } from "./current-preset-fixture";

it.each(Object.values(nativePresets))("fixture $id registers the same balance as the production loader", (preset) => {
  const config = loadNativePresetConfiguration(`madara.${preset.environmentGameType}`, preset.id);
  const definition = buildNativePreset(config, preset.id);
  const codec = new CallData([...Object.values(schema.types), ...schema.games.entrypoints] as Abi);
  expect(currentPresetFixture(preset.id).registration).toEqual(
    codec.compile("register_preset", { preset_id: preset.id, definition }),
  );
});
