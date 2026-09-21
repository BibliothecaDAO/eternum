use eternum_randomness_protocol::entrypoint::IRecordedExecutionViewsDispatcher;
use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address};
use crate::game::{GameStatus, IGameDispatcher, IGameDispatcherTrait, status_at};
use crate::guards::{GuardKey, IGuardsDispatcher, IGuardsDispatcherTrait};
use crate::lifecycle::{IDomainDispatcher, IDomainDispatcherTrait, PeersTrait};
use crate::map::{IMapDispatcher, IMapDispatcherTrait, TileKey, structure_occupant};
use crate::presets::{
    EconomyPreset, PresetDefinition, ResourcePreset, SettlementPreset, StructurePreset, WithdrawalPreset,
};
use crate::registrar::{
    CreateGameParams, IRegistrarDispatcher, IRegistrarDispatcherTrait, IRegistrarSafeDispatcher,
    IRegistrarSafeDispatcherTrait, RosterPlayer,
};
use crate::resources::{IResourcesDispatcher, IResourcesDispatcherTrait, ResourceKey, ResourceRule, ResourceSlot};
use crate::season::{ISeasonDispatcher, ISeasonDispatcherTrait};
use crate::settlement::{
    ISettlementCommandsDispatcher, ISettlementCommandsDispatcherTrait, ISettlementCommandsSafeDispatcher,
    ISettlementCommandsSafeDispatcherTrait, ISettlementViewsDispatcher, ISettlementViewsDispatcherTrait, SettlementMode,
};
use crate::structures::{IStructuresDispatcher, IStructuresDispatcherTrait};
use super::recorded_receipts::RecordedReceiptsTrait;

fn setup() -> super::Deployment {
    let d = super::setup_with_domains(false, "StructuresDomain", "TroopsDomain");
    for address in d.peers.addresses() {
        start_cheat_caller_address(*address, super::authority());
        IDomainDispatcher { contract_address: *address }.activate();
        stop_cheat_caller_address(*address);
    }
    let registry = crate::season::ISeasonDispatcherTrait::authentication(
        crate::season::ISeasonDispatcher { contract_address: d.peers.season },
    )
        .registry;
    for index in 1_u32..25 {
        crate::tests::fixtures::IRegistryFixtureDispatcherTrait::add_binding(
            crate::tests::fixtures::IRegistryFixtureDispatcher { contract_address: registry },
            Into::<u32, felt252>::into(1000 + index).try_into().unwrap(),
            Into::<u32, felt252>::into(2000 + index).try_into().unwrap(),
        );
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
        resources.append(ResourceRule { resource_type, unit_weight: 1, realm_rate: 10, village_rate: 5 });
    }
    PresetDefinition {
        rules: crate::rules::SliceRules { mode_id: if blitz {
            1
        } else {
            0
        }, ..super::recorded::rules() },
        resources: ResourcePreset {
            resources: resources.span(),
            production: super::production::recipes(),
            mine_kinds: super::mines::kinds(),
            surface_mines: array![crate::mines::MineWeight { kind: 1, weight: 1 }].span(),
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
        exploration: array![crate::exploration_rewards::ExplorationReward { resource_type: 1, amount: 10, weight: 1 }]
            .span(),
        season_win_points: 1000,
    }
}
fn roster(count: u32) -> Span<RosterPlayer> {
    let mut players = array![];
    for index in 1..count + 1 {
        players
            .append(
                RosterPlayer {
                    owner: Into::<u32, felt252>::into(1000 + index).try_into().unwrap(),
                    account: Into::<u32, felt252>::into(2000 + index).try_into().unwrap(),
                },
            );
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
        mode: if blitz {
            SettlementMode::Triple
        } else {
            SettlementMode::Single
        },
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
        let settlement = ISettlementViewsDispatcher { contract_address: d.peers.settlement };
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
    let economy = crate::hyperstructures::IHyperstructuresDispatcher { contract_address: d.peers.economy };
    assert_eq!(
        crate::hyperstructures::IHyperstructuresDispatcherTrait::hyperstructure_rules(economy, game_id),
        preset.economy.hyperstructures,
    );
    start_cheat_caller_address(d.peers.economy, super::authority());
    assert!(
        crate::hyperstructures::IHyperstructuresSafeDispatcherTrait::configure_hyperstructures(
            crate::hyperstructures::IHyperstructuresSafeDispatcher { contract_address: d.peers.economy },
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
    let spires = crate::spires::ISpiresDispatcher { contract_address: d.peers.map };
    assert_eq!(crate::spires::ISpiresDispatcherTrait::spire_layout(spires, 1), preset.settlement.spires);
    let settlement = ISettlementViewsDispatcher { contract_address: d.peers.settlement };
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
        CreateGameParams { mode: SettlementMode::Duel, ..params(true) },
    ] {
        assert!(safe(d).create_game(input, preset).is_err());
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
            super::fixtures::IRollbackFixtureDispatcher { contract_address: caller },
            d.peers.registry,
            params(true),
            preset,
        ),
    );
    assert_eq!(registry(d).next_game_id(), 1);
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
    super::resource_commands::assert_terminal_rejection(d, command, 100);
    let d = super::bind_authority(d);
    let games = IGameDispatcher { contract_address: d.peers.season };
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
    assert!(safe(d).register_preset(1, preset).is_err());
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
    assert!(safe(d).register_preset(1, preset).is_err());
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
        assert!(safe(d).register_preset(1, preset).is_err());
        assert_eq!(registry(d).preset_commitment(1), 0);
    }
}

#[test]
#[feature("safe_dispatcher")]
fn fixed_blitz_rosters_require_unique_bound_players_and_regular_mode() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    let player = *roster(1).at(0);
    for players in array![
        array![player, player].span(), array![RosterPlayer { account: 0.try_into().unwrap(), ..player }].span(),
        array![RosterPlayer { owner: 999.try_into().unwrap(), ..player }].span(),
        array![RosterPlayer { account: 2002.try_into().unwrap(), ..player }].span(),
    ] {
        assert!(safe(d).create_game(CreateGameParams { roster: players, ..params(true) }, preset).is_err());
        assert_eq!(registry(d).next_game_id(), 1);
    }
    assert!(safe(d).create_game(CreateGameParams { mode: SettlementMode::Single, ..params(true) }, preset).is_err());
    assert!(safe(d).create_game(CreateGameParams { dev_mode_on: true, ..params(true) }, preset).is_err());
    for size in array![1_u32, 13, 17, 24] {
        let players = roster(size);
        let id = registry(d)
            .create_game(CreateGameParams { name: size.into(), roster: players, ..params(true) }, preset);
        assert_eq!(registry(d).blitz_roster(id), players);
        let settlement = ISettlementViewsDispatcher { contract_address: d.peers.settlement };
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
    start_cheat_caller_address(d.peers.registry, d.actor);
    assert!(safe(d).create_game(request, preset).is_err());
    start_cheat_caller_address(d.peers.registry, super::authority());
    assert_eq!(registry(d).game_id_by_name(request.name), 0);
    let first = registry(d).create_game(request, preset);
    assert_eq!(registry(d).create_game(request, preset), first);
    assert_eq!(registry(d).next_game_id(), first + 1);
    assert_eq!(registry(d).game_id_by_name(request.name), first);
    assert!(safe(d).create_game(CreateGameParams { roster: roster(1), ..request }, preset).is_err());
    assert!(safe(d).create_game(CreateGameParams { duration_seconds: 101, ..request }, preset).is_err());
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
                crate::troops::Coord { alt: false, x: 1000, y: 1000 }, SettlementMode::Triple, 1, index,
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
    let games = IGameDispatcher { contract_address: d.peers.season };
    let commands = ISettlementCommandsDispatcher { contract_address: d.peers.settlement };
    let safe = ISettlementCommandsSafeDispatcher { contract_address: d.peers.settlement };
    let views = ISettlementViewsDispatcher { contract_address: d.peers.settlement };
    let mut context = crate::commands::ExecutionContext { raw_root: 98765, timestamp: 205 };
    assert!(!games.game(game_id).ready);
    assert!(status_at(games.game(game_id), 99999) == GameStatus::Registration);
    start_cheat_caller_address(d.peers.settlement, d.actor);
    assert!(safe.settle_blitz_roster(game_id, super::authority(), context).is_err());
    start_cheat_caller_address(d.peers.settlement, d.peers.season);
    assert!(safe.settle_blitz_roster(game_id, d.actor, context).is_err());
    assert!(
        safe
            .settle_blitz_roster(
                game_id, super::authority(), crate::commands::ExecutionContext { timestamp: 199, ..context },
            )
            .is_err(),
    );
    assert!(views.blitz_settlement_order(game_id).is_empty());
    let structures = IStructuresDispatcher { contract_address: d.peers.structures };
    let resources = IResourcesDispatcher { contract_address: d.peers.resources };
    let guards = IGuardsDispatcher { contract_address: d.peers.troops };
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
                crate::troops::Coord { alt: false, x: center, y: center }, SettlementMode::Triple, 1, batch,
            )
                .at(realm);
            let entity_id = structure_occupant(
                IMapDispatcher { contract_address: d.peers.map }
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
        crate::troops::Coord { alt: false, x: center, y: center }, SettlementMode::Triple, 1, 0,
    )
        .at(0);
    let entity_id = structure_occupant(
        IMapDispatcher { contract_address: d.peers.map }
            .tile(TileKey { game_id, alt: false, col: coord.x, row: coord.y })
            .unwrap(),
    )
        .unwrap();
    let slot = ResourceSlot { game_id, entity_id, resource_type: 23 };
    let balance = resources.resource_balance(slot);
    start_cheat_caller_address(d.peers.resources, d.peers.structures);
    resources.spend_resource(ResourceKey { game_id, entity_id }, 23, 0, 1001);
    assert_eq!(resources.resource_balance(slot), balance, "early realm accrued before main play");
    resources.spend_resource(ResourceKey { game_id, entity_id }, 23, 1, 1002);
    assert_eq!(resources.resource_balance(slot), balance + 10 - 1, "production did not start with the game");
    stop_cheat_caller_address(d.peers.resources);
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
    let season = ISeasonDispatcher { contract_address: d.peers.season };
    let receipts = IRecordedExecutionViewsDispatcher { contract_address: d.peers.season };
    assert_eq!(receipts.recorded_outcome(season.execution_head().order).unwrap().reason, 'ROSTER_NOT_READY');
    assert_eq!(season.next_nonce(game_id, d.actor), 1);
    super::season_lifecycle::execute_batch_in_game(d, game_id, command, 205, 1);
    assert!(!IGameDispatcher { contract_address: d.peers.season }.game(game_id).ready);
    assert!(!super::resource_commands::execute_in_game(d, game_id, crate::commands::Command::CloseSeason, 206, 206));
    assert_eq!(receipts.recorded_outcome(season.execution_head().order).unwrap().reason, 'ROSTER_NOT_READY');
    assert_eq!(season.next_nonce(game_id, d.actor), 3);
    super::season_lifecycle::execute_batch_in_game(d, game_id, command, 207, 0);
    assert!(IGameDispatcher { contract_address: d.peers.season }.game(game_id).ready);
    super::season_lifecycle::execute_batch_in_game(d, game_id, command, 208, 0);
    let games = IGameDispatcher { contract_address: d.peers.season };
    let end_at = games.game(game_id).end_at;
    let finalize = crate::commands::Command::MarkGameSettled;
    assert!(!super::resource_commands::execute_in_game(d, game_id, finalize, end_at - 1, end_at - 1));
    assert!(!games.game(game_id).settled);
    super::season_lifecycle::execute_batch_in_game(d, game_id, finalize, end_at, 0);
    assert!(games.game(game_id).settled);
    assert_eq!(status_at(games.game(game_id), end_at), GameStatus::Settled);
}
