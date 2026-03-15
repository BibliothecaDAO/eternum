import { getSeasonAddresses, getGameManifest, type Chain } from "@contracts";
import { EternumProvider } from "@bibliothecadao/provider";
import { Account, shortString } from "starknet";
import {
  DEFAULT_CARTRIDGE_API_BASE,
  DEFAULT_FACTORY_INDEX_POLL_MS,
  DEFAULT_FACTORY_INDEX_TIMEOUT_MS,
  DEFAULT_MAX_ACTIONS,
  DEFAULT_NAMESPACE,
  DEFAULT_VRF_PROVIDER_ADDRESS,
  DEFAULT_VERSION,
} from "./constants";
import { buildDefaultBanks } from "./banks";
import { executeConfigSteps } from "./config-executor";
import { loadEnvironmentConfiguration, applyDeploymentConfigOverrides } from "./config-loader";
import { resolveFactoryWorldConfigSteps } from "./config-steps";
import {
  isZeroAddress,
  patchManifestWithFactory,
  resolvePrizeDistributionSystemsAddress,
  waitForFactoryWorldProfile,
} from "./factory-discovery";
import { writeLaunchSummary } from "./io";
import { createIndexer } from "./indexer";
import { resolveDeploymentEnvironment } from "./environment";
import { createProgressReporter, formatDuration } from "./progress";
import { parseStartTime, toIsoUtc } from "./time";
import type { DeploymentEnvironment, IndexerRequest, LaunchGameRequest, LaunchGameSummary } from "./types";

type StarknetAccountOptions = ConstructorParameters<typeof Account>[0];
type ProviderSigner = Parameters<EternumProvider["create_banks"]>[0]["signer"];

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

function resolveLootChestAddress(chain: Chain, config: Record<string, any>): string | undefined {
  const fromConfig = config?.blitz?.registration?.collectibles_lootchest_address;
  if (typeof fromConfig === "string" && !isZeroAddress(fromConfig)) {
    return fromConfig;
  }

  const addresses = getSeasonAddresses(chain);
  return addresses["Collectibles: Realms: Loot Chest"] || addresses.lootChests;
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

function resolveAccountCredentials(
  request: LaunchGameRequest,
  environment: Pick<DeploymentEnvironment, "id" | "accountAddress" | "privateKey">,
) {
  const accountAddress = request.accountAddress || environment.accountAddress;
  const privateKey = request.privateKey || environment.privateKey;

  if (!accountAddress || !privateKey) {
    throw new Error(`Missing account credentials for environment "${environment.id}"`);
  }

  return { accountAddress, privateKey };
}

function validateWorldName(worldName: string): void {
  if (!worldName.trim()) {
    throw new Error("Game name is required");
  }

  shortString.encodeShortString(worldName);
}

export async function launchGame(request: LaunchGameRequest): Promise<LaunchGameSummary> {
  // The runner owns all operator-facing progress so CI output stays predictable.
  const progress = createProgressReporter();
  const environment = resolveDeploymentEnvironment(request.environmentId);
  const factoryAddress = request.factoryAddress || environment.factoryAddress;
  const rpcUrl = request.rpcUrl || environment.rpcUrl;
  const startTime = parseStartTime(request.startTime);
  const cartridgeApiBase = request.cartridgeApiBase || DEFAULT_CARTRIDGE_API_BASE;
  const toriiNamespaces = request.toriiNamespaces || DEFAULT_NAMESPACE;
  const vrfProviderAddress = request.vrfProviderAddress || DEFAULT_VRF_PROVIDER_ADDRESS;
  const executionMode = request.executionMode || "batched";
  const version = request.version || DEFAULT_VERSION;
  const maxActions = request.maxActions ?? DEFAULT_MAX_ACTIONS;

  validateWorldName(request.gameName);
  progress.log(`Preparing launch for "${request.gameName}" on ${environment.id}`);

  const baseConfig = loadEnvironmentConfiguration(environment.id);
  // Apply launch-time values after loading the static environment file so a
  // single config snapshot always represents the real world being created.
  const deploymentConfig = applyDeploymentConfigOverrides(baseConfig, {
    startMainAt: startTime,
    factoryAddress,
    devModeOn: request.devModeOn,
    singleRealmMode: request.singleRealmMode,
    twoPlayerMode: request.twoPlayerMode,
    durationSeconds: request.durationSeconds,
  });
  progress.log(
    `Effective config flags: dev_mode_on=${deploymentConfig.dev?.mode?.on ?? false}, duration_seconds=${
      deploymentConfig.season?.durationSeconds ?? 0
    }, single_realm_mode=${
      deploymentConfig.settlement?.single_realm_mode ?? false
    }, two_player_mode=${deploymentConfig.settlement?.two_player_mode ?? false}`,
  );
  const configSteps = resolveFactoryWorldConfigSteps({
    environmentId: environment.id,
    config: deploymentConfig,
  });
  progress.log(`Resolved ${configSteps.length} config steps for ${environment.id}`);

  const summary: LaunchGameSummary = {
    environment: environment.id,
    chain: environment.chain,
    gameType: environment.gameType,
    gameName: request.gameName,
    startTime,
    startTimeIso: toIsoUtc(startTime),
    rpcUrl,
    factoryAddress,
    indexerCreated: false,
    configMode: executionMode,
    configSteps: [],
    dryRun: request.dryRun === true,
  };

  if (request.dryRun) {
    progress.log("Dry run enabled; no transactions will be sent");
    summary.configSteps = configSteps.map((step) => ({
      id: step.id,
      description: step.description,
    }));
    summary.indexerRequest = buildIndexerRequest({
      env: environment.toriiEnv,
      rpcUrl,
      namespaces: toriiNamespaces,
      worldName: request.gameName,
      worldAddress: "<pending>",
      workflowFile: request.workflowFile,
      ref: request.ref,
    });
    summary.outputPath = writeLaunchSummary(summary);
    progress.log(`Dry run summary written to ${summary.outputPath}`);
    return summary;
  }

  const { accountAddress, privateKey } = resolveAccountCredentials(request, environment);
  const { account } = createAccount(accountAddress, privateKey, rpcUrl, vrfProviderAddress);
  const providerSigner = asProviderSigner(account);

  const seriesNameFelt = request.seriesName ? shortString.encodeShortString(request.seriesName) : "0x0";
  const seriesGameNumber = request.seriesGameNumber ?? 0;
  const createGameResult = await progress.run(
    "create_game",
    () =>
      account.execute({
        contractAddress: factoryAddress,
        entrypoint: "create_game",
        calldata: [shortString.encodeShortString(request.gameName), maxActions, version, seriesNameFelt, seriesGameNumber],
      }),
    {
      start: `Submitting create_game via ${shortenHash(factoryAddress)}`,
      success: (result, elapsedMs) =>
        `create_game submitted in ${formatDuration(elapsedMs)} (${shortenHash(result.transaction_hash)})`,
    },
  );
  summary.createGameTxHash = createGameResult.transaction_hash;
  await progress.run(
    "wait for create_game confirmation",
    () => account.waitForTransaction(createGameResult.transaction_hash),
    {
      start: `Waiting for create_game confirmation (${shortenHash(createGameResult.transaction_hash)})`,
      success: (_, elapsedMs) => `create_game confirmed in ${formatDuration(elapsedMs)}`,
    },
  );

  const worldProfile = await progress.run(
    "wait for factory SQL indexing",
    () =>
      waitForFactoryWorldProfile({
        chain: environment.chain,
        worldName: request.gameName,
        cartridgeApiBase,
        timeoutMs: request.waitForFactoryIndexTimeoutMs ?? DEFAULT_FACTORY_INDEX_TIMEOUT_MS,
        pollIntervalMs: request.waitForFactoryIndexPollMs ?? DEFAULT_FACTORY_INDEX_POLL_MS,
        onRetry: (attempt, elapsedMs) => {
          progress.log(
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
  summary.worldAddress = worldProfile.worldAddress;

  // The manifest returned by the static package still points at the template world.
  // Patch it with the factory-discovered world and contracts before any config calls.
  const baseManifest = getGameManifest(environment.chain as Chain) as Record<string, unknown>;
  const patchedManifest = patchManifestWithFactory(
    baseManifest as any,
    worldProfile.worldAddress,
    worldProfile.contractsBySelector,
  );
  const patchedProvider = new EternumProvider(patchedManifest as any, rpcUrl, vrfProviderAddress);

  const configResult = await progress.run(
    "configure world",
    () =>
      executeConfigSteps({
        context: {
          account,
          provider: patchedProvider,
          config: deploymentConfig,
          logger: console,
        },
        steps: configSteps,
        mode: executionMode,
        suppressStepLogs: request.verboseConfigLogs !== true,
        hooks: {
          onStepStart: (step, index, total) => {
            progress.log(`Config step ${index + 1}/${total}: ${step.description}`);
          },
          onStepComplete: (step, index, total, elapsedMs) => {
            progress.log(`Config step ${index + 1}/${total} complete in ${formatDuration(elapsedMs)}: ${step.id}`);
          },
        },
      }),
    {
      start: `Applying ${configSteps.length} config steps in ${executionMode} mode`,
      success: (result, elapsedMs) =>
        result.transactionHash
          ? `World configuration completed in ${formatDuration(elapsedMs)} (${shortenHash(result.transactionHash)})`
          : `World configuration completed in ${formatDuration(elapsedMs)}`,
    },
  );
  summary.configureTxHash = configResult.transactionHash;
  summary.configSteps = configResult.steps;

  if (!request.skipLootChestRoleGrant) {
    const lootChestAddress = resolveLootChestAddress(environment.chain as Chain, deploymentConfig as any);
    if (lootChestAddress && !isZeroAddress(lootChestAddress)) {
      const prizeDistributionSystemsAddress = resolvePrizeDistributionSystemsAddress(patchedManifest as any);
      const grantRoleReceipt = await progress.run(
        "grant loot chest minter role",
        () =>
          patchedProvider.grant_collectible_minter_role({
            signer: providerSigner,
            collectible_address: lootChestAddress,
            minter_address: prizeDistributionSystemsAddress,
          }),
        {
          start: `Granting loot chest minter role on ${shortenHash(lootChestAddress)}`,
          success: (receipt, elapsedMs) =>
            `Loot chest role granted in ${formatDuration(elapsedMs)} (${shortenHash(
              (receipt as { transaction_hash?: string }).transaction_hash || "unknown",
            )})`,
        },
      );
      summary.lootChestRoleTxHash = (grantRoleReceipt as { transaction_hash?: string }).transaction_hash;
    } else {
      progress.log("Skipping loot chest minter role grant because no loot chest address was resolved");
    }
  } else {
    progress.log("Skipping loot chest minter role grant");
  }

  if (environment.gameType === "eternum" && !request.skipBanks) {
    const createBanksReceipt = await progress.run(
      "create banks",
      () =>
        patchedProvider.create_banks({
          signer: providerSigner,
          banks: buildDefaultBanks(),
        }),
      {
        start: "Creating six default banks",
        success: (receipt, elapsedMs) =>
          `Created banks in ${formatDuration(elapsedMs)} (${shortenHash(
            (receipt as { transaction_hash?: string }).transaction_hash || "unknown",
          )})`,
      },
    );
    summary.createBanksTxHash = (createBanksReceipt as { transaction_hash?: string }).transaction_hash;
  } else if (environment.gameType === "eternum") {
    progress.log("Skipping bank creation");
  } else {
    progress.log("Bank creation not required for blitz worlds");
  }

  if (!request.skipIndexer) {
    const indexerRequest = buildIndexerRequest({
      env: environment.toriiEnv,
      rpcUrl,
      namespaces: toriiNamespaces,
      worldName: request.gameName,
      worldAddress: worldProfile.worldAddress,
      workflowFile: request.workflowFile,
      ref: request.ref,
    });
    const indexerResult = await progress.run(
      "create indexer",
      () =>
        createIndexer(indexerRequest, {
          onProgress: (message) => progress.log(message),
        }),
      {
        start: `Creating indexer for ${shortenHash(worldProfile.worldAddress)}`,
        success: (result, elapsedMs) =>
          `Indexer workflow succeeded in ${formatDuration(elapsedMs)} (${result.workflowRun?.htmlUrl || "missing-run-url"})`,
      },
    );
    summary.indexerCreated = true;
    summary.indexerMode = indexerResult.mode;
    summary.indexerRequest = indexerRequest;
    summary.indexerWorkflowRun = indexerResult.workflowRun;
  } else {
    progress.log("Skipping indexer creation");
  }

  summary.outputPath = writeLaunchSummary(summary);
  progress.log(`Launch summary written to ${summary.outputPath}`);
  return summary;
}
