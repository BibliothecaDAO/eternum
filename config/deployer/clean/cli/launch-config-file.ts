import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type { CliArgs } from "./args";
import { resolveOptionalArg } from "./args";

const SHARED_STRING_FIELDS = [
  ["rpcUrl", "rpc-url"],
  ["accountAddress", "account-address"],
  ["privateKey", "private-key"],
  ["executionMode", "mode"],
  ["version", "version"],
] as const;

const SHARED_BOOLEAN_FIELDS = [
  ["devModeOn", "dev-mode-on"],
  ["singleRealmMode", "single-realm-mode"],
  ["twoPlayerMode", "two-player-mode"],
  ["verboseConfigLogs", "verbose-config-logs"],
  ["dryRun", "dry-run"],
] as const;

const SHARED_NUMBER_FIELDS = [
  ["durationSeconds", "duration-seconds"],
  ["waitForFactoryIndexTimeoutMs", "wait-timeout-ms"],
  ["waitForFactoryIndexPollMs", "wait-poll-ms"],
] as const;

type LaunchConfigRecord = Record<string, unknown>;

function resolveConfigPath(args: CliArgs): string | undefined {
  return resolveOptionalArg(args, "config-path", ["GAME_LAUNCH_CONFIG_PATH"]);
}

function resolveAbsoluteConfigPath(configPath: string): string {
  return path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath);
}

function readLaunchConfigFile(configPath: string): LaunchConfigRecord {
  const absolutePath = resolveAbsoluteConfigPath(configPath);
  const contents = fs.readFileSync(absolutePath, "utf8");
  const parsed = YAML.parse(contents);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Launch config at ${configPath} must be a YAML object`);
  }

  return parsed as LaunchConfigRecord;
}

function resolveRequiredStringValue(
  record: LaunchConfigRecord,
  keys: string[],
  label: string,
  configPath: string,
): string {
  const value = resolveValue(record, keys);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required in ${configPath}`);
  }

  return value.trim();
}

function resolveOptionalStringValue(record: LaunchConfigRecord, keys: string[]): string | undefined {
  const value = resolveValue(record, keys);
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${keys[0]} must be a non-empty string`);
  }

  return value.trim();
}

function resolveOptionalBooleanValue(record: LaunchConfigRecord, keys: string[]): boolean | undefined {
  const value = resolveValue(record, keys);
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${keys[0]} must be a boolean`);
  }

  return value;
}

function resolveOptionalNumberValue(record: LaunchConfigRecord, keys: string[]): number | undefined {
  const value = resolveValue(record, keys);
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${keys[0]} must be a finite number`);
  }

  return value;
}

function resolveValue(record: LaunchConfigRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }
}

function setOptionalStringArg(args: CliArgs, flag: string, value: string | undefined): void {
  if (value !== undefined) {
    args[flag] = value;
  }
}

function setOptionalBooleanArg(args: CliArgs, flag: string, value: boolean | undefined): void {
  if (value !== undefined) {
    args[flag] = value ? "true" : "false";
  }
}

function setOptionalNumberArg(args: CliArgs, flag: string, value: number | undefined): void {
  if (value !== undefined) {
    args[flag] = String(value);
  }
}

function setOptionalJsonArg(args: CliArgs, flag: string, value: unknown): void {
  if (value !== undefined) {
    args[flag] = JSON.stringify(value);
  }
}

function resolveLaunchKind(record: LaunchConfigRecord, configPath: string): "game" {
  const launchKind = resolveRequiredStringValue(record, ["launchKind", "launch_kind"], "launchKind", configPath);
  if (launchKind === "game") {
    return launchKind;
  }

  throw new Error(`launchKind in ${configPath} must be "game"`);
}

function applySharedLaunchArgs(record: LaunchConfigRecord, args: CliArgs): void {
  for (const [field, flag] of SHARED_STRING_FIELDS) {
    setOptionalStringArg(args, flag, resolveOptionalStringValue(record, [field]));
  }

  for (const [field, flag] of SHARED_BOOLEAN_FIELDS) {
    setOptionalBooleanArg(args, flag, resolveOptionalBooleanValue(record, [field]));
  }

  for (const [field, flag] of SHARED_NUMBER_FIELDS) {
    setOptionalNumberArg(args, flag, resolveOptionalNumberValue(record, [field]));
  }

  setOptionalJsonArg(
    args,
    "map-config-overrides-json",
    resolveValue(record, ["mapConfigOverrides", "map_config_overrides"]),
  );
  setOptionalJsonArg(
    args,
    "biome-climate-overrides-json",
    resolveValue(record, ["biomeClimateOverrides", "biome_climate_overrides"]),
  );
  setOptionalJsonArg(
    args,
    "blitz-registration-overrides-json",
    resolveValue(record, ["blitzRegistrationOverrides", "blitz_registration_overrides"]),
  );
}

function buildGameLaunchConfigArgs(record: LaunchConfigRecord, configPath: string): CliArgs {
  const args: CliArgs = {
    "launch-kind": "game",
    environment: resolveRequiredStringValue(record, ["environmentId", "environment"], "environmentId", configPath),
    game: resolveRequiredStringValue(record, ["gameName", "game_name"], "gameName", configPath),
  };

  const startTime = resolveValue(record, ["startTime", "start_time"]);
  if (typeof startTime !== "string" && typeof startTime !== "number") {
    throw new Error(`startTime is required in ${configPath}`);
  }

  args["start-time"] = String(startTime);
  applySharedLaunchArgs(record, args);
  return args;
}

function buildLaunchConfigArgs(record: LaunchConfigRecord, configPath: string): CliArgs {
  resolveLaunchKind(record, configPath);
  return buildGameLaunchConfigArgs(record, configPath);
}

function validateExplicitRoutingArgs(args: CliArgs, configArgs: CliArgs, configPath: string): void {
  if (args["launch-kind"] && args["launch-kind"] !== configArgs["launch-kind"]) {
    throw new Error(
      `Launch kind "${args["launch-kind"]}" does not match ${configPath}, which declares "${configArgs["launch-kind"]}"`,
    );
  }

  if (args.environment && args.environment !== configArgs.environment) {
    throw new Error(
      `Environment "${args.environment}" does not match ${configPath}, which declares "${configArgs.environment}"`,
    );
  }
}

function applyConfigOwnedTargetArgs(mergedArgs: CliArgs, configArgs: CliArgs): void {
  mergedArgs["launch-kind"] = configArgs["launch-kind"];
  mergedArgs.environment = configArgs.environment;

  mergedArgs.game = configArgs.game;
  mergedArgs["start-time"] = configArgs["start-time"];
}

export function resolveLaunchRequestArgs(args: CliArgs): CliArgs {
  const configPath = resolveConfigPath(args);
  if (!configPath) {
    return args;
  }

  const configArgs = buildLaunchConfigArgs(readLaunchConfigFile(configPath), configPath);
  validateExplicitRoutingArgs(args, configArgs, configPath);

  const mergedArgs = {
    ...configArgs,
    ...args,
  };

  applyConfigOwnedTargetArgs(mergedArgs, configArgs);
  return mergedArgs;
}
