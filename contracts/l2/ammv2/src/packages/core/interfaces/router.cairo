use starknet::ContractAddress;

#[starknet::interface]
pub trait IRealmsSwapRouter<TState> {
    fn factory(self: @TState) -> ContractAddress;
    fn sort_tokens(
        self: @TState, token_a: ContractAddress, token_b: ContractAddress,
    ) -> (ContractAddress, ContractAddress);
    fn quote(self: @TState, amount_a: u256, reserve_a: u256, reserve_b: u256) -> u256;
    fn get_amount_out(self: @TState, amount_in: u256, reserve_in: u256, reserve_out: u256) -> u256;
    fn get_amount_in(self: @TState, amount_out: u256, reserve_in: u256, reserve_out: u256) -> u256;
    fn get_amounts_out(self: @TState, amount_in: u256, path: Span<ContractAddress>) -> Array<u256>;
    fn get_amounts_in(self: @TState, amount_out: u256, path: Span<ContractAddress>) -> Array<u256>;
    fn add_liquidity(
        ref self: TState,
        token_a: ContractAddress,
        token_b: ContractAddress,
        amount_a_desired: u256,
        amount_b_desired: u256,
        amount_a_min: u256,
        amount_b_min: u256,
        to: ContractAddress,
        deadline: u64,
    ) -> (u256, u256, u256);
    fn remove_liquidity(
        ref self: TState,
        token_a: ContractAddress,
        token_b: ContractAddress,
        liquidity: u256,
        amount_a_min: u256,
        amount_b_min: u256,
        to: ContractAddress,
        deadline: u64,
    ) -> (u256, u256);
    fn swap_exact_tokens_for_tokens(
        ref self: TState,
        amount_in: u256,
        amount_out_min: u256,
        path: Span<ContractAddress>,
        to: ContractAddress,
        deadline: u64,
    ) -> Array<u256>;
    fn swap_tokens_for_exact_tokens(
        ref self: TState,
        amount_out: u256,
        amount_in_max: u256,
        path: Span<ContractAddress>,
        to: ContractAddress,
        deadline: u64,
    ) -> Array<u256>;
}
