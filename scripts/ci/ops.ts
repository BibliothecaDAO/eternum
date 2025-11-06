#!/usr/bin/env bun
// Unified Bun CLI for world factory/config generation and orchestrator maintenance.
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { cleanupOrchestrator } from "./factory/cleanup.ts";
import { generateWorldConfigCalldata } from "./factory/config-calldata.ts";
import { generateFactoryCalldata } from "./factory/factory-calldata.ts";
import { maintainOrchestrator } from "./factory/maintain.ts";

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith("--")) {
      const key = t.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = val;
    }
  }
  return out;
}

function usage() {
  console.log(`
Usage:
  bun scripts/ci/ops.ts world factory-calldata --chain <chain> --world <name> [--version 180 --namespace s1_eternum --max-actions 300 --default-namespace-writer-all 1]
  bun scripts/ci/ops.ts world config-calldata  --chain <chain> --world <name> --admin <0x..> [--start-main-at <epoch> --vrf <0x..>]
  bun scripts/ci/ops.ts world deploy           --chain <chain> --factory <0x..> --args-file <path>
  bun scripts/ci/ops.ts world configure        --chain <chain> --payload-file <path>
  bun scripts/ci/ops.ts orchestrator maintain        --chain <chain> [--target-upcoming 4] \
                                               --rpc-url <url> --factory <0x..> \
                                               --account-address <0x..> --private-key <0x..> \
                                               [--admin-address <0x..>] \
                                               [--vrf <0x..>] [--torii-creator-url <url>] [--torii-namespaces s1_eternum]
  bun scripts/ci/ops.ts orchestrator cleanup         --chain <chain> [--retention-hours 10] [--all]
`);
}

function sozoExecute(args: string[]) {
  const gameDir = path.resolve(__dirname ?? import.meta.dir, "../../contracts/game");
  const res = spawnSync("sozo", ["execute", ...args], { stdio: "inherit", cwd: gameDir });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

const [, , group, cmd, ...rest] = process.argv;
if (!group) {
  usage();
  process.exit(0);
}
const args = parseArgs(rest);

async function main() {
  if (group === "world" && cmd === "factory-calldata") {
    const chain = args["chain"] || "slot";
    const world = args["world"];
    if (!world) throw new Error("--world is required");
    await generateFactoryCalldata({
      chain,
      worldName: world,
      version: args["version"] || "180",
      namespace: args["namespace"] || "s1_eternum",
      maxActions: Number(args["max-actions"] || 300),
      defaultNamespaceWriterAll: (args["default-namespace-writer-all"] || "1") === "1",
    });
    return;
  }

  if (group === "world" && cmd === "config-calldata") {
    const chain = args["chain"] || "slot";
    const world = args["world"];
    const admin = args["admin"];
    if (!world || !admin) throw new Error("--world and --admin required");
    await generateWorldConfigCalldata({
      chain,
      worldName: world,
      adminAddress: admin,
      startMainAt: args["start-main-at"] ? Number(args["start-main-at"]) : undefined,
      vrfProviderAddress: args["vrf"],
      cartridgeApiBase: process.env.CARTRIDGE_API_BASE || "https://api.cartridge.gg",
    });
    return;
  }

  if (group === "world" && cmd === "deploy") {
    const chain = args["chain"] || "slot";
    const factory = args["factory"];
    const file = args["args-file"];
    if (!factory || !file) throw new Error("--factory and --args-file required");
    const payloadPath = path.resolve(__dirname ?? import.meta.dir, "../../", file);
    const payload = Bun.file(payloadPath).text().trim().split(/\s+/);
    sozoExecute([
      "--profile",
      chain,
      "--rpc-url",
      process.env.RPC_URL || "",
      "--account-address",
      process.env.DOJO_ACCOUNT_ADDRESS || "",
      "--private-key",
      process.env.DOJO_PRIVATE_KEY || "",
      factory,
      "deploy",
      ...await payload,
    ]);
    return;
  }

  if (group === "world" && cmd === "configure") {
    const chain = args["chain"] || "slot";
    const file = args["payload-file"];
    if (!file) throw new Error("--payload-file required");
    const payloadPath = path.resolve(__dirname ?? import.meta.dir, "../../", file);
    const payload = (await Bun.file(payloadPath).text()).trim().split(/\s+/);
    sozoExecute([
      "--profile",
      chain,
      "--rpc-url",
      process.env.RPC_URL || "",
      "--account-address",
      process.env.DOJO_ACCOUNT_ADDRESS || "",
      "--private-key",
      process.env.DOJO_PRIVATE_KEY || "",
      ...payload,
    ]);
    return;
  }

  if (group === "orchestrator" && cmd === "maintain") {
    const chain = args["chain"] || "slot";
    const target = Number(args["target-upcoming"] || 4);
    await maintainOrchestrator({
      chain,
      targetUpcoming: target,
      rpcUrl: args["rpc-url"] || process.env.RPC_URL,
      factoryAddress: args["factory"] || process.env.FACTORY_ADDRESS,
      accountAddress: args["account-address"] || process.env.DOJO_ACCOUNT_ADDRESS,
      privateKey: args["private-key"] || process.env.DOJO_PRIVATE_KEY,
      adminAddress: args["admin-address"] || process.env.ADMIN_ADDRESS,
      vrfProviderAddress: args["vrf"] || process.env.VRF_PROVIDER_ADDRESS,
      toriiCreatorUrl: args["torii-creator-url"] || process.env.TORII_CREATOR_URL,
      toriiNamespaces: args["torii-namespaces"] || process.env.TORII_NAMESPACES,
      cartridgeApiBase: process.env.CARTRIDGE_API_BASE,
    });
    return;
  }

  if (group === "orchestrator" && cmd === "cleanup") {
    const chain = args["chain"] || "slot";
    const retention = Number(args["retention-hours"] || 10);
    await cleanupOrchestrator({
      chain,
      retentionHours: retention,
      deleteAll: args["all"] === "true" || Object.prototype.hasOwnProperty.call(args, "all"),
    });
    return;
  }

  usage();
  process.exit(1);
}

main();
