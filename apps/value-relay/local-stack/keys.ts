import { ec, num } from "starknet";
import { botRealmsId, realmsAccountAddress, deviceChangeHash } from "@realms-world/identity/account";
import { privateWrite } from "./config";
import { join } from "node:path";
import { Effect } from "effect";

/** Fresh local bootstrap only: each invocation creates its own guardian and distinct bot devices. */
export const generateKeys = async (directory: string, classHash: string, chainId: string) => {
  if (!directory.startsWith("/") || BigInt(classHash) <= 0n || BigInt(chainId) <= 0n)
    throw new Error("local_bootstrap_parameters_required");
  const randomKey = () => `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(31))).toString("hex")}`;
  const guardianKey = randomKey();
  const guardianPublicKey = ec.starkCurve.getStarkKey(guardianKey);
  await privateWrite(join(directory, "guardian.json"), { privateKey: guardianKey });
  const accounts = [];
  for (const [name, label] of [
    ["launcher", "0x1"],
    ["ledger-operator", "0x2"],
  ] as const) {
    const privateKey = randomKey();
    const deviceKey = ec.starkCurve.getStarkKey(privateKey);
    const realmsId = botRealmsId(label);
    const address = realmsAccountAddress(realmsId, classHash, guardianPublicKey);
    const change = { chainId, account: address, action: "ADD" as const, deviceKey, counter: 1 };
    const signature = ec.starkCurve.sign(deviceChangeHash(change), guardianKey);
    await privateWrite(join(directory, `${name}.json`), { address, privateKey });
    accounts.push({
      name,
      realmsId,
      address,
      deviceKey,
      constructorCalldata: [realmsId, guardianPublicKey],
      salt: realmsId,
      guardianApproval: [num.toHex(signature.r), num.toHex(signature.s)],
    });
  }
  await privateWrite(join(directory, "native-bootstrap.json"), { chainId, classHash, guardianPublicKey, accounts });
};
if (process.argv[1]?.endsWith("/local-stack/keys.ts")) {
  const [directory, classHash, chainId] = process.argv.slice(2);
  if (!directory || !classHash || !chainId)
    throw new Error("Usage: value-stack:keys DIRECTORY ACCOUNT_CLASS_HASH SHARD_CHAIN_ID");
  await Effect.runPromise(
    Effect.tryPromise({
      try: () => generateKeys(directory, classHash, chainId),
      catch: () => new Error("Local bootstrap failed; existing credentials were not overwritten."),
    }),
  );
  console.log("Local guardian and device files created with mode 0600; bootstrap data is in native-bootstrap.json.");
}
