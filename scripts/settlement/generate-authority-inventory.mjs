import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { hash, shortString } from "starknet";
import {
  authorityCountedHash,
  authorityPoseidon,
  computeAddressInputsCommitment,
  computeAuthoritySchemaCommitments,
  computeMutationPathsCommitment,
  hashAuthorityDomain,
} from "../../packages/settlement-codec/src/authority-commitments.ts";

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
    pattern: /\bupgrade(?:\s*\(|[A-Z_]\w*\s*\()|entrypoint:\s*["']upgrade["']|\bbun run upgrade(?::|\b)/,
  },
  {
    name: "role-mutation",
    operationKind: 4,
    targetSemanticKey: "roleAuthority",
    pattern:
      /\b(?:grant|revoke|renounce)(?:\s*\(|[A-Z_]\w*\s*\()|entrypoint:\s*["'](?:grant_role|grantRole|revoke_role|revokeRole|renounce_role|renounceRole)["']|\bgrant_role\b|\brevoke_role\b/,
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
const addressSourceRecords = addressSources.map(serializeAddressSourceRecord);
const addressAliasRecords = addressAliases.map(serializeAddressAliasRecord);
const privilegedMutationPathRecords = privilegedMutationPaths.map(serializePrivilegedMutationPathRecord);
const onchainObservations = [readJson("packages/settlement-codec/schema/onchain-observation-a20-v1.json")];
const inventory = {
  schemaVersion: 1,
  status: mutationPolicy.unresolvedOperations.length === 0 ? "a20-authority-inventory" : "blocked-a20-mutation-review",
  generatedArtifactsCurrent: generatedAddressesAreCurrent(addressSources),
  addressSources,
  addressSourceRecords,
  addressAliases,
  addressAliasRecords,
  authoritativeAddressInputsHash: computeAddressInputsCommitment(addressSourceRecords, addressAliasRecords),
  privilegedMutationPaths,
  privilegedMutationPathRecords,
  privilegedMutationPathsHash: computeMutationPathsCommitment(privilegedMutationPathRecords),
  discoveredMutationPathHashes: mutationReviewPaths.map(({ pathHash }) => pathHash).sort(compareFelt),
  mutationPolicyPath,
  mutationPolicyStatus: mutationPolicy.status,
  unresolvedMutationCandidates,
  unresolvedMutationPathHashes: unresolvedMutationCandidates.map(({ pathHash }) => pathHash).sort(compareFelt),
  releaseReady:
    mutationPolicy.unresolvedOperations.length === 0 && authoritySchema.observedClassMatchesLocalStorageLayoutSource,
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

function canonicalAddressRecords() {
  return chains.flatMap((chain) => {
    const path = `contracts/common/addresses/${chain}.json`;
    return Object.entries(canonicalAddresses.get(chain))
      .filter(([key, value]) => typeof value === "string" && !legacyAliases.has(key))
      .map(([semanticKey, value]) => addressRecord(chain, semanticKey, 1, path, semanticKey, value, true));
  });
}

function sourceConfigRecords() {
  const semanticKeys = [
    "lords",
    "collectiblesClassHash",
    "cosmetics",
    "collectiblesTimelock",
    "lootChests",
    "eliteInvite",
    "vrfProvider",
  ];
  return chains.flatMap((chain) =>
    semanticKeys
      .filter((semanticKey) => semanticKey in canonicalAddresses.get(chain))
      .map((semanticKey) =>
        addressRecord(
          chain,
          semanticKey,
          2,
          semanticKey === "vrfProvider" ? "config/source/common/environment.ts" : "config/source/blitz/addresses.ts",
          `addresses.${semanticKey}`,
          canonicalAddresses.get(chain)[semanticKey],
          false,
        ),
      ),
  );
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
    ...["--vrf-provider-address", "VRF_PROVIDER_ADDRESS", "VITE_PUBLIC_VRF_PROVIDER_ADDRESS"].map((sourceKey) =>
      addressRecord(chain, "vrfProvider", 5, "config/deployer/clean/cli/launch-request.ts", sourceKey, value, false),
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
      addressRecord(
        chain,
        "factory",
        5,
        "config/deployer/clean/cli/launch-request.ts",
        "FACTORY_ADDRESS",
        value,
        false,
      ),
      addressRecord(chain, "factory", 2, "config/deployer/config.ts", "factory_address", value, false),
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
  const tokenStorageLayoutHash = felt(extractStorageLayout(readText("contracts/mmr/src/contract.cairo")));
  const commitments = computeAuthoritySchemaCommitments({ tokenStorageLayoutHash, roles, capabilities });
  return {
    status: observation.localSourceRebuild.matchesObservedClass
      ? "candidate-awaiting-a23-freeze"
      : "blocked-observed-class-source-mismatch",
    tokenAddress: normalizeAddress(observation.contractAddress),
    tokenClassHash: normalizeAddress(observation.classHash),
    localSourceClassHash: normalizeAddress(observation.localSourceRebuild.sierraClassHash),
    observedClassMatchesLocalStorageLayoutSource: observation.localSourceRebuild.matchesObservedClass,
    tokenStorageLayoutHash,
    roles,
    capabilities,
    ...commitments,
  };
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

function extractStorageLayout(source) {
  const match = source.match(/#\[storage\]\s*struct Storage\s*\{[\s\S]*?\n    \}/);
  if (!match) throw new Error("MMR token storage layout was not found");
  return match[0].replace(/\s+/g, " ").trim();
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
  const candidates = [".github/workflows", "config/deployer", "contracts", "scripts/ci"]
    .flatMap(listFiles)
    .filter(isMutationSource);
  return candidates.flatMap((sourcePath) => {
    const source = readText(sourcePath);
    return MUTATION_OPERATIONS.filter(({ pattern }) => pattern.test(source)).map((operation) =>
      mutationRecord(sourcePath, source, operation),
    );
  });
}

function mutationRecord(sourcePath, source, operation) {
  const path = `${sourcePath}#${operation.name}`;
  const policy = mutationPolicyByPath.get(path);
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
  return {
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
  const missing = [...discoveredPaths].filter((path) => !policyByPath.has(path));
  if (stale.length > 0 || missing.length > 0) {
    throw new Error(
      `privileged mutation policy mismatch\nmissing:\n${missing.join("\n")}\nstale:\n${stale.join("\n")}`,
    );
  }
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

function compareFelt(left, right) {
  const leftValue = BigInt(left);
  const rightValue = BigInt(right);
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}

function isMutationSource(path) {
  return (
    /\.(js|mjs|sh|ts|tsx|ya?ml)$/.test(path) &&
    !/(^|\/)(tests?|mocks?|target|node_modules)(\/|$)|\.test\.|_vectors\.cairo$/.test(path) &&
    !path.includes("/generated/")
  );
}

function listFiles(root) {
  const absoluteRoot = resolve(repositoryRoot, root);
  if (!fileExists(root)) return [];
  if (!statSync(absoluteRoot).isDirectory()) return [root];
  return readdirSync(absoluteRoot, { withFileTypes: true }).flatMap((entry) => {
    const path = `${root}/${entry.name}`;
    return entry.isDirectory() ? listFiles(path) : [path];
  });
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
