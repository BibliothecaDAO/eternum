use starknet::ContractAddress;

#[starknet::interface]
pub trait IRealmsPlayerAccount<TContractState> {
    fn owner(self: @TContractState) -> ContractAddress;
    fn binding_authority(self: @TContractState) -> ContractAddress;
    fn rotate_public_key(ref self: TContractState, new_key: felt252);
}

#[starknet::interface]
pub trait IRealmsDeployable<TContractState> {
    fn __validate_deploy__(
        self: @TContractState,
        class_hash: felt252,
        contract_address_salt: felt252,
        public_key: felt252,
        owner: ContractAddress,
        binding_authority: ContractAddress,
    ) -> felt252;
}

#[starknet::contract(account)]
pub mod RealmsPlayerAccount {
    use openzeppelin_account::AccountComponent;
    use openzeppelin_introspection::src5::SRC5Component;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use super::{IRealmsDeployable, IRealmsPlayerAccount};

    component!(path: AccountComponent, storage: account, event: AccountEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);

    #[abi(embed_v0)]
    impl SRC6Impl = AccountComponent::SRC6Impl<ContractState>;
    #[abi(embed_v0)]
    impl DeclarerImpl = AccountComponent::DeclarerImpl<ContractState>;
    #[abi(embed_v0)]
    impl PublicKeyImpl = AccountComponent::PublicKeyImpl<ContractState>;
    #[abi(embed_v0)]
    impl PublicKeyCamelImpl = AccountComponent::PublicKeyCamelImpl<ContractState>;
    #[abi(embed_v0)]
    impl SRC6CamelOnlyImpl = AccountComponent::SRC6CamelOnlyImpl<ContractState>;
    #[abi(embed_v0)]
    impl SRC5Impl = SRC5Component::SRC5Impl<ContractState>;
    impl AccountInternalImpl = AccountComponent::InternalImpl<ContractState>;

    #[storage]
    pub struct Storage {
        pub owner: ContractAddress,
        pub binding_authority: ContractAddress,
        #[substorage(v0)]
        pub account: AccountComponent::Storage,
        #[substorage(v0)]
        pub src5: SRC5Component::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        AccountEvent: AccountComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        KeyRotated: KeyRotated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct KeyRotated {
        #[key]
        pub account: ContractAddress,
        #[key]
        pub by: ContractAddress,
        pub new_key: felt252,
    }

    #[constructor]
    pub fn constructor(
        ref self: ContractState, public_key: felt252, owner: ContractAddress, binding_authority: ContractAddress,
    ) {
        self.account.initializer(public_key);
        self.owner.write(owner);
        self.binding_authority.write(binding_authority);
    }

    #[abi(embed_v0)]
    impl RealmsDeployableImpl of IRealmsDeployable<ContractState> {
        fn __validate_deploy__(
            self: @ContractState,
            class_hash: felt252,
            contract_address_salt: felt252,
            public_key: felt252,
            owner: ContractAddress,
            binding_authority: ContractAddress,
        ) -> felt252 {
            let _ = (class_hash, contract_address_salt, public_key, owner, binding_authority);
            self.account.validate_transaction()
        }
    }

    #[abi(embed_v0)]
    impl RealmsPlayerAccountImpl of IRealmsPlayerAccount<ContractState> {
        fn owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }

        fn binding_authority(self: @ContractState) -> ContractAddress {
            self.binding_authority.read()
        }

        fn rotate_public_key(ref self: ContractState, new_key: felt252) {
            let caller = get_caller_address();
            assert!(caller == self.binding_authority.read(), "not binding authority");

            self.account._set_public_key(new_key);
            self.emit(KeyRotated { account: get_contract_address(), by: caller, new_key });
        }
    }
}
