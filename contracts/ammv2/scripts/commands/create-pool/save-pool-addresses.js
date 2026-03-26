#!/usr/bin/env node

import { loadNetworkEnvironment } from "../../../../scripts-runtime/js/environment.js";
import { printRuntimeBanner } from "../../../../scripts-runtime/js/output.js";
import { resolveAmmv2DeploymentNetworkName, resolveAmmv2PackageRoot } from "../../support/command.js";
import {
  ensureRequiredInputFile,
  loadCreatePoolConfig,
  printPoolAddressSavePlan,
  resolveCreatePoolCommandInput,
  resolveCreatePoolContext,
  resolvePoolAddressRecords,
  resolvePoolCreationRequests,
  resolveSelectedPoolIds,
  savePoolAddressState,
} from "./support.js";

const packageRoot = resolveAmmv2PackageRoot(import.meta.url);
const networkName = resolveAmmv2DeploymentNetworkName(process.argv);
const createPoolInput = resolveCreatePoolCommandInput(process.argv.slice(3));
const context = resolveCreatePoolContext(packageRoot, networkName);

ensureRequiredInputFile(context.envFilePath, "network env file");
ensureRequiredInputFile(context.configFilePath, "create-pool config");

printRuntimeBanner("Saving RealmsSwap pool LP addresses");
loadNetworkEnvironment(context.envFilePath, networkName);

const poolConfig = loadCreatePoolConfig(context.configFilePath);
const selectedPoolIds = resolveSelectedPoolIds(poolConfig, createPoolInput.requestedPoolSelectors);
const poolCreationRequests = await resolvePoolCreationRequests({
  addressesFilePath: context.addressesFilePath,
  factoryAddressOverride: createPoolInput.factoryAddressOverride,
  poolConfig,
  selectedPoolIds,
});
const poolAddressRecords = await resolvePoolAddressRecords(poolCreationRequests);

printPoolAddressSavePlan(poolAddressRecords);
await savePoolAddressState({
  networkName,
  poolAddressRecords,
  poolStateFilePath: context.poolStateFilePath,
});
