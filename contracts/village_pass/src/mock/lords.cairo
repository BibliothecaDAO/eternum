#[starknet::interface]
trait ITestLords<TContractState> {
    fn mint(ref self: TContractState, token_id: u256);
    fn mint_test_lords(ref self: TContractState);
    fn set_season_pass(ref self: TContractState, address: starknet::ContractAddress);
}

#[starknet::interface]
trait ISeasonPass<TContractState> {
    fn attach_lords(ref self: TContractState, token_id: u256, amount: u256);
}

#[starknet::contract]
mod TestLords {
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::token::erc20::{ERC20Component};
    use openzeppelin::token::erc20::{ERC20HooksEmptyImpl};
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ClassHash, ContractAddress};
    use super::{ISeasonPassDispatcher, ISeasonPassDispatcherTrait};

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
        season_pass: ISeasonPassDispatcher,
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
        fn mint(ref self: ContractState, token_id: u256) {
            // ensure this can only be done once per token id
            assert!(self.minted.entry(token_id).read() == false, "TL: already minted for token id");
            self.minted.entry(token_id).write(true);

            // mint 1000 lords to this contract
            let this = starknet::get_contract_address();
            let amount = 1_000 * 1000000000000000000; // 10 ^ 18
            self.erc20.mint(this, amount);

            // attach minted lords to token id
            self.erc20._approve(this, self.season_pass.read().contract_address, amount);
            self.season_pass.read().attach_lords(token_id, amount);
        }

        fn set_season_pass(ref self: ContractState, address: ContractAddress) {
            // ensure it has not been previously added
            let current_season_pass = self.season_pass.read();
            assert!(current_season_pass.contract_address.is_zero(), "TL: season pass address already added");
            self.season_pass.write(ISeasonPassDispatcher { contract_address: address });
        }

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
