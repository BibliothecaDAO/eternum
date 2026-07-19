import { hash, shortString } from "starknet";
import { encodeFlatSchema } from "./codec";
import type { AppchainSettlementConfig, DeploymentAddressRecipe, DeploymentManifest } from "./generated-types";

const ADDRESS_RECIPE_DOMAIN = encodeShortString("DEPLOYMENT_ADDRESS_RECIPE_V1");
const MANIFEST_DOMAIN = encodeShortString("DEPLOYMENT_MANIFEST_V1");
const DEPLOYMENT_RELEASE_IDENTITY_DOMAIN = encodeShortString("DEPLOYMENT_RELEASE_IDENTITY_V1");
const APPCHAIN_SETTLEMENT_CONFIG_DOMAIN = encodeShortString("APPCHAIN_SETTLEMENT_CONFIG_V1");
const KATANA_GENESIS_ARTIFACT_DOMAIN = encodeShortString("KATANA_GENESIS_ARTIFACT_V1");
const KATANA_GENESIS_PROFILE_DOMAIN = encodeShortString("KATANA_GENESIS_PROFILE_V1");
const KATANA_GENESIS_CLASS_DECLARATIONS_DOMAIN = encodeShortString("KATANA_GENESIS_CLASSES_V1");
const KATANA_GENESIS_CONTRACT_ALLOCATIONS_DOMAIN = encodeShortString("KATANA_GENESIS_CONTRACTS_V1");
const KATANA_GENESIS_STORAGE_WRITES_DOMAIN = encodeShortString("KATANA_GENESIS_STORAGE_V1");
const COMPONENT_CLASSES_DOMAIN = encodeShortString("DEPLOYMENT_COMPONENT_CLASSES_V1");
const COMPONENT_SALTS_DOMAIN = encodeShortString("DEPLOYMENT_COMPONENT_SALTS_V1");
const SHELL_CONSTRUCTOR_SCHEMA_DOMAIN = encodeShortString("SHELL_CONSTRUCTOR_SCHEMA_V1");
const SHELL_CONSTRUCTOR_SCHEMA_FIELDS = ["ContractAddress", "u16", "DeploymentId", "felt252", "felt252"] as const;

export const DEPLOYMENT_MANIFEST_L1_COMPONENT_FIELDS = [
  "hardened_piltover",
  "funding_vault",
  "root_inbox",
  "claim_router",
  "resource_gateway",
  "scarce_bridge",
  "entitlement_vault",
  "outcome_portal",
  "settlement_route_registry",
  "archive_quorum",
  "mmr_settlement_router",
  "mmr_settlement_module",
  "exit_verifier",
  "dormant_reserve",
] as const;

export const DEPLOYMENT_MANIFEST_L2_COMPONENT_FIELDS = [
  "settlement_config_l2",
  "settlement_ingress_l2",
  "settlement_hub_l2",
  "hardened_inbox_runtime_l2",
  "forced_exit_coordinator_l2",
  "season_finalizer_l2",
  "sealed_factory_l2",
  "world_policy_l2",
  "vrf_l2",
] as const;

export interface ComponentClassEntry {
  readonly componentKind: bigint;
  readonly classHash: bigint;
}

export interface DeploymentLayerPlan {
  readonly chainId: bigint;
  readonly deployer: bigint;
  readonly deployFromZero: boolean;
  readonly deploymentPrimitiveHash: bigint;
  readonly componentKinds: readonly bigint[];
  readonly componentClasses: readonly ComponentClassEntry[];
}

export interface DeploymentAddressPlan {
  readonly protocolVersion: bigint;
  readonly deploymentId: bigint;
  readonly rulesetId: bigint;
  readonly predeployedCoordinator: bigint;
  readonly l1: DeploymentLayerPlan;
  readonly l2: DeploymentLayerPlan;
}

export type ApprovedDeploymentAddressInputs = Omit<DeploymentAddressPlan, "deploymentId">;

export interface ResolvedShellComponent extends ComponentClassEntry {
  readonly salt: bigint;
  readonly address: bigint;
}

export interface CompiledDeploymentAddressRecipe {
  readonly recipe: DeploymentAddressRecipe;
  readonly recipeHash: bigint;
  readonly l1Components: readonly ResolvedShellComponent[];
  readonly l2Components: readonly ResolvedShellComponent[];
}

export interface KatanaGenesisClassDeclaration {
  readonly classHash: bigint;
}

export interface KatanaGenesisStorageWrite {
  readonly contractAddress: bigint;
  readonly storageKey: bigint;
  readonly value: bigint;
}

export interface KatanaGenesisContractAllocation {
  readonly contractAddress: bigint;
  readonly classHash: bigint;
  readonly nonce: bigint;
  readonly storageWrites: readonly KatanaGenesisStorageWrite[];
}

export interface KatanaGenesisArtifactCommitment {
  readonly katanaSourceCommit: bigint;
  readonly chainId: bigint;
  readonly blockNumber: bigint;
  readonly parentHash: bigint;
  readonly timestamp: bigint;
  readonly sequencerAddress: bigint;
  readonly ethGasPrice: bigint;
  readonly strkGasPrice: bigint;
  readonly classDeclarationCount: bigint;
  readonly classDeclarationsHash: bigint;
  readonly contractAllocationCount: bigint;
  readonly contractAllocationsHash: bigint;
  readonly storageWriteCount: bigint;
  readonly storageWritesHash: bigint;
  readonly configHash: bigint;
  readonly stateRoot: bigint;
}

type DeploymentIdentityFields = Pick<DeploymentAddressRecipe, "protocol_version" | "deployment_id" | "ruleset_id">;

export function compileDeploymentAddressRecipe(
  plan: DeploymentAddressPlan,
  approvedInputs: ApprovedDeploymentAddressInputs,
): CompiledDeploymentAddressRecipe {
  validateAddressPlan(plan);
  validateAddressPlan({ ...approvedInputs, deploymentId: plan.deploymentId });
  assertPlanMatchesApprovedInputs(plan, approvedInputs);
  const l1Components = resolveLayerComponents(plan, plan.l1);
  const l2Components = resolveLayerComponents(plan, plan.l2);
  const recipe = buildAddressRecipe(plan, l1Components, l2Components);
  const recipeHash = poseidon([ADDRESS_RECIPE_DOMAIN, ...encodeFlatSchema("DeploymentAddressRecipe", recipe)]);
  return { recipe, recipeHash, l1Components, l2Components };
}

function validateAddressPlan(plan: DeploymentAddressPlan): void {
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
  validateLayerPlan("l1", plan.l1);
  validateLayerPlan("l2", plan.l2);
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

export function buildShellConstructor(
  predeployedCoordinator: bigint,
  recipe: DeploymentIdentityFields,
  componentKind: bigint,
): readonly bigint[] {
  assertNonzero("predeployed coordinator", predeployedCoordinator);
  assertNonzero("component kind", componentKind);
  return [predeployedCoordinator, recipe.protocol_version, recipe.deployment_id, recipe.ruleset_id, componentKind];
}

export function assertCanonicalShellConstructor(
  predeployedCoordinator: bigint,
  recipe: DeploymentIdentityFields,
  componentKind: bigint,
  calldata: readonly bigint[],
): void {
  const canonical = buildShellConstructor(predeployedCoordinator, recipe, componentKind);
  if (calldata.length !== canonical.length || calldata.some((felt, index) => felt !== canonical[index])) {
    throw new Error("noncanonical shell constructor");
  }
}

export function hashAppchainSettlementConfig(config: AppchainSettlementConfig): bigint {
  return poseidon([APPCHAIN_SETTLEMENT_CONFIG_DOMAIN, ...encodeFlatSchema("AppchainSettlementConfig", config)]);
}

export function buildKatanaGenesisArtifactCommitment(
  source: Omit<
    KatanaGenesisArtifactCommitment,
    | "classDeclarationCount"
    | "classDeclarationsHash"
    | "contractAllocationCount"
    | "contractAllocationsHash"
    | "storageWriteCount"
    | "storageWritesHash"
  >,
  classes: readonly KatanaGenesisClassDeclaration[],
  allocations: readonly KatanaGenesisContractAllocation[],
): KatanaGenesisArtifactCommitment {
  validateKatanaGenesisRecords(classes, allocations);
  const storageWrites = allocations.flatMap((allocation) => allocation.storageWrites);
  return {
    ...source,
    classDeclarationCount: BigInt(classes.length),
    classDeclarationsHash: hashKatanaGenesisClassDeclarations(classes),
    contractAllocationCount: BigInt(allocations.length),
    contractAllocationsHash: hashKatanaGenesisContractAllocations(allocations),
    storageWriteCount: BigInt(storageWrites.length),
    storageWritesHash: hashKatanaGenesisStorageWrites(storageWrites),
  };
}

export function hashKatanaGenesisArtifact(artifact: KatanaGenesisArtifactCommitment): bigint {
  return poseidon([
    KATANA_GENESIS_ARTIFACT_DOMAIN,
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
  ]);
}

export function hashDeploymentManifest(manifest: DeploymentManifest): bigint {
  return poseidon([MANIFEST_DOMAIN, ...encodeFlatSchema("DeploymentManifest", manifest)]);
}

export function hashDeploymentReleaseIdentity(manifest: DeploymentManifest): bigint {
  return poseidon([
    DEPLOYMENT_RELEASE_IDENTITY_DOMAIN,
    manifest.coordinator,
    manifest.attestation_revocation_registry,
    manifest.release_bundle_hash,
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
  ]);
}

export function hashKatanaGenesisProfile(artifact: KatanaGenesisArtifactCommitment): bigint {
  return poseidon([
    KATANA_GENESIS_PROFILE_DOMAIN,
    artifact.katanaSourceCommit,
    artifact.chainId,
    artifact.blockNumber,
    artifact.parentHash,
    artifact.timestamp,
    artifact.sequencerAddress,
    artifact.ethGasPrice,
    artifact.strkGasPrice,
  ]);
}

export function deriveComponentSalt(protocolVersion: bigint, deploymentId: bigint, componentKind: bigint): bigint {
  assertNonzero("component kind", componentKind);
  return poseidon([protocolVersion, deploymentId, componentKind]);
}

export function shellConstructorSchemaHash(): bigint {
  return poseidon([
    SHELL_CONSTRUCTOR_SCHEMA_DOMAIN,
    ...SHELL_CONSTRUCTOR_SCHEMA_FIELDS.map((field) => encodeShortString(field)),
  ]);
}

function buildAddressRecipe(
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
    l1_component_classes_hash: hashComponentClasses(l1Components),
    l1_component_salts_hash: hashComponentSalts(l1Components),
    l2_component_count: BigInt(l2Components.length),
    l2_component_classes_hash: hashComponentClasses(l2Components),
    l2_component_salts_hash: hashComponentSalts(l2Components),
    shell_constructor_schema_hash: shellConstructorSchemaHash(),
  };
}

function resolveLayerComponents(
  plan: DeploymentAddressPlan,
  layer: DeploymentLayerPlan,
): readonly ResolvedShellComponent[] {
  const effectiveDeployer = layer.deployFromZero ? 0n : layer.deployer;
  return layer.componentClasses.map((component) => {
    const salt = deriveComponentSalt(plan.protocolVersion, plan.deploymentId, component.componentKind);
    const constructor = buildShellConstructor(
      plan.predeployedCoordinator,
      recipeIdentity(plan),
      component.componentKind,
    );
    const address = BigInt(
      hash.calculateContractAddressFromHash(
        toHex(salt),
        toHex(component.classHash),
        constructor.map(toHex),
        toHex(effectiveDeployer),
      ),
    );
    return { ...component, salt, address };
  });
}

function recipeIdentity(plan: DeploymentAddressPlan): DeploymentIdentityFields {
  return {
    protocol_version: plan.protocolVersion,
    deployment_id: plan.deploymentId,
    ruleset_id: plan.rulesetId,
  };
}

function validateLayerPlan(layerName: string, layer: DeploymentLayerPlan): void {
  assertExactKeys(`${layerName} deployment layer`, layer, [
    "chainId",
    "deployer",
    "deployFromZero",
    "deploymentPrimitiveHash",
    "componentKinds",
    "componentClasses",
  ]);
  assertNonzero(`${layerName} chain id`, layer.chainId);
  assertNonzero(`${layerName} deployer`, layer.deployer);
  if (layer.deploymentPrimitiveHash === undefined || layer.deploymentPrimitiveHash === 0n) {
    throw new Error(`${layerName} deployment primitive must be explicit`);
  }
  if (layer.componentKinds.length === 0 || layer.componentKinds.length > 255) {
    throw new Error(`${layerName} component count out of bounds`);
  }
  const uniqueKinds = new Set(layer.componentKinds);
  if (uniqueKinds.size !== layer.componentKinds.length || layer.componentKinds.some((kind) => kind === 0n)) {
    throw new Error(`${layerName} duplicate component kind`);
  }
  const classKinds = layer.componentClasses.map((component) => component.componentKind);
  if (
    classKinds.length !== layer.componentKinds.length ||
    classKinds.some((kind, index) => kind !== layer.componentKinds[index])
  ) {
    throw new Error(`${layerName} component class order mismatch`);
  }
  if (layer.componentClasses.some((component) => component.classHash === 0n)) {
    throw new Error(`${layerName} zero component class`);
  }
  for (const component of layer.componentClasses) {
    assertExactKeys(`${layerName} component class`, component, ["componentKind", "classHash"]);
  }
}

function assertExactKeys(name: string, value: object, expected: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  if (actual.length !== canonical.length || actual.some((key, index) => key !== canonical[index])) {
    throw new Error(`${name} contains noncanonical fields`);
  }
}

function hashComponentClasses(components: readonly ResolvedShellComponent[]): bigint {
  return poseidon([
    COMPONENT_CLASSES_DOMAIN,
    BigInt(components.length),
    ...components.flatMap(({ componentKind, classHash }) => [componentKind, classHash]),
  ]);
}

function hashComponentSalts(components: readonly ResolvedShellComponent[]): bigint {
  return poseidon([
    COMPONENT_SALTS_DOMAIN,
    BigInt(components.length),
    ...components.flatMap(({ componentKind, salt }) => [componentKind, salt]),
  ]);
}

function hashKatanaGenesisClassDeclarations(classes: readonly KatanaGenesisClassDeclaration[]): bigint {
  return poseidon([
    KATANA_GENESIS_CLASS_DECLARATIONS_DOMAIN,
    BigInt(classes.length),
    ...classes.map((declaration) => declaration.classHash),
  ]);
}

function hashKatanaGenesisContractAllocations(allocations: readonly KatanaGenesisContractAllocation[]): bigint {
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

function hashKatanaGenesisStorageWrites(writes: readonly KatanaGenesisStorageWrite[]): bigint {
  return poseidon([
    KATANA_GENESIS_STORAGE_WRITES_DOMAIN,
    BigInt(writes.length),
    ...writes.flatMap((write) => [write.contractAddress, write.storageKey, write.value]),
  ]);
}

function validateKatanaGenesisRecords(
  classes: readonly KatanaGenesisClassDeclaration[],
  allocations: readonly KatanaGenesisContractAllocation[],
): void {
  if (classes.length === 0 || classes.some((declaration) => declaration.classHash === 0n)) {
    throw new Error("Katana genesis must declare nonzero classes");
  }
  assertStrictlyIncreasing(
    "Katana genesis class declarations",
    classes.map((declaration) => declaration.classHash),
  );
  assertStrictlyIncreasing(
    "Katana genesis contract allocations",
    allocations.map((allocation) => allocation.contractAddress),
  );
  for (const allocation of allocations) {
    if (allocation.classHash === 0n) throw new Error("Katana genesis allocation class must be nonzero");
    if (allocation.storageWrites.some((write) => write.contractAddress !== allocation.contractAddress)) {
      throw new Error("Katana genesis storage write belongs to a different allocation");
    }
    assertStrictlyIncreasing(
      "Katana genesis storage writes",
      allocation.storageWrites.map((write) => write.storageKey),
    );
  }
}

function assertStrictlyIncreasing(name: string, values: readonly bigint[]): void {
  if (values.some((value, index) => value === 0n || (index > 0 && value <= values[index - 1]))) {
    throw new Error(`${name} must be nonzero, unique, and sorted`);
  }
}

function poseidon(elements: readonly bigint[]): bigint {
  return BigInt(hash.computePoseidonHashOnElements(elements.map(toHex)));
}

function encodeShortString(value: string): bigint {
  return BigInt(shortString.encodeShortString(value));
}

function assertNonzero(name: string, value: bigint): void {
  if (value === 0n) throw new Error(`${name} must be nonzero`);
}

function toHex(value: bigint): string {
  return `0x${value.toString(16)}`;
}
