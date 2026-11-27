use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct StructureLevelUpStory {
    pub new_level: u8,
}

pub use crate::story_serde::StorySerde;

#[derive(Copy, Drop, Debug, PartialEq)]
pub enum Story {
    StructureLevelUpStory: StructureLevelUpStory,
    RealmCreatedStory: RealmCreatedStory,
    GuardAddStory: GuardAddStory,
    ResourceBurnStory: ResourceAmountsStory,
    ResourceTransferStory: ResourceTransferStory,
    ResourceReceiveArrivalStory: ResourceAmountsStory,
    ProductionStory: ProductionStory,
    BuildingPlacementStory: BuildingPlacementStory,
    BuildingPaymentStory: BuildingPaymentStory,
    StructureCapturedStory: StructureCapturedStory,
    ExplorationReward: crate::exploration_rewards::ExtractedReward,
    BlitzFinalized: felt252,
    ExplorerCreateStory: crate::troop_management::ExplorerCreated,
    ExplorerAddStory: crate::troop_management::ExplorerAdded,
    ExplorerDeleteStory: crate::troop_management::ExplorerRemoved,
    GuardDeleteStory: crate::troop_management::GuardSlot,
    TroopsTransferred: crate::troop_management::TransferTroops,
    LordsWithdrawn: crate::relics::LordsWithdrawal,
    SitePayout: crate::expeditions::SitePayout,
    SpireDiscovered: crate::exploration_rewards::ExtractedReward,
    SiteUsed: crate::relics::SiteUsed,
    RelicCollected: crate::army_relics::RelicCollected,
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
    pub from_entity_id: u64,
    pub from_entity_owner_address: ContractAddress,
    pub to_entity_id: u64,
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
    pub owner: Option<ContractAddress>,
    #[key]
    pub entity_id: Option<u64>,
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
    pub structure_id: u64,
    pub slot: u8,
    pub category: crate::troops::TroopType,
    pub tier: crate::troops::TroopTier,
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
}
