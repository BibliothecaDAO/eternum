import path from "node:path";
import { fileURLToPath } from "node:url";
import { hash } from "starknet";
import {
  loadJsonConfigFile,
  requireAddressConfigValue,
  optionalBigIntConfigValue,
  requireBigIntConfigValue,
} from "../../../../scripts-runtime/js/config.js";
import {
  executeContractCall,
  executeContractCalls,
  getSelectedNetworkName,
  toUint256Calldata,
} from "../../../../scripts-runtime/js/starknet.js";

const FACTORY_ROLE_NAMES = new Set(["DEFAULT_ADMIN_ROLE", "FEE_TO_MANAGER_ROLE", "POOL_CREATOR_ROLE", "UPGRADER_ROLE"]);
const PAIR_ROLE_NAMES = new Set(["DEFAULT_ADMIN_ROLE", "UPGRADER_ROLE"]);
const ROUTER_ROLE_NAMES = new Set(["DEFAULT_ADMIN_ROLE", "UPGRADER_ROLE"]);
const FACTORY_POST_DEPLOY_STEP_NAMES = new Set([
  "grantRoles",
  "setFeeTo",
  "setFeeAmountNumeratorAssumeDivIs1000",
  "setPairDefaultAdmin",
  "setPairUpgrader",
  "revokeRoles",
]);
const ROUTER_POST_DEPLOY_STEP_NAMES = new Set(["grantRoles", "revokeRoles"]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.join(__dirname, "..", "..", "..");
const scriptsRoot = path.join(packageRoot, "scripts");
const networkName = getSelectedNetworkName();
const deploymentConfigPath = path.join(__dirname, "config", `${networkName}.json`);
const adminConfigPath = path.join(scriptsRoot, "commands", "admin", "config", `${networkName}.json`);
const deploymentConfig = loadJsonConfigFile(deploymentConfigPath);
const adminConfig = loadJsonConfigFile(adminConfigPath);

function getDeploymentSignerConfig() {
  return deploymentConfig.signer ?? {};
}

function getAdminSignerConfig() {
  return adminConfig.signer ?? {};
}

function getDeploymentContractConfig(contractName) {
  return deploymentConfig.contracts?.[contractName] ?? {};
}

function getAdminContractConfig(contractName) {
  return adminConfig.contracts?.[contractName] ?? {};
}

function getContractDeployPlan(contractName) {
  return getDeploymentContractConfig(contractName).deployContract ?? {};
}

function getContractConstructorConfig(contractName) {
  return getContractDeployPlan(contractName).constructor ?? {};
}

function getContractConstructorCalldataConfig(contractName) {
  return getContractConstructorConfig(contractName).calldata ?? {};
}

function getContractPostDeployActionsConfig(contractName) {
  return getContractDeployPlan(contractName).postDeployActions ?? {};
}

function getContractPostDeployStepConfigs(contractName) {
  return getContractPostDeployActionsConfig(contractName).steps ?? [];
}

function getContractFinalAdminActionsConfig(contractName) {
  return getContractDeployPlan(contractName).finalAdminActions ?? {};
}

function getContractUpgradeConfig(contractName) {
  return deploymentConfig.upgrades?.[contractName] ?? [];
}

function getContractRoleActionConfig(contractName) {
  return getAdminContractConfig(contractName).roleActions ?? {};
}

function resolveConfiguredRuntimeAccountAddress() {
  const deploymentAccountAddress = getDeploymentSignerConfig().accountAddress;
  const adminAccountAddress = getAdminSignerConfig().accountAddress;

  if (
    deploymentAccountAddress !== undefined &&
    adminAccountAddress !== undefined &&
    `${deploymentAccountAddress}`.toLowerCase() !== `${adminAccountAddress}`.toLowerCase()
  ) {
    throw new Error("Deployment and admin signer.accountAddress values must match");
  }

  return requireAddressConfigValue(deploymentAccountAddress ?? adminAccountAddress, "signer.accountAddress");
}

function requireConstructorCalldataParam(contractName, fieldName) {
  return requireBigIntConfigValue(
    getContractConstructorCalldataConfig(contractName)[fieldName],
    `contracts.${contractName}.deployContract.constructor.calldata.${fieldName}`,
  );
}

function requireStateValue(state, stateKey, label) {
  const value = state[stateKey];

  if (value === undefined) {
    throw new Error(`Missing required deployment state for ${label}`);
  }

  return value;
}

function resolveRoleSelector(roleName) {
  if (roleName === "DEFAULT_ADMIN_ROLE") {
    return 0n;
  }

  return BigInt(hash.getSelectorFromName(roleName));
}

function resolveConfiguredAddressList(values, label) {
  if (values === undefined) {
    return [];
  }

  if (!Array.isArray(values)) {
    throw new Error(`${label} must be an array`);
  }

  return values.map((value, index) => requireBigIntConfigValue(value, `${label}[${index}]`));
}

function resolveConfiguredRoleAssignments(rawAssignments, supportedRoleNames, label) {
  const normalizedAssignments = rawAssignments ?? {};

  for (const roleName of Object.keys(normalizedAssignments)) {
    if (!supportedRoleNames.has(roleName)) {
      throw new Error(`Unsupported role ${roleName} in ${label}`);
    }
  }

  const resolvedAssignments = [];

  for (const roleName of supportedRoleNames) {
    const accounts = resolveConfiguredAddressList(normalizedAssignments[roleName], `${label}.${roleName}`);

    for (const account of accounts) {
      resolvedAssignments.push({
        account,
        roleName,
        roleSelector: resolveRoleSelector(roleName),
      });
    }
  }

  return resolvedAssignments;
}

function resolveFinalContractRoleGrants(contractName, supportedRoleNames) {
  return resolveConfiguredRoleAssignments(
    getContractFinalAdminActionsConfig(contractName).grantRoles,
    supportedRoleNames,
    `contracts.${contractName}.deployContract.finalAdminActions.grantRoles`,
  );
}

function resolveFinalContractRoleRevokes(contractName, supportedRoleNames) {
  return resolveConfiguredRoleAssignments(
    getContractFinalAdminActionsConfig(contractName).revokeRoles,
    supportedRoleNames,
    `contracts.${contractName}.deployContract.finalAdminActions.revokeRoles`,
  );
}

function resolveStandaloneContractRoleGrants(contractName, supportedRoleNames) {
  return resolveConfiguredRoleAssignments(
    getContractRoleActionConfig(contractName).grantRoles,
    supportedRoleNames,
    `contracts.${contractName}.roleActions.grantRoles`,
  );
}

function resolveStandaloneContractRoleRevokes(contractName, supportedRoleNames) {
  return resolveConfiguredRoleAssignments(
    getContractRoleActionConfig(contractName).revokeRoles,
    supportedRoleNames,
    `contracts.${contractName}.roleActions.revokeRoles`,
  );
}

function resolveConfiguredAdminAddresses(contractName) {
  return resolveConfiguredAddressList(
    getContractRoleActionConfig(contractName).targetContractAddresses,
    `contracts.${contractName}.roleActions.targetContractAddresses`,
  );
}

function resolveConfiguredUpgradeOperations(contractName) {
  const configuredOperations = getContractUpgradeConfig(contractName);

  if (!Array.isArray(configuredOperations)) {
    throw new Error(`upgrades.${contractName} must be an array`);
  }

  return configuredOperations.map((configuredOperation, index) => ({
    contractAddress: requireBigIntConfigValue(
      configuredOperation.address,
      `upgrades.${contractName}[${index}].address`,
    ),
    newClassHash: requireBigIntConfigValue(
      configuredOperation.toClassHash,
      `upgrades.${contractName}[${index}].toClassHash`,
    ),
  }));
}

function resolvePostDeployStepEntries(contractName, supportedStepNames) {
  const configuredSteps = getContractPostDeployStepConfigs(contractName);

  if (!Array.isArray(configuredSteps)) {
    throw new Error(`contracts.${contractName}.deployContract.postDeployActions.steps must be an array`);
  }

  return configuredSteps.map((configuredStep, index) => {
    if (!configuredStep || typeof configuredStep !== "object" || Array.isArray(configuredStep)) {
      throw new Error(`contracts.${contractName}.deployContract.postDeployActions.steps[${index}] must be an object`);
    }

    const actionNames = Object.keys(configuredStep);

    if (actionNames.length !== 1) {
      throw new Error(
        `contracts.${contractName}.deployContract.postDeployActions.steps[${index}] must contain exactly one action`,
      );
    }

    const actionName = actionNames[0];

    if (!supportedStepNames.has(actionName)) {
      throw new Error(
        `Unsupported postDeployActions step ${actionName} in contracts.${contractName}.deployContract.postDeployActions.steps[${index}]`,
      );
    }

    return {
      actionName,
      actionValue: configuredStep[actionName],
      stepIndex: index,
    };
  });
}

function resolvePostDeployStepRoleAssignments({
  actionName,
  actionValue,
  contractName,
  stepIndex,
  supportedRoleNames,
}) {
  return resolveConfiguredRoleAssignments(
    actionValue,
    supportedRoleNames,
    `contracts.${contractName}.deployContract.postDeployActions.steps[${stepIndex}].${actionName}`,
  );
}

function resolveOptionalUniqueScalarPostDeployStepValue(contractName, stepEntries, actionName) {
  const matchingSteps = stepEntries.filter((stepEntry) => stepEntry.actionName === actionName);

  if (matchingSteps.length === 0) {
    return undefined;
  }

  if (matchingSteps.length > 1) {
    throw new Error(
      `contracts.${contractName}.deployContract.postDeployActions.steps can only contain one ${actionName} step`,
    );
  }

  const matchingStep = matchingSteps[0];
  return optionalBigIntConfigValue(matchingStep.actionValue);
}

function resolveFactoryAdminAddresses({ state }) {
  const configuredAddresses = resolveConfiguredAdminAddresses("factory");
  return configuredAddresses.length > 0
    ? configuredAddresses
    : [requireStateValue(state, "factory", "factory address")];
}

function resolveRouterAdminAddresses({ state }) {
  const configuredAddresses = resolveConfiguredAdminAddresses("router");
  return configuredAddresses.length > 0 ? configuredAddresses : [requireStateValue(state, "router", "router address")];
}

function resolvePairAdminAddresses({ state }) {
  const configuredAddresses = resolveConfiguredAdminAddresses("pair");
  return configuredAddresses.length > 0 ? configuredAddresses : [requireStateValue(state, "pair", "pair address")];
}

async function applyAccessControlRoleCalls({ accountAddress, contractAddress, contractLabel, entrypoint, roleCalls }) {
  if (roleCalls.length === 0) {
    return;
  }

  await executeContractCalls({
    accountAddress,
    calls: roleCalls.map((roleCall) => ({
      calldata: [roleCall.roleSelector, roleCall.account],
      contractAddress,
      entrypoint,
    })),
    label: `${contractLabel} ${entrypoint} multicall`,
  });
}

async function applyGrantRoleCalls({ accountAddress, contractAddress, contractLabel, roleCalls }) {
  await applyAccessControlRoleCalls({
    accountAddress,
    contractAddress,
    contractLabel,
    entrypoint: "grant_role",
    roleCalls,
  });
}

async function applyRevokeRoleCalls({ accountAddress, contractAddress, contractLabel, roleCalls }) {
  await applyAccessControlRoleCalls({
    accountAddress,
    contractAddress,
    contractLabel,
    entrypoint: "revoke_role",
    roleCalls,
  });
}

async function executeFactoryPostDeployStep({ accountAddress, factoryAddress, stepEntry }) {
  const { actionName, actionValue, stepIndex } = stepEntry;

  if (actionName === "grantRoles") {
    await applyGrantRoleCalls({
      accountAddress,
      contractAddress: factoryAddress,
      contractLabel: "RealmsSwap Factory",
      roleCalls: resolvePostDeployStepRoleAssignments({
        actionName,
        actionValue,
        contractName: "factory",
        stepIndex,
        supportedRoleNames: FACTORY_ROLE_NAMES,
      }),
    });
    return;
  }

  if (actionName === "revokeRoles") {
    await applyRevokeRoleCalls({
      accountAddress,
      contractAddress: factoryAddress,
      contractLabel: "RealmsSwap Factory",
      roleCalls: resolvePostDeployStepRoleAssignments({
        actionName,
        actionValue,
        contractName: "factory",
        stepIndex,
        supportedRoleNames: FACTORY_ROLE_NAMES,
      }),
    });
    return;
  }

  if (actionName === "setFeeTo") {
    await executeContractCall({
      accountAddress,
      calldata: [
        requireBigIntConfigValue(
          actionValue,
          `contracts.factory.deployContract.postDeployActions.steps[${stepIndex}].setFeeTo`,
        ),
      ],
      contractAddress: factoryAddress,
      entrypoint: "set_fee_to",
      label: "RealmsSwap Factory fee recipient update",
    });
    return;
  }

  if (actionName === "setFeeAmountNumeratorAssumeDivIs1000") {
    await executeContractCall({
      accountAddress,
      calldata: toUint256Calldata(
        requireBigIntConfigValue(
          actionValue,
          `contracts.factory.deployContract.postDeployActions.steps[${stepIndex}].setFeeAmountNumeratorAssumeDivIs1000`,
        ),
      ),
      contractAddress: factoryAddress,
      entrypoint: "set_fee_amount",
      label: "RealmsSwap Factory fee amount update",
    });
    return;
  }

  if (actionName === "setPairDefaultAdmin") {
    await executeContractCall({
      accountAddress,
      calldata: [
        requireBigIntConfigValue(
          actionValue,
          `contracts.factory.deployContract.postDeployActions.steps[${stepIndex}].setPairDefaultAdmin`,
        ),
      ],
      contractAddress: factoryAddress,
      entrypoint: "set_pair_default_admin",
      label: "RealmsSwap Factory pair default admin update",
    });
    return;
  }

  if (actionName === "setPairUpgrader") {
    await executeContractCall({
      accountAddress,
      calldata: [
        requireBigIntConfigValue(
          actionValue,
          `contracts.factory.deployContract.postDeployActions.steps[${stepIndex}].setPairUpgrader`,
        ),
      ],
      contractAddress: factoryAddress,
      entrypoint: "set_pair_upgrader",
      label: "RealmsSwap Factory pair upgrader update",
    });
    return;
  }

  throw new Error(`Unsupported factory post-deploy step ${actionName}`);
}

async function executeRouterPostDeployStep({ accountAddress, routerAddress, stepEntry }) {
  const { actionName, actionValue, stepIndex } = stepEntry;

  if (actionName === "grantRoles") {
    await applyGrantRoleCalls({
      accountAddress,
      contractAddress: routerAddress,
      contractLabel: "RealmsSwap Router",
      roleCalls: resolvePostDeployStepRoleAssignments({
        actionName,
        actionValue,
        contractName: "router",
        stepIndex,
        supportedRoleNames: ROUTER_ROLE_NAMES,
      }),
    });
    return;
  }

  if (actionName === "revokeRoles") {
    await applyRevokeRoleCalls({
      accountAddress,
      contractAddress: routerAddress,
      contractLabel: "RealmsSwap Router",
      roleCalls: resolvePostDeployStepRoleAssignments({
        actionName,
        actionValue,
        contractName: "router",
        stepIndex,
        supportedRoleNames: ROUTER_ROLE_NAMES,
      }),
    });
    return;
  }

  throw new Error(`Unsupported router post-deploy step ${actionName}`);
}

async function applyFactoryPostDeploy({ deployedAddress, runtimeConfig }) {
  const accountAddress = runtimeConfig.accountAddress;
  const factoryPostDeploySteps = resolvePostDeployStepEntries("factory", FACTORY_POST_DEPLOY_STEP_NAMES);

  for (const stepEntry of factoryPostDeploySteps) {
    await executeFactoryPostDeployStep({
      accountAddress,
      factoryAddress: deployedAddress,
      stepEntry,
    });
  }

  return {
    defaultAdmin: requireConstructorCalldataParam("factory", "defaultAdmin"),
    deployerAccountAddress: resolveConfiguredRuntimeAccountAddress(),
    factoryFeeAmountNumeratorAssumeDivIs1000:
      resolveOptionalUniqueScalarPostDeployStepValue(
        "factory",
        factoryPostDeploySteps,
        "setFeeAmountNumeratorAssumeDivIs1000",
      ) ?? 997n,
    factoryFeeTo: resolveOptionalUniqueScalarPostDeployStepValue("factory", factoryPostDeploySteps, "setFeeTo") ?? 0n,
    pairDefaultAdmin:
      resolveOptionalUniqueScalarPostDeployStepValue("factory", factoryPostDeploySteps, "setPairDefaultAdmin") ??
      requireConstructorCalldataParam("factory", "defaultAdmin"),
    pairUpgrader:
      resolveOptionalUniqueScalarPostDeployStepValue("factory", factoryPostDeploySteps, "setPairUpgrader") ??
      requireConstructorCalldataParam("factory", "upgrader"),
    upgrader: requireConstructorCalldataParam("factory", "upgrader"),
  };
}

async function applyRouterPostDeploy({ deployedAddress, runtimeConfig }) {
  const routerPostDeploySteps = resolvePostDeployStepEntries("router", ROUTER_POST_DEPLOY_STEP_NAMES);

  for (const stepEntry of routerPostDeploySteps) {
    await executeRouterPostDeployStep({
      accountAddress: runtimeConfig.accountAddress,
      routerAddress: deployedAddress,
      stepEntry,
    });
  }

  return {
    routerDefaultAdmin: requireConstructorCalldataParam("router", "defaultAdmin"),
    routerUpgrader: requireConstructorCalldataParam("router", "upgrader"),
  };
}

async function finalizeFactoryDeployment({ deployedAddress, runtimeConfig }) {
  await applyGrantRoleCalls({
    accountAddress: runtimeConfig.accountAddress,
    contractAddress: deployedAddress,
    contractLabel: "RealmsSwap Factory",
    roleCalls: resolveFinalContractRoleGrants("factory", FACTORY_ROLE_NAMES),
  });

  await applyRevokeRoleCalls({
    accountAddress: runtimeConfig.accountAddress,
    contractAddress: deployedAddress,
    contractLabel: "RealmsSwap Factory",
    roleCalls: resolveFinalContractRoleRevokes("factory", FACTORY_ROLE_NAMES),
  });
}

async function finalizeRouterDeployment({ deployedAddress, runtimeConfig }) {
  await applyGrantRoleCalls({
    accountAddress: runtimeConfig.accountAddress,
    contractAddress: deployedAddress,
    contractLabel: "RealmsSwap Router",
    roleCalls: resolveFinalContractRoleGrants("router", ROUTER_ROLE_NAMES),
  });

  await applyRevokeRoleCalls({
    accountAddress: runtimeConfig.accountAddress,
    contractAddress: deployedAddress,
    contractLabel: "RealmsSwap Router",
    roleCalls: resolveFinalContractRoleRevokes("router", ROUTER_ROLE_NAMES),
  });
}

async function applyFactoryGrantRoles({ contractAddress, runtimeConfig }) {
  await applyGrantRoleCalls({
    accountAddress: runtimeConfig.accountAddress,
    contractAddress,
    contractLabel: "RealmsSwap Factory",
    roleCalls: resolveStandaloneContractRoleGrants("factory", FACTORY_ROLE_NAMES),
  });
}

async function applyFactoryRevokeRoles({ contractAddress, runtimeConfig }) {
  await applyRevokeRoleCalls({
    accountAddress: runtimeConfig.accountAddress,
    contractAddress,
    contractLabel: "RealmsSwap Factory",
    roleCalls: resolveStandaloneContractRoleRevokes("factory", FACTORY_ROLE_NAMES),
  });
}

async function applyPairGrantRoles({ contractAddress, runtimeConfig }) {
  await applyGrantRoleCalls({
    accountAddress: runtimeConfig.accountAddress,
    contractAddress,
    contractLabel: "RealmsSwap Pair",
    roleCalls: resolveStandaloneContractRoleGrants("pair", PAIR_ROLE_NAMES),
  });
}

async function applyPairRevokeRoles({ contractAddress, runtimeConfig }) {
  await applyRevokeRoleCalls({
    accountAddress: runtimeConfig.accountAddress,
    contractAddress,
    contractLabel: "RealmsSwap Pair",
    roleCalls: resolveStandaloneContractRoleRevokes("pair", PAIR_ROLE_NAMES),
  });
}

async function applyRouterGrantRoles({ contractAddress, runtimeConfig }) {
  await applyGrantRoleCalls({
    accountAddress: runtimeConfig.accountAddress,
    contractAddress,
    contractLabel: "RealmsSwap Router",
    roleCalls: resolveStandaloneContractRoleGrants("router", ROUTER_ROLE_NAMES),
  });
}

async function applyRouterRevokeRoles({ contractAddress, runtimeConfig }) {
  await applyRevokeRoleCalls({
    accountAddress: runtimeConfig.accountAddress,
    contractAddress,
    contractLabel: "RealmsSwap Router",
    roleCalls: resolveStandaloneContractRoleRevokes("router", ROUTER_ROLE_NAMES),
  });
}

export const contractPackageManifest = {
  admins: [
    {
      applyGrantRoles: applyPairGrantRoles,
      applyRevokeRoles: applyPairRevokeRoles,
      id: "pair",
      label: "RealmsSwap Pair",
      resolveContractAddresses: resolvePairAdminAddresses,
    },
    {
      applyGrantRoles: applyFactoryGrantRoles,
      applyRevokeRoles: applyFactoryRevokeRoles,
      id: "factory",
      label: "RealmsSwap Factory",
      resolveContractAddresses: resolveFactoryAdminAddresses,
    },
    {
      applyGrantRoles: applyRouterGrantRoles,
      applyRevokeRoles: applyRouterRevokeRoles,
      id: "router",
      label: "RealmsSwap Router",
      resolveContractAddresses: resolveRouterAdminAddresses,
    },
  ],
  addressesFilePath: path.join(scriptsRoot, "state", "addresses", `${networkName}.json`),
  declarations: [
    {
      artifactName: "RealmsSwapPair",
      id: "pair",
      label: "RealmsSwap Pair",
      stateKey: "pairClassHash",
    },
    {
      artifactName: "RealmsSwapFactory",
      id: "factory",
      label: "RealmsSwap Factory",
      stateKey: "factoryClassHash",
    },
    {
      artifactName: "RealmsSwapRouter",
      id: "router",
      label: "RealmsSwap Router",
      stateKey: "routerClassHash",
    },
  ],
  deployments: [
    {
      afterDeploy: applyFactoryPostDeploy,
      classHashDeclarationId: "factory",
      constructorCalldata: ({ state }) => [
        requireStateValue(state, "pairClassHash", "pair class hash"),
        requireConstructorCalldataParam("factory", "defaultAdmin"),
        requireConstructorCalldataParam("factory", "upgrader"),
      ],
      declarationIds: ["pair", "factory"],
      dependencyIds: [],
      finalizeDeployment: finalizeFactoryDeployment,
      id: "factory",
      label: "RealmsSwap Factory",
      stateKey: "factory",
    },
    {
      afterDeploy: applyRouterPostDeploy,
      classHashDeclarationId: "router",
      constructorCalldata: ({ state }) => [
        requireStateValue(state, "factory", "factory address"),
        requireConstructorCalldataParam("router", "defaultAdmin"),
        requireConstructorCalldataParam("router", "upgrader"),
      ],
      declarationIds: ["router"],
      dependencyIds: ["factory"],
      finalizeDeployment: finalizeRouterDeployment,
      id: "router",
      label: "RealmsSwap Router",
      stateKey: "router",
    },
  ],
  projectName: "ammv2",
  runtimeConfig: {
    accountAddress: resolveConfiguredRuntimeAccountAddress(),
  },
  targetDir: path.join(packageRoot, "target", "release"),
  upgrades: [
    {
      id: "pair",
      label: "RealmsSwap Pair",
      resolveUpgradeOperations: () => resolveConfiguredUpgradeOperations("pair"),
    },
    {
      id: "factory",
      label: "RealmsSwap Factory",
      resolveUpgradeOperations: () => resolveConfiguredUpgradeOperations("factory"),
    },
    {
      id: "router",
      label: "RealmsSwap Router",
      resolveUpgradeOperations: () => resolveConfiguredUpgradeOperations("router"),
    },
  ],
};

export default contractPackageManifest;
