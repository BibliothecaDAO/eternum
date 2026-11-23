use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct CreateGameParams {
    pub name: felt252,
    pub family: u8,
    pub start_settling_at: u64,
    pub start_main_at: u64,
    pub duration_seconds: u64,
    pub dev_mode_on: bool,
    pub registration_start: u32,
    pub biome_climate: crate::rules::BiomeClimateConfig,
    pub map_override: Option<crate::rules::MapConfig>,
    pub seed: felt252,
    pub clock_scale: u8,
}

#[starknet::interface]
pub trait IRegistrar<T> {
    fn next_game_id(self: @T) -> u32;
    fn game_id_by_name(self: @T, name: felt252) -> u32;
    fn create_game(ref self: T, params: CreateGameParams) -> u32;
}
#[starknet::interface]
pub trait IGameSettlement<T> {
    fn mark_game_settled(
        ref self: T, game_id: u32, actor: ContractAddress, context: crate::commands::ActionContext,
    ) -> u64;
}

pub fn validate_params(params: CreateGameParams) {
    assert!(params.name != 0, "game name is empty");
    assert!(params.seed != 0, "game seed is zero");
    assert!(params.duration_seconds != 0, "game duration is zero");
    crate::clock::validate_scale(params.clock_scale, params.dev_mode_on);
    crate::expeditions::validate_game(build_game(params));
    assert!(params.start_settling_at <= params.start_main_at, "invalid game schedule");
    assert!(
        Into::<u32, u64>::into(params.registration_start) < params.start_settling_at,
        "registration must open before settling",
    );
}

pub fn map_center_offset(game_id: u32, seed: felt252) -> u32 {
    const STEPS: u32 = (2147483646 / 2) / 10;
    let seed: u256 = seed.into();
    let seed_step: u32 = (seed % STEPS.into()).try_into().unwrap();
    ((seed_step + game_id % STEPS) % STEPS) * 10
}

pub fn build_game(params: CreateGameParams) -> crate::game::GameRegistry {
    crate::game::GameRegistry {
        name: params.name,
        family: params.family,
        settled: false,
        dev_mode_on: params.dev_mode_on,
        start_settling_at: params.start_settling_at,
        start_main_at: params.start_main_at,
        end_at: params.start_main_at + params.duration_seconds,
        scheduled_end_at: params.start_main_at + params.duration_seconds,
        seed: params.seed,
        clock_scale: params.clock_scale,
    }
}
pub fn game_overrides(game_id: u32, params: CreateGameParams) -> crate::game::GameOverrides {
    crate::game::GameOverrides {
        registration_start: params.registration_start,
        biome_climate: params.biome_climate,
        map: params.map_override,
        map_center_offset: map_center_offset(game_id, params.seed),
    }
}
