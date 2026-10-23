import { CallData, type Account } from "starknet";
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
  const result = await account.execute(
    {
      contractAddress: local.games.address,
      entrypoint: "register_release",
      calldata: new CallData(local.games.sierra.abi).compile("register_release", {
        release_id: local.release.releaseId,
        release: { classes: local.release.classes.logic, migration: local.release.migrationClassHash },
      }),
    },
    { tip: 0 },
  );
  submitted(result.transaction_hash);
  await waitForSuccess(account, result.transaction_hash);
}
