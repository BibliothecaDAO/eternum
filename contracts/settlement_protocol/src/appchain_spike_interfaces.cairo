use starknet::ContractAddress;
use crate::types::{BackingTotal, LotSharePromotion};

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

// A17 feasibility seam. Production ownership remains with the frozen settlement interfaces.
#[derive(Copy, Debug, Drop, PartialEq, Serde)]
pub struct BatchCapacitySnapshot {
    pub batch_id: u64,
    pub liability_count: u8,
    pub activation_count: u8,
    pub parent_count: u8,
    pub lot_share_count: u16,
    pub sealed: bool,
}

#[derive(Copy, Drop, Serde)]
pub struct BatchSealSummary {
    pub batch_id: u64,
    pub parent_count: u8,
    pub lot_share_count: u16,
    pub game_callback_count: u8,
    pub global_parent_count: u8,
    pub global_lot_share_count: u16,
    pub post_state_hash: felt252,
}

#[derive(Copy, Debug, Drop, PartialEq, Serde)]
pub struct PendingSourceSnapshot {
    pub source_generation: u64,
    pub pending_liability_id: felt252,
    pub parent_count: u8,
    pub lot_share_count: u16,
    pub assigned_batch_id: u64,
    pub assigned_leaf_index: u8,
    pub assigned: bool,
}

#[starknet::interface]
pub trait IPendingLiabilitySourceSpike<TContractState> {
    fn pending_vectors(
        self: @TContractState, liability_id: felt252,
    ) -> (felt252, felt252, u64, Array<BackingTotal>, Array<LotSharePromotion>);
    fn mark_batch_assigned(ref self: TContractState, liability_id: felt252, batch_id: u64, leaf_index: u8);
    fn snapshot(self: @TContractState) -> PendingSourceSnapshot;
}

#[starknet::interface]
pub trait IPendingLiabilitySourceAdminSpike<TContractState> {
    fn create_pending_liability(
        ref self: TContractState,
        liability_id: felt252,
        parent_totals: Span<BackingTotal>,
        lot_share_promotions: Span<LotSharePromotion>,
    );
}

#[starknet::interface]
pub trait ISeasonSettlementCapacitySpike<TContractState> {
    fn register_game(ref self: TContractState, game_id: felt252, economic_state: ContractAddress);
    fn register_source(ref self: TContractState, source_id: felt252, game_id: felt252, provider: ContractAddress);
    fn append_pending_liability(
        ref self: TContractState, source_id: felt252, expected_generation: u64, liability_id: felt252,
    ) -> (u64, u8);
    fn append_activation_only(ref self: TContractState, activation_id: felt252) -> (u64, u8);
    fn seal_open_batch(ref self: TContractState) -> BatchSealSummary;
    fn register_global_factory_world(
        ref self: TContractState, world_id: felt252, component_hash: felt252, writer_hash: felt252,
    );
    fn finalize_global_factory_seal(ref self: TContractState) -> felt252;
    fn batch_capacity(self: @TContractState, batch_id: u64) -> BatchCapacitySnapshot;
    fn source_snapshot(self: @TContractState, source_id: felt252) -> PendingSourceSnapshot;
    fn global_active_total(self: @TContractState) -> u256;
    fn global_cumulative_total(self: @TContractState) -> u256;
    fn global_factory_seal_hash(self: @TContractState) -> felt252;
}

#[starknet::interface]
pub trait IEconomicCallbackMetricsSpike<TContractState> {
    fn preview_promotion(
        self: @TContractState, parent_totals: Span<BackingTotal>, lot_share_promotions: Span<LotSharePromotion>,
    ) -> bool;
    fn stage_active_totals(
        ref self: TContractState, parent_totals: Span<BackingTotal>, lot_share_promotions: Span<LotSharePromotion>,
    );
    fn assignment_count(self: @TContractState) -> u64;
    fn promotion_count(self: @TContractState) -> u64;
    fn last_parent_count(self: @TContractState) -> u8;
    fn last_lot_share_count(self: @TContractState) -> u16;
    fn active_total(self: @TContractState) -> u256;
    fn cumulative_total(self: @TContractState) -> u256;
    fn post_state_hash(self: @TContractState) -> felt252;
}
