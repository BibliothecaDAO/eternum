use s1_eternum::alias::ID;
use s1_eternum::models::position::Coord;
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
    BuildingPlacementStory: BuildingPlacementStory,
    BuildingPaymentStory: BuildingPaymentStory,
    // BattleStory: BattleStory,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct RealmCreatedStory {
    pub coord: Coord,
}

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

// #[derive(Introspect, Copy, Drop, Serde)]
// pub struct BattleStory {
//     pub abc: u64,
//     pub def: u64,
// }

