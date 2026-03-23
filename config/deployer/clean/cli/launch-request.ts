import {
  DEFAULT_CARTRIDGE_API_BASE,
  DEFAULT_FACTORY_INDEX_POLL_MS,
  DEFAULT_FACTORY_INDEX_TIMEOUT_MS,
  DEFAULT_NAMESPACE,
  DEFAULT_VERSION,
} from "../constants";
import { resolveDeploymentEnvironment } from "../environment";
import type { FactoryBlitzRegistrationOverrides, FactoryMapConfigOverrides } from "@bibliothecadao/types";
import type {
  ExecutionMode,
  LaunchGameRequest,
  LaunchGameStepId,
  LaunchRotationRequest,
  LaunchRotationStepId,
  LaunchSeriesRequest,
  LaunchSeriesStepId,
  LaunchTargetKind,
} from "../types";
import type {
  FactoryRotationRunRequestContext,
  FactoryRunRequestContext,
  FactorySeriesRunRequestContext,
  LaunchWorkflowScope,
  RotationLaunchWorkflowScope,
  SeriesLaunchWorkflowScope,
} from "../run-store";
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
    case "fee_token":
    case "fee_amount":
      validateBlitzRegistrationStringOverride(key, value);
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

function validateBlitzRegistrationStringOverride(key: string, value: unknown): void {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`blitz registration overrides entry "${key}" must be a non-empty string`);
  }
}

export function resolveLaunchKind(args: Args): LaunchTargetKind {
  const rawLaunchKind = args["launch-kind"] || process.env.GAME_LAUNCH_KIND || "game";

  if (rawLaunchKind === "game" || rawLaunchKind === "series" || rawLaunchKind === "rotation") {
    return rawLaunchKind;
  }

  throw new Error(`Unsupported launch kind "${rawLaunchKind}". Expected "game", "series", or "rotation"`);
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

function resolveSeriesGamesJson(args: Args): LaunchSeriesRequest["games"] {
  const rawValue = resolveOptionalArg(args, "series-games-json", ["GAME_LAUNCH_SERIES_GAMES_JSON"]);

  if (!rawValue) {
    throw new Error("--series-games-json is required for series launches");
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    throw new Error("series games JSON must be valid JSON");
  }

  if (!Array.isArray(parsedValue) || parsedValue.length === 0) {
    throw new Error("series games JSON must be a non-empty array");
  }

  return parsedValue.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`series games JSON entry ${index + 1} must be an object`);
    }

    const record = entry as Record<string, unknown>;

    if (typeof record.gameName !== "string" || !record.gameName.trim()) {
      throw new Error(`series games JSON entry ${index + 1} requires a non-empty gameName`);
    }

    if (
      typeof record.startTime !== "string" &&
      typeof record.startTime !== "number" &&
      typeof record.start_time !== "string" &&
      typeof record.start_time !== "number"
    ) {
      throw new Error(`series games JSON entry ${index + 1} requires a startTime`);
    }

    const seriesGameNumber =
      typeof record.seriesGameNumber === "number"
        ? record.seriesGameNumber
        : typeof record.series_game_number === "number"
          ? record.series_game_number
          : undefined;

    return {
      gameName: record.gameName.trim(),
      startTime: (record.startTime ?? record.start_time) as string | number,
      seriesGameNumber,
    };
  });
}

function resolveTargetGameNamesJson(args: Args): string[] | undefined {
  const rawValue = resolveOptionalArg(args, "target-game-names-json", ["GAME_LAUNCH_TARGET_GAME_NAMES_JSON"]);

  if (!rawValue) {
    return undefined;
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    throw new Error("target game names JSON must be valid JSON");
  }

  if (!Array.isArray(parsedValue) || parsedValue.length === 0) {
    throw new Error("target game names JSON must be a non-empty array");
  }

  const normalizedGameNames = parsedValue.map((entry, index) => {
    if (typeof entry !== "string" || !entry.trim()) {
      throw new Error(`target game names JSON entry ${index + 1} must be a non-empty string`);
    }

    return entry.trim();
  });

  if (new Set(normalizedGameNames).size !== normalizedGameNames.length) {
    throw new Error("target game names JSON cannot contain duplicate game names");
  }

  return normalizedGameNames;
}

function requireSeriesLaunchArgs(args: Args): {
  environmentId: LaunchSeriesRequest["environmentId"];
  seriesName: string;
  games: LaunchSeriesRequest["games"];
} {
  const environmentId = args.environment;
  const seriesName = resolveOptionalArg(args, "series-name", ["GAME_LAUNCH_SERIES_NAME"]);

  if (!environmentId || !seriesName) {
    throw new Error("--environment and --series-name are required for series launches");
  }

  return {
    environmentId: environmentId as LaunchSeriesRequest["environmentId"],
    seriesName,
    games: resolveSeriesGamesJson(args),
  };
}

function requireRotationLaunchArgs(args: Args): {
  environmentId: LaunchRotationRequest["environmentId"];
  rotationName: string;
  firstGameStartTime: string;
  gameIntervalMinutes: number;
  maxGames: number;
  advanceWindowGames?: number;
  evaluationIntervalMinutes: number;
} {
  const environmentId = args.environment;
  const rotationName = resolveOptionalArg(args, "rotation-name", ["GAME_LAUNCH_ROTATION_NAME"]);
  const firstGameStartTime = resolveOptionalArg(args, "first-game-start-time", ["GAME_LAUNCH_FIRST_GAME_START_TIME"]);
  const gameIntervalMinutes = resolveOptionalNumber(
    resolveOptionalArg(args, "game-interval-minutes", ["GAME_LAUNCH_GAME_INTERVAL_MINUTES"]),
    "game interval minutes",
  );
  const maxGames = resolveOptionalNumber(resolveOptionalArg(args, "max-games", ["GAME_LAUNCH_MAX_GAMES"]), "max games");
  const advanceWindowGames = resolveOptionalNumber(
    resolveOptionalArg(args, "advance-window-games", ["GAME_LAUNCH_ADVANCE_WINDOW_GAMES"]),
    "advance window games",
  );
  const evaluationIntervalMinutes = resolveOptionalNumber(
    resolveOptionalArg(args, "evaluation-interval-minutes", ["GAME_LAUNCH_EVALUATION_INTERVAL_MINUTES"]),
    "evaluation interval minutes",
  );

  if (
    !environmentId ||
    !rotationName ||
    !firstGameStartTime ||
    gameIntervalMinutes === undefined ||
    maxGames === undefined ||
    evaluationIntervalMinutes === undefined
  ) {
    throw new Error(
      "--environment, --rotation-name, --first-game-start-time, --game-interval-minutes, --max-games, and --evaluation-interval-minutes are required for rotation launches",
    );
  }

  return {
    environmentId: environmentId as LaunchRotationRequest["environmentId"],
    rotationName,
    firstGameStartTime,
    gameIntervalMinutes,
    maxGames,
    advanceWindowGames,
    evaluationIntervalMinutes,
  };
}

function resolveSharedLaunchRequestOptions(args: Args) {
  return {
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

export function buildLaunchGameRequest(args: Args): LaunchGameRequest {
  const requiredArgs = requireGameLaunchArgs(args);
  const environment = resolveDeploymentEnvironment(requiredArgs.environmentId);

  return {
    launchKind: "game",
    environmentId: requiredArgs.environmentId,
    gameName: requiredArgs.gameName,
    startTime: requiredArgs.startTime,
    ...resolveSharedLaunchRequestOptions(args),
    maxActions: resolveOptionalNumber(args["max-actions"], "max actions") ?? environment.createGame.maxActions,
    seriesName: args["series-name"],
    seriesGameNumber: resolveOptionalNumber(args["series-game-number"], "series game number"),
  };
}

export function buildLaunchSeriesRequest(args: Args): LaunchSeriesRequest {
  const requiredArgs = requireSeriesLaunchArgs(args);
  const environment = resolveDeploymentEnvironment(requiredArgs.environmentId);

  return {
    launchKind: "series",
    environmentId: requiredArgs.environmentId,
    seriesName: requiredArgs.seriesName,
    games: requiredArgs.games,
    targetGameNames: resolveTargetGameNamesJson(args),
    ...resolveSharedLaunchRequestOptions(args),
    maxActions: resolveOptionalNumber(args["max-actions"], "max actions") ?? environment.createGame.maxActions,
    autoRetryEnabled: resolveOptionalBooleanArg(args, "auto-retry-enabled", ["GAME_LAUNCH_AUTO_RETRY_ENABLED"]) ?? true,
    autoRetryIntervalMinutes:
      resolveOptionalNumber(
        args["auto-retry-interval-minutes"] || process.env.GAME_LAUNCH_AUTO_RETRY_INTERVAL_MINUTES,
        "auto retry interval minutes",
      ) ?? undefined,
  };
}

export function buildLaunchRotationRequest(args: Args): LaunchRotationRequest {
  const requiredArgs = requireRotationLaunchArgs(args);
  const environment = resolveDeploymentEnvironment(requiredArgs.environmentId);

  return {
    launchKind: "rotation",
    environmentId: requiredArgs.environmentId,
    rotationName: requiredArgs.rotationName,
    firstGameStartTime: requiredArgs.firstGameStartTime,
    gameIntervalMinutes: requiredArgs.gameIntervalMinutes,
    maxGames: requiredArgs.maxGames,
    advanceWindowGames: requiredArgs.advanceWindowGames,
    targetGameNames: resolveTargetGameNamesJson(args),
    evaluationIntervalMinutes: requiredArgs.evaluationIntervalMinutes,
    ...resolveSharedLaunchRequestOptions(args),
    maxActions: resolveOptionalNumber(args["max-actions"], "max actions") ?? environment.createGame.maxActions,
    autoRetryEnabled: resolveOptionalBooleanArg(args, "auto-retry-enabled", ["GAME_LAUNCH_AUTO_RETRY_ENABLED"]) ?? true,
    autoRetryIntervalMinutes:
      resolveOptionalNumber(
        args["auto-retry-interval-minutes"] || process.env.GAME_LAUNCH_AUTO_RETRY_INTERVAL_MINUTES,
        "auto retry interval minutes",
      ) ?? undefined,
  };
}

export function buildLaunchRequest(args: Args): LaunchGameRequest | LaunchSeriesRequest | LaunchRotationRequest {
  switch (resolveLaunchKind(args)) {
    case "series":
      return buildLaunchSeriesRequest(args);
    case "rotation":
      return buildLaunchRotationRequest(args);
    case "game":
    default:
      return buildLaunchGameRequest(args);
  }
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

export function buildFactorySeriesRunRequestContext(
  args: Args,
  requestedLaunchStep: SeriesLaunchWorkflowScope,
): FactorySeriesRunRequestContext {
  const request = buildLaunchSeriesRequest(args);

  return {
    environmentId: request.environmentId,
    seriesName: request.seriesName,
    requestedLaunchStep,
    request,
  };
}

export function buildFactoryRotationRunRequestContext(
  args: Args,
  requestedLaunchStep: RotationLaunchWorkflowScope,
): FactoryRotationRunRequestContext {
  const request = buildLaunchRotationRequest(args);

  return {
    environmentId: request.environmentId,
    rotationName: request.rotationName,
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
    case "sync-paymaster":
      return value;
    default:
      throw new Error(
        `Unsupported launch step "${value}". Expected one of: create-world, wait-for-factory-index, configure-world, grant-lootchest-role, grant-village-pass-role, create-banks, create-indexer, sync-paymaster`,
      );
  }
}

export function resolveLaunchSeriesStepId(value?: string): LaunchSeriesStepId {
  switch (value) {
    case "create-series":
    case "create-worlds":
    case "wait-for-factory-indexes":
    case "configure-worlds":
    case "grant-lootchest-roles":
    case "grant-village-pass-roles":
    case "create-banks":
    case "create-indexers":
    case "sync-paymaster":
      return value;
    default:
      throw new Error(
        `Unsupported series launch step "${value}". Expected one of: create-series, create-worlds, wait-for-factory-indexes, configure-worlds, grant-lootchest-roles, grant-village-pass-roles, create-banks, create-indexers, sync-paymaster`,
      );
  }
}

export function resolveLaunchRotationStepId(value?: string): LaunchRotationStepId {
  return resolveLaunchSeriesStepId(value);
}

export function resolveLaunchWorkflowScope(value?: string): LaunchWorkflowScope {
  if (value === undefined || value === "full") {
    return "full";
  }

  return resolveLaunchGameStepId(value);
}

export function resolveSeriesLaunchWorkflowScope(value?: string): SeriesLaunchWorkflowScope {
  if (value === undefined || value === "full") {
    return "full";
  }

  return resolveLaunchSeriesStepId(value);
}

export function resolveRotationLaunchWorkflowScope(value?: string): RotationLaunchWorkflowScope {
  if (value === undefined || value === "full") {
    return "full";
  }

  return resolveLaunchRotationStepId(value);
}
