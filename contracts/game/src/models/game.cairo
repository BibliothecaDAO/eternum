use starknet::ContractAddress;


pub const GAME_COUNTER_ID: u8 = 0;


#[derive(Copy, Drop, Serde, Introspect, PartialEq, Default, DojoStore)]
pub enum GameStatus {
    #[default]
    Created,
    Registration,
    Live,
    Ended,
    Settled,
}


#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct GameRegistry {
    #[key]
    pub game_id: u32,
    pub name: felt252,
    pub series_id: felt252,
    pub game_number_in_series: u16,
    pub preset_id: u32,
    pub creator: ContractAddress,
    pub status: GameStatus,
    pub dev_mode_on: bool,
    pub start_settling_at: u64,
    pub start_main_at: u64,
    pub end_at: u64,
    pub end_grace_seconds: u32,
    pub registration_grace_seconds: u32,
    pub final_trial_id: u128,
    pub seed: felt252,
    pub fees_collected: u256,
    pub fees_paid_out: u256,
}


#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct GameCounter {
    #[key]
    pub id: u8,
    pub next_game_id: u32,
}


#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct Preset {
    #[key]
    pub preset_id: u32,
    pub registered: bool,
}


#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct Series {
    #[key]
    pub series_id: felt252,
    pub owner: ContractAddress,
    pub game_count: u16,
    pub num_games: u32,
    pub total_chests: u128,
    pub cap_ratio_bps: u128,
}
