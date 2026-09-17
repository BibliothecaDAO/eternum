#!/usr/bin/env bun
import { executeNativeAdminCommand } from "../world/native/command";
import type { NativeCommand } from "../../../../packages/provider/src/native-command";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RpcProvider } from "starknet";
import { assertProviderChain } from "@realms-world/chain";
import { createMadaraAccount } from "../shared/madara-account";
import { parseArgs } from "./args";
import { loadLocalWorld, readWorldProfile } from "../world/artifacts";
import { deployWorld, isWorldSynced } from "../world/deploy";
import { buildWorldManifest, writeWorldOutputs } from "../world/manifest";
import { inspectWorld } from "../world/plan";
import { runNativeDeployment } from "../world/native/cli";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supported = new Set([
    "profile",
    "artifacts",
    "seed",
    "manifest",
    "world-address-file",
    "world-address",
    "rpc-url",
    "inspect",
    "command",
    "game-id",
  ]);
  if (args.profile === "native") {
    supported.add("identity");
    supported.add("submitter");
    supported.add("schema");
  }
  for (const flag of Object.keys(args))
    if (!supported.has(flag)) throw new Error(`Unknown deployment option: --${flag}`);
  if (args.inspect !== undefined && args.inspect !== "true") throw new Error("--inspect does not take a value");
  const root = resolve(import.meta.dir, "../../../..");
  if (args.command) {
    if (args.profile !== "native" || !args.manifest || !args["rpc-url"] || !args["game-id"])
      throw new Error("Administrative commands require --profile native, --manifest, --rpc-url and --game-id");
    const accountAddress = process.env.NATIVE_ACCOUNT_ADDRESS;
    const privateKey = process.env.NATIVE_PRIVATE_KEY;
    const admissionUrl = process.env.ADMISSION_URL;
    if (!accountAddress || !privateKey || !admissionUrl)
      throw new Error("Native credentials and ADMISSION_URL are required");
    const provider = new RpcProvider({ nodeUrl: args["rpc-url"] });
    await assertProviderChain(provider, "madara", "--rpc-url");
    const transactionHash = await executeNativeAdminCommand({
      provider,
      manifest: JSON.parse(readFileSync(args.manifest, "utf8")),
      gameId: Number(args["game-id"]),
      accountAddress,
      privateKey,
      admissionUrl,
      command: JSON.parse(readFileSync(args.command, "utf8")) as NativeCommand,
    });
    console.log(JSON.stringify({ event: "native_admin_command", transactionHash }));
    return;
  }
  if (args.profile === "native") return runNativeDeployment(args, root);
  const game = resolve(root, "contracts/l3/game");
  const profile = readWorldProfile(args.profile ?? resolve(game, "dojo_madara.toml"));
  if (args.seed) profile.world.seed = args.seed;
  const manifestPath = args.manifest ?? resolve(game, "manifest_madara.json");
  const addressPath = args["world-address-file"] ?? resolve(root, "deploy/madara-lab/.lab/world-address");
  const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : undefined;
  const address =
    args["world-address"] ?? (previous?.world?.seed === profile.world.seed ? previous.world.address : undefined);
  const local = loadLocalWorld(args.artifacts ?? resolve(game, "target/madara"), profile, address);
  const provider = new RpcProvider({ nodeUrl: args["rpc-url"] ?? process.env.RPC_URL ?? profile.env.rpc_url });
  await assertProviderChain(provider, "madara", "RPC_URL");
  if (args.inspect === "true") {
    const plan = await inspectWorld(local, provider);
    console.log(JSON.stringify({ event: "world_inspection", synced: isWorldSynced(plan), ...plan }, null, 2));
    if (plan.blockers.length) process.exitCode = 1;
    return;
  }
  const account = createMadaraAccount(
    provider,
    process.env.DOJO_ACCOUNT_ADDRESS ?? profile.env.account_address,
    process.env.DOJO_PRIVATE_KEY ?? profile.env.private_key,
  );
  const report = await deployWorld(local, account, (transaction) =>
    console.error(JSON.stringify({ event: "world_transaction", ...transaction })),
  );
  writeWorldOutputs(buildWorldManifest(local, report.after), manifestPath, addressPath);
  console.log(JSON.stringify({ event: "world_deployment", ...report }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
