import type { LaunchGameRequest, LaunchRotationRequest, LaunchSeriesRequest } from "../types";

type LaunchRequest = LaunchGameRequest | LaunchSeriesRequest | LaunchRotationRequest;
type WorkflowEnvironment = Record<string, string | undefined>;

const WORKFLOW_OVERRIDE_KEYS = [
  "GAME_LAUNCH_AUTO_RETRY_ENABLED",
  "GAME_LAUNCH_AUTO_RETRY_INTERVAL_MINUTES",
  "GAME_LAUNCH_TARGET_GAME_NAMES_JSON",
] as const;

function assignOptionalLaunchOption(launchOptions: Record<string, unknown>, key: string, value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value === "string" && value.length === 0) {
    return;
  }

  launchOptions[key] = value;
}

function buildReplayableLaunchOptions(request: LaunchRequest): Record<string, unknown> {
  const launchOptions: Record<string, unknown> = {};

  assignOptionalLaunchOption(launchOptions, "rpcUrl", request.rpcUrl);
  assignOptionalLaunchOption(launchOptions, "factoryAddress", request.factoryAddress);
  assignOptionalLaunchOption(launchOptions, "accountAddress", request.accountAddress);
  assignOptionalLaunchOption(launchOptions, "devModeOn", request.devModeOn);
  assignOptionalLaunchOption(launchOptions, "singleRealmMode", request.singleRealmMode);
  assignOptionalLaunchOption(launchOptions, "twoPlayerMode", request.twoPlayerMode);
  assignOptionalLaunchOption(launchOptions, "durationSeconds", request.durationSeconds);
  assignOptionalLaunchOption(launchOptions, "mapConfigOverrides", request.mapConfigOverrides);
  assignOptionalLaunchOption(launchOptions, "blitzRegistrationOverrides", request.blitzRegistrationOverrides);
  assignOptionalLaunchOption(launchOptions, "cartridgeApiBase", request.cartridgeApiBase);
  assignOptionalLaunchOption(launchOptions, "toriiNamespaces", request.toriiNamespaces);
  assignOptionalLaunchOption(launchOptions, "vrfProviderAddress", request.vrfProviderAddress);
  assignOptionalLaunchOption(launchOptions, "executionMode", request.executionMode);
  assignOptionalLaunchOption(launchOptions, "verboseConfigLogs", request.verboseConfigLogs);
  assignOptionalLaunchOption(launchOptions, "version", request.version);
  assignOptionalLaunchOption(launchOptions, "maxActions", request.maxActions);
  assignOptionalLaunchOption(launchOptions, "waitForFactoryIndexTimeoutMs", request.waitForFactoryIndexTimeoutMs);
  assignOptionalLaunchOption(launchOptions, "waitForFactoryIndexPollMs", request.waitForFactoryIndexPollMs);
  assignOptionalLaunchOption(launchOptions, "skipIndexer", request.skipIndexer);
  assignOptionalLaunchOption(launchOptions, "skipLootChestRoleGrant", request.skipLootChestRoleGrant);
  assignOptionalLaunchOption(launchOptions, "skipBanks", request.skipBanks);
  assignOptionalLaunchOption(launchOptions, "dryRun", request.dryRun);
  assignOptionalLaunchOption(launchOptions, "workflowFile", request.workflowFile);
  assignOptionalLaunchOption(launchOptions, "ref", request.ref);

  return launchOptions;
}

function parseWorkflowLaunchOptions(rawValue: string): Record<string, unknown> {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    throw new Error("GAME_LAUNCH_OPTIONS_JSON must be valid JSON");
  }

  if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
    throw new Error("GAME_LAUNCH_OPTIONS_JSON must be a JSON object");
  }

  return parsedValue as Record<string, unknown>;
}

function buildWorkflowLaunchOptions(
  request: LaunchRequest,
  currentEnvironment: WorkflowEnvironment,
): Record<string, unknown> {
  const launchOptions = buildReplayableLaunchOptions(request);
  const currentLaunchOptions = currentEnvironment.GAME_LAUNCH_OPTIONS_JSON;

  if (!currentLaunchOptions) {
    return launchOptions;
  }

  return {
    ...launchOptions,
    ...parseWorkflowLaunchOptions(currentLaunchOptions),
  };
}

function buildBaseLaunchWorkflowEnvironment(
  request: LaunchRequest,
  currentEnvironment: WorkflowEnvironment,
): Record<string, string> {
  const environment: Record<string, string> = {
    GAME_LAUNCH_KIND: request.launchKind || "game",
    GAME_LAUNCH_ENVIRONMENT: request.environmentId,
  };

  const launchOptions = buildWorkflowLaunchOptions(request, currentEnvironment);
  if (Object.keys(launchOptions).length > 0) {
    environment.GAME_LAUNCH_OPTIONS_JSON = JSON.stringify(launchOptions);
  }

  return environment;
}

function assignGameWorkflowEnvironment(
  environment: Record<string, string>,
  request: LaunchGameRequest,
): Record<string, string> {
  environment.GAME_LAUNCH_GAME_NAME = request.gameName;
  environment.GAME_LAUNCH_START_TIME = String(request.startTime);
  return environment;
}

function assignSeriesWorkflowEnvironment(
  environment: Record<string, string>,
  request: LaunchSeriesRequest,
): Record<string, string> {
  environment.GAME_LAUNCH_SERIES_NAME = request.seriesName;
  environment.GAME_LAUNCH_SERIES_GAMES_JSON = JSON.stringify(request.games);
  environment.GAME_LAUNCH_AUTO_RETRY_ENABLED = request.autoRetryEnabled === false ? "false" : "true";

  if (request.autoRetryIntervalMinutes !== undefined) {
    environment.GAME_LAUNCH_AUTO_RETRY_INTERVAL_MINUTES = String(request.autoRetryIntervalMinutes);
  }

  if (request.targetGameNames?.length) {
    environment.GAME_LAUNCH_TARGET_GAME_NAMES_JSON = JSON.stringify(request.targetGameNames);
  }

  return environment;
}

function assignRotationWorkflowEnvironment(
  environment: Record<string, string>,
  request: LaunchRotationRequest,
): Record<string, string> {
  environment.GAME_LAUNCH_ROTATION_NAME = request.rotationName;
  environment.GAME_LAUNCH_FIRST_GAME_START_TIME = String(request.firstGameStartTime);
  environment.GAME_LAUNCH_GAME_INTERVAL_MINUTES = String(request.gameIntervalMinutes);
  environment.GAME_LAUNCH_MAX_GAMES = String(request.maxGames);
  environment.GAME_LAUNCH_EVALUATION_INTERVAL_MINUTES = String(request.evaluationIntervalMinutes);
  environment.GAME_LAUNCH_AUTO_RETRY_ENABLED = request.autoRetryEnabled === false ? "false" : "true";

  if (request.advanceWindowGames !== undefined) {
    environment.GAME_LAUNCH_ADVANCE_WINDOW_GAMES = String(request.advanceWindowGames);
  }

  if (request.autoRetryIntervalMinutes !== undefined) {
    environment.GAME_LAUNCH_AUTO_RETRY_INTERVAL_MINUTES = String(request.autoRetryIntervalMinutes);
  }

  if (request.targetGameNames?.length) {
    environment.GAME_LAUNCH_TARGET_GAME_NAMES_JSON = JSON.stringify(request.targetGameNames);
  }

  return environment;
}

function applyWorkflowOverrides(
  environment: Record<string, string>,
  currentEnvironment: WorkflowEnvironment,
): Record<string, string> {
  for (const key of WORKFLOW_OVERRIDE_KEYS) {
    const value = currentEnvironment[key];
    if (value !== undefined && value !== "") {
      environment[key] = value;
    }
  }

  return environment;
}

export function buildLaunchWorkflowEnvironment(
  request: LaunchRequest,
  currentEnvironment: WorkflowEnvironment = process.env,
): Record<string, string> {
  const environment = buildBaseLaunchWorkflowEnvironment(request, currentEnvironment);

  if (request.launchKind === "series") {
    return applyWorkflowOverrides(assignSeriesWorkflowEnvironment(environment, request), currentEnvironment);
  }

  if (request.launchKind === "rotation") {
    return applyWorkflowOverrides(assignRotationWorkflowEnvironment(environment, request), currentEnvironment);
  }

  return assignGameWorkflowEnvironment(environment, request);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function renderLaunchWorkflowEnvironmentExports(request: LaunchRequest): string {
  return Object.entries(buildLaunchWorkflowEnvironment(request))
    .map(([key, value]) => `export ${key}=${shellQuote(value)}`)
    .join("\n");
}
