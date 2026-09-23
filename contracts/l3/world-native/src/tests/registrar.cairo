use eternum_randomness_protocol::entrypoint::IRecordedExecutionViewsDispatcher;
use snforge_std::{
    EventSpyTrait, EventsFilterTrait, start_cheat_block_timestamp_global, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use crate::commands::{Command, CreateExplorer, Explore};
use crate::game::{GameStatus, IGameDispatcher, IGameDispatcherTrait, status_at};
use crate::games::{IGamesAuthenticationDispatcher, IGamesAuthenticationDispatcherTrait};
use crate::guards::{GuardKey, IGuardsDispatcher, IGuardsDispatcherTrait};
use crate::map::{IMapLogicDispatcher, IMapLogicDispatcherTrait, TileKey, structure_occupant};
use crate::presets::{
    EconomyPreset, PresetDefinition, ResourcePreset, SettlementPreset, StructurePreset, WithdrawalPreset,
};
use crate::registrar::{
    CreateGameParams, IRegistrarDispatcher, IRegistrarDispatcherTrait, IRegistrarSafeDispatcher,
    IRegistrarSafeDispatcherTrait, RosterPlayer,
};
use crate::relics::{ChestGround, ChestKind, ChestRules, IRelicsDispatcher, IRelicsDispatcherTrait};
use crate::resources::{
    IResourceOperationsDispatcher, IResourceOperationsDispatcherTrait, ResourceKey, ResourceRule, ResourceSlot,
};
use crate::rules::{DISCOVER_CAMPS, DISCOVER_CHESTS, HOME_REWARDS, RESOURCE_PRECISION};
use crate::settlement::{
    ISettlementCommandsDispatcher, ISettlementCommandsDispatcherTrait, ISettlementCommandsSafeDispatcher,
    ISettlementCommandsSafeDispatcherTrait, ISettlementCreationDispatcher, ISettlementCreationDispatcherTrait,
    ISettlementViewsDispatcher, ISettlementViewsDispatcherTrait, RealmCreation, SettlementCreation, SettlementMode,
};
use crate::structures::{IStructureOperationsDispatcher, IStructureOperationsDispatcherTrait};
use crate::tests::state::{
    GameState, MapObservationTrait, ResourceObservationTrait, StructureObservationTrait, TroopObservationTrait,
};
use crate::troops::ExplorerKey;
use super::recorded_receipts::RecordedReceiptsTrait;
use super::resource_commands::execute_in_game;

fn setup() -> super::Deployment {
    let d = super::setup_with_domains(false, "StructuresLogic", "TroopsLogic");
    start_cheat_block_timestamp_global(100);
    d
}
fn registry(d: super::Deployment) -> IRegistrarDispatcher {
    snforge_std::cheat_caller_address(d.games, super::authority(), snforge_std::CheatSpan::TargetCalls(1));
    IRegistrarDispatcher { contract_address: d.games }
}
fn safe(d: super::Deployment, caller: starknet::ContractAddress) -> IRegistrarSafeDispatcher {
    snforge_std::cheat_caller_address(d.games, caller, snforge_std::CheatSpan::TargetCalls(1));
    IRegistrarSafeDispatcher { contract_address: d.games }
}
fn definition(blitz: bool) -> PresetDefinition {
    let mut resources = array![];
    for resource_type in 1_u8..59 {
        resources.append(ResourceRule { resource_type, unit_weight: 1, realm_rate: 10, village_rate: 5 });
    }
    PresetDefinition {
        rules: crate::rules::SliceRules {
            mode_rules: if blitz {
                super::recorded::BLITZ_RULES
            } else {
                super::recorded::ETERNUM_RULES
            },
            command_mask: if blitz {
                super::recorded::BLITZ_COMMAND_MASK
            } else {
                super::recorded::ETERNUM_COMMAND_MASK
            },
            entry_rule: if blitz {
                crate::rules::ENTRY_ROSTER
            } else {
                crate::rules::ENTRY_ENTITLEMENT
            },
            ..super::recorded::rules(),
        },
        resources: ResourcePreset {
            resources: resources.span(),
            production: super::production::recipes(),
            mine_kinds: super::mines::kinds(),
            surface_mines: array![crate::mines::MineWeight { kind: 1, weight: 1 }].span(),
        },
        structures: StructurePreset {
            board: None,
            buildings: super::building_commands::rules(),
            camps: array![].span(),
            faith: crate::faith::FaithRules {
                wonder_rate: 500, realm_rate: 100, village_rate: 10, owner_share_bps: 3000,
            },
            upgrade_limits: crate::upgrades::UpgradeLimits { realm_max: 1, village_max: 1 },
            upgrades: array![crate::upgrades::UpgradeRecipe { costs: array![].span() }].span(),
        },
        settlement: SettlementPreset {
            mode: if blitz {
                SettlementMode::Triple
            } else {
                SettlementMode::Single
            },
            spacing: 6,
            depths: array![].span(),
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
            hyperstructures: if blitz {
                crate::hyperstructures::HyperstructureRules { initialize_shards: 0, resources: array![].span() }
            } else {
                super::hyperstructures::rules()
            },
            relics: super::relics::rules(),
            chests: None,
            research_cost: 100,
            withdrawals: if blitz {
                None
            } else {
                Some(
                    WithdrawalPreset {
                        deposits: crate::bridge::DepositRules {
                            paused: false,
                            realm_fee_bps: 500,
                            velords_fee_bps: 100,
                            season_fee_bps: 200,
                            client_fee_bps: 300,
                        },
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
        exploration: array![
            crate::exploration_rewards::ExplorationReward { resource_type: 1, amount: 10, amount_max: 10, weight: 1 },
        ]
            .span(),
        season_win_points: 1000,
    }
}
fn roster(count: u32) -> Span<RosterPlayer> {
    let mut players = array![];
    for index in 1..count + 1 {
        players.append(RosterPlayer { account: Into::<u32, felt252>::into(2000 + index).try_into().unwrap() });
    }
    players.span()
}
fn params(blitz: bool) -> CreateGameParams {
    CreateGameParams {
        name: 'native',
        preset_id: 1,
        start_settling_at: 200,
        start_main_at: 300,
        duration_seconds: 100,
        end_grace_seconds: if blitz {
            0
        } else {
            10
        },
        dev_mode_on: false,
        roster: if blitz {
            roster(2)
        } else {
            array![].span()
        },
        registration_start: 10,
        biome_climate: super::recorded::rules().biome_climate_config,
        map_override: None,
        seed: 42,
    }
}

#[test]
#[feature("safe_dispatcher")]
fn launch_rejects_unregistered_or_stale_presets_before_allocating() {
    let d = setup();
    let preset = definition(true);
    assert!(safe(d, super::authority()).create_game(params(true), preset).is_err());
    assert!(safe(d, super::authority()).register_preset(0, preset).is_err());
    assert!(safe(d, d.actor).register_preset(1, preset).is_err());
    registry(d).register_preset(1, preset);
    assert_eq!(registry(d).preset_commitment(1), crate::presets::commitment(preset));
    assert!(
        safe(d, super::authority())
            .create_game(
                params(true),
                PresetDefinition { rules: crate::rules::SliceRules { mode_rules: 0, ..preset.rules }, ..preset },
            )
            .is_err(),
    );
    assert_eq!(registry(d).next_game_id(), 1);
}

#[test]
#[feature("safe_dispatcher")]
fn registered_presets_are_immutable_and_changed_rules_require_a_new_id() {
    let d = setup();
    let original = definition(true);
    registry(d).register_preset(1, original);
    let old_id = registry(d).create_game(params(true), original);
    let mut changed = original;
    changed.rules.troop_stamina_config.stamina_explore_stamina_cost += 1;
    assert!(safe(d, d.actor).register_preset(1, changed).is_err());
    assert_eq!(registry(d).preset_commitment(1), crate::presets::commitment(original));
    assert!(safe(d, super::authority()).register_preset(1, original).is_err());
    assert!(safe(d, super::authority()).register_preset(1, changed).is_err());
    assert_eq!(registry(d).preset_commitment(1), crate::presets::commitment(original));
    assert_eq!(registry(d).create_game(params(true), original), old_id);
    let next_params = CreateGameParams { name: 'next', ..params(true) };
    assert!(safe(d, super::authority()).create_game(next_params, changed).is_err());
    let next_original_id = registry(d).create_game(next_params, original);
    assert!(safe(d, d.actor).register_preset(101, changed).is_err());
    registry(d).register_preset(101, changed);
    assert_eq!(registry(d).preset_commitment(101), crate::presets::commitment(changed));
    let new_id = registry(d).create_game(CreateGameParams { name: 'changed', preset_id: 101, ..params(true) }, changed);
    let games = IGameDispatcher { contract_address: d.games };
    assert_eq!(
        games.rules(old_id).troop_stamina_config.stamina_explore_stamina_cost,
        original.rules.troop_stamina_config.stamina_explore_stamina_cost,
    );
    assert_eq!(
        games.rules(next_original_id).troop_stamina_config.stamina_explore_stamina_cost,
        original.rules.troop_stamina_config.stamina_explore_stamina_cost,
    );
    assert_eq!(
        games.rules(new_id).troop_stamina_config.stamina_explore_stamina_cost,
        changed.rules.troop_stamina_config.stamina_explore_stamina_cost,
    );
}

#[test]
fn blitz_launch_initializes_domains_once_and_allocates_isolated_games() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    let games = IGameDispatcher { contract_address: d.games };
    for expected in 1_u32..3 {
        assert_eq!(
            registry(d).create_game(CreateGameParams { name: expected.into(), ..params(true) }, preset), expected,
        );
        let game = games.game(expected);
        assert_eq!(game.preset_id, 1);
        assert_eq!(game.end_at, 400);
        assert_eq!(game.end_grace_seconds, 0);
        assert_eq!(game.creator, super::authority());
        assert_eq!(status_at(game, 299), GameStatus::Registration);
        assert_eq!(status_at(game, 300), GameStatus::Registration);
        assert_eq!(status_at(game, 400), GameStatus::Registration);
        assert_eq!(games.rules(expected).map_center_offset, crate::registrar::map_center_offset(expected, 42));
        let settlement = ISettlementViewsDispatcher { contract_address: d.games };
        assert_eq!(settlement.realm_grants(expected), preset.settlement.realms);
        assert_eq!(settlement.settlement_rules(expected).registration_limit, 2);
    }
    assert_eq!(registry(d).next_game_id(), 3);
}

#[test]
#[feature("safe_dispatcher")]
fn blitz_launch_accepts_empty_construction_requirements_without_allowing_reconfiguration() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    let game_id = registry(d).create_game(params(true), preset);
    let economy = crate::hyperstructures::IHyperstructuresDispatcher { contract_address: d.games };
    assert_eq!(
        crate::hyperstructures::IHyperstructuresDispatcherTrait::hyperstructure_rules(economy, game_id),
        preset.economy.hyperstructures,
    );
    start_cheat_caller_address(d.games, super::authority());
    assert!(
        crate::hyperstructures::IHyperstructuresSafeDispatcherTrait::configure_hyperstructures(
            crate::hyperstructures::IHyperstructuresSafeDispatcher { contract_address: d.games },
            game_id,
            preset.economy.hyperstructures,
        )
            .is_err(),
    );
}

#[test]
fn eternum_launch_initializes_spires_and_never_uses_entry_capacity() {
    let d = setup();
    let preset = definition(false);
    registry(d).register_preset(1, preset);
    assert_eq!(registry(d).create_game(params(false), preset), 1);
    let spires = crate::spires::ISpiresDispatcher { contract_address: d.games };
    assert_eq!(crate::spires::ISpiresDispatcherTrait::spire_layout(spires, 1), preset.settlement.spires);
    let settlement = ISettlementViewsDispatcher { contract_address: d.games };
    assert_eq!(settlement.settlement_rules(1).registration_limit, 0);
    assert_eq!(settlement.settlement_rules(1).mode, SettlementMode::Single);
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
        CreateGameParams { end_grace_seconds: 1, ..params(true) },
        CreateGameParams { start_settling_at: 301, ..params(true) },
        CreateGameParams { registration_start: 200, ..params(true) },
        CreateGameParams { roster: roster(25), ..params(true) },
        CreateGameParams { roster: array![].span(), ..params(true) },
    ] {
        assert!(safe(d, super::authority()).create_game(input, preset).is_err());
    }
    assert_eq!(registry(d).next_game_id(), 1);
}

#[test]
#[feature("safe_dispatcher")]
fn a_late_configuration_failure_rolls_back_all_domains_and_game_allocation() {
    let d = setup();
    let mut preset = definition(true);
    preset.economy.banks.lp_fee_denom = 0;
    registry(d).register_preset(1, preset);
    let (caller, _) = super::deploy("RollbackFixture", @array![]);
    assert!(
        !super::fixtures::IRollbackFixtureDispatcherTrait::attempt_game(
            super::fixtures::IRollbackFixtureDispatcher { contract_address: caller }, d.games, params(true), preset,
        ),
    );
    assert_eq!(registry(d).next_game_id(), 1);
    assert!(
        crate::game::IGameSafeDispatcherTrait::game(crate::game::IGameSafeDispatcher { contract_address: d.games }, 1)
            .is_err(),
    );
}

#[test]
fn settlement_uses_recorded_time_after_grace_and_rejections_consume_tickets() {
    let (d, _, _) = super::resource_commands::setup();
    let command = crate::commands::Command::MarkGameSettled;
    super::resource_commands::assert_terminal_rejection(d, command, 100);
    let d = super::bind_authority(d);
    let games = IGameDispatcher { contract_address: d.games };
    let game = games.game(3);
    let boundary = game.end_at + game.end_grace_seconds.into();
    super::resource_commands::assert_terminal_rejection(d, command, boundary);
    assert!(!games.game(3).settled);
    assert!(super::resource_commands::execute_recorded_at(d, command, boundary + 1, 5000));
    assert!(games.game(3).settled);
    assert_eq!(status_at(games.game(3), boundary + 1), GameStatus::Settled);
    assert!(super::resource_commands::execute(d, command, boundary + 2));
    assert_eq!(status_at(games.game(3), boundary + 2), GameStatus::Settled);
}

#[test]
#[feature("safe_dispatcher")]
fn preset_registration_rejects_enabled_mines_without_a_pool() {
    let d = setup();
    let mut preset = definition(true);
    preset.rules.map_config.shards_mines_win_probability = 1;
    preset.resources.surface_mines = array![].span();
    assert!(safe(d, super::authority()).register_preset(1, preset).is_err());
    assert_eq!(registry(d).preset_commitment(1), 0);
}

#[test]
#[feature("safe_dispatcher")]
fn preset_registration_rejects_camps_with_zero_village_labor() {
    let d = setup();
    let mut preset = definition(true);
    preset.rules.map_config.camp_win_probability = 1;
    let mut resources = array![];
    for rule in preset.resources.resources {
        resources
            .append(
                ResourceRule { village_rate: if *rule.resource_type == 23 {
                    0
                } else {
                    *rule.village_rate
                }, ..*rule },
            );
    }
    preset.resources.resources = resources.span();
    assert!(safe(d, super::authority()).register_preset(1, preset).is_err());
    assert_eq!(registry(d).preset_commitment(1), 0);
}

#[test]
#[feature("safe_dispatcher")]
fn preset_registration_rejects_equal_or_reversed_mercenary_bounds() {
    let d = setup();
    let mut preset = definition(true);
    preset.rules.troop_limit_config.mercenaries_troop_lower_bound = 10;
    for upper in array![10_u16, 9] {
        preset.rules.troop_limit_config.mercenaries_troop_upper_bound = upper;
        assert!(safe(d, super::authority()).register_preset(1, preset).is_err());
        assert_eq!(registry(d).preset_commitment(1), 0);
    }
}

#[test]
#[feature("safe_dispatcher")]
fn fixed_blitz_rosters_require_unique_accounts_and_regular_mode() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    let player = *roster(1).at(0);
    for players in array![
        array![player, player].span(), array![RosterPlayer { account: 0.try_into().unwrap() }].span(),
    ] {
        assert!(
            safe(d, super::authority())
                .create_game(CreateGameParams { roster: players, ..params(true) }, preset)
                .is_err(),
        );
        assert_eq!(registry(d).next_game_id(), 1);
    }
    assert!(
        safe(d, super::authority())
            .create_game(CreateGameParams { dev_mode_on: true, ..params(true) }, preset)
            .is_err(),
    );
    for size in array![1_u32, 13, 17, 24] {
        let players = roster(size);
        let id = registry(d)
            .create_game(CreateGameParams { name: size.into(), roster: players, ..params(true) }, preset);
        assert_eq!(registry(d).blitz_roster(id), players);
        let settlement = ISettlementViewsDispatcher { contract_address: d.games };
        assert_eq!(settlement.settlement_rules(id).registration_limit, size.try_into().unwrap());
    }
}

#[test]
#[feature("safe_dispatcher")]
fn launch_retries_return_the_same_game_and_conflicting_rosters_reject() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    let request = params(true);
    assert!(safe(d, d.actor).create_game(request, preset).is_err());
    assert_eq!(registry(d).game_id_by_name(request.name), 0);
    let first = registry(d).create_game(request, preset);
    assert_eq!(registry(d).create_game(request, preset), first);
    assert_eq!(registry(d).next_game_id(), first + 1);
    assert_eq!(registry(d).game_id_by_name(request.name), first);
    assert!(
        safe(d, super::authority()).create_game(CreateGameParams { roster: roster(1), ..request }, preset).is_err(),
    );
    assert!(
        safe(d, super::authority()).create_game(CreateGameParams { duration_seconds: 101, ..request }, preset).is_err(),
    );
    assert_eq!(registry(d).blitz_roster(first), request.roster);
    assert_eq!(registry(d).next_game_id(), first + 1);
}

#[test]
fn fixed_blitz_rosters_have_exact_spots_and_deterministic_unique_permutations() {
    for count in array![1_u32, 13, 17, 24] {
        let players = crate::settlement::shuffle_roster(count, 123456789);
        assert!(players == crate::settlement::shuffle_roster(count, 123456789));
        assert!(players.len() == count);
        let mut seen: core::dict::Felt252Dict<bool> = Default::default();
        let mut tiles: core::dict::Felt252Dict<bool> = Default::default();
        for index in 0..count {
            let player = *players.at(index);
            assert!(player.into() < count && !seen.get(player.into()));
            seen.insert(player.into(), true);
            let coords = crate::settlement_grid::settlement_location(
                crate::troops::Coord { alt: false, x: 1000, y: 1000 }, SettlementMode::Triple, 6, index,
            );
            assert!(coords.len() == 3);
            for coord in coords {
                let key = Into::<u32, felt252>::into(*coord.x) * 0x100000000 + Into::<u32, felt252>::into(*coord.y);
                assert!(!tiles.get(key), "settlement spots overlap");
                tiles.insert(key, true);
            }
        }
    }
}

#[test]
#[feature("safe_dispatcher")]
fn automatic_blitz_settlement_is_authorized_atomic_and_resumes_its_fixed_order() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    let game_id = registry(d).create_game(CreateGameParams { roster: roster(2), ..params(true) }, preset);
    let games = IGameDispatcher { contract_address: d.games };
    let commands = ISettlementCommandsDispatcher { contract_address: d.games };
    let safe = ISettlementCommandsSafeDispatcher { contract_address: d.games };
    let views = ISettlementViewsDispatcher { contract_address: d.games };
    let mut context = crate::commands::ExecutionContext { raw_root: 98765, timestamp: 205 };
    assert!(!games.game(game_id).ready);
    assert!(status_at(games.game(game_id), 99999) == GameStatus::Registration);
    start_cheat_caller_address(d.games, d.actor);
    start_cheat_caller_address(d.games, d.games);
    assert!(safe.settle_blitz_roster(game_id, d.actor, context).is_err());
    assert!(
        safe
            .settle_blitz_roster(
                game_id, super::authority(), crate::commands::ExecutionContext { timestamp: 199, ..context },
            )
            .is_err(),
    );
    assert!(views.blitz_settlement_order(game_id).is_empty());
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let guards = IGuardsDispatcher { contract_address: d.games };
    let mut fixed_order = array![].span();
    for batch in 0_u32..2 {
        if batch != 0 {
            context.raw_root = 111 + batch.into();
            context.timestamp = 1000 + batch.into();
        }
        assert!(commands.settle_blitz_roster(game_id, super::authority(), context) == (1 - batch).into());
        let order = views.blitz_settlement_order(game_id);
        if batch == 0 {
            fixed_order = order;
        } else {
            assert!(order == fixed_order, "retry reshuffled roster");
        }
        let player = *roster(2).at((*order.at(batch)).into());
        assert!(views.player_has_settled(game_id, player.account));
        assert!(views.settlement_progress(game_id).registered.into() == batch + 1);
        for realm in 0_u32..3 {
            let center = 2147483646 - games.rules(game_id).map_center_offset;
            let coord = *crate::settlement_grid::settlement_location(
                crate::troops::Coord { alt: false, x: center, y: center }, SettlementMode::Triple, 6, batch,
            )
                .at(realm);
            let entity_id = structure_occupant(
                IMapLogicDispatcher { contract_address: d.games }
                    .tile(TileKey { game_id, alt: false, col: coord.x, row: coord.y })
                    .unwrap(),
            )
                .unwrap();
            let key = ResourceKey { game_id, entity_id };
            let structure = structures.structure(key).unwrap();
            assert!(structure.owner == player.account && structure.base.starting_troops_granted);
            let production = resources.resource_production(ResourceSlot { game_id, entity_id, resource_type: 23 });
            assert!(production.building_count == 1 && production.production_rate == 10);
            let guard = guards.guard(GuardKey { game_id, structure_id: entity_id, slot: 0 });
            assert!(guard.troops.count == 1500 * crate::rules::RESOURCE_PRECISION);
        }
        assert!(games.game(game_id).ready == (batch == 1));
    }
    let game = games.game(game_id);
    assert!(game.start_main_at == 1001 && game.end_at == 1101, "late settlement lost playing time");
    assert!(status_at(game, 1001) == GameStatus::Live);
    let center = 2147483646 - games.rules(game_id).map_center_offset;
    let coord = *crate::settlement_grid::settlement_location(
        crate::troops::Coord { alt: false, x: center, y: center }, SettlementMode::Triple, 6, 0,
    )
        .at(0);
    let entity_id = structure_occupant(
        IMapLogicDispatcher { contract_address: d.games }
            .tile(TileKey { game_id, alt: false, col: coord.x, row: coord.y })
            .unwrap(),
    )
        .unwrap();
    let slot = ResourceSlot { game_id, entity_id, resource_type: 23 };
    let balance = resources.resource_balance(slot);
    start_cheat_caller_address(d.games, d.games);
    resources.spend_resource(ResourceKey { game_id, entity_id }, 23, 0, 1001);
    assert_eq!(resources.resource_balance(slot), balance, "early realm accrued before main play");
    resources.spend_resource(ResourceKey { game_id, entity_id }, 23, 1, 1002);
    assert_eq!(resources.resource_balance(slot), balance + 10 - 1, "production did not start with the game");
    stop_cheat_caller_address(d.games);
    let progress = views.settlement_progress(game_id);
    assert!(commands.settle_blitz_roster(game_id, super::authority(), context) == 0);
    assert!(views.settlement_progress(game_id) == progress && games.game(game_id) == game);
}

#[test]
fn recorded_roster_batches_block_early_play_and_report_ticket_progress() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    let game_id = registry(d).create_game(CreateGameParams { roster: roster(2), ..params(true) }, preset);
    let d = super::bind_authority(d);
    let command = crate::commands::Command::SettleBlitzRoster;
    assert!(!super::resource_commands::execute_in_game(d, game_id, crate::commands::Command::CloseSeason, 205, 205));
    let season = IGamesAuthenticationDispatcher { contract_address: d.games };
    let receipts = IRecordedExecutionViewsDispatcher { contract_address: d.games };
    assert_eq!(
        receipts.recorded_outcome(game_id.into(), super::recorded::head(d.games, game_id).order).unwrap().status_class,
        'ROSTER_NOT_READY',
    );
    assert_eq!(season.next_nonce(game_id, d.actor), 1);
    super::season_lifecycle::execute_batch_in_game(d, game_id, command, 205, 1);
    assert!(!IGameDispatcher { contract_address: d.games }.game(game_id).ready);
    assert!(!super::resource_commands::execute_in_game(d, game_id, crate::commands::Command::CloseSeason, 206, 206));
    assert_eq!(
        receipts.recorded_outcome(game_id.into(), super::recorded::head(d.games, game_id).order).unwrap().status_class,
        'ROSTER_NOT_READY',
    );
    assert_eq!(season.next_nonce(game_id, d.actor), 3);
    super::season_lifecycle::execute_batch_in_game(d, game_id, command, 207, 0);
    assert!(IGameDispatcher { contract_address: d.games }.game(game_id).ready);
    super::season_lifecycle::execute_batch_in_game(d, game_id, command, 208, 0);
    let games = IGameDispatcher { contract_address: d.games };
    let end_at = games.game(game_id).end_at;
    let finalize = crate::commands::Command::MarkGameSettled;
    assert!(!super::resource_commands::execute_in_game(d, game_id, finalize, end_at - 1, end_at - 1));
    assert!(!games.game(game_id).settled);
    super::season_lifecycle::execute_batch_in_game(d, game_id, finalize, end_at, 0);
    assert!(games.game(game_id).settled);
    assert_eq!(status_at(games.game(game_id), end_at), GameStatus::Settled);
}

#[test]
fn open_preset_exploration_discovers_a_camp_and_credits_the_home_realm() {
    let d = setup();
    let mut preset = definition(true);
    preset.rules.command_mask = super::recorded::BLITZ_COMMAND_MASK;
    preset.rules.mode_rules = HOME_REWARDS | DISCOVER_CAMPS | DISCOVER_CHESTS;
    preset.rules.entry_rule = crate::rules::ENTRY_OPEN;
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.rules.map_config.shards_mines_fail_probability = 1;
    preset.rules.map_config.camp_win_probability = 1;
    preset.rules.map_config.camp_fail_probability = 0;
    preset.rules.map_config.relic_discovery_interval_sec = 60000;
    registry(d).register_preset(1, preset);
    let game_id = registry(d).create_game(CreateGameParams { end_grace_seconds: 0, ..params(false) }, preset);

    let center = 2147483646 - IGameDispatcher { contract_address: d.games }.rules(game_id).map_center_offset;
    start_cheat_block_timestamp_global(300);
    start_cheat_caller_address(d.games, d.games);
    let home = ResourceKey {
        game_id,
        entity_id: ISettlementCreationDispatcher { contract_address: d.games }
            .create_settlement(
                game_id,
                d.actor,
                crate::troops::Coord { alt: false, x: center, y: center },
                SettlementCreation::Realm(
                    RealmCreation {
                        realm_id: 1,
                        traits: crate::realms::RealmTraits { wonder: 1, order: 1, resources: array![1].span() },
                        grant_troops: true,
                        activate_economy: true,
                    },
                ),
                crate::commands::ExecutionContext { timestamp: 300, ..super::context() },
            ),
    };
    stop_cheat_caller_address(d.games);
    let guards = IGuardsDispatcher { contract_address: d.games };
    let category: u8 = guards.guard(GuardKey { game_id, structure_id: home.entity_id, slot: 0 }).troops.category.into();
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::CreateExplorer(
                CreateExplorer {
                    structure_id: home.entity_id, category, tier: 0, amount: RESOURCE_PRECISION, direction: 0,
                },
            ),
            301,
            301,
        ),
    );
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let explorer_id = *structures.structure(home).unwrap().troop_explorers.at(0);
    let troops = GameState { contract_address: d.games };
    let explorer = ExplorerKey { game_id, explorer_id };
    let origin = troops.explorer(explorer).unwrap().coord;
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let home_slot = ResourceSlot { game_id, entity_id: home.entity_id, resource_type: 1 };
    let before = resources.resource_balance(home_slot);

    assert!(execute_in_game(d, game_id, Command::Explore(Explore { explorer_id, direction: 0 }), 360, 360));

    let target = crate::geometry::neighbor(origin, 0);
    let tile = IMapLogicDispatcher { contract_address: d.games }
        .tile(crate::geometry::tile_key(game_id, target))
        .unwrap();
    assert_eq!((tile.data / 2) % 256, crate::camps::CAMP_OCCUPIER.into());
    assert_eq!(troops.explorer(explorer).unwrap().coord, origin);
    assert_eq!(resources.resource_balance(home_slot), before + 10 * RESOURCE_PRECISION);
    assert_eq!(resources.resource_balance(ResourceSlot { entity_id: explorer_id, ..home_slot }), 0);
}

#[test]
fn expedition_rollover_expires_armies_and_preserves_the_home_economy() {
    let d = setup();
    let mut preset = definition(true);
    preset.rules.entry_rule = crate::rules::ENTRY_OPEN;
    preset.rules.epoch_seconds = 100;
    preset.rules.mode_rules = HOME_REWARDS;
    preset.settlement.spacing = 1024;
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.rules.map_config.shards_mines_fail_probability = 1;
    registry(d).register_preset(1, preset);
    let game_id = registry(d)
        .create_game(
            CreateGameParams { dev_mode_on: true, end_grace_seconds: 0, duration_seconds: 500, ..params(false) },
            preset,
        );
    // The catalogue is already loaded by deployment; this fixture pins its first realm.
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("catalogue_count"), array![].span(), 8000_u32,
    );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("traits"), array![1].span(), 0x4000001_u32,
    );
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(crate::realms::SettleSeason { name: 'home', selected_realm: Some(1) }),
            350,
            350,
        ),
    );
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let home_id = 1;
    let home = ResourceKey { game_id, entity_id: home_id };
    let home_before = structures.structure(home).unwrap();
    assert_eq!(home_before.owner, d.actor);
    let home_coord = crate::structures::structure_coord(home_before.base);
    let map = IMapLogicDispatcher { contract_address: d.games };
    assert!(map.tile(crate::geometry::tile_key(game_id, home_coord)).is_none());
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let labor = ResourceSlot { game_id, entity_id: home_id, resource_type: 23 };
    let stored = resources.resource_balance(labor);
    let producer = resources.resource_production(labor);
    let capacity = resources.resource_weight(home).capacity;
    let guards = IGuardsDispatcher { contract_address: d.games };
    let category: u8 = guards.guard(GuardKey { game_id, structure_id: home_id, slot: 0 }).troops.category.into();
    let muster = Command::CreateExplorer(
        CreateExplorer { structure_id: home_id, category, tier: 0, amount: RESOURCE_PRECISION, direction: 0 },
    );
    assert!(execute_in_game(d, game_id, muster, 351, 351));
    let old_id = *structures.structure(home).unwrap().troop_explorers.at(0);
    let troops = GameState { contract_address: d.games };
    let old = ExplorerKey { game_id, explorer_id: old_id };
    let yesterday = troops.explorer(old).unwrap().coord;
    assert!(execute_in_game(d, game_id, Command::Explore(Explore { explorer_id: old_id, direction: 0 }), 360, 360));
    let old_tile = map.tile(crate::geometry::tile_key(game_id, crate::geometry::neighbor(yesterday, 0)));
    assert!(!execute_in_game(d, game_id, Command::Explore(Explore { explorer_id: old_id, direction: 1 }), 400, 400));
    assert_eq!(troops.explorer(old).unwrap().coord, crate::geometry::neighbor(yesterday, 0));
    assert!(execute_in_game(d, game_id, muster, 401, 401));
    assert!(troops.explorer(old).is_none());
    let new_id = *structures.structure(home).unwrap().troop_explorers.at(0);
    let today = troops.explorer(ExplorerKey { game_id, explorer_id: new_id }).unwrap().coord;
    assert_ne!(today.y / preset.settlement.spacing, yesterday.y / preset.settlement.spacing);
    assert_eq!(
        map.tile(crate::geometry::tile_key(game_id, crate::geometry::neighbor(yesterday, 0))).unwrap().data
            / 0x20000000000,
        old_tile.unwrap().data / 0x20000000000,
    );
    assert!(map.tile(crate::geometry::tile_key(game_id, crate::geometry::neighbor(today, 0))).is_none());
    assert!(execute_in_game(d, game_id, Command::Explore(Explore { explorer_id: new_id, direction: 0 }), 420, 420));
    assert_eq!(structures.structure(home).unwrap().base.coord_x, home_before.base.coord_x);
    assert_eq!(resources.resource_weight(home).capacity, capacity);
    assert_eq!(resources.resource_balance(labor), stored);
    assert_eq!(resources.resource_production(labor), producer);
    start_cheat_caller_address(d.games, d.games);
    resources.grant_resource(home, 23, 0, 420);
    stop_cheat_caller_address(d.games);
    assert_eq!(resources.resource_balance(labor), stored + 70 * producer.production_rate.into());
    assert_eq!(resources.resource_production(labor).production_rate, producer.production_rate);
    assert!(execute_in_game(d, game_id, Command::LevelUp(home_id), 430, 430));
    assert_eq!(structures.structure(home).unwrap().base.level, 1);
    assert!(map.tile(crate::geometry::tile_key(game_id, home_coord)).is_none());
}

#[test]
fn expedition_regions_remain_disjoint_for_every_depth_through_a_season() {
    let start = 43200_u64;
    let mut regions: core::dict::Felt252Dict<u32> = Default::default();
    for day in 0_u64..91 {
        for depth in 0_u8..4 {
            for realm in array![1_u16, 2, 8000] {
                let site = crate::expeditions::site(start, 86400, 1024, realm, start + day * 86400, depth);
                let region: felt252 = Into::<u32, felt252>::into(site.x / 1024) * 0x100000000
                    + Into::<u32, felt252>::into(site.y / 1024);
                assert_eq!(regions.get(region), 0);
                regions.insert(region, 1);
                assert!(crate::expeditions::is_current(site, start, 86400, 1024, start + day * 86400));
                assert!(!crate::expeditions::is_current(site, start, 86400, 1024, start + (day + 1) * 86400));
            }
        }
    }
    let early = crate::expeditions::site(start, 86400, 1024, 1, 86400, 0);
    let late = crate::expeditions::site(start, 86400, 1024, 1, 172799, 0);
    assert_eq!(early, late);
}

#[test]
#[should_panic(expected: ("outside expedition region",))]
fn an_expedition_cannot_move_into_yesterdays_region() {
    let yesterday = crate::expeditions::site(0, 100, 1024, 1, 99, 0);
    let today = crate::expeditions::site(0, 100, 1024, 1, 100, 0);
    crate::expeditions::assert_same_region(today, yesterday, 1024);
}

#[test]
fn expedition_army_limits_follow_castle_level_without_guards_or_returning_troops() {
    let d = setup();
    let mut preset = definition(true);
    preset.rules.entry_rule = crate::rules::ENTRY_OPEN;
    preset.rules.epoch_seconds = 86400;
    preset.rules.mode_rules = HOME_REWARDS | crate::rules::UNOWNED_TARGETS;
    preset.settlement.spacing = 1024;
    let limits = crate::rules::TroopLimitConfig {
        settlement_armies: 2,
        city_armies: 3,
        kingdom_armies: 4,
        empire_armies: 5,
        settlement_guard_slots: 0,
        city_guard_slots: 0,
        kingdom_guard_slots: 0,
        empire_guard_slots: 0,
        starting_guard: 0,
        t1_tier_modifier: 100,
        settlement_deployment_cap: 3000,
        ..preset.rules.troop_limit_config,
    };
    preset.rules.troop_limit_config = limits;
    preset.structures.upgrade_limits.realm_max = 3;
    preset
        .structures
        .upgrades =
            array![
                crate::upgrades::UpgradeRecipe { costs: array![].span() },
                crate::upgrades::UpgradeRecipe { costs: array![].span() },
                crate::upgrades::UpgradeRecipe { costs: array![].span() },
            ]
        .span();
    let mut grants = array![];
    for grant in preset.settlement.realms.resources {
        grants
            .append(
                crate::resources::ResourceAmount {
                    amount: if *grant.resource_type >= 26 && *grant.resource_type <= 34 {
                        2000 * RESOURCE_PRECISION
                    } else {
                        *grant.amount
                    },
                    resource_type: *grant.resource_type,
                },
            );
    }
    preset.settlement.realms.resources = grants.span();
    registry(d).register_preset(1, preset);
    let game_id = registry(d)
        .create_game(
            CreateGameParams { dev_mode_on: true, end_grace_seconds: 0, duration_seconds: 500, ..params(false) },
            preset,
        );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("catalogue_count"), array![].span(), 8000_u32,
    );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("traits"), array![1].span(), 0x4000001_u32,
    );
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(crate::realms::SettleSeason { name: 'home', selected_realm: Some(1) }),
            350,
            350,
        ),
    );
    let home = ResourceKey { game_id, entity_id: 1 };
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let guards = IGuardsDispatcher { contract_address: d.games };
    assert_eq!(guards.guard(GuardKey { game_id, structure_id: 1, slot: 0 }).troops.count, 0);
    let mut category = 0_u8;
    let mut troop_resource = 0_u8;
    let resources_by_category = array![26_u8, 32_u8, 29_u8];
    for candidate in 0_u8..3 {
        let balance = resources
            .resource_balance(
                ResourceSlot { game_id, entity_id: 1, resource_type: *resources_by_category.at(candidate.into()) },
            );
        if balance != 0 {
            assert_eq!(balance, 2000 * RESOURCE_PRECISION);
            category = candidate;
            troop_resource = *resources_by_category.at(candidate.into());
        }
    }
    assert!(troop_resource != 0, "starting garrison missing");
    assert_eq!(crate::troops::max_army_size(limits, 0, crate::troops::TroopTier::T1), 3000);
    let muster = Command::CreateExplorer(
        CreateExplorer { structure_id: 1, category, tier: 0, amount: RESOURCE_PRECISION, direction: 5 },
    );
    for level in 0_u8..4 {
        if level != 0 {
            assert!(execute_in_game(d, game_id, Command::LevelUp(1), 351, 351));
        }
        let record = structures.structure(home).unwrap();
        assert_eq!(record.base.troop_max_guard_count, 0);
        assert_eq!(record.base.troop_max_explorer_count, Into::<u8, u16>::into(level) + 2);
        while structures.structure(home).unwrap().troop_explorers.len() < Into::<u8, u32>::into(level) + 2 {
            let direction: u8 = structures.structure(home).unwrap().troop_explorers.len().try_into().unwrap();
            assert!(
                execute_in_game(
                    d,
                    game_id,
                    Command::CreateExplorer(
                        CreateExplorer { structure_id: 1, category, tier: 0, amount: RESOURCE_PRECISION, direction },
                    ),
                    351,
                    351,
                ),
            );
        }
        assert!(!execute_in_game(d, game_id, muster, 351, 351));
    }
    let id = *structures.structure(home).unwrap().troop_explorers.at(0);
    let slot = ResourceSlot { game_id, entity_id: 1, resource_type: troop_resource };
    let before = resources.resource_balance(slot);
    assert!(
        !execute_in_game(
            d,
            game_id,
            Command::ManageTroops(
                crate::troop_management::ManageTroops::Transfer(
                    crate::troop_management::TransferTroops {
                        source: crate::troop_management::Army::Explorer(id),
                        target: crate::troop_management::Army::Guard(
                            crate::troop_management::GuardSlot { structure_id: 1, slot: 0 },
                        ),
                        amount: RESOURCE_PRECISION,
                    },
                ),
            ),
            351,
            351,
        ),
    );
    assert!(
        execute_in_game(
            d, game_id, Command::ManageTroops(crate::troop_management::ManageTroops::RemoveExplorer(id)), 351, 351,
        ),
    );
    assert_eq!(resources.resource_balance(slot), before);
}

#[test]
fn surface_sites_pay_the_home_and_rift_income_stops_at_its_cap() {
    assert_expedition_capture(0);
}

#[test]
fn deep_sites_scale_rewards_and_guards_and_trove_income_stops_at_rollover() {
    assert_expedition_capture(3);
}

fn assert_expedition_capture(depth: u8) {
    let d = setup();
    let mut preset = definition(true);
    preset.rules.entry_rule = crate::rules::ENTRY_OPEN;
    preset.rules.epoch_seconds = 100;
    preset.rules.mode_rules = HOME_REWARDS
        | DISCOVER_CAMPS
        | crate::rules::UNOWNED_TARGETS
        | crate::rules::DEPTH_CONTENTS
        | crate::rules::REVEAL_SUPPLIES
        | crate::rules::HOME_CAMP_REWARDS
        | crate::rules::HOME_MINE_PRODUCTION
        | crate::rules::CAPTURE_CHESTS;
    preset.settlement.spacing = 1024;
    preset.rules.troop_limit_config.camp_armies = 0;
    preset.rules.troop_limit_config.starting_guard = 0;
    preset.rules.troop_limit_config.settlement_deployment_cap = 3000;
    preset.rules.troop_limit_config.t1_tier_modifier = 100;
    preset.rules.battle_config.regular_immunity_ticks = 0;
    preset
        .rules
        .troop_stamina_config =
            crate::rules::TroopStaminaConfig {
                stamina_initial: 150,
                stamina_gain_per_tick: 0,
                stamina_knight_max: 150,
                stamina_attack_req: 50,
                stamina_explore_stamina_cost: 30,
                stamina_bonus_value: 0,
                damage_stamina_refund: false,
                capture_stamina_refund: 25,
                ..preset.rules.troop_stamina_config,
            };
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.rules.map_config.shards_mines_fail_probability = 1;
    preset.rules.map_config.camp_win_probability = 1;
    preset.rules.map_config.camp_fail_probability = 0;
    preset.rules.map_config.relic_chest_relics_per_chest = 1;
    let mut depths = array![];
    for index in 0_u16..4 {
        depths
            .append(
                crate::expeditions::DepthRules {
                    supply_multiplier: index + 1,
                    guard_lower: index + 1,
                    guard_upper: index + 2,
                    mine_cap_min: if index == 0 {
                        10
                    } else {
                        1000
                    } * RESOURCE_PRECISION,
                    mine_cap_max: if index == 0 {
                        10
                    } else {
                        1000
                    } * RESOURCE_PRECISION,
                    mine_rate: ((Into::<u16, u128>::into(index) + 1) * RESOURCE_PRECISION).try_into().unwrap(),
                    camp_reward_min: (Into::<u16, u128>::into(index) + 1) * 100 * RESOURCE_PRECISION,
                    camp_reward_max: (Into::<u16, u128>::into(index) + 1) * 100 * RESOURCE_PRECISION,
                    mine_chest: index != 0,
                    reveal_site_neighbors: false,
                    entry_stamina: 0,
                    attunement_cost: 0,
                    chest: crate::relics::ChestGround { common: 10000, uncommon: 0, rare: 0, pity: 20 },
                },
            );
    }
    preset.settlement.depths = depths.span();
    registry(d).register_preset(1, preset);
    let game_id = registry(d)
        .create_game(
            CreateGameParams { dev_mode_on: true, end_grace_seconds: 0, duration_seconds: 500, ..params(false) },
            preset,
        );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("catalogue_count"), array![].span(), 8000_u32,
    );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("traits"), array![1].span(), 0x4000001_u32,
    );
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(crate::realms::SettleSeason { name: 'home', selected_realm: Some(1) }),
            350,
            350,
        ),
    );
    let home = ResourceKey { game_id, entity_id: 1 };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, d.games);
    resources.grant_resource(home, 26, 1000 * RESOURCE_PRECISION, 350);
    stop_cheat_caller_address(d.games);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::CreateExplorer(
                CreateExplorer {
                    structure_id: 1, category: 0, tier: 0, amount: 1000 * RESOURCE_PRECISION, direction: 0,
                },
            ),
            351,
            351,
        ),
    );
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let explorer_id = *structures.structure(home).unwrap().troop_explorers.at(0);
    let troops = GameState { contract_address: d.games };
    let army_key = ExplorerKey { game_id, explorer_id };
    let mut army = troops.explorer(army_key).unwrap();
    let map = IMapLogicDispatcher { contract_address: d.games };
    let original = army.coord;
    army.coord.y += Into::<u8, u32>::into(depth) * preset.settlement.spacing;
    if depth != 0 {
        start_cheat_caller_address(d.games, d.games);
        let occupier: u8 = (map.tile(crate::geometry::tile_key(game_id, original)).unwrap().data / 2 % 256)
            .try_into()
            .unwrap();
        map.vacate(crate::geometry::tile_key(game_id, original), explorer_id);
        let location = crate::geometry::tile_key(game_id, army.coord);
        map.reveal(location, map.biome(location));
        map.occupy(location, explorer_id, occupier, false);
        stop_cheat_caller_address(d.games);
    }
    super::resource_commands::set_fixture(
        d.games, selector!("troops"), selector!("explorers"), array![game_id.into(), explorer_id.into()].span(), army,
    );
    let supply = ResourceSlot { game_id, entity_id: 1, resource_type: 1 };
    let before_supplies = resources.resource_balance(supply);
    assert!(execute_in_game(d, game_id, Command::Explore(Explore { explorer_id, direction: 0 }), 360, 360));
    let coord = crate::geometry::neighbor(army.coord, 0);
    let map = IMapLogicDispatcher { contract_address: d.games };
    let tile = map.tile(crate::geometry::tile_key(game_id, coord)).unwrap();
    let camp_id: u32 = (tile.data / 512 % 0x100000000).try_into().unwrap();
    let camp = ResourceKey { game_id, entity_id: camp_id };
    assert_eq!(structures.structure(camp).unwrap().base.category, crate::camps::CAMP_CATEGORY);
    assert_eq!(structures.structure(camp).unwrap().base.troop_max_explorer_count, 0);
    assert_eq!(troops.explorer(army_key).unwrap().coord, army.coord);
    assert_eq!(
        resources.resource_balance(supply) - before_supplies,
        (Into::<u8, u128>::into(depth) + 1) * 10 * RESOURCE_PRECISION,
    );
    let guards = IGuardsDispatcher { contract_address: d.games };
    assert_eq!(
        guards.guard(GuardKey { game_id, structure_id: camp_id, slot: 0 }).troops.count,
        (Into::<u8, u128>::into(depth) + 1) * RESOURCE_PRECISION,
    );
    let essence = ResourceSlot { game_id, entity_id: 1, resource_type: 38 };
    let before_essence = resources.resource_balance(essence);
    let attack = Command::BattleGuard(crate::commands::Battle { attacker_id: explorer_id, defender_id: camp_id });
    assert!(execute_in_game(d, game_id, attack, 361, 361));
    assert_eq!(structures.structure(camp).unwrap().owner, d.actor);
    assert_eq!(troops.explorer(army_key).unwrap().troops.stamina.amount, 95);
    assert_eq!(
        resources.resource_balance(essence) - before_essence,
        (Into::<u8, u128>::into(depth) + 1) * 100 * RESOURCE_PRECISION,
    );
    assert_eq!(resources.resource_balance(ResourceSlot { entity_id: camp_id, ..essence }), 0);
    assert_eq!(resources.resource_balance(ResourceSlot { entity_id: camp_id, resource_type: 23, ..essence }), 0);
    assert_eq!(
        resources
            .resource_production(ResourceSlot { entity_id: camp_id, resource_type: 23, ..essence })
            .production_rate,
        0,
    );
    assert!(!execute_in_game(d, game_id, attack, 361, 361));
    assert_eq!(troops.explorer(army_key).unwrap().troops.stamina.amount, 95);
    let mut relics = 0;
    for id in 39_u8..57 {
        relics += resources.resource_balance(ResourceSlot { game_id, entity_id: explorer_id, resource_type: id });
    }
    assert_eq!(relics, RESOURCE_PRECISION);
    let mine_coord = crate::geometry::neighbor(army.coord, 1);
    start_cheat_block_timestamp_global(362);
    start_cheat_caller_address(d.games, d.games);
    let mine_id = structures.create_discovery(game_id, mine_coord, crate::discovery::Discovery::Mine, 101, 362);
    stop_cheat_caller_address(d.games);
    let mine = ResourceSlot { game_id, entity_id: mine_id, resource_type: 38 };
    assert_eq!(resources.resource_production(mine).production_rate, 0);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::BattleGuard(crate::commands::Battle { attacker_id: explorer_id, defender_id: mine_id }),
            362,
            362,
        ),
    );
    assert_eq!(troops.explorer(army_key).unwrap().troops.stamina.amount, 70);
    let mut total_relics = 0;
    for id in 39_u8..57 {
        total_relics += resources.resource_balance(ResourceSlot { game_id, entity_id: explorer_id, resource_type: id });
    }
    assert_eq!(total_relics, if depth == 0 {
        1
    } else {
        2
    } * RESOURCE_PRECISION);
    let baseline = resources.resource_balance(essence);
    for time in array![365_u64, 390, 450, 500] {
        start_cheat_block_timestamp_global(time);
        start_cheat_caller_address(d.games, d.games);
        // Touching either the source or the home uses the existing lazy production settlement.
        resources.grant_resource(ResourceKey { entity_id: mine_id, ..home }, 38, 0, time);
        resources.grant_resource(home, 38, 0, time);
        stop_cheat_caller_address(d.games);
        let until = core::cmp::min(time, 400);
        let produced = Into::<u64, u128>::into(until - 362) * (Into::<u8, u128>::into(depth) + 1) * RESOURCE_PRECISION;
        let cap = (*depths.at(depth.into())).mine_cap_min;
        assert_eq!(resources.resource_balance(essence) - baseline, core::cmp::min(produced, cap));
        assert_eq!(resources.resource_balance(mine), 0);
    }
    assert!(resources.production_receiver(mine).is_none());
    assert_eq!(resources.resource_production(mine).production_rate, 0);
}

#[test]
fn depth_entry_requires_attunement_and_spends_only_the_selected_depth_stamina() {
    let d = setup();
    let mut preset = definition(true);
    preset.rules.entry_rule = crate::rules::ENTRY_OPEN;
    preset.rules.epoch_seconds = 100;
    preset.rules.mode_rules = HOME_REWARDS | crate::rules::DEPTH_CONTENTS;
    preset.rules.command_mask = 0xffffffffffffffffffffffffffffffff;
    preset.settlement.spacing = 1024;
    preset.rules.troop_limit_config.starting_guard = 0;
    preset.rules.troop_limit_config.settlement_armies = 3;
    preset.rules.troop_stamina_config.stamina_initial = 150;
    preset.rules.troop_stamina_config.stamina_knight_max = 150;
    preset.rules.troop_stamina_config.stamina_gain_per_tick = 0;
    let mut depths = array![];
    for depth in 0_u16..4 {
        depths
            .append(
                crate::expeditions::DepthRules {
                    supply_multiplier: depth + 1,
                    guard_lower: depth + 1,
                    guard_upper: depth + 2,
                    mine_cap_min: 100 * RESOURCE_PRECISION,
                    mine_cap_max: 100 * RESOURCE_PRECISION,
                    mine_rate: RESOURCE_PRECISION.try_into().unwrap(),
                    camp_reward_min: 100 * RESOURCE_PRECISION,
                    camp_reward_max: 100 * RESOURCE_PRECISION,
                    mine_chest: depth != 0,
                    reveal_site_neighbors: false,
                    entry_stamina: if depth == 0 {
                        0
                    } else {
                        20 + 10 * depth
                    },
                    attunement_cost: Into::<u16, u128>::into(depth) * 100 * RESOURCE_PRECISION,
                    chest: crate::relics::ChestGround { common: 10000, uncommon: 0, rare: 0, pity: 20 },
                },
            );
    }
    preset.settlement.depths = depths.span();
    registry(d).register_preset(1, preset);
    let game_id = registry(d)
        .create_game(
            CreateGameParams { dev_mode_on: true, end_grace_seconds: 0, duration_seconds: 500, ..params(false) },
            preset,
        );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("catalogue_count"), array![].span(), 8000_u32,
    );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("traits"), array![1].span(), 0x4000001_u32,
    );
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(crate::realms::SettleSeason { name: 'home', selected_realm: Some(1) }),
            350,
            350,
        ),
    );
    let home = ResourceKey { game_id, entity_id: 1 };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let essence = ResourceSlot { game_id, entity_id: 1, resource_type: 38 };
    start_cheat_caller_address(d.games, d.games);
    resources.grant_resource(home, 26, 10 * RESOURCE_PRECISION, 350);
    resources.grant_resource(home, 38, 1000 * RESOURCE_PRECISION, 350);
    stop_cheat_caller_address(d.games);
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let troops = GameState { contract_address: d.games };
    let buy = Command::BuyRealmUpgrade(
        crate::upgrades::BuyRealmUpgrade { structure_id: 1, lane: crate::upgrades::RealmUpgradeLane::Attunement },
    );
    for depth in 1_u8..4 {
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::CreateExplorer(
                    CreateExplorer {
                        structure_id: 1, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction: depth - 1,
                    },
                ),
                351,
                351,
            ),
        );
        let explorer_id = *structures.structure(home).unwrap().troop_explorers.at((depth - 1).into());
        let key = ExplorerKey { game_id, explorer_id };
        let before = troops.explorer(key).unwrap();
        let enter = Command::EnterDepth(crate::commands::EnterDepth { explorer_id, depth });
        assert!(!execute_in_game(d, game_id, enter, 351, 351));
        assert_eq!(troops.explorer(key).unwrap(), before);
        let balance = resources.resource_balance(essence);
        assert!(execute_in_game(d, game_id, buy, 351, 351));
        assert_eq!(structures.structure(home).unwrap().metadata.attunement, depth);
        let after_purchase = resources.resource_balance(essence);
        assert_eq!(balance - after_purchase, Into::<u8, u128>::into(depth) * 100 * RESOURCE_PRECISION);
        assert!(execute_in_game(d, game_id, enter, 351, 351));
        let inside = troops.explorer(key).unwrap();
        assert_eq!(inside.coord.x, before.coord.x);
        assert_eq!(inside.coord.y, before.coord.y + Into::<u8, u32>::into(depth) * preset.settlement.spacing);
        assert_eq!(inside.troops.stamina.amount, 150 - (20 + Into::<u8, u64>::into(depth) * 10));
        assert_eq!(resources.resource_balance(essence), after_purchase);
        assert!(!execute_in_game(d, game_id, enter, 351, 351));
        assert_eq!(troops.explorer(key).unwrap(), inside);
    }
    let balance = resources.resource_balance(essence);
    assert!(!execute_in_game(d, game_id, buy, 351, 351));
    assert_eq!(resources.resource_balance(essence), balance);
}

#[test]
fn reveal_chests_pay_once_record_capped_claims_and_expire_army_relics_at_rollover() {
    let d = setup();
    let mut preset = definition(true);
    preset.rules.entry_rule = crate::rules::ENTRY_OPEN;
    preset.rules.epoch_seconds = 100;
    preset.rules.mode_rules = HOME_REWARDS
        | DISCOVER_CHESTS
        | crate::rules::REVEAL_SUPPLIES
        | crate::rules::DEPTH_CONTENTS;
    preset.settlement.spacing = 1024;
    preset.rules.troop_limit_config.starting_guard = 0;
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.rules.map_config.shards_mines_fail_probability = 1;
    preset.rules.troop_stamina_config.stamina_initial = 150;
    preset.rules.troop_stamina_config.stamina_knight_max = 150;
    preset.rules.troop_stamina_config.stamina_gain_per_tick = 0;
    preset.rules.troop_stamina_config.stamina_explore_stamina_cost = 1;
    let mut depths = array![];
    for depth in 0_u16..4 {
        depths
            .append(
                crate::expeditions::DepthRules {
                    supply_multiplier: 1,
                    guard_lower: 1,
                    guard_upper: 2,
                    mine_cap_min: RESOURCE_PRECISION,
                    mine_cap_max: RESOURCE_PRECISION,
                    mine_rate: 1,
                    camp_reward_min: 0,
                    camp_reward_max: 0,
                    mine_chest: depth != 0,
                    reveal_site_neighbors: false,
                    entry_stamina: 0,
                    attunement_cost: 0,
                    chest: ChestGround { common: 10000, uncommon: 0, rare: 0, pity: 2 },
                },
            );
    }
    preset.settlement.depths = depths.span();
    preset
        .economy
        .chests = Some(ChestRules { loose_one_in: 1, relic_probability: 0, cosmetic_probability: 5000, token_cap: 1 });
    let mut relics = array![];
    for index in 0..18_u32 {
        relics
            .append(
                crate::relics::RelicRule {
                    essence_cost: 0, draw_weight: if index == 0 {
                        1
                    } else {
                        0
                    }, ..*preset.economy.relics.at(index),
                },
            );
    }
    preset.economy.relics = relics.span();
    registry(d).register_preset(1, preset);
    let game_id = registry(d)
        .create_game(
            CreateGameParams { dev_mode_on: true, end_grace_seconds: 0, duration_seconds: 500, ..params(false) },
            preset,
        );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("catalogue_count"), array![].span(), 8000_u32,
    );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("traits"), array![1].span(), 0x4000001_u32,
    );
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(crate::realms::SettleSeason { name: 'home', selected_realm: Some(1) }),
            350,
            350,
        ),
    );
    let home = ResourceKey { game_id, entity_id: 1 };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, d.games);
    resources.grant_resource(home, 26, 10 * RESOURCE_PRECISION, 350);
    stop_cheat_caller_address(d.games);
    let muster = Command::CreateExplorer(
        CreateExplorer { structure_id: 1, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction: 0 },
    );
    assert!(execute_in_game(d, game_id, muster, 351, 351));
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let explorer_id = *structures.structure(home).unwrap().troop_explorers.at(0);
    let relics = IRelicsDispatcher { contract_address: d.games };
    let mut spy = snforge_std::spy_events();
    let mut opened = 0_u32;
    let explore = Command::Explore(Explore { explorer_id, direction: 0 });
    for timestamp in array![360_u64, 361, 365, 366, 368] {
        assert!(execute_in_game(d, game_id, explore, timestamp, timestamp));
        opened += 1;
    }
    assert!(execute_in_game(d, game_id, Command::Explore(Explore { explorer_id, direction: 3 }), 372, 372));
    assert!(execute_in_game(d, game_id, explore, 373, 373));
    let timestamp = 374;
    assert_eq!(relics.chest_tokens(game_id, d.actor, 3), 1);
    let common = ResourceSlot { game_id, entity_id: explorer_id, resource_type: 39 };
    let epic = ResourceSlot { resource_type: 40, ..common };
    assert!(resources.resource_balance(common) >= RESOURCE_PRECISION);
    assert!(resources.resource_balance(epic) >= RESOURCE_PRECISION);
    assert_eq!(resources.resource_balance(ResourceSlot { entity_id: 1, ..common }), 0);
    let essence = ResourceSlot { game_id, entity_id: 1, resource_type: 38 };
    let before_essence = resources.resource_balance(essence);
    let apply = Command::ApplyRelic(
        crate::relics::ApplyRelic {
            entity_id: explorer_id, relic_id: 39, recipient: crate::relics::Recipient::Explorer,
        },
    );
    assert!(execute_in_game(d, game_id, apply, timestamp, timestamp));
    assert_eq!(resources.resource_balance(essence), before_essence);
    let pity = relics.chest_pity(game_id, d.actor, 0);
    assert_eq!(pity, 1);
    assert!(!execute_in_game(d, game_id, apply, 400, 400));
    assert!(execute_in_game(d, game_id, muster, 400, 400));
    assert!(!resources.has_resource(ResourceKey { game_id, entity_id: explorer_id }));
    assert_eq!(relics.chest_pity(game_id, d.actor, 0), pity);
    let second = *structures.structure(home).unwrap().troop_explorers.at(0);
    for timestamp in 410_u64..414 {
        assert!(
            execute_in_game(
                d, game_id, Command::Explore(Explore { explorer_id: second, direction: 0 }), timestamp, timestamp,
            ),
        );
        opened += 1;
    }
    assert_eq!(relics.chest_tokens(game_id, d.actor, 3), 1);
    assert_eq!(relics.chest_tokens(game_id, d.actor, 4), 1);
    let mut paid = 0_u32;
    let mut cosmetic_claims = 0_u32;
    let mut token_claims = 0_u32;
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(1) == selector!("StoryEvent") {
            let mut data = event.data.span();
            let story: crate::ownership::Story = Serde::deserialize(ref data).unwrap();
            if let crate::ownership::Story::ChestReward(reward) = story {
                paid += 1;
                assert_eq!(reward.player, d.actor);
                assert_eq!(reward.depth, 0);
                assert!(reward.explorer_id == explorer_id || reward.explorer_id == second);
                assert_eq!(reward.epoch, if reward.explorer_id == explorer_id {
                    3
                } else {
                    4
                });
                if reward.kind != ChestKind::Relic {
                    let id: u32 = (*event.keys.at(4)).try_into().unwrap();
                    assert_eq!(relics.chest_reward(game_id, id).unwrap(), reward);
                    assert_eq!(reward.relic_id, 0);
                    assert_eq!(reward.quality, 0);
                    if reward.kind == ChestKind::Token {
                        token_claims += 1;
                    } else {
                        cosmetic_claims += 1;
                    }
                } else {
                    assert!(reward.relic_id == 39 || reward.relic_id == 40);
                }
            }
        }
    }
    assert_eq!(paid, opened);
    assert_eq!(token_claims, 2);
    assert!(cosmetic_claims != 0);
}
