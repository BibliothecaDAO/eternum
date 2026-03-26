use starknet::ContractAddress;

#[starknet::interface]
pub trait IRealmsSwapPair<TState> {
    fn factory(self: @TState) -> ContractAddress;
    fn token0(self: @TState) -> ContractAddress;
    fn token1(self: @TState) -> ContractAddress;
    fn get_reserves(self: @TState) -> (u256, u256, u64);
    fn price_0_cumulative_last(self: @TState) -> u256;
    fn price_1_cumulative_last(self: @TState) -> u256;
    fn klast(self: @TState) -> u256;
    fn mint(ref self: TState, to: ContractAddress) -> u256;
    fn burn(ref self: TState, to: ContractAddress) -> (u256, u256);
    fn swap(ref self: TState, amount0_out: u256, amount1_out: u256, to: ContractAddress, data: Span<felt252>);
    fn skim(ref self: TState, to: ContractAddress);
    fn sync(ref self: TState);
}
