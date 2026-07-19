use starknet::ContractAddress;

// A10 feasibility interfaces. A14 freezes the accepted topology into the generated v1 protocol registry.
#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct RootStreamEntry {
    pub nonce: u64,
    pub game_id: felt252,
    pub world: ContractAddress,
    pub adapter: ContractAddress,
    pub amount: u128,
}

#[starknet::interface]
pub trait IFactoryWorldSpike<TContractState> {
    fn game_id(self: @TContractState) -> felt252;
}

#[starknet::interface]
pub trait IGameSettlementAdapterSpike<TContractState> {
    fn append_claim(ref self: TContractState, amount: u128) -> u64;
    fn game_id(self: @TContractState) -> felt252;
    fn world(self: @TContractState) -> ContractAddress;
}

#[starknet::interface]
pub trait ISeasonSettlementHubSpike<TContractState> {
    fn register_game(ref self: TContractState, game_id: felt252, world: ContractAddress, adapter: ContractAddress);
    fn append_claim(ref self: TContractState, amount: u128) -> u64;
    fn stream_length(self: @TContractState) -> u64;
    fn get_entry(self: @TContractState, nonce: u64) -> Option<RootStreamEntry>;
}
