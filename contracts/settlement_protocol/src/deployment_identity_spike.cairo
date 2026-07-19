use core::hash::{HashStateExTrait, HashStateTrait};
use core::pedersen::PedersenTrait;
use core::poseidon::poseidon_hash_span;
use starknet::ContractAddress;
use crate::types::{AppchainSettlementConfig, DeploymentAddressRecipe, DeploymentManifest};

const L2_ADDRESS_UPPER_BOUND: felt252 = 0x7ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00;
const CONTRACT_ADDRESS_PREFIX: felt252 = 'STARKNET_CONTRACT_ADDRESS';

#[derive(Copy, Debug, Drop, PartialEq, Serde)]
pub struct ComponentClassEntry {
    pub component_kind: felt252,
    pub class_hash: felt252,
}

#[derive(Copy, Debug, Drop, PartialEq, Serde)]
pub struct ComponentSaltEntry {
    pub component_kind: felt252,
    pub salt: felt252,
}

#[derive(Copy, Debug, Drop, PartialEq, Serde)]
pub struct KatanaGenesisArtifactCommitment {
    pub katana_source_commit: felt252,
    pub chain_id: felt252,
    pub block_number: felt252,
    pub parent_hash: felt252,
    pub timestamp: felt252,
    pub sequencer_address: felt252,
    pub eth_gas_price: felt252,
    pub strk_gas_price: felt252,
    pub class_declaration_count: felt252,
    pub class_declarations_hash: felt252,
    pub contract_allocation_count: felt252,
    pub contract_allocations_hash: felt252,
    pub storage_write_count: felt252,
    pub storage_writes_hash: felt252,
    pub config_hash: felt252,
    pub state_root: felt252,
}

pub fn derive_component_salt(protocol_version: u16, deployment_id: felt252, component_kind: felt252) -> felt252 {
    assert!(component_kind != 0, "ZERO_COMPONENT_KIND");
    poseidon_hash_span(array![protocol_version.into(), deployment_id, component_kind].span())
}

pub fn component_classes_hash(entries: Span<ComponentClassEntry>) -> felt252 {
    let mut preimage = array!['DEPLOYMENT_COMPONENT_CLASSES_V1', entries.len().into()];
    for entry in entries {
        preimage.append(*entry.component_kind);
        preimage.append(*entry.class_hash);
    }
    poseidon_hash_span(preimage.span())
}

pub fn component_salts_hash(entries: Span<ComponentSaltEntry>) -> felt252 {
    let mut preimage = array!['DEPLOYMENT_COMPONENT_SALTS_V1', entries.len().into()];
    for entry in entries {
        preimage.append(*entry.component_kind);
        preimage.append(*entry.salt);
    }
    poseidon_hash_span(preimage.span())
}

pub fn validate_component_vectors(
    protocol_version: u16,
    deployment_id: felt252,
    expected_kinds: Span<felt252>,
    classes: Span<ComponentClassEntry>,
    salts: Span<ComponentSaltEntry>,
) {
    assert!(!expected_kinds.is_empty() && expected_kinds.len() <= 255, "COMPONENT_COUNT_BOUND");
    assert!(classes.len() == expected_kinds.len(), "CLASS_KIND_MISMATCH");
    assert!(salts.len() == expected_kinds.len(), "SALT_KIND_MISMATCH");
    for index in 0..expected_kinds.len() {
        let expected_kind = *expected_kinds.at(index);
        assert!(expected_kind != 0, "ZERO_COMPONENT_KIND");
        assert!(*classes.at(index).component_kind == expected_kind, "CLASS_KIND_MISMATCH");
        assert!(*classes.at(index).class_hash != 0, "ZERO_COMPONENT_CLASS");
        assert!(*salts.at(index).component_kind == expected_kind, "SALT_KIND_MISMATCH");
        assert!(
            *salts.at(index).salt == derive_component_salt(protocol_version, deployment_id, expected_kind),
            "NONCANONICAL_SALT",
        );
        for previous in 0..index {
            assert!(*expected_kinds.at(previous) != expected_kind, "DUPLICATE_COMPONENT_KIND");
        }
    }
}

pub fn shell_constructor_schema_hash() -> felt252 {
    poseidon_hash_span(
        array!['SHELL_CONSTRUCTOR_SCHEMA_V1', 'ContractAddress', 'u16', 'DeploymentId', 'felt252', 'felt252'].span(),
    )
}

pub fn build_shell_constructor(
    predeployed_coordinator: ContractAddress,
    protocol_version: u16,
    deployment_id: felt252,
    ruleset_id: felt252,
    component_kind: felt252,
) -> Array<felt252> {
    assert!(predeployed_coordinator != zero_address(), "ZERO_COORDINATOR");
    assert!(component_kind != 0, "ZERO_COMPONENT_KIND");
    array![predeployed_coordinator.into(), protocol_version.into(), deployment_id, ruleset_id, component_kind]
}

pub fn assert_canonical_shell_constructor(
    predeployed_coordinator: ContractAddress,
    protocol_version: u16,
    deployment_id: felt252,
    ruleset_id: felt252,
    component_kind: felt252,
    calldata: Span<felt252>,
) {
    let canonical = build_shell_constructor(
        predeployed_coordinator, protocol_version, deployment_id, ruleset_id, component_kind,
    );
    assert!(calldata == canonical.span(), "NONCANONICAL_SHELL_CONSTRUCTOR");
}

pub fn calculate_shell_address(
    salt: felt252, class_hash: felt252, constructor_calldata: Span<felt252>, effective_deployer: felt252,
) -> felt252 {
    let constructor_hash = compute_hash_on_elements(constructor_calldata);
    let raw_address = compute_hash_on_elements(
        array![CONTRACT_ADDRESS_PREFIX, effective_deployer, salt, class_hash, constructor_hash].span(),
    );
    let normalized: u256 = raw_address.into() % L2_ADDRESS_UPPER_BOUND.into();
    normalized.try_into().unwrap()
}

pub fn deployment_address_recipe_hash(recipe: @DeploymentAddressRecipe) -> felt252 {
    let mut serialized = array!['DEPLOYMENT_ADDRESS_RECIPE_V1'];
    recipe.serialize(ref serialized);
    poseidon_hash_span(serialized.span())
}

pub fn appchain_settlement_config_hash(config: @AppchainSettlementConfig) -> felt252 {
    let mut serialized = array!['APPCHAIN_SETTLEMENT_CONFIG_V1'];
    config.serialize(ref serialized);
    poseidon_hash_span(serialized.span())
}

pub fn katana_genesis_artifact_hash(artifact: @KatanaGenesisArtifactCommitment) -> felt252 {
    let mut serialized = array!['KATANA_GENESIS_ARTIFACT_V1'];
    artifact.serialize(ref serialized);
    poseidon_hash_span(serialized.span())
}

pub fn deployment_manifest_hash(manifest: @DeploymentManifest) -> felt252 {
    let mut serialized = array!['DEPLOYMENT_MANIFEST_V1'];
    manifest.serialize(ref serialized);
    poseidon_hash_span(serialized.span())
}

pub fn deployment_release_identity_hash(manifest: @DeploymentManifest) -> felt252 {
    poseidon_hash_span(
        array![
            'DEPLOYMENT_RELEASE_IDENTITY_V1', (*manifest.coordinator).into(),
            (*manifest.attestation_revocation_registry).into(), *manifest.release_bundle_hash,
            *manifest.world_class_hash, *manifest.class_bundle_hash, *manifest.schema_bundle_hash,
            *manifest.authoritative_address_inputs_hash, (*manifest.external_counterpart_count).into(),
            *manifest.external_counterparts_hash, *manifest.privileged_mutation_paths_hash,
            (*manifest.expected_role_count).into(), *manifest.expected_roles_hash, *manifest.writer_graph_hash,
        ]
            .span(),
    )
}

pub fn katana_genesis_profile_hash(artifact: @KatanaGenesisArtifactCommitment) -> felt252 {
    poseidon_hash_span(
        array![
            'KATANA_GENESIS_PROFILE_V1', *artifact.katana_source_commit, *artifact.chain_id, *artifact.block_number,
            *artifact.parent_hash, *artifact.timestamp, *artifact.sequencer_address, *artifact.eth_gas_price,
            *artifact.strk_gas_price,
        ]
            .span(),
    )
}

pub fn is_l1_component_kind(kind: felt252) -> bool {
    kind == 1
        || kind == 2
        || kind == 3
        || kind == 4
        || kind == 5
        || kind == 6
        || kind == 7
        || kind == 8
        || kind == 9
        || kind == 10
        || kind == 11
        || kind == 12
        || kind == 13
        || kind == 14
}

fn compute_hash_on_elements(elements: Span<felt252>) -> felt252 {
    let mut state = PedersenTrait::new(0);
    for element in elements {
        state = state.update_with(*element);
    }
    state.update_with(elements.len()).finalize()
}

fn zero_address() -> ContractAddress {
    0.try_into().unwrap()
}
