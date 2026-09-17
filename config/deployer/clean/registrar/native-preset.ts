import { nativePresets } from "../../../source/native";
import { applyBlitzBalanceProfile } from "../../../source/blitz";
import { loadEnvironmentConfiguration } from "../config/config-loader";
import type { DeploymentEnvironmentId } from "../types";
import { readFileSync } from "node:fs";
import { CallData, CairoCustomEnum, CairoOption, CairoOptionVariant, hash, shortString, type Account } from "starknet";
import type { Config } from "@bibliothecadao/types";
import { buildCreateGameParams, type CreateGamePayloadInput } from "./preset";
import { buildNativePreset } from "../config/native-preset";
import { waitForSuccess } from "../shared/declare";
import type { NativeWorldManifest } from "../world/native/types";
import { nativeDomainAbi } from "../world/native/manifest";

export function buildNativePresetRegistration(config: Config, presetId: number, manifestPath: string) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as NativeWorldManifest;
  const registry = manifest.native?.domains.registry;
  const contract = manifest.contracts.find((entry) => entry.address === registry?.address);
  if (!registry || !contract) throw new Error("Manifest has no native registrar");
  const codec = new CallData(nativeDomainAbi(manifest, "registry"));
  const calldata = codec.compile("register_preset", { preset_id: presetId, definition: buildNativePreset(config) });
  const commitment = hash.computePoseidonHashOnElements([
    shortString.encodeShortString("NATIVE_PRESET"),
    1,
    ...calldata.slice(1),
  ]);
  return { address: registry.address, classHash: contract.class_hash, calldata, commitment };
}

export async function registerNativePreset(
  account: Account,
  presetId: number,
  registration: ReturnType<typeof buildNativePresetRegistration>,
) {
  const block = await account.getBlockNumber();
  const classHash = await account.getClassHashAt(registration.address, block);
  if (BigInt(classHash) !== BigInt(registration.classHash))
    throw new Error("Native registrar class differs from manifest");
  const [existing] = await account.callContract(
    {
      contractAddress: registration.address,
      entrypoint: "preset_commitment",
      calldata: [presetId],
    },
    block,
  );
  if (BigInt(existing) !== 0n) {
    if (BigInt(existing) !== BigInt(registration.commitment))
      throw new Error(`Preset ${presetId} has a different immutable definition`);
    return null;
  }
  const receipt = await account.execute({
    contractAddress: registration.address,
    entrypoint: "register_preset",
    calldata: registration.calldata,
  });
  await waitForSuccess(account, receipt.transaction_hash);
  return receipt.transaction_hash;
}

export function buildNativeGameParams(config: Config, input: CreateGamePayloadInput) {
  const common = buildCreateGameParams(config, input);
  return {
    name: common.name,
    preset_id: common.preset_id,
    series_id: common.series_id,
    game_number_in_series: common.game_number_in_series,
    start_settling_at: common.start_settling_at,
    start_main_at: common.start_main_at,
    duration_seconds: common.duration_seconds,
    end_grace_seconds: common.end_grace_seconds,
    dev_mode_on: common.dev_mode_on,
    mode: new CairoCustomEnum({ [input.twoPlayerMode ? "Duel" : common.single_realm_mode ? "Single" : "Triple"]: {} }),
    registration_limit: config.blitz.mode.on ? common.registration_count_max : 0,
    registration_start: common.registration_start_at,
    biome_climate: common.biome_climate_config,
    map_override: new CairoOption(
      input.useMapOverride ? CairoOptionVariant.Some : CairoOptionVariant.None,
      common.map_override,
    ),
    seed: common.seed,
  };
}

export function loadNativePresetConfiguration(environment: DeploymentEnvironmentId, presetId: number): Config {
  const config = loadEnvironmentConfiguration(environment);
  const preset = nativePresets[presetId];
  if (!preset || preset.gameType !== (config.blitz.mode.on ? "blitz" : "eternum"))
    throw new Error(`No native preset definition for ${environment} preset ${presetId}`);
  return preset.profile ? applyBlitzBalanceProfile(config, preset.profile) : config;
}
