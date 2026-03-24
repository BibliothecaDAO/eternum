import { EternumProvider } from "@bibliothecadao/provider";
import { getGameManifest, getSeasonAddresses, type Chain } from "@contracts";
import { setTimeout as sleep } from "node:timers/promises";
import { Account, shortString } from "starknet";
import { applyDeploymentConfigOverrides, loadEnvironmentConfiguration } from "../config/config-loader";
import { executeConfigSteps } from "../config/executor";
import { resolveFactoryWorldConfigSteps } from "../config/steps";
import {
  DEFAULT_CARTRIDGE_API_BASE,
  DEFAULT_FACTORY_INDEX_POLL_MS,
  DEFAULT_FACTORY_INDEX_TIMEOUT_MS,
  DEFAULT_NAMESPACE,
  DEFAULT_VERSION,
  DEFAULT_VRF_PROVIDER_ADDRESS,
} from "../constants";
import { buildDefaultBanks, grantVillagePassRolesToWorldSystems } from "../eternum";
import {
  isEternumDeploymentEnvironment,
  isMainnetDeploymentEnvironment,
  resolveDeploymentEnvironment,
} from "../environment";
import {
  isZeroAddress,
  patchManifestWithFactory,
  resolvePrizeDistributionSystemsAddress,
  resolveFactoryWorldProfile,
  waitForFactoryWorldProfile,
} from "../factory/discovery";
import { ensureSlotIndexerDeployment, resolveIndexerArtifactState } from "../indexing/slot-torii";
import { syncPaymasterPolicy } from "../paymaster";
import { buildLootChestMinterRoleGrantCall, grantRoles, resolveLootChestMinterRoleGrantTarget } from "../role-grants";
import { resolveAccountCredentials } from "../shared/credentials";
import type { GameManifestLike } from "../shared/manifest-types";
import type {
  ConfigStepHooks,
  CreateGameDefaults,
  DeploymentEnvironment,
  FactoryWorldProfile,
  IndexerRequest,
  LaunchGameRequest,
  LaunchGameStepId,
  LaunchGameStepRequest,
  LaunchGameSummary,
} from "../types";
import { loadLaunchSummaryIfPresent, writeLaunchSummary } from "./io";
import { createProgressReporter, formatDuration } from "./progress";
import { parseStartTime, toIsoUtc } from "./time";

type StarknetAccountOptions = ConstructorParameters<typeof Account>[0];
type ProviderSigner = Parameters<EternumProvider["create_banks"]>[0]["signer"];
type LaunchProgress = ReturnType<typeof createProgressReporter>;
type LaunchConfig = ReturnType<typeof applyDeploymentConfigOverrides>;
type LaunchConfigSteps = ReturnType<typeof resolveFactoryWorldConfigSteps>;
type ConfiguredWorldProvider = Pick<EternumProvider, "create_banks"> & EternumProvider;
interface LaunchRuntime {
  progress: LaunchProgress;
  environment: DeploymentEnvironment;
  factoryAddress: string;
  rpcUrl: string;
  startTime: number;
  cartridgeApiBase: string;
  toriiNamespaces: string;
  vrfProviderAddress: string;
  executionMode: NonNullable<LaunchGameRequest["executionMode"]>;
  version: string;
  createGame: CreateGameDefaults;
}

interface LaunchAccountContext {
  accountAddress: string;
  privateKey: string;
  account: Account;
  providerSigner: ProviderSigner;
}

interface ConfiguredWorldContext {
  worldProfile: FactoryWorldProfile;
  patchedManifest: GameManifestLike;
  patchedProvider: ConfiguredWorldProvider;
}

interface PreparedLaunchExecution {
  runtime: LaunchRuntime;
  request: LaunchGameRequest;
  summary: LaunchGameSummary;
  deploymentConfig: LaunchConfig;
  configSteps: LaunchConfigSteps;
}

interface ConfiguredLaunchDependencies {
  accountContext: LaunchAccountContext;
  worldContext: ConfiguredWorldContext;
}

function hasSucceededResumeStep(request: LaunchGameRequest, stepId: LaunchGameStepId): boolean {
  return (request.resumeSteps || []).some((step) => step.id === stepId && step.status === "succeeded");
}

function asProviderSigner(account: Account): ProviderSigner {
  return account as unknown as ProviderSigner;
}

function createAccount(address: string, privateKey: string, chain: Chain, rpcUrl: string, vrfProviderAddress: string) {
  const baseManifest = getGameManifest(chain);
  const provider = new EternumProvider(baseManifest as any, rpcUrl, vrfProviderAddress);
  const account = new Account({
    provider: provider.provider as StarknetAccountOptions["provider"],
    address,
    signer: privateKey,
  });

  return { account, provider };
}

function shortenHash(value: string): string {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function resolveLaunchFactoryAddress(request: LaunchGameRequest, environment: DeploymentEnvironment): string {
  const factoryAddress = request.factoryAddress || environment.factoryAddress;

  if (factoryAddress) {
    return factoryAddress;
  }

  throw new Error(`Factory address is required for ${environment.id}. Set FACTORY_ADDRESS or pass --factory-address.`);
}

function resolveCreateGameSettings(request: LaunchGameRequest, environment: DeploymentEnvironment): CreateGameDefaults {
  return {
    ...environment.createGame,
    maxActions: request.maxActions ?? environment.createGame.maxActions,
  };
}

function createLaunchRuntime(request: LaunchGameRequest, progress: LaunchProgress): LaunchRuntime {
  const environment = resolveDeploymentEnvironment(request.environmentId);

  return {
    progress,
    environment,
    factoryAddress: resolveLaunchFactoryAddress(request, environment),
    rpcUrl: request.rpcUrl || environment.rpcUrl,
    startTime: parseStartTime(request.startTime),
    cartridgeApiBase: request.cartridgeApiBase || DEFAULT_CARTRIDGE_API_BASE,
    toriiNamespaces: request.toriiNamespaces || DEFAULT_NAMESPACE,
    vrfProviderAddress: request.vrfProviderAddress || DEFAULT_VRF_PROVIDER_ADDRESS,
    executionMode: request.executionMode || "batched",
    version: request.version || DEFAULT_VERSION,
    createGame: resolveCreateGameSettings(request, environment),
  };
}

function validateWorldName(worldName: string): void {
  if (!worldName.trim()) {
    throw new Error("Game name is required");
  }

  shortString.encodeShortString(worldName);
}

function logLaunchPreparation(runtime: LaunchRuntime, gameName: string): void {
  runtime.progress.log(`Preparing launch for "${gameName}" on ${runtime.environment.id}`);
}

function resolveLaunchConfiguration(
  runtime: LaunchRuntime,
  request: LaunchGameRequest,
): {
  deploymentConfig: LaunchConfig;
  configSteps: LaunchConfigSteps;
} {
  const baseConfig = loadEnvironmentConfiguration(runtime.environment.id);
  const deploymentConfig = applyDeploymentConfigOverrides(baseConfig, {
    startMainAt: runtime.startTime,
    factoryAddress: runtime.factoryAddress,
    devModeOn: request.devModeOn,
    singleRealmMode: request.singleRealmMode,
    twoPlayerMode: request.twoPlayerMode,
    durationSeconds: request.durationSeconds,
    mapConfigOverrides: request.mapConfigOverrides,
    blitzRegistrationOverrides: request.blitzRegistrationOverrides,
  });
  const configSteps = resolveFactoryWorldConfigSteps({
    environmentId: runtime.environment.id,
    config: deploymentConfig,
  });

  runtime.progress.log(
    `Effective config flags: dev_mode_on=${deploymentConfig.dev?.mode?.on ?? false}, duration_seconds=${
      deploymentConfig.season?.durationSeconds ?? 0
    }, single_realm_mode=${
      deploymentConfig.settlement?.single_realm_mode ?? false
    }, two_player_mode=${deploymentConfig.settlement?.two_player_mode ?? false}`,
  );
  runtime.progress.log(`Resolved ${configSteps.length} config steps for ${runtime.environment.id}`);

  return { deploymentConfig, configSteps };
}

function createLaunchSummary(
  runtime: LaunchRuntime,
  request: LaunchGameRequest,
  deploymentConfig: LaunchConfig,
): LaunchGameSummary {
  return {
    environment: runtime.environment.id,
    chain: runtime.environment.chain,
    gameType: runtime.environment.gameType,
    gameName: request.gameName,
    startTime: runtime.startTime,
    startTimeIso: toIsoUtc(runtime.startTime),
    durationSeconds: deploymentConfig.season?.durationSeconds,
    rpcUrl: runtime.rpcUrl,
    factoryAddress: runtime.factoryAddress,
    indexerCreated: false,
    configMode: runtime.executionMode,
    configSteps: [],
    dryRun: request.dryRun === true,
  };
}

function hydrateExistingLaunchSummary(summary: LaunchGameSummary): LaunchGameSummary {
  const existingSummary = loadLaunchSummaryIfPresent(summary.environment, summary.gameName);
  if (!existingSummary) {
    return summary;
  }

  return {
    ...existingSummary,
    environment: summary.environment,
    chain: summary.chain,
    gameType: summary.gameType,
    gameName: summary.gameName,
    startTime: summary.startTime,
    startTimeIso: summary.startTimeIso,
    durationSeconds: summary.durationSeconds,
    rpcUrl: summary.rpcUrl,
    factoryAddress: summary.factoryAddress,
    configMode: summary.configMode,
    dryRun: summary.dryRun,
    outputPath: summary.outputPath || existingSummary.outputPath,
  };
}

function prepareLaunchExecution(request: LaunchGameRequest): PreparedLaunchExecution {
  const runtime = createLaunchRuntime(request, createProgressReporter());

  validateWorldName(request.gameName);
  logLaunchPreparation(runtime, request.gameName);

  const { deploymentConfig, configSteps } = resolveLaunchConfiguration(runtime, request);

  return {
    runtime,
    request,
    summary: hydrateExistingLaunchSummary(createLaunchSummary(runtime, request, deploymentConfig)),
    deploymentConfig,
    configSteps,
  };
}

function buildIndexerRequest(options: {
  env: string;
  rpcUrl: string;
  namespaces: string;
  worldName: string;
  worldAddress: string;
  workflowFile?: string;
  ref?: string;
}): IndexerRequest {
  return {
    env: options.env,
    rpcUrl: options.rpcUrl,
    namespaces: options.namespaces,
    worldName: options.worldName,
    worldAddress: options.worldAddress,
    tier: "basic",
    workflowFile: options.workflowFile,
    ref: options.ref,
    externalContracts: [],
  };
}

function buildDryRunSummary(execution: PreparedLaunchExecution): LaunchGameSummary {
  execution.runtime.progress.log("Dry run enabled; no transactions will be sent");
  execution.summary.configSteps = execution.configSteps.map((step) => ({
    id: step.id,
    description: step.description,
  }));
  execution.summary.indexerRequest = buildIndexerRequest({
    env: execution.runtime.environment.toriiEnv,
    rpcUrl: execution.runtime.rpcUrl,
    namespaces: execution.runtime.toriiNamespaces,
    worldName: execution.request.gameName,
    worldAddress: "<pending>",
    workflowFile: execution.request.workflowFile,
    ref: execution.request.ref,
  });
  execution.summary.outputPath = writeLaunchSummary(execution.summary);
  execution.runtime.progress.log(`Dry run summary written to ${execution.summary.outputPath}`);
  return execution.summary;
}

function resolveLaunchAccountContext(runtime: LaunchRuntime, request: LaunchGameRequest): LaunchAccountContext {
  const { accountAddress, privateKey } = resolveAccountCredentials({
    accountAddress: request.accountAddress,
    privateKey: request.privateKey,
    fallbackAccountAddress: runtime.environment.accountAddress,
    fallbackPrivateKey: runtime.environment.privateKey,
    context: `environment "${runtime.environment.id}"`,
  });
  const { account } = createAccount(
    accountAddress,
    privateKey,
    runtime.environment.chain as Chain,
    runtime.rpcUrl,
    runtime.vrfProviderAddress,
  );

  return {
    accountAddress,
    privateKey,
    account,
    providerSigner: asProviderSigner(account),
  };
}

async function resolveIndexedWorldContext(
  runtime: LaunchRuntime,
  request: LaunchGameRequest,
): Promise<ConfiguredWorldContext> {
  return createConfiguredWorldContext(runtime, await waitForIndexedWorld(runtime, request));
}

function updateWorldAddress(summary: LaunchGameSummary, worldContext: ConfiguredWorldContext): void {
  summary.worldAddress = worldContext.worldProfile.worldAddress;
}

function updateWorldAddressFromProfile(summary: LaunchGameSummary, worldProfile: FactoryWorldProfile): void {
  summary.worldAddress = worldProfile.worldAddress;
}

async function resolveConfiguredLaunchDependencies(
  execution: PreparedLaunchExecution,
): Promise<ConfiguredLaunchDependencies> {
  const accountContext = resolveLaunchAccountContext(execution.runtime, execution.request);
  const worldContext = await resolveIndexedWorldContext(execution.runtime, execution.request);

  updateWorldAddress(execution.summary, worldContext);

  return { accountContext, worldContext };
}

function buildCreateGameCalldata(runtime: LaunchRuntime, request: LaunchGameRequest): Array<string | number> {
  return [
    shortString.encodeShortString(request.gameName),
    runtime.createGame.maxActions,
    runtime.version,
    request.seriesName ? shortString.encodeShortString(request.seriesName) : "0x0",
    request.seriesGameNumber ?? 0,
  ];
}

function resolveTotalCreateGameSubmissionCount(runtime: LaunchRuntime): number {
  return runtime.createGame.submissionCount * runtime.createGame.retryCount;
}

function buildCreateGameAttemptLabel(attemptNumber: number, totalAttempts: number): string {
  if (totalAttempts === 1) {
    return "create_game";
  }

  return `create_game (${attemptNumber}/${totalAttempts})`;
}

async function submitCreateGameAttempt(
  runtime: LaunchRuntime,
  request: LaunchGameRequest,
  account: Account,
  attemptNumber: number,
  totalAttempts: number,
): Promise<string> {
  const attemptLabel = buildCreateGameAttemptLabel(attemptNumber, totalAttempts);
  const result = await runtime.progress.run(
    attemptLabel,
    () =>
      account.execute({
        contractAddress: runtime.factoryAddress,
        entrypoint: "create_game",
        calldata: buildCreateGameCalldata(runtime, request),
      }),
    {
      start:
        totalAttempts === 1
          ? `Submitting create_game via ${shortenHash(runtime.factoryAddress)}`
          : `Submitting create_game attempt ${attemptNumber}/${totalAttempts} via ${shortenHash(runtime.factoryAddress)}`,
      success: (receipt, elapsedMs) =>
        totalAttempts === 1
          ? `create_game submitted in ${formatDuration(elapsedMs)} (${shortenHash(receipt.transaction_hash)})`
          : `create_game attempt ${attemptNumber}/${totalAttempts} submitted in ${formatDuration(elapsedMs)} (${shortenHash(receipt.transaction_hash)})`,
    },
  );

  return result.transaction_hash;
}

async function waitForCreateGameConfirmation(
  progress: LaunchProgress,
  account: Account,
  transactionHash: string,
  attemptNumber: number,
  totalAttempts: number,
): Promise<void> {
  await progress.run(
    buildCreateGameAttemptLabel(attemptNumber, totalAttempts),
    () => account.waitForTransaction(transactionHash),
    {
      start:
        totalAttempts === 1
          ? `Waiting for create_game confirmation (${shortenHash(transactionHash)})`
          : `Waiting for create_game attempt ${attemptNumber}/${totalAttempts} confirmation (${shortenHash(transactionHash)})`,
      success: (_, elapsedMs) =>
        totalAttempts === 1
          ? `create_game confirmed in ${formatDuration(elapsedMs)}`
          : `create_game attempt ${attemptNumber}/${totalAttempts} confirmed in ${formatDuration(elapsedMs)}`,
    },
  );
}

function shouldWaitBeforeNextCreateGameAttempt(
  attemptNumber: number,
  totalAttempts: number,
  retryDelayMs: number,
): boolean {
  return retryDelayMs > 0 && attemptNumber < totalAttempts;
}

async function waitBeforeNextCreateGameAttempt(
  progress: LaunchProgress,
  attemptNumber: number,
  totalAttempts: number,
  retryDelayMs: number,
): Promise<void> {
  if (!shouldWaitBeforeNextCreateGameAttempt(attemptNumber, totalAttempts, retryDelayMs)) {
    return;
  }

  progress.log(
    `Waiting ${formatDuration(retryDelayMs)} before create_game attempt ${attemptNumber + 1}/${totalAttempts} to avoid nonce issues`,
  );
  await sleep(retryDelayMs);
}

type CreateGameSubmissionResult = {
  existingWorldProfile: FactoryWorldProfile | null;
  lastTransactionHash: string | undefined;
};

async function resolveExistingWorldProfileBeforeCreateGameAttempt(params: {
  runtime: LaunchRuntime;
  request: LaunchGameRequest;
  attemptNumber: number;
  totalAttempts: number;
}): Promise<FactoryWorldProfile | null> {
  const existingWorldProfile = await resolveFactoryWorldProfile(
    params.runtime.environment.chain,
    params.request.gameName,
    params.runtime.cartridgeApiBase,
  );

  if (!existingWorldProfile) {
    return null;
  }

  params.runtime.progress.log(
    `Factory SQL already shows "${params.request.gameName}" at ${shortenHash(
      existingWorldProfile.worldAddress,
    )}. Skipping create_game attempt ${params.attemptNumber}/${params.totalAttempts}`,
  );

  return existingWorldProfile;
}

async function submitCreateGameAttempts(
  runtime: LaunchRuntime,
  request: LaunchGameRequest,
  account: Account,
): Promise<CreateGameSubmissionResult> {
  const totalAttempts = resolveTotalCreateGameSubmissionCount(runtime);
  const retryDelayMs = runtime.createGame.retryDelayMs;
  let lastTransactionHash: string | undefined;

  for (let attemptNumber = 1; attemptNumber <= totalAttempts; attemptNumber += 1) {
    const existingWorldProfile = await resolveExistingWorldProfileBeforeCreateGameAttempt({
      runtime,
      request,
      attemptNumber,
      totalAttempts,
    });

    if (existingWorldProfile) {
      return {
        existingWorldProfile,
        lastTransactionHash,
      };
    }

    lastTransactionHash = await submitCreateGameAttempt(runtime, request, account, attemptNumber, totalAttempts);
    await waitForCreateGameConfirmation(runtime.progress, account, lastTransactionHash, attemptNumber, totalAttempts);
    await waitBeforeNextCreateGameAttempt(runtime.progress, attemptNumber, totalAttempts, retryDelayMs);
  }

  return {
    existingWorldProfile: null,
    lastTransactionHash,
  };
}

function isAlreadyCompletedCreateWorldError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  return /deployment already completed/i.test(message) || /world already registered/i.test(message);
}

async function resolveExistingWorldProfileForCompletedCreateWorld(params: {
  runtime: LaunchRuntime;
  request: LaunchGameRequest;
  error: unknown;
}): Promise<FactoryWorldProfile | null> {
  if (!isAlreadyCompletedCreateWorldError(params.error)) {
    return null;
  }

  params.runtime.progress.log(
    `create_game reported an existing deployment for "${params.request.gameName}". Verifying via factory SQL before continuing`,
  );

  return resolveFactoryWorldProfile(
    params.runtime.environment.chain,
    params.request.gameName,
    params.runtime.cartridgeApiBase,
  );
}

async function waitForIndexedWorld(runtime: LaunchRuntime, request: LaunchGameRequest): Promise<FactoryWorldProfile> {
  return runtime.progress.run(
    "wait for factory SQL indexing",
    () =>
      waitForFactoryWorldProfile({
        chain: runtime.environment.chain,
        worldName: request.gameName,
        cartridgeApiBase: runtime.cartridgeApiBase,
        timeoutMs: request.waitForFactoryIndexTimeoutMs ?? DEFAULT_FACTORY_INDEX_TIMEOUT_MS,
        pollIntervalMs: request.waitForFactoryIndexPollMs ?? DEFAULT_FACTORY_INDEX_POLL_MS,
        onRetry: (attempt, elapsedMs) => {
          runtime.progress.log(
            `Factory SQL still pending for "${request.gameName}" after ${formatDuration(elapsedMs)} (${attempt} polls)`,
          );
        },
      }),
    {
      start: `Waiting for factory SQL to index "${request.gameName}"`,
      success: (profile, elapsedMs) =>
        `Factory SQL indexed "${request.gameName}" in ${formatDuration(elapsedMs)} (${shortenHash(profile.worldAddress)})`,
    },
  );
}

function createConfiguredWorldContext(
  runtime: LaunchRuntime,
  worldProfile: FactoryWorldProfile,
): ConfiguredWorldContext {
  const baseManifest = getGameManifest(runtime.environment.chain as Chain) as GameManifestLike;
  const patchedManifest = patchManifestWithFactory(
    baseManifest,
    worldProfile.worldAddress,
    worldProfile.contractsBySelector,
  );

  return {
    worldProfile,
    patchedManifest,
    patchedProvider: new EternumProvider(patchedManifest as any, runtime.rpcUrl, runtime.vrfProviderAddress),
  };
}

function buildConfigExecutionHooks(progress: LaunchProgress): ConfigStepHooks<EternumProvider> {
  return {
    onStepStart: (step, index, total) => {
      progress.log(`Config step ${index + 1}/${total}: ${step.description}`);
    },
    onStepComplete: (step, index, total, elapsedMs) => {
      progress.log(`Config step ${index + 1}/${total} complete in ${formatDuration(elapsedMs)}: ${step.id}`);
    },
  };
}

function buildConfigExecutionContext(params: {
  deploymentConfig: LaunchConfig;
  account: Account;
  patchedProvider: EternumProvider;
  logger?: SilentConfigLogger | typeof console;
}) {
  return {
    account: params.account,
    provider: params.patchedProvider,
    config: params.deploymentConfig,
    logger: params.logger || console,
  };
}

async function executeWorldConfig(params: {
  runtime: LaunchRuntime;
  request: LaunchGameRequest;
  deploymentConfig: LaunchConfig;
  configSteps: LaunchConfigSteps;
  account: Account;
  patchedProvider: EternumProvider;
  mode: NonNullable<LaunchGameRequest["executionMode"]>;
  startMessage?: string;
  successLabel?: string;
}) {
  return params.runtime.progress.run(
    "configure world",
    () =>
      executeConfigSteps({
        context: buildConfigExecutionContext(params),
        steps: params.configSteps,
        mode: params.mode,
        suppressStepLogs: params.request.verboseConfigLogs !== true,
        hooks: buildConfigExecutionHooks(params.runtime.progress),
      }),
    {
      start: params.startMessage || `Applying ${params.configSteps.length} config steps in ${params.mode} mode`,
      success: (executionResult, elapsedMs) =>
        executionResult.transactionHash
          ? `${params.successLabel || "World configuration completed"} in ${formatDuration(elapsedMs)} (${shortenHash(
              executionResult.transactionHash,
            )})`
          : `${params.successLabel || "World configuration completed"} in ${formatDuration(elapsedMs)}`,
    },
  );
}

async function configureWorld(params: {
  runtime: LaunchRuntime;
  request: LaunchGameRequest;
  deploymentConfig: LaunchConfig;
  configSteps: LaunchConfigSteps;
  account: Account;
  patchedProvider: EternumProvider;
}): Promise<{ transactionHash?: string; steps: LaunchGameSummary["configSteps"] }> {
  const result = await executeWorldConfig({
    ...params,
    mode: params.runtime.executionMode,
  });

  return {
    transactionHash: result.transactionHash,
    steps: result.steps,
  };
}

async function grantLootChestMinterRoleIfNeeded(params: {
  runtime: LaunchRuntime;
  request: LaunchGameRequest;
  deploymentConfig: LaunchConfig;
  patchedManifest: GameManifestLike;
  accountAddress: string;
  privateKey: string;
}): Promise<string | undefined> {
  if (params.request.skipLootChestRoleGrant) {
    params.runtime.progress.log("Skipping loot chest minter role grant");
    return undefined;
  }

  const roleGrantTarget = resolveLootChestMinterRoleGrantTarget({
    chain: params.runtime.environment.chain as Chain,
    config: params.deploymentConfig,
    patchedManifest: params.patchedManifest,
  });
  if (!roleGrantTarget) {
    params.runtime.progress.log("Skipping loot chest minter role grant because no loot chest address was resolved");
    return undefined;
  }

  const roleGrant = await params.runtime.progress.run(
    "grant loot chest minter role",
    () =>
      grantRoles({
        chain: params.runtime.environment.chain,
        calls: [buildLootChestMinterRoleGrantCall(roleGrantTarget)],
        rpcUrl: params.runtime.rpcUrl,
        accountAddress: params.accountAddress,
        privateKey: params.privateKey,
        context: `environment "${params.runtime.environment.id}"`,
        dryRun: params.request.dryRun,
      }),
    {
      start: `Granting loot chest minter role on ${shortenHash(roleGrantTarget.lootChestAddress)}`,
      success: (result, elapsedMs) =>
        `Loot chest role granted in ${formatDuration(elapsedMs)} (${shortenHash(
          (result as { transactionHash?: string }).transactionHash || "unknown",
        )})`,
    },
  );

  return roleGrant.transactionHash;
}

async function grantVillagePassRolesIfNeeded(params: {
  runtime: LaunchRuntime;
  request: LaunchGameRequest;
  accountAddress: string;
  privateKey: string;
}): Promise<string | undefined> {
  if (!isEternumDeploymentEnvironment(params.runtime.environment)) {
    return undefined;
  }

  const result = await params.runtime.progress.run(
    "grant village pass roles",
    () =>
      grantVillagePassRolesToWorldSystems({
        chain: `${params.runtime.environment.chain}.eternum`,
        gameName: params.request.gameName,
        rpcUrl: params.runtime.rpcUrl,
        accountAddress: params.accountAddress,
        privateKey: params.privateKey,
        cartridgeApiBase: params.runtime.cartridgeApiBase,
      }),
    {
      start: "Granting village pass roles to realm_internal_systems and village_systems",
      success: (summary, elapsedMs) =>
        summary.transactionHash
          ? `Village pass roles granted in ${formatDuration(elapsedMs)} (${shortenHash(summary.transactionHash)})`
          : `Village pass role grant prepared in ${formatDuration(elapsedMs)}`,
    },
  );

  return result.transactionHash;
}

function shouldSyncPaymaster(runtime: LaunchRuntime): boolean {
  return isMainnetDeploymentEnvironment(runtime.environment);
}

async function syncPaymasterIfNeeded(params: {
  runtime: LaunchRuntime;
  request: LaunchGameRequest;
}): Promise<boolean | undefined> {
  if (!shouldSyncPaymaster(params.runtime)) {
    params.runtime.progress.log("Skipping paymaster sync for non-mainnet environment");
    return undefined;
  }

  const result = await params.runtime.progress.run(
    "sync paymaster",
    () =>
      syncPaymasterPolicy({
        chain: params.runtime.environment.chain,
        gameName: params.request.gameName,
        cartridgeApiBase: params.runtime.cartridgeApiBase,
      }),
    {
      start: "Syncing paymaster policy for the launched world",
      success: (summary, elapsedMs) =>
        summary.updated
          ? `Paymaster policy synced in ${formatDuration(elapsedMs)} (${summary.actionCount} actions)`
          : `Paymaster policy prepared in ${formatDuration(elapsedMs)} (${summary.actionCount} actions)`,
    },
  );

  return result.updated;
}

async function createBanksIfNeeded(params: {
  runtime: LaunchRuntime;
  request: LaunchGameRequest;
  patchedProvider: ConfiguredWorldProvider;
  providerSigner: ProviderSigner;
}): Promise<string | undefined> {
  if (!isEternumDeploymentEnvironment(params.runtime.environment)) {
    params.runtime.progress.log("Bank creation not required for blitz worlds");
    return undefined;
  }

  if (params.request.skipBanks) {
    params.runtime.progress.log("Skipping bank creation");
    return undefined;
  }

  const receipt = await params.runtime.progress.run(
    "create banks",
    () =>
      params.patchedProvider.create_banks({
        signer: params.providerSigner,
        banks: buildDefaultBanks(),
      }),
    {
      start: "Creating six default banks",
      success: (createBanksReceipt, elapsedMs) =>
        `Created banks in ${formatDuration(elapsedMs)} (${shortenHash(
          (createBanksReceipt as { transaction_hash?: string }).transaction_hash || "unknown",
        )})`,
    },
  );

  return (receipt as { transaction_hash?: string }).transaction_hash;
}

async function createIndexerIfNeeded(
  runtime: LaunchRuntime,
  request: LaunchGameRequest,
  worldAddress: string,
): Promise<
  Pick<
    LaunchGameSummary,
    | "indexerCreated"
    | "indexerMode"
    | "indexerTier"
    | "indexerUrl"
    | "indexerVersion"
    | "indexerBranch"
    | "lastIndexerDescribeAt"
    | "indexerRequest"
    | "indexerWorkflowRun"
  >
> {
  if (request.skipIndexer) {
    runtime.progress.log("Skipping indexer creation");
    return { indexerCreated: false };
  }

  const indexerRequest = buildIndexerRequest({
    env: runtime.environment.toriiEnv,
    rpcUrl: runtime.rpcUrl,
    namespaces: runtime.toriiNamespaces,
    worldName: request.gameName,
    worldAddress,
    workflowFile: request.workflowFile,
    ref: request.ref,
  });
  const result = await runtime.progress.run(
    "create indexer",
    async () => ensureSlotIndexerDeployment(indexerRequest, { onProgress: (message) => runtime.progress.log(message) }),
    {
      start: `Creating indexer for ${shortenHash(worldAddress)}`,
      success: (indexerResult, elapsedMs) => {
        const liveTier = indexerResult.liveState.currentTier || indexerResult.requestedTier;
        const liveUrl = indexerResult.liveState.url;
        const outcome = indexerResult.action === "already-live" ? "Indexer already live" : "Indexer deployed via Slot";
        return `${outcome} in ${formatDuration(elapsedMs)} (${liveTier}${liveUrl ? `, ${liveUrl}` : ""})`;
      },
    },
  );
  const liveArtifacts = resolveIndexerArtifactState(result.liveState, {
    fallbackTier: indexerRequest.tier,
  });

  return {
    indexerCreated: liveArtifacts.indexerCreated,
    indexerMode: result.mode,
    indexerTier: liveArtifacts.indexerTier,
    indexerUrl: liveArtifacts.indexerUrl,
    indexerVersion: liveArtifacts.indexerVersion,
    indexerBranch: liveArtifacts.indexerBranch,
    lastIndexerDescribeAt: liveArtifacts.lastIndexerDescribeAt,
    indexerRequest,
    indexerWorkflowRun: undefined,
  };
}

function finalizeLaunchSummary(execution: PreparedLaunchExecution): LaunchGameSummary {
  execution.summary.outputPath = writeLaunchSummary(execution.summary);
  execution.runtime.progress.log(`Launch summary written to ${execution.summary.outputPath}`);
  return execution.summary;
}

async function runCreateWorldStep(
  execution: PreparedLaunchExecution,
  accountContext = resolveLaunchAccountContext(execution.runtime, execution.request),
): Promise<LaunchAccountContext> {
  try {
    const createGameSubmissionResult = await submitCreateGameAttempts(
      execution.runtime,
      execution.request,
      accountContext.account,
    );

    execution.summary.createGameTxHash = createGameSubmissionResult.lastTransactionHash;

    if (createGameSubmissionResult.existingWorldProfile) {
      updateWorldAddressFromProfile(execution.summary, createGameSubmissionResult.existingWorldProfile);
    }
  } catch (error) {
    const existingWorldProfile = await resolveExistingWorldProfileForCompletedCreateWorld({
      runtime: execution.runtime,
      request: execution.request,
      error,
    });

    if (!existingWorldProfile) {
      throw error;
    }

    updateWorldAddressFromProfile(execution.summary, existingWorldProfile);
    execution.runtime.progress.log(
      `Factory SQL already shows "${execution.request.gameName}" at ${shortenHash(
        existingWorldProfile.worldAddress,
      )}. Treating create_game as already completed`,
    );
  }

  return accountContext;
}

async function runWaitForFactoryIndexStep(execution: PreparedLaunchExecution): Promise<ConfiguredWorldContext> {
  const worldContext = await resolveIndexedWorldContext(execution.runtime, execution.request);
  updateWorldAddress(execution.summary, worldContext);
  return worldContext;
}

async function runConfigureWorldStep(
  execution: PreparedLaunchExecution,
  dependencies?: ConfiguredLaunchDependencies,
): Promise<ConfiguredLaunchDependencies> {
  const resolvedDependencies = dependencies ?? (await resolveConfiguredLaunchDependencies(execution));

  if (hasSucceededResumeStep(execution.request, "configure-world")) {
    execution.runtime.progress.log(
      "Skipping configure-world because the stored run already marked world configuration as succeeded",
    );
    return resolvedDependencies;
  }

  const configResult = await configureWorld({
    runtime: execution.runtime,
    request: execution.request,
    deploymentConfig: execution.deploymentConfig,
    configSteps: execution.configSteps,
    account: resolvedDependencies.accountContext.account,
    patchedProvider: resolvedDependencies.worldContext.patchedProvider,
  });

  execution.summary.configureTxHash = configResult.transactionHash;
  execution.summary.configSteps = configResult.steps;

  return resolvedDependencies;
}

async function runGrantLootChestRoleStep(
  execution: PreparedLaunchExecution,
  dependencies?: ConfiguredLaunchDependencies,
): Promise<ConfiguredLaunchDependencies> {
  const resolvedDependencies = dependencies ?? (await resolveConfiguredLaunchDependencies(execution));
  execution.summary.lootChestRoleTxHash = await grantLootChestMinterRoleIfNeeded({
    runtime: execution.runtime,
    request: execution.request,
    deploymentConfig: execution.deploymentConfig,
    patchedManifest: resolvedDependencies.worldContext.patchedManifest,
    accountAddress: resolvedDependencies.accountContext.accountAddress,
    privateKey: resolvedDependencies.accountContext.privateKey,
  });

  return resolvedDependencies;
}

async function runGrantVillagePassRoleStep(
  execution: PreparedLaunchExecution,
  accountContext = resolveLaunchAccountContext(execution.runtime, execution.request),
): Promise<LaunchAccountContext> {
  execution.summary.villagePassRoleTxHash = await grantVillagePassRolesIfNeeded({
    runtime: execution.runtime,
    request: execution.request,
    accountAddress: accountContext.accountAddress,
    privateKey: accountContext.privateKey,
  });

  return accountContext;
}

async function runCreateBanksStep(
  execution: PreparedLaunchExecution,
  dependencies?: ConfiguredLaunchDependencies,
): Promise<ConfiguredLaunchDependencies> {
  const resolvedDependencies = dependencies ?? (await resolveConfiguredLaunchDependencies(execution));
  execution.summary.createBanksTxHash = await createBanksIfNeeded({
    runtime: execution.runtime,
    request: execution.request,
    patchedProvider: resolvedDependencies.worldContext.patchedProvider,
    providerSigner: resolvedDependencies.accountContext.providerSigner,
  });

  return resolvedDependencies;
}

async function runCreateIndexerStep(
  execution: PreparedLaunchExecution,
  worldContext?: ConfiguredWorldContext,
): Promise<ConfiguredWorldContext> {
  const resolvedWorldContext = worldContext ?? (await resolveIndexedWorldContext(execution.runtime, execution.request));
  updateWorldAddress(execution.summary, resolvedWorldContext);
  Object.assign(
    execution.summary,
    await createIndexerIfNeeded(execution.runtime, execution.request, resolvedWorldContext.worldProfile.worldAddress),
  );

  return resolvedWorldContext;
}

async function runSyncPaymasterStep(execution: PreparedLaunchExecution): Promise<void> {
  execution.summary.paymasterSynced = await syncPaymasterIfNeeded({
    runtime: execution.runtime,
    request: execution.request,
  });
}

async function executeLaunchStep(execution: PreparedLaunchExecution, stepId: LaunchGameStepId): Promise<void> {
  switch (stepId) {
    case "create-world":
      await runCreateWorldStep(execution);
      return;
    case "wait-for-factory-index":
      await runWaitForFactoryIndexStep(execution);
      return;
    case "configure-world":
      await runConfigureWorldStep(execution);
      return;
    case "grant-lootchest-role":
      await runGrantLootChestRoleStep(execution);
      return;
    case "grant-village-pass-role":
      await runGrantVillagePassRoleStep(execution);
      return;
    case "create-banks":
      await runCreateBanksStep(execution);
      return;
    case "create-indexer":
      await runCreateIndexerStep(execution);
      return;
    case "sync-paymaster":
      await runSyncPaymasterStep(execution);
      return;
  }
}

export async function runLaunchStep(request: LaunchGameStepRequest): Promise<LaunchGameSummary> {
  const execution = prepareLaunchExecution(request);

  if (request.dryRun) {
    return buildDryRunSummary(execution);
  }

  await executeLaunchStep(execution, request.stepId);
  return finalizeLaunchSummary(execution);
}

export async function launchGame(request: LaunchGameRequest): Promise<LaunchGameSummary> {
  const execution = prepareLaunchExecution(request);

  if (request.dryRun) {
    return buildDryRunSummary(execution);
  }

  const accountContext = await runCreateWorldStep(execution);
  const worldContext = await runWaitForFactoryIndexStep(execution);
  const configuredDependencies = await runConfigureWorldStep(execution, {
    accountContext,
    worldContext,
  });

  await runGrantLootChestRoleStep(execution, configuredDependencies);
  await runGrantVillagePassRoleStep(execution, accountContext);
  await runCreateBanksStep(execution, configuredDependencies);
  await runCreateIndexerStep(execution, worldContext);
  await runSyncPaymasterStep(execution);

  return finalizeLaunchSummary(execution);
}
