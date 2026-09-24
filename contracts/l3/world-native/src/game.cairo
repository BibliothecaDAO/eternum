use starknet::ContractAddress;
use crate::rules::SliceRules;
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
    pub preset_id: u32,
    pub creator: ContractAddress,
    pub settled: bool,
    pub ready: bool,
    pub dev_mode_on: bool,
    pub start_settling_at: u64,
    pub start_main_at: u64,
    pub end_at: u64,
    pub end_grace_seconds: u32,
    pub seed: felt252,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct GameOverrides {
    pub registration_start: u32,
    pub biome_climate: crate::rules::BiomeClimateConfig,
    pub map: Option<crate::rules::MapConfig>,
    pub map_center_offset: u32,
}

#[derive(Copy, Drop, Serde)]
pub enum PointActivity {
    Exploration,
    RelicChest,
    HyperstructureCapture,
    StructureCapture,
    Hyperstructure,
}

#[derive(Drop, starknet::Event)]
pub struct PointsAwarded {
    #[key]
    pub version: u8,
    #[key]
    pub game_id: u32,
    #[key]
    pub player: ContractAddress,
    pub activity: PointActivity,
    pub points: u128,
}

#[starknet::interface]
pub trait IGame<T> {
    fn game(self: @T, game_id: u32) -> GameRegistry;
    fn rules(self: @T, game_id: u32) -> SliceRules;
    fn write_game(ref self: T, game_id: u32, game: GameRegistry);
    fn start_blitz(ref self: T, game_id: u32, timestamp: u64);
}

#[starknet::interface]
pub trait IPoints<T> {
    fn register_exploration(
        ref self: T, game_id: u32, actor: ContractAddress, game_context: crate::commands::ActionContext,
    );
    fn register_capture(
        ref self: T, game_id: u32, actor: ContractAddress, category: u8, game_context: crate::commands::ActionContext,
    ) -> u128;
    fn register_relic_points(
        ref self: T, game_id: u32, actor: ContractAddress, game_context: crate::commands::ActionContext,
    );
    fn register_hyperstructure_points(ref self: T, game_id: u32, actor: ContractAddress, amount: u128);
    fn player_points(self: @T, game_id: u32, actor: ContractAddress) -> u128;
    fn season_points(self: @T, game_id: u32) -> u128;
}

#[starknet::interface]
pub trait ISeasonLifecycle<T> {
    fn season_win_threshold(self: @T, game_id: u32) -> u128;
    fn close_season(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> (u64, crate::ownership::StoryCursor);
}

pub fn status_at(game: GameRegistry, timestamp: u64) -> GameStatus {
    if game.settled {
        GameStatus::Settled
    } else if !game.ready {
        GameStatus::Registration
    } else if game.end_at != 0 && timestamp >= game.end_at {
        GameStatus::Ended
    } else if game.dev_mode_on || timestamp >= game.start_main_at {
        GameStatus::Live
    } else {
        GameStatus::Registration
    }
}

pub fn assert_playing(game: GameRegistry, now: u64) {
    assert!(game.ready, "roster not ready");
    assert!(game.dev_mode_on || (now >= game.start_main_at && now >= game.start_settling_at), "game not started");
    assert!(game.end_at == 0 || now < game.end_at, "game ended");
}

pub fn assert_main_with_grace(game: GameRegistry, now: u64) {
    assert!(game.ready, "roster not ready");
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
