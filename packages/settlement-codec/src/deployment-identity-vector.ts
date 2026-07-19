import type { AppchainSettlementConfig, DeploymentManifest } from "./generated-types";
import { hash } from "starknet";
import { encodeFlatSchema } from "./codec";
import {
  buildKatanaGenesisArtifactCommitment,
  compileDeploymentAddressRecipe,
  DEPLOYMENT_MANIFEST_L1_COMPONENT_FIELDS,
  DEPLOYMENT_MANIFEST_L2_COMPONENT_FIELDS,
  hashDeploymentManifest,
  hashDeploymentReleaseIdentity,
  hashAppchainSettlementConfig,
  hashKatanaGenesisArtifact,
  hashKatanaGenesisProfile,
  type ApprovedDeploymentAddressInputs,
  type DeploymentAddressPlan,
  type ResolvedShellComponent,
} from "./deployment-identity";

const KATANA_SOURCE_COMMIT = BigInt("0x7882660a91e776ccacdc0e2e3fe2469f6b4df096");
const DETERMINISTIC_SHELL_CLASS_HASH = BigInt("0x0693fb061b3e60cd4cf1c7caa2f0428d82a2fb599133befe678a7f827ed889ae");
const A18_KATANA_GENESIS_STATE_ROOT = 268091293760204763631382757931779078794118851212906591280343453994588570303n;
const STORAGE_ADDRESS_BOUND = (1n << 251n) - 256n;
const KATANA_GENESIS_BLOCK = {
  number: 0n,
  parentHash: 0n,
  timestamp: 1_800_000_000n,
  sequencerAddress: 8503n,
  ethGasPrice: 1n,
  strkGasPrice: 1n,
} as const;

export const A18_L1_COMPONENT_FIELDS = DEPLOYMENT_MANIFEST_L1_COMPONENT_FIELDS;
export const A18_L2_COMPONENT_FIELDS = DEPLOYMENT_MANIFEST_L2_COMPONENT_FIELDS;

export const A18_RELEASE_IDENTITY = {
  rulesetId: 8001n,
  releaseBundleHash: 13001n,
  coordinator: 8501n,
  attestationRevocationRegistry: 8502n,
  worldClassHash: 13016n,
  classBundleHash: 13017n,
  schemaBundleHash: 13005n,
  authoritativeAddressInputsHash: 13018n,
  externalCounterpartCount: 0n,
  externalCounterpartsHash: 13019n,
  privilegedMutationPathsHash: 13020n,
  expectedRoleCount: 1n,
  expectedRolesHash: 13021n,
  writerGraphHash: 13022n,
  katanaSourceCommit: KATANA_SOURCE_COMMIT,
  genesisBlockNumber: KATANA_GENESIS_BLOCK.number,
  genesisParentHash: KATANA_GENESIS_BLOCK.parentHash,
  genesisTimestamp: KATANA_GENESIS_BLOCK.timestamp,
  genesisSequencerAddress: KATANA_GENESIS_BLOCK.sequencerAddress,
  genesisEthGasPrice: KATANA_GENESIS_BLOCK.ethGasPrice,
  genesisStrkGasPrice: KATANA_GENESIS_BLOCK.strkGasPrice,
} as const;

export const A18_APPROVED_ADDRESS_INPUTS: ApprovedDeploymentAddressInputs = {
  protocolVersion: 1n,
  rulesetId: A18_RELEASE_IDENTITY.rulesetId,
  predeployedCoordinator: A18_RELEASE_IDENTITY.coordinator,
  l1: {
    chainId: 9001n,
    deployer: 10001n,
    deployFromZero: false,
    deploymentPrimitiveHash: 11001n,
    componentKinds: A18_L1_COMPONENT_FIELDS.map((_, index) => BigInt(index + 1)),
    componentClasses: A18_L1_COMPONENT_FIELDS.map((_, index) => ({
      componentKind: BigInt(index + 1),
      classHash: DETERMINISTIC_SHELL_CLASS_HASH,
    })),
  },
  l2: {
    chainId: 9002n,
    deployer: 10002n,
    deployFromZero: true,
    deploymentPrimitiveHash: 11002n,
    componentKinds: A18_L2_COMPONENT_FIELDS.map((_, index) => BigInt(index + 101)),
    componentClasses: A18_L2_COMPONENT_FIELDS.map((_, index) => ({
      componentKind: BigInt(index + 101),
      classHash: DETERMINISTIC_SHELL_CLASS_HASH,
    })),
  },
};

export const A18_DEPLOYMENT_PLAN: DeploymentAddressPlan = {
  ...A18_APPROVED_ADDRESS_INPUTS,
  deploymentId: 7001n,
};

export function buildA18DeploymentIdentityVector() {
  const genesis = buildA18GenesisInputs(A18_KATANA_GENESIS_STATE_ROOT);
  const { compiled, l1Addresses, l2Addresses, genesisConfig, genesisArtifact, genesisHash } = genesis;
  const manifest = buildManifest(
    compiled.recipeHash,
    genesisArtifact.configHash,
    genesisHash,
    l1Addresses,
    l2Addresses,
  );
  const manifestHash = hashDeploymentManifest(manifest);

  return {
    version: 1,
    buildOrder: ["address_recipe", "shell_addresses", "genesis", "manifest", "seal"] as const,
    l1ComponentFields: A18_L1_COMPONENT_FIELDS,
    l2ComponentFields: A18_L2_COMPONENT_FIELDS,
    releaseIdentity: A18_RELEASE_IDENTITY,
    approvedAddressInputs: A18_APPROVED_ADDRESS_INPUTS,
    plan: A18_DEPLOYMENT_PLAN,
    recipe: compiled.recipe,
    recipeHash: compiled.recipeHash,
    l1Components: compiled.l1Components,
    l2Components: compiled.l2Components,
    genesisConfig,
    genesisArtifact,
    katanaGenesisArtifact: "katana-genesis-a18-v1.json",
    genesisHash,
    manifest,
    manifestHash,
    coordinatorApproval: {
      addressRecipeHash: compiled.recipeHash,
      releaseIdentityHash: hashDeploymentReleaseIdentity(manifest),
      genesisProfileHash: hashKatanaGenesisProfile(genesisArtifact),
      genesisHash,
    },
    seal: {
      coordinator: A18_DEPLOYMENT_PLAN.predeployedCoordinator,
      addressRecipeHash: compiled.recipeHash,
      manifestHash,
      genesisHash,
    },
  };
}

export function buildA18GenesisInputs(stateRoot: bigint) {
  const compiled = compileDeploymentAddressRecipe(A18_DEPLOYMENT_PLAN, A18_APPROVED_ADDRESS_INPUTS);
  const l1Addresses = mapAddresses(A18_L1_COMPONENT_FIELDS, compiled.l1Components);
  const l2Addresses = mapAddresses(A18_L2_COMPONENT_FIELDS, compiled.l2Components);
  const genesisConfig = buildGenesisConfig(compiled.recipe.l2_component_classes_hash, l1Addresses, l2Addresses);
  const allocations = buildKatanaContractAllocations(compiled.l2Components, genesisConfig);
  const classes = [{ classHash: DETERMINISTIC_SHELL_CLASS_HASH }];
  const genesisArtifact = buildKatanaGenesisArtifactCommitment(
    {
      katanaSourceCommit: KATANA_SOURCE_COMMIT,
      chainId: A18_DEPLOYMENT_PLAN.l2.chainId,
      blockNumber: KATANA_GENESIS_BLOCK.number,
      parentHash: KATANA_GENESIS_BLOCK.parentHash,
      timestamp: KATANA_GENESIS_BLOCK.timestamp,
      sequencerAddress: KATANA_GENESIS_BLOCK.sequencerAddress,
      ethGasPrice: KATANA_GENESIS_BLOCK.ethGasPrice,
      strkGasPrice: KATANA_GENESIS_BLOCK.strkGasPrice,
      configHash: hashAppchainSettlementConfig(genesisConfig),
      stateRoot,
    },
    classes,
    allocations,
  );
  const katanaGenesis = buildKatanaGenesisDocument(stateRoot, allocations);
  return {
    compiled,
    l1Addresses,
    l2Addresses,
    genesisConfig,
    genesisArtifact,
    katanaGenesis,
    genesisHash: hashKatanaGenesisArtifact(genesisArtifact),
  };
}

export function a18DeterministicShellClassHash(): bigint {
  return DETERMINISTIC_SHELL_CLASS_HASH;
}

export function a18KatanaSourceCommit(): bigint {
  return KATANA_SOURCE_COMMIT;
}

function buildKatanaContractAllocations(
  l2Components: readonly ResolvedShellComponent[],
  genesisConfig: AppchainSettlementConfig,
) {
  const configValues = encodeFlatSchema("AppchainSettlementConfig", genesisConfig);
  return l2Components
    .map((component) => {
      const identityWrites = [
        storageWrite(component.address, "coordinator", [], A18_DEPLOYMENT_PLAN.predeployedCoordinator),
        storageWrite(component.address, "protocol_version", [], A18_DEPLOYMENT_PLAN.protocolVersion),
        storageWrite(component.address, "deployment_id", [], A18_DEPLOYMENT_PLAN.deploymentId),
        storageWrite(component.address, "ruleset_id", [], A18_DEPLOYMENT_PLAN.rulesetId),
        storageWrite(component.address, "component_kind", [], component.componentKind),
      ];
      const configWrites =
        component.componentKind === 101n
          ? configValues.map((value, index) =>
              storageWrite(component.address, "genesis_config", [BigInt(index)], value),
            )
          : [];
      return {
        contractAddress: component.address,
        classHash: component.classHash,
        nonce: 0n,
        storageWrites: [...identityWrites, ...configWrites].sort(compareStorageWrites),
      };
    })
    .sort((left, right) => compareBigints(left.contractAddress, right.contractAddress));
}

function buildKatanaGenesisDocument(stateRoot: bigint, allocations: ReturnType<typeof buildKatanaContractAllocations>) {
  return {
    number: Number(KATANA_GENESIS_BLOCK.number),
    parentHash: toHex(KATANA_GENESIS_BLOCK.parentHash),
    timestamp: Number(KATANA_GENESIS_BLOCK.timestamp),
    stateRoot: toHex(stateRoot),
    sequencerAddress: toHex(KATANA_GENESIS_BLOCK.sequencerAddress),
    gasPrices: {
      ETH: Number(KATANA_GENESIS_BLOCK.ethGasPrice),
      STRK: Number(KATANA_GENESIS_BLOCK.strkGasPrice),
    },
    accounts: {},
    contracts: Object.fromEntries(
      allocations.map((allocation) => [
        toHex(allocation.contractAddress),
        {
          class: "DeterministicShellSpike",
          nonce: toHex(allocation.nonce),
          storage: Object.fromEntries(
            allocation.storageWrites.map((write) => [toHex(write.storageKey), toHex(write.value)]),
          ),
        },
      ]),
    ),
    classes: [
      {
        name: "DeterministicShellSpike",
        class:
          "../../../contracts/settlement_protocol/target/dev/settlement_protocol_DeterministicShellSpike.contract_class.json",
      },
    ],
  } as const;
}

function storageWrite(contractAddress: bigint, name: string, args: readonly bigint[], value: bigint) {
  return { contractAddress, storageKey: storageVariableAddress(name, args), value };
}

function storageVariableAddress(name: string, args: readonly bigint[]): bigint {
  let address = hash.starknetKeccak(name);
  for (const argument of args) address = BigInt(hash.computePedersenHash(toHex(address), toHex(argument)));
  return address % STORAGE_ADDRESS_BOUND;
}

function compareStorageWrites(left: { storageKey: bigint }, right: { storageKey: bigint }): number {
  return compareBigints(left.storageKey, right.storageKey);
}

function compareBigints(left: bigint, right: bigint): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function toHex(value: bigint): string {
  return `0x${value.toString(16)}`;
}

function buildGenesisConfig(
  appchainComponentClassesHash: bigint,
  l1: Record<(typeof A18_L1_COMPONENT_FIELDS)[number], bigint>,
  l2: Record<(typeof A18_L2_COMPONENT_FIELDS)[number], bigint>,
): AppchainSettlementConfig {
  return {
    protocol_version: A18_DEPLOYMENT_PLAN.protocolVersion,
    deployment_id: A18_DEPLOYMENT_PLAN.deploymentId,
    season_id: 7002n,
    ruleset_id: A18_DEPLOYMENT_PLAN.rulesetId,
    release_bundle_hash: A18_RELEASE_IDENTITY.releaseBundleHash,
    starknet_chain_id: A18_DEPLOYMENT_PLAN.l1.chainId,
    appchain_chain_id: A18_DEPLOYMENT_PLAN.l2.chainId,
    hardened_piltover_l1: l1.hardened_piltover,
    coordinator_l1: A18_DEPLOYMENT_PLAN.predeployedCoordinator,
    funding_vault_l1: l1.funding_vault,
    root_inbox_l1: l1.root_inbox,
    claim_router_l1: l1.claim_router,
    resource_gateway_l1: l1.resource_gateway,
    scarce_bridge_l1: l1.scarce_bridge,
    entitlement_vault_l1: l1.entitlement_vault,
    outcome_portal_l1: l1.outcome_portal,
    settlement_route_registry_l1: l1.settlement_route_registry,
    archive_quorum_l1: l1.archive_quorum,
    attestation_revocation_registry_l1: A18_RELEASE_IDENTITY.attestationRevocationRegistry,
    hardened_inbox_runtime_l2: l2.hardened_inbox_runtime_l2,
    season_ingress_l2: l2.settlement_ingress_l2,
    season_settlement_hub_l2: l2.settlement_hub_l2,
    forced_exit_coordinator_l2: l2.forced_exit_coordinator_l2,
    season_finalizer_l2: l2.season_finalizer_l2,
    sealed_factory_l2: l2.sealed_factory_l2,
    sealed_world_policy_l2: l2.world_policy_l2,
    vrf_provider_l2: l2.vrf_l2,
    vrf_public_key_hash: 13002n,
    appchain_component_classes_hash: appchainComponentClassesHash,
    class_binding_count: BigInt(A18_L1_COMPONENT_FIELDS.length + A18_L2_COMPONENT_FIELDS.length),
    class_bindings_hash: 13004n,
    schema_bundle_hash: 13005n,
    asset_policy_count: 1n,
    asset_policies_hash: 13006n,
    backing_policy_count: 1n,
    backing_policies_hash: 13007n,
    payout_purpose_policy_count: 1n,
    payout_purpose_policies_hash: 13008n,
    writer_capability_count: 1n,
    writer_capabilities_hash: 13009n,
    capacity_entry_count: 1n,
    capacity_root: 13010n,
    sealed_game_recipe_hash: 13011n,
    intended_start: 1_800_000_000n,
    intended_end: 1_800_005_400n,
    max_games: 1n,
    initial_inbox_cursor: 0n,
    initial_outbox_cursor: 0n,
    timing_policy_hash: 13012n,
    economics_policy_hash: 13013n,
    vrf_policy_hash: 13014n,
    recovery_policy_hash: 13015n,
  };
}

function buildManifest(
  addressRecipeHash: bigint,
  configHash: bigint,
  genesisHash: bigint,
  l1: Record<(typeof A18_L1_COMPONENT_FIELDS)[number], bigint>,
  l2: Record<(typeof A18_L2_COMPONENT_FIELDS)[number], bigint>,
): DeploymentManifest {
  return {
    protocol_version: A18_DEPLOYMENT_PLAN.protocolVersion,
    deployment_id: A18_DEPLOYMENT_PLAN.deploymentId,
    ruleset_id: A18_DEPLOYMENT_PLAN.rulesetId,
    release_bundle_hash: A18_RELEASE_IDENTITY.releaseBundleHash,
    address_recipe_hash: addressRecipeHash,
    l1_chain_id: A18_DEPLOYMENT_PLAN.l1.chainId,
    appchain_chain_id: A18_DEPLOYMENT_PLAN.l2.chainId,
    ...l1,
    coordinator: A18_DEPLOYMENT_PLAN.predeployedCoordinator,
    attestation_revocation_registry: A18_RELEASE_IDENTITY.attestationRevocationRegistry,
    ...l2,
    world_class_hash: A18_RELEASE_IDENTITY.worldClassHash,
    class_bundle_hash: A18_RELEASE_IDENTITY.classBundleHash,
    schema_bundle_hash: A18_RELEASE_IDENTITY.schemaBundleHash,
    authoritative_address_inputs_hash: A18_RELEASE_IDENTITY.authoritativeAddressInputsHash,
    external_counterpart_count: A18_RELEASE_IDENTITY.externalCounterpartCount,
    external_counterparts_hash: A18_RELEASE_IDENTITY.externalCounterpartsHash,
    privileged_mutation_paths_hash: A18_RELEASE_IDENTITY.privilegedMutationPathsHash,
    expected_role_count: A18_RELEASE_IDENTITY.expectedRoleCount,
    expected_roles_hash: A18_RELEASE_IDENTITY.expectedRolesHash,
    writer_graph_hash: A18_RELEASE_IDENTITY.writerGraphHash,
    config_snapshot_hash: configHash,
    genesis_hash: genesisHash,
  };
}

function mapAddresses<const TField extends string>(
  fields: readonly TField[],
  components: readonly ResolvedShellComponent[],
): Record<TField, bigint> {
  if (fields.length !== components.length) throw new Error("component/address mapping mismatch");
  return Object.fromEntries(fields.map((field, index) => [field, components[index].address])) as Record<TField, bigint>;
}
