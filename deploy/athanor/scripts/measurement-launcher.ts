import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RpcProvider, shortString } from "starknet";
import environments from "../../first/environments.json";
import { confirmedTransactionReceipt } from "../../../config/deployer/clean/shared/transaction";
import { createOperatorAccount } from "../../../config/deployer/clean/shared/madara-account";
import { resolveRegistrarExecutionDetails } from "../../../config/deployer/clean/registrar/transaction-details";
import type { NativeWorldManifest } from "../../../config/deployer/clean/world/native/types";
import { assertProviderChain } from "../../../packages/chain/chain-guard.js";
import { readShardManifest } from "../../../packages/chain/shard-manifest.js";

/**
 * A deployment names its chain after its environment at genesis, `<ENVIRONMENT>_<time>` (deploy.py), so a chain that
 * reads as one of those names belongs to an official shard, whose launcher is the launch Worker and must stay so.
 */
export const isOfficialChain = (chainId: string): boolean => {
  const name = shortString.decodeShortString(chainId);
  return Object.values(environments).some(({ environment }) => name.startsWith(`${environment.toUpperCase()}_`));
};

/**
 * Measurement shards only: the harness creates its own games there, so the runner makes the shard's operator (the
 * Games authority the harness signs as) its launcher. An official shard is refused by its chain name.
 * Usage: bun measurement-launcher.ts RUN_DIRECTORY, with RPC_URL (the private node) and DEPLOYER_PRIVATE_KEY.
 */
async function grantMeasurementLauncher(directory: string): Promise<void> {
  const rpcUrl = required("RPC_URL");
  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const manifest = readShardManifest<NativeWorldManifest>(resolve(directory, "native-world.json"));
  await assertProviderChain(provider, manifest, "RPC_URL");
  if (isOfficialChain(manifest.shard.chainId)) throw new Error("An official shard keeps the launch Worker as launcher");
  const { operatorAccountAddress: operator } = JSON.parse(
    readFileSync(resolve(directory, "gameplay-contracts.json"), "utf8"),
  ) as { operatorAccountAddress: string };
  const games = manifest.world.address;
  const launcher = async () =>
    (await provider.callContract({ contractAddress: games, entrypoint: "launcher", calldata: [] }, "latest"))[0]!;
  if (BigInt(await launcher()) !== BigInt(operator)) {
    const authority = createOperatorAccount(provider, operator, required("DEPLOYER_PRIVATE_KEY"));
    const sent = await authority.execute(
      { contractAddress: games, entrypoint: "set_launcher", calldata: [operator] },
      await resolveRegistrarExecutionDetails(authority, games),
    );
    await confirmedTransactionReceipt(provider, sent.transaction_hash);
  }
  if (BigInt(await launcher()) !== BigInt(operator)) throw new Error("The measurement launcher was not recorded");
  console.log(JSON.stringify({ event: "measurement_launcher", games, launcher: operator }));
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

if (import.meta.main) {
  const [directory] = process.argv.slice(2);
  if (!directory) throw new Error("Usage: bun measurement-launcher.ts RUN_DIRECTORY");
  await grantMeasurementLauncher(directory);
}
