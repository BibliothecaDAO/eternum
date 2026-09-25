import { CallData, CairoOption, CairoOptionVariant, hash, type Abi } from "starknet";
import { buildNativePreset } from "../../../../config/deployer/clean/config/native-preset";
import { loadNativePresetConfiguration } from "../../../../config/deployer/clean/registrar/native-preset";
import { manifest, rowEvent, schema } from "./fixtures";
import { encodeMembers } from "./serde";
import { presetPreimageCommitment } from "./preset-preimages";

/** Successful direct registration input for replay tests and the load campaign. */
export function presetRegistration(presetId: 2 | 5) {
  const environment = presetId === 2 ? "madara.blitz" : "madara.frontier";
  const definition = buildNativePreset(loadNativePresetConfiguration(environment, presetId), presetId);
  const codec = new CallData([...Object.values(schema.types), ...schema.games.entrypoints] as Abi);
  const calldata = codec.compile("register_preset", { preset_id: presetId, definition });
  const commitment = presetPreimageCommitment(calldata.slice(1));
  return {
    presetId,
    definition,
    commitment,
    calldata: [
      "1",
      manifest.world.address,
      hash.getSelectorFromName("register_preset"),
      String(calldata.length),
      ...calldata,
    ],
    event: rowEvent("Preset", [String(presetId)], [commitment]),
  };
}

export function presetLaunch(
  preset: ReturnType<typeof presetRegistration>,
  gameId: number,
  timestamp: number,
  roster: number[] = [],
) {
  const game = String(gameId);
  const overrides = {
    registration_start: timestamp,
    biome_climate: preset.definition.rules.biome_climate_config,
    map: new CairoOption(CairoOptionVariant.None),
    map_center_offset: 0,
  };
  return [
    ...(roster.length ? [rowEvent("BlitzRoster", [game], [String(roster.length), ...roster.map(String)])] : []),
    rowEvent(
      "GameRegistry",
      [game],
      [
        "0x706172697479",
        String(preset.presetId),
        "0x111",
        "0",
        "1",
        "0",
        String(timestamp),
        String(timestamp),
        String(timestamp + 864000),
        "0",
        "1",
      ],
    ),
    rowEvent(
      "GameOverrides",
      [game],
      encodeMembers(schema, schema.models.find(({ name }) => name === "GameOverrides")!.members, overrides),
    ),
    rowEvent("GameRelease", [game], ["1", preset.commitment]),
  ];
}
