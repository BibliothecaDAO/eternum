import {
  DEFAULT_APPCHAIN_GAME_INDEX_POLL_MS,
  DEFAULT_APPCHAIN_GAME_INDEX_TIMEOUT_MS,
  defaultPresetForEnvironment,
} from "../constants";
import { resolveDeploymentEnvironment } from "../environment";
import type {
  FactoryBiomeClimateOverrides,
  FactoryBlitzRegistrationOverrides,
  FactoryMapConfigOverrides,
} from "@bibliothecadao/types";
import type { DeploymentEnvironment, ExecutionMode, LaunchGameRequest } from "../types";
import { parseArgs, resolveOptionalArg, type CliArgs as Args } from "./args";
import { resolveLaunchRequestArgs } from "./launch-config-file";
import { requireRpcUrl } from "../shared/rpc";

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

function resolveJsonOverrideObject(value: string | undefined, label: string): Record<string, unknown> | undefined {
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

  return parsedValue as Record<string, unknown>;
}

function resolveNumericOverrideObject(value: string | undefined, label: string): Record<string, number> | undefined {
  const overrides = resolveJsonOverrideObject(value, label);

  if (!overrides) {
    return undefined;
  }

  for (const [key, entryValue] of Object.entries(overrides)) {
    if (typeof entryValue !== "number" || !Number.isFinite(entryValue)) {
      throw new Error(`${label} entry "${key}" must be a finite number`);
    }
  }

  return overrides as Record<string, number>;
}

function resolveMapConfigOverrides(value?: string): FactoryMapConfigOverrides | undefined {
  return resolveNumericOverrideObject(value, "map config overrides") as FactoryMapConfigOverrides | undefined;
}

function resolveBiomeClimateOverrides(value?: string): FactoryBiomeClimateOverrides | undefined {
  return resolveNumericOverrideObject(value, "biome climate overrides") as FactoryBiomeClimateOverrides | undefined;
}

function resolveBlitzRegistrationOverrides(value?: string): FactoryBlitzRegistrationOverrides | undefined {
  const overrides = resolveJsonOverrideObject(value, "blitz registration overrides");

  if (!overrides) {
    return undefined;
  }

  validateBlitzRegistrationOverrideEntries(overrides);

  return overrides as FactoryBlitzRegistrationOverrides;
}

function validateBlitzRegistrationOverrideEntries(overrides: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(overrides)) {
    validateBlitzRegistrationOverrideEntry(key, value);
  }
}

function validateBlitzRegistrationOverrideEntry(key: string, value: unknown): void {
  switch (key) {
    case "registration_count_max":
      validateBlitzRegistrationCountOverride(value);
      return;
    default:
      throw new Error(`Unsupported blitz registration overrides entry "${key}"`);
  }
}

function validateBlitzRegistrationCountOverride(value: unknown): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error('blitz registration overrides entry "registration_count_max" must be a finite number');
  }
}

function requireGameLaunchArgs(args: Args): {
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

function resolveSharedLaunchDefaults(environment: DeploymentEnvironment) {
  return {
    version: defaultPresetForEnvironment(environment.id),
    waitForFactoryIndexTimeoutMs: DEFAULT_APPCHAIN_GAME_INDEX_TIMEOUT_MS,
    waitForFactoryIndexPollMs: DEFAULT_APPCHAIN_GAME_INDEX_POLL_MS,
  };
}

function resolveSharedLaunchRequestOptions(args: Args, environment: DeploymentEnvironment) {
  const defaults = resolveSharedLaunchDefaults(environment);

  return {
    rpcUrl: requireRpcUrl(args["rpc-url"] || process.env.RPC_URL, "--rpc-url or RPC_URL"),
    accountAddress: resolveOptionalArg(args, "account-address", ["DEPLOYER_ACCOUNT_ADDRESS"]),
    privateKey: resolveOptionalArg(args, "private-key", ["DEPLOYER_PRIVATE_KEY"]),
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
    biomeClimateOverrides: resolveBiomeClimateOverrides(
      resolveOptionalArg(args, "biome-climate-overrides-json", [
        "BIOME_CLIMATE_OVERRIDES_JSON",
        "GAME_LAUNCH_BIOME_CLIMATE_OVERRIDES_JSON",
      ]),
    ),
    blitzRegistrationOverrides: resolveBlitzRegistrationOverrides(
      resolveOptionalArg(args, "blitz-registration-overrides-json", [
        "BLITZ_REGISTRATION_OVERRIDES_JSON",
        "GAME_LAUNCH_BLITZ_REGISTRATION_OVERRIDES_JSON",
      ]),
    ),
    executionMode: resolveExecutionMode(args.mode),
    verboseConfigLogs: args["verbose-config-logs"] === "true" || process.env.VERBOSE_CONFIG_LOGS === "true",
    version: args.version || defaults.version,
    waitForFactoryIndexTimeoutMs:
      resolveOptionalNumber(args["wait-timeout-ms"], "wait timeout") ?? defaults.waitForFactoryIndexTimeoutMs,
    waitForFactoryIndexPollMs:
      resolveOptionalNumber(args["wait-poll-ms"], "wait poll interval") ?? defaults.waitForFactoryIndexPollMs,
    dryRun: args["dry-run"] === "true",
  };
}

export function buildLaunchGameRequest(args: Args): LaunchGameRequest {
  const resolvedArgs = resolveLaunchRequestArgs(args);
  if (resolvedArgs["launch-kind"] && resolvedArgs["launch-kind"] !== "game") {
    throw new Error("Only game launches are supported; use free slots for Blitz rosters");
  }
  const requiredArgs = requireGameLaunchArgs(resolvedArgs);
  const environment = resolveDeploymentEnvironment(requiredArgs.environmentId);

  return {
    launchKind: "game",
    environmentId: requiredArgs.environmentId,
    gameName: requiredArgs.gameName,
    startTime: requiredArgs.startTime,
    ...resolveSharedLaunchRequestOptions(resolvedArgs, environment),
  };
}
