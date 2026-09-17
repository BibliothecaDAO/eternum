import { readFileSync } from "node:fs";
import { CallData, hash, shortString, type Account } from "starknet";
import type { Config } from "@bibliothecadao/types";
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
