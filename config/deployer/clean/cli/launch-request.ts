import {
  DEFAULT_CARTRIDGE_API_BASE,
  DEFAULT_FACTORY_INDEX_POLL_MS,
  DEFAULT_FACTORY_INDEX_TIMEOUT_MS,
  DEFAULT_MAX_ACTIONS,
  DEFAULT_NAMESPACE,
  DEFAULT_VERSION,
} from "../constants";
import type { ExecutionMode, LaunchGameRequest, LaunchGameStepId } from "../types";
import type { FactoryBlitzRegistrationOverrides, FactoryMapConfigOverrides } from "@bibliothecadao/types";
import type { FactoryRunRequestContext, LaunchWorkflowScope } from "../run-store";
import { parseArgs, resolveOptionalArg, type CliArgs as Args } from "./args";

export { parseArgs };

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

function resolveNumericOverrideObject(value: string | undefined, label: string): Record<string, number> | undefined {
  if (!value) {
    return undefined;
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(value);
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }

  if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
    throw new Error(`${label} must be a JSON object`);
  }

  const overrides = parsedValue as Record<string, unknown>;

  Object.entries(overrides).forEach(([key, entryValue]) => {
    if (typeof entryValue !== "number" || !Number.isFinite(entryValue)) {
      throw new Error(`${label} entry "${key}" must be a finite number`);
    }
  });

  return overrides as Record<string, number>;
}

function resolveMapConfigOverrides(value?: string): FactoryMapConfigOverrides | undefined {
  return resolveNumericOverrideObject(value, "map config overrides") as FactoryMapConfigOverrides | undefined;
}

function resolveBlitzRegistrationOverrides(value?: string): FactoryBlitzRegistrationOverrides | undefined {
  return resolveNumericOverrideObject(value, "blitz registration overrides") as
    | FactoryBlitzRegistrationOverrides
    | undefined;
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
    throw new Error("--environment, --game, and --start-time are required");
  }

  return {
    environmentId: environmentId as LaunchGameRequest["environmentId"],
    gameName,
    startTime,
  };
}

export function buildLaunchGameRequest(args: Args): LaunchGameRequest {
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
    mapConfigOverrides: resolveMapConfigOverrides(
      resolveOptionalArg(args, "map-config-overrides-json", [
        "MAP_CONFIG_OVERRIDES_JSON",
        "GAME_LAUNCH_MAP_CONFIG_OVERRIDES_JSON",
      ]),
    ),
    blitzRegistrationOverrides: resolveBlitzRegistrationOverrides(
      resolveOptionalArg(args, "blitz-registration-overrides-json", [
        "BLITZ_REGISTRATION_OVERRIDES_JSON",
        "GAME_LAUNCH_BLITZ_REGISTRATION_OVERRIDES_JSON",
      ]),
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

export function buildFactoryRunRequestContext(
  args: Args,
  requestedLaunchStep: LaunchWorkflowScope,
): FactoryRunRequestContext {
  const request = buildLaunchGameRequest(args);

  return {
    environmentId: request.environmentId,
    gameName: request.gameName,
    requestedLaunchStep,
    request,
  };
}

export function resolveLaunchGameStepId(value?: string): LaunchGameStepId {
  switch (value) {
    case "create-world":
    case "wait-for-factory-index":
    case "configure-world":
    case "grant-lootchest-role":
    case "grant-village-pass-role":
    case "create-banks":
    case "create-indexer":
      return value;
    default:
      throw new Error(
        `Unsupported launch step "${value}". Expected one of: create-world, wait-for-factory-index, configure-world, grant-lootchest-role, grant-village-pass-role, create-banks, create-indexer`,
      );
  }
}

export function resolveLaunchWorkflowScope(value?: string): LaunchWorkflowScope {
  if (value === undefined || value === "full") {
    return "full";
  }

  return resolveLaunchGameStepId(value);
}
