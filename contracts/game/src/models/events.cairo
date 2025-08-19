use s1_eternum::alias::ID;
use s1_eternum::models::position::Coord;
use s1_eternum::models::troop::{GuardSlot, TroopType, TroopTier };
use s1_eternum::models::position::Direction;        
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
    // Troop Management
    GuardAddStory: GuardAddStory,
    GuardDeleteStory: GuardDeleteStory,
    ExplorerCreateStory: ExplorerCreateStory,
    ExplorerAddStory: ExplorerAddStory,
    ExplorerDeleteStory: ExplorerDeleteStory,
    ExplorerExplorerSwapStory: ExplorerExplorerSwapStory,
    ExplorerGuardSwapStory: ExplorerGuardSwapStory,
    GuardExplorerSwapStory: GuardExplorerSwapStory,
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

