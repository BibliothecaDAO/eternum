use starknet::ContractAddress;
use crate::commands::ExecutionContext;

pub const VILLAGE_CATEGORY: u8 = 5;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct TransferOwnership {
    pub entity_id: u32,
    pub new_owner: ContractAddress,
}

#[starknet::interface]
pub trait IStructureOwnership<T> {
    fn transfer_structure_ownership(
        ref self: T, game_id: u32, actor: ContractAddress, command: TransferOwnership, context: ExecutionContext,
    );
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct FaithPointsClaimedStory {
    pub wonder_id: u32,
    pub new_points: u128,
    pub total_points: u128,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct StructureLevelUpStory {
    pub new_level: u8,
}

// Native history variants append independently of the legacy wire discriminants.
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum Story {
    FaithPointsClaimedStory: FaithPointsClaimedStory,
    StructureLevelUpStory: StructureLevelUpStory,
    RealmCreatedStory: RealmCreatedStory,
    GuardAddStory: GuardAddStory,
    ResourceBurnStory: ResourceAmountsStory,
    ResourceTransferStory: ResourceTransferStory,
    ResourceReceiveArrivalStory: ResourceAmountsStory,
    ProductionStory: ProductionStory,
    BuildingPlacementStory: BuildingPlacementStory,
    BuildingPaymentStory: BuildingPaymentStory,
    BitcoinAwardStory: crate::bitcoin::BitcoinAwardStory,
    StructureCapturedStory: StructureCapturedStory,
    TradeCreated: crate::trade::TradeListing,
    TradeAccepted: crate::trade::TradeFill,
    TradeCancelled: u32,
    BankSwap: crate::market::SwapStory,
    BankLiquidity: crate::market::LiquidityStory,
    HyperstructurePoints: crate::hyperstructures::SharePoints,
    RelicChestOpened: crate::relics::ChestOpened,
    ExplorationReward: crate::exploration_rewards::ExtractedReward,
    SeasonEnded: ContractAddress,
    FaithPledged: crate::faith::PledgeStory,
    FaithRemoved: crate::faith::Pledge,
    PrizeDistributionFinal: u128,
    PrizeResult: crate::blitz_prizes::PrizeResult,
    RelicCrafted: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ResourceAmountsStory {
    pub resources: Span<crate::resources::ResourceAmount>,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum TransferType {
    Instant,
    InstantStorable,
    Delayed,
    InstantArrivals,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ResourceTransferStory {
    pub transfer_type: TransferType,
    pub from_entity_id: u32,
    pub from_entity_owner_address: ContractAddress,
    pub to_entity_id: u32,
    pub to_entity_owner_address: ContractAddress,
    pub resources: Span<crate::resources::ResourceAmount>,
    pub is_mint: bool,
    pub travel_time: u64,
}

#[derive(Drop, starknet::Event)]
pub struct StoryEvent {
    #[key]
    pub version: u8,
    #[key]
    pub game_id: u32,
    #[key]
    pub id: u32,
    #[key]
    pub owner: Option<ContractAddress>,
    #[key]
    pub entity_id: Option<u32>,
    #[key]
    pub tx_hash: felt252,
    pub story: Story,
    pub timestamp: u64,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RealmCreatedStory {
    pub coord: crate::troops::Coord,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct GuardAddStory {
    pub structure_id: u32,
    pub slot: u8,
    pub category: u8,
    pub tier: u8,
    pub amount: u128,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ProductionStory {
    pub received_resource_type: u8,
    pub received_amount: u128,
    pub cost: Span<crate::resources::ResourceAmount>,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum BuildingChange {
    Created,
    Destroyed,
    Paused,
    Resumed,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BuildingPlacementStory {
    pub coord: crate::troops::Coord,
    pub category: u8,
    pub change: BuildingChange,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BuildingPaymentStory {
    pub coord: crate::troops::Coord,
    pub category: u8,
    pub cost: Span<crate::resources::ResourceAmount>,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct StructureCapturedStory {
    pub previous_owner: ContractAddress,
    pub new_owner: ContractAddress,
    pub points: u128,
}
