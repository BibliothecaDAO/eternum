#!/usr/bin/env bun
import { parseArgs, resolveOptionalArg } from "./args";
import { grantVillagePassRoleToRealmInternalSystems } from "..";

function usage(): void {
  console.log(
    [
      "",
      "Usage:",
      "  bun config/deployer/clean/cli/grant-village-pass-minter-role.ts --chain <slot.eternum|slottest.eternum|sepolia.eternum|mainnet.eternum|local.eternum> --game <world-name>",
      "",
      "Optional env or flags:",
      "  RPC_URL / --rpc-url",
      "  DOJO_ACCOUNT_ADDRESS / --account-address",
      "  DOJO_PRIVATE_KEY / --private-key",
      "  GAME_LAUNCH_DOJO_ACCOUNT_ADDRESS",
      "  GAME_LAUNCH_DOJO_PRIVATE_KEY",
      "  CARTRIDGE_API_BASE / --cartridge-api-base",
      "  --dry-run",
      "",
    ].join("\n"),
  );
}

function requireGrantVillagePassArgs(args: Record<string, string>): { chain: string; gameName: string } {
  const chain = args.chain;
  const gameName = args.game;

  if (!chain || !gameName) {
    usage();
    throw new Error("--chain and --game are required");
  }

  return { chain, gameName };
}

function buildGrantVillagePassRequest(args: Record<string, string>) {
  const requiredArgs = requireGrantVillagePassArgs(args);

  return {
    chain: requiredArgs.chain,
    gameName: requiredArgs.gameName,
    rpcUrl: args["rpc-url"] || process.env.RPC_URL,
    accountAddress: resolveOptionalArg(args, "account-address", [
      "DOJO_ACCOUNT_ADDRESS",
      "GAME_LAUNCH_DOJO_ACCOUNT_ADDRESS",
    ]),
    privateKey: resolveOptionalArg(args, "private-key", ["DOJO_PRIVATE_KEY", "GAME_LAUNCH_DOJO_PRIVATE_KEY"]),
    cartridgeApiBase: args["cartridge-api-base"] || process.env.CARTRIDGE_API_BASE,
    dryRun: args["dry-run"] === "true",
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "true") {
    usage();
    return;
  }

  const summary = await grantVillagePassRoleToRealmInternalSystems(buildGrantVillagePassRequest(args));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
