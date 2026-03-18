import { EternumProvider } from "@bibliothecadao/provider";
import { getGameManifest, getSeasonAddresses, type Chain } from "@contracts";
import { Account, shortString } from "starknet";
import { applyDeploymentConfigOverrides, loadEnvironmentConfiguration } from "../config/config-loader";
import { executeConfigSteps } from "../config/executor";
import { resolveFactoryWorldConfigSteps } from "../config/steps";
import {
  DEFAULT_CARTRIDGE_API_BASE,
  DEFAULT_FACTORY_INDEX_POLL_MS,
  DEFAULT_FACTORY_INDEX_TIMEOUT_MS,
  DEFAULT_MAX_ACTIONS,
  DEFAULT_NAMESPACE,
  DEFAULT_VERSION,
  DEFAULT_VRF_PROVIDER_ADDRESS,
} from "../constants";
import { buildDefaultBanks, grantVillagePassRoleToRealmInternalSystems } from "../eternum";
import { resolveDeploymentEnvironment } from "../environment";
import {
  isZeroAddress,
  patchManifestWithFactory,
  resolvePrizeDistributionSystemsAddress,
  waitForFactoryWorldProfile,
} from "../factory/discovery";
import { createIndexer } from "../indexing/indexer";
import { resolveAccountCredentials } from "../shared/credentials";
import type { GameManifestLike } from "../shared/manifest-types";
import type {
  ConfigStepHooks,
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
type ConfiguredWorldProvider = Pick<EternumProvider, "grant_collectible_minter_role" | "create_banks"> &
  EternumProvider;

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
  maxActions: number;
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

function asProviderSigner(account: Account): ProviderSigner {
  return account as unknown as ProviderSigner;
}

function createAccount(address: string, privateKey: string, rpcUrl: string, vrfProviderAddress: string) {
  const baseManifest = getGameManifest("slot" as Chain);
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

function createLaunchRuntime(request: LaunchGameRequest, progress: LaunchProgress): LaunchRuntime {
  const environment = resolveDeploymentEnvironment(request.environmentId);

  return {
    progress,
    environment,
    factoryAddress: request.factoryAddress || environment.factoryAddress,
    rpcUrl: request.rpcUrl || environment.rpcUrl,
    startTime: parseStartTime(request.startTime),
    cartridgeApiBase: request.cartridgeApiBase || DEFAULT_CARTRIDGE_API_BASE,
    toriiNamespaces: request.toriiNamespaces || DEFAULT_NAMESPACE,
    vrfProviderAddress: request.vrfProviderAddress || DEFAULT_VRF_PROVIDER_ADDRESS,
    executionMode: request.executionMode || "batched",
    version: request.version || DEFAULT_VERSION,
    maxActions: request.maxActions ?? DEFAULT_MAX_ACTIONS,
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

function createLaunchSummary(runtime: LaunchRuntime, request: LaunchGameRequest): LaunchGameSummary {
  return {
    environment: runtime.environment.id,
    chain: runtime.environment.chain,
    gameType: runtime.environment.gameType,
    gameName: request.gameName,
    startTime: runtime.startTime,
    startTimeIso: toIsoUtc(runtime.startTime),
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
    summary: hydrateExistingLaunchSummary(createLaunchSummary(runtime, request)),
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
    workflowFile: options.workflowFile,
    ref: options.ref,
    externalContracts: [],
  };
}

function buildDryRunSummary(
  execution: PreparedLaunchExecution,
): LaunchGameSummary {
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
  const { account } = createAccount(accountAddress, privateKey, runtime.rpcUrl, runtime.vrfProviderAddress);

  return {
    accountAddress,
    privateKey,
    account,
    providerSigner: asProviderSigner(account),
  };
}

async function resolveIndexedWorldContext(runtime: LaunchRuntime, request: LaunchGameRequest): Promise<ConfiguredWorldContext> {
  return createConfiguredWorldContext(runtime, await waitForIndexedWorld(runtime, request));
}

function updateWorldAddress(summary: LaunchGameSummary, worldContext: ConfiguredWorldContext): void {
  summary.worldAddress = worldContext.worldProfile.worldAddress;
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
    runtime.maxActions,
    runtime.version,
    request.seriesName ? shortString.encodeShortString(request.seriesName) : "0x0",
    request.seriesGameNumber ?? 0,
  ];
}

async function createGame(runtime: LaunchRuntime, request: LaunchGameRequest, account: Account): Promise<string> {
  const result = await runtime.progress.run(
    "create_game",
    () =>
      account.execute({
        contractAddress: runtime.factoryAddress,
        entrypoint: "create_game",
        calldata: buildCreateGameCalldata(runtime, request),
      }),
    {
      start: `Submitting create_game via ${shortenHash(runtime.factoryAddress)}`,
      success: (receipt, elapsedMs) =>
        `create_game submitted in ${formatDuration(elapsedMs)} (${shortenHash(receipt.transaction_hash)})`,
    },
  );

  return result.transaction_hash;
}

async function waitForCreateGameConfirmation(
  progress: LaunchProgress,
  account: Account,
  transactionHash: string,
): Promise<void> {
  await progress.run("wait for create_game confirmation", () => account.waitForTransaction(transactionHash), {
    start: `Waiting for create_game confirmation (${shortenHash(transactionHash)})`,
    success: (_, elapsedMs) => `create_game confirmed in ${formatDuration(elapsedMs)}`,
  });
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

async function configureWorld(params: {
  runtime: LaunchRuntime;
  request: LaunchGameRequest;
  deploymentConfig: LaunchConfig;
  configSteps: LaunchConfigSteps;
  account: Account;
  patchedProvider: EternumProvider;
}): Promise<{ transactionHash?: string; steps: LaunchGameSummary["configSteps"] }> {
  const result = await params.runtime.progress.run(
    "configure world",
    () =>
      executeConfigSteps({
        context: {
          account: params.account,
          provider: params.patchedProvider,
          config: params.deploymentConfig,
          logger: console,
        },
        steps: params.configSteps,
        mode: params.runtime.executionMode,
        suppressStepLogs: params.request.verboseConfigLogs !== true,
        hooks: buildConfigExecutionHooks(params.runtime.progress),
      }),
    {
      start: `Applying ${params.configSteps.length} config steps in ${params.runtime.executionMode} mode`,
      success: (executionResult, elapsedMs) =>
        executionResult.transactionHash
          ? `World configuration completed in ${formatDuration(elapsedMs)} (${shortenHash(executionResult.transactionHash)})`
          : `World configuration completed in ${formatDuration(elapsedMs)}`,
    },
  );

  return {
    transactionHash: result.transactionHash,
    steps: result.steps,
  };
}

function resolveLootChestAddress(chain: Chain, config: LaunchConfig): string | undefined {
  const fromConfig = (config as Record<string, any>)?.blitz?.registration?.collectibles_lootchest_address;
  if (typeof fromConfig === "string" && !isZeroAddress(fromConfig)) {
    return fromConfig;
  }

  const addresses = getSeasonAddresses(chain);
  return addresses["Collectibles: Realms: Loot Chest"] || addresses.lootChests;
}

async function grantLootChestMinterRoleIfNeeded(params: {
  runtime: LaunchRuntime;
  request: LaunchGameRequest;
  deploymentConfig: LaunchConfig;
  patchedManifest: GameManifestLike;
  patchedProvider: ConfiguredWorldProvider;
  providerSigner: ProviderSigner;
}): Promise<string | undefined> {
  if (params.request.skipLootChestRoleGrant) {
    params.runtime.progress.log("Skipping loot chest minter role grant");
    return undefined;
  }

  const lootChestAddress = resolveLootChestAddress(params.runtime.environment.chain as Chain, params.deploymentConfig);
  if (!lootChestAddress || isZeroAddress(lootChestAddress)) {
    params.runtime.progress.log("Skipping loot chest minter role grant because no loot chest address was resolved");
    return undefined;
  }

  const prizeDistributionSystemsAddress = resolvePrizeDistributionSystemsAddress(params.patchedManifest);
  const receipt = await params.runtime.progress.run(
    "grant loot chest minter role",
    () =>
      params.patchedProvider.grant_collectible_minter_role({
        signer: params.providerSigner,
        collectible_address: lootChestAddress,
        minter_address: prizeDistributionSystemsAddress,
      }),
    {
      start: `Granting loot chest minter role on ${shortenHash(lootChestAddress)}`,
      success: (grantReceipt, elapsedMs) =>
        `Loot chest role granted in ${formatDuration(elapsedMs)} (${shortenHash(
          (grantReceipt as { transaction_hash?: string }).transaction_hash || "unknown",
        )})`,
    },
  );

  return (receipt as { transaction_hash?: string }).transaction_hash;
}

async function grantVillagePassRoleToRealmInternalSystemsIfNeeded(params: {
  runtime: LaunchRuntime;
  request: LaunchGameRequest;
  accountAddress: string;
  privateKey: string;
}): Promise<string | undefined> {
  if (params.runtime.environment.gameType !== "eternum") {
    return undefined;
  }

  const result = await params.runtime.progress.run(
    "grant village pass minter role",
    () =>
      grantVillagePassRoleToRealmInternalSystems({
        chain: `${params.runtime.environment.chain}.eternum`,
        gameName: params.request.gameName,
        rpcUrl: params.runtime.rpcUrl,
        accountAddress: params.accountAddress,
        privateKey: params.privateKey,
        cartridgeApiBase: params.runtime.cartridgeApiBase,
      }),
    {
      start: "Granting village pass MINTER_ROLE to realm_internal_systems",
      success: (summary, elapsedMs) =>
        summary.transactionHash
          ? `Village pass role granted in ${formatDuration(elapsedMs)} (${shortenHash(summary.transactionHash)})`
          : `Village pass role grant prepared in ${formatDuration(elapsedMs)}`,
    },
  );

  return result.transactionHash;
}

async function createBanksIfNeeded(params: {
  runtime: LaunchRuntime;
  request: LaunchGameRequest;
  patchedProvider: ConfiguredWorldProvider;
  providerSigner: ProviderSigner;
}): Promise<string | undefined> {
  if (params.runtime.environment.gameType !== "eternum") {
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
): Promise<Pick<LaunchGameSummary, "indexerCreated" | "indexerMode" | "indexerRequest" | "indexerWorkflowRun">> {
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
    () =>
      createIndexer(indexerRequest, {
        onProgress: (message) => runtime.progress.log(message),
      }),
    {
      start: `Creating indexer for ${shortenHash(worldAddress)}`,
      success: (indexerResult, elapsedMs) =>
        `Indexer workflow succeeded in ${formatDuration(elapsedMs)} (${indexerResult.workflowRun?.htmlUrl || "missing-run-url"})`,
    },
  );

  return {
    indexerCreated: true,
    indexerMode: result.mode,
    indexerRequest,
    indexerWorkflowRun: result.workflowRun,
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
  execution.summary.createGameTxHash = await createGame(execution.runtime, execution.request, accountContext.account);
  await waitForCreateGameConfirmation(
    execution.runtime.progress,
    accountContext.account,
    execution.summary.createGameTxHash,
  );

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
    patchedProvider: resolvedDependencies.worldContext.patchedProvider,
    providerSigner: resolvedDependencies.accountContext.providerSigner,
  });

  return resolvedDependencies;
}

async function runGrantVillagePassRoleStep(
  execution: PreparedLaunchExecution,
  accountContext = resolveLaunchAccountContext(execution.runtime, execution.request),
): Promise<LaunchAccountContext> {
  execution.summary.villagePassRoleTxHash = await grantVillagePassRoleToRealmInternalSystemsIfNeeded({
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

  return finalizeLaunchSummary(execution);
}
