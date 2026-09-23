import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/client.gen";
import { resolveDeploymentEnvironment } from "../environment";
import { nativePresetForId } from "../../../source/native";
import { configurationOf, type StoredConfiguration } from "../config/config-loader";
import blitz from "../../../generated/blitz.madara.json";
import duel from "../../../generated/duel.madara.json";
import eternum from "../../../generated/eternum.madara.json";
import frontier from "../../../generated/frontier.madara.json";
import type { DeploymentEnvironmentId } from "../types";
import { readFileSync } from "node:fs";
import { CallData, CairoOption, CairoOptionVariant, hash, shortString, type Account } from "starknet";
import type { Config } from "@bibliothecadao/types";
import { buildCreateGameParams, type CreateGamePayloadInput } from "./preset";
import { buildNativePreset } from "../config/native-preset";
import { waitForSuccess } from "../shared/declare";
import type { NativeWorldManifest, RegistrarWorld } from "../world/native/types";
import { nativeDomainAbi } from "../world/native/manifest";

export function buildNativePresetRegistration(
  definition: ReturnType<typeof buildNativePreset>,
  presetId: number,
  target: string | NativeWorldManifest,
) {
  const manifest =
    typeof target === "string" ? (JSON.parse(readFileSync(target, "utf8")) as NativeWorldManifest) : target;
  const call = presetRegistrationCall(definition, presetId, manifest);
  const contract = manifest.contracts.find((entry) => entry.address === call.address);
  if (!contract) throw new Error("Manifest has no native registrar");
  return { ...call, classHash: contract.class_hash };
}

/** The register_preset call for a definition and the commitment the registrar keeps for it. */
export function presetRegistrationCall(
  definition: ReturnType<typeof buildNativePreset>,
  presetId: number,
  world: RegistrarWorld,
) {
  const registry = world.native?.domains.registry;
  if (!registry) throw new Error("Manifest has no native registrar");
  const codec = new CallData(nativeDomainAbi(world, "registry"));
  const calldata = codec.compile("register_preset", { preset_id: presetId, definition });
  const commitment = hash.computePoseidonHashOnElements([
    shortString.encodeShortString("NATIVE_PRESET"),
    1,
    ...calldata.slice(1),
  ]);
  return { address: registry.address, calldata, commitment };
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
  if (BigInt(existing) === BigInt(registration.commitment)) return null;
  const receipt = await account.execute({
    contractAddress: registration.address,
    entrypoint: "register_preset",
    calldata: registration.calldata,
  });
  await waitForSuccess(account, receipt.transaction_hash);
  return receipt.transaction_hash;
}

export function buildNativeGameParams(
  config: Config,
  input: CreateGamePayloadInput,
  roster: readonly { owner: string; account: string }[] = [],
) {
  const preset = nativePresetForId(input.presetId);
  if (preset.entryRule === nativeRuleConstants.ENTRY_ROSTER) {
    const mode = preset.settlementMode;
    if (input.singleRealmMode || input.twoPlayerMode !== (mode === "Duel"))
      throw new Error("Settlement layout must match the mode preset");
    if (mode === "Duel" && roster.length !== 2) throw new Error("Duel requires two players");
    if (input.devModeOn) throw new Error("Free Blitz does not use development mode");
    if (roster.length < 1 || roster.length > 24) throw new Error("Blitz requires a fixed roster of 1 to 24 players");
  } else if (roster.length) throw new Error("Open seasons do not use a fixed roster");
  const common = buildCreateGameParams(config, input);
  return {
    name: common.name,
    preset_id: common.preset_id,
    start_settling_at: common.start_settling_at,
    start_main_at: common.start_main_at,
    duration_seconds: common.duration_seconds,
    end_grace_seconds: common.end_grace_seconds,
    dev_mode_on: common.dev_mode_on,
    roster,
    registration_start: common.registration_start_at,
    biome_climate: common.biome_climate_config,
    map_override: new CairoOption(
      input.useMapOverride ? CairoOptionVariant.Some : CairoOptionVariant.None,
      common.map_override,
    ),
    seed: common.seed,
  };
}

// Imported rather than read from disk, so the launch Worker carries the same preset configurations as the CLIs. Each
// load is a copy, as a file read was: launches apply their overrides to the configuration they get.
const NATIVE_CONFIGURATIONS = { blitz, duel, eternum, frontier } as unknown as Record<string, StoredConfiguration>;

export function loadNativePresetConfiguration(environment: DeploymentEnvironmentId, presetId: number): Config {
  const target = resolveDeploymentEnvironment(environment);
  const preset = nativePresetForId(presetId);
  const stored = target.chain === "madara" ? NATIVE_CONFIGURATIONS[preset.gameType] : undefined;
  if (preset.environmentGameType !== target.gameType || !stored)
    throw new Error(`No native preset definition for ${environment} preset ${presetId}`);
  return configurationOf(structuredClone(stored), `config/generated/${preset.gameType}.madara.json`);
}
