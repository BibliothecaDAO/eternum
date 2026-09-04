use core::num::traits::zero::Zero;
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
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


#[generate_trait]
pub impl GameRegistryImpl of GameRegistryTrait {
    fn get(world: WorldStorage, game_id: u32) -> GameRegistry {
        assert!(game_id.is_non_zero(), "Eternum: game id 0 is reserved");
        let game: GameRegistry = world.read_model(game_id);
        assert!(game.creator.is_non_zero(), "Eternum: game does not exist");
        game
    }

    fn assert_same_game(expected_game_id: u32, actual_game_id: u32) {
        assert!(expected_game_id == actual_game_id, "Eternum: entities belong to different games");
    }
}
