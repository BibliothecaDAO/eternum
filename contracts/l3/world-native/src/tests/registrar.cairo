use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address};
use crate::game::{GameStatus, IGameDispatcher, IGameDispatcherTrait, status_at};
use crate::lifecycle::{IDomainDispatcher, IDomainDispatcherTrait, PeersTrait};
use crate::presets::{
    EconomyPreset, PresetDefinition, ResourcePreset, SettlementPreset, StructurePreset, WithdrawalPreset,
};
use crate::registrar::{
    CreateGameParams, IRegistrarDispatcher, IRegistrarDispatcherTrait, IRegistrarSafeDispatcher,
    IRegistrarSafeDispatcherTrait,
};
use crate::resources::ResourceRule;
use crate::settlement::{ISettlementViewsDispatcher, ISettlementViewsDispatcherTrait, SettlementMode};

fn setup() -> super::Deployment {
    let d = super::setup_with_domains(false, "StructuresDomain", "TroopsDomain");
    for address in d.peers.addresses() {
        start_cheat_caller_address(*address, super::authority());
        IDomainDispatcher { contract_address: *address }.activate();
        stop_cheat_caller_address(*address);
    }
    start_cheat_block_timestamp_global(100);
    start_cheat_caller_address(d.peers.registry, super::authority());
    d
}
fn registry(d: super::Deployment) -> IRegistrarDispatcher {
    IRegistrarDispatcher { contract_address: d.peers.registry }
}
fn safe(d: super::Deployment) -> IRegistrarSafeDispatcher {
    IRegistrarSafeDispatcher { contract_address: d.peers.registry }
}
fn definition(blitz: bool) -> PresetDefinition {
    let mut resources = array![];
    for resource_type in 1_u8..59 {
        resources
            .append(
                ResourceRule {
                    resource_type, unit_weight: 1, realm_rate: 10, village_rate: 5, labor_output_per_resource: 1,
                },
            );
    }
    let zero = 0.try_into().unwrap();
    PresetDefinition {
        rules: crate::rules::SliceRules { blitz_mode_on: blitz, ..super::recorded::rules() },
        resources: ResourcePreset {
            resources: resources.span(),
            production: super::production::recipes(),
            mine_kinds: super::mines::kinds(),
            surface_mines: array![crate::mines::MineWeight { kind: 1, weight: 1 }].span(),
            ethereal_mines: array![].span(),
        },
        structures: StructurePreset {
            buildings: super::building_commands::rules(),
            camps: array![].span(),
            faith: crate::faith::FaithRules {
                wonder_rate: 500, realm_rate: 100, village_rate: 10, owner_share_bps: 3000,
            },
            upgrade_limits: crate::upgrades::UpgradeLimits { realm_max: 1, village_max: 1 },
            upgrades: array![crate::upgrades::UpgradeRecipe { costs: array![].span() }].span(),
        },
        settlement: SettlementPreset {
            reward_profile: 1,
            cosmetic_limit: 3,
            cosmetic_collection: zero,
            cosmetic_timelock: zero,
            realms: super::settlement::grants(),
            villages: super::village::village_rules(),
            spires: if blitz {
                None
            } else {
                Some(crate::spires::SpireLayout { count: 1, base_distance: 0, layer_distance: 0, max_layer: 0 })
            },
        },
        economy: EconomyPreset {
            trade: crate::trade::TradeRules { max_count: 2 },
            banks: crate::market::BankRules {
                lp_fee_num: 3, lp_fee_denom: 1000, owner_fee_num: 1, owner_fee_denom: 100,
            },
            hyperstructures: super::hyperstructures::rules(),
            relics: super::relics::rules(),
            research_cost: 100,
            withdrawals: if blitz {
                None
            } else {
                Some(
                    WithdrawalPreset {
                        rules: crate::withdrawals::WithdrawalRules {
                            paused: false,
                            bank_fee_bps: 0,
                            velords_fee_bps: 0,
                            season_fee_bps: 0,
                            client_fee_bps: 0,
                            velords_recipient: super::authority(),
                            season_recipient: super::authority(),
                            retention: array![crate::withdrawals::Retention { troop_percent: 95, resource_percent: 95 }]
                                .span(),
                        },
                        tokens: array![].span(),
                    },
                )
            },
        },
        agents: crate::agents::AgentRules {
            max_lifetime_count: 10, max_current_count: 3, min_spawn_lords: 2, max_spawn_lords: 7,
        },
        exploration: array![crate::exploration_rewards::ExplorationReward { resource_type: 1, amount: 10, weight: 1 }]
            .span(),
        season_win_points: 1000,
        faith_reward_token: zero,
    }
}
fn params(blitz: bool) -> CreateGameParams {
    CreateGameParams {
        name: 'native',
        preset_id: 1,
        series_id: 0,
        game_number_in_series: 0,
        start_settling_at: 200,
        start_main_at: 300,
        duration_seconds: 100,
        end_grace_seconds: 10,
        dev_mode_on: false,
        mode: SettlementMode::Single,
        registration_limit: if blitz {
            2
        } else {
            0
        },
        registration_start: 10,
        biome_climate: super::recorded::rules().biome_climate_config,
        map_override: None,
        seed: 42,
    }
}

#[test]
#[feature("safe_dispatcher")]
fn presets_are_immutable_and_launch_rejects_changed_preimages_before_allocating() {
    let d = setup();
    let preset = definition(true);
    assert!(safe(d).create_game(params(true), preset).is_err());
    assert!(safe(d).register_preset(0, preset).is_err());
    assert!(
        safe(d)
            .register_preset(
                1,
                PresetDefinition { settlement: SettlementPreset { reward_profile: 0, ..preset.settlement }, ..preset },
            )
            .is_err(),
    );
    start_cheat_caller_address(d.peers.registry, d.actor);
    assert!(safe(d).register_preset(1, preset).is_err());
    start_cheat_caller_address(d.peers.registry, super::authority());
    registry(d).register_preset(1, preset);
    assert_eq!(registry(d).preset_commitment(1), crate::presets::commitment(preset));
    assert!(safe(d).register_preset(1, preset).is_err());
    assert!(safe(d).create_game(params(true), PresetDefinition { season_win_points: 2, ..preset }).is_err());
    assert_eq!(registry(d).next_game_id(), 1);
}

#[test]
fn blitz_launch_initializes_domains_once_and_allocates_isolated_games() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    let games = IGameDispatcher { contract_address: d.peers.season };
    for expected in 1_u32..3 {
        assert_eq!(registry(d).create_game(params(true), preset), expected);
        let game = games.game(expected);
        assert_eq!(game.preset_id, 1);
        assert_eq!(game.end_at, 400);
        assert_eq!(game.creator, super::authority());
        assert_eq!(status_at(game, 299), GameStatus::Registration);
        assert_eq!(status_at(game, 300), GameStatus::Live);
        assert_eq!(status_at(game, 400), GameStatus::Ended);
        assert_eq!(games.rules(expected).map_center_offset, crate::registrar::map_center_offset(expected, 42));
        let settlement = ISettlementViewsDispatcher { contract_address: d.peers.settlement };
        assert_eq!(settlement.realm_grants(expected), preset.settlement.realms);
        assert_eq!(settlement.settlement_rules(expected).registration_limit, 2);
        assert_eq!(
            crate::agents::IAgentsDispatcherTrait::agent_rules(
                crate::agents::IAgentsDispatcher { contract_address: d.peers.troops }, expected,
            ),
            preset.agents,
        );
    }
    assert_eq!(registry(d).next_game_id(), 3);
}

#[test]
fn eternum_launch_initializes_spires_and_never_uses_entry_capacity() {
    let d = setup();
    let preset = definition(false);
    registry(d).register_preset(1, preset);
    assert_eq!(registry(d).create_game(params(false), preset), 1);
    let spires = crate::spires::ISpiresDispatcher { contract_address: d.peers.map };
    assert_eq!(crate::spires::ISpiresDispatcherTrait::spire_layout(spires, 1), preset.settlement.spires);
    let settlement = ISettlementViewsDispatcher { contract_address: d.peers.settlement };
    assert_eq!(settlement.settlement_rules(1).registration_limit, 0);
    assert_eq!(settlement.settlement_rules(1).mode, SettlementMode::Single);
}

#[test]
#[feature("safe_dispatcher")]
fn series_enforces_registered_identity_order_and_capacity() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    registry(d)
        .register_series(
            7, d.actor, crate::series_chests::SeriesRules { num_games: 1, total_chests: 10, cap_ratio_bps: 10000 },
        );
    let first = CreateGameParams { series_id: 7, game_number_in_series: 1, ..params(true) };
    assert!(safe(d).create_game(CreateGameParams { game_number_in_series: 2, ..first }, preset).is_err());
    assert_eq!(registry(d).create_game(first, preset), 1);
    assert_eq!(registry(d).series(7).unwrap().created_games, 1);
    assert_eq!(registry(d).series(7).unwrap().owner, d.actor);
    assert!(safe(d).create_game(CreateGameParams { game_number_in_series: 2, ..first }, preset).is_err());
    assert_eq!(registry(d).next_game_id(), 2);
}

#[test]
#[feature("safe_dispatcher")]
fn invalid_schedules_modes_and_registration_limits_never_allocate() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    for input in array![
        CreateGameParams { name: 0, ..params(true) }, CreateGameParams { seed: 0, ..params(true) },
        CreateGameParams { duration_seconds: 0, ..params(true) },
        CreateGameParams { start_settling_at: 301, ..params(true) },
        CreateGameParams { registration_start: 200, ..params(true) },
        CreateGameParams { registration_limit: 97, ..params(true) },
        CreateGameParams { registration_limit: 0, ..params(true) },
        CreateGameParams { mode: SettlementMode::Duel, registration_limit: 3, ..params(true) },
        CreateGameParams { game_number_in_series: 1, ..params(true) },
    ] {
        assert!(safe(d).create_game(input, preset).is_err());
    }
    assert_eq!(registry(d).next_game_id(), 1);
}

#[test]
#[feature("safe_dispatcher")]
fn a_late_configuration_failure_rolls_back_all_domains_and_the_series_allocation() {
    let d = setup();
    let mut preset = definition(true);
    preset.economy.banks.lp_fee_denom = 0;
    registry(d).register_preset(1, preset);
    registry(d)
        .register_series(
            7, d.actor, crate::series_chests::SeriesRules { num_games: 2, total_chests: 10, cap_ratio_bps: 10000 },
        );
    let (caller, _) = super::deploy("RollbackFixture", @array![]);
    assert!(
        !super::fixtures::IRollbackFixtureDispatcherTrait::attempt_game(
            super::fixtures::IRollbackFixtureDispatcher { contract_address: caller },
            d.peers.registry,
            CreateGameParams { series_id: 7, game_number_in_series: 1, ..params(true) },
            preset,
        ),
    );
    assert_eq!(registry(d).next_game_id(), 1);
    assert_eq!(registry(d).series(7).unwrap().created_games, 0);
    assert!(
        crate::game::IGameSafeDispatcherTrait::game(
            crate::game::IGameSafeDispatcher { contract_address: d.peers.season }, 1,
        )
            .is_err(),
    );
}

#[test]
fn settlement_uses_recorded_time_after_grace_and_rejections_consume_tickets() {
    let (d, _, _) = super::resource_commands::setup();
    let command = crate::commands::Command::MarkGameSettled;
    super::resource_commands::assert_terminal_rejection(d, command, 500);
    let d = super::bind_authority(d);
    let games = IGameDispatcher { contract_address: d.peers.season };
    let game = games.game(3);
    let boundary = game.end_at + game.end_grace_seconds.into();
    super::resource_commands::assert_terminal_rejection(d, command, boundary);
    assert!(!games.game(3).settled);
    assert!(super::resource_commands::execute_recorded_at(d, command, boundary + 1, 5000));
    assert!(games.game(3).settled);
    assert_eq!(status_at(games.game(3), boundary + 1), GameStatus::Settled);
    super::resource_commands::assert_terminal_rejection(d, command, boundary + 2);
}
