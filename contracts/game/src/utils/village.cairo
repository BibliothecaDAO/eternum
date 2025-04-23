use starknet::ContractAddress;

#[starknet::interface]
pub trait IVillagePass<TState> {
    fn mint(ref self: TState, recipient: ContractAddress) -> u256;
    fn transfer_from(ref self: TState, from: ContractAddress, to: ContractAddress, token_id: u256);
}
