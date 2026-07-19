use starknet::ContractAddress;

#[starknet::interface]
pub trait IDeterministicShellSpike<TContractState> {
    fn guarded_operation(ref self: TContractState, operation_kind: u8, caller_component_kind: felt252);
    fn authenticated_component_call(ref self: TContractState, caller_component_kind: felt252);
    fn protected_call_count(self: @TContractState) -> u64;
    fn identity(self: @TContractState) -> (ContractAddress, u16, felt252, felt252, felt252);
    fn resolved_identity(self: @TContractState) -> (felt252, felt252, felt252);
    fn genesis_config_value(self: @TContractState, field_index: felt252) -> felt252;
}

#[starknet::contract]
pub mod DeterministicShellSpike {
    use starknet::storage::{Map, StorageMapReadAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_caller_address};
    use crate::deployment_identity_spike::is_l1_component_kind;
    use crate::resolved_identity_coordinator_spike::{
        IResolvedIdentityCoordinatorSpikeDispatcher, IResolvedIdentityCoordinatorSpikeDispatcherTrait,
    };
    use super::IDeterministicShellSpike;

    #[storage]
    struct Storage {
        coordinator: ContractAddress,
        protocol_version: u16,
        deployment_id: felt252,
        ruleset_id: felt252,
        component_kind: felt252,
        genesis_config: Map<felt252, felt252>,
        protected_call_count: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        coordinator: ContractAddress,
        protocol_version: u16,
        deployment_id: felt252,
        ruleset_id: felt252,
        component_kind: felt252,
    ) {
        assert!(coordinator != zero_address(), "ZERO_COORDINATOR");
        assert!(protocol_version != 0 && deployment_id != 0 && ruleset_id != 0 && component_kind != 0, "ZERO_IDENTITY");
        self.coordinator.write(coordinator);
        self.protocol_version.write(protocol_version);
        self.deployment_id.write(deployment_id);
        self.ruleset_id.write(ruleset_id);
        self.component_kind.write(component_kind);
    }

    #[abi(embed_v0)]
    impl DeterministicShellImpl of IDeterministicShellSpike<ContractState> {
        fn guarded_operation(ref self: ContractState, operation_kind: u8, caller_component_kind: felt252) {
            execute_guarded_operation(ref self, operation_kind, caller_component_kind);
        }

        fn authenticated_component_call(ref self: ContractState, caller_component_kind: felt252) {
            assert_identity_sealed(@self);
            assert_authenticated_component(@self, caller_component_kind);
            self.protected_call_count.write(self.protected_call_count.read() + 1);
        }

        fn protected_call_count(self: @ContractState) -> u64 {
            self.protected_call_count.read()
        }

        fn identity(self: @ContractState) -> (ContractAddress, u16, felt252, felt252, felt252) {
            (
                self.coordinator.read(),
                self.protocol_version.read(),
                self.deployment_id.read(),
                self.ruleset_id.read(),
                self.component_kind.read(),
            )
        }

        fn resolved_identity(self: @ContractState) -> (felt252, felt252, felt252) {
            assert_l1_shell(self);
            coordinator(self).resolved_identity()
        }

        fn genesis_config_value(self: @ContractState, field_index: felt252) -> felt252 {
            assert!(self.component_kind.read() == 101, "NOT_CONFIG_SHELL");
            self.genesis_config.read(field_index)
        }
    }

    fn execute_guarded_operation(ref self: ContractState, operation_kind: u8, caller_component_kind: felt252) {
        assert!(operation_kind >= 1 && operation_kind <= 10, "UNKNOWN_GUARDED_OPERATION");
        assert_identity_sealed(@self);
        assert_authenticated_component(@self, caller_component_kind);
        self.protected_call_count.write(self.protected_call_count.read() + 1);
    }

    fn assert_identity_sealed(self: @ContractState) {
        assert_l1_shell(self);
        assert!(coordinator(self).is_identity_sealed(), "IDENTITY_NOT_SEALED");
    }

    fn assert_l1_shell(self: @ContractState) {
        assert!(is_l1_component_kind(self.component_kind.read()), "L2_LOCAL_SEAL_REQUIRED");
    }

    fn assert_authenticated_component(self: @ContractState, caller_component_kind: felt252) {
        assert!(get_caller_address() == coordinator(self).component_address(caller_component_kind), "WRONG_COMPONENT");
    }

    fn coordinator(self: @ContractState) -> IResolvedIdentityCoordinatorSpikeDispatcher {
        IResolvedIdentityCoordinatorSpikeDispatcher { contract_address: self.coordinator.read() }
    }

    fn zero_address() -> ContractAddress {
        0.try_into().unwrap()
    }
}
