import { nativePresetForId } from "../../../source/native";
import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/client.gen";
import { buildNativeGameParams, loadNativePresetConfiguration } from "../registrar/native-preset";
import { buildNativePreset } from "../config/native-preset";
import { setTimeout as sleep } from "node:timers/promises";
import { type Account, RpcProvider, shortString } from "starknet";
import { createOperatorAccount } from "../shared/madara-account";
import { assertProviderChain } from "@realms-world/chain";
import { applyDeploymentConfigOverrides } from "../config/config-loader";
import {
  DEFAULT_APPCHAIN_GAME_INDEX_POLL_MS,
  DEFAULT_APPCHAIN_GAME_INDEX_TIMEOUT_MS,
  defaultPresetForEnvironment,
} from "../constants";
import { resolveDeploymentEnvironment } from "../environment";
import {
  assertRegistrarAvailable,
  createRegistrarGame,
  settleBlitzRoster,
  blitzRosterOf,
  findRegistrarGame,
  resolveRegistrarWorldAddress,
} from "../registrar/calls";
import { waitForGameRegistryById } from "../registrar/game-registry";
import { resolveAccountCredentials } from "../shared/credentials";
import { requireRpcUrl } from "../shared/rpc";
import type {
  DeploymentEnvironment,
  LaunchGameRequest,
  LaunchGameStepId,
  LaunchGameStepRequest,
  LaunchGameSummary,
} from "../types";
import { createProgressReporter, formatDuration, type ProgressReporter } from "./progress";
import { fileLaunchRunStore, type LaunchRunStore } from "./run-store";
import { parseStartTime, toIsoUtc } from "./time";

type LaunchConfig = ReturnType<typeof applyDeploymentConfigOverrides>;

interface LaunchRuntime {
  environment: DeploymentEnvironment;
  provider: RpcProvider;
  rpcUrl: string;
  startTime: number;
  presetId: number;
  progress: ProgressReporter;
}

interface PreparedLaunch {
  request: LaunchGameRequest;
  runtime: LaunchRuntime;
  config: LaunchConfig;
  summary: LaunchGameSummary;
  store: LaunchRunStore;
}

function validateGameName(gameName: string): void {
  if (!gameName.trim()) {
    throw new Error("Game name is required");
  }
  shortString.encodeShortString(gameName);
}

function resolvePresetId(version: string): number {
  const configuredPresetId = version;
  const presetId = Number(configuredPresetId);
  if (!Number.isInteger(presetId) || presetId <= 0 || presetId > 0xffff_ffff) {
    throw new Error(`Preset id must be a positive u32, received "${configuredPresetId}"`);
  }
  return presetId;
}

function createRuntime(request: LaunchGameRequest): LaunchRuntime {
  const environment = resolveDeploymentEnvironment(request.environmentId);
  const rpcUrl = requireRpcUrl(request.rpcUrl, "RPC_URL");
  return {
    environment,
    provider: new RpcProvider({ nodeUrl: rpcUrl }),
    rpcUrl,
    startTime: parseStartTime(request.startTime),
    presetId: resolvePresetId(request.version ?? defaultPresetForEnvironment(request.environmentId)),
    progress: createProgressReporter(),
  };
}

function resolveLaunchConfig(runtime: LaunchRuntime, request: LaunchGameRequest): LaunchConfig {
  return applyDeploymentConfigOverrides(loadNativePresetConfiguration(runtime.environment.id, runtime.presetId), {
    startMainAt: runtime.startTime,
    factoryAddress: "",
    devModeOn: request.devModeOn,
    singleRealmMode: request.singleRealmMode,
    twoPlayerMode: request.twoPlayerMode,
    durationSeconds: request.durationSeconds,

    mapConfigOverrides: request.mapConfigOverrides,
    biomeClimateOverrides: request.biomeClimateOverrides,
    blitzRegistrationOverrides: request.blitzRegistrationOverrides,
  });
}

function createLaunchSummary(
  runtime: LaunchRuntime,
  request: LaunchGameRequest,
  config: LaunchConfig,
): LaunchGameSummary {
  return {
    environment: runtime.environment.id,
    chain: runtime.environment.chain,
    gameType: runtime.environment.gameType,
    gameName: request.gameName,
    startTime: runtime.startTime,
    startTimeIso: toIsoUtc(runtime.startTime),
    durationSeconds: config.season?.durationSeconds,
    rpcUrl: runtime.rpcUrl,
    configMode: request.executionMode || "batched",
    configSteps: [],
    dryRun: request.dryRun === true,
  };
}

async function hydrateLaunchSummary(summary: LaunchGameSummary, store: LaunchRunStore): Promise<LaunchGameSummary> {
  const existing = await store.loadGame(summary.environment, summary.gameName);
  return existing
    ? {
        ...existing,
        ...summary,
        gameId: existing.gameId,
        worldAddress: existing.worldAddress,
        createGameTxHash: existing.createGameTxHash,
        outputPath: existing.outputPath,
      }
    : summary;
}

async function prepareLaunch(request: LaunchGameRequest, store: LaunchRunStore): Promise<PreparedLaunch> {
  validateGameName(request.gameName);
  const runtime = createRuntime(request);
  const config = resolveLaunchConfig(runtime, request);
  runtime.progress.log(
    `Preparing registrar game "${request.gameName}" on ${runtime.environment.id} with preset ${runtime.presetId}`,
  );
  return {
    request,
    runtime,
    config,
    summary: await hydrateLaunchSummary(createLaunchSummary(runtime, request, config), store),
    store,
  };
}

function launchCredentials(launch: PreparedLaunch) {
  return resolveAccountCredentials({
    accountAddress: launch.request.accountAddress,
    privateKey: launch.request.privateKey,
    fallbackAccountAddress: launch.runtime.environment.accountAddress,
    fallbackPrivateKey: launch.runtime.environment.privateKey,
    context: `environment "${launch.runtime.environment.id}"`,
  });
}

function createLaunchAccount(launch: PreparedLaunch): Account {
  const credentials = launchCredentials(launch);
  return createOperatorAccount(launch.runtime.provider, credentials.accountAddress, credentials.privateKey);
}

async function assertLaunchChainTargets(launch: PreparedLaunch): Promise<void> {
  await assertProviderChain(launch.runtime.provider, launch.request.manifest, "RPC_URL");
}

async function buildRegistrarGameParams(launch: PreparedLaunch) {
  const accounts = launch.request.rosterAccounts ?? [];
  const fixedRoster = nativePresetForId(launch.runtime.presetId).entryRule === nativeRuleConstants.ENTRY_ROSTER;
  const roster = fixedRoster ? blitzRosterOf(accounts) : [];
  if (!fixedRoster && accounts.length) throw new Error("Eternum does not use a fixed roster");
  const block = await launch.runtime.provider.getBlock("latest");
  return buildNativeGameParams(
    launch.config,
    {
      gameName: launch.request.gameName,
      presetId: launch.runtime.presetId,
      startMainAt: launch.runtime.startTime,
      chainTimestamp: block.timestamp,
      durationSeconds: launch.config.season.durationSeconds,
      devModeOn: launch.config.dev.mode.on,
      singleRealmMode: launch.config.settlement.single_realm_mode,
      twoPlayerMode: launch.config.settlement.two_player_mode ?? false,
      useMapOverride: Boolean(
        launch.request.mapConfigOverrides && Object.keys(launch.request.mapConfigOverrides).length > 0,
      ),
    },
    roster,
  );
}

function applyGameIdentity(launch: PreparedLaunch, gameId: number): void {
  launch.summary.gameId = gameId;
  launch.summary.worldAddress = resolveRegistrarWorldAddress(launch.request.manifest);
}

async function findExistingGame(launch: PreparedLaunch) {
  try {
    return await findRegistrarGame(launch.runtime.provider, launch.request.gameName, launch.request.manifest);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Cannot verify whether game "${launch.request.gameName}" already exists; refusing to submit create_game: ${reason}`,
      { cause: error },
    );
  }
}

async function resolveCreatedGameId(launch: PreparedLaunch, emittedGameId?: number): Promise<number> {
  if (emittedGameId) {
    return emittedGameId;
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt <= DEFAULT_APPCHAIN_GAME_INDEX_TIMEOUT_MS) {
    const game = await findExistingGame(launch);
    if (game) {
      return game.gameId;
    }
    await sleep(DEFAULT_APPCHAIN_GAME_INDEX_POLL_MS);
  }
  throw new Error(`Timed out resolving game id for "${launch.request.gameName}"`);
}

async function createGame(launch: PreparedLaunch): Promise<void> {
  assertRegistrarAvailable(launch.request.manifest);

  const existingGame = await findExistingGame(launch);
  if (existingGame) {
    applyGameIdentity(launch, existingGame.gameId);
    launch.runtime.progress.log(
      `Game "${launch.request.gameName}" already exists as ${existingGame.gameId}; skipping create_game`,
    );
    return;
  }

  const params = await buildRegistrarGameParams(launch);
  const result = await launch.runtime.progress.run(
    "create_game",
    () =>
      createRegistrarGame(
        createLaunchAccount(launch),
        params,
        launch.request.manifest,
        buildNativePreset(
          loadNativePresetConfiguration(launch.runtime.environment.id, launch.runtime.presetId),
          launch.runtime.presetId,
        ),
      ),
    {
      start: `Creating "${launch.request.gameName}" through the persistent registrar`,
      success: (created, elapsedMs) =>
        `create_game confirmed in ${formatDuration(elapsedMs)} (${created.transactionHash})`,
    },
  );
  launch.summary.createGameTxHash = result.transactionHash;
  const gameId = await resolveCreatedGameId(launch, result.gameId);
  applyGameIdentity(launch, gameId);
}

async function resolveGameId(launch: PreparedLaunch): Promise<number> {
  if (launch.summary.gameId) {
    return launch.summary.gameId;
  }
  const existingGame = await findExistingGame(launch);
  if (!existingGame) {
    throw new Error(`No game id is recorded or present in the registrar for "${launch.request.gameName}"`);
  }
  applyGameIdentity(launch, existingGame.gameId);
  return existingGame.gameId;
}

async function waitForGameIndex(launch: PreparedLaunch): Promise<void> {
  assertRegistrarAvailable(launch.request.manifest);
  const gameId = await resolveGameId(launch);
  const row = await launch.runtime.progress.run(
    "wait for game indexing",
    () =>
      waitForGameRegistryById({
        gameId,
        heraldUrl: launch.request.heraldUrl,
        timeoutMs: launch.request.waitForFactoryIndexTimeoutMs ?? DEFAULT_APPCHAIN_GAME_INDEX_TIMEOUT_MS,
        pollIntervalMs: launch.request.waitForFactoryIndexPollMs ?? DEFAULT_APPCHAIN_GAME_INDEX_POLL_MS,
        onRetry: (attempt, elapsedMs) =>
          launch.runtime.progress.log(
            `GameRegistry row ${gameId} is not in Herald after ${formatDuration(elapsedMs)} (${attempt} polls)`,
          ),
      }),
    {
      start: `Waiting for GameRegistry row ${gameId}`,
      success: (_, elapsedMs) => `GameRegistry row ${gameId} reached Herald in ${formatDuration(elapsedMs)}`,
    },
  );
  applyGameIdentity(launch, row.gameId);
}

async function createAndSettleGame(launch: PreparedLaunch): Promise<void> {
  const admissionUrl = launch.request.admissionUrl ?? process.env.ADMISSION_URL;
  const fixedRoster = nativePresetForId(launch.runtime.presetId).entryRule === nativeRuleConstants.ENTRY_ROSTER;
  if (fixedRoster && !admissionUrl) {
    throw new Error("ADMISSION_URL is required for automatic Blitz settlement");
  }
  await createGame(launch);
  if (!fixedRoster) return;
  const settlement = await settleBlitzRoster(
    launch.runtime.provider,
    await resolveGameId(launch),
    launchCredentials(launch),
    launch.request.manifest,
    admissionUrl!,
  );
  launch.summary.finalizeAt = settlement.finalizeAt;
  launch.summary.settlementTransactions = settlement.settlementTransactions;
}

async function executeLaunchStep(launch: PreparedLaunch, stepId: LaunchGameStepId): Promise<void> {
  if (stepId === "create-world") {
    await createAndSettleGame(launch);
    return;
  }
  if (stepId === "wait-for-factory-index") {
    await waitForGameIndex(launch);
    return;
  }
  throw new Error(`Launch step "${stepId}" is retired; persistent games are configured from a preset at creation`);
}

async function finishLaunch(launch: PreparedLaunch): Promise<LaunchGameSummary> {
  const summary = await launch.store.saveGame(launch.summary);
  launch.runtime.progress.log(`Launch summary written to ${summary.outputPath}`);
  return summary;
}

async function finishDryRun(launch: PreparedLaunch): Promise<LaunchGameSummary> {
  launch.runtime.progress.log("Dry run enabled; no transactions will be sent");
  return finishLaunch(launch);
}

export async function runLaunchStep(
  request: LaunchGameStepRequest,
  store: LaunchRunStore = fileLaunchRunStore,
): Promise<LaunchGameSummary> {
  const launch = await prepareLaunch(request, store);
  if (request.dryRun) {
    return finishDryRun(launch);
  }
  await assertLaunchChainTargets(launch);
  await executeLaunchStep(launch, request.stepId);
  return finishLaunch(launch);
}

export async function launchGame(
  request: LaunchGameRequest,
  store: LaunchRunStore = fileLaunchRunStore,
): Promise<LaunchGameSummary> {
  const launch = await prepareLaunch(request, store);
  if (request.dryRun) {
    return finishDryRun(launch);
  }
  await assertLaunchChainTargets(launch);
  await createAndSettleGame(launch);
  await waitForGameIndex(launch);
  return finishLaunch(launch);
}
