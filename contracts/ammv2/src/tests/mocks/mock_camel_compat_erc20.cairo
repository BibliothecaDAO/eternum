#[starknet::interface]
pub trait IMockCamelCompatibleERC20<TState> {
    fn mint(ref self: TState, recipient: starknet::ContractAddress, amount: u256);
    fn transfer(ref self: TState, recipient: starknet::ContractAddress, amount: u256) -> bool;
    fn approve(ref self: TState, spender: starknet::ContractAddress, amount: u256) -> bool;
    fn balanceOf(self: @TState, account: starknet::ContractAddress) -> u256;
    fn transferFrom(
        ref self: TState,
        sender: starknet::ContractAddress,
        recipient: starknet::ContractAddress,
        amount: u256,
    ) -> bool;
}

#[starknet::contract]
pub mod MockCamelCompatibleERC20 {
    use openzeppelin::token::erc20::{ERC20Component, ERC20HooksEmptyImpl};
    use starknet::ContractAddress;

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);

    impl ERC20Impl = ERC20Component::ERC20Impl<ContractState>;
    impl ERC20CamelOnlyImpl = ERC20Component::ERC20CamelOnlyImpl<ContractState>;
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event,
    }

    #[constructor]
    fn constructor(ref self: ContractState, name: ByteArray, symbol: ByteArray) {
        self.erc20.initializer(name, symbol);
    }

    #[abi(embed_v0)]
    impl MockCamelCompatibleERC20Impl of super::IMockCamelCompatibleERC20<ContractState> {
        fn mint(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            self.erc20.mint(recipient, amount);
        }

        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            ERC20Impl::transfer(ref self, recipient, amount)
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            ERC20Impl::approve(ref self, spender, amount)
        }

        fn balanceOf(self: @ContractState, account: ContractAddress) -> u256 {
            ERC20CamelOnlyImpl::balanceOf(self, account)
        }

        fn transferFrom(
            ref self: ContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256,
        ) -> bool {
            ERC20CamelOnlyImpl::transferFrom(ref self, sender, recipient, amount)
        }
    }
}
