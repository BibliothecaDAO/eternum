import path from "node:path";
import { loadJsonConfigFile, requireAddressConfigValue } from "../../../../scripts-runtime/js/config.js";
import { readJsonFileIfExists, writeJsonFile } from "../../../../scripts-runtime/js/files.js";
import { printRuntimeStep, printRuntimeValue } from "../../../../scripts-runtime/js/output.js";
import { getProvider } from "../../../../scripts-runtime/js/starknet.js";
import { readNamedArgumentValue } from "../../support/command.js";
import { ensureRequiredInputFile } from "../../support/files.js";

function resolvePositionalCreatePoolSelectors(args) {
  return args.filter((arg, index) => {
    if (arg.startsWith("--")) {
      return false;
    }

    return index === 0 || args[index - 1] !== "--factory";
  });
}

function resolveRequestedPoolSelectors(args) {
  return resolvePositionalCreatePoolSelectors(args)
    .flatMap((selector) => selector.split(","))
    .map((selector) => selector.trim())
    .filter(Boolean);
}

export function resolveCreatePoolCommandInput(args) {
  const requestedPoolSelectors = resolveRequestedPoolSelectors(args);

  if (requestedPoolSelectors.length === 0) {
    throw new Error("Missing pool selector. Usage: create-pool <network> <poolId ... | all> [--factory <address>]");
  }

  return {
    factoryAddressOverride: readNamedArgumentValue(args, "--factory"),
    requestedPoolSelectors,
  };
}

export function resolveCreatePoolContext(packageRoot, networkName) {
  const repoRoot = path.resolve(packageRoot, "..", "..");
  const scriptsRoot = path.join(packageRoot, "scripts");
  const commandRoot = path.join(scriptsRoot, "commands", "create-pool");

  return {
    addressesFilePath: path.join(scriptsRoot, "state", "addresses", `${networkName}.json`),
    configFilePath: path.join(commandRoot, "config", `${networkName}.json`),
    envFilePath: path.join(repoRoot, "contracts", "common", `.env.${networkName}`),
    poolStateFilePath: path.join(scriptsRoot, "state", "pools", `${networkName}.json`),
  };
}

export function loadCreatePoolConfig(configFilePath) {
  return loadJsonConfigFile(configFilePath);
}

export function resolveConfiguredDeployerAccountAddress(config) {
  return requireAddressConfigValue(config.signer?.accountAddress, "signer.accountAddress");
}

export function resolveSelectedPoolIds(poolConfig, requestedPoolSelectors) {
  if (requestedPoolSelectors.length === 1 && requestedPoolSelectors[0].toLowerCase() === "all") {
    return Object.keys(poolConfig.pools ?? {});
  }

  if (requestedPoolSelectors.some((selector) => selector.toLowerCase() === "all")) {
    throw new Error('Use "all" by itself or provide explicit pool ids');
  }

  return [...new Set(requestedPoolSelectors)];
}

function resolveConfiguredPoolDefinition(poolConfig, poolId) {
  const poolDefinition = poolConfig.pools?.[poolId];

  if (!poolDefinition) {
    throw new Error(`Pool ${poolId} not found in create-pool config`);
  }

  return {
    ...poolDefinition,
    factoryAddress: poolDefinition.factoryAddress ?? poolConfig.factoryAddress,
    poolId,
    tokenA: requireAddressConfigValue(poolDefinition.tokenA, `pools.${poolId}.tokenA`),
    tokenB: requireAddressConfigValue(poolDefinition.tokenB, `pools.${poolId}.tokenB`),
  };
}

function resolveConfiguredFallbackFactoryAddress({ deploymentState, factoryAddressOverride }) {
  if (factoryAddressOverride) {
    return factoryAddressOverride;
  }

  const factoryAddress = deploymentState?.factory;

  if (!factoryAddress) {
    throw new Error("Missing deployed factory address in saved state and no --factory override was provided");
  }

  return factoryAddress;
}

function resolvePoolFactoryAddress({ configuredFactoryAddress, fallbackFactoryAddress }) {
  return configuredFactoryAddress || fallbackFactoryAddress;
}

export async function resolvePoolCreationRequests({
  addressesFilePath,
  factoryAddressOverride,
  poolConfig,
  selectedPoolIds,
}) {
  const deploymentState = await readJsonFileIfExists(addressesFilePath);
  const fallbackFactoryAddress = resolveConfiguredFallbackFactoryAddress({
    deploymentState,
    factoryAddressOverride,
  });

  return selectedPoolIds.map((poolId) => {
    const poolDefinition = resolveConfiguredPoolDefinition(poolConfig, poolId);

    return {
      ...poolDefinition,
      factoryAddress: resolvePoolFactoryAddress({
        configuredFactoryAddress: poolDefinition.factoryAddress,
        fallbackFactoryAddress,
      }),
    };
  });
}

export function buildCreatePoolCalls(poolCreationRequests) {
  return poolCreationRequests.map((poolCreationRequest) => ({
    calldata: [poolCreationRequest.tokenA, poolCreationRequest.tokenB],
    contractAddress: poolCreationRequest.factoryAddress,
    entrypoint: "create_pair",
  }));
}

export function printPoolCreationPlan(networkName, poolCreationRequests) {
  printRuntimeStep(`Creating ${poolCreationRequests.length} pool(s) on ${networkName}...`);

  for (const poolCreationRequest of poolCreationRequests) {
    printRuntimeValue(
      `Pool ${poolCreationRequest.poolId}:`,
      `${poolCreationRequest.tokenA} / ${poolCreationRequest.tokenB} via ${poolCreationRequest.factoryAddress}`,
    );
  }
}

async function readPairAddress({ factoryAddress, tokenA, tokenB }) {
  const response = await getProvider().callContract({
    calldata: [tokenA, tokenB],
    contractAddress: factoryAddress,
    entrypoint: "get_pair",
  });

  const pairAddress = Array.isArray(response) ? response[0] : response?.result?.[0];
  return requireAddressConfigValue(pairAddress, "factory.get_pair result");
}

function buildPoolAddressRecord(poolCreationRequest, lpTokenAddress) {
  return {
    factoryAddress: poolCreationRequest.factoryAddress,
    lpTokenAddress,
    poolId: poolCreationRequest.poolId,
    resourceId: poolCreationRequest.resourceId,
    resourceKey: poolCreationRequest.resourceKey,
    tokenA: poolCreationRequest.tokenA,
    tokenB: poolCreationRequest.tokenB,
  };
}

export async function resolvePoolAddressRecords(poolCreationRequests) {
  const poolAddressRecords = [];

  for (const poolCreationRequest of poolCreationRequests) {
    const lpTokenAddress = await readPairAddress(poolCreationRequest);

    poolAddressRecords.push(buildPoolAddressRecord(poolCreationRequest, lpTokenAddress));
  }

  return poolAddressRecords;
}

export function printPoolAddressSavePlan(poolAddressRecords) {
  printRuntimeStep(`Saving ${poolAddressRecords.length} pool LP address record(s)...`);

  for (const poolAddressRecord of poolAddressRecords) {
    printRuntimeValue(`Pool ${poolAddressRecord.poolId}:`, poolAddressRecord.lpTokenAddress);
  }
}

export async function savePoolAddressState({ networkName, poolAddressRecords, poolStateFilePath }) {
  const currentState = (await readJsonFileIfExists(poolStateFilePath)) ?? {};
  const currentPools = currentState.pools ?? {};
  const nextPools = { ...currentPools };

  for (const poolAddressRecord of poolAddressRecords) {
    nextPools[poolAddressRecord.poolId] = {
      ...currentPools[poolAddressRecord.poolId],
      ...poolAddressRecord,
    };
  }

  await writeJsonFile(poolStateFilePath, {
    network: networkName,
    pools: nextPools,
    updatedAt: new Date().toISOString(),
  });
}
