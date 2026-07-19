use starknet::ContractAddress;
use crate::types::{BackingTotal, BatchId, GameId, LiabilityId, LotSharePromotion};

// A9 feasibility ABI. A14 freezes these semantic requests after the inventory and authority graph are accepted.
#[derive(Drop, Serde)]
pub enum ResourceMutationAction {
    Credit,
    Debit,
    Transfer,
}

#[derive(Drop, Serde)]
pub enum StructureOwnershipMutationAction {
    Transfer,
    Capture,
}

#[derive(Drop, Serde)]
pub enum LazyProductionMutationAction {
    Reserve,
    Settle,
    Update,
    Release,
}

#[derive(Drop, Serde)]
pub enum ArrivalMutationAction {
    Create,
    Settle,
    Cancel,
}

#[derive(Drop, Serde)]
pub enum MilitaryCargoMutationAction {
    Create,
    Update,
    Destroy,
    EraseDeadCargo,
}

#[derive(Drop, Serde)]
pub enum TradeDonkeyMutationAction {
    Reserve,
    Fill,
    Cancel,
    Release,
}

#[derive(Drop, Serde)]
pub enum AmmLpMutationAction {
    Add,
    Remove,
    Swap,
    CreditWalletLp,
    DebitWalletLp,
}

#[derive(Drop, Serde)]
pub enum RewardStateMutationAction {
    Credit,
    Debit,
    Update,
}

#[derive(Drop, Serde)]
pub enum PendingWithdrawalMutationAction {
    Create,
    Append,
    Seal,
    Complete,
}

#[derive(Drop, Serde)]
pub enum ActiveExitBackingMutationAction {
    Reserve,
    Release,
    MoveToOutbox,
}

#[derive(Drop, Serde)]
pub enum PlayerEconomicLockMutationAction {
    Lock,
    Unlock,
    MarkExited,
}

#[derive(Drop, Serde)]
pub enum ExitPositionMutationAction {
    Create,
    Split,
    Merge,
    Tombstone,
}

#[derive(Drop, Serde)]
pub enum EconomicPositionFamily {
    Resource,
    StructureOwnership,
    LazyProduction,
    Arrival,
    MilitaryAndCargo,
    TradeAndDonkey,
    AmmAndLp,
    RewardState,
    PendingWithdrawal,
    ActiveExitBacking,
}

#[derive(Drop, Serde)]
pub struct AssignOpenBatchRequest {
    pub liability_id: LiabilityId,
    pub batch_id: BatchId,
    pub leaf_index: u8,
}

#[derive(Drop, Serde)]
pub struct PromoteSealedBatchRequest {
    pub batch_id: BatchId,
    pub parent_totals: Span<BackingTotal>,
    pub lot_share_promotions: Span<LotSharePromotion>,
}

#[derive(Drop, Serde)]
pub enum SettlementCallbackRequest {
    AssignOpenBatch: AssignOpenBatchRequest,
    PromoteSealedBatch: PromoteSealedBatchRequest,
}

#[derive(Drop, Serde)]
pub struct EconomicMutationResult {
    pub operation_id: u16,
    pub position_id: felt252,
    pub position_version: u64,
    pub backing_before: u256,
    pub backing_after: u256,
    pub index_high_watermark: u64,
}

#[derive(Drop, Serde)]
pub struct ResourceMutationRequest {
    pub game_id: GameId,
    pub action: ResourceMutationAction,
    pub source_entity_id: felt252,
    pub target_entity_id: felt252,
    pub resource_id: u32,
    pub amount: u256,
    pub expected_position_version: u64,
}

#[derive(Drop, Serde)]
pub struct StructureOwnershipMutationRequest {
    pub game_id: GameId,
    pub action: StructureOwnershipMutationAction,
    pub structure_id: felt252,
    pub previous_owner: ContractAddress,
    pub next_owner: ContractAddress,
    pub expected_position_version: u64,
}

#[derive(Drop, Serde)]
pub struct LazyProductionMutationRequest {
    pub game_id: GameId,
    pub action: LazyProductionMutationAction,
    pub producer_id: felt252,
    pub resource_id: u32,
    pub economic_timestamp: u64,
    pub rate: u128,
    pub sealed_end_ceiling: u256,
    pub expected_position_version: u64,
}

#[derive(Drop, Serde)]
pub struct ArrivalMutationRequest {
    pub game_id: GameId,
    pub action: ArrivalMutationAction,
    pub arrival_id: felt252,
    pub source_entity_id: felt252,
    pub destination_entity_id: felt252,
    pub resource_id: u32,
    pub amount: u256,
    pub expected_position_version: u64,
}

#[derive(Drop, Serde)]
pub struct MilitaryCargoMutationRequest {
    pub game_id: GameId,
    pub action: MilitaryCargoMutationAction,
    pub position_id: felt252,
    pub owner: ContractAddress,
    pub troop_or_resource_id: u32,
    pub amount: u256,
    pub expected_position_version: u64,
}

#[derive(Drop, Serde)]
pub struct TradeDonkeyMutationRequest {
    pub game_id: GameId,
    pub action: TradeDonkeyMutationAction,
    pub order_id: felt252,
    pub maker: ContractAddress,
    pub resource_id: u32,
    pub resource_amount: u256,
    pub donkey_amount: u256,
    pub expected_position_version: u64,
}

#[derive(Drop, Serde)]
pub struct AmmLpMutationRequest {
    pub game_id: GameId,
    pub action: AmmLpMutationAction,
    pub bank_id: felt252,
    pub wallet: ContractAddress,
    pub resource_a_id: u32,
    pub resource_b_id: u32,
    pub amount_a: u256,
    pub amount_b: u256,
    pub lp_amount: u256,
    pub expected_position_version: u64,
}

#[derive(Drop, Serde)]
pub struct RewardStateMutationRequest {
    pub game_id: GameId,
    pub action: RewardStateMutationAction,
    pub payout_purpose: felt252,
    pub participant: ContractAddress,
    pub asset_id: u32,
    pub amount: u256,
    pub expected_position_version: u64,
}

#[derive(Drop, Serde)]
pub struct PendingWithdrawalMutationRequest {
    pub game_id: GameId,
    pub action: PendingWithdrawalMutationAction,
    pub liability_id: LiabilityId,
    pub claimant_l2: ContractAddress,
    pub recipient_l1: ContractAddress,
    pub legs_hash: felt252,
    pub amount: u256,
    pub expected_position_version: u64,
}

#[derive(Drop, Serde)]
pub struct ActiveExitBackingMutationRequest {
    pub game_id: GameId,
    pub action: ActiveExitBackingMutationAction,
    pub parent_key_hash: felt252,
    pub lot_index: u8,
    pub amount: u256,
    pub expected_position_version: u64,
}

#[derive(Drop, Serde)]
pub struct PlayerEconomicLockMutationRequest {
    pub game_id: GameId,
    pub action: PlayerEconomicLockMutationAction,
    pub player_l2: ContractAddress,
    pub exit_id: felt252,
    pub economic_timestamp: u64,
    pub expected_position_version: u64,
}

#[derive(Drop, Serde)]
pub struct ExitPositionMutationRequest {
    pub game_id: GameId,
    pub action: ExitPositionMutationAction,
    pub family: EconomicPositionFamily,
    pub position_id: felt252,
    pub related_position_id: felt252,
    pub owner: ContractAddress,
    pub amount: u256,
    pub expected_position_version: u64,
}

pub trait IEconomicStateSystem<TContractState> {
    fn mutate_resource(ref self: TContractState, request: ResourceMutationRequest) -> EconomicMutationResult;
    fn mutate_structure_ownership(
        ref self: TContractState, request: StructureOwnershipMutationRequest,
    ) -> EconomicMutationResult;
    fn mutate_lazy_production(
        ref self: TContractState, request: LazyProductionMutationRequest,
    ) -> EconomicMutationResult;
    fn mutate_arrival(ref self: TContractState, request: ArrivalMutationRequest) -> EconomicMutationResult;
    fn mutate_military_and_cargo(
        ref self: TContractState, request: MilitaryCargoMutationRequest,
    ) -> EconomicMutationResult;
    fn mutate_trade_and_donkey(ref self: TContractState, request: TradeDonkeyMutationRequest) -> EconomicMutationResult;
    fn mutate_amm_and_lp(ref self: TContractState, request: AmmLpMutationRequest) -> EconomicMutationResult;
    fn mutate_reward_state(ref self: TContractState, request: RewardStateMutationRequest) -> EconomicMutationResult;
    fn mutate_pending_withdrawal(
        ref self: TContractState, request: PendingWithdrawalMutationRequest,
    ) -> EconomicMutationResult;
    fn mutate_active_exit_backing(
        ref self: TContractState, request: ActiveExitBackingMutationRequest,
    ) -> EconomicMutationResult;
    fn mutate_player_economic_lock(
        ref self: TContractState, request: PlayerEconomicLockMutationRequest,
    ) -> EconomicMutationResult;
    fn mutate_exit_position(ref self: TContractState, request: ExitPositionMutationRequest) -> EconomicMutationResult;
    fn assign_open_batch(
        ref self: TContractState, liability_id: LiabilityId, batch_id: BatchId, leaf_index: u8,
    ) -> felt252;
    fn promote_sealed_batch(
        ref self: TContractState,
        batch_id: BatchId,
        parent_totals: Span<BackingTotal>,
        lot_share_promotions: Span<LotSharePromotion>,
    ) -> felt252;
    fn get_liability_assignment(self: @TContractState, liability_id: LiabilityId) -> Option<(BatchId, u8)>;
    fn get_backing_total(self: @TContractState, game_id: GameId, parent_key_hash: felt252) -> Option<BackingTotal>;
    fn get_position_version(self: @TContractState, game_id: GameId, position_id: felt252) -> Option<u64>;
    fn is_player_economically_locked(self: @TContractState, game_id: GameId, player_l2: ContractAddress) -> bool;
}
