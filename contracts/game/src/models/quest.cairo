use s1_eternum::alias::ID;
use s1_eternum::models::position::Coord;
use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, IntrospectPacked)]
#[dojo::model]
pub struct QuestDetails {
    #[key]
    pub id: u64,
    pub coord: Coord,
    pub reward: Reward,
    pub capacity: u16,
    pub participant_count: u16,
    pub settings_id: u32,
    pub target_score: u32,
    pub expires_at: u64,
    pub game_address: ContractAddress,
}

#[derive(Copy, Drop, Serde, IntrospectPacked)]
pub struct Reward {
    pub resource_type: u8,
    pub amount: u128,
}

#[derive(Copy, Drop, Serde, IntrospectPacked)]
#[dojo::model]
pub struct Quest {
    #[key]
    pub id: u64,
    pub details_id: u64,
    pub explorer_id: ID,
    pub game_token_id: u64,
    pub completed: bool,
}

#[derive(Copy, Drop, Serde, IntrospectPacked)]
#[dojo::model]
pub struct RealmRegistrations {
    #[key]
    pub details_id: u64,
    #[key]
    pub realm_id: u16,
    pub quest_id: u64,
}

#[derive(Copy, Drop, Serde, IntrospectPacked)]
#[dojo::model]
pub struct QuestCounter {
    #[key]
    pub key: felt252,
    pub count: u64,
}

#[derive(Copy, Drop, Serde, IntrospectPacked)]
#[dojo::model]
pub struct QuestDetailsCounter {
    #[key]
    pub key: felt252,
    pub count: u64,
}

