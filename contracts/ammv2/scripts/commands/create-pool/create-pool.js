#!/usr/bin/env node

import { loadNetworkEnvironment } from "../../../../scripts-runtime/js/environment.js";
import { printRuntimeBanner } from "../../../../scripts-runtime/js/output.js";
import { executeContractCalls } from "../../../../scripts-runtime/js/starknet.js";
import { resolveAmmv2DeploymentNetworkName, resolveAmmv2PackageRoot } from "../../support/command.js";
import {
  buildCreatePoolCalls,
  ensureRequiredInputFile,
  loadCreatePoolConfig,
  printPoolAddressSavePlan,
  printPoolCreationPlan,
  resolveConfiguredDeployerAccountAddress,
  resolveCreatePoolCommandInput,
  resolveCreatePoolContext,
  resolvePoolAddressRecords,
  resolvePoolCreationRequests,
  resolveSelectedPoolIds,
  savePoolAddressState,
} from "./support.js";

async function createPools({ accountAddress, poolCreationRequests }) {
  await executeContractCalls({
    accountAddress,
    calls: buildCreatePoolCalls(poolCreationRequests),
    label: "RealmsSwap Factory create pair multicall",
  });
}

const packageRoot = resolveAmmv2PackageRoot(import.meta.url);
const networkName = resolveAmmv2DeploymentNetworkName(process.argv);
const createPoolInput = resolveCreatePoolCommandInput(process.argv.slice(3));
const context = resolveCreatePoolContext(packageRoot, networkName);

ensureRequiredInputFile(context.envFilePath, "network env file");
ensureRequiredInputFile(context.configFilePath, "create-pool config");

printRuntimeBanner("Creating RealmsSwap pool");
loadNetworkEnvironment(context.envFilePath, networkName);

const poolConfig = loadCreatePoolConfig(context.configFilePath);
const accountAddress = resolveConfiguredDeployerAccountAddress(poolConfig);
const selectedPoolIds = resolveSelectedPoolIds(poolConfig, createPoolInput.requestedPoolSelectors);
const poolCreationRequests = await resolvePoolCreationRequests({
  addressesFilePath: context.addressesFilePath,
  factoryAddressOverride: createPoolInput.factoryAddressOverride,
  poolConfig,
  selectedPoolIds,
});

if (poolCreationRequests.length === 0) {
  throw new Error("No pools selected for creation");
}

printPoolCreationPlan(networkName, poolCreationRequests);

await createPools({
  accountAddress,
  poolCreationRequests,
});

const poolAddressRecords = await resolvePoolAddressRecords(poolCreationRequests);
printPoolAddressSavePlan(poolAddressRecords);
await savePoolAddressState({
  networkName,
  poolAddressRecords,
  poolStateFilePath: context.poolStateFilePath,
});
