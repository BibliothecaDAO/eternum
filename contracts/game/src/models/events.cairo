use crate::alias::ID;
use crate::models::position::{Coord, Direction};
use crate::models::troop::{GuardSlot, TroopTier, TroopType};
use starknet::ContractAddress;

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::event(historical: false)]
pub struct StoryEvent {
    #[key]
    pub owner: Option<ContractAddress>,
    #[key]
    pub entity_id: Option<ID>,
    #[key]
    pub tx_hash: felt252,
    pub story: Story,
    pub timestamp: u64,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub enum Story {
    RealmCreatedStory: RealmCreatedStory,
    // Building
    BuildingPlacementStory: BuildingPlacementStory,
    BuildingPaymentStory: BuildingPaymentStory,
    // Production
    ProductionStory: ProductionStory,
    // Structure Upgrade
    StructureLevelUpStory: StructureLevelUpStory,
    // Troop Movement
    ExplorerMoveStory: ExplorerMoveStory,
    // Troop Battle
    BattleStory: BattleStory,
    // Resource Transfer
    ResourceTransferStory: ResourceTransferStory,
    ResourceBurnStory: ResourceBurnStory,
    ResourceReceiveArrivalStory: ResourceReceiveArrivalStory,
    // Troop Management
    GuardAddStory: GuardAddStory,
    GuardDeleteStory: GuardDeleteStory,
    ExplorerCreateStory: ExplorerCreateStory,
    ExplorerAddStory: ExplorerAddStory,
    ExplorerDeleteStory: ExplorerDeleteStory,
    ExplorerExplorerSwapStory: ExplorerExplorerSwapStory,
    ExplorerGuardSwapStory: ExplorerGuardSwapStory,
    GuardExplorerSwapStory: GuardExplorerSwapStory,
    // Prize Distribution
    PrizeDistributionFinalStory: PrizeDistributionFinalStory,
    PrizeDistributedStory: PrizeDistributedStory,
}

///////////////////////////////////////////////
///  Realm Creation
///
///////////////////////////////////////////////

#[derive(Introspect, Copy, Drop, Serde)]
pub struct RealmCreatedStory {
    pub coord: Coord,
}


///////////////////////////////////////////////
///  Building placement, pausing & payment
///
///////////////////////////////////////////////

#[derive(Introspect, Copy, Drop, Serde)]
pub struct BuildingPlacementStory {
    pub inner_coord: Coord,
    pub category: u8,
    pub created: bool,
    pub destroyed: bool,
    pub paused: bool,
    pub unpaused: bool,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct BuildingPaymentStory {
    pub inner_coord: Coord,
    pub category: u8,
    pub cost: Span<(u8, u128)>,
}

///////////////////////////////////////////////
///  Production
///
///////////////////////////////////////////////

#[derive(Introspect, Copy, Drop, Serde)]
pub struct ProductionStory {
    pub received_resource_type: u8,
    pub received_amount: u128,
    pub cost: Span<(u8, u128)>,
}

///////////////////////////////////////////////
///  Structure
///
///////////////////////////////////////////////

#[derive(Introspect, Copy, Drop, Serde)]
pub struct StructureLevelUpStory {
    pub new_level: u8,
}

///////////////////////////////////////////////
///  Troop Movement
///
///////////////////////////////////////////////

#[derive(Introspect, Copy, Drop, Serde)]
pub enum ExploreFind {
    None,
    Hyperstructure,
    Mine,
    Agent,
    Quest,
    Village,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct ExplorerMoveStory {
    pub explorer_id: ID,
    pub explorer_structure_id: ID,
    pub start_coord: Coord,
    pub directions: Span<Direction>,
    pub end_coord: Coord,
    pub explore: bool,
    pub explore_find: ExploreFind,
    pub reward_resource_type: u8,
    pub reward_resource_amount: u128,
}

///////////////////////////////////////////////
///  Troop Battle
///
///////////////////////////////////////////////

#[derive(Introspect, Copy, Drop, Serde)]
pub enum BattleType {
    ExplorerVsExplorer,
    ExplorerVsGuard,
    GuardVsExplorer,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct BattleStory {
    pub battle_type: BattleType,
    pub attacker_id: ID,
    pub attacker_owner_id: ID,
    pub attacker_owner_address: ContractAddress,
    pub attacker_troops_type: TroopType,
    pub attacker_troops_tier: TroopTier,
    pub attacker_troops_before: u128,
    pub attacker_troops_lost: u128,
    pub defender_id: ID,
    pub defender_owner_id: ID,
    pub defender_owner_address: ContractAddress,
    pub defender_troops_type: TroopType,
    pub defender_troops_tier: TroopTier,
    pub defender_troops_before: u128,
    pub defender_troops_lost: u128,
    pub winner_id: ID,
    pub stolen_resources: Span<(u8, u128)>,
}

///////////////////////////////////////////////
///  Resource Transfer
///
///////////////////////////////////////////////

#[derive(Introspect, Copy, Drop, Serde)]
pub enum TransferType {
    Instant,
    InstantStorable,
    InstantArrivals,
    Delayed,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct ResourceTransferStory {
    pub transfer_type: TransferType,
    pub from_entity_id: ID,
    pub from_entity_owner_address: ContractAddress,
    pub to_entity_id: ID,
    pub to_entity_owner_address: ContractAddress,
    pub resources: Span<(u8, u128)>,
    pub is_mint: bool,
    pub travel_time: u64,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct ResourceBurnStory {
    pub resources: Span<(u8, u128)>,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct ResourceReceiveArrivalStory {
    pub resources: Span<(u8, u128)>,
}

///////////////////////////////////////////////
///  Troop Management
///
///////////////////////////////////////////////

#[derive(Introspect, Copy, Drop, Serde)]
pub struct GuardAddStory {
    pub structure_id: ID,
    pub slot: GuardSlot,
    pub category: TroopType,
    pub tier: TroopTier,
    pub amount: u128,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct GuardDeleteStory {
    pub structure_id: ID,
    pub slot: GuardSlot,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct ExplorerCreateStory {
    pub structure_id: ID,
    pub explorer_id: ID,
    pub category: TroopType,
    pub tier: TroopTier,
    pub amount: u128,
    pub spawn_direction: Direction,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct ExplorerAddStory {
    pub explorer_id: ID,
    pub amount: u128,
    pub home_direction: Direction,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct ExplorerDeleteStory {
    pub explorer_id: ID,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct ExplorerExplorerSwapStory {
    pub from_explorer_id: ID,
    pub to_explorer_id: ID,
    pub to_explorer_direction: Direction,
    pub count: u128,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct ExplorerGuardSwapStory {
    pub from_explorer_id: ID,
    pub to_structure_id: ID,
    pub to_structure_direction: Direction,
    pub to_guard_slot: GuardSlot,
    pub count: u128,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct GuardExplorerSwapStory {
    pub from_structure_id: ID,
    pub from_guard_slot: GuardSlot,
    pub to_explorer_id: ID,
    pub to_explorer_direction: Direction,
    pub count: u128,
}


///////////////////////////////////////////////
///  Prize Distribution
///
///////////////////////////////////////////////

#[derive(Introspect, Copy, Drop, Serde)]
pub struct PrizeDistributedStory {
    pub to_player_address: ContractAddress,
    pub amount: u128,
    pub decimals: u8,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct PrizeDistributionFinalStory {
    pub trial_id: u128,
}
