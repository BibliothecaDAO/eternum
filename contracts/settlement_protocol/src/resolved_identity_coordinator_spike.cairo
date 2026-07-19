use starknet::ContractAddress;
use crate::deployment_identity_spike::{ComponentClassEntry, ComponentSaltEntry, KatanaGenesisArtifactCommitment};
use crate::types::{AppchainSettlementConfig, DeploymentAddressRecipe, DeploymentManifest};

#[starknet::interface]
pub trait IResolvedIdentityCoordinatorSpike<TContractState> {
    fn seal_resolved_identity(
        ref self: TContractState,
        recipe: DeploymentAddressRecipe,
        l1_classes: Span<ComponentClassEntry>,
        l1_salts: Span<ComponentSaltEntry>,
        l2_classes: Span<ComponentClassEntry>,
        l2_salts: Span<ComponentSaltEntry>,
        config: AppchainSettlementConfig,
        genesis_artifact: KatanaGenesisArtifactCommitment,
        manifest: DeploymentManifest,
    );
    fn abort_unsealed(ref self: TContractState);
    fn is_identity_sealed(self: @TContractState) -> bool;
    fn component_address(self: @TContractState, component_kind: felt252) -> ContractAddress;
    fn committed_component_address(self: @TContractState, component_kind: felt252) -> ContractAddress;
    fn resolved_identity(self: @TContractState) -> (felt252, felt252, felt252);
}

#[starknet::contract]
pub mod ResolvedIdentityCoordinatorSpike {
    use core::poseidon::poseidon_hash_span;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::syscalls::{call_contract_syscall, get_class_hash_at_syscall};
    use starknet::{ContractAddress, SyscallResultTrait, get_caller_address, get_contract_address};
    use crate::deployment_identity_spike::{
        ComponentClassEntry, ComponentSaltEntry, KatanaGenesisArtifactCommitment, appchain_settlement_config_hash,
        build_shell_constructor, calculate_shell_address, component_classes_hash, component_salts_hash,
        deployment_address_recipe_hash, deployment_manifest_hash, deployment_release_identity_hash,
        is_l1_component_kind, katana_genesis_artifact_hash, katana_genesis_profile_hash, shell_constructor_schema_hash,
        validate_component_vectors,
    };
    use crate::types::{AppchainSettlementConfig, DeploymentAddressRecipe, DeploymentManifest};
    use super::IResolvedIdentityCoordinatorSpike;

    const L1_COMPONENT_COUNT: usize = 14;
    const L2_COMPONENT_COUNT: usize = 9;

    #[storage]
    struct Storage {
        operator: ContractAddress,
        expected_address_recipe_hash: felt252,
        expected_release_identity_hash: felt252,
        expected_genesis_profile_hash: felt252,
        expected_genesis_hash: felt252,
        address_recipe_hash: felt252,
        manifest_hash: felt252,
        genesis_hash: felt252,
        component_addresses: Map<felt252, ContractAddress>,
        aborted: bool,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        operator: ContractAddress,
        expected_address_recipe_hash: felt252,
        expected_release_identity_hash: felt252,
        expected_genesis_profile_hash: felt252,
        expected_genesis_hash: felt252,
    ) {
        assert!(operator != zero_address(), "ZERO_OPERATOR");
        assert!(
            expected_address_recipe_hash != 0
                && expected_release_identity_hash != 0
                && expected_genesis_profile_hash != 0
                && expected_genesis_hash != 0,
            "ZERO_APPROVED_IDENTITY",
        );
        self.operator.write(operator);
        self.expected_address_recipe_hash.write(expected_address_recipe_hash);
        self.expected_release_identity_hash.write(expected_release_identity_hash);
        self.expected_genesis_profile_hash.write(expected_genesis_profile_hash);
        self.expected_genesis_hash.write(expected_genesis_hash);
    }

    #[abi(embed_v0)]
    impl ResolvedIdentityCoordinatorImpl of IResolvedIdentityCoordinatorSpike<ContractState> {
        fn seal_resolved_identity(
            ref self: ContractState,
            recipe: DeploymentAddressRecipe,
            l1_classes: Span<ComponentClassEntry>,
            l1_salts: Span<ComponentSaltEntry>,
            l2_classes: Span<ComponentClassEntry>,
            l2_salts: Span<ComponentSaltEntry>,
            config: AppchainSettlementConfig,
            genesis_artifact: KatanaGenesisArtifactCommitment,
            manifest: DeploymentManifest,
        ) {
            assert!(!self.aborted.read(), "PROVISIONING_ABORTED");
            assert!(!is_sealed(@self), "IDENTITY_ALREADY_SEALED");
            validate_recipe(@self, @recipe, l1_classes, l1_salts, l2_classes, l2_salts);

            let l1_addresses = resolve_and_verify_l1_shells(
                @recipe, l1_classes, l1_salts, effective_l1_deployer(@recipe), get_contract_address(),
            );
            let l2_addresses = resolve_l2_commitments(@recipe, l2_classes, l2_salts, effective_l2_deployer(@recipe));
            validate_config(@recipe, @config, @genesis_artifact, l1_addresses.span(), l2_addresses.span());
            let genesis_hash = validate_genesis_artifact(@self, @recipe, @genesis_artifact, l2_classes);
            let manifest_hash = validate_manifest(
                @self, @recipe, @config, @manifest, genesis_hash, l1_addresses.span(), l2_addresses.span(),
            );

            store_component_map(ref self, l1_classes, l1_addresses.span());
            store_component_map(ref self, l2_classes, l2_addresses.span());
            self.address_recipe_hash.write(deployment_address_recipe_hash(@recipe));
            self.manifest_hash.write(manifest_hash);
            self.genesis_hash.write(genesis_hash);
        }

        fn abort_unsealed(ref self: ContractState) {
            assert!(get_caller_address() == self.operator.read(), "ONLY_OPERATOR");
            assert!(!is_sealed(@self), "IDENTITY_ALREADY_SEALED");
            assert!(!self.aborted.read(), "PROVISIONING_ABORTED");
            self.aborted.write(true);
        }

        fn is_identity_sealed(self: @ContractState) -> bool {
            is_sealed(self)
        }

        fn component_address(self: @ContractState, component_kind: felt252) -> ContractAddress {
            assert!(is_l1_component_kind(component_kind), "L2_COMPONENT_ON_L1");
            committed_component_address(self, component_kind)
        }

        fn committed_component_address(self: @ContractState, component_kind: felt252) -> ContractAddress {
            committed_component_address(self, component_kind)
        }

        fn resolved_identity(self: @ContractState) -> (felt252, felt252, felt252) {
            assert!(is_sealed(self), "IDENTITY_NOT_SEALED");
            (self.address_recipe_hash.read(), self.manifest_hash.read(), self.genesis_hash.read())
        }
    }

    fn committed_component_address(self: @ContractState, component_kind: felt252) -> ContractAddress {
        assert!(is_sealed(self), "IDENTITY_NOT_SEALED");
        let component = self.component_addresses.read(component_kind);
        assert!(component != zero_address(), "UNKNOWN_COMPONENT_KIND");
        component
    }

    fn validate_recipe(
        self: @ContractState,
        recipe: @DeploymentAddressRecipe,
        l1_classes: Span<ComponentClassEntry>,
        l1_salts: Span<ComponentSaltEntry>,
        l2_classes: Span<ComponentClassEntry>,
        l2_salts: Span<ComponentSaltEntry>,
    ) {
        assert!(deployment_address_recipe_hash(recipe) == self.expected_address_recipe_hash.read(), "WRONG_RECIPE");
        assert!(*recipe.shell_constructor_schema_hash == shell_constructor_schema_hash(), "WRONG_CONSTRUCTOR_SCHEMA");
        validate_layer_recipe(recipe, l1_classes, l1_salts, true);
        validate_layer_recipe(recipe, l2_classes, l2_salts, false);
    }

    fn validate_layer_recipe(
        recipe: @DeploymentAddressRecipe,
        classes: Span<ComponentClassEntry>,
        salts: Span<ComponentSaltEntry>,
        is_l1: bool,
    ) {
        let expected_kinds = component_kinds(classes);
        validate_component_vectors(
            *recipe.protocol_version, *recipe.deployment_id, expected_kinds.span(), classes, salts,
        );
        if is_l1 {
            assert!(classes.len() == L1_COMPONENT_COUNT, "WRONG_L1_COMPONENT_COUNT");
            assert!((*recipe.l1_component_count).into() == classes.len(), "WRONG_L1_RECIPE_COUNT");
            assert!(*recipe.l1_component_classes_hash == component_classes_hash(classes), "WRONG_L1_CLASSES");
            assert!(*recipe.l1_component_salts_hash == component_salts_hash(salts), "WRONG_L1_SALTS");
        } else {
            assert!(classes.len() == L2_COMPONENT_COUNT, "WRONG_L2_COMPONENT_COUNT");
            assert!((*recipe.l2_component_count).into() == classes.len(), "WRONG_L2_RECIPE_COUNT");
            assert!(*recipe.l2_component_classes_hash == component_classes_hash(classes), "WRONG_L2_CLASSES");
            assert!(*recipe.l2_component_salts_hash == component_salts_hash(salts), "WRONG_L2_SALTS");
        }
    }

    fn resolve_and_verify_l1_shells(
        recipe: @DeploymentAddressRecipe,
        classes: Span<ComponentClassEntry>,
        salts: Span<ComponentSaltEntry>,
        effective_deployer: felt252,
        coordinator: ContractAddress,
    ) -> Array<ContractAddress> {
        let addresses = resolve_layer_addresses(recipe, classes, salts, effective_deployer, coordinator);
        for index in 0..classes.len() {
            let component = classes.at(index);
            let address = *addresses.at(index);
            let live_class_hash: felt252 = get_class_hash_at_syscall(address).unwrap_syscall().into();
            assert!(live_class_hash == *component.class_hash, "LIVE_CLASS_MISMATCH");
            assert_shell_identity(address, coordinator, recipe, *component.component_kind);
        }
        addresses
    }

    fn resolve_l2_commitments(
        recipe: @DeploymentAddressRecipe,
        classes: Span<ComponentClassEntry>,
        salts: Span<ComponentSaltEntry>,
        effective_deployer: felt252,
    ) -> Array<ContractAddress> {
        resolve_layer_addresses(recipe, classes, salts, effective_deployer, get_contract_address())
    }

    fn resolve_layer_addresses(
        recipe: @DeploymentAddressRecipe,
        classes: Span<ComponentClassEntry>,
        salts: Span<ComponentSaltEntry>,
        effective_deployer: felt252,
        coordinator: ContractAddress,
    ) -> Array<ContractAddress> {
        let mut addresses = array![];
        for index in 0..classes.len() {
            let component = classes.at(index);
            let constructor = build_shell_constructor(
                coordinator,
                *recipe.protocol_version,
                *recipe.deployment_id,
                *recipe.ruleset_id,
                *component.component_kind,
            );
            let calculated = calculate_shell_address(
                *salts.at(index).salt, *component.class_hash, constructor.span(), effective_deployer,
            );
            let address: ContractAddress = calculated.try_into().unwrap();
            addresses.append(address);
        }
        addresses
    }

    fn assert_shell_identity(
        address: ContractAddress,
        coordinator: ContractAddress,
        recipe: @DeploymentAddressRecipe,
        component_kind: felt252,
    ) {
        let result: Span<felt252> = call_contract_syscall(address, selector!("identity"), array![].span())
            .unwrap_syscall();
        assert!(result.len() == 5, "SHELL_IDENTITY_LENGTH");
        assert!(*result.at(0) == coordinator.into(), "SHELL_COORDINATOR_MISMATCH");
        assert!(*result.at(1) == (*recipe.protocol_version).into(), "SHELL_PROTOCOL_MISMATCH");
        assert!(*result.at(2) == *recipe.deployment_id, "SHELL_DEPLOYMENT_MISMATCH");
        assert!(*result.at(3) == *recipe.ruleset_id, "SHELL_RULESET_MISMATCH");
        assert!(*result.at(4) == component_kind, "SHELL_KIND_MISMATCH");
    }

    fn validate_config(
        recipe: @DeploymentAddressRecipe,
        config: @AppchainSettlementConfig,
        artifact: @KatanaGenesisArtifactCommitment,
        l1: Span<ContractAddress>,
        l2: Span<ContractAddress>,
    ) {
        assert!(*config.protocol_version == *recipe.protocol_version, "CONFIG_PROTOCOL_MISMATCH");
        assert!(*config.deployment_id == *recipe.deployment_id, "CONFIG_DEPLOYMENT_MISMATCH");
        assert!(*config.ruleset_id == *recipe.ruleset_id, "CONFIG_RULESET_MISMATCH");
        assert!(*config.starknet_chain_id == *recipe.l1_chain_id, "CONFIG_L1_CHAIN_MISMATCH");
        assert!(*config.appchain_chain_id == *recipe.appchain_chain_id, "CONFIG_L2_CHAIN_MISMATCH");
        assert!(*config.coordinator_l1 == get_contract_address(), "CONFIG_COORDINATOR_MISMATCH");
        assert!(
            *config.appchain_component_classes_hash == *recipe.l2_component_classes_hash, "CONFIG_CLASSES_MISMATCH",
        );
        let component_count: u16 = ((*recipe.l1_component_count).into()) + ((*recipe.l2_component_count).into());
        assert!(*config.class_binding_count == component_count, "CONFIG_CLASS_COUNT_MISMATCH");
        assert!(appchain_settlement_config_hash(config) == *artifact.config_hash, "CONFIG_HASH_MISMATCH");

        let expected_l1 = array![
            *config.hardened_piltover_l1, *config.funding_vault_l1, *config.root_inbox_l1, *config.claim_router_l1,
            *config.resource_gateway_l1, *config.scarce_bridge_l1, *config.entitlement_vault_l1,
            *config.outcome_portal_l1, *config.settlement_route_registry_l1, *config.archive_quorum_l1,
        ];
        for index in 0..expected_l1.len() {
            assert!(*expected_l1.at(index) == *l1.at(index), "CONFIG_L1_ADDRESS_MISMATCH");
        }
        let expected_l2 = array![
            *config.season_ingress_l2, *config.season_settlement_hub_l2, *config.hardened_inbox_runtime_l2,
            *config.forced_exit_coordinator_l2, *config.season_finalizer_l2, *config.sealed_factory_l2,
            *config.sealed_world_policy_l2, *config.vrf_provider_l2,
        ];
        for index in 0..expected_l2.len() {
            assert!(*expected_l2.at(index) == *l2.at(index + 1), "CONFIG_L2_ADDRESS_MISMATCH");
        }
    }

    fn validate_genesis_artifact(
        self: @ContractState,
        recipe: @DeploymentAddressRecipe,
        artifact: @KatanaGenesisArtifactCommitment,
        l2_classes: Span<ComponentClassEntry>,
    ) -> felt252 {
        assert!(
            katana_genesis_profile_hash(artifact) == self.expected_genesis_profile_hash.read(), "WRONG_GENESIS_PROFILE",
        );
        assert!(*artifact.chain_id == *recipe.appchain_chain_id, "GENESIS_CHAIN_MISMATCH");
        assert!(*artifact.state_root != 0, "ZERO_GENESIS_STATE_ROOT");
        assert!(*artifact.class_declaration_count == 1, "WRONG_GENESIS_CLASS_COUNT");
        let expected_class_hash = poseidon_hash_span(
            array!['KATANA_GENESIS_CLASSES_V1', 1, *l2_classes.at(0).class_hash].span(),
        );
        assert!(*artifact.class_declarations_hash == expected_class_hash, "WRONG_GENESIS_CLASSES");
        assert!((*artifact.contract_allocation_count) == l2_classes.len().into(), "WRONG_GENESIS_CONTRACT_COUNT");
        assert!(*artifact.contract_allocations_hash != 0, "ZERO_GENESIS_CONTRACTS_HASH");
        assert!(*artifact.storage_write_count != 0 && *artifact.storage_writes_hash != 0, "ZERO_GENESIS_STORAGE");
        let genesis_hash = katana_genesis_artifact_hash(artifact);
        assert!(genesis_hash == self.expected_genesis_hash.read(), "WRONG_GENESIS_ARTIFACT");
        genesis_hash
    }

    fn validate_manifest(
        self: @ContractState,
        recipe: @DeploymentAddressRecipe,
        config: @AppchainSettlementConfig,
        manifest: @DeploymentManifest,
        genesis_hash: felt252,
        l1: Span<ContractAddress>,
        l2: Span<ContractAddress>,
    ) -> felt252 {
        assert!(
            deployment_release_identity_hash(manifest) == self.expected_release_identity_hash.read(),
            "WRONG_RELEASE_IDENTITY",
        );
        assert!(*manifest.protocol_version == *recipe.protocol_version, "MANIFEST_PROTOCOL_MISMATCH");
        assert!(*manifest.deployment_id == *recipe.deployment_id, "MANIFEST_DEPLOYMENT_MISMATCH");
        assert!(*manifest.ruleset_id == *recipe.ruleset_id, "MANIFEST_RULESET_MISMATCH");
        assert!(*manifest.address_recipe_hash == deployment_address_recipe_hash(recipe), "MANIFEST_RECIPE_MISMATCH");
        assert!(*manifest.l1_chain_id == *recipe.l1_chain_id, "MANIFEST_L1_CHAIN_MISMATCH");
        assert!(*manifest.appchain_chain_id == *recipe.appchain_chain_id, "MANIFEST_L2_CHAIN_MISMATCH");
        assert!(*manifest.coordinator == get_contract_address(), "MANIFEST_COORDINATOR_MISMATCH");
        assert!(*manifest.release_bundle_hash == *config.release_bundle_hash, "MANIFEST_RELEASE_MISMATCH");
        assert!(
            *manifest.attestation_revocation_registry == *config.attestation_revocation_registry_l1,
            "MANIFEST_REVOCATION_MISMATCH",
        );
        assert!(*manifest.schema_bundle_hash == *config.schema_bundle_hash, "MANIFEST_SCHEMA_MISMATCH");
        assert!(*manifest.config_snapshot_hash == appchain_settlement_config_hash(config), "MANIFEST_CONFIG_MISMATCH");
        assert!(*manifest.genesis_hash == genesis_hash, "MANIFEST_GENESIS_MISMATCH");

        let manifest_l1 = array![
            *manifest.hardened_piltover, *manifest.funding_vault, *manifest.root_inbox, *manifest.claim_router,
            *manifest.resource_gateway, *manifest.scarce_bridge, *manifest.entitlement_vault, *manifest.outcome_portal,
            *manifest.settlement_route_registry, *manifest.archive_quorum, *manifest.mmr_settlement_router,
            *manifest.mmr_settlement_module, *manifest.exit_verifier, *manifest.dormant_reserve,
        ];
        let manifest_l2 = array![
            *manifest.settlement_config_l2, *manifest.settlement_ingress_l2, *manifest.settlement_hub_l2,
            *manifest.hardened_inbox_runtime_l2, *manifest.forced_exit_coordinator_l2, *manifest.season_finalizer_l2,
            *manifest.sealed_factory_l2, *manifest.world_policy_l2, *manifest.vrf_l2,
        ];
        for index in 0..l1.len() {
            assert!(*manifest_l1.at(index) == *l1.at(index), "MANIFEST_L1_ADDRESS_MISMATCH");
        }
        for index in 0..l2.len() {
            assert!(*manifest_l2.at(index) == (*l2.at(index)).into(), "MANIFEST_L2_ADDRESS_MISMATCH");
        }
        deployment_manifest_hash(manifest)
    }

    fn store_component_map(
        ref self: ContractState, classes: Span<ComponentClassEntry>, addresses: Span<ContractAddress>,
    ) {
        for index in 0..classes.len() {
            self.component_addresses.write(*classes.at(index).component_kind, *addresses.at(index));
        }
    }

    fn component_kinds(classes: Span<ComponentClassEntry>) -> Array<felt252> {
        let mut kinds = array![];
        for component in classes {
            kinds.append(*component.component_kind);
        }
        kinds
    }

    fn effective_l1_deployer(recipe: @DeploymentAddressRecipe) -> felt252 {
        if *recipe.l1_deploy_from_zero {
            0
        } else {
            (*recipe.l1_deployer).into()
        }
    }

    fn effective_l2_deployer(recipe: @DeploymentAddressRecipe) -> felt252 {
        if *recipe.l2_deploy_from_zero {
            0
        } else {
            *recipe.l2_deployer
        }
    }

    fn is_sealed(self: @ContractState) -> bool {
        self.address_recipe_hash.read() != 0
    }

    fn zero_address() -> ContractAddress {
        0.try_into().unwrap()
    }
}
