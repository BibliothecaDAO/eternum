use crate::rules::SliceRules;
pub const FRONTIER: u8 = 1;
pub const BLITZ: u8 = 2;
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub enum GameStatus {
    #[default]
    Created,
    Registration,
    Live,
    Ended,
    Settled,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct GameRegistry {
    pub name: felt252,
    pub family: u8,
    pub settled: bool,
    pub dev_mode_on: bool,
    pub start_settling_at: u64,
    pub start_main_at: u64,
    pub end_at: u64,
    pub end_grace_seconds: u32,
    pub seed: felt252,
    pub scheduled_end_at: u64,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct GameOverrides {
    pub registration_start: u32,
    pub biome_climate: crate::rules::BiomeClimateConfig,
    pub map: Option<crate::rules::MapConfig>,
    pub map_center_offset: u32,
}

#[starknet::interface]
pub trait IGame<T> {
    fn game(self: @T, game_id: u32) -> GameRegistry;
    fn rules(self: @T, game_id: u32) -> SliceRules;
    fn write_game(ref self: T, game_id: u32, game: GameRegistry);
}

pub fn status_at(game: GameRegistry, timestamp: u64) -> GameStatus {
    if game.settled {
        GameStatus::Settled
    } else if game.end_at != 0 && timestamp >= game.end_at {
        GameStatus::Ended
    } else if game.dev_mode_on || timestamp >= game.start_main_at {
        GameStatus::Live
    } else {
        GameStatus::Registration
    }
}

pub fn assert_playing(game: GameRegistry, now: u64) {
    assert!(game.dev_mode_on || (now >= game.start_main_at && now >= game.start_settling_at), "game not started");
    assert!(game.end_at == 0 || now < game.end_at, "game ended");
}

pub fn assert_main_with_grace(game: GameRegistry, now: u64) {
    assert!(game.dev_mode_on || (now >= game.start_main_at && now >= game.start_settling_at), "game not started");
    assert_grace_end(game, now);
}

pub fn assert_settling_with_grace(game: GameRegistry, now: u64) {
    assert!(game.dev_mode_on || now >= game.start_settling_at, "settling not started");
    assert_grace_end(game, now);
}

fn assert_grace_end(game: GameRegistry, now: u64) {
    if game.end_at != 0 && now >= game.end_at {
        assert!(now <= game.end_at + game.end_grace_seconds.into(), "game grace period ended");
    }
}
