use starknet::ContractAddress;
use crate::presets::PresetDefinition;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct CreateGameParams {
    pub name: felt252,
    pub preset_id: u32,
    pub start_settling_at: u64,
    pub start_main_at: u64,
    pub duration_seconds: u64,
    pub end_grace_seconds: u32,
    pub dev_mode_on: bool,
    pub roster: Span<RosterPlayer>,
    pub registration_start: u32,
    pub biome_climate: crate::rules::BiomeClimateConfig,
    pub map_override: Option<crate::rules::MapConfig>,
    pub seed: felt252,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct RosterPlayer {
    pub account: ContractAddress,
}

#[starknet::interface]
pub trait IRegistrar<T> {
    fn register_preset(ref self: T, preset_id: u32, definition: PresetDefinition);
    fn preset_commitment(self: @T, preset_id: u32) -> felt252;
    fn next_game_id(self: @T) -> u32;
    fn game_id_by_name(self: @T, name: felt252) -> u32;
    fn blitz_roster(self: @T, game_id: u32) -> Span<RosterPlayer>;
    fn create_game(ref self: T, params: CreateGameParams) -> u32;
}
#[starknet::interface]
pub trait IGameSettlement<T> {
    fn mark_game_settled(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> (u64, crate::ownership::StoryCursor);
}

#[derive(Copy, Drop)]
pub struct LaunchRules {
    pub mode_rules: u32,
    pub epoch_seconds: u32,
    pub entry_rule: u8,
    pub settlement_mode: crate::settlement::SettlementMode,
    pub spacing: u32,
}

pub fn validate_params(params: CreateGameParams, rules: LaunchRules) {
    assert!(params.name != 0, "game name is empty");
    assert!(params.seed != 0, "game seed is zero");
    assert!(params.duration_seconds != 0, "game duration is zero");
    crate::expeditions::validate_game(rules.epoch_seconds, rules.spacing, params.duration_seconds);
    assert!(params.start_settling_at <= params.start_main_at, "invalid game schedule");
    assert!(
        Into::<u32, u64>::into(params.registration_start) < params.start_settling_at,
        "registration must open before settling",
    );
    if rules.mode_rules & crate::rules::SEASON_CLOSE == 0 {
        assert!(params.end_grace_seconds == 0, "result finalisation has no grace period");
    }
    if rules.entry_rule == crate::rules::ENTRY_ROSTER {
        assert!(params.roster.len() > 0 && params.roster.len() <= 24, "invalid Blitz roster size");
        if rules.settlement_mode == crate::settlement::SettlementMode::Duel {
            assert!(params.roster.len() == 2, "Duel requires two players");
        }
        assert!(!params.dev_mode_on, "free Blitz does not use development mode");
    } else {
        assert!(params.roster.is_empty(), "Eternum does not use a fixed roster");
    }
}
pub fn map_center_offset(game_id: u32, seed: felt252) -> u32 {
    const STEPS: u32 = (2147483646 / 2) / 10;
    let seed: u256 = seed.into();
    let seed_step: u32 = (seed % STEPS.into()).try_into().unwrap();
    ((seed_step + game_id % STEPS) % STEPS) * 10
}

pub(crate) fn build_game(params: CreateGameParams, creator: ContractAddress) -> crate::game::GameRegistry {
    crate::game::GameRegistry {
        name: params.name,
        preset_id: params.preset_id,
        creator,
        settled: false,
        ready: params.roster.is_empty(),
        dev_mode_on: params.dev_mode_on,
        start_settling_at: params.start_settling_at,
        start_main_at: params.start_main_at,
        end_at: params.start_main_at + params.duration_seconds,
        end_grace_seconds: params.end_grace_seconds,
        seed: params.seed,
    }
}
pub(crate) fn game_overrides(game_id: u32, params: CreateGameParams) -> crate::game::GameOverrides {
    crate::game::GameOverrides {
        registration_start: params.registration_start,
        biome_climate: params.biome_climate,
        map: params.map_override,
        map_center_offset: map_center_offset(game_id, params.seed),
    }
}
