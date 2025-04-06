use s1_eternum::alias::ID;
use s1_eternum::models::position::Coord;
use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, IntrospectPacked)]
#[dojo::model]
pub struct QuestDetails {
    #[key]
    pub id: u32,
    pub coord: Coord,
    pub game_index_id: u8,
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
    pub id: u32,
    pub details_id: u32,
    pub explorer_id: ID,
    pub game_token_id: u64,
    pub completed: bool,
}

#[derive(Copy, Drop, Serde, IntrospectPacked)]
#[dojo::model]
pub struct RealmRegistrations {
    #[key]
    pub details_id: u32,
    #[key]
    pub realm_id: u16,
    pub quest_id: u32,
}

#[derive(Copy, Drop, Serde, IntrospectPacked)]
#[dojo::model]
pub struct QuestCounter {
    #[key]
    pub key: felt252,
    pub count: u32,
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct QuestGameRegistry {
    #[key]
    pub key: felt252, // Singleton key, e.g., 'QUEST_GAME_REGISTRY'
    pub game_list: Span<QuestGame>,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct QuestGame {
    pub game_address: ContractAddress,
    pub levels: Span<LevelConfig>,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct LevelConfig {
    pub target_score: u32,
    pub settings_id: u32,
    pub time_limit: u64,
}
