use starknet::{ClassHash, ContractAddress};

#[starknet::interface]
pub trait IDeterministicShellDeployerSpike<TContractState> {
    fn deploy_component(ref self: TContractState, component_kind: felt252, class_hash: ClassHash) -> ContractAddress;
}

#[starknet::contract]
pub mod DeterministicShellDeployerSpike {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::syscalls::deploy_syscall;
    use starknet::{ClassHash, ContractAddress};
    use crate::deployment_identity_spike::{build_shell_constructor, derive_component_salt};
    use super::IDeterministicShellDeployerSpike;

    #[storage]
    struct Storage {
        coordinator: ContractAddress,
        protocol_version: u16,
        deployment_id: felt252,
        ruleset_id: felt252,
        deploy_from_zero: bool,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        coordinator: ContractAddress,
        protocol_version: u16,
        deployment_id: felt252,
        ruleset_id: felt252,
        deploy_from_zero: bool,
    ) {
        assert!(coordinator != zero_address(), "ZERO_COORDINATOR");
        assert!(protocol_version != 0 && deployment_id != 0 && ruleset_id != 0, "ZERO_IDENTITY");
        self.coordinator.write(coordinator);
        self.protocol_version.write(protocol_version);
        self.deployment_id.write(deployment_id);
        self.ruleset_id.write(ruleset_id);
        self.deploy_from_zero.write(deploy_from_zero);
    }

    #[abi(embed_v0)]
    impl DeterministicShellDeployerImpl of IDeterministicShellDeployerSpike<ContractState> {
        fn deploy_component(
            ref self: ContractState, component_kind: felt252, class_hash: ClassHash,
        ) -> ContractAddress {
            let zero_class_hash: ClassHash = 0.try_into().unwrap();
            assert!(class_hash != zero_class_hash, "ZERO_CLASS_HASH");
            let protocol_version = self.protocol_version.read();
            let deployment_id = self.deployment_id.read();
            let salt = derive_component_salt(protocol_version, deployment_id, component_kind);
            let constructor = build_shell_constructor(
                self.coordinator.read(), protocol_version, deployment_id, self.ruleset_id.read(), component_kind,
            );
            let (address, _) = deploy_syscall(class_hash, salt, constructor.span(), self.deploy_from_zero.read())
                .unwrap();
            address
        }
    }

    fn zero_address() -> ContractAddress {
        0.try_into().unwrap()
    }
}
