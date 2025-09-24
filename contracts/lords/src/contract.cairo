#[starknet::interface]
trait ITestLords<TContractState> {
    fn mint_test_lords(ref self: TContractState);
}

#[starknet::contract]
mod TestLords {
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::token::erc20::{ERC20Component};
    use openzeppelin::token::erc20::{ERC20HooksEmptyImpl};
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ClassHash, ContractAddress};

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);

    // ERC20Mixin
    #[abi(embed_v0)]
    impl ERC20Impl = ERC20Component::ERC20Impl<ContractState>;
    #[abi(embed_v0)]
    impl ERC20MetadataImpl = ERC20Component::ERC20MetadataImpl<ContractState>;
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        minted: Map<u256, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ERC20Event: ERC20Component::Event,
        SRC5Event: SRC5Component::Event,
    }


    #[abi(embed_v0)]
    impl TestLordsImpl of super::ITestLords<ContractState> {
        fn mint_test_lords(ref self: ContractState) {
            let this = starknet::get_caller_address();
            let amount = 1_000 * 1000000000000000000; // 10 ^ 18
            self.erc20.mint(this, amount);
        }
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.erc20.initializer("Test Lords", "TLORDS");
    }
}
