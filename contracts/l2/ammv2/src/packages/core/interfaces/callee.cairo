use starknet::ContractAddress;

#[starknet::interface]
pub trait IRealmsSwapCallee<TState> {
    fn swap_callback(
        ref self: TState, sender: ContractAddress, amount0_out: u256, amount1_out: u256, data: Span<felt252>,
    );
}
