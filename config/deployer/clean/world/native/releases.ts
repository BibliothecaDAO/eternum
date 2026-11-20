import { CallData, type Account } from "starknet";
import { nativeIdentifiers } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { isClassDeclared, waitForSuccess } from "../../shared/declare";
import type { NativeWorld } from "./types";

export async function registerNativeRelease(
  local: NativeWorld,
  account: Account,
  submitted: (hash: string) => void,
): Promise<void> {
  if (
    BigInt(local.release.migrationClassHash) !== 0n &&
    !(await isClassDeclared(account, local.release.migrationClassHash))
  )
    throw new Error("NATIVE_MIGRATION_NOT_DECLARED: declare the migration class before registering the release");
  const family = nativeIdentifiers.family.FRONTIER;
  const codec = new CallData(local.games.sierra.abi);
  const result = await account.execute(
    {
      contractAddress: local.games.address,
      entrypoint: "register_release",
      calldata: codec.compile("register_release", {
        release_id: local.release.releaseId,
        release: {
          family,
          previous: await latestReleaseOf(local, account, codec, family),
          classes: local.release.classes.logic,
          migration: local.release.migrationClassHash,
        },
      }),
    },
    { tip: 0 },
  );
  submitted(result.transaction_hash);
  await waitForSuccess(account, result.transaction_hash);
}

async function latestReleaseOf(local: NativeWorld, account: Account, codec: CallData, family: number) {
  const entrypoint = "latest_release_of";
  const raw = await account.callContract(
    { contractAddress: local.games.address, entrypoint, calldata: [String(family)] },
    "latest",
  );
  return Number(codec.parse(entrypoint, raw));
}
