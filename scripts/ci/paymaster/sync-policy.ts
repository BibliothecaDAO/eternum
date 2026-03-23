#!/usr/bin/env bun
import { syncPaymasterPolicy } from "../../../config/deployer/clean/paymaster";

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const nextToken = argv[index + 1];

    if (nextToken && !nextToken.startsWith("--")) {
      args[key] = nextToken;
      index += 1;
      continue;
    }

    args[key] = "true";
  }

  return args;
}

function usage(): void {
  console.log(
    [
      "",
      "Usage:",
      "  bun scripts/ci/paymaster/sync-policy.ts --chain <mainnet|sepolia|slot|slottest|local> --game <world-name>",
      "",
      "Optional flags:",
      "  --paymaster <name>           default: empire",
      "  --cartridge-api-base <url>",
      "  --vrf-provider-address <0x...>",
      "  --dry-run",
      "  --help",
      "",
    ].join("\n"),
  );
}

function requireArg(args: Record<string, string>, key: string): string {
  const value = args[key];

  if (!value) {
    throw new Error(`--${key} is required`);
  }

  return value;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help === "true") {
    usage();
    return;
  }

  const summary = await syncPaymasterPolicy({
    chain: requireArg(args, "chain"),
    gameName: requireArg(args, "game"),
    paymasterName: args.paymaster,
    cartridgeApiBase: args["cartridge-api-base"],
    vrfProviderAddress: args["vrf-provider-address"],
    dryRun: args["dry-run"] === "true",
  });

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);

  if (message.includes("--chain is required") || message.includes("--game is required")) {
    usage();
  }

  console.error(message);
  process.exit(1);
});
