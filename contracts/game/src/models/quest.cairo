use s1_eternum::alias::ID;
use s1_eternum::models::position::Coord;
use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, IntrospectPacked)]
#[dojo::model]
pub struct QuestTile {
    #[key]
    pub id: u32,
    pub game_address: ContractAddress,
    pub coord: Coord,
    pub level: u8,
    pub resource_type: u8,
    pub amount: u128,
    pub capacity: u16,
    pub participant_count: u16,
}

#[derive(Copy, Drop, Serde, IntrospectPacked)]
#[dojo::model]
pub struct Quest {
    #[key]
    pub game_token_id: u64,
    #[key]
    pub game_address: ContractAddress,
    pub quest_tile_id: u32,
    pub explorer_id: ID,
    pub completed: bool,
}

#[derive(Drop, Serde)]
pub struct QuestDetails {
    pub quest_tile_id: u32,
    pub game_address: ContractAddress,
    pub coord: Coord,
    pub target_score: u32,
    pub reward_name: ByteArray,
    pub reward_amount: u128,
}

#[derive(Copy, Drop, Serde, IntrospectPacked)]
#[dojo::model]
pub struct QuestRegistrations {
    #[key]
    pub quest_tile_id: u32,
    #[key]
    pub realm_or_village_id: u32,
    pub game_token_id: u64,
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct QuestGameRegistry {
    #[key]
    pub key: felt252,
    pub games: Span<ContractAddress>,
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct QuestLevels {
    #[key]
    pub game_address: ContractAddress,
    pub levels: Span<Level>,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct Level {
    pub target_score: u32,
    pub settings_id: u32,
    pub time_limit: u64,
}

#[derive(Copy, Drop, Serde, IntrospectPacked)]
#[dojo::model]
pub struct QuestFeatureFlag {
    #[key]
    pub key: felt252,
    pub enabled: bool,
}

