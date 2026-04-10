import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type { CliArgs } from "./args";
import { resolveOptionalArg } from "./args";

const SHARED_STRING_FIELDS = [
  ["rpcUrl", "rpc-url"],
  ["factoryAddress", "factory-address"],
  ["accountAddress", "account-address"],
  ["privateKey", "private-key"],
  ["cartridgeApiBase", "cartridge-api-base"],
  ["toriiNamespaces", "torii-namespaces"],
  ["vrfProviderAddress", "vrf-provider-address"],
  ["executionMode", "mode"],
  ["version", "version"],
  ["workflowFile", "workflow-file"],
  ["ref", "ref"],
] as const;

const SHARED_BOOLEAN_FIELDS = [
  ["devModeOn", "dev-mode-on"],
  ["singleRealmMode", "single-realm-mode"],
  ["twoPlayerMode", "two-player-mode"],
  ["verboseConfigLogs", "verbose-config-logs"],
  ["skipIndexer", "skip-indexer"],
  ["skipLootChestRoleGrant", "skip-lootchest-role-grant"],
  ["skipBanks", "skip-banks"],
  ["dryRun", "dry-run"],
] as const;

const SHARED_NUMBER_FIELDS = [
  ["durationSeconds", "duration-seconds"],
  ["maxActions", "max-actions"],
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

function resolveLaunchKind(record: LaunchConfigRecord, configPath: string): "game" | "series" | "rotation" {
  const launchKind = resolveRequiredStringValue(record, ["launchKind", "launch_kind"], "launchKind", configPath);
  if (launchKind === "game" || launchKind === "series" || launchKind === "rotation") {
    return launchKind;
  }

  throw new Error(`launchKind in ${configPath} must be "game", "series", or "rotation"`);
}

function resolveSeriesGames(record: LaunchConfigRecord, configPath: string): Array<Record<string, string | number>> {
  const games = resolveValue(record, ["games"]);
  if (!Array.isArray(games) || games.length === 0) {
    throw new Error(`games must be a non-empty array in ${configPath}`);
  }

  return games.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`games[${index}] in ${configPath} must be an object`);
    }

    const game = entry as LaunchConfigRecord;
    const gameName = resolveRequiredStringValue(
      game,
      ["gameName", "game_name"],
      `games[${index}].gameName`,
      configPath,
    );
    const startTime = resolveValue(game, ["startTime", "start_time"]);

    if (typeof startTime !== "string" && typeof startTime !== "number") {
      throw new Error(`games[${index}].startTime is required in ${configPath}`);
    }

    const seriesGameNumber = resolveOptionalNumberValue(game, ["seriesGameNumber", "series_game_number"]);

    return {
      gameName,
      startTime,
      ...(seriesGameNumber !== undefined ? { seriesGameNumber } : {}),
    };
  });
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
  setOptionalStringArg(args, "series-name", resolveOptionalStringValue(record, ["seriesName", "series_name"]));
  setOptionalNumberArg(
    args,
    "series-game-number",
    resolveOptionalNumberValue(record, ["seriesGameNumber", "series_game_number"]),
  );
  return args;
}

function buildSeriesLaunchConfigArgs(record: LaunchConfigRecord, configPath: string): CliArgs {
  const args: CliArgs = {
    "launch-kind": "series",
    environment: resolveRequiredStringValue(record, ["environmentId", "environment"], "environmentId", configPath),
    "series-name": resolveRequiredStringValue(record, ["seriesName", "series_name"], "seriesName", configPath),
    "series-games-json": JSON.stringify(resolveSeriesGames(record, configPath)),
  };

  applySharedLaunchArgs(record, args);
  setOptionalJsonArg(args, "target-game-names-json", resolveValue(record, ["targetGameNames", "target_game_names"]));
  setOptionalBooleanArg(
    args,
    "auto-retry-enabled",
    resolveOptionalBooleanValue(record, ["autoRetryEnabled", "auto_retry_enabled"]),
  );
  setOptionalNumberArg(
    args,
    "auto-retry-interval-minutes",
    resolveOptionalNumberValue(record, ["autoRetryIntervalMinutes", "auto_retry_interval_minutes"]),
  );
  return args;
}

function buildRotationLaunchConfigArgs(record: LaunchConfigRecord, configPath: string): CliArgs {
  const args: CliArgs = {
    "launch-kind": "rotation",
    environment: resolveRequiredStringValue(record, ["environmentId", "environment"], "environmentId", configPath),
    "rotation-name": resolveRequiredStringValue(record, ["rotationName", "rotation_name"], "rotationName", configPath),
  };

  const firstGameStartTime = resolveValue(record, ["firstGameStartTime", "first_game_start_time"]);
  if (typeof firstGameStartTime !== "string" && typeof firstGameStartTime !== "number") {
    throw new Error(`firstGameStartTime is required in ${configPath}`);
  }

  args["first-game-start-time"] = String(firstGameStartTime);
  setOptionalNumberArg(
    args,
    "game-interval-minutes",
    resolveOptionalNumberValue(record, ["gameIntervalMinutes", "game_interval_minutes"]),
  );
  setOptionalNumberArg(args, "max-games", resolveOptionalNumberValue(record, ["maxGames", "max_games"]));
  setOptionalNumberArg(
    args,
    "advance-window-games",
    resolveOptionalNumberValue(record, ["advanceWindowGames", "advance_window_games"]),
  );
  setOptionalNumberArg(
    args,
    "evaluation-interval-minutes",
    resolveOptionalNumberValue(record, ["evaluationIntervalMinutes", "evaluation_interval_minutes"]),
  );
  applySharedLaunchArgs(record, args);
  setOptionalJsonArg(args, "target-game-names-json", resolveValue(record, ["targetGameNames", "target_game_names"]));
  setOptionalBooleanArg(
    args,
    "auto-retry-enabled",
    resolveOptionalBooleanValue(record, ["autoRetryEnabled", "auto_retry_enabled"]),
  );
  setOptionalNumberArg(
    args,
    "auto-retry-interval-minutes",
    resolveOptionalNumberValue(record, ["autoRetryIntervalMinutes", "auto_retry_interval_minutes"]),
  );
  return args;
}

function buildLaunchConfigArgs(record: LaunchConfigRecord, configPath: string): CliArgs {
  switch (resolveLaunchKind(record, configPath)) {
    case "series":
      return buildSeriesLaunchConfigArgs(record, configPath);
    case "rotation":
      return buildRotationLaunchConfigArgs(record, configPath);
    case "game":
    default:
      return buildGameLaunchConfigArgs(record, configPath);
  }
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

  switch (configArgs["launch-kind"]) {
    case "series":
      mergedArgs["series-name"] = configArgs["series-name"];
      mergedArgs["series-games-json"] = configArgs["series-games-json"];
      delete mergedArgs.game;
      delete mergedArgs["start-time"];
      delete mergedArgs["rotation-name"];
      delete mergedArgs["first-game-start-time"];
      delete mergedArgs["game-interval-minutes"];
      delete mergedArgs["max-games"];
      delete mergedArgs["advance-window-games"];
      delete mergedArgs["evaluation-interval-minutes"];
      return;
    case "rotation":
      mergedArgs["rotation-name"] = configArgs["rotation-name"];
      mergedArgs["first-game-start-time"] = configArgs["first-game-start-time"];
      mergedArgs["game-interval-minutes"] = configArgs["game-interval-minutes"];
      mergedArgs["max-games"] = configArgs["max-games"];
      if (configArgs["advance-window-games"]) {
        mergedArgs["advance-window-games"] = configArgs["advance-window-games"];
      }
      mergedArgs["evaluation-interval-minutes"] = configArgs["evaluation-interval-minutes"];
      delete mergedArgs.game;
      delete mergedArgs["start-time"];
      delete mergedArgs["series-name"];
      delete mergedArgs["series-games-json"];
      return;
    case "game":
    default:
      mergedArgs.game = configArgs.game;
      mergedArgs["start-time"] = configArgs["start-time"];
      if (configArgs["series-name"]) {
        mergedArgs["series-name"] = configArgs["series-name"];
      }
      if (configArgs["series-game-number"]) {
        mergedArgs["series-game-number"] = configArgs["series-game-number"];
      }
      delete mergedArgs["series-games-json"];
      delete mergedArgs["rotation-name"];
      delete mergedArgs["first-game-start-time"];
      delete mergedArgs["game-interval-minutes"];
      delete mergedArgs["max-games"];
      delete mergedArgs["advance-window-games"];
      delete mergedArgs["evaluation-interval-minutes"];
      return;
  }
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
