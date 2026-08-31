use starknet::{ClassHash, ContractAddress};

#[starknet::interface]
pub trait IRealmsSwapFactory<TState> {
    fn get_pair(self: @TState, token0: ContractAddress, token1: ContractAddress) -> ContractAddress;
    fn get_all_pairs(self: @TState) -> Array<ContractAddress>;
    fn get_num_of_pairs(self: @TState) -> u64;
    fn get_fee_to(self: @TState) -> ContractAddress;
    fn get_fee_amount(self: @TState) -> u256;
    fn get_pair_default_admin(self: @TState) -> ContractAddress;
    fn get_pair_upgrader(self: @TState) -> ContractAddress;
    fn get_pair_contract_class_hash(self: @TState) -> ClassHash;
    fn create_pair(ref self: TState, token_a: ContractAddress, token_b: ContractAddress) -> ContractAddress;
    fn set_fee_to(ref self: TState, new_fee_to: ContractAddress);
    fn set_fee_amount(ref self: TState, new_fee_amount: u256);
    fn set_pair_default_admin(ref self: TState, new_pair_default_admin: ContractAddress);
    fn set_pair_upgrader(ref self: TState, new_pair_upgrader: ContractAddress);
}
