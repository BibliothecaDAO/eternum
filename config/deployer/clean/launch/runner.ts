import { setTimeout as sleep } from "node:timers/promises";
import { Account, RpcProvider, shortString } from "starknet";
import { assertProviderChain } from "@realms-world/chain";
import { applyDeploymentConfigOverrides, loadEnvironmentConfiguration } from "../config/config-loader";
import {
  DEFAULT_APPCHAIN_GAME_INDEX_POLL_MS,
  DEFAULT_APPCHAIN_GAME_INDEX_TIMEOUT_MS,
  DEFAULT_APPCHAIN_ETERNUM_PRESET_ID,
  DEFAULT_APPCHAIN_PRESET_ID,
  DEFAULT_MADARA_PRESET_ID,
} from "../constants";
import { resolveDeploymentEnvironment } from "../environment";
import {
  createLedgerOperatorAccount,
  createLedgerTreasuryAccount,
  fundLedgerGameToTargetPool,
  openLedgerGame,
  type LedgerTarget,
} from "../ledger/calls";
import {
  assertRegistrarAvailable,
  createRegistrarGame,
  resolveRegistrarEnvironmentId,
  resolveRegistrarWorldAddress,
} from "../registrar/calls";
import { findGameRegistryByName, waitForGameRegistryById } from "../registrar/game-registry";
import { buildCreateGameParams } from "../registrar/preset";
import { resolveAccountCredentials } from "../shared/credentials";
import { requireRpcUrl } from "../shared/rpc";
import type {
  DeploymentEnvironment,
  LaunchGameRequest,
  LaunchGameStepId,
  LaunchGameStepRequest,
  LaunchGameSummary,
} from "../types";
import { loadLaunchSummaryIfPresent, writeLaunchSummary } from "./io";
import { createProgressReporter, formatDuration, type ProgressReporter } from "./progress";
import { parseStartTime, toIsoUtc } from "./time";

type LaunchConfig = ReturnType<typeof applyDeploymentConfigOverrides>;
const LORDS_UNIT = 10n ** 18n;

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
}

function validateGameName(gameName: string): void {
  if (!gameName.trim()) {
    throw new Error("Game name is required");
  }
  shortString.encodeShortString(gameName);
}

function resolveSponsoredPool(request: LaunchGameRequest): bigint | undefined {
  if (request.sponsoredPoolLords === undefined) return undefined;
  if (!/^[1-9][0-9]*$/.test(request.sponsoredPoolLords)) {
    throw new Error("--sponsored-pool-lords must be a positive whole LORDS amount");
  }
  if (!request.lordsAddress) {
    throw new Error("--lords (or LORDS_ADDRESS) is required with --sponsored-pool-lords");
  }
  return BigInt(request.sponsoredPoolLords) * LORDS_UNIT;
}

function resolvePresetId(version: string | undefined, environment: DeploymentEnvironment): number {
  const configuredPresetId =
    version ??
    (environment.chain === "madara"
      ? DEFAULT_MADARA_PRESET_ID
      : environment.gameType === "eternum"
        ? DEFAULT_APPCHAIN_ETERNUM_PRESET_ID
        : DEFAULT_APPCHAIN_PRESET_ID);
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
    presetId: resolvePresetId(request.version, environment),
    progress: createProgressReporter(),
  };
}

function resolveLaunchConfig(runtime: LaunchRuntime, request: LaunchGameRequest): LaunchConfig {
  return applyDeploymentConfigOverrides(loadEnvironmentConfiguration(runtime.environment.id), {
    startMainAt: runtime.startTime,
    factoryAddress: "",
    devModeOn: request.devModeOn,
    singleRealmMode: request.singleRealmMode,
    twoPlayerMode: request.twoPlayerMode,
    durationSeconds: request.durationSeconds,
    pointRegistrationGraceSeconds: request.pointRegistrationGraceSeconds,
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

function hydrateLaunchSummary(summary: LaunchGameSummary): LaunchGameSummary {
  const existing = loadLaunchSummaryIfPresent(summary.environment, summary.gameName);
  return existing
    ? {
        ...existing,
        ...summary,
        gameId: existing.gameId,
        worldAddress: existing.worldAddress,
        createGameTxHash: existing.createGameTxHash,
        openLedgerTxHash: existing.openLedgerTxHash,
        sponsorLedgerTxHash: existing.sponsorLedgerTxHash,
        outputPath: existing.outputPath,
      }
    : summary;
}

function prepareLaunch(request: LaunchGameRequest): PreparedLaunch {
  validateGameName(request.gameName);
  resolveSponsoredPool(request);
  const runtime = createRuntime(request);
  const config = resolveLaunchConfig(runtime, request);
  runtime.progress.log(
    `Preparing registrar game "${request.gameName}" on ${runtime.environment.id} with preset ${runtime.presetId}`,
  );
  return {
    request,
    runtime,
    config,
    summary: hydrateLaunchSummary(createLaunchSummary(runtime, request, config)),
  };
}

function createLaunchAccount(launch: PreparedLaunch): Account {
  const credentials = resolveAccountCredentials({
    accountAddress: launch.request.accountAddress,
    privateKey: launch.request.privateKey,
    fallbackAccountAddress: launch.runtime.environment.accountAddress,
    fallbackPrivateKey: launch.runtime.environment.privateKey,
    context: `environment "${launch.runtime.environment.id}"`,
  });
  return new Account({
    provider: launch.runtime.provider,
    address: credentials.accountAddress,
    signer: credentials.privateKey,
  });
}

async function assertLaunchChainTargets(launch: PreparedLaunch): Promise<void> {
  await assertProviderChain(launch.runtime.provider, launch.runtime.environment.chain, "RPC_URL");
  if (!launch.request.ledgerRpcUrl) return;
  await assertProviderChain(new RpcProvider({ nodeUrl: launch.request.ledgerRpcUrl }), "mainnet", "LEDGER_RPC_URL");
}

function requireLedgerTarget(launch: PreparedLaunch): LedgerTarget {
  if (!launch.request.ledgerAddress || !launch.request.ledgerRpcUrl) {
    throw new Error("--ledger and --ledger-rpc-url (or LEDGER_ADDRESS and LEDGER_RPC_URL) are required");
  }
  return { address: launch.request.ledgerAddress, rpcUrl: launch.request.ledgerRpcUrl };
}

function createLedgerGameTarget(launch: PreparedLaunch) {
  const devModeOn = launch.request.devModeOn ?? launch.config.dev.mode.on;
  if (!launch.request.ledgerAddress && !launch.request.ledgerRpcUrl && devModeOn) {
    return undefined;
  }
  const target = requireLedgerTarget(launch);
  return {
    account: createLedgerOperatorAccount(target, `ledger game "${launch.request.gameName}"`),
    target,
    presetId: launch.runtime.presetId,
    start: launch.runtime.startTime,
    end: launch.runtime.startTime + launch.config.season.durationSeconds,
  };
}

async function ensureLedgerGameOpen(launch: PreparedLaunch, gameId: number): Promise<void> {
  const ledger = createLedgerGameTarget(launch);
  if (!ledger) return;
  const result = await openLedgerGame(ledger.account, ledger.target, gameId, ledger.presetId, ledger.start, ledger.end);
  if (result) launch.summary.openLedgerTxHash = result.transactionHash;
  launch.runtime.progress.log(
    result
      ? `Opened ledger game ${gameId} (${result.transactionHash})`
      : `Ledger game ${gameId} already exists; skipping`,
  );
}

async function ensureSponsoredLedgerPool(launch: PreparedLaunch, gameId: number): Promise<void> {
  const targetPool = resolveSponsoredPool(launch.request);
  if (targetPool === undefined) return;

  const target = requireLedgerTarget(launch);
  const result = await fundLedgerGameToTargetPool(
    createLedgerTreasuryAccount(target, `sponsor ledger game "${launch.request.gameName}"`),
    target,
    launch.request.lordsAddress!,
    gameId,
    targetPool,
  );
  if (result) launch.summary.sponsorLedgerTxHash = result.transactionHash;
  launch.runtime.progress.log(
    result
      ? `Sponsored ledger game ${gameId} to ${launch.request.sponsoredPoolLords} LORDS (${result.transactionHash})`
      : `Ledger game ${gameId} already has the requested sponsored pool; skipping`,
  );
}

function buildRegistrarGameParams(launch: PreparedLaunch) {
  return buildCreateGameParams(launch.config, {
    gameName: launch.request.gameName,
    presetId: launch.runtime.presetId,
    seriesName: launch.request.seriesName,
    seriesGameNumber: launch.request.seriesGameNumber,
    startMainAt: launch.runtime.startTime,
    durationSeconds: launch.config.season.durationSeconds,
    devModeOn: launch.config.dev.mode.on,
    singleRealmMode: launch.config.settlement.single_realm_mode,
    twoPlayerMode: launch.config.settlement.two_player_mode ?? false,
    useMapOverride: Boolean(
      launch.request.mapConfigOverrides && Object.keys(launch.request.mapConfigOverrides).length > 0,
    ),
  });
}

function applyGameIdentity(launch: PreparedLaunch, gameId: number): void {
  const environmentId = resolveRegistrarEnvironmentId(launch.runtime.environment.id);
  launch.summary.gameId = gameId;
  launch.summary.worldAddress = resolveRegistrarWorldAddress(environmentId);
}

async function findExistingGame(launch: PreparedLaunch) {
  try {
    return await findGameRegistryByName(launch.request.gameName, { chain: launch.runtime.environment.chain });
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
  const environmentId = resolveRegistrarEnvironmentId(launch.runtime.environment.id);
  assertRegistrarAvailable(environmentId);

  const existingGame = await findExistingGame(launch);
  if (existingGame) {
    applyGameIdentity(launch, existingGame.gameId);
    await ensureLedgerGameOpen(launch, existingGame.gameId);
    await ensureSponsoredLedgerPool(launch, existingGame.gameId);
    launch.runtime.progress.log(
      `Game "${launch.request.gameName}" already exists as ${existingGame.gameId}; skipping create_game`,
    );
    return;
  }

  const ledger = createLedgerGameTarget(launch);
  const result = await launch.runtime.progress.run(
    "create_game",
    () => createRegistrarGame(createLaunchAccount(launch), buildRegistrarGameParams(launch), environmentId, ledger),
    {
      start: `Creating "${launch.request.gameName}" through the persistent registrar`,
      success: (created, elapsedMs) =>
        `create_game confirmed in ${formatDuration(elapsedMs)} (${created.transactionHash})`,
    },
  );
  launch.summary.createGameTxHash = result.transactionHash;
  launch.summary.openLedgerTxHash = result.openLedgerTxHash;
  const gameId = await resolveCreatedGameId(launch, result.gameId);
  applyGameIdentity(launch, gameId);
  if (!result.gameId) await ensureLedgerGameOpen(launch, gameId);
  await ensureSponsoredLedgerPool(launch, gameId);
}

async function resolveGameId(launch: PreparedLaunch): Promise<number> {
  if (launch.summary.gameId) {
    return launch.summary.gameId;
  }
  const existingGame = await findExistingGame(launch);
  if (!existingGame) {
    throw new Error(`No game id is recorded or present in Herald for "${launch.request.gameName}"`);
  }
  applyGameIdentity(launch, existingGame.gameId);
  return existingGame.gameId;
}

async function waitForGameIndex(launch: PreparedLaunch): Promise<void> {
  const environmentId = resolveRegistrarEnvironmentId(launch.runtime.environment.id);
  assertRegistrarAvailable(environmentId);
  const gameId = await resolveGameId(launch);
  const row = await launch.runtime.progress.run(
    "wait for game indexing",
    () =>
      waitForGameRegistryById({
        gameId,
        chain: launch.runtime.environment.chain,
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

async function executeLaunchStep(launch: PreparedLaunch, stepId: LaunchGameStepId): Promise<void> {
  if (stepId === "create-world") {
    await createGame(launch);
    return;
  }
  if (stepId === "wait-for-factory-index") {
    await waitForGameIndex(launch);
    return;
  }
  throw new Error(`Launch step "${stepId}" is retired; persistent games are configured by their immutable preset`);
}

function finishLaunch(launch: PreparedLaunch): LaunchGameSummary {
  launch.summary.outputPath = writeLaunchSummary(launch.summary);
  launch.runtime.progress.log(`Launch summary written to ${launch.summary.outputPath}`);
  return launch.summary;
}

function finishDryRun(launch: PreparedLaunch): LaunchGameSummary {
  launch.runtime.progress.log("Dry run enabled; no transactions will be sent");
  return finishLaunch(launch);
}

export async function runLaunchStep(request: LaunchGameStepRequest): Promise<LaunchGameSummary> {
  const launch = prepareLaunch(request);
  if (request.dryRun) {
    return finishDryRun(launch);
  }
  await assertLaunchChainTargets(launch);
  await executeLaunchStep(launch, request.stepId);
  return finishLaunch(launch);
}

export async function launchGame(request: LaunchGameRequest): Promise<LaunchGameSummary> {
  const launch = prepareLaunch(request);
  if (request.dryRun) {
    return finishDryRun(launch);
  }
  await assertLaunchChainTargets(launch);
  await createGame(launch);
  await waitForGameIndex(launch);
  return finishLaunch(launch);
}
