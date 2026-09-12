#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RpcProvider } from "starknet";
import { assertProviderChain } from "@realms-world/chain";
import { createMadaraAccount } from "../shared/madara-account";
import { parseArgs } from "./args";
import { loadLocalWorld, readWorldProfile } from "../world/artifacts";
import { deployWorld } from "../world/deploy";
import { buildWorldManifest, writeWorldOutputs } from "../world/manifest";

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
  ]);
  for (const flag of Object.keys(args))
    if (!supported.has(flag)) throw new Error(`Unknown deployment option: --${flag}`);
  const root = resolve(import.meta.dir, "../../../..");
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
