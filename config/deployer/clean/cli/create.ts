#!/usr/bin/env bun
import { parseArgs, resolveOptionalArg, type CliArgs as Args } from "./args";
import {
  DEFAULT_CARTRIDGE_API_BASE,
  DEFAULT_FACTORY_INDEX_POLL_MS,
  DEFAULT_FACTORY_INDEX_TIMEOUT_MS,
  DEFAULT_MAX_ACTIONS,
  DEFAULT_NAMESPACE,
  DEFAULT_VERSION,
  launchGame,
  type ExecutionMode,
  type LaunchGameRequest,
} from "..";

function usage(): void {
  console.log(
    [
      "",
      "Usage:",
      "  bun config/deployer/clean/cli/create.ts --environment <slot.blitz|slot.eternum> --game <world-name> --start-time <unix|iso>",
      "",
      "Optional env or flags:",
      "  RPC_URL / --rpc-url",
      "  FACTORY_ADDRESS / --factory-address",
      "  DOJO_ACCOUNT_ADDRESS / --account-address",
      "  DOJO_PRIVATE_KEY / --private-key",
      "  VITE_PUBLIC_VRF_PROVIDER_ADDRESS / --vrf-provider-address",
      "  TORII_NAMESPACES / --torii-namespaces",
      "  CARTRIDGE_API_BASE / --cartridge-api-base",
      "  GITHUB_TOKEN",
      "  GITHUB_REPOSITORY",
      "  --workflow-file <factory-torii-deployer.yml>",
      "  --ref <git-ref>",
      "  Local fallback: if GITHUB_TOKEN is unset, the clean deployer will try gh auth token",
      "                  and log that it did so. If GITHUB_REPOSITORY is unset, it will try",
      "                  gh repo view. If ref is unset, it will try the current git branch.",
      "  VERBOSE_CONFIG_LOGS=true / --verbose-config-logs",
      "  DEV_MODE_ON=true|false / --dev-mode-on true|false",
      "  SINGLE_REALM_MODE=true|false / --single-realm-mode true|false",
      "  TWO_PLAYER_MODE=true|false / --two-player-mode true|false",
      "  DURATION_SECONDS=<integer> / --duration-seconds <integer>",
      "                               overrides config duration; used by blitz season end_at",
      "  --mode <batched|sequential>",
      `  --version <felt>              default: ${DEFAULT_VERSION}`,
      `  --max-actions <number>        default: ${DEFAULT_MAX_ACTIONS}`,
      "  --factory-address <0x...>     override the environment default",
      "  --series-name <value>",
      "  --series-game-number <number>",
      "  --skip-indexer",
      "  --skip-lootchest-role-grant",
      "  --skip-banks",
      "  --dry-run",
      "",
      "Examples:",
      "  bun config/deployer/clean/cli/create.ts --environment slot.blitz --game bltz-fire-gate-42 --start-time 1763112600",
      "  bun config/deployer/clean/cli/create.ts --environment slot.eternum --game etrn-iron-mist-11 --start-time 2025-11-14T09:30:00Z",
      "",
    ].join("\n"),
  );
}

function parseBoolean(value: string, label: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${label} must be "true" or "false"`);
}

function resolveOptionalBooleanArg(args: Args, flag: string, envKeys: string[]): boolean | undefined {
  const fromFlag = args[flag];
  if (fromFlag) {
    return parseBoolean(fromFlag, flag);
  }

  for (const envKey of envKeys) {
    const value = process.env[envKey];
    if (value) {
      return parseBoolean(value, envKey);
    }
  }
}

function resolveExecutionMode(value?: string): ExecutionMode {
  if (!value) {
    return "batched";
  }

  if (value === "batched" || value === "sequential") {
    return value;
  }

  throw new Error(`Unsupported execution mode "${value}". Expected "batched" or "sequential"`);
}

function resolveOptionalNumber(value: string | undefined, label: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a number`);
  }

  return parsed;
}

function requireLaunchArgs(args: Args): {
  environmentId: LaunchGameRequest["environmentId"];
  gameName: string;
  startTime: string;
} {
  const environmentId = args.environment;
  const gameName = args.game;
  const startTime = args["start-time"];

  if (!environmentId || !gameName || !startTime) {
    usage();
    throw new Error("--environment, --game, and --start-time are required");
  }

  return {
    environmentId: environmentId as LaunchGameRequest["environmentId"],
    gameName,
    startTime,
  };
}

function buildLaunchGameRequest(args: Args): LaunchGameRequest {
  const requiredArgs = requireLaunchArgs(args);

  return {
    environmentId: requiredArgs.environmentId,
    gameName: requiredArgs.gameName,
    startTime: requiredArgs.startTime,
    rpcUrl: args["rpc-url"] || process.env.RPC_URL || process.env.VITE_PUBLIC_NODE_URL,
    factoryAddress: args["factory-address"] || process.env.FACTORY_ADDRESS,
    accountAddress: resolveOptionalArg(args, "account-address", ["DOJO_ACCOUNT_ADDRESS", "VITE_PUBLIC_MASTER_ADDRESS"]),
    privateKey: resolveOptionalArg(args, "private-key", ["DOJO_PRIVATE_KEY", "VITE_PUBLIC_MASTER_PRIVATE_KEY"]),
    devModeOn: resolveOptionalBooleanArg(args, "dev-mode-on", ["DEV_MODE_ON"]),
    singleRealmMode: resolveOptionalBooleanArg(args, "single-realm-mode", ["SINGLE_REALM_MODE"]),
    twoPlayerMode: resolveOptionalBooleanArg(args, "two-player-mode", ["TWO_PLAYER_MODE"]),
    durationSeconds: resolveOptionalNumber(
      args["duration-seconds"] || process.env.DURATION_SECONDS,
      "duration seconds",
    ),
    cartridgeApiBase: args["cartridge-api-base"] || process.env.CARTRIDGE_API_BASE || DEFAULT_CARTRIDGE_API_BASE,
    toriiNamespaces: args["torii-namespaces"] || process.env.TORII_NAMESPACES || DEFAULT_NAMESPACE,
    vrfProviderAddress:
      args["vrf-provider-address"] ||
      process.env.VRF_PROVIDER_ADDRESS ||
      process.env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS ||
      "0x0",
    executionMode: resolveExecutionMode(args.mode),
    verboseConfigLogs: args["verbose-config-logs"] === "true" || process.env.VERBOSE_CONFIG_LOGS === "true",
    version: args.version || DEFAULT_VERSION,
    maxActions: resolveOptionalNumber(args["max-actions"], "max actions") ?? DEFAULT_MAX_ACTIONS,
    seriesName: args["series-name"],
    seriesGameNumber: resolveOptionalNumber(args["series-game-number"], "series game number"),
    waitForFactoryIndexTimeoutMs:
      resolveOptionalNumber(args["wait-timeout-ms"], "wait timeout") ?? DEFAULT_FACTORY_INDEX_TIMEOUT_MS,
    waitForFactoryIndexPollMs:
      resolveOptionalNumber(args["wait-poll-ms"], "wait poll interval") ?? DEFAULT_FACTORY_INDEX_POLL_MS,
    skipIndexer: args["skip-indexer"] === "true",
    skipLootChestRoleGrant: args["skip-lootchest-role-grant"] === "true",
    skipBanks: args["skip-banks"] === "true",
    dryRun: args["dry-run"] === "true",
    workflowFile: args["workflow-file"],
    ref: args.ref,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "true") {
    usage();
    return;
  }

  const summary = await launchGame(buildLaunchGameRequest(args));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
