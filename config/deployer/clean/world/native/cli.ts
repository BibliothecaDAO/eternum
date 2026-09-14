import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RpcProvider } from "starknet";
import { assertProviderChain } from "@realms-world/chain";
import type { CliArgs } from "../../cli/args";
import { createMadaraAccount } from "../../shared/madara-account";
import { readWorldProfile } from "../artifacts";
import { writeWorldOutputs } from "../manifest";
import { loadNativeWorld } from "./artifacts";
import { buildNativeManifest } from "./manifest";
import { deployNativeWorld } from "./deploy";
import { inspectNativeWorld } from "./plan";
import type { NativeWorldManifest } from "./types";

export async function runNativeDeployment(args: CliArgs, root: string): Promise<void> {
  const manifestPath = required(args, "manifest");
  const seed = required(args, "seed");
  const identity = JSON.parse(readFileSync(required(args, "identity"), "utf8"));
  const profile = readWorldProfile(resolve(root, "contracts/l3/game/dojo_madara.toml"));
  const authority = process.env.DOJO_ACCOUNT_ADDRESS ?? profile.env.account_address;
  const provider = new RpcProvider({ nodeUrl: args["rpc-url"] ?? process.env.RPC_URL ?? profile.env.rpc_url });
  await assertProviderChain(provider, "madara", "RPC_URL");
  const previous = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, "utf8")) as NativeWorldManifest)
    : undefined;
  const local = loadNativeWorld({
    artifacts: args.artifacts ?? resolve(root, "contracts/l3/world-native/target/dev"),
    schemaPath: args.schema ?? resolve(root, "contracts/l3/world-native/schema/schema.json"),
    seed,
    authority,
    previous,
    authentication: {
      submitter: required(args, "submitter"),
      registry: identity.playerRegistryAddress,
      account_class: identity.playerAccountClassHash,
    },
  });
  if (args.inspect === "true") {
    const plan = await inspectNativeWorld(local, provider);
    console.log(JSON.stringify({ event: "native_world_inspection", ...plan }, null, 2));
    if (!plan.synced) process.exitCode = 1;
    return;
  }
  const account = createMadaraAccount(provider, authority, process.env.DOJO_PRIVATE_KEY ?? profile.env.private_key);
  const report = await deployNativeWorld(local, account, (transaction) =>
    console.error(JSON.stringify({ event: "native_world_transaction", ...transaction })),
  );
  writeWorldOutputs(
    buildNativeManifest(local, report.before),
    manifestPath,
    args["world-address-file"] ?? resolve(root, "deploy/madara-lab/.lab/native-world-address"),
  );
  console.log(
    JSON.stringify(
      {
        event: "native_world_deployment",
        ...report,
        classSizes: local.domains.map((domain) => ({
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
