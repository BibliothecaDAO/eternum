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

/** The two roles a harness-created game needs: the launcher creates it, the ledger operator registers Eternum homes. */
const MEASUREMENT_ROLES = [
  { role: "launcher", setter: "set_launcher" },
  { role: "ledger_operator", setter: "set_ledger_operator" },
] as const;

/**
 * Measurement shards only: the harness creates its own games there, so the runner makes the shard's operator (the
 * Games authority the harness signs as) its launcher and ledger operator. An official shard is refused by its chain
 * name. Usage: bun measurement-roles.ts RUN_DIRECTORY, with RPC_URL (the private node) and DEPLOYER_PRIVATE_KEY.
 */
async function grantMeasurementRoles(directory: string): Promise<void> {
  const provider = new RpcProvider({ nodeUrl: required("RPC_URL") });
  const manifest = readShardManifest<NativeWorldManifest>(resolve(directory, "native-world.json"));
  await assertProviderChain(provider, manifest, "RPC_URL");
  if (isOfficialChain(manifest.shard.chainId)) throw new Error("An official shard keeps its launch and ledger Workers");
  const { operatorAccountAddress: operator } = JSON.parse(
    readFileSync(resolve(directory, "gameplay-contracts.json"), "utf8"),
  ) as { operatorAccountAddress: string };
  const games = manifest.world.address;
  const holder = async (role: string) =>
    (await provider.callContract({ contractAddress: games, entrypoint: role, calldata: [] }, "latest"))[0]!;
  const authority = createOperatorAccount(provider, operator, required("DEPLOYER_PRIVATE_KEY"));
  for (const { role, setter } of MEASUREMENT_ROLES) {
    if (BigInt(await holder(role)) !== BigInt(operator)) {
      const sent = await authority.execute(
        { contractAddress: games, entrypoint: setter, calldata: [operator] },
        await resolveRegistrarExecutionDetails(authority, games),
      );
      await confirmedTransactionReceipt(provider, sent.transaction_hash);
    }
    if (BigInt(await holder(role)) !== BigInt(operator)) throw new Error(`The measurement ${role} was not recorded`);
  }
  console.log(JSON.stringify({ event: "measurement_roles", games, launcher: operator, ledgerOperator: operator }));
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

if (import.meta.main) {
  const [directory] = process.argv.slice(2);
  if (!directory) throw new Error("Usage: bun measurement-roles.ts RUN_DIRECTORY");
  await grantMeasurementRoles(directory);
}
