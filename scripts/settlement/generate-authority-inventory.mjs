import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { hash, shortString } from "starknet";
import {
  authorityCountedHash,
  authorityPoseidon,
  computeAddressInputsCommitment,
  computeAuthoritySchemaCommitments,
  computeDynamicAddressInputsCommitment,
  computeMutationPathsCommitment,
  hashAuthorityDomain,
} from "../../packages/settlement-codec/src/authority-commitments.ts";
import {
  discoverDynamicAddressInputUses,
  isDynamicAddressInputSourcePath,
} from "../../packages/settlement-codec/src/authority-address-discovery.ts";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const outputPath = resolve(repositoryRoot, "packages/settlement-codec/schema/authority-inventory-v1.json");
const shouldCheck = process.argv.includes("--check");
const chains = ["local", "mainnet", "sepolia", "slot", "slottest"];
const chainIds = new Map([
  ["local", "LOCAL"],
  ["mainnet", "SN_MAIN"],
  ["sepolia", "SN_SEPOLIA"],
  ["slot", "WP_SLOT"],
  ["slottest", "WP_SLOTTEST"],
]);
const legacyAliases = new Map([
  ["Collectibles: Realms: Loot Chest", "lootChests"],
  ["Collectibles: Realms: Cosmetic Items", "cosmetics"],
  ["Collectibles: Realms: Elite Invite", "eliteInvite"],
  ["Collectibles: Timelock Maker", "collectiblesTimelock"],
  ["Collectibles: Realms: Blitz Elite Pass", "blitzElitePass"],
]);
const mutationPolicyPath = "packages/settlement-codec/schema/authority-mutation-policy-v1.json";
const mutationPolicy = readJson(mutationPolicyPath);
const mutationPolicyByPath = indexMutationPolicy(mutationPolicy);
const appliedMutationPolicyRuleIds = new Set();
const MUTATION_OPERATIONS = [
  {
    name: "deploy",
    operationKind: 1,
    targetSemanticKey: "deployment",
    pattern: /\bdeploy(?:\s*\(|[A-Z_]\w*\s*\()|\bbun run deploy(?::|\b)|\bsozo migrate\b|\bslot deployments create\b/,
  },
  {
    name: "declare",
    operationKind: 2,
    targetSemanticKey: "deployment",
    pattern: /\bdeclare(?:\s*\(|[A-Z_]\w*\s*\()|\bbun run declare(?::|\b)|\bstarkli declare\b/,
  },
  {
    name: "upgrade",
    operationKind: 3,
    targetSemanticKey: "deployment",
    pattern:
      /\bupgrade(?:Contract|Contracts|PackageContracts)\s*\(|entrypoint:\s*["']upgrade["']|\bbun run upgrade(?::|\b)/,
  },
  {
    name: "role-mutation",
    operationKind: 4,
    targetSemanticKey: "roleAuthority",
    pattern:
      /\b(?:grant|revoke|renounce)_role\s*\(|\b(?:grant|revoke|renounce)\w*Roles?\w*\s*\(|entrypoint:\s*["'](?:grant_role|grantRole|revoke_role|revokeRole|renounce_role|renounceRole)["']/,
  },
  {
    name: "factory-mutation",
    operationKind: 5,
    targetSemanticKey: "factory",
    pattern:
      /entrypoint:\s*["']set_factory_details["']|\bset_factory_(?:address|details)\s*\(|\bsetFactory(?:Address|Details)?\s*\(/,
  },
];

assertRequiredSourceSemantics();

const canonicalAddresses = new Map(chains.map((chain) => [chain, readAddressFile(chain)]));
const addressSources = buildAddressSources().sort(compareAddressRecords);
const addressAliases = buildAddressAliases().sort(compareAliasRecords);
const dynamicAddressInputs = buildDynamicAddressInputs().sort(compareDynamicAddressInputs);
const mutationReviewPaths = discoverMutationPaths().sort((left, right) => left.path.localeCompare(right.path));
assertMutationPolicyCoverage(mutationReviewPaths, mutationPolicyByPath);
const privilegedMutationPaths = mutationReviewPaths.filter(({ reviewStatus }) => reviewStatus === "reviewed");
const unresolvedMutationCandidates = mutationReviewPaths
  .filter(({ reviewStatus }) => reviewStatus === "unresolved")
  .map(({ path, sourcePath, operation, pathHash, operationKind, targetSemanticKey }) => ({
    path,
    sourcePath,
    operation,
    pathHash,
    operationKind,
    targetSemanticKey,
  }));
const authoritySchema = buildAuthoritySchema();
const evidenceComplete =
  mutationPolicy.unresolvedOperations.length === 0 && authoritySchema.observedClassMatchesLocalStorageLayoutSource;
const externalAuthorization = {
  required: true,
  status: "awaiting-a23-authority-freeze",
  authoritySchemaHash: authoritySchema.authoritySchemaHash,
  approvalRecordHash: null,
};
const addressSourceRecords = addressSources.map(serializeAddressSourceRecord);
const addressAliasRecords = addressAliases.map(serializeAddressAliasRecord);
const dynamicAddressInputRecords = dynamicAddressInputs.map(serializeDynamicAddressInputRecord);
const privilegedMutationPathRecords = privilegedMutationPaths.map(serializePrivilegedMutationPathRecord);
const onchainObservations = [readJson("packages/settlement-codec/schema/onchain-observation-a20-v1.json")];
const inventory = {
  schemaVersion: 1,
  status: resolveInventoryStatus(authoritySchema),
  evidenceComplete,
  generatedArtifactsCurrent: generatedAddressesAreCurrent(addressSources),
  addressSources,
  addressSourceRecords,
  addressAliases,
  addressAliasRecords,
  dynamicAddressInputs,
  dynamicAddressInputRecords,
  dynamicAddressInputsHash: computeDynamicAddressInputsCommitment(dynamicAddressInputRecords),
  authoritativeAddressInputsHash: computeAddressInputsCommitment(
    addressSourceRecords,
    addressAliasRecords,
    dynamicAddressInputRecords,
  ),
  privilegedMutationPaths,
  privilegedMutationPathRecords,
  privilegedMutationPathsHash: computeMutationPathsCommitment(privilegedMutationPathRecords),
  discoveredMutationPathHashes: mutationReviewPaths.map(({ pathHash }) => pathHash).sort(compareFelt),
  mutationPolicyPath,
  mutationPolicyStatus: mutationPolicy.status,
  unresolvedMutationCandidates,
  unresolvedMutationPathHashes: unresolvedMutationCandidates.map(({ pathHash }) => pathHash).sort(compareFelt),
  externalAuthorization,
  releaseReady: false,
  onchainObservations,
  authoritySchema,
};

writeOrCheck(`${JSON.stringify(inventory, null, 2)}\n`);

function buildAddressSources() {
  return [
    ...canonicalAddressRecords(),
    ...sourceConfigRecords(),
    ...generatedConfigRecords(),
    ...factoryInputRecords(),
    ...publicMainnetVrfRecords(),
    ...packageAddressRecords(),
  ];
}

function buildDynamicAddressInputs() {
  return listRepositoryFiles()
    .filter(isDynamicAddressInputSourcePath)
    .flatMap((sourcePath) =>
      discoverDynamicAddressInputUses(readText(sourcePath)).map(({ semanticKey, sourceKey, inputKind }) => ({
        semanticKey,
        semanticKeyHash: felt(semanticKey),
        sourcePath,
        sourcePathHash: felt(sourcePath),
        sourceKey,
        sourceKeyHash: felt(sourceKey),
        inputKind,
        inputKindCode: dynamicAddressInputKindCode(inputKind),
        value: null,
        isAuthoritative: false,
        allowedProfileBitmap: "0x1f",
      })),
    );
}

function canonicalAddressRecords() {
  return chains.flatMap((chain) => {
    const path = `contracts/common/addresses/${chain}.json`;
    return Object.entries(canonicalAddresses.get(chain))
      .filter(([key, value]) => typeof value === "string" && !legacyAliases.has(key))
      .map(([semanticKey, value]) => addressRecord(chain, semanticKey, 1, path, semanticKey, value, true));
  });
}

function sourceConfigRecords() {
  return discoverSourceConfigAddressUses().flatMap(({ sourcePath, semanticKey }) =>
    chains.flatMap((chain) => {
      const value = canonicalAddresses.get(chain)[semanticKey];
      if (typeof value !== "string") return [];
      return [addressRecord(chain, semanticKey, 2, sourcePath, `addresses.${semanticKey}`, value, false)];
    }),
  );
}

function discoverSourceConfigAddressUses() {
  return listFiles("config/source")
    .filter((path) => path.endsWith(".ts") && !path.endsWith(".test.ts"))
    .flatMap((sourcePath) => {
      const semanticKeys = new Set(
        [...readText(sourcePath).matchAll(/\b(?:context\.)?addresses\.([A-Za-z_$][\w$]*)/g)].map((match) => match[1]),
      );
      return [...semanticKeys].sort().map((semanticKey) => ({ sourcePath, semanticKey }));
    });
}

function publicMainnetVrfRecords() {
  const chain = "mainnet";
  const value = canonicalAddresses.get(chain).vrfProvider;
  return [
    addressRecord(
      chain,
      "vrfProvider",
      2,
      "config/deployer/clean/vrf/release.ts",
      "CARTRIDGE_VRF_RELEASE.providerAddress",
      value,
      false,
    ),
    addressRecord(
      chain,
      "vrfProvider",
      4,
      "config/deployer/clean/constants.ts",
      "DEFAULT_VRF_PROVIDER_ADDRESS",
      value,
      false,
    ),
  ];
}

function generatedConfigRecords() {
  return listFiles("config/generated")
    .filter((path) => path.endsWith(".json"))
    .flatMap((path) => {
      const parsed = readJson(path);
      const chain = parsed.configuration?.setup?.chain;
      const addresses = parsed.configuration?.setup?.addresses;
      if (!chains.includes(chain) || !addresses) return [];
      return Object.entries(addresses)
        .filter(([key, value]) => typeof value === "string" && !legacyAliases.has(key))
        .map(([semanticKey, value]) => addressRecord(chain, semanticKey, 3, path, semanticKey, value, false));
    });
}

function factoryInputRecords() {
  return ["mainnet", "slot", "slottest"].flatMap((chain) => {
    const value = canonicalAddresses.get(chain).factory;
    return [
      addressRecord(
        chain,
        "factory",
        4,
        "config/deployer/clean/constants.ts",
        `DEFAULT_${chain.toUpperCase()}_FACTORY_ADDRESS`,
        value,
        false,
      ),
    ];
  });
}

function packageAddressRecords() {
  const definitions = [
    [
      "mainnet",
      "cosmetics",
      "contracts/collectibles/ext/scripts/deployment/addresses/mainnet/collectibles_cosmetics.json",
    ],
    [
      "mainnet",
      "lootChests",
      "contracts/collectibles/ext/scripts/deployment/addresses/mainnet/collectibles_lootchests.json",
    ],
    [
      "mainnet",
      "collectiblesTimelock",
      "contracts/collectibles/ext/scripts/deployment/addresses/mainnet/Collectibles: Timelock Maker.json",
    ],
  ];
  const packageRecords = definitions.flatMap(([chain, semanticKey, path]) => {
    if (!fileExists(path)) return [];
    const value = findAddressValue(readJson(path));
    return value === null ? [] : [addressRecord(chain, semanticKey, 2, path, semanticKey, value, false)];
  });
  for (const chain of ["mainnet", "sepolia", "slot"]) {
    const path = `contracts/mmr/ext/scripts/deployment/addresses/${chain}/MMR: Token.json`;
    packageRecords.push(addressRecord(chain, "mmrToken", 3, path, "address", readJson(path).address, false));
  }
  const observation = readJson("packages/settlement-codec/schema/onchain-observation-a20-v1.json");
  packageRecords.push(
    addressRecord(
      observation.chainId,
      observation.semanticKey,
      6,
      "packages/settlement-codec/schema/onchain-observation-a20-v1.json",
      "contractAddress",
      observation.contractAddress,
      false,
    ),
  );
  const sepoliaCollectiblesPath = "contracts/collectibles/ext/scripts/deployment/addresses/sepolia/collectibles.json";
  packageRecords.push(
    addressRecord(
      "sepolia",
      "legacyCollectibles",
      1,
      sepoliaCollectiblesPath,
      "address",
      readJson(sepoliaCollectiblesPath).address,
      true,
    ),
  );
  for (const path of listFiles("contracts/ammv2/scripts/state/addresses").filter((entry) => entry.endsWith(".json"))) {
    const state = readJson(path);
    const chain = state.network;
    if (!chains.includes(chain)) continue;
    for (const [key, value] of Object.entries(state)) {
      if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) continue;
      packageRecords.push(addressRecord(chain, `ammV2.${key}`, 1, path, key, value, true));
    }
  }
  return packageRecords;
}

function buildAuthoritySchema() {
  const observation = readJson("packages/settlement-codec/schema/onchain-observation-a20-v1.json");
  const deployedSourceMatches = deployedSourceProvenanceMatchesObservation(observation);
  const observedRoles = new Map(observation.roles.map((role) => [role.name, role]));
  const defaultAdmins = observedRoles.get("DEFAULT_ADMIN_ROLE").members.map(normalizeAddress).sort(compareFelt);
  const upgraders = observedRoles.get("UPGRADER_ROLE").members.map(normalizeAddress).sort(compareFelt);
  const allMembers = [...new Set(observation.roles.flatMap(({ members }) => members.map(normalizeAddress)))].sort(
    compareFelt,
  );
  const roles = observation.roles
    .map((role) => {
      const members = role.members
        .map(normalizeAddress)
        .sort(compareFelt)
        .map((member, memberIndex) => ({ memberIndex, member }));
      return {
        name: role.name,
        roleId: normalizeAddress(role.roleId),
        adminRoleId: normalizeAddress(role.adminRoleId),
        members,
        membersHash: authorityCountedHash(
          "LEGACY_MMR_AUTHORITY_MEMBERS_V1",
          members.map(({ memberIndex, member }) =>
            authorityPoseidon("LEGACY_MMR_AUTHORITY_MEMBER_V1", memberIndex, member),
          ),
        ),
      };
    })
    .sort((left, right) => compareFelt(left.roleId, right.roleId))
    .map((role, roleIndex) => ({ ...role, roleIndex }));
  const capabilities = [
    ...upgraders.map((controller) =>
      capability(
        `tokenClassReplacement:${controller}`,
        1,
        "upgrade",
        1,
        controller,
        accountRouteDescriptor(observation, controller, "upgrade"),
        true,
      ),
    ),
    capability("bridgeInitializer", 2, "initialize_legacy_mmr_bridge", 3, "0x0", "", false),
    ...defaultAdmins.map((controller) =>
      capability(
        `factoryTupleMutation:${controller}`,
        3,
        "set_factory_details",
        1,
        controller,
        accountRouteDescriptor(observation, controller, "set_factory_details"),
        true,
      ),
    ),
    ...["grant_role", "grantRole", "revoke_role", "revokeRole"].flatMap((selectorName) =>
      defaultAdmins.map((controller) =>
        capability(
          `roleMutation:${selectorName}:${controller}`,
          4,
          selectorName,
          1,
          controller,
          accountRouteDescriptor(observation, controller, selectorName),
          true,
        ),
      ),
    ),
    ...["renounce_role", "renounceRole"].flatMap((selectorName) =>
      allMembers.map((controller) =>
        capability(
          `roleMutation:${selectorName}:${controller}`,
          4,
          selectorName,
          4,
          controller,
          directRouteDescriptor(observation, controller, selectorName),
          true,
        ),
      ),
    ),
    capability("contextActivation", 5, "activate_legacy_mmr_context", 3, "0x0", "", false),
    ...allMembers.map((controller) =>
      capability(
        `genericAdminExecutor:${controller}`,
        6,
        "__execute__",
        1,
        controller,
        genericExecutorRouteDescriptor(observation, controller),
        true,
      ),
    ),
  ]
    .sort(
      (left, right) =>
        left.capabilityKind - right.capabilityKind ||
        compareFelt(left.selector, right.selector) ||
        compareFelt(left.capabilityId, right.capabilityId),
    )
    .map((entry, capabilityIndex) => ({ ...entry, capabilityIndex }));
  const tokenStorageLayoutHash = observation.deployedSourceRebuild.storageLayoutIdentityHash;
  const commitments = computeAuthoritySchemaCommitments({ tokenStorageLayoutHash, roles, capabilities });
  return {
    status: deployedSourceMatches
      ? "provenance-complete-awaiting-a23-freeze"
      : "blocked-observed-class-source-mismatch",
    tokenAddress: normalizeAddress(observation.contractAddress),
    tokenClassHash: normalizeAddress(observation.classHash),
    localSourceClassHash: normalizeAddress(observation.deployedSourceRebuild.sierraClassHash),
    observedClassMatchesLocalStorageLayoutSource: deployedSourceMatches,
    tokenStorageLayoutHash,
    roles,
    capabilities,
    ...commitments,
  };
}

function deployedSourceProvenanceMatchesObservation(observation) {
  return (
    observation.deployedSourceRebuild.rpcRepresentableClassExactMatch &&
    normalizeAddress(observation.deployedSourceRebuild.sierraClassHash) === normalizeAddress(observation.classHash) &&
    normalizeAddress(observation.deployedSourceRebuild.compiledClassHash) ===
      normalizeAddress(observation.declaration.compiledClassHash)
  );
}

function capability(semanticKey, capabilityKind, selectorName, controllerKind, controller, routeDescriptor, enabled) {
  const routeDescriptorHash = felt(routeDescriptor || `disabled:${semanticKey}`);
  return {
    semanticKey,
    capabilityId: authorityPoseidon(
      "LEGACY_MMR_AUTHORITY_CAPABILITY_ID_V1",
      felt(semanticKey),
      controllerKind,
      routeDescriptorHash,
    ),
    capabilityKind,
    selectorName,
    selector: selector(selectorName),
    controllerKind,
    expectedRouteDescriptorHash: routeDescriptorHash,
    routeDescriptor,
    controller: normalizeAddress(controller),
    routeHash: enabled ? routeDescriptorHash : "0x0",
    enabled,
  };
}

function accountRouteDescriptor(observation, controllerAddress, targetEntrypoint) {
  const controller = requireObservedController(observation, controllerAddress);
  return [
    "account-route-v1",
    normalizeAddress(controller.address),
    normalizeAddress(controller.classHash),
    controller.executionSelector,
    normalizeAddress(observation.contractAddress),
    selector(targetEntrypoint),
  ].join(":");
}

function directRouteDescriptor(observation, controllerAddress, targetEntrypoint) {
  return [
    "direct-route-v1",
    normalizeAddress(controllerAddress),
    normalizeAddress(observation.contractAddress),
    selector(targetEntrypoint),
  ].join(":");
}

function genericExecutorRouteDescriptor(observation, controllerAddress) {
  const controller = requireObservedController(observation, controllerAddress);
  return [
    "generic-executor-route-v1",
    normalizeAddress(controller.address),
    normalizeAddress(controller.classHash),
    controller.executionSelector,
  ].join(":");
}

function requireObservedController(observation, controllerAddress) {
  const controller = observation.controllers.find(
    ({ address }) => normalizeAddress(address) === normalizeAddress(controllerAddress),
  );
  if (!controller) throw new Error(`authority controller is not in the finalized observation: ${controllerAddress}`);
  return controller;
}

function buildAddressAliases() {
  const aliases = chains.flatMap((chain) => {
    const path = `contracts/common/addresses/${chain}.json`;
    const addresses = canonicalAddresses.get(chain);
    return [...legacyAliases.entries()].flatMap(([sourceKey, semanticKey]) => {
      if (!(sourceKey in addresses) || !(semanticKey in addresses)) return [];
      const aliasValue = normalizeAddress(addresses[sourceKey]);
      const canonicalValue = normalizeAddress(addresses[semanticKey]);
      const disposition = aliasValue === canonicalValue ? 1 : aliasValue === "0x0" && canonicalValue !== "0x0" ? 2 : 4;
      return [aliasRecord(chain, semanticKey, path, sourceKey, disposition, aliasValue)];
    });
  });
  for (const path of listFiles("config/generated").filter((entry) => entry.endsWith(".json"))) {
    const parsed = readJson(path);
    const chain = parsed.configuration?.setup?.chain;
    const addresses = parsed.configuration?.setup?.addresses;
    if (!chains.includes(chain) || !addresses) continue;
    for (const [sourceKey, semanticKey] of legacyAliases) {
      if (!(sourceKey in addresses) || !(semanticKey in canonicalAddresses.get(chain))) continue;
      const aliasValue = normalizeAddress(addresses[sourceKey]);
      const canonicalValue = normalizeAddress(canonicalAddresses.get(chain)[semanticKey]);
      const disposition = aliasValue === canonicalValue ? 1 : aliasValue === "0x0" && canonicalValue !== "0x0" ? 2 : 4;
      aliases.push(aliasRecord(chain, semanticKey, path, sourceKey, disposition, aliasValue));
    }
  }
  aliases.push(
    aliasRecord(
      "mainnet",
      "cosmeticsClaim",
      "contracts/common/collectibles_claim/addresses/mainnet.json",
      "cosmetics_claim",
      4,
      canonicalAddresses.get("mainnet").cosmeticsClaim,
    ),
  );
  aliases.push(
    aliasRecord(
      "mainnet",
      "cosmetics",
      "contracts/collectibles/ext/scripts/deployment/addresses/mainnet/Collectibles: ABC: Cosmetic Items.json",
      "address",
      4,
      readJson("contracts/collectibles/ext/scripts/deployment/addresses/mainnet/Collectibles: ABC: Cosmetic Items.json")
        .address,
    ),
    aliasRecord(
      "mainnet",
      "lootChests",
      "contracts/collectibles/ext/scripts/deployment/addresses/mainnet/Collectibles: ABC: Loot Chest.json",
      "address",
      4,
      readJson("contracts/collectibles/ext/scripts/deployment/addresses/mainnet/Collectibles: ABC: Loot Chest.json")
        .address,
    ),
  );
  return aliases;
}

function assertRequiredSourceSemantics() {
  const blitzAddresses = readText("config/source/blitz/addresses.ts");
  if (/Collectibles: Realms: Loot Chest/.test(blitzAddresses) || !/addresses\.lootChests/.test(blitzAddresses)) {
    throw new Error("Blitz must resolve the canonical lootChests semantic key");
  }
  const cosmeticsWriter = readText("contracts/collectibles_claim/ext/scripts/deployment/libs/commands.js");
  if (
    !/saveContractAddressToCommonFolder\("cosmeticsClaim"/.test(cosmeticsWriter) ||
    !/common", "addresses/.test(cosmeticsWriter)
  ) {
    throw new Error("cosmetics claim writer must target the canonical common cosmeticsClaim key");
  }
  const factoryDefaults = readText("config/deployer/clean/constants.ts");
  if (
    !/resolveCanonicalAddress\("mainnet", "factory"\)/.test(factoryDefaults) ||
    !/resolveCanonicalAddress\("slot", "factory"\)/.test(factoryDefaults) ||
    !/resolveCanonicalAddress\("slottest", "factory"\)/.test(factoryDefaults)
  ) {
    throw new Error("clean factory defaults must resolve canonical chain authority");
  }
}

function discoverMutationPaths() {
  const candidates = listRepositoryFiles().filter(isMutationSource);
  return candidates.flatMap((sourcePath) => {
    const source = readText(sourcePath);
    return MUTATION_OPERATIONS.filter(({ pattern }) => pattern.test(source)).map((operation) =>
      mutationRecord(sourcePath, source, operation),
    );
  });
}

function listRepositoryFiles() {
  return listFiles(".").map((path) => path.replace(/^\.\//, ""));
}

function mutationRecord(sourcePath, source, operation) {
  const path = `${sourcePath}#${operation.name}`;
  const policy = resolveMutationPolicy(path, sourcePath);
  if (!policy) {
    return {
      path,
      sourcePath,
      operation: operation.name,
      pathHash: felt(path),
      operationKind: operation.operationKind,
      targetSemanticKey: felt(operation.targetSemanticKey),
      productionDisposition: 4,
      reviewStatus: "unreviewed",
      evidencePath: "",
      replacementPath: "",
      replacementPathHash: "0x0",
      evidenceHash: "0x0",
    };
  }
  const replacementPath = policy.replacementPath ?? "";
  const record = {
    path,
    sourcePath,
    operation: operation.name,
    pathHash: felt(path),
    operationKind: operation.operationKind,
    targetSemanticKey: felt(operation.targetSemanticKey),
    productionDisposition: policy.productionDisposition,
    reviewStatus: policy.reviewStatus,
    evidencePath: policy.evidencePath,
    replacementPath,
    replacementPathHash: replacementPath ? felt(replacementPath) : "0x0",
    evidenceHash: policy.evidencePath ? felt(readText(policy.evidencePath)) : "0x0",
  };
  validateMutationEvidence(record, source);
  return record;
}

function resolveMutationPolicy(path, sourcePath) {
  const exact = mutationPolicyByPath.get(path);
  if (exact) return exact;
  const matches = mutationPolicy.pathPrefixRules
    .filter(({ pathPrefix }) => path.startsWith(pathPrefix))
    .sort((left, right) => right.pathPrefix.length - left.pathPrefix.length);
  if (matches.length === 0) return null;
  if (matches.length > 1 && matches[0].pathPrefix.length === matches[1].pathPrefix.length) {
    throw new Error(`ambiguous privileged mutation policy rules: ${path}`);
  }
  const rule = matches[0];
  appliedMutationPolicyRuleIds.add(rule.id);
  return {
    productionDisposition: rule.productionDisposition,
    reviewStatus: "reviewed",
    replacementPath: rule.replacementPath ?? "",
    evidencePath: rule.evidenceMode === "source" ? sourcePath : rule.evidencePath,
  };
}

function validateMutationEvidence(record, source) {
  if (record.productionDisposition === 2 && !source.includes("A20_HARD_DISABLED")) {
    throw new Error(`hard-disabled mutation path lacks an executable guard: ${record.path}`);
  }
  if (record.productionDisposition === 4 && !record.replacementPath) {
    throw new Error(`migration-only mutation path lacks a replacement: ${record.path}`);
  }
}

function indexMutationPolicy(policy) {
  const entries = [
    ...policy.canonicalStructuredOperations.map((entry) => ({
      ...entry,
      productionDisposition: 1,
      reviewStatus: "reviewed",
      replacementPath: "",
    })),
    ...policy.hardDisabledOperations.map((entry) => ({ ...entry, productionDisposition: 2, reviewStatus: "reviewed" })),
    ...policy.readOnlyOperations.map((entry) => ({ ...entry, productionDisposition: 3, reviewStatus: "reviewed" })),
    ...policy.consumedMigrationOperations.map((entry) => ({
      ...entry,
      productionDisposition: 4,
      reviewStatus: "reviewed",
    })),
    ...policy.unresolvedOperations.map((path) => ({
      path,
      productionDisposition: 4,
      reviewStatus: "unresolved",
      replacementPath: "config/deployer/clean/launch/runner.ts",
      evidencePath: "",
    })),
  ];
  const indexed = new Map();
  for (const entry of entries) {
    if (indexed.has(entry.path)) throw new Error(`duplicate privileged mutation policy: ${entry.path}`);
    indexed.set(entry.path, entry);
  }
  return indexed;
}

function assertMutationPolicyCoverage(discovered, policyByPath) {
  const discoveredPaths = new Set(discovered.map(({ path }) => path));
  const stale = [...policyByPath.keys()].filter((path) => !discoveredPaths.has(path));
  const missing = discovered.filter(({ reviewStatus }) => reviewStatus === "unreviewed").map(({ path }) => path);
  const unusedRules = mutationPolicy.pathPrefixRules
    .filter(({ id }) => !appliedMutationPolicyRuleIds.has(id))
    .map(({ id }) => id);
  if (stale.length > 0 || missing.length > 0 || unusedRules.length > 0) {
    throw new Error(
      `privileged mutation policy mismatch\nmissing:\n${missing.join("\n")}\nstale:\n${stale.join("\n")}\nunused rules:\n${unusedRules.join("\n")}`,
    );
  }
}

function resolveInventoryStatus(authoritySchema) {
  if (mutationPolicy.unresolvedOperations.length > 0) return "blocked-a20-mutation-review";
  if (!authoritySchema.observedClassMatchesLocalStorageLayoutSource) {
    return "mutation-review-complete-observed-class-source-blocked";
  }
  return "a20-evidence-complete-awaiting-a23-freeze";
}

function addressRecord(chainId, semanticKey, sourceKind, sourcePath, sourceKey, value, isAuthoritative) {
  return {
    chainId,
    chainIdFelt: encodeChainId(chainId),
    semanticKey,
    semanticKeyHash: felt(semanticKey),
    sourceKind,
    sourcePath,
    sourcePathHash: felt(sourcePath),
    sourceKey,
    sourceKeyHash: felt(sourceKey),
    value: normalizeAddress(value),
    isAuthoritative,
    allowedProfileBitmap: profileBitmap(chainId),
  };
}

function serializeAddressSourceRecord(record) {
  return {
    chain_id: record.chainIdFelt,
    semantic_key: record.semanticKeyHash,
    source_kind: record.sourceKind,
    source_path_hash: record.sourcePathHash,
    source_key_hash: record.sourceKeyHash,
    value: record.value,
    is_authoritative: record.isAuthoritative,
    allowed_profile_bitmap: record.allowedProfileBitmap,
  };
}

function aliasRecord(chainId, semanticKey, sourcePath, sourceKey, disposition, expectedValue) {
  return {
    chainId,
    chainIdFelt: encodeChainId(chainId),
    semanticKey,
    semanticKeyHash: felt(semanticKey),
    sourcePath,
    aliasPathHash: felt(sourcePath),
    sourceKey,
    aliasKeyHash: felt(sourceKey),
    disposition,
    expectedValue: normalizeAddress(expectedValue),
  };
}

function serializeAddressAliasRecord(record) {
  return {
    chain_id: record.chainIdFelt,
    semantic_key: record.semanticKeyHash,
    alias_path_hash: record.aliasPathHash,
    alias_key_hash: record.aliasKeyHash,
    disposition: record.disposition,
    expected_value: record.expectedValue,
  };
}

function serializeDynamicAddressInputRecord(record) {
  return {
    semantic_key: record.semanticKeyHash,
    source_path_hash: record.sourcePathHash,
    source_key_hash: record.sourceKeyHash,
    input_kind: record.inputKindCode,
    is_authoritative: record.isAuthoritative,
    allowed_profile_bitmap: record.allowedProfileBitmap,
  };
}

function serializePrivilegedMutationPathRecord(record) {
  return {
    path_hash: record.pathHash,
    operation_kind: record.operationKind,
    target_semantic_key: record.targetSemanticKey,
    production_disposition: record.productionDisposition,
    replacement_path_hash: record.replacementPathHash,
    evidence_hash: record.evidenceHash,
  };
}

function generatedAddressesAreCurrent(records) {
  return records
    .filter(({ sourceKind }) => sourceKind === 3)
    .every((record) => {
      const canonical = canonicalAddresses.get(record.chainId)?.[record.semanticKey];
      return canonical === undefined || normalizeAddress(canonical) === record.value;
    });
}

function normalizeAddress(value) {
  if (value === "" || value === undefined || value === null) return "0x0";
  return `0x${BigInt(value).toString(16)}`;
}

function profileBitmap(chain) {
  return `0x${(1n << BigInt(chains.indexOf(chain))).toString(16)}`;
}

function felt(value) {
  return hashAuthorityDomain(value);
}

function encodeChainId(chain) {
  const chainId = chainIds.get(chain);
  if (!chainId) throw new Error(`unknown address inventory chain: ${chain}`);
  return shortString.encodeShortString(chainId);
}

function selector(value) {
  return hash.getSelectorFromName(value);
}

function compareAddressRecords(left, right) {
  return (
    left.chainId.localeCompare(right.chainId) ||
    left.semanticKey.localeCompare(right.semanticKey) ||
    left.sourceKind - right.sourceKind ||
    left.sourcePath.localeCompare(right.sourcePath) ||
    left.sourceKey.localeCompare(right.sourceKey)
  );
}

function compareAliasRecords(left, right) {
  return (
    left.chainId.localeCompare(right.chainId) ||
    left.semanticKey.localeCompare(right.semanticKey) ||
    left.sourcePath.localeCompare(right.sourcePath) ||
    left.sourceKey.localeCompare(right.sourceKey)
  );
}

function compareDynamicAddressInputs(left, right) {
  return (
    left.semanticKey.localeCompare(right.semanticKey) ||
    left.sourcePath.localeCompare(right.sourcePath) ||
    left.inputKind.localeCompare(right.inputKind) ||
    left.sourceKey.localeCompare(right.sourceKey)
  );
}

function compareFelt(left, right) {
  const leftValue = BigInt(left);
  const rightValue = BigInt(right);
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}

function isMutationSource(path) {
  return (
    /\.(c?js|mjs|sh|c?ts|mts|tsx|py|rs|ya?ml)$/.test(path) &&
    !/(^|\/)(tests?|mocks?|target|node_modules)(\/|$)|\.test\.|_vectors\.cairo$/.test(path) &&
    !path.includes("/generated/") &&
    path !== "scripts/settlement/generate-authority-inventory.mjs"
  );
}

function dynamicAddressInputKindCode(inputKind) {
  const codes = { environment: 1, cli: 2, "runtime-field": 3 };
  const code = codes[inputKind];
  if (!code) throw new Error(`unknown dynamic address input kind: ${inputKind}`);
  return code;
}

function listFiles(root) {
  const absoluteRoot = resolve(repositoryRoot, root);
  if (!fileExists(root)) return [];
  if (!statSync(absoluteRoot).isDirectory()) return [root];
  return readdirSync(absoluteRoot, { withFileTypes: true }).flatMap((entry) => {
    const path = `${root}/${entry.name}`;
    if (entry.isDirectory() && isIgnoredDiscoveryDirectory(entry.name)) return [];
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function isIgnoredDiscoveryDirectory(name) {
  return [".git", ".context", ".next", "coverage", "dist", "node_modules", "target"].includes(name);
}

function readAddressFile(chain) {
  return readJson(`contracts/common/addresses/${chain}.json`);
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function readText(path) {
  return readFileSync(resolve(repositoryRoot, path), "utf8");
}

function fileExists(path) {
  try {
    statSync(resolve(repositoryRoot, path));
    return true;
  } catch {
    return false;
  }
}

function findAddressValue(value) {
  if (typeof value === "string" && /^0x[0-9a-f]+$/i.test(value)) return value;
  if (!value || typeof value !== "object") return null;
  for (const child of Object.values(value)) {
    const address = findAddressValue(child);
    if (address !== null) return address;
  }
  return null;
}

function writeOrCheck(rendered) {
  if (shouldCheck) {
    const current = readFileSync(outputPath, "utf8");
    if (current !== rendered)
      throw new Error(`stale generated authority inventory: ${relative(repositoryRoot, outputPath)}`);
    return;
  }
  writeFileSync(outputPath, rendered);
}
