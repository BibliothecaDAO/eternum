use starknet::ContractAddress;

#[starknet::interface]
pub trait IERC20Minimal<TState> {
    fn balanceOf(self: @TState, account: ContractAddress) -> u256;
    fn transfer(ref self: TState, recipient: ContractAddress, amount: u256) -> bool;
    fn transferFrom(ref self: TState, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
}
