use starknet::ContractAddress;

#[starknet::interface]
pub trait IPlayerRegistry<TContractState> {
    fn bind(ref self: TContractState, owner: ContractAddress, account: ContractAddress);
    fn account_of(self: @TContractState, owner: ContractAddress) -> ContractAddress;
    fn owner_of(self: @TContractState, account: ContractAddress) -> ContractAddress;
}

#[starknet::contract]
pub mod PlayerRegistry {
    use core::num::traits::Zero;
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_caller_address};
    use super::IPlayerRegistry;

    #[storage]
    pub struct Storage {
        pub binding_authority: ContractAddress,
        pub accounts_by_owner: Map<ContractAddress, ContractAddress>,
        pub owners_by_account: Map<ContractAddress, ContractAddress>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Bound: Bound,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Bound {
        #[key]
        pub owner: ContractAddress,
        #[key]
        pub account: ContractAddress,
    }

    #[constructor]
    pub fn constructor(ref self: ContractState, binding_authority: ContractAddress) {
        assert!(!binding_authority.is_zero(), "zero binding authority");
        self.binding_authority.write(binding_authority);
    }

    #[abi(embed_v0)]
    impl PlayerRegistryImpl of IPlayerRegistry<ContractState> {
        fn bind(ref self: ContractState, owner: ContractAddress, account: ContractAddress) {
            assert!(get_caller_address() == self.binding_authority.read(), "not binding authority");
            assert!(!owner.is_zero(), "zero owner");
            assert!(!account.is_zero(), "zero account");
            assert!(self.accounts_by_owner.entry(owner).read().is_zero(), "owner already bound");
            assert!(self.owners_by_account.entry(account).read().is_zero(), "account already bound");

            self.accounts_by_owner.entry(owner).write(account);
            self.owners_by_account.entry(account).write(owner);
            self.emit(Bound { owner, account });
        }

        fn account_of(self: @ContractState, owner: ContractAddress) -> ContractAddress {
            self.accounts_by_owner.entry(owner).read()
        }

        fn owner_of(self: @ContractState, account: ContractAddress) -> ContractAddress {
            self.owners_by_account.entry(account).read()
        }
    }
}
