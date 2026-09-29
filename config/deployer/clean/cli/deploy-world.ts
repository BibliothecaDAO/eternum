#!/usr/bin/env bun
import { completeNativeAdminCommand } from "../world/native/command";
import type { NativeWorldManifest } from "../world/native/types";
import type { NativeCommand } from "../../../../packages/provider/src/native-command";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RpcProvider } from "starknet";
import { readShardManifest } from "@realms-world/chain/shard-manifest";
import { assertProviderChain } from "@realms-world/chain";
import { parseArgs, type CliArgs } from "./args";
import { runNativeDeployment } from "../world/native/cli";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supported = new Set([
    "artifacts",
    "seed",
    "manifest",
    "world-address-file",
    "rpc-url",
    "inspect",
    "command",
    "game-id",
    "identity",
    "submitter",
    "schema",
    "release-facts",
    "apply-games",
    "herald-url",
  ]);
  for (const flag of Object.keys(args))
    if (!supported.has(flag)) throw new Error(`Unknown deployment option: --${flag}`);
  if (args.inspect !== undefined && args.inspect !== "true") throw new Error("--inspect does not take a value");
  const root = resolve(import.meta.dir, "../../../..");
  if (!args.manifest && process.env.NATIVE_WORLD_MANIFEST) args.manifest = process.env.NATIVE_WORLD_MANIFEST;
  if (args.command) return runAdministrativeCommand(args);
  await runNativeDeployment(args, root);
}

async function runAdministrativeCommand(args: CliArgs) {
  if (!args.manifest || !args["rpc-url"] || !args["game-id"])
    throw new Error("Administrative commands require --manifest (or NATIVE_WORLD_MANIFEST), --rpc-url and --game-id");
  const accountAddress = process.env.DEPLOYER_ACCOUNT_ADDRESS;
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  const admissionUrl = process.env.ADMISSION_URL;
  if (!accountAddress || !privateKey || !admissionUrl)
    throw new Error("Native credentials and ADMISSION_URL are required");
  const provider = new RpcProvider({ nodeUrl: args["rpc-url"] });
  const manifest = readShardManifest<NativeWorldManifest>(args.manifest);
  await assertProviderChain(provider, manifest, "--rpc-url");
  const result = await completeNativeAdminCommand({
    provider,
    manifest,
    gameId: Number(args["game-id"]),
    accountAddress,
    privateKey,
    admissionUrl,
    command: JSON.parse(readFileSync(args.command, "utf8")) as NativeCommand,
  });
  console.log(JSON.stringify({ event: "native_admin_command", ...result }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
