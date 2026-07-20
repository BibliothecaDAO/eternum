import { hash, shortString } from "starknet";
import type {
  AppchainSettlementConfig,
  ApprovedDeploymentAddressInputs,
  CompiledDeploymentAddressRecipe,
  DeploymentAddressRecipe,
  DeploymentAddressPlan,
  DeploymentLayerPlan,
  DeploymentManifest,
  KatanaGenesisArtifactCommitment,
  ResolvedShellComponent,
} from "@bibliothecadao/settlement-codec";
import {
  DEPLOYMENT_MANIFEST_L1_COMPONENT_FIELDS,
  DEPLOYMENT_MANIFEST_L2_COMPONENT_FIELDS,
} from "@bibliothecadao/settlement-codec";

const ADDRESS_RECIPE_DOMAIN = felt("DEPLOYMENT_ADDRESS_RECIPE_V1");
const APPCHAIN_SETTLEMENT_CONFIG_DOMAIN = felt("APPCHAIN_SETTLEMENT_CONFIG_V1");
const KATANA_GENESIS_ARTIFACT_DOMAIN = felt("KATANA_GENESIS_ARTIFACT_V1");
const KATANA_GENESIS_CLASS_DECLARATIONS_DOMAIN = felt("KATANA_GENESIS_CLASSES_V1");
const KATANA_GENESIS_CONTRACT_ALLOCATIONS_DOMAIN = felt("KATANA_GENESIS_CONTRACTS_V1");
const KATANA_GENESIS_STORAGE_WRITES_DOMAIN = felt("KATANA_GENESIS_STORAGE_V1");
const MANIFEST_DOMAIN = felt("DEPLOYMENT_MANIFEST_V1");
const COMPONENT_CLASSES_DOMAIN = felt("DEPLOYMENT_COMPONENT_CLASSES_V1");
const COMPONENT_SALTS_DOMAIN = felt("DEPLOYMENT_COMPONENT_SALTS_V1");
const SHELL_CONSTRUCTOR_SCHEMA_DOMAIN = felt("SHELL_CONSTRUCTOR_SCHEMA_V1");
const SHELL_CONSTRUCTOR_SCHEMA_FIELDS = ["ContractAddress", "u16", "DeploymentId", "felt252", "felt252"] as const;
const STORAGE_ADDRESS_BOUND = (1n << 251n) - 256n;

export function deriveDeploymentShellPlan(
  plan: DeploymentAddressPlan,
  approvedInputs: ApprovedDeploymentAddressInputs,
): CompiledDeploymentAddressRecipe {
  validatePlan(plan);
  validatePlan({ ...approvedInputs, deploymentId: plan.deploymentId });
  assertPlanMatchesApprovedInputs(plan, approvedInputs);
  const l1Components = resolveComponents(plan, plan.l1);
  const l2Components = resolveComponents(plan, plan.l2);
  const recipe = buildRecipe(plan, l1Components, l2Components);
  return {
    recipe,
    recipeHash: poseidon([ADDRESS_RECIPE_DOMAIN, ...serializeRecipe(recipe)]),
    l1Components,
    l2Components,
  };
}

export interface ResolvedDeploymentIdentity {
  readonly shellPlan: CompiledDeploymentAddressRecipe;
  readonly genesisHash: bigint;
  readonly manifest: DeploymentManifest;
  readonly manifestHash: bigint;
  readonly seal: {
    readonly coordinator: bigint;
    readonly addressRecipeHash: bigint;
    readonly manifestHash: bigint;
    readonly genesisHash: bigint;
  };
}

export interface PinnedDeploymentReleaseIdentity {
  readonly rulesetId: bigint;
  readonly releaseBundleHash: bigint;
  readonly coordinator: bigint;
  readonly attestationRevocationRegistry: bigint;
  readonly worldClassHash: bigint;
  readonly classBundleHash: bigint;
  readonly schemaBundleHash: bigint;
  readonly authoritativeAddressInputsHash: bigint;
  readonly externalCounterpartCount: bigint;
  readonly externalCounterpartsHash: bigint;
  readonly privilegedMutationPathsHash: bigint;
  readonly expectedRoleCount: bigint;
  readonly expectedRolesHash: bigint;
  readonly writerGraphHash: bigint;
  readonly katanaSourceCommit: bigint;
  readonly genesisBlockNumber: bigint;
  readonly genesisParentHash: bigint;
  readonly genesisTimestamp: bigint;
  readonly genesisSequencerAddress: bigint;
  readonly genesisEthGasPrice: bigint;
  readonly genesisStrkGasPrice: bigint;
}

export interface PinnedDeploymentProfile {
  readonly addressInputs: ApprovedDeploymentAddressInputs;
  readonly releaseIdentity: PinnedDeploymentReleaseIdentity;
}

export interface DeploymentRulesetResolver {
  resolveDeploymentProfile(rulesetId: bigint): PinnedDeploymentProfile | undefined;
}

export function deriveResolvedDeploymentIdentity(
  plan: DeploymentAddressPlan,
  rulesetResolver: DeploymentRulesetResolver,
  genesisConfig: AppchainSettlementConfig,
  genesisArtifact: KatanaGenesisArtifactCommitment,
  reproducedStateRoot: bigint,
  manifestWithoutGenesis: Omit<DeploymentManifest, "genesis_hash">,
): ResolvedDeploymentIdentity {
  const approvedProfile = rulesetResolver.resolveDeploymentProfile(plan.rulesetId);
  if (!approvedProfile) throw new Error("deployment ruleset is not approved");
  const { addressInputs, releaseIdentity } = approvedProfile;
  const shellPlan = deriveDeploymentShellPlan(plan, addressInputs);
  validateReleaseIdentity(plan, releaseIdentity);
  validateGenesisIdentity(plan, releaseIdentity, shellPlan, genesisConfig);
  validateKatanaGenesisIdentity(plan, releaseIdentity, shellPlan, genesisConfig, genesisArtifact, reproducedStateRoot);
  const genesisHash = poseidon([KATANA_GENESIS_ARTIFACT_DOMAIN, ...serializeKatanaGenesisArtifact(genesisArtifact)]);
  const manifest = { ...manifestWithoutGenesis, genesis_hash: genesisHash };
  validateManifestIdentity(plan, releaseIdentity, shellPlan, genesisConfig, manifest);
  const manifestHash = poseidon([MANIFEST_DOMAIN, ...serializeManifest(manifest)]);
  return {
    shellPlan,
    genesisHash,
    manifest,
    manifestHash,
    seal: {
      coordinator: plan.predeployedCoordinator,
      addressRecipeHash: shellPlan.recipeHash,
      manifestHash,
      genesisHash,
    },
  };
}

function validatePlan(plan: DeploymentAddressPlan): void {
  assertExactKeys("deployment address plan", plan, [
    "protocolVersion",
    "deploymentId",
    "rulesetId",
    "predeployedCoordinator",
    "l1",
    "l2",
  ]);
  assertNonzero("protocol version", plan.protocolVersion);
  assertNonzero("deployment id", plan.deploymentId);
  assertNonzero("ruleset id", plan.rulesetId);
  assertNonzero("predeployed coordinator", plan.predeployedCoordinator);
  validateLayer("l1", plan.l1);
  validateLayer("l2", plan.l2);
}

function validateLayer(name: string, layer: DeploymentLayerPlan): void {
  assertExactKeys(`${name} deployment layer`, layer, [
    "chainId",
    "deployer",
    "deployFromZero",
    "deploymentPrimitiveHash",
    "componentKinds",
    "componentClasses",
  ]);
  assertNonzero(`${name} chain id`, layer.chainId);
  assertNonzero(`${name} deployer`, layer.deployer);
  if (layer.deploymentPrimitiveHash === undefined || layer.deploymentPrimitiveHash === 0n) {
    throw new Error(`${name} deployment primitive must be explicit`);
  }
  if (layer.componentKinds.length === 0 || layer.componentKinds.length > 255) {
    throw new Error(`${name} component count out of bounds`);
  }
  if (new Set(layer.componentKinds).size !== layer.componentKinds.length || layer.componentKinds.includes(0n)) {
    throw new Error(`${name} duplicate component kind`);
  }
  if (
    layer.componentClasses.length !== layer.componentKinds.length ||
    layer.componentClasses.some((component, index) => component.componentKind !== layer.componentKinds[index])
  ) {
    throw new Error(`${name} component class order mismatch`);
  }
  if (layer.componentClasses.some((component) => component.classHash === 0n)) {
    throw new Error(`${name} zero component class`);
  }
  for (const component of layer.componentClasses) {
    assertExactKeys(`${name} component class`, component, ["componentKind", "classHash"]);
  }
}

function assertPlanMatchesApprovedInputs(plan: DeploymentAddressPlan, approved: ApprovedDeploymentAddressInputs): void {
  if (
    plan.protocolVersion !== approved.protocolVersion ||
    plan.rulesetId !== approved.rulesetId ||
    plan.predeployedCoordinator !== approved.predeployedCoordinator ||
    !layersMatch(plan.l1, approved.l1) ||
    !layersMatch(plan.l2, approved.l2)
  ) {
    throw new Error("deployment address plan does not match the approved ruleset inputs");
  }
}

function layersMatch(actual: DeploymentLayerPlan, approved: DeploymentLayerPlan): boolean {
  return (
    actual.chainId === approved.chainId &&
    actual.deployer === approved.deployer &&
    actual.deployFromZero === approved.deployFromZero &&
    actual.deploymentPrimitiveHash === approved.deploymentPrimitiveHash &&
    actual.componentKinds.length === approved.componentKinds.length &&
    actual.componentKinds.every((kind, index) => kind === approved.componentKinds[index]) &&
    actual.componentClasses.length === approved.componentClasses.length &&
    actual.componentClasses.every(
      (component, index) =>
        component.componentKind === approved.componentClasses[index].componentKind &&
        component.classHash === approved.componentClasses[index].classHash,
    )
  );
}

function validateGenesisIdentity(
  plan: DeploymentAddressPlan,
  releaseIdentity: PinnedDeploymentReleaseIdentity,
  shellPlan: CompiledDeploymentAddressRecipe,
  config: AppchainSettlementConfig,
): void {
  assertIdentityFields(plan, config);
  assertEqual("genesis release", config.release_bundle_hash, releaseIdentity.releaseBundleHash);
  assertEqual("genesis coordinator", config.coordinator_l1, plan.predeployedCoordinator);
  assertEqual(
    "genesis attestation revocation registry",
    config.attestation_revocation_registry_l1,
    releaseIdentity.attestationRevocationRegistry,
  );
  assertEqual(
    "genesis appchain component classes",
    config.appchain_component_classes_hash,
    shellPlan.recipe.l2_component_classes_hash,
  );
  assertEqual(
    "genesis class binding count",
    config.class_binding_count,
    shellPlan.recipe.l1_component_count + shellPlan.recipe.l2_component_count,
  );
  assertEqual("genesis schema bundle", config.schema_bundle_hash, releaseIdentity.schemaBundleHash);
  assertResolvedGenesisAddresses(shellPlan, config);
}

function validateKatanaGenesisIdentity(
  plan: DeploymentAddressPlan,
  releaseIdentity: PinnedDeploymentReleaseIdentity,
  shellPlan: CompiledDeploymentAddressRecipe,
  config: AppchainSettlementConfig,
  artifact: KatanaGenesisArtifactCommitment,
  reproducedStateRoot: bigint,
): void {
  assertExactKeys("Katana genesis artifact", artifact, [
    "katanaSourceCommit",
    "chainId",
    "blockNumber",
    "parentHash",
    "timestamp",
    "sequencerAddress",
    "ethGasPrice",
    "strkGasPrice",
    "classDeclarationCount",
    "classDeclarationsHash",
    "contractAllocationCount",
    "contractAllocationsHash",
    "storageWriteCount",
    "storageWritesHash",
    "configHash",
    "stateRoot",
  ]);
  assertEqual("Katana source commit", artifact.katanaSourceCommit, releaseIdentity.katanaSourceCommit);
  assertEqual("Katana genesis chain", artifact.chainId, plan.l2.chainId);
  assertEqual("Katana genesis block number", artifact.blockNumber, releaseIdentity.genesisBlockNumber);
  assertEqual("Katana genesis parent", artifact.parentHash, releaseIdentity.genesisParentHash);
  assertEqual("Katana genesis timestamp", artifact.timestamp, releaseIdentity.genesisTimestamp);
  assertEqual("Katana genesis sequencer", artifact.sequencerAddress, releaseIdentity.genesisSequencerAddress);
  assertEqual("Katana genesis ETH gas price", artifact.ethGasPrice, releaseIdentity.genesisEthGasPrice);
  assertEqual("Katana genesis STRK gas price", artifact.strkGasPrice, releaseIdentity.genesisStrkGasPrice);
  assertEqual(
    "Katana genesis config hash",
    artifact.configHash,
    poseidon([APPCHAIN_SETTLEMENT_CONFIG_DOMAIN, ...serializeAppchainSettlementConfig(config)]),
  );
  assertNonzero("Katana genesis state root", artifact.stateRoot);
  assertEqual("Katana genesis reproduced state root", artifact.stateRoot, reproducedStateRoot);

  const expected = deriveKatanaGenesisInventory(shellPlan.l2Components, config);
  assertEqual("Katana genesis class count", artifact.classDeclarationCount, expected.classDeclarationCount);
  assertEqual("Katana genesis classes", artifact.classDeclarationsHash, expected.classDeclarationsHash);
  assertEqual("Katana genesis contract count", artifact.contractAllocationCount, expected.contractAllocationCount);
  assertEqual("Katana genesis contracts", artifact.contractAllocationsHash, expected.contractAllocationsHash);
  assertEqual("Katana genesis storage count", artifact.storageWriteCount, expected.storageWriteCount);
  assertEqual("Katana genesis storage", artifact.storageWritesHash, expected.storageWritesHash);
}

function validateManifestIdentity(
  plan: DeploymentAddressPlan,
  releaseIdentity: PinnedDeploymentReleaseIdentity,
  shellPlan: CompiledDeploymentAddressRecipe,
  config: AppchainSettlementConfig,
  manifest: DeploymentManifest,
): void {
  assertIdentityFields(plan, manifest);
  assertEqual("manifest recipe", manifest.address_recipe_hash, shellPlan.recipeHash);
  assertEqual("manifest coordinator", manifest.coordinator, plan.predeployedCoordinator);
  assertEqual("manifest release", manifest.release_bundle_hash, releaseIdentity.releaseBundleHash);
  assertEqual(
    "manifest attestation revocation registry",
    manifest.attestation_revocation_registry,
    releaseIdentity.attestationRevocationRegistry,
  );
  assertEqual("manifest world class", manifest.world_class_hash, releaseIdentity.worldClassHash);
  assertEqual("manifest class bundle", manifest.class_bundle_hash, releaseIdentity.classBundleHash);
  assertEqual("manifest schema bundle", manifest.schema_bundle_hash, releaseIdentity.schemaBundleHash);
  assertEqual(
    "manifest authoritative address inputs",
    manifest.authoritative_address_inputs_hash,
    releaseIdentity.authoritativeAddressInputsHash,
  );
  assertEqual(
    "manifest external counterpart count",
    manifest.external_counterpart_count,
    releaseIdentity.externalCounterpartCount,
  );
  assertEqual(
    "manifest external counterpart hash",
    manifest.external_counterparts_hash,
    releaseIdentity.externalCounterpartsHash,
  );
  assertEqual(
    "manifest privileged mutation paths",
    manifest.privileged_mutation_paths_hash,
    releaseIdentity.privilegedMutationPathsHash,
  );
  assertEqual("manifest expected role count", manifest.expected_role_count, releaseIdentity.expectedRoleCount);
  assertEqual("manifest expected roles", manifest.expected_roles_hash, releaseIdentity.expectedRolesHash);
  assertEqual("manifest writer graph", manifest.writer_graph_hash, releaseIdentity.writerGraphHash);
  assertEqual(
    "manifest config snapshot",
    manifest.config_snapshot_hash,
    poseidon([APPCHAIN_SETTLEMENT_CONFIG_DOMAIN, ...serializeAppchainSettlementConfig(config)]),
  );
  assertResolvedManifestAddresses(shellPlan, manifest);
}

function validateReleaseIdentity(plan: DeploymentAddressPlan, releaseIdentity: PinnedDeploymentReleaseIdentity): void {
  assertExactKeys("pinned release identity", releaseIdentity, [
    "rulesetId",
    "releaseBundleHash",
    "coordinator",
    "attestationRevocationRegistry",
    "worldClassHash",
    "classBundleHash",
    "schemaBundleHash",
    "authoritativeAddressInputsHash",
    "externalCounterpartCount",
    "externalCounterpartsHash",
    "privilegedMutationPathsHash",
    "expectedRoleCount",
    "expectedRolesHash",
    "writerGraphHash",
    "katanaSourceCommit",
    "genesisBlockNumber",
    "genesisParentHash",
    "genesisTimestamp",
    "genesisSequencerAddress",
    "genesisEthGasPrice",
    "genesisStrkGasPrice",
  ]);
  assertEqual("release ruleset", releaseIdentity.rulesetId, plan.rulesetId);
  assertEqual("release coordinator", releaseIdentity.coordinator, plan.predeployedCoordinator);
  assertNonzero("release bundle hash", releaseIdentity.releaseBundleHash);
  assertNonzero("attestation revocation registry", releaseIdentity.attestationRevocationRegistry);
  assertNonzero("world class hash", releaseIdentity.worldClassHash);
  assertNonzero("class bundle hash", releaseIdentity.classBundleHash);
  assertNonzero("schema bundle hash", releaseIdentity.schemaBundleHash);
  assertNonzero("authoritative address inputs hash", releaseIdentity.authoritativeAddressInputsHash);
  assertNonzero("external counterparts hash", releaseIdentity.externalCounterpartsHash);
  assertNonzero("privileged mutation paths hash", releaseIdentity.privilegedMutationPathsHash);
  assertNonzero("expected roles hash", releaseIdentity.expectedRolesHash);
  assertNonzero("writer graph hash", releaseIdentity.writerGraphHash);
  assertNonzero("Katana source commit", releaseIdentity.katanaSourceCommit);
  assertNonzero("genesis timestamp", releaseIdentity.genesisTimestamp);
  assertNonzero("genesis sequencer address", releaseIdentity.genesisSequencerAddress);
  assertNonzero("genesis ETH gas price", releaseIdentity.genesisEthGasPrice);
  assertNonzero("genesis STRK gas price", releaseIdentity.genesisStrkGasPrice);
}

function assertIdentityFields(
  plan: DeploymentAddressPlan,
  value: {
    readonly protocol_version: bigint;
    readonly deployment_id: bigint;
    readonly ruleset_id: bigint;
    readonly appchain_chain_id: bigint;
  } & ({ readonly l1_chain_id: bigint } | { readonly starknet_chain_id: bigint }),
): void {
  assertEqual("protocol version", value.protocol_version, plan.protocolVersion);
  assertEqual("deployment id", value.deployment_id, plan.deploymentId);
  assertEqual("ruleset id", value.ruleset_id, plan.rulesetId);
  assertEqual("L1 chain", "l1_chain_id" in value ? value.l1_chain_id : value.starknet_chain_id, plan.l1.chainId);
  assertEqual("appchain chain", value.appchain_chain_id, plan.l2.chainId);
}

function assertResolvedGenesisAddresses(
  shellPlan: CompiledDeploymentAddressRecipe,
  config: AppchainSettlementConfig,
): void {
  const l1ConfigFields = [
    "hardened_piltover_l1",
    "funding_vault_l1",
    "root_inbox_l1",
    "claim_router_l1",
    "resource_gateway_l1",
    "scarce_bridge_l1",
    "entitlement_vault_l1",
    "outcome_portal_l1",
    "settlement_route_registry_l1",
    "archive_quorum_l1",
  ] as const;
  const l1ComponentIndexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
  const l2ConfigFields = [
    "season_ingress_l2",
    "season_settlement_hub_l2",
    "hardened_inbox_runtime_l2",
    "forced_exit_coordinator_l2",
    "season_finalizer_l2",
    "sealed_factory_l2",
    "sealed_world_policy_l2",
    "vrf_provider_l2",
  ] as const;

  l1ConfigFields.forEach((field, index) =>
    assertEqual(`genesis ${field}`, config[field], shellPlan.l1Components[l1ComponentIndexes[index]].address),
  );
  l2ConfigFields.forEach((field, index) =>
    assertEqual(`genesis ${field}`, config[field], shellPlan.l2Components[index + 1].address),
  );
}

function assertResolvedManifestAddresses(
  shellPlan: CompiledDeploymentAddressRecipe,
  manifest: DeploymentManifest,
): void {
  DEPLOYMENT_MANIFEST_L1_COMPONENT_FIELDS.forEach((field, index) =>
    assertEqual(`manifest ${field}`, manifest[field], shellPlan.l1Components[index].address),
  );
  DEPLOYMENT_MANIFEST_L2_COMPONENT_FIELDS.forEach((field, index) =>
    assertEqual(`manifest ${field}`, manifest[field], shellPlan.l2Components[index].address),
  );
}

function assertEqual(name: string, actual: bigint, expected: bigint): void {
  if (actual !== expected) throw new Error(`${name} does not match the deterministic deployment identity`);
}

function assertNonzero(name: string, value: bigint): void {
  if (value === 0n) throw new Error(`${name} must be nonzero`);
}

function assertExactKeys(name: string, value: object, expected: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  if (actual.length !== canonical.length || actual.some((key, index) => key !== canonical[index])) {
    throw new Error(`${name} contains noncanonical fields`);
  }
}

function resolveComponents(plan: DeploymentAddressPlan, layer: DeploymentLayerPlan): readonly ResolvedShellComponent[] {
  const effectiveDeployer = layer.deployFromZero ? 0n : layer.deployer;
  return layer.componentClasses.map((component) => {
    const salt = poseidon([plan.protocolVersion, plan.deploymentId, component.componentKind]);
    const constructor = [
      plan.predeployedCoordinator,
      plan.protocolVersion,
      plan.deploymentId,
      plan.rulesetId,
      component.componentKind,
    ];
    const address = BigInt(
      hash.calculateContractAddressFromHash(
        hex(salt),
        hex(component.classHash),
        constructor.map(hex),
        hex(effectiveDeployer),
      ),
    );
    return { ...component, salt, address };
  });
}

function buildRecipe(
  plan: DeploymentAddressPlan,
  l1Components: readonly ResolvedShellComponent[],
  l2Components: readonly ResolvedShellComponent[],
): DeploymentAddressRecipe {
  return {
    protocol_version: plan.protocolVersion,
    deployment_id: plan.deploymentId,
    ruleset_id: plan.rulesetId,
    l1_chain_id: plan.l1.chainId,
    appchain_chain_id: plan.l2.chainId,
    l1_deployer: plan.l1.deployer,
    l1_deploy_from_zero: plan.l1.deployFromZero,
    l1_deployment_primitive_hash: plan.l1.deploymentPrimitiveHash,
    l2_deployer: plan.l2.deployer,
    l2_deploy_from_zero: plan.l2.deployFromZero,
    l2_deployment_primitive_hash: plan.l2.deploymentPrimitiveHash,
    l1_component_count: BigInt(l1Components.length),
    l1_component_classes_hash: hashClasses(l1Components),
    l1_component_salts_hash: hashSalts(l1Components),
    l2_component_count: BigInt(l2Components.length),
    l2_component_classes_hash: hashClasses(l2Components),
    l2_component_salts_hash: hashSalts(l2Components),
    shell_constructor_schema_hash: shellConstructorSchemaHash(),
  };
}

function serializeRecipe(recipe: DeploymentAddressRecipe): readonly bigint[] {
  return [
    recipe.protocol_version,
    recipe.deployment_id,
    recipe.ruleset_id,
    recipe.l1_chain_id,
    recipe.appchain_chain_id,
    recipe.l1_deployer,
    recipe.l1_deploy_from_zero ? 1n : 0n,
    recipe.l1_deployment_primitive_hash,
    recipe.l2_deployer,
    recipe.l2_deploy_from_zero ? 1n : 0n,
    recipe.l2_deployment_primitive_hash,
    recipe.l1_component_count,
    recipe.l1_component_classes_hash,
    recipe.l1_component_salts_hash,
    recipe.l2_component_count,
    recipe.l2_component_classes_hash,
    recipe.l2_component_salts_hash,
    recipe.shell_constructor_schema_hash,
  ];
}

function serializeAppchainSettlementConfig(config: AppchainSettlementConfig): readonly bigint[] {
  return [
    config.protocol_version,
    config.deployment_id,
    config.season_id,
    config.ruleset_id,
    config.release_bundle_hash,
    config.starknet_chain_id,
    config.appchain_chain_id,
    config.hardened_piltover_l1,
    config.coordinator_l1,
    config.funding_vault_l1,
    config.root_inbox_l1,
    config.claim_router_l1,
    config.resource_gateway_l1,
    config.scarce_bridge_l1,
    config.entitlement_vault_l1,
    config.outcome_portal_l1,
    config.settlement_route_registry_l1,
    config.archive_quorum_l1,
    config.attestation_revocation_registry_l1,
    config.hardened_inbox_runtime_l2,
    config.season_ingress_l2,
    config.season_settlement_hub_l2,
    config.forced_exit_coordinator_l2,
    config.season_finalizer_l2,
    config.sealed_factory_l2,
    config.sealed_world_policy_l2,
    config.vrf_provider_l2,
    config.vrf_public_key_hash,
    config.appchain_component_classes_hash,
    config.class_binding_count,
    config.class_bindings_hash,
    config.schema_bundle_hash,
    config.asset_policy_count,
    config.asset_policies_hash,
    config.backing_policy_count,
    config.backing_policies_hash,
    config.payout_purpose_policy_count,
    config.payout_purpose_policies_hash,
    config.writer_capability_count,
    config.writer_capabilities_hash,
    config.capacity_entry_count,
    config.capacity_root,
    config.sealed_game_recipe_hash,
    config.intended_start,
    config.intended_end,
    config.max_games,
    config.initial_inbox_cursor,
    config.initial_outbox_cursor,
    config.timing_policy_hash,
    config.economics_policy_hash,
    config.vrf_policy_hash,
    config.recovery_policy_hash,
  ];
}

function serializeManifest(manifest: DeploymentManifest): readonly bigint[] {
  return [
    manifest.protocol_version,
    manifest.deployment_id,
    manifest.ruleset_id,
    manifest.release_bundle_hash,
    manifest.address_recipe_hash,
    manifest.l1_chain_id,
    manifest.appchain_chain_id,
    manifest.hardened_piltover,
    manifest.coordinator,
    manifest.funding_vault,
    manifest.root_inbox,
    manifest.claim_router,
    manifest.resource_gateway,
    manifest.scarce_bridge,
    manifest.entitlement_vault,
    manifest.outcome_portal,
    manifest.settlement_route_registry,
    manifest.archive_quorum,
    manifest.mmr_settlement_router,
    manifest.mmr_settlement_module,
    manifest.attestation_revocation_registry,
    manifest.exit_verifier,
    manifest.dormant_reserve,
    manifest.settlement_config_l2,
    manifest.settlement_ingress_l2,
    manifest.settlement_hub_l2,
    manifest.hardened_inbox_runtime_l2,
    manifest.forced_exit_coordinator_l2,
    manifest.season_finalizer_l2,
    manifest.sealed_factory_l2,
    manifest.world_policy_l2,
    manifest.vrf_l2,
    manifest.world_class_hash,
    manifest.class_bundle_hash,
    manifest.schema_bundle_hash,
    manifest.authoritative_address_inputs_hash,
    manifest.external_counterpart_count,
    manifest.external_counterparts_hash,
    manifest.privileged_mutation_paths_hash,
    manifest.expected_role_count,
    manifest.expected_roles_hash,
    manifest.writer_graph_hash,
    manifest.config_snapshot_hash,
    manifest.genesis_hash,
  ];
}

function serializeKatanaGenesisArtifact(artifact: KatanaGenesisArtifactCommitment): readonly bigint[] {
  return [
    artifact.katanaSourceCommit,
    artifact.chainId,
    artifact.blockNumber,
    artifact.parentHash,
    artifact.timestamp,
    artifact.sequencerAddress,
    artifact.ethGasPrice,
    artifact.strkGasPrice,
    artifact.classDeclarationCount,
    artifact.classDeclarationsHash,
    artifact.contractAllocationCount,
    artifact.contractAllocationsHash,
    artifact.storageWriteCount,
    artifact.storageWritesHash,
    artifact.configHash,
    artifact.stateRoot,
  ];
}

interface DeployerGenesisStorageWrite {
  readonly contractAddress: bigint;
  readonly storageKey: bigint;
  readonly value: bigint;
}

interface DeployerGenesisAllocation {
  readonly contractAddress: bigint;
  readonly classHash: bigint;
  readonly nonce: bigint;
  readonly storageWrites: readonly DeployerGenesisStorageWrite[];
}

function deriveKatanaGenesisInventory(
  l2Components: readonly ResolvedShellComponent[],
  config: AppchainSettlementConfig,
) {
  const classHashes = [...new Set(l2Components.map((component) => component.classHash))].sort(compareBigints);
  const allocations = deriveKatanaGenesisAllocations(l2Components, config);
  const storageWrites = allocations.flatMap((allocation) => allocation.storageWrites);
  return {
    classDeclarationCount: BigInt(classHashes.length),
    classDeclarationsHash: poseidon([
      KATANA_GENESIS_CLASS_DECLARATIONS_DOMAIN,
      BigInt(classHashes.length),
      ...classHashes,
    ]),
    contractAllocationCount: BigInt(allocations.length),
    contractAllocationsHash: hashKatanaGenesisAllocations(allocations),
    storageWriteCount: BigInt(storageWrites.length),
    storageWritesHash: hashKatanaGenesisStorageWrites(storageWrites),
  };
}

function deriveKatanaGenesisAllocations(
  components: readonly ResolvedShellComponent[],
  config: AppchainSettlementConfig,
): readonly DeployerGenesisAllocation[] {
  const configValues = serializeAppchainSettlementConfig(config);
  return components
    .map((component) => {
      const identityWrites = [
        deployerStorageWrite(component.address, "coordinator", [], config.coordinator_l1),
        deployerStorageWrite(component.address, "protocol_version", [], config.protocol_version),
        deployerStorageWrite(component.address, "deployment_id", [], config.deployment_id),
        deployerStorageWrite(component.address, "ruleset_id", [], config.ruleset_id),
        deployerStorageWrite(component.address, "component_kind", [], component.componentKind),
      ];
      const configWrites =
        component.componentKind === 101n
          ? configValues.map((value, index) =>
              deployerStorageWrite(component.address, "genesis_config", [BigInt(index)], value),
            )
          : [];
      return {
        contractAddress: component.address,
        classHash: component.classHash,
        nonce: 0n,
        storageWrites: [...identityWrites, ...configWrites].sort((left, right) =>
          compareBigints(left.storageKey, right.storageKey),
        ),
      };
    })
    .sort((left, right) => compareBigints(left.contractAddress, right.contractAddress));
}

function hashKatanaGenesisAllocations(allocations: readonly DeployerGenesisAllocation[]): bigint {
  return poseidon([
    KATANA_GENESIS_CONTRACT_ALLOCATIONS_DOMAIN,
    BigInt(allocations.length),
    ...allocations.flatMap((allocation) => [
      allocation.contractAddress,
      allocation.classHash,
      allocation.nonce,
      BigInt(allocation.storageWrites.length),
      hashKatanaGenesisStorageWrites(allocation.storageWrites),
    ]),
  ]);
}

function hashKatanaGenesisStorageWrites(writes: readonly DeployerGenesisStorageWrite[]): bigint {
  return poseidon([
    KATANA_GENESIS_STORAGE_WRITES_DOMAIN,
    BigInt(writes.length),
    ...writes.flatMap((write) => [write.contractAddress, write.storageKey, write.value]),
  ]);
}

function deployerStorageWrite(
  contractAddress: bigint,
  name: string,
  arguments_: readonly bigint[],
  value: bigint,
): DeployerGenesisStorageWrite {
  return { contractAddress, storageKey: storageVariableAddress(name, arguments_), value };
}

function storageVariableAddress(name: string, arguments_: readonly bigint[]): bigint {
  let address = hash.starknetKeccak(name);
  for (const argument of arguments_) address = BigInt(hash.computePedersenHash(hex(address), hex(argument)));
  return address % STORAGE_ADDRESS_BOUND;
}

function compareBigints(left: bigint, right: bigint): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function hashClasses(components: readonly ResolvedShellComponent[]): bigint {
  return poseidon([
    COMPONENT_CLASSES_DOMAIN,
    BigInt(components.length),
    ...components.flatMap(({ componentKind, classHash }) => [componentKind, classHash]),
  ]);
}

function hashSalts(components: readonly ResolvedShellComponent[]): bigint {
  return poseidon([
    COMPONENT_SALTS_DOMAIN,
    BigInt(components.length),
    ...components.flatMap(({ componentKind, salt }) => [componentKind, salt]),
  ]);
}

function shellConstructorSchemaHash(): bigint {
  return poseidon([SHELL_CONSTRUCTOR_SCHEMA_DOMAIN, ...SHELL_CONSTRUCTOR_SCHEMA_FIELDS.map((field) => felt(field))]);
}

function poseidon(elements: readonly bigint[]): bigint {
  return BigInt(hash.computePoseidonHashOnElements(elements.map(hex)));
}

function felt(value: string): bigint {
  return BigInt(shortString.encodeShortString(value));
}

function hex(value: bigint): string {
  return `0x${value.toString(16)}`;
}
