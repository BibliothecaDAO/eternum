import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RpcProvider } from "starknet";
import { readShardManifest } from "@realms-world/chain/shard-manifest";
import { assertProviderChain } from "@realms-world/chain";
import type { CliArgs } from "../../cli/args";
import { createMadaraAccount, createOperatorAccount } from "../../shared/madara-account";
import { writeWorldOutputs } from "./write";
import { loadNativeWorld } from "./artifacts";
import { buildNativeManifest } from "./manifest";
import { deployNativeWorld } from "./deploy";
import { inspectNativeWorld } from "./plan";
import type { NativeTransaction, NativeWorldManifest } from "./types";
import { applyNativeRelease } from "./releases";

export async function runNativeDeployment(args: CliArgs, root: string): Promise<void> {
  const manifestPath = args.manifest ?? requiredEnvironment("NATIVE_WORLD_MANIFEST");
  const seed = required(args, "seed");
  const identity = JSON.parse(readFileSync(required(args, "identity"), "utf8"));
  const authority = identity.operatorAccountAddress;
  if (!authority) throw new Error("Identity deployment requires an operatorAccountAddress");
  const provider = new RpcProvider({ nodeUrl: args["rpc-url"] ?? requiredEnvironment("RPC_URL") });
  const manifest = readShardManifest<NativeWorldManifest>(manifestPath);
  await assertProviderChain(provider, manifest, "RPC_URL");
  if (!manifest.native && Object.keys(manifest).some((key) => key !== "shard"))
    throw new Error("Cannot replace a non-native deployment manifest");
  const previous = manifest.native ? manifest : undefined;
  const local = loadNativeWorld({
    artifacts: args.artifacts ?? resolve(root, "contracts/l3/world-native/target/dev"),
    schemaPath: args.schema ?? resolve(root, "contracts/l3/world-native/schema/schema.json"),
    seed,
    authority,
    previous,
    release: JSON.parse(readFileSync(args["release-facts"] ?? "/release/release-facts.json", "utf8")),
    authentication: {
      submitter: required(args, "submitter"),
      account_class: manifest.shard.accountClassHash,
      guardian_public_key: manifest.shard.guardianPublicKey,
    },
  });
  if (args.inspect === "true") {
    const plan = await inspectNativeWorld(local, provider);
    console.log(JSON.stringify({ event: "native_world_inspection", ...plan }, null, 2));
    if (!plan.synced) process.exitCode = 1;
    return;
  }
  const account = createOperatorAccount(provider, authority, requiredEnvironment("DEPLOYER_PRIVATE_KEY"));
  if (args["apply-games"]) {
    const transactions: NativeTransaction[] = [];
    await applyNativeRelease(
      local,
      account,
      args["apply-games"].split(",").map(Number),
      args["herald-url"] ?? requiredEnvironment("HERALD_URL"),
      (transaction) => {
        transactions.push(transaction);
        console.error(JSON.stringify({ event: "native_world_transaction", ...transaction }));
      },
    );
    console.log(JSON.stringify({ event: "native_release_applied", transactions }, null, 2));
    return;
  }
  const declarer = createMadaraAccount(
    provider,
    requiredEnvironment("DEPLOYER_ACCOUNT_ADDRESS"),
    requiredEnvironment("DEPLOYER_PRIVATE_KEY"),
  );
  const report = await deployNativeWorld(
    local,
    account,
    (transaction) => console.error(JSON.stringify({ event: "native_world_transaction", ...transaction })),
    declarer,
  );
  const shard = {
    chainId: manifest.shard.chainId,
    accountClassHash: manifest.shard.accountClassHash,
    contracts: {},
    guardianPublicKey: manifest.shard.guardianPublicKey,
  };
  writeWorldOutputs(
    buildNativeManifest(local, report.before, shard),
    manifestPath,
    args["world-address-file"] ?? resolve(root, "deploy/athanor/.lab/native-world-address"),
  );
  console.log(
    JSON.stringify(
      {
        event: "native_world_deployment",
        ...report,
        classSizes: [
          ...local.logic,
          ...(local.migration ? [local.migration] : []),
          { name: "games", ...local.games },
        ].map((domain) => ({
          domain: domain.name,
          sierraFelts: domain.sierra.sierra_program.length,
          casmFelts: domain.casm.bytecode.length,
        })),
      },
      null,
      2,
    ),
  );
}

function required(args: CliArgs, name: string): string {
  const value = args[name];
  if (!value || value === "true") throw new Error(`Native deployment requires --${name}`);
  return value;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
