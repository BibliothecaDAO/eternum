import { CallData, CairoOption, CairoOptionVariant, shortString, type Abi } from "starknet";
import { buildNativePreset } from "../../../../config/deployer/clean/config/native-preset";
import { loadNativePresetConfiguration } from "../../../../config/deployer/clean/registrar/native-preset";
import { NativeDecoder } from "./decoder";
import { manifest, schema } from "./fixtures";
import { derivePresetFacts } from "./preset-facts";
import { decodePresetPreimage } from "./preset-preimages";
import { encodeMembers } from "./serde";
import type { DecodedWorldEvent } from "../types";

const codec = new CallData([...Object.values(schema.types), ...schema.games.entrypoints] as Abi);

/** Generated inputs for current contract validation, separate from immutable launch recordings. */
export function currentPresetFixture(presetId: 2 | 3 | 5) {
  const environment = presetId === 5 ? "madara.frontier" : presetId === 3 ? "madara.eternum" : "madara.blitz";
  const definition = buildNativePreset(loadNativePresetConfiguration(environment, presetId), presetId);
  const params = fixtureLaunchParams(presetId, definition);
  const registration = codec.compile("register_preset", { preset_id: presetId, definition });
  return {
    definition,
    registration,
    creation: codec.compile("create_game", { params }),
    rows: projectLaunch(registration, params),
  };
}

function fixtureLaunchParams(presetId: number, definition: ReturnType<typeof buildNativePreset>) {
  return {
    name: shortString.encodeShortString(`projection_${presetId}`),
    preset_id: presetId,
    start_settling_at: 1800,
    start_main_at: 1800,
    duration_seconds: 86400,
    end_grace_seconds: 0,
    dev_mode_on: false,
    roster: presetId === 2 ? [{ account: "0x111" }] : [],
    registration_start: 1700,
    biome_climate: definition.rules.biome_climate_config,
    map_override: new CairoOption(presetId === 3 ? CairoOptionVariant.Some : CairoOptionVariant.None, {
      ...definition.rules.map_config,
      shards_mines_win_probability: 987,
    }),
    seed: 123456,
  };
}

function projectLaunch(registration: string[], params: ReturnType<typeof fixtureLaunchParams>) {
  const decoder = new NativeDecoder(manifest);
  const launch = decoder.decodeRowSet("GameRelease", ["1"], ["1", "1"]);
  const overrides = {
    registration_start: params.registration_start,
    biome_climate: params.biome_climate,
    map: params.map_override.isSome() ? params.map_override.unwrap() : null,
    map_center_offset: ((params.seed + 1) % Math.floor(2147483646 / 2 / 10)) * 10,
  };
  return derivePresetFacts(
    decoder,
    decodePresetPreimage(schema, registration.slice(1)),
    overrides,
    params.roster.length,
    launch,
  );
}

export function serializePresetRows(rows: DecodedWorldEvent[]): string[] {
  return [
    String(rows.length),
    ...rows.flatMap((row) => {
      if (row.kind !== "set") throw new Error("A preset projection must contain complete rows");
      const model = schema.models.find(({ name }) => name === row.model.name);
      if (!model) throw new Error(`Missing preset model ${row.model.name}`);
      const keys = encodeMembers(schema, model.keys, row.key);
      const values = encodeMembers(schema, model.members, row.value);
      return [
        shortString.encodeShortString(model.name),
        String(keys.length),
        ...keys,
        String(values.length),
        ...values,
      ];
    }),
  ];
}
