import { declareContract, deployContract, upgradeContracts } from "./starknet.js";
import { getContractArtifactPaths } from "./artifacts.js";
import { mergeJsonFile, readJsonFileIfExists } from "./files.js";

function getSelectedNetwork() {
  const networkName = process.env.STARKNET_NETWORK;

  if (!networkName) {
    throw new Error("Missing STARKNET_NETWORK");
  }

  return networkName;
}

function getManifestRuntimeConfig(manifest) {
  return manifest.runtimeConfig ?? {};
}

function getTargetStateKey(target) {
  return target.stateKey ?? target.outputKey ?? target.id;
}

function ensureTargetHasId(target, targetKind) {
  if (!target.id) {
    throw new Error(`${targetKind} target is missing id`);
  }

  return target.id;
}

function ensureKnownTargetIds(requestedIds, targetMap, targetKind) {
  for (const targetId of requestedIds) {
    if (!targetMap.has(targetId)) {
      throw new Error(`Unknown ${targetKind} target ${targetId}`);
    }
  }
}

function buildTargetMap(targets, targetKind) {
  const targetMap = new Map();

  for (const target of targets) {
    const targetId = ensureTargetHasId(target, targetKind);

    if (targetMap.has(targetId)) {
      throw new Error(`Duplicate ${targetKind} target id ${targetId}`);
    }

    targetMap.set(targetId, target);
  }

  return targetMap;
}

function parseRequestedTargetIds(value) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRequestedTargetIds(value) {
  if (Array.isArray(value)) {
    return value;
  }

  return parseRequestedTargetIds(value);
}

function getExplicitTargetIds(targets, targetKind, { onlyTargetIds = [], skipTargetIds = [] } = {}) {
  const targetMap = buildTargetMap(targets, targetKind);
  const requestedOnlyIds = normalizeRequestedTargetIds(onlyTargetIds);
  const requestedSkipIds = normalizeRequestedTargetIds(skipTargetIds);

  ensureKnownTargetIds(requestedOnlyIds, targetMap, targetKind);
  ensureKnownTargetIds(requestedSkipIds, targetMap, targetKind);

  for (const targetId of requestedOnlyIds) {
    if (requestedSkipIds.includes(targetId)) {
      throw new Error(`Target ${targetId} can not be both selected and skipped`);
    }
  }

  const orderedIds = targets.map((target) => target.id);
  const skipIdSet = new Set(requestedSkipIds);
  const explicitTargetIds = (requestedOnlyIds.length > 0 ? requestedOnlyIds : orderedIds).filter(
    (targetId) => !skipIdSet.has(targetId),
  );

  if (explicitTargetIds.length === 0) {
    throw new Error(`No ${targetKind} targets selected`);
  }

  return explicitTargetIds;
}

function getDeclarationTargetArtifactPaths(manifest, declarationTarget) {
  return getContractArtifactPaths(manifest.targetDir, manifest.projectName, declarationTarget.artifactName);
}

function buildStatePatch(target, value) {
  return {
    [getTargetStateKey(target)]: value,
  };
}

async function loadManifestState(manifest) {
  return (await readJsonFileIfExists(manifest.addressesFilePath)) ?? {};
}

async function saveManifestState(manifest, nextValues) {
  return mergeJsonFile(manifest.addressesFilePath, {
    network: getSelectedNetwork(),
    updatedAt: new Date().toISOString(),
    ...nextValues,
  });
}

async function applyTargetHook({ hook, hookContext, manifest, state }) {
  if (!hook) {
    return state;
  }

  const hookState =
    (await hook({
      ...hookContext,
      saveState: async (values) => saveManifestState(manifest, values),
      state,
    })) ?? {};

  return {
    ...state,
    ...hookState,
  };
}

async function persistState(manifest, state) {
  await saveManifestState(manifest, state);
  return state;
}

async function runDeclarationTargets({ declarationIds, manifest, runtimeConfig, state }) {
  if (declarationIds.length === 0) {
    return state;
  }

  const declarationTargetMap = buildTargetMap(manifest.declarations ?? [], "declaration");
  const nextState = { ...state };

  for (const declarationId of declarationIds) {
    const declarationTarget = declarationTargetMap.get(declarationId);
    const classHash = await declareContract({
      accountAddress: runtimeConfig.accountAddress,
      artifactPaths: getDeclarationTargetArtifactPaths(manifest, declarationTarget),
      label: declarationTarget.label,
    });

    Object.assign(nextState, buildStatePatch(declarationTarget, classHash));
    const stateWithHook = await applyTargetHook({
      hook: declarationTarget.afterDeclare,
      hookContext: {
        declarationTarget,
        declaredClassHash: classHash,
        runtimeConfig,
      },
      manifest,
      state: nextState,
    });

    Object.assign(nextState, stateWithHook);
    await persistState(manifest, nextState);
  }

  return nextState;
}

function collectRequiredDeclarationIds(targets) {
  const declarationIds = [];
  const seenIds = new Set();

  for (const target of targets) {
    for (const declarationId of target.declarationIds ?? []) {
      if (!seenIds.has(declarationId)) {
        seenIds.add(declarationId);
        declarationIds.push(declarationId);
      }
    }
  }

  return declarationIds;
}

function resolveDependencyExecutionPlan({ explicitTargetIds, previousState, targets, targetKind }) {
  const targetMap = buildTargetMap(targets, targetKind);
  const explicitIdSet = new Set(explicitTargetIds);
  const resolvedPlanIds = [];
  const visitingIds = new Set();
  const resolvedIdSet = new Set();

  function visit(targetId) {
    if (resolvedIdSet.has(targetId)) {
      return;
    }

    if (visitingIds.has(targetId)) {
      throw new Error(`Circular ${targetKind} dependency detected at ${targetId}`);
    }

    const target = targetMap.get(targetId);

    if (!target) {
      throw new Error(`Unknown ${targetKind} target ${targetId}`);
    }

    visitingIds.add(targetId);

    for (const dependencyId of target.dependencyIds ?? []) {
      const dependencyTarget = targetMap.get(dependencyId);

      if (!dependencyTarget) {
        throw new Error(`Unknown ${targetKind} dependency ${dependencyId} for ${targetId}`);
      }

      const dependencyStateKey = getTargetStateKey(dependencyTarget);
      const dependencyAlreadyExists = previousState[dependencyStateKey] !== undefined;
      const dependencyWasExplicitlySelected = explicitIdSet.has(dependencyId);

      if (!dependencyWasExplicitlySelected && dependencyAlreadyExists) {
        continue;
      }

      visit(dependencyId);
    }

    visitingIds.delete(targetId);
    resolvedIdSet.add(targetId);
    resolvedPlanIds.push(targetId);
  }

  for (const targetId of explicitTargetIds) {
    visit(targetId);
  }

  return resolvedPlanIds.map((targetId) => ({
    isExplicit: explicitIdSet.has(targetId),
    target: targetMap.get(targetId),
  }));
}

function requireStateValue(state, stateKey, label) {
  const value = state[stateKey];

  if (value === undefined) {
    throw new Error(`Missing required deployment state for ${label}`);
  }

  return value;
}

function resolveManagedTargetAddresses(target, state, targetKind) {
  if (target.resolveContractAddresses) {
    const addresses = target.resolveContractAddresses({ state });

    if (!Array.isArray(addresses)) {
      throw new Error(`${targetKind} target ${target.id} must resolve to an array of contract addresses`);
    }

    if (addresses.length === 0) {
      throw new Error(`No contract addresses resolved for ${targetKind} target ${target.id}`);
    }

    return addresses;
  }

  const stateKey = target.addressStateKey ?? target.id;
  return [requireStateValue(state, stateKey, `${target.id} ${targetKind} address`)];
}

async function runDeploymentTargets({ deploymentPlan, manifest, runtimeConfig, state }) {
  if (deploymentPlan.length === 0) {
    return state;
  }

  const declarationTargetMap = buildTargetMap(manifest.declarations ?? [], "declaration");
  const nextState = { ...state };

  for (const planEntry of deploymentPlan) {
    const deploymentTarget = planEntry.target;
    const classHashDeclarationTarget = declarationTargetMap.get(deploymentTarget.classHashDeclarationId);

    if (!classHashDeclarationTarget) {
      throw new Error(
        `Unknown declaration target ${deploymentTarget.classHashDeclarationId} for deployment ${deploymentTarget.id}`,
      );
    }

    const classHash = requireStateValue(
      nextState,
      getTargetStateKey(classHashDeclarationTarget),
      `${deploymentTarget.id} class hash`,
    );
    const deployedAddress = await deployContract({
      accountAddress: runtimeConfig.accountAddress,
      classHash,
      constructorCalldata: deploymentTarget.constructorCalldata({
        runtimeConfig,
        state: nextState,
      }),
      label: deploymentTarget.label,
    });

    Object.assign(nextState, buildStatePatch(deploymentTarget, deployedAddress));
    const stateWithHook = await applyTargetHook({
      hook: deploymentTarget.afterDeploy,
      hookContext: {
        deployedAddress,
        deploymentTarget,
        isExplicit: planEntry.isExplicit,
        runtimeConfig,
      },
      manifest,
      state: nextState,
    });

    Object.assign(nextState, stateWithHook);
    await persistState(manifest, nextState);
  }

  return nextState;
}

async function runDeploymentFinalizers({ deploymentPlan, manifest, runtimeConfig, state }) {
  if (deploymentPlan.length === 0) {
    return state;
  }

  const nextState = { ...state };

  for (const planEntry of deploymentPlan) {
    const deploymentTarget = planEntry.target;

    if (!deploymentTarget.finalizeDeployment) {
      continue;
    }

    const deployedAddress = requireStateValue(
      nextState,
      getTargetStateKey(deploymentTarget),
      `${deploymentTarget.id} deployment address`,
    );

    const stateWithHook = await applyTargetHook({
      hook: deploymentTarget.finalizeDeployment,
      hookContext: {
        deployedAddress,
        deploymentTarget,
        isExplicit: planEntry.isExplicit,
        runtimeConfig,
      },
      manifest,
      state: nextState,
    });

    Object.assign(nextState, stateWithHook);
    await persistState(manifest, nextState);
  }

  return nextState;
}

async function runUpgradeTargets({ manifest, runtimeConfig, state, upgradeIds }) {
  if (upgradeIds.length === 0) {
    return state;
  }

  const declarationTargetMap = buildTargetMap(manifest.declarations ?? [], "declaration");
  const upgradeTargetMap = buildTargetMap(manifest.upgrades ?? [], "upgrade");
  const nextState = { ...state };

  for (const upgradeId of upgradeIds) {
    const upgradeTarget = upgradeTargetMap.get(upgradeId);

    if (!upgradeTarget) {
      throw new Error(`Unknown upgrade target ${upgradeId}`);
    }

    const upgradeOperations = upgradeTarget.resolveUpgradeOperations
      ? upgradeTarget.resolveUpgradeOperations({ state: nextState })
      : resolveManagedTargetAddresses(upgradeTarget, nextState, "upgrade").map((contractAddress) => {
          const classHashDeclarationTarget = declarationTargetMap.get(upgradeTarget.classHashDeclarationId);

          if (!classHashDeclarationTarget) {
            throw new Error(
              `Unknown declaration target ${upgradeTarget.classHashDeclarationId} for upgrade ${upgradeTarget.id}`,
            );
          }

          return {
            contractAddress,
            newClassHash: requireStateValue(
              nextState,
              getTargetStateKey(classHashDeclarationTarget),
              `${upgradeTarget.id} upgrade class hash`,
            ),
          };
        });

    await upgradeContracts({
      accountAddress: runtimeConfig.accountAddress,
      label: upgradeTarget.label,
      upgradeOperations,
    });

    const stateWithHook = await applyTargetHook({
      hook: upgradeTarget.afterUpgrade,
      hookContext: {
        runtimeConfig,
        upgradeTarget,
      },
      manifest,
      state: nextState,
    });

    Object.assign(nextState, stateWithHook);
    await persistState(manifest, nextState);
  }

  return nextState;
}

async function runAdminTargets({ adminIds, adminOperation, manifest, runtimeConfig, state }) {
  if (adminIds.length === 0) {
    return state;
  }

  const adminTargetMap = buildTargetMap(manifest.admins ?? [], "admin");
  const nextState = { ...state };

  for (const adminId of adminIds) {
    const adminTarget = adminTargetMap.get(adminId);

    if (!adminTarget) {
      throw new Error(`Unknown admin target ${adminId}`);
    }

    const applyAdminOperation = adminOperation === "grant" ? adminTarget.applyGrantRoles : adminTarget.applyRevokeRoles;

    if (!applyAdminOperation) {
      throw new Error(`Admin target ${adminTarget.id} does not support ${adminOperation} role calls`);
    }

    for (const contractAddress of resolveManagedTargetAddresses(adminTarget, nextState, "admin")) {
      const stateWithHook =
        (await applyAdminOperation({
          adminTarget,
          contractAddress,
          runtimeConfig,
          state: nextState,
        })) ?? {};

      Object.assign(nextState, stateWithHook);
      await persistState(manifest, nextState);
    }
  }

  return nextState;
}

export async function declarePackageContracts(manifest, options = {}) {
  const runtimeConfig = getManifestRuntimeConfig(manifest);
  const previousState = await loadManifestState(manifest);
  const declarationIds = getExplicitTargetIds(manifest.declarations ?? [], "declaration", options);
  return runDeclarationTargets({
    declarationIds,
    manifest,
    runtimeConfig,
    state: previousState,
  });
}

export async function deployPackageContracts(manifest, options = {}) {
  const runtimeConfig = getManifestRuntimeConfig(manifest);
  const previousState = await loadManifestState(manifest);
  const explicitDeploymentIds = getExplicitTargetIds(manifest.deployments ?? [], "deployment", options);
  const deploymentPlan = resolveDependencyExecutionPlan({
    explicitTargetIds: explicitDeploymentIds,
    previousState,
    targets: manifest.deployments ?? [],
    targetKind: "deployment",
  });
  const declarationIds = collectRequiredDeclarationIds(deploymentPlan.map((entry) => entry.target));
  const stateAfterDeclarations = await runDeclarationTargets({
    declarationIds,
    manifest,
    runtimeConfig,
    state: previousState,
  });

  const stateAfterDeployments = await runDeploymentTargets({
    deploymentPlan,
    manifest,
    runtimeConfig,
    state: stateAfterDeclarations,
  });

  return runDeploymentFinalizers({
    deploymentPlan,
    manifest,
    runtimeConfig,
    state: stateAfterDeployments,
  });
}

export async function upgradePackageContracts(manifest, options = {}) {
  const runtimeConfig = getManifestRuntimeConfig(manifest);
  const previousState = await loadManifestState(manifest);
  const upgradeIds = getExplicitTargetIds(manifest.upgrades ?? [], "upgrade", options);
  const upgradeTargetMap = buildTargetMap(manifest.upgrades ?? [], "upgrade");
  const declarationIds = collectRequiredDeclarationIds(upgradeIds.map((upgradeId) => upgradeTargetMap.get(upgradeId)));
  const stateAfterDeclarations = await runDeclarationTargets({
    declarationIds,
    manifest,
    runtimeConfig,
    state: previousState,
  });

  return runUpgradeTargets({
    manifest,
    runtimeConfig,
    state: stateAfterDeclarations,
    upgradeIds,
  });
}

export async function grantRolesForPackageContracts(manifest, options = {}) {
  const runtimeConfig = getManifestRuntimeConfig(manifest);
  const previousState = await loadManifestState(manifest);
  const adminIds = getExplicitTargetIds(manifest.admins ?? [], "admin", options);

  return runAdminTargets({
    adminIds,
    adminOperation: "grant",
    manifest,
    runtimeConfig,
    state: previousState,
  });
}

export async function revokeRolesForPackageContracts(manifest, options = {}) {
  const runtimeConfig = getManifestRuntimeConfig(manifest);
  const previousState = await loadManifestState(manifest);
  const adminIds = getExplicitTargetIds(manifest.admins ?? [], "admin", options);

  return runAdminTargets({
    adminIds,
    adminOperation: "revoke",
    manifest,
    runtimeConfig,
    state: previousState,
  });
}
