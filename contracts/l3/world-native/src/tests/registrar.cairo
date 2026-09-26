use eternum_randomness_protocol::entrypoint::IRecordedExecutionViewsDispatcher;
use snforge_std::fs::{FileTrait, read_txt};
use snforge_std::{
    EventSpyTrait, EventsFilterTrait, start_cheat_block_timestamp_global, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::combat::TroopsTrait;
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
use crate::stamina::StaminaSourceTrait;
use crate::structures::{IStructureOperationsDispatcher, IStructureOperationsDispatcherTrait};
use crate::tests::StoryResultTestTrait;
use crate::tests::state::{
    GameState, MapObservationTrait, ResourceObservationTrait, StructureObservationTrait, TroopObservationTrait,
};
use crate::troops::{
    ExplorerKey, ExplorerRecordTrait, IBattleResolutionDispatcherTrait, IBattleResolutionLibraryDispatcher,
};
use super::recorded_receipts::RecordedReceiptsTrait;
use super::resource_commands::execute_in_game;

pub fn setup() -> super::Deployment {
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
pub(crate) fn definition(blitz: bool) -> PresetDefinition {
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
            research: array![].span(),
            building_tiers: array![].span(),
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
            progression: None,
            discovery: None,
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
pub fn params(blitz: bool) -> CreateGameParams {
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
fn launch_rejects_unregistered_presets_before_allocating() {
    let d = setup();
    let preset = definition(true);
    assert!(safe(d, super::authority()).create_game(params(true)).is_err());
    assert!(safe(d, super::authority()).register_preset(0, preset).is_err());
    assert!(safe(d, d.actor).register_preset(1, preset).is_err());
    registry(d).register_preset(1, preset);
    assert_eq!(registry(d).preset_commitment(1), crate::presets::commitment(preset));
    assert!(safe(d, super::authority()).create_game(CreateGameParams { preset_id: 99, ..params(true) }).is_err());
    assert_eq!(registry(d).next_game_id(), 1);
}

#[test]
#[feature("safe_dispatcher")]
fn registered_presets_are_immutable_and_changed_rules_require_a_new_id() {
    let d = setup();
    let original = definition(true);
    registry(d).register_preset(1, original);
    let old_id = registry(d).create_game(params(true));
    let mut changed = original;
    changed.rules.troop_stamina_config.stamina_explore_stamina_cost += 1;
    assert!(safe(d, d.actor).register_preset(1, changed).is_err());
    assert_eq!(registry(d).preset_commitment(1), crate::presets::commitment(original));
    assert!(safe(d, super::authority()).register_preset(1, original).is_err());
    assert!(safe(d, super::authority()).register_preset(1, changed).is_err());
    assert_eq!(registry(d).preset_commitment(1), crate::presets::commitment(original));
    assert_eq!(registry(d).create_game(params(true)), old_id);
    let next_params = CreateGameParams { name: 'next', ..params(true) };
    assert!(safe(d, super::authority()).create_game(CreateGameParams { preset_id: 101, ..next_params }).is_err());
    let next_original_id = registry(d).create_game(next_params);
    assert!(safe(d, d.actor).register_preset(101, changed).is_err());
    registry(d).register_preset(101, changed);
    assert_eq!(registry(d).preset_commitment(101), crate::presets::commitment(changed));
    let new_id = registry(d).create_game(CreateGameParams { name: 'changed', preset_id: 101, ..params(true) });
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
fn identical_content_under_a_second_id_reuses_the_record_without_rewriting_withdrawals() {
    let d = setup();
    let mut preset = definition(false);
    let token = crate::withdrawals::ResourceToken { resource_type: 1, token: 0xfee.try_into().unwrap() };
    preset
        .economy
        .withdrawals = Some(WithdrawalPreset { tokens: array![token].span(), ..preset.economy.withdrawals.unwrap() });
    let commitment = crate::presets::commitment(preset);
    registry(d).register_preset(1, preset);
    let stored_token = snforge_std::interact_with_state(
        d.games, || {
            crate::state::read().presets.entry(commitment).withdrawal_tokens.read(1)
        },
    );
    assert_eq!(stored_token, token.token);
    // Re-entering the withdrawal writer would reject the already populated resource token.
    registry(d).register_preset(2, preset);
    assert_eq!(registry(d).preset_commitment(1), commitment);
    assert_eq!(registry(d).preset_commitment(2), commitment);
    let reused_token = snforge_std::interact_with_state(
        d.games, || {
            crate::state::read().presets.entry(commitment).withdrawal_tokens.read(1)
        },
    );
    assert_eq!(reused_token, stored_token);
}

#[test]
fn blitz_launch_initializes_domains_once_and_allocates_isolated_games() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    let games = IGameDispatcher { contract_address: d.games };
    for expected in 1_u32..3 {
        assert_eq!(registry(d).create_game(CreateGameParams { name: expected.into(), ..params(true) }), expected);
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
    let game_id = registry(d).create_game(params(true));
    let economy = crate::hyperstructures::IHyperstructuresDispatcher { contract_address: d.games };
    assert_eq!(
        crate::hyperstructures::IHyperstructuresDispatcherTrait::hyperstructure_rules(economy, game_id),
        preset.economy.hyperstructures,
    );
    start_cheat_caller_address(d.games, super::authority());
    assert!(IRegistrarSafeDispatcher { contract_address: d.games }.register_preset(1, preset).is_err());
}

#[test]
#[feature("safe_dispatcher")]
fn eternum_launch_initializes_spires_and_never_uses_entry_capacity() {
    let d = setup();
    let preset = definition(false);
    registry(d).register_preset(1, preset);
    assert!(safe(d, d.actor).create_game(params(false)).is_err());
    assert_eq!(registry(d).next_game_id(), 1);
    assert_eq!(registry(d).create_game(params(false)), 1);
    let rules = IGameDispatcher { contract_address: d.games }.rules(1);
    let center = 2147483646 - rules.map_center_offset;
    for alt in array![false, true] {
        let tile = IMapLogicDispatcher { contract_address: d.games }
            .tile(TileKey { game_id: 1, alt, col: center, row: center })
            .unwrap();
        assert_eq!((tile.data / 2) % 256, 35);
    }
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
        assert!(safe(d, super::authority()).create_game(input).is_err());
    }
    assert_eq!(registry(d).next_game_id(), 1);
}

#[test]
#[feature("safe_dispatcher")]
fn a_late_preset_validation_failure_rolls_back_the_record_and_allows_retry() {
    let d = setup();
    let mut preset = definition(true);
    preset.economy.banks.lp_fee_denom = 0;
    let commitment = crate::presets::commitment(preset);
    start_cheat_caller_address(d.games, super::authority());
    let (caller, _) = super::deploy("RollbackFixture", @array![]);
    assert!(
        !super::fixtures::IRollbackFixtureDispatcherTrait::attempt_preset(
            super::fixtures::IRollbackFixtureDispatcher { contract_address: caller }, d.games, 1, preset,
        ),
    );
    assert_eq!(registry(d).next_game_id(), 1);
    assert_eq!(registry(d).preset_commitment(1), 0);
    let written_mode = snforge_std::interact_with_state(
        d.games, || {
            crate::state::read().presets.entry(commitment).rules.mode_rules.read()
        },
    );
    assert!(preset.rules.mode_rules != 0);
    assert_eq!(written_mode, 0);
    assert!(
        crate::game::IGameSafeDispatcherTrait::game(crate::game::IGameSafeDispatcher { contract_address: d.games }, 1)
            .is_err(),
    );
    registry(d).register_preset(1, definition(true));
    assert_eq!(registry(d).create_game(params(true)), 1);
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
        assert!(safe(d, super::authority()).create_game(CreateGameParams { roster: players, ..params(true) }).is_err());
        assert_eq!(registry(d).next_game_id(), 1);
    }
    assert!(safe(d, super::authority()).create_game(CreateGameParams { dev_mode_on: true, ..params(true) }).is_err());
    for size in array![1_u32, 13, 17, 24] {
        let players = roster(size);
        let id = registry(d).create_game(CreateGameParams { name: size.into(), roster: players, ..params(true) });
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
    assert!(safe(d, d.actor).create_game(request).is_err());
    assert_eq!(registry(d).game_id_by_name(request.name), 0);
    let first = registry(d).create_game(request);
    assert_eq!(registry(d).create_game(request), first);
    assert_eq!(registry(d).next_game_id(), first + 1);
    assert_eq!(registry(d).game_id_by_name(request.name), first);
    assert!(safe(d, super::authority()).create_game(CreateGameParams { roster: roster(1), ..request }).is_err());
    assert!(safe(d, super::authority()).create_game(CreateGameParams { duration_seconds: 101, ..request }).is_err());
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
fn automatic_blitz_settlement_is_open_atomic_and_resumes_its_fixed_order() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    let game_id = registry(d).create_game(CreateGameParams { roster: roster(2), ..params(true) });
    let games = IGameDispatcher { contract_address: d.games };
    let commands = ISettlementCommandsDispatcher { contract_address: d.games };
    let safe = ISettlementCommandsSafeDispatcher { contract_address: d.games };
    let views = ISettlementViewsDispatcher { contract_address: d.games };
    let mut context = crate::commands::ExecutionContext {
        raw_root: 98765, timestamp: 205, ..super::context(d.games, game_id),
    };
    assert!(!games.game(game_id).ready);
    assert!(status_at(games.game(game_id), 99999) == GameStatus::Registration);
    start_cheat_caller_address(d.games, d.actor);
    start_cheat_caller_address(d.games, d.games);
    assert!(
        safe
            .settle_blitz_roster(
                game_id,
                super::authority(),
                crate::commands::action_context(crate::commands::ExecutionContext { timestamp: 199, ..context }),
                crate::tests::story_cursor(),
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
        let caller = if batch == 0 {
            d.actor
        } else {
            super::authority()
        };
        assert!(
            commands
                .settle_blitz_roster(
                    game_id, caller, crate::commands::action_context(context), crate::tests::story_cursor(),
                )
                .story_result() == (1 - batch)
                .into(),
        );
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
    resources
        .spend_resource(
            ResourceKey { game_id, entity_id },
            23,
            0,
            1001,
            crate::commands::resource_context(super::context(d.games, game_id)),
        );
    assert_eq!(resources.resource_balance(slot), balance, "early realm accrued before main play");
    resources
        .spend_resource(
            ResourceKey { game_id, entity_id },
            23,
            1,
            1002,
            crate::commands::resource_context(super::context(d.games, game_id)),
        );
    assert_eq!(resources.resource_balance(slot), balance + 10 - 1, "production did not start with the game");
    stop_cheat_caller_address(d.games);
    let progress = views.settlement_progress(game_id);
    assert!(
        commands
            .settle_blitz_roster(
                game_id, super::authority(), crate::commands::action_context(context), crate::tests::story_cursor(),
            )
            .story_result() == 0,
    );
    assert!(views.settlement_progress(game_id) == progress && games.game(game_id) == game);
}

#[test]
fn recorded_roster_batches_block_early_play_and_report_ticket_progress() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    let game_id = registry(d).create_game(CreateGameParams { roster: roster(2), ..params(true) });
    assert!(d.actor != super::authority());
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
fn roster_settlement_displaces_an_army_without_a_stale_position_or_home_entry() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    let game_id = registry(d).create_game(CreateGameParams { roster: roster(1), ..params(true) });
    let rules = IGameDispatcher { contract_address: d.games }.rules(game_id);
    let center = 2147483646 - rules.map_center_offset;
    let origin = *crate::settlement_grid::settlement_location(
        crate::troops::Coord { alt: false, x: center, y: center }, preset.settlement.mode, preset.settlement.spacing, 0,
    )
        .at(0);
    let home = ResourceKey { game_id, entity_id: 10000 };
    let army = crate::troops::ExplorerKey { game_id, explorer_id: 10001 };
    snforge_std::interact_with_state(
        d.games,
        || {
            crate::logic::structures::StructureState::create(
                home,
                crate::structures::StructureRecord {
                    owner: d.actor,
                    base: crate::structures::StructureBase {
                        category: 1, troop_max_explorer_count: 1, ..Default::default(),
                    },
                    resources_packed: 0,
                    metadata: Default::default(),
                },
            );
        },
    );
    super::resource_commands::set_explorer_fixture(
        d.games,
        army,
        crate::troops::ExplorerTroops {
            owner: home.entity_id,
            coord: origin,
            troops: crate::troops::Troops {
                category: crate::troops::TroopType::Knight,
                tier: crate::troops::TroopTier::T1,
                count: RESOURCE_PRECISION,
                stamina: crate::troops::Stamina { amount: 120, updated_tick: 0 }.into(),
                boosts: Default::default(),
                battle_cooldown_end: 0,
            },
        },
    );
    crate::tests::state::assert_spatial_indexes(d.games, game_id, array![10000, 10001].span(), array![origin].span());
    super::season_lifecycle::execute_batch_in_game(d, game_id, Command::SettleBlitzRoster, 205, 0);
    let moved = GameState { contract_address: d.games }.resolved_explorer(army).unwrap();
    assert!(moved.coord != origin);
    assert_eq!(moved.owner, home.entity_id);
    crate::tests::state::assert_spatial_indexes(
        d.games, game_id, array![1, 10000, 10001].span(), array![origin, moved.coord].span(),
    );
    assert_eq!(
        IStructureOperationsDispatcher { contract_address: d.games }.position(ResourceKey { game_id, entity_id: 1 }),
        Some(origin),
    );
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
    let game_id = registry(d).create_game(CreateGameParams { end_grace_seconds: 0, ..params(false) });

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
                crate::commands::action_context(
                    crate::commands::ExecutionContext { timestamp: 300, ..super::context(d.games, game_id) },
                ),
                crate::tests::story_cursor(),
            )
            .story_result(),
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
    let explorer_id = *structures.home_armies(home).at(0);
    let troops = GameState { contract_address: d.games };
    let explorer = ExplorerKey { game_id, explorer_id };
    let origin = troops.resolved_explorer(explorer).unwrap().coord;
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let home_slot = ResourceSlot { game_id, entity_id: home.entity_id, resource_type: 1 };
    let before = resources.resource_balance(home_slot);

    assert!(execute_in_game(d, game_id, Command::Explore(Explore { explorer_id, direction: 0 }), 360, 360));

    let target = crate::geometry::neighbor(origin, 0);
    let tile = IMapLogicDispatcher { contract_address: d.games }
        .tile(crate::geometry::tile_key(game_id, target))
        .unwrap();
    assert_eq!((tile.data / 2) % 256, crate::camps::CAMP_OCCUPIER.into());
    assert_eq!(troops.resolved_explorer(explorer).unwrap().coord, origin);
    assert_eq!(resources.resource_balance(home_slot), before + 10 * RESOURCE_PRECISION);
    assert_eq!(resources.resource_balance(ResourceSlot { entity_id: explorer_id, ..home_slot }), 0);
}

// An open expedition game with 100 s days, 1024-hex regions and two field armies a realm, in which realm 1 is settled
// at t=350 as entity 1. Returns the game, its preset and the troop category of the realm's grant.
pub fn expedition_home(d: super::Deployment) -> (u32, PresetDefinition, u8) {
    let mut preset = definition(true);
    preset.rules.entry_rule = crate::rules::ENTRY_OPEN;
    preset.rules.command_mask = preset.rules.command_mask
        | (*read_txt(@FileTrait::new("tests/fixtures/frontier-command-mask.txt")).at(0)).try_into().unwrap();
    preset.rules.epoch_seconds = 100;
    preset.economy.discovery = Some(super::preset_projection::frontier_discovery_rules());
    let (_, frontier) = super::preset_projection::current_definition("frontier");
    preset.economy.chests = frontier.economy.chests;
    preset.economy.relics = array![].span();
    preset.settlement.depths = frontier.settlement.depths;
    preset.structures.board = frontier.structures.board;
    preset.structures.research = frontier.structures.research;
    preset.structures.building_tiers = frontier.structures.building_tiers;
    preset.rules.mode_rules = preset.rules.mode_rules | crate::rules::DEPTH_CONTENTS;
    preset.rules.map_config.camp_win_probability = 0;
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.economy.progression = Some(super::preset_projection::frontier_progression_rules());
    preset.rules.mode_rules = HOME_REWARDS | crate::rules::DEPTH_CONTENTS;
    preset.settlement.spacing = 1024;
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.rules.map_config.shards_mines_fail_probability = 1;
    preset.rules.troop_limit_config.settlement_armies = 2;
    registry(d).register_preset(1, preset);
    let game_id = registry(d)
        .create_game(
            CreateGameParams { dev_mode_on: true, end_grace_seconds: 0, duration_seconds: 500, ..params(false) },
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
    let guards = IGuardsDispatcher { contract_address: d.games };
    let category: u8 = guards.guard(GuardKey { game_id, structure_id: 1, slot: 0 }).troops.category.into();
    (game_id, preset, category)
}

pub fn muster_command(category: u8, direction: u8) -> Command {
    Command::CreateExplorer(
        CreateExplorer { structure_id: 1, category, tier: 0, amount: RESOURCE_PRECISION, direction },
    )
}

// Two armies of the expedition home, three troops each, mustered side by side around the day's site.
pub fn expedition_armies(d: super::Deployment, game_id: u32, category: u8) -> (ExplorerKey, ExplorerKey) {
    let home = ResourceKey { game_id, entity_id: 1 };
    start_cheat_caller_address(d.games, d.games);
    for troop in array![26_u8, 29, 32] {
        IResourceOperationsDispatcher { contract_address: d.games }
            .grant_resource(
                home,
                troop,
                1000 * RESOURCE_PRECISION,
                351,
                crate::commands::resource_context(
                    crate::commands::ExecutionContext {
                        timestamp: 351, ..crate::tests::context(d.games, (home).game_id),
                    },
                ),
            );
    }
    stop_cheat_caller_address(d.games);
    for direction in array![0_u8, 1] {
        let muster = Command::CreateExplorer(
            CreateExplorer { structure_id: 1, category, tier: 0, amount: 3 * RESOURCE_PRECISION, direction },
        );
        assert!(execute_in_game(d, game_id, muster, 351, 351));
    }
    let explorers = IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home);
    (ExplorerKey { game_id, explorer_id: *explorers.at(0) }, ExplorerKey { game_id, explorer_id: *explorers.at(1) })
}

pub fn transfer(source: ExplorerKey, target: ExplorerKey, troops: u128) -> Command {
    Command::ManageTroops(
        crate::troop_management::ManageTroops::Transfer(
            crate::troop_management::TransferTroops {
                source: crate::troop_management::Army::Explorer(source.explorer_id),
                target: crate::troop_management::Army::Explorer(target.explorer_id),
                amount: troops * RESOURCE_PRECISION,
            },
        ),
    )
}

#[test]
fn expedition_armies_merge_into_the_lower_stamina_and_never_past_the_size_limit() {
    let d = setup();
    let (game_id, _, category) = expedition_home(d);
    let (source, target) = expedition_armies(d, game_id, category);
    let troops = GameState { contract_address: d.games };
    assert!(
        crate::geometry::adjacent(
            troops.resolved_explorer(source).unwrap().coord, troops.resolved_explorer(target).unwrap().coord,
        ),
    );

    // A tired army merging into a rested one leaves the merged army tired: merging never refills.
    let mut tired = troops.resolved_explorer(source).unwrap();
    tired.troops.stamina.set_amount(5);
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: game_id.into(), explorer_id: source.explorer_id }, tired,
    );
    assert!(troops.resolved_explorer(target).unwrap().troops.stamina.inline().amount > 5);
    assert!(execute_in_game(d, game_id, transfer(source, target, 1), 352, 352));
    let merged = troops.resolved_explorer(target).unwrap();
    assert_eq!(merged.troops.count, 4 * RESOURCE_PRECISION);
    assert_eq!(merged.troops.stamina.inline().amount, 5);
    assert_eq!(troops.resolved_explorer(source).unwrap().troops.count, 2 * RESOURCE_PRECISION);

    // An army at its size limit takes no more troops.
    let rules = IGameDispatcher { contract_address: d.games }.rules(game_id);
    let level = IStructureOperationsDispatcher { contract_address: d.games }
        .structure(ResourceKey { game_id, entity_id: 1 })
        .unwrap()
        .base
        .level;
    let limit: u128 = crate::troops::max_army_size(rules.troop_limit_config, level, merged.troops.tier).into()
        * RESOURCE_PRECISION;
    let mut full = merged;
    full.troops.count = limit;
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: game_id.into(), explorer_id: target.explorer_id }, full,
    );
    assert!(!execute_in_game(d, game_id, transfer(source, target, 1), 353, 353));
    assert_eq!(troops.resolved_explorer(target).unwrap().troops.count, limit);
    assert_eq!(troops.resolved_explorer(source).unwrap().troops.count, 2 * RESOURCE_PRECISION);
}

#[test]
fn an_expedition_army_cannot_recruit_because_its_home_stands_off_the_map() {
    let d = setup();
    let (game_id, _, category) = expedition_home(d);
    let (army, _) = expedition_armies(d, game_id, category);
    let recruit = Command::ManageTroops(
        crate::troop_management::ManageTroops::RecruitExplorer(
            crate::troop_management::RecruitExplorer { explorer_id: army.explorer_id, amount: RESOURCE_PRECISION },
        ),
    );
    assert!(!execute_in_game(d, game_id, recruit, 352, 352));
    assert_eq!(
        GameState { contract_address: d.games }.resolved_explorer(army).unwrap().troops.count, 3 * RESOURCE_PRECISION,
    );
}

#[test]
fn guard_management_is_refused_past_the_home_guard_slots() {
    let d = setup();
    let (game_id, _, _) = expedition_home(d);
    let home = ResourceKey { game_id, entity_id: 1 };
    // Paying for the knights succeeds, so only the slot rule can refuse the recruit.
    start_cheat_caller_address(d.games, d.games);
    IResourceOperationsDispatcher { contract_address: d.games }
        .grant_resource(
            home,
            26,
            1000 * RESOURCE_PRECISION,
            351,
            crate::commands::resource_context(
                crate::commands::ExecutionContext { timestamp: 351, ..crate::tests::context(d.games, (home).game_id) },
            ),
        );
    stop_cheat_caller_address(d.games);
    let slots = IStructureOperationsDispatcher { contract_address: d.games }
        .structure(home)
        .unwrap()
        .base
        .troop_max_guard_count;
    let slot = crate::troop_management::GuardSlot { structure_id: 1, slot: slots };
    let recruit = crate::troop_management::RecruitGuard {
        guard: slot,
        category: crate::troops::TroopType::Knight,
        tier: crate::troops::TroopTier::T1,
        amount: RESOURCE_PRECISION,
    };
    assert!(
        !execute_in_game(
            d, game_id, Command::ManageTroops(crate::troop_management::ManageTroops::RecruitGuard(recruit)), 352, 352,
        ),
    );
    assert!(
        !execute_in_game(
            d, game_id, Command::ManageTroops(crate::troop_management::ManageTroops::RemoveGuard(slot)), 353, 353,
        ),
    );
}

#[test]
fn yesterdays_armies_leave_todays_army_cap_free() {
    let d = setup();
    let (game_id, _, category) = expedition_home(d);
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let troops = GameState { contract_address: d.games };
    let home = ResourceKey { game_id, entity_id: 1 };
    assert!(execute_in_game(d, game_id, muster_command(category, 0), 351, 351));
    assert!(execute_in_game(d, game_id, muster_command(category, 1), 352, 352));
    assert!(!execute_in_game(d, game_id, muster_command(category, 2), 353, 353));
    let yesterday = structures.home_armies(home);
    // The next day both armies are dead by rule; the realm musters its full cap again.
    assert!(execute_in_game(d, game_id, muster_command(category, 0), 401, 401));
    assert!(execute_in_game(d, game_id, muster_command(category, 1), 402, 402));
    for id in yesterday {
        assert!(troops.resolved_explorer(ExplorerKey { game_id, explorer_id: *id }).is_none());
    }
    assert_eq!(structures.home_armies(home).len(), 2);
}

#[test]
fn a_materialized_home_ring_moves_and_explores_without_a_roll() {
    let d = setup();
    let (game_id, preset, category) = expedition_home(d);
    let spacing = preset.settlement.spacing;
    let map = IMapLogicDispatcher { contract_address: d.games };
    let troops = GameState { contract_address: d.games };
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    assert!(execute_in_game(d, game_id, muster_command(category, 0), 351, 351));
    let key = ExplorerKey {
        game_id, explorer_id: *structures.home_armies(ResourceKey { game_id, entity_id: 1 }).at(0),
    };
    let spawn = troops.resolved_explorer(key).unwrap().coord;
    let site = crate::geometry::neighbor(spawn, 3);

    // All neighbours were materialized together before the first deployment.
    let (step, ring_tile) = free_ring_neighbor(map, game_id, spawn, site, spacing);
    let move = Command::Move(crate::commands::Move { explorer_id: key.explorer_id, directions: array![step].span() });
    assert!(execute_in_game(d, game_id, move, 352, 352));
    let tile_key = crate::geometry::tile_key(game_id, ring_tile);
    assert_eq!(troops.resolved_explorer(key).unwrap().coord, ring_tile);
    assert_eq!(
        map.tile(tile_key).unwrap().data / 0x20000000000 % 256,
        map
            .biome(
                tile_key,
                crate::commands::biome_context(
                    crate::commands::ExecutionContext {
                        timestamp: 100, ..crate::tests::context(d.games, (tile_key).game_id),
                    },
                ),
            )
            .into(),
    );

    // An explore onto another ring tile moves at move cost: no discovery, no supplies.
    let (step, target) = free_ring_neighbor(map, game_id, ring_tile, site, spacing);
    // The fixture's armies start with one move of stamina and regain it per 60 s tick, and the move above spent it in
    // this tick; rest the army by one dearest move so the explore is judged on the ring rule, not on fatigue.
    let stamina = preset.rules.troop_stamina_config;
    let mut rested = troops.resolved_explorer(key).unwrap();
    rested
        .troops
        .stamina
        .set_amount(
            rested.troops.stamina.inline().amount
                + (stamina.stamina_travel_stamina_cost + stamina.stamina_bonus_value).into(),
        );
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: game_id.into(), explorer_id: key.explorer_id }, rested,
    );
    let before = troops.resolved_explorer(key).unwrap();
    let progress_before = snforge_std::interact_with_state(d.games, || crate::logic::progression::read(key));
    let discovery_key = crate::expeditions::ExpeditionDiscoveryKey {
        game_id, structure_id: 1, epoch: crate::expeditions::absolute_epoch(preset.rules.epoch_seconds, 353),
    };
    let discovery_before = snforge_std::interact_with_state(
        d.games, || crate::logic::expeditions::discovery(discovery_key),
    );
    let mut balances = array![];
    for resource in array![23_u8, 26, 38].span() {
        balances.append(resources.resource_balance(ResourceSlot { game_id, entity_id: 1, resource_type: *resource }));
    }
    let target_key = crate::geometry::tile_key(game_id, target);
    let mut troops_before = before.troops;
    let (increase, bonus) = troops_before
        .stamina_travel_bonus(
            map
                .biome(
                    target_key,
                    crate::commands::biome_context(
                        crate::commands::ExecutionContext {
                            timestamp: 100, ..crate::tests::context(d.games, (target_key).game_id),
                        },
                    ),
                )
                .into(),
            preset.rules.troop_stamina_config,
        );
    let travel: u64 = preset.rules.troop_stamina_config.stamina_travel_stamina_cost.into();
    let move_cost = if increase {
        travel + bonus.into()
    } else {
        travel - bonus.into()
    };
    assert!(
        execute_in_game(
            d, game_id, Command::Explore(Explore { explorer_id: key.explorer_id, direction: step }), 353, 353,
        ),
    );
    let after = troops.resolved_explorer(key).unwrap();
    assert_eq!(progress_before, snforge_std::interact_with_state(d.games, || crate::logic::progression::read(key)));
    assert_eq!(
        discovery_before,
        snforge_std::interact_with_state(d.games, || crate::logic::expeditions::discovery(discovery_key)),
    );
    assert_eq!(after.coord, target);
    assert_eq!(before.troops.stamina.inline().amount - after.troops.stamina.inline().amount, move_cost);
    assert_eq!(map.tile(target_key).unwrap().data % 2, 0);
    let mut index = 0;
    for resource in array![23_u8, 26, 38].span() {
        assert_eq!(
            resources.resource_balance(ResourceSlot { game_id, entity_id: 1, resource_type: *resource }),
            *balances.at(index),
        );
        index += 1;
    }
}

// A free home-ring neighbour and the direction to it.
fn free_ring_neighbor(
    map: IMapLogicDispatcher, game_id: u32, from: crate::troops::Coord, site: crate::troops::Coord, spacing: u32,
) -> (u8, crate::troops::Coord) {
    let mut found = Option::None;
    for direction in 0_u8..6 {
        let coord = crate::geometry::neighbor(from, direction);
        if found.is_none()
            && coord != site
            && crate::expeditions::is_home_ring(coord, spacing)
            && map.tile(crate::geometry::tile_key(game_id, coord)).is_some()
            && map.tile(crate::geometry::tile_key(game_id, coord)).unwrap().data % crate::map::BIOME_SCALE == 0 {
            found = Some((direction, coord));
        }
    }
    found.expect('no free ring neighbour')
}

#[test]
fn expedition_rollover_expires_armies_and_preserves_the_home_economy() {
    let d = setup();
    let (game_id, preset, category) = expedition_home(d);
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let home_id = 1;
    let home = ResourceKey { game_id, entity_id: home_id };
    let home_before = structures.structure(home).unwrap();
    assert_eq!(home_before.owner, d.actor);
    let map = IMapLogicDispatcher { contract_address: d.games };
    assert!(structures.position(home).is_none());
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let labor = ResourceSlot { game_id, entity_id: home_id, resource_type: 23 };
    let stored = resources.resource_balance(labor);
    let producer = resources.resource_production(labor);
    let capacity = resources.resource_weight(home).capacity;
    let muster = muster_command(category, 0);
    assert!(execute_in_game(d, game_id, muster, 351, 351));
    let old_id = *structures.home_armies(home).at(0);
    let troops = GameState { contract_address: d.games };
    let old = ExplorerKey { game_id, explorer_id: old_id };
    let yesterday = troops.resolved_explorer(old).unwrap().coord;
    assert!(execute_in_game(d, game_id, Command::Explore(Explore { explorer_id: old_id, direction: 0 }), 360, 360));
    let old_tile = map.tile(crate::geometry::tile_key(game_id, crate::geometry::neighbor(yesterday, 0)));
    assert!(!execute_in_game(d, game_id, Command::Explore(Explore { explorer_id: old_id, direction: 1 }), 400, 400));
    assert_eq!(troops.resolved_explorer(old).unwrap().coord, crate::geometry::neighbor(yesterday, 0));
    assert!(execute_in_game(d, game_id, muster, 401, 401));
    assert!(troops.resolved_explorer(old).is_none());
    let new_id = *structures.home_armies(home).at(0);
    let today = troops.resolved_explorer(ExplorerKey { game_id, explorer_id: new_id }).unwrap().coord;
    super::state::assert_spatial_indexes(
        d.games,
        game_id,
        array![home.entity_id, old_id, new_id].span(),
        array![yesterday, crate::geometry::neighbor(yesterday, 0), today].span(),
    );
    assert_ne!(today.y / preset.settlement.spacing, yesterday.y / preset.settlement.spacing);
    assert_eq!(
        map.tile(crate::geometry::tile_key(game_id, crate::geometry::neighbor(yesterday, 0))).unwrap().data
            / 0x20000000000,
        old_tile.unwrap().data / 0x20000000000,
    );
    assert!(map.tile(crate::geometry::tile_key(game_id, crate::geometry::neighbor(today, 0))).is_none());
    assert!(execute_in_game(d, game_id, Command::Explore(Explore { explorer_id: new_id, direction: 0 }), 420, 420));
    assert!(structures.position(home).is_none());
    assert_eq!(resources.resource_weight(home).capacity, capacity);
    assert_eq!(resources.resource_balance(labor), stored);
    assert_eq!(resources.resource_production(labor), producer);
    start_cheat_caller_address(d.games, d.games);
    resources
        .grant_resource(
            home,
            23,
            0,
            420,
            crate::commands::resource_context(
                crate::commands::ExecutionContext { timestamp: 420, ..crate::tests::context(d.games, (home).game_id) },
            ),
        );
    stop_cheat_caller_address(d.games);
    assert_eq!(resources.resource_balance(labor), stored + 70 * producer.production_rate.into());
    assert_eq!(resources.resource_production(labor).production_rate, producer.production_rate);
    assert!(execute_in_game(d, game_id, Command::LevelUp(home_id), 430, 430));
    assert_eq!(structures.structure(home).unwrap().base.level, 1);
    assert!(structures.position(home).is_none());
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
    preset.economy.discovery = Some(super::preset_projection::frontier_discovery_rules());
    let (_, frontier) = super::preset_projection::current_definition("frontier");
    preset.economy.chests = frontier.economy.chests;
    preset.economy.relics = array![].span();
    preset.settlement.depths = frontier.settlement.depths;
    preset.rules.mode_rules = preset.rules.mode_rules | crate::rules::DEPTH_CONTENTS;
    preset.rules.map_config.camp_win_probability = 0;
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.economy.progression = Some(super::preset_projection::frontier_progression_rules());
    preset.rules.mode_rules = HOME_REWARDS | crate::rules::UNOWNED_TARGETS | crate::rules::DEPTH_CONTENTS;
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
        while structures.home_armies(home).len() < Into::<u8, u32>::into(level) + 2 {
            let direction: u8 = structures.home_armies(home).len().try_into().unwrap();
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
    let id = *structures.home_armies(home).at(0);
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
fn surface_sites_pay_initial_guards_once_without_rift_production() {
    assert_expedition_capture(0);
}

#[test]
fn deep_sites_scale_immediate_rewards_and_never_accrue_after_capture() {
    assert_expedition_capture(3);
}

#[test]
fn frontier_reveal_pays_equal_strength_on_surface() {
    assert_capture_with_reveal(0, 1500 * RESOURCE_PRECISION, crate::troops::TroopTier::T1, 150 * RESOURCE_PRECISION);
    assert_capture_with_reveal(0, 500 * RESOURCE_PRECISION, crate::troops::TroopTier::T2, 150 * RESOURCE_PRECISION);
}

#[test]
fn frontier_reveal_pays_equal_strength_on_ethereal_one() {
    assert_capture_with_reveal(1, 1500 * RESOURCE_PRECISION, crate::troops::TroopTier::T1, 225 * RESOURCE_PRECISION);
    assert_capture_with_reveal(1, 500 * RESOURCE_PRECISION, crate::troops::TroopTier::T2, 225 * RESOURCE_PRECISION);
}

fn assert_expedition_capture(depth: u8) {
    assert_capture_with_reveal(
        depth,
        1000 * RESOURCE_PRECISION,
        crate::troops::TroopTier::T1,
        (100 + Into::<u8, u128>::into(depth) * 50) * RESOURCE_PRECISION,
    );
}

fn assert_capture_with_reveal(depth: u8, count: u128, tier: crate::troops::TroopTier, reveal_amount: u128) {
    assert_capture_at(depth, count, tier, reveal_amount, 86460);
}

#[test]
fn sites_pay_the_same_initial_guard_at_2359_as_at_0001() {
    assert_capture_at(0, 1000 * RESOURCE_PRECISION, crate::troops::TroopTier::T1, 100 * RESOURCE_PRECISION, 172740);
}

fn assert_capture_at(depth: u8, count: u128, tier: crate::troops::TroopTier, reveal_amount: u128, capture_at: u64) {
    let d = setup();
    let mut preset = definition(true);
    // Isolate the reveal/capture delta from the realm's passive labor and Essence.
    let mut resource_rules = array![];
    for rule in preset.resources.resources {
        resource_rules
            .append(
                ResourceRule {
                    realm_rate: if *rule.resource_type == crate::resources::LABOR
                        || *rule.resource_type == crate::resources::ESSENCE {
                        0
                    } else {
                        *rule.realm_rate
                    },
                    ..*rule,
                },
            );
    }
    preset.resources.resources = resource_rules.span();
    preset.rules.entry_rule = crate::rules::ENTRY_OPEN;
    preset.rules.epoch_seconds = 86400;
    preset.economy.discovery = Some(super::preset_projection::frontier_discovery_rules());
    let (_, frontier) = super::preset_projection::current_definition("frontier");
    preset.economy.chests = frontier.economy.chests;
    preset.economy.relics = array![].span();
    preset.settlement.depths = frontier.settlement.depths;
    preset.rules.mode_rules = preset.rules.mode_rules | crate::rules::DEPTH_CONTENTS;
    preset.rules.map_config.camp_win_probability = 0;
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.economy.progression = Some(super::preset_projection::frontier_progression_rules());
    preset.rules.mode_rules = HOME_REWARDS
        | DISCOVER_CAMPS
        | crate::rules::UNOWNED_TARGETS
        | crate::rules::DEPTH_CONTENTS
        | crate::rules::REVEAL_SUPPLIES;
    preset.exploration = array![].span();
    preset.settlement.spacing = 1024;
    preset.rules.troop_limit_config.camp_armies = 0;
    preset.rules.troop_limit_config.starting_guard = 0;
    preset.rules.troop_limit_config.settlement_deployment_cap = 3000;
    preset.rules.troop_limit_config.t1_tier_modifier = 100;
    preset.rules.troop_limit_config.t2_tier_strength = 3;
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
    preset
        .economy
        .discovery =
            Some(
                crate::expeditions::FrontierDiscoveryRules {
                    camp_bps: 8000,
                    rift_bps: 1,
                    fallen_realm_bps: 1,
                    loose_chest_bps: 0,
                    shrine_bps: 0,
                    well_bps: 0,
                    empty_reveal_limit: 7,
                },
            );
    preset.rules.map_config.camp_fail_probability = 0;
    preset.rules.map_config.relic_chest_relics_per_chest = 1;
    let mut depths = array![];
    for index in 0_u16..4 {
        depths
            .append(
                crate::expeditions::DepthRules {
                    fallen_guard_lower: 2000,
                    fallen_guard_upper: 4000,
                    guard_step: 1,
                    fallen_guard_tier: crate::troops::TroopTier::T1,
                    reveal_percent: 10 + index * 5,
                    guard_lower: index + 1,
                    guard_upper: index + 1,
                    reveal_site_neighbors: false,
                    entry_stamina: 0,
                    chest: crate::relics::ChestGround { common: 10000, uncommon: 0, rare: 0, pity: 20 },
                },
            );
    }
    preset.settlement.depths = depths.span();
    registry(d).register_preset(1, preset);
    let game_id = registry(d)
        .create_game(
            CreateGameParams { dev_mode_on: true, end_grace_seconds: 0, duration_seconds: 200000, ..params(false) },
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
            86400,
            86400,
        ),
    );
    let home = ResourceKey { game_id, entity_id: 1 };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, d.games);
    resources
        .grant_resource(
            home,
            26,
            1000 * RESOURCE_PRECISION,
            86400,
            crate::commands::resource_context(
                crate::commands::ExecutionContext {
                    timestamp: 86400, ..crate::tests::context(d.games, (home).game_id),
                },
            ),
        );
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
            86401,
            86401,
        ),
    );
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let explorer_id = *structures.home_armies(home).at(0);
    let troops = GameState { contract_address: d.games };
    let army_key = ExplorerKey { game_id, explorer_id };
    let mut army = troops.resolved_explorer(army_key).unwrap();
    let map = IMapLogicDispatcher { contract_address: d.games };
    army.troops.count = count;
    army.troops.tier = tier;
    let original = army.coord;
    army.coord.y += Into::<u8, u32>::into(depth) * preset.settlement.spacing;
    if depth != 0 {
        start_cheat_caller_address(d.games, d.games);
        let occupier: u8 = (map.tile(crate::geometry::tile_key(game_id, original)).unwrap().data / 2 % 256)
            .try_into()
            .unwrap();
        map.vacate(crate::geometry::tile_key(game_id, original), explorer_id);
        let location = crate::geometry::tile_key(game_id, army.coord);
        map
            .reveal(
                location,
                map
                    .biome(
                        location,
                        crate::commands::biome_context(
                            crate::commands::ExecutionContext {
                                timestamp: 100, ..crate::tests::context(d.games, (location).game_id),
                            },
                        ),
                    ),
            );
        map.occupy(location, explorer_id, occupier, false);
        stop_cheat_caller_address(d.games);
    }
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: game_id.into(), explorer_id: explorer_id }, army,
    );
    let labor_supply = ResourceSlot { game_id, entity_id: 1, resource_type: 23 };
    let essence_supply = ResourceSlot { game_id, entity_id: 1, resource_type: 38 };
    let before_supplies = resources.resource_balance(labor_supply) + resources.resource_balance(essence_supply);
    assert!(execute_in_game(d, game_id, Command::Explore(Explore { explorer_id, direction: 0 }), 86402, 86402));
    let coord = crate::geometry::neighbor(army.coord, 0);
    let map = IMapLogicDispatcher { contract_address: d.games };
    let tile = map.tile(crate::geometry::tile_key(game_id, coord)).unwrap();
    let camp_id: u32 = (tile.data / 512 % 0x100000000).try_into().unwrap();
    let camp = ResourceKey { game_id, entity_id: camp_id };
    assert_eq!(structures.structure(camp).unwrap().base.category, crate::camps::CAMP_CATEGORY);
    assert_eq!(structures.structure(camp).unwrap().base.troop_max_explorer_count, 0);
    assert_eq!(troops.resolved_explorer(army_key).unwrap().coord, army.coord);
    assert_eq!(
        resources.resource_balance(labor_supply) + resources.resource_balance(essence_supply) - before_supplies,
        reveal_amount,
    );
    let guards = IGuardsDispatcher { contract_address: d.games };
    assert_eq!(
        guards.guard(GuardKey { game_id, structure_id: camp_id, slot: 0 }).troops.count,
        (Into::<u8, u128>::into(depth) + 1) * RESOURCE_PRECISION,
    );
    let essence = ResourceSlot { game_id, entity_id: 1, resource_type: 38 };
    let mut home_before = array![];
    for resource_type in 1_u8..39 {
        home_before.append(resources.resource_balance(ResourceSlot { resource_type, ..essence }));
    }
    let site_before = snforge_std::interact_with_state(
        d.games, || {
            crate::logic::expeditions::expedition_site(camp).unwrap()
        },
    );
    assert_eq!(site_before.kind, crate::expeditions::SiteKind::Camp);
    assert_eq!(site_before.initial_guard_count, (Into::<u8, u128>::into(depth) + 1) * RESOURCE_PRECISION);
    assert!(!site_before.cleared);
    let attack = Command::BattleGuard(crate::commands::Battle { attacker_id: explorer_id, defender_id: camp_id });
    let mut payout_events = snforge_std::spy_events();
    assert!(execute_in_game(d, game_id, attack, capture_at, capture_at));
    assert_eq!(structures.structure(camp).unwrap().owner, d.actor);
    assert_eq!(troops.resolved_explorer(army_key).unwrap().troops.stamina.inline().amount, 95);
    let site_after = snforge_std::interact_with_state(
        d.games, || {
            crate::logic::expeditions::expedition_site(camp).unwrap()
        },
    );
    assert_eq!(site_after, crate::expeditions::ExpeditionSite { cleared: true, ..site_before });
    for resource_type in 1_u8..39 {
        let reward = if resource_type == crate::resources::LABOR {
            site_before.initial_guard_count / 2
        } else {
            0
        };
        assert_eq!(
            resources.resource_balance(ResourceSlot { resource_type, ..essence }),
            *home_before.at((resource_type - 1).into()) + reward,
        );
    }
    assert_eq!(resources.resource_balance(ResourceSlot { entity_id: camp_id, ..essence }), 0);
    assert_eq!(resources.resource_balance(ResourceSlot { entity_id: camp_id, resource_type: 23, ..essence }), 0);
    assert_eq!(
        resources
            .resource_production(ResourceSlot { entity_id: camp_id, resource_type: 23, ..essence })
            .production_rate,
        0,
    );
    assert!(!execute_in_game(d, game_id, attack, capture_at, capture_at));
    assert_eq!(troops.resolved_explorer(army_key).unwrap().troops.stamina.inline().amount, 95);
    let mut relics = 0_u128;
    for id in 39_u8..57 {
        relics += resources.resource_balance(ResourceSlot { game_id, entity_id: explorer_id, resource_type: id });
    }
    assert_eq!(relics, 0);
    let mine_coord = crate::geometry::neighbor(army.coord, 1);
    start_cheat_block_timestamp_global(capture_at + 1);
    start_cheat_caller_address(d.games, d.games);
    let mine_id = structures
        .create_discovery(
            game_id,
            mine_coord,
            crate::discovery::Discovery::Mine,
            101,
            capture_at + 1,
            crate::commands::action_context(
                crate::commands::ExecutionContext {
                    timestamp: capture_at + 1, ..crate::tests::context(d.games, game_id),
                },
            ),
        );
    stop_cheat_caller_address(d.games);
    let mine = ResourceSlot { game_id, entity_id: mine_id, resource_type: 38 };
    assert_eq!(resources.resource_production(mine), Default::default());
    let before_rift = resources.resource_balance(essence);
    let rift = snforge_std::interact_with_state(
        d.games,
        || {
            crate::logic::expeditions::expedition_site(ResourceKey { game_id, entity_id: mine_id }).unwrap()
        },
    );
    assert_eq!(rift.kind, crate::expeditions::SiteKind::Rift);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::BattleGuard(crate::commands::Battle { attacker_id: explorer_id, defender_id: mine_id }),
            capture_at + 1,
            capture_at + 1,
        ),
    );
    assert_eq!(troops.resolved_explorer(army_key).unwrap().troops.stamina.inline().amount, 70);
    let mut total_relics = 0_u128;
    for id in 39_u8..57 {
        total_relics += resources.resource_balance(ResourceSlot { game_id, entity_id: explorer_id, resource_type: id });
    }
    assert_eq!(total_relics, 0);
    assert_eq!(resources.resource_balance(essence) - before_rift, rift.initial_guard_count * 3);
    let baseline = resources.resource_balance(essence);
    for time in array![capture_at + 4, capture_at + 29, capture_at + 89, capture_at + 139] {
        start_cheat_block_timestamp_global(time);
        start_cheat_caller_address(d.games, d.games);
        // Neither side earns anything after the immediate capture payout.
        resources
            .grant_resource(
                ResourceKey { entity_id: mine_id, ..home },
                38,
                0,
                time,
                crate::commands::resource_context(
                    crate::commands::ExecutionContext {
                        timestamp: time,
                        ..crate::tests::context(d.games, (ResourceKey { entity_id: mine_id, ..home }).game_id),
                    },
                ),
            );
        resources
            .grant_resource(
                home,
                38,
                0,
                time,
                crate::commands::resource_context(
                    crate::commands::ExecutionContext {
                        timestamp: time, ..crate::tests::context(d.games, (home).game_id),
                    },
                ),
            );
        stop_cheat_caller_address(d.games);
        assert_eq!(resources.resource_balance(essence), baseline);
        assert_eq!(resources.resource_balance(mine), 0);
    }
    assert_eq!(resources.resource_production(mine), Default::default());
    let mut paid = 0;
    for (_, event) in payout_events.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(0) == selector!("StoryEvent") {
            let mut keys = event.keys.span().slice(1, event.keys.len() - 1);
            let mut data = event.data.span();
            let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
            if let crate::ownership::Story::SitePayout(payout) = story.story {
                paid += 1;
                assert_eq!(story.owner, Some(d.actor));
                assert_eq!(story.entity_id, Some(payout.site_id));
                assert_eq!(payout.structure_id, home.entity_id);
                assert_eq!(payout.explorer_id, explorer_id);
                let expected = if payout.site_id == camp_id {
                    site_before
                } else {
                    assert_eq!(payout.site_id, mine_id);
                    rift
                };
                assert_eq!(payout.kind, expected.kind);
                assert_eq!(payout.reward, crate::expeditions::site_reward(expected));
            }
        }
    }
    assert_eq!(paid, 2);
}

#[test]
fn depth_entry_requires_research_and_spends_only_the_selected_depth_stamina() {
    let d = setup();
    let mut preset = definition(true);
    preset.rules.entry_rule = crate::rules::ENTRY_OPEN;
    preset.rules.epoch_seconds = 100;
    preset.economy.discovery = Some(super::preset_projection::frontier_discovery_rules());
    let (_, frontier) = super::preset_projection::current_definition("frontier");
    preset.economy.chests = frontier.economy.chests;
    preset.economy.relics = array![].span();
    preset.settlement.depths = frontier.settlement.depths;
    preset.rules.mode_rules = preset.rules.mode_rules | crate::rules::DEPTH_CONTENTS;
    preset.rules.map_config.camp_win_probability = 0;
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.economy.progression = Some(super::preset_projection::frontier_progression_rules());
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
                    fallen_guard_lower: 2000,
                    fallen_guard_upper: 4000,
                    guard_step: 1,
                    fallen_guard_tier: crate::troops::TroopTier::T1,
                    reveal_percent: depth + 1,
                    guard_lower: depth + 1,
                    guard_upper: depth + 1,
                    reveal_site_neighbors: false,
                    entry_stamina: if depth == 0 {
                        0
                    } else {
                        20 + 10 * depth
                    },
                    chest: crate::relics::ChestGround { common: 10000, uncommon: 0, rare: 0, pity: 20 },
                },
            );
    }
    preset.settlement.depths = depths.span();
    preset.structures.board = frontier.structures.board;
    preset.structures.research = frontier.structures.research;
    preset.structures.building_tiers = frontier.structures.building_tiers;
    registry(d).register_preset(1, preset);
    let game_id = registry(d)
        .create_game(
            CreateGameParams { dev_mode_on: true, end_grace_seconds: 0, duration_seconds: 500, ..params(false) },
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
    resources
        .grant_resource(
            home,
            26,
            10 * RESOURCE_PRECISION,
            350,
            crate::commands::resource_context(
                crate::commands::ExecutionContext { timestamp: 350, ..crate::tests::context(d.games, (home).game_id) },
            ),
        );
    resources
        .grant_resource(
            home,
            38,
            1000000 * RESOURCE_PRECISION,
            350,
            crate::commands::resource_context(
                crate::commands::ExecutionContext { timestamp: 350, ..crate::tests::context(d.games, (home).game_id) },
            ),
        );
    stop_cheat_caller_address(d.games);
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let troops = GameState { contract_address: d.games };
    let map = IMapLogicDispatcher { contract_address: d.games };
    // Today's spire stands on the home ring's direction (day % 6); each army musters on it or beside it.
    let start = IGameDispatcher { contract_address: d.games }.game(game_id).start_main_at;
    let spire_direction: u8 = ((351 / 100 - start / 100) % 6).try_into().unwrap();
    let beside_spire = array![spire_direction, (spire_direction + 1) % 6, (spire_direction + 5) % 6];
    for depth in 1_u8..4 {
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::CreateExplorer(
                    CreateExplorer {
                        structure_id: 1,
                        category: 0,
                        tier: 0,
                        amount: RESOURCE_PRECISION,
                        direction: *beside_spire.at((depth - 1).into()),
                    },
                ),
                351,
                351,
            ),
        );
        let explorer_id = *structures.home_armies(home).at((depth - 1).into());
        let key = ExplorerKey { game_id, explorer_id };
        let before = troops.resolved_explorer(key).unwrap();
        let enter = Command::EnterDepth(crate::commands::EnterDepth { explorer_id, depth });
        assert!(!execute_in_game(d, game_id, enter, 351, 351));
        assert_eq!(troops.resolved_explorer(key).unwrap(), before);
        let buy = Command::Research(crate::research::Research { structure_id: 1, node: depth + 9 });
        let balance = resources.resource_balance(essence);
        assert!(execute_in_game(d, game_id, buy, 351, 351));
        assert_eq!(
            snforge_std::interact_with_state(d.games, || crate::logic::research::require(home)).learned
                & crate::research::node_bit(depth + 9),
            crate::research::node_bit(depth + 9),
        );
        let after_purchase = resources.resource_balance(essence);
        assert_eq!(
            balance - after_purchase,
            *frontier.structures.research.at(Into::<u8, u32>::into(depth) + 9).rule.essence_cost,
        );
        assert!(execute_in_game(d, game_id, enter, 351, 351));
        assert_eq!(structures.structure(home).unwrap().metadata.deepest_depth, depth);
        let inside = troops.resolved_explorer(key).unwrap();
        // The army lands on revealed ground in the depth below, with no discovery on its landing tile.
        let landing = map.tile(crate::geometry::tile_key(game_id, inside.coord)).unwrap().data;
        assert_ne!(landing / 0x20000000000 % 256, 0);
        assert_eq!(landing % 2, 0);
        assert_eq!(inside.coord.x, before.coord.x);
        assert_eq!(inside.coord.y, before.coord.y + Into::<u8, u32>::into(depth) * preset.settlement.spacing);
        assert_eq!(inside.troops.stamina.inline().amount, 150 - (20 + Into::<u8, u64>::into(depth) * 10));
        assert_eq!(resources.resource_balance(essence), after_purchase);
        assert!(!execute_in_game(d, game_id, enter, 351, 351));
        assert_eq!(troops.resolved_explorer(key).unwrap(), inside);
        if depth == 2 {
            // Return the fixture army to the surface spire, then exercise a shallower real entry.
            start_cheat_caller_address(d.games, d.games);
            map.vacate(crate::geometry::tile_key(game_id, inside.coord), explorer_id);
            map
                .occupy(
                    crate::geometry::tile_key(game_id, before.coord),
                    explorer_id,
                    crate::troops::explorer_occupier(inside),
                    false,
                );
            stop_cheat_caller_address(d.games);
            super::resource_commands::set_explorer_fixture(
                d.games, key, crate::troops::ExplorerTroops { coord: before.coord, ..inside },
            );
            assert!(
                execute_in_game(
                    d, game_id, Command::EnterDepth(crate::commands::EnterDepth { explorer_id, depth: 1 }), 351, 351,
                ),
            );
            assert_eq!(structures.structure(home).unwrap().metadata.deepest_depth, 2);
        }
    }
    let balance = resources.resource_balance(essence);
    assert!(
        !execute_in_game(
            d, game_id, Command::Research(crate::research::Research { structure_id: 1, node: 12 }), 351, 351,
        ),
    );
    assert_eq!(resources.resource_balance(essence), balance);
}

#[test]
fn an_army_enters_a_depth_only_from_its_realms_spire_which_turns_each_day() {
    let d = setup();
    let (game_id, preset, category) = expedition_home(d);
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let home = ResourceKey { game_id, entity_id: 1 };
    let record = structures.structure(home).unwrap();
    super::resource_commands::set_fixture(
        d.games,
        selector!("structures"),
        selector!("structures"),
        array![game_id.into(), 1].span(),
        crate::structures::StructureRecord {
            owner: record.owner,
            base: record.base, // The realm's produced resources play no part in depth entry.
            resources_packed: 0,
            metadata: record.metadata,
        },
    );
    snforge_std::interact_with_state(
        d.games,
        || {
            crate::logic::research::write(
                home, crate::research::RealmKnowledge { learned: crate::research::node_bit(10) },
            );
        },
    );
    let start = IGameDispatcher { contract_address: d.games }.game(game_id).start_main_at;
    let spacing = preset.settlement.spacing;
    let spire = crate::expeditions::spire(start, 100, spacing, 1, 351);
    let site = crate::expeditions::site(start, 100, spacing, 1, 351, 0);
    let day: u8 = ((351 / 100 - start / 100) % 6).try_into().unwrap();
    assert_eq!(spire, crate::geometry::neighbor(site, day));
    // The next day's spire stands one step further round that day's ring.
    assert_eq!(
        crate::expeditions::spire(start, 100, spacing, 1, 451),
        crate::geometry::neighbor(crate::expeditions::site(start, 100, spacing, 1, 451, 0), (day + 1) % 6),
    );
    // An army beside the realm's site but two tiles from its spire cannot enter a depth.
    assert!(execute_in_game(d, game_id, muster_command(category, (day + 3) % 6), 351, 351));
    let away = *structures.home_armies(home).at(0);
    let troops = GameState { contract_address: d.games };
    let before = troops.resolved_explorer(ExplorerKey { game_id, explorer_id: away }).unwrap();
    assert!(
        !execute_in_game(
            d, game_id, Command::EnterDepth(crate::commands::EnterDepth { explorer_id: away, depth: 1 }), 352, 352,
        ),
    );
    assert_eq!(troops.resolved_explorer(ExplorerKey { game_id, explorer_id: away }).unwrap(), before);
}

fn setup_frontier_chests() -> (super::Deployment, u32, ExplorerKey) {
    setup_frontier_chests_with_rules(None)
}
fn setup_frontier_chests_with_rules(
    discovery: Option<crate::expeditions::FrontierDiscoveryRules>,
) -> (super::Deployment, u32, ExplorerKey) {
    let (_, frontier) = super::preset_projection::current_definition("frontier");
    setup_frontier_chests_with_payout(
        discovery,
        ChestRules { relic_probability: 10000, ..frontier.economy.chests.unwrap() },
        ChestGround { common: 10000, uncommon: 0, rare: 0, pity: 2 },
    )
}
fn setup_frontier_chests_with_payout(
    discovery: Option<crate::expeditions::FrontierDiscoveryRules>, chests: ChestRules, ground: ChestGround,
) -> (super::Deployment, u32, ExplorerKey) {
    let d = setup();
    let mut preset = definition(true);
    preset.rules.entry_rule = crate::rules::ENTRY_OPEN;
    preset.rules.epoch_seconds = 100;
    preset
        .economy
        .discovery =
            Some(
                crate::expeditions::FrontierDiscoveryRules {
                    camp_bps: 1,
                    rift_bps: 0,
                    fallen_realm_bps: 0,
                    loose_chest_bps: 8000,
                    shrine_bps: 0,
                    well_bps: 0,
                    empty_reveal_limit: 7,
                },
            );
    preset.rules.map_config.camp_win_probability = 0;
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset
        .economy
        .progression =
            Some(
                crate::progression::ArmyProgressionRules {
                    level_step_xp: 1000, ..super::preset_projection::frontier_progression_rules(),
                },
            );
    preset
        .rules
        .command_mask = (*read_txt(@FileTrait::new("tests/fixtures/frontier-command-mask.txt")).at(0))
        .try_into()
        .unwrap();
    preset.rules.mode_rules = DISCOVER_CAMPS
        | crate::rules::UNOWNED_TARGETS
        | HOME_REWARDS
        | DISCOVER_CHESTS
        | crate::rules::REVEAL_SUPPLIES
        | crate::rules::DEPTH_CONTENTS;
    preset.exploration = array![].span();
    preset.settlement.spacing = 1024;
    preset.rules.troop_limit_config.starting_guard = 0;
    preset.rules.troop_limit_config.settlement_armies = 2;
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.rules.map_config.shards_mines_fail_probability = 1;
    preset.rules.troop_stamina_config.stamina_initial = 150;
    preset.rules.troop_stamina_config.stamina_knight_max = 150;
    preset.rules.troop_stamina_config.stamina_gain_per_tick = 0;
    preset.rules.troop_stamina_config.stamina_explore_stamina_cost = 1;
    preset.rules.battle_config.cooldown_seconds = 0;
    preset.rules.battle_config.regular_immunity_ticks = 0;
    let mut depths = array![];
    for _depth in 0_u16..4 {
        depths
            .append(
                crate::expeditions::DepthRules {
                    fallen_guard_lower: 2000,
                    fallen_guard_upper: 4000,
                    guard_step: 1,
                    fallen_guard_tier: crate::troops::TroopTier::T1,
                    reveal_percent: 1,
                    guard_lower: 1,
                    guard_upper: 1,
                    reveal_site_neighbors: false,
                    entry_stamina: 0,
                    chest: ground,
                },
            );
    }
    preset.settlement.depths = depths.span();
    preset.economy.chests = Some(chests);
    preset.economy.relics = array![].span();
    if let Some(discovery) = discovery {
        preset.economy.discovery = Some(discovery);
    }
    registry(d).register_preset(1, preset);
    let game_id = registry(d)
        .create_game(
            CreateGameParams { dev_mode_on: true, end_grace_seconds: 0, duration_seconds: 500, ..params(false) },
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
    resources
        .grant_resource(
            home,
            26,
            10 * RESOURCE_PRECISION,
            350,
            crate::commands::resource_context(
                crate::commands::ExecutionContext { timestamp: 350, ..crate::tests::context(d.games, (home).game_id) },
            ),
        );
    stop_cheat_caller_address(d.games);
    let muster = Command::CreateExplorer(
        CreateExplorer { structure_id: 1, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction: 0 },
    );
    assert!(execute_in_game(d, game_id, muster, 351, 351));
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let explorer_id = *structures.home_armies(home).at(0);
    (d, game_id, ExplorerKey { game_id, explorer_id })
}

fn chest_reveal_time(d: super::Deployment, key: ExplorerKey, from: u64) -> u64 {
    let context = crate::tests::context(d.games, key.game_id);
    let mut root = context.raw_root;
    let seed = crate::random::game_root(ref root, key.game_id, context.game.unbox().seed);
    let rules = snforge_std::interact_with_state(
        d.games, || crate::logic::preset_record::for_game(key.game_id).discovery_rules.read().unwrap(),
    );
    for timestamp in from..from + 20 {
        if crate::discovery::frontier(rules, 1, 0, seed, timestamp) == crate::discovery::Discovery::Chest {
            return timestamp;
        }
    }
    panic!("fixture needs a chest draw")
}

#[test]
fn frontier_closed_chest_persists_opens_once_and_rejects_pending_maxed_and_expired_armies() {
    let (d, game_id, key) = setup_frontier_chests();
    let time = chest_reveal_time(d, key, 360);
    let army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    let coord = crate::geometry::neighbor(army.coord, 0);
    let tile = crate::geometry::tile_key(game_id, coord);
    let progress_before = snforge_std::interact_with_state(d.games, || crate::logic::progression::require(key));
    let mut spy = snforge_std::spy_events();
    assert!(
        execute_in_game(
            d, game_id, Command::Explore(Explore { explorer_id: key.explorer_id, direction: 0 }), time, time,
        ),
    );
    let closed = snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile).unwrap());
    assert_eq!(closed.category, crate::map::CHEST_OCCUPIER);
    assert!(!closed.is_structure);
    assert_eq!(GameState { contract_address: d.games }.resolved_explorer(key).unwrap().coord, army.coord);
    let progress = snforge_std::interact_with_state(d.games, || crate::logic::progression::require(key));
    assert!(progress.pending.is_none());
    assert_eq!(progress.level, progress_before.level);
    // Reads at the end of the day see the same closed occupancy, without a transaction.
    start_cheat_block_timestamp_global(399);
    assert_eq!(snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile).unwrap()), closed);
    let open = Command::OpenRelicChest(crate::relics::OpenChest { explorer_id: key.explorer_id, coord });
    let offer = crate::progression::AttributeOffer {
        id: 77,
        source: crate::progression::OfferSource::Level,
        amount: 1,
        choices: array![crate::progression::Attribute::Battle].span(),
    };
    snforge_std::interact_with_state(
        d.games,
        || crate::logic::progression::write(key, crate::progression::ArmyProgress { pending: Some(offer), ..progress }),
    );
    assert!(!execute_in_game(d, game_id, open, 399, 399));
    snforge_std::interact_with_state(
        d.games,
        || crate::logic::progression::write(
            key, crate::progression::ArmyProgress { battle: 5, logistics: 5, scouting: 5, support: 5, ..progress },
        ),
    );
    assert!(!execute_in_game(d, game_id, open, 399, 399));
    assert_eq!(snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile).unwrap()), closed);
    snforge_std::interact_with_state(d.games, || crate::logic::progression::write(key, progress));
    assert!(execute_in_game(d, game_id, open, 399, 399));
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile)).is_none());
    choose_pending_attribute(d, game_id, key.explorer_id, 399);
    assert!(!execute_in_game(d, game_id, open, 399, 399));
    // A different unopened chest becomes inaccessible at the epoch boundary.
    let expired_coord = crate::geometry::neighbor(army.coord, 1);
    let expired_tile = crate::geometry::tile_key(game_id, expired_coord);
    snforge_std::interact_with_state(
        d.games, || crate::logic::map::MapState::occupy(expired_tile, 9999, crate::map::CHEST_OCCUPIER, false),
    );
    assert!(
        !execute_in_game(
            d,
            game_id,
            Command::OpenRelicChest(crate::relics::OpenChest { explorer_id: key.explorer_id, coord: expired_coord }),
            400,
            400,
        ),
    );
    assert_eq!(
        snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(expired_tile).unwrap()).category,
        crate::map::CHEST_OCCUPIER,
    );
    let mut rewards = 0;
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if event.keys.len() > 1 && *event.keys.at(1) == selector!("StoryEvent") {
            let mut keys = event.keys.span().slice(2, event.keys.len() - 2);
            let mut data = event.data.span();
            let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
            if let crate::ownership::Story::ChestReward(reward) = story.story {
                rewards += 1;
                assert_eq!(reward.explorer_id, key.explorer_id);
                assert_eq!(reward.epoch, 3);
                assert_eq!(story.timestamp, 399);
            }
        }
    }
    assert_eq!(rewards, 1);
}

#[test]
fn frontier_fallen_realm_capture_places_exactly_one_closed_chest_without_paying_it() {
    let (d, game_id, key) = setup_frontier_chests();
    let state = GameState { contract_address: d.games };
    let mut army = state.resolved_explorer(key).unwrap();
    army.troops.count = 100000 * RESOURCE_PRECISION;
    super::resource_commands::set_explorer_fixture(d.games, key, army);
    start_cheat_caller_address(d.games, d.games);
    IResourceOperationsDispatcher { contract_address: d.games }
        .change_explorer_capacity(
            ResourceKey { game_id, entity_id: key.explorer_id },
            99999 * RESOURCE_PRECISION,
            true,
            crate::commands::resource_context(crate::tests::context(d.games, game_id)),
        );
    stop_cheat_caller_address(d.games);
    let coord = crate::geometry::neighbor(army.coord, 0);
    let context = crate::commands::ExecutionContext { timestamp: 360, ..crate::tests::context(d.games, game_id) };
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, d.games);
    let site = structures
        .create_discovery(
            game_id,
            coord,
            crate::discovery::Discovery::FallenRealm,
            123,
            360,
            crate::commands::action_context(context),
        );
    stop_cheat_caller_address(d.games);
    let site_key = ResourceKey { game_id, entity_id: site };
    let initial = snforge_std::interact_with_state(
        d.games, || crate::logic::expeditions::expedition_site(site_key).unwrap(),
    );
    assert_eq!(initial.kind, crate::expeditions::SiteKind::FallenRealm);
    assert!(
        initial.initial_guard_count >= 2000
            * RESOURCE_PRECISION && initial.initial_guard_count <= 4000
            * RESOURCE_PRECISION,
    );
    let mut spy = snforge_std::spy_events();
    let captured = execute_in_game(
        d,
        game_id,
        Command::BattleGuard(crate::commands::Battle { attacker_id: key.explorer_id, defender_id: site }),
        361,
        361,
    );
    let outcome = IRecordedExecutionViewsDispatcher { contract_address: d.games }
        .recorded_outcome(game_id.into(), super::recorded::head(d.games, game_id).order)
        .unwrap();
    assert!(captured, "{}", outcome.reason);
    let tile = crate::geometry::tile_key(game_id, coord);
    let closed = snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile).unwrap());
    assert_eq!(closed.category, crate::map::CHEST_OCCUPIER);
    assert_eq!(closed.entity_id, site);
    assert!(!closed.is_structure);
    assert!(
        snforge_std::interact_with_state(d.games, || crate::logic::expeditions::expedition_site(site_key).unwrap())
            .cleared,
    );
    let mut payouts = 0;
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(0) == selector!("StoryEvent") {
            let mut keys = event.keys.span().slice(1, event.keys.len() - 1);
            let mut data = event.data.span();
            let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
            if let crate::ownership::Story::SitePayout(payout) = story.story {
                payouts += 1;
                assert_eq!(payout.kind, crate::expeditions::SiteKind::FallenRealm);
                assert!(payout.reward.is_none());
            }
        } else if event.keys.len() > 1 && *event.keys.at(1) == selector!("StoryEvent") {
            let mut keys = event.keys.span().slice(2, event.keys.len() - 2);
            let mut data = event.data.span();
            let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
            if let crate::ownership::Story::ChestReward(_) = story.story {
                panic!("capture auto-paid chest");
            }
        }
    }
    assert_eq!(payouts, 1);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::OpenRelicChest(crate::relics::OpenChest { explorer_id: key.explorer_id, coord }),
            362,
            362,
        ),
    );
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile)).is_none());
}

#[test]
fn creation_emits_release_and_overrides_without_per_game_configuration_rows() {
    let d = setup();
    let preset = definition(true);
    registry(d).register_preset(1, preset);
    let mut spy = snforge_std::spy_events();
    let game_id = registry(d).create_game(params(true));
    let events = spy.get_events().emitted_by(d.games);
    let mut count = 0;
    let mut overrides_count = 0;
    for (_, event) in events.events {
        if event.keys.span() == array![selector!("GameEvent"), selector!("RowSet"), 1, 'GameRelease'].span() {
            assert_eq!(event.data.span(), array![1, game_id.into(), 2, 1, crate::presets::commitment(preset)].span());
            count += 1;
        }
        if event.keys.span() == array![selector!("GameEvent"), selector!("RowSet"), 1, 'GameOverrides'].span() {
            assert_eq!(*event.data.at(0), 1);
            assert_eq!(*event.data.at(1), game_id.into());
            let mut values = event.data.span().slice(3, event.data.len() - 3);
            assert_eq!(*event.data.at(2), values.len().into());
            let overrides: crate::game::GameOverrides = Serde::deserialize(ref values).unwrap();
            assert!(values.is_empty());
            assert_eq!(overrides.registration_start, params(true).registration_start);
            assert_eq!(overrides.biome_climate, params(true).biome_climate);
            assert_eq!(overrides.map, params(true).map_override);
            assert_eq!(overrides.map_center_offset, crate::registrar::map_center_offset(game_id, params(true).seed));
            overrides_count += 1;
        }
        for model in array![
            'SliceRules', 'ResourceRule', 'ProductionRecipe', 'BuildingRule', 'UpgradeRecipe', 'GameSequence',
            'EntitySequence',
        ] {
            for key in event.keys.span() {
                assert!(*key != model, "per-game configuration row emitted");
            }
        }
    }
    assert_eq!(count, 1);
    assert_eq!(overrides_count, 1);
}

#[test]
fn creator_and_non_creator_roster_batches_produce_the_same_settlements() {
    let creator_run = setup();
    let (helper_account, _) = super::deploy_player(3, super::GUARDIAN);
    let helper_run = super::Deployment { actor: helper_account, ..setup() };
    let preset = definition(true);
    let request = CreateGameParams { roster: roster(1), ..params(true) };
    registry(creator_run).register_preset(1, preset);
    registry(helper_run).register_preset(1, preset);
    let game_id = registry(creator_run).create_game(request);
    assert_eq!(registry(helper_run).create_game(request), game_id);
    let creator_games = IGameDispatcher { contract_address: creator_run.games };
    let helper_games = IGameDispatcher { contract_address: helper_run.games };
    let game = creator_games.game(game_id);
    // The creator is an ordinary game account, distinct from the shard administrator.
    let game = crate::game::GameRegistry { creator: creator_run.actor, ..game };
    for d in array![creator_run, helper_run] {
        super::resource_commands::set_fixture(
            d.games, selector!("games"), selector!("games"), array![game_id.into()].span(), game,
        );
    }
    assert!(helper_run.actor != game.creator);
    let creator_views = ISettlementViewsDispatcher { contract_address: creator_run.games };
    let helper_views = ISettlementViewsDispatcher { contract_address: helper_run.games };
    for batch in 0_u64..2 {
        let context = crate::commands::ActionContext { raw_root: 98765, timestamp: 205 + batch };
        let cursor = crate::ownership::StoryCursor { order: batch + 1, index: 0 };
        start_cheat_caller_address(creator_run.games, creator_run.games);
        let remaining = ISettlementCommandsDispatcher { contract_address: creator_run.games }
            .settle_blitz_roster(game_id, creator_run.actor, context, cursor);
        start_cheat_caller_address(helper_run.games, helper_run.games);
        assert_eq!(
            ISettlementCommandsDispatcher { contract_address: helper_run.games }
                .settle_blitz_roster(game_id, helper_run.actor, context, cursor),
            remaining,
        );
        assert_eq!(creator_views.blitz_settlement_order(game_id), helper_views.blitz_settlement_order(game_id));
        assert_eq!(creator_views.settlement_progress(game_id), helper_views.settlement_progress(game_id));
        assert_eq!(creator_games.game(game_id), helper_games.game(game_id));
    }
    let next = next_entity(creator_run, game_id);
    assert_eq!(next, next_entity(helper_run, game_id));
    for entity_id in 1..next {
        let key = ResourceKey { game_id, entity_id };
        let creator = IStructureOperationsDispatcher { contract_address: creator_run.games }.structure(key);
        let helper = IStructureOperationsDispatcher { contract_address: helper_run.games }.structure(key);
        assert_eq!(creator, helper);
    }
}


fn next_entity(d: super::Deployment, game_id: u32) -> u32 {
    snforge_std::interact_with_state(d.games, || crate::state::read().games.next_entity.read(game_id))
}

#[test]
fn frontier_refuses_off_map_economy_commands_before_reading_positions() {
    let d = setup();
    let mut preset = definition(false);
    preset.rules.epoch_seconds = 86400;
    preset.economy.discovery = Some(super::preset_projection::frontier_discovery_rules());
    let (_, frontier) = super::preset_projection::current_definition("frontier");
    preset.economy.chests = frontier.economy.chests;
    preset.economy.relics = array![].span();
    preset.settlement.depths = frontier.settlement.depths;
    preset.rules.mode_rules = preset.rules.mode_rules | crate::rules::DEPTH_CONTENTS;
    preset.rules.map_config.camp_win_probability = 0;
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.economy.progression = Some(super::preset_projection::frontier_progression_rules());
    preset.settlement.spacing = 1024;
    preset
        .rules
        .command_mask = (*read_txt(@FileTrait::new("tests/fixtures/frontier-command-mask.txt")).at(0))
        .try_into()
        .unwrap();
    registry(d).register_preset(1, preset);
    let game_id = registry(d).create_game(params(false));
    let transfer = crate::resources::ResourceTransfer {
        from_entity_id: 1, to_entity_id: 2, resources: array![].span(),
    };
    let swap = crate::market::Swap { bank_id: 2, structure_id: 1, resource_type: 1, amount: 1 };
    for command in array![
        Command::CreateTradeOrder(
            crate::trade::CreateOrder {
                maker_id: 1,
                taker_id: 2,
                offered_resource: 1,
                requested_resource: 2,
                offered_per_lot: 1,
                requested_per_lot: 1,
                lots: 1,
                expires_at: 399,
            },
        ),
        Command::AcceptTradeOrder(crate::trade::AcceptOrder { trade_id: 1, taker_id: 2, lots: 1 }),
        Command::CancelTradeOrder(1), Command::BuyFromBank(swap), Command::SellToBank(swap),
        Command::AddBankLiquidity(
            crate::market::AddLiquidity {
                bank_id: 2, structure_id: 1, resource_type: 1, resource_amount: 1, lords_amount: 1,
            },
        ),
        Command::RemoveBankLiquidity(
            crate::market::RemoveLiquidity { bank_id: 2, structure_id: 1, resource_type: 1, shares: 1 },
        ),
        Command::SendResources(transfer), Command::TransferStructureResourcesToExplorer(transfer),
        Command::TransferExplorerResourcesToStructure(transfer),
        Command::WithdrawResource(
            crate::bridge::Withdraw {
                structure_id: 1, recipient: d.actor, resource_type: 1, amount: 1, client_fee_recipient: d.actor,
            },
        ),
    ] {
        assert!(!execute_in_game(d, game_id, command, 350, 350));
        let result = IRecordedExecutionViewsDispatcher { contract_address: d.games }
            .recorded_outcome(game_id.into(), super::recorded::head(d.games, game_id).order)
            .unwrap();
        assert_eq!(result.status_class, 'COMMAND_DISABLED');
    }
}

#[test]
fn expedition_slot_reuse_preserves_its_bar_and_midnight_allocates_a_fresh_bar() {
    let d = setup();
    let (game_id, preset, category) = expedition_home(d);
    let (first, second) = expedition_armies(d, game_id, category);
    let slot_key = crate::troops::ArmySlotKey { game_id, structure_id: 1, epoch: 3, slot: 0 };
    let read_slot = |key| snforge_std::interact_with_state(d.games, || crate::logic::army_slot_storage::read(key));
    let troops = GameState { contract_address: d.games };
    assert_eq!(troops.explorer(first).unwrap().troops.stamina, crate::troops::StaminaSource::Slot(0));
    assert_eq!(troops.explorer(second).unwrap().troops.stamina, crate::troops::StaminaSource::Slot(1));
    assert_eq!(read_slot(slot_key).unwrap().explorer_id, first.explorer_id);
    assert!(read_slot(crate::troops::ArmySlotKey { slot: 2, ..slot_key }).is_none());
    let mut tired = troops.resolved_explorer(first).unwrap();
    tired.troops.stamina.set_amount(7);
    super::resource_commands::set_explorer_fixture(d.games, first, tired);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::ManageTroops(crate::troop_management::ManageTroops::RemoveExplorer(first.explorer_id)),
            351,
            351,
        ),
    );
    assert_eq!(read_slot(slot_key).unwrap().explorer_id, 0);
    assert_eq!(read_slot(slot_key).unwrap().stamina.amount, 7);
    assert!(execute_in_game(d, game_id, muster_command(category, 0), 351, 351));
    let replacement = read_slot(slot_key).unwrap().explorer_id;
    assert!(replacement != first.explorer_id && replacement != 0);
    assert_eq!(read_slot(slot_key).unwrap().stamina.amount, 7);
    assert_eq!(read_slot(crate::troops::ArmySlotKey { slot: 1, ..slot_key }).unwrap().explorer_id, second.explorer_id);
    assert!(execute_in_game(d, game_id, muster_command(category, 0), 400, 400));
    let next = read_slot(crate::troops::ArmySlotKey { epoch: 4, ..slot_key }).unwrap();
    assert!(next.explorer_id != replacement && next.explorer_id != 0);
    assert_eq!(next.stamina.amount, preset.rules.troop_stamina_config.stamina_initial.into());
    assert_eq!(read_slot(slot_key).unwrap().stamina.amount, 7);
    assert_eq!(read_slot(slot_key).unwrap().explorer_id, 0);
    assert!(troops.explorer(ExplorerKey { game_id, explorer_id: replacement }).is_none());
}

#[test]
fn expedition_death_releases_the_slot_with_the_final_battle_bar() {
    let d = setup();
    let (game_id, _, category) = expedition_home(d);
    let (first, _) = expedition_armies(d, game_id, category);
    let key = crate::troops::ArmySlotKey { game_id, structure_id: 1, epoch: 3, slot: 0 };
    let troops = GameState { contract_address: d.games };
    let mut defeated = troops.resolved_explorer(first).unwrap();
    let before = defeated.troops.count;
    defeated.troops.count = 0;
    defeated.troops.stamina.set_amount(2);
    let defeated = defeated;
    let context = crate::commands::ActionContext { raw_root: 1, timestamp: 351 };
    let class_hash = super::declare_logic("TroopsLogic");
    snforge_std::interact_with_state(
        d.games,
        || {
            IBattleResolutionLibraryDispatcher { class_hash }.finish_battle(first, defeated, before, context);
        },
    );
    let vacant = snforge_std::interact_with_state(d.games, || crate::logic::army_slot_storage::read(key)).unwrap();
    assert_eq!(vacant.explorer_id, 0);
    assert_eq!(vacant.stamina.amount, 2);
    assert!(troops.explorer(first).is_none());
    assert!(execute_in_game(d, game_id, muster_command(category, 0), 352, 352));
    let reused = snforge_std::interact_with_state(d.games, || crate::logic::army_slot_storage::read(key)).unwrap();
    assert!(reused.explorer_id != first.explorer_id && reused.explorer_id != 0);
    assert_eq!(reused.stamina, vacant.stamina);
}

fn choose_pending_attribute(d: super::Deployment, game_id: u32, explorer_id: u32, timestamp: u64) {
    let progress = snforge_std::interact_with_state(
        d.games, || crate::logic::progression::require(ExplorerKey { game_id, explorer_id }),
    );
    if let Some(offer) = progress.pending {
        let mut choice = *offer.choices.at(0);
        for attribute in offer.choices {
            if crate::progression::attribute_level(
                progress, *attribute,
            ) < crate::progression::attribute_level(progress, choice) {
                choice = *attribute;
            }
        }
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::ChooseAttribute(
                    crate::progression::ChooseAttribute { explorer_id, offer_id: offer.id, attribute: choice },
                ),
                timestamp,
                timestamp,
            ),
        );
    }
}

#[test]
fn frontier_floor_counts_seven_player_reveals_across_armies_and_depths_then_resets_at_midnight() {
    let discovery = super::preset_projection::frontier_discovery_rules();
    let (d, game_id, first) = setup_frontier_chests_with_rules(Some(discovery));
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::CreateExplorer(
                CreateExplorer { structure_id: 1, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction: 1 },
            ),
            352,
            352,
        ),
    );
    let home = ResourceKey { game_id, entity_id: 1 };
    let second = ExplorerKey {
        game_id, explorer_id: *IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home).at(1),
    };
    let counter = crate::expeditions::ExpeditionDiscoveryKey { game_id, structure_id: 1, epoch: 3 };
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::expeditions::discovery(counter)).is_none());
    let context = crate::tests::context(d.games, game_id);
    let mut root = context.raw_root;
    let seed = crate::random::game_root(ref root, game_id, context.game.unbox().seed);
    let mut time = 353_u64;
    for index in 0_u8..8 {
        let key = if index % 2 == 0 {
            first
        } else {
            second
        };
        let mut army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
        let centre = crate::expeditions::site(context.game.unbox().start_main_at, 100, 1024, 1, time, index % 4);
        army.coord = crate::troops::Coord { x: centre.x + 20 + Into::<u8, u32>::into(index) * 3, ..centre };
        let location = crate::geometry::tile_key(game_id, army.coord);
        snforge_std::interact_with_state(d.games, || crate::logic::map::MapState::reveal(location, 1));
        super::resource_commands::set_explorer_fixture(d.games, key, army);
        // Terrain-only revelations (home/site surroundings) never count towards the floor.
        assert_eq!(
            snforge_std::interact_with_state(d.games, || crate::logic::expeditions::discovery(counter))
                .map(|row| row.empty_reveals)
                .unwrap_or(0),
            index,
        );
        while index < 7
            && crate::discovery::frontier(discovery, 1, index, seed, time) != crate::discovery::Discovery::None {
            time += 1;
        }
        assert!(time < 399);
        assert!(
            execute_in_game(
                d, game_id, Command::Explore(Explore { explorer_id: key.explorer_id, direction: 0 }), time, time,
            ),
        );
        let count = snforge_std::interact_with_state(
            d.games, || crate::logic::expeditions::discovery(counter).unwrap().empty_reveals,
        );
        assert_eq!(count, if index < 7 {
            index + 1
        } else {
            0
        });
        let tile = crate::geometry::tile_key(game_id, crate::geometry::neighbor(army.coord, 0));
        if index == 7 {
            let occupied = snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile).unwrap());
            assert!(occupied.is_structure);
            assert!(
                snforge_std::interact_with_state(
                    d.games,
                    || crate::logic::expeditions::expedition_site(
                        ResourceKey { game_id, entity_id: occupied.entity_id },
                    ),
                )
                    .is_some(),
            );
        }
        time += 1;
    }
    assert!(
        snforge_std::interact_with_state(
            d.games,
            || crate::logic::expeditions::discovery(crate::expeditions::ExpeditionDiscoveryKey { epoch: 4, ..counter }),
        )
            .is_none(),
    );
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::CreateExplorer(
                CreateExplorer { structure_id: 1, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction: 0 },
            ),
            400,
            400,
        ),
    );
    let third = *IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home).at(0);
    let mut time = 401;
    while crate::discovery::frontier(discovery, 1, 0, seed, time) != crate::discovery::Discovery::None {
        time += 1;
    }
    assert!(execute_in_game(d, game_id, Command::Explore(Explore { explorer_id: third, direction: 0 }), time, time));
    assert_eq!(
        snforge_std::interact_with_state(
            d.games,
            || crate::logic::expeditions::discovery(crate::expeditions::ExpeditionDiscoveryKey { epoch: 4, ..counter })
                .unwrap()
                .empty_reveals,
        ),
        1,
    );
}

#[test]
fn frontier_lords_commitment_and_exhaustion_are_atomic_and_keep_the_rolled_quality() {
    let (_, preset) = super::preset_projection::current_definition("frontier");
    let chests = ChestRules { relic_probability: 0, ..preset.economy.chests.unwrap() };
    let allowance = crate::relics::lords_allowance(chests, 0);
    let amount = chests.lords_amounts.rare;
    for committed in array![0, allowance - amount, allowance - amount + 1, allowance] {
        let exhausted = committed + amount > allowance;
        let (d, game_id, key) = setup_frontier_chests_with_payout(
            None, chests, ChestGround { common: 0, uncommon: 0, rare: 10000, pity: 2 },
        );
        let relics = IRelicsDispatcher { contract_address: d.games };
        assert_eq!(relics.lords_budget(game_id).unwrap().lords_committed, 0);
        let army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
        let coord = crate::geometry::neighbor(army.coord, 0);
        let tile = crate::geometry::tile_key(game_id, coord);
        let actor = d.actor;
        snforge_std::interact_with_state(
            d.games,
            || {
                let state = crate::state::write();
                state.relics.chest_pity.write((game_id, actor, 0), 1);
                state.relics.lords_committed.write(game_id, Some(committed));
                if crate::logic::map::tile(tile).is_none() {
                    crate::logic::map::MapState::reveal(tile, 1);
                }
                crate::logic::map::MapState::occupy(tile, 9999, crate::map::CHEST_OCCUPIER, false);
            },
        );
        let mut spy = snforge_std::spy_events();
        let open = Command::OpenRelicChest(crate::relics::OpenChest { explorer_id: key.explorer_id, coord });
        assert!(execute_in_game(d, game_id, open, 360, 360));
        let expected = if exhausted {
            committed
        } else {
            committed + amount
        };
        assert_eq!(relics.lords_budget(game_id).unwrap().lords_committed, expected);
        assert_eq!(relics.chest_tokens(game_id, actor, 3), if exhausted {
            0
        } else {
            1
        });
        assert_eq!(relics.chest_pity(game_id, actor, 0), 1);
        let progress = snforge_std::interact_with_state(d.games, || crate::logic::progression::require(key));
        if exhausted {
            let offer = progress.pending.unwrap();
            assert_eq!(offer.amount, 3);
            assert_eq!(offer.source, crate::progression::OfferSource::Relic);
        } else {
            assert!(progress.pending.is_none());
        }
        assert!(!execute_in_game(d, game_id, open, 361, 361));
        let mut rewards = 0;
        for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
            if event.keys.len() > 1 && *event.keys.at(1) == selector!("StoryEvent") {
                let mut keys = event.keys.span().slice(2, event.keys.len() - 2);
                let mut data = event.data.span();
                let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
                if let crate::ownership::Story::ChestReward(reward) = story.story {
                    rewards += 1;
                    assert_eq!(reward.quality, 2);
                    assert_eq!(reward.lords_exhausted, exhausted);
                    assert_eq!(reward.kind, if exhausted {
                        ChestKind::Relic
                    } else {
                        ChestKind::Token
                    });
                }
            }
        }
        assert_eq!(rewards, 1);
        if !exhausted {
            let capped_coord = crate::geometry::neighbor(army.coord, 1);
            place_frontier_chest_fixture(d, game_id, capped_coord, 9998);
            let mut cap_spy = snforge_std::spy_events();
            assert!(
                execute_in_game(
                    d,
                    game_id,
                    Command::OpenRelicChest(
                        crate::relics::OpenChest { explorer_id: key.explorer_id, coord: capped_coord },
                    ),
                    362,
                    362,
                ),
            );
            assert_eq!(relics.lords_budget(game_id).unwrap().lords_committed, expected);
            assert_eq!(relics.chest_tokens(game_id, actor, 3), 1);
            let mut capped_rewards = 0;
            for (_, event) in cap_spy.get_events().emitted_by(d.games).events.span() {
                if event.keys.len() > 1 && *event.keys.at(1) == selector!("StoryEvent") {
                    let mut keys = event.keys.span().slice(2, event.keys.len() - 2);
                    let mut data = event.data.span();
                    let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
                    if let crate::ownership::Story::ChestReward(reward) = story.story {
                        capped_rewards += 1;
                        assert_eq!(reward.kind, ChestKind::Relic);
                        assert!(!reward.lords_exhausted);
                        assert_eq!(reward.quality, 3);
                    }
                }
            }
            assert_eq!(capped_rewards, 1);
        }
        start_cheat_block_timestamp_global(400);
        assert_eq!(relics.lords_budget(game_id).unwrap().lords_committed, expected);
        assert_eq!(relics.chest_tokens(game_id, actor, 4), 0);
        let today_id = next_entity(d, game_id);
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::CreateExplorer(
                    CreateExplorer { structure_id: 1, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction: 0 },
                ),
                400,
                400,
            ),
        );
        let today = GameState { contract_address: d.games }
            .resolved_explorer(ExplorerKey { game_id, explorer_id: today_id })
            .unwrap();
        let today_chest = crate::geometry::neighbor(today.coord, 0);
        place_frontier_chest_fixture(d, game_id, today_chest, 9997);
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::OpenRelicChest(crate::relics::OpenChest { explorer_id: today_id, coord: today_chest }),
                401,
                401,
            ),
        );
        assert_eq!(relics.lords_budget(game_id).unwrap().lords_committed, expected + chests.lords_amounts.rare);
        assert_eq!(relics.chest_tokens(game_id, actor, 4), 1);
        assert_eq!(crate::relics::lords_allowance(chests, 1) - expected, 28571 - expected);
    }
}

fn place_frontier_chest_fixture(d: super::Deployment, game_id: u32, coord: crate::troops::Coord, id: u32) {
    let tile = crate::geometry::tile_key(game_id, coord);
    snforge_std::interact_with_state(
        d.games,
        || {
            if crate::logic::map::tile(tile).is_none() {
                crate::logic::map::MapState::reveal(tile, 1);
            }
            crate::logic::map::MapState::occupy(tile, id, crate::map::CHEST_OCCUPIER, false);
        },
    );
}

#[test]
fn frontier_sites_store_the_seeded_category_and_depth_tier_with_the_count_basis() {
    let d = setup();
    let (preset_id, preset) = super::preset_projection::current_definition("frontier");
    registry(d).register_preset(preset_id, preset);
    let game_id = registry(d).create_game(CreateGameParams { preset_id, ..params(false) });
    let context = crate::commands::ExecutionContext { timestamp: 360, ..crate::tests::context(d.games, game_id) };
    start_cheat_caller_address(d.games, d.games);
    for depth_index in 0_u32..4 {
        let depth = *preset.settlement.depths.at(depth_index);
        for (discovery, kind, offset) in array![
            (crate::discovery::Discovery::Camp, crate::expeditions::SiteKind::Camp, 0_u32),
            (crate::discovery::Discovery::Mine, crate::expeditions::SiteKind::Rift, 1),
            (crate::discovery::Discovery::FallenRealm, crate::expeditions::SiteKind::FallenRealm, 2),
        ] {
            let coord = crate::troops::Coord {
                alt: false, x: 100 + offset, y: depth_index * preset.settlement.spacing + preset.settlement.spacing / 2,
            };
            let seed = 123 + Into::<u32, u256>::into(offset);
            let id = IStructureOperationsDispatcher { contract_address: d.games }
                .create_discovery(game_id, coord, discovery, seed, 360, crate::commands::action_context(context));
            let guard = IGuardsDispatcher { contract_address: d.games }
                .guard(GuardKey { game_id, structure_id: id, slot: 0 });
            let expected = crate::troops::frontier_guard(kind, depth, seed, context.rules.unbox(), 360);
            assert_eq!(guard.troops, expected);
            let site = snforge_std::interact_with_state(
                d.games,
                || {
                    crate::logic::expeditions::expedition_site(ResourceKey { game_id, entity_id: id }).unwrap()
                },
            );
            assert_eq!(site.initial_guard_count, expected.count);
            assert_eq!(site.kind, kind);
        }
    }
}

#[test]
fn frontier_shrine_and_well_persist_once_and_use_the_public_progress_and_slot() {
    let d = setup();
    let (game_id, _, category) = expedition_home(d);
    let (key, _) = expedition_armies(d, game_id, category);
    let army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    let coord = crate::geometry::neighbor(army.coord, 0);
    let tile = crate::geometry::tile_key(game_id, coord);
    let command = Command::InteractSite(crate::relics::InteractSite { explorer_id: key.explorer_id, coord });
    snforge_std::interact_with_state(
        d.games,
        || {
            crate::logic::progression::write(
                key, crate::progression::ArmyProgress { xp: 7, ..crate::progression::initial() },
            );
            crate::logic::map::MapState::reveal(tile, 1);
            crate::logic::map::MapState::occupy(tile, 900, crate::map::SHRINE_OCCUPIER, false);
        },
    );
    let closed = snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile).unwrap());
    start_cheat_block_timestamp_global(360);
    assert_eq!(snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile).unwrap()), closed);
    assert!(execute_in_game(d, game_id, command, 360, 360));
    let progress = snforge_std::interact_with_state(d.games, || crate::logic::progression::require(key));
    assert_eq!(progress.level, 2);
    assert_eq!(progress.xp, 7);
    assert_eq!(progress.pending.unwrap().source, crate::progression::OfferSource::Shrine);
    assert_eq!(progress.pending.unwrap().amount, 1);
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile)).is_none());
    assert!(!execute_in_game(d, game_id, command, 360, 360));
    snforge_std::interact_with_state(
        d.games, || crate::logic::map::MapState::occupy(tile, 901, crate::map::SHRINE_OCCUPIER, false),
    );
    assert!(!execute_in_game(d, game_id, command, 360, 360));
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile)).is_some());
    snforge_std::interact_with_state(
        d.games,
        || {
            crate::logic::progression::write(
                key,
                crate::progression::ArmyProgress {
                    pending: None, battle: 5, logistics: 5, scouting: 5, support: 5, ..progress,
                },
            );
        },
    );
    assert!(!execute_in_game(d, game_id, command, 360, 360));
    snforge_std::interact_with_state(
        d.games,
        || {
            crate::logic::map::MapState::vacate(tile, 901);
            crate::logic::map::MapState::occupy(tile, 902, crate::map::WELL_OCCUPIER, false);
            crate::logic::progression::write(key, crate::progression::ArmyProgress { logistics: 3, ..progress });
            let mut army = crate::logic::troops::active_explorer(
                key,
                360,
                crate::commands::load_context(game_id, crate::commands::ActionContext { raw_root: 0, timestamp: 360 }),
            );
            army.troops.stamina.set_amount(10);
            crate::logic::troops::TroopState::save(key, army.into_record());
        },
    );
    // Wells may be used while a pick is pending, and persist into the same occupied slot.
    assert!(execute_in_game(d, game_id, command, 360, 360));
    let filled = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    assert_eq!(filled.troops.stamina.inline().amount, 70);
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile)).is_none());
    assert!(!execute_in_game(d, game_id, command, 360, 360));
    snforge_std::interact_with_state(
        d.games,
        || {
            crate::logic::map::MapState::occupy(tile, 903, crate::map::WELL_OCCUPIER, false);
            let mut army = crate::logic::troops::active_explorer(
                key,
                360,
                crate::commands::load_context(game_id, crate::commands::ActionContext { raw_root: 0, timestamp: 360 }),
            );
            let maximum = crate::progression::stamina_max(
                crate::logic::progression::require(key),
                army.troops.category,
                crate::commands::load_context(game_id, crate::commands::ActionContext { raw_root: 0, timestamp: 360 })
                    .rules
                    .unbox()
                    .troop_stamina_config,
            );
            army.troops.stamina.set_amount(maximum - 5);
            crate::logic::troops::TroopState::save(key, army.into_record());
        },
    );
    let before = GameState { contract_address: d.games }.resolved_explorer(key).unwrap().troops.stamina.inline().amount;
    assert!(execute_in_game(d, game_id, command, 360, 360));
    assert_eq!(
        GameState { contract_address: d.games }.resolved_explorer(key).unwrap().troops.stamina.inline().amount,
        before + 5,
    );
}

#[test]
fn frontier_site_discovery_reads_home_knowledge_and_places_only_tile_occupancy() {
    let d = setup();
    let (game_id, _, category) = expedition_home(d);
    let (key, _) = expedition_armies(d, game_id, category);
    let army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    let home = ResourceKey { game_id, entity_id: army.owner };
    let rules = super::preset_projection::frontier_discovery_rules();
    let map = crate::expeditions::IFrontierDiscoveryLibraryDispatcher { class_hash: super::declare_logic("MapLogic") };
    for (expected, node, category) in array![
        (crate::discovery::Discovery::Shrine, 8_u8, crate::map::SHRINE_OCCUPIER),
        (crate::discovery::Discovery::Well, 9_u8, crate::map::WELL_OCCUPIER),
    ] {
        let enabled = crate::expeditions::FrontierDiscoveryRules {
            shrine_bps: if node == 8 {
                rules.shrine_bps
            } else {
                0
            },
            well_bps: if node == 9 {
                rules.well_bps
            } else {
                0
            },
            ..rules,
        };
        let mut seed = 0_u256;
        while crate::discovery::frontier(enabled, 1, 0, seed, 360) != expected {
            seed += 1;
        }
        let seed = seed;
        let coord = crate::geometry::neighbor(army.coord, 0);
        let tile = crate::geometry::tile_key(game_id, coord);
        let context = crate::commands::ActionContext { raw_root: 0, timestamp: 360 };
        start_cheat_caller_address(d.games, d.games);
        let locked = snforge_std::interact_with_state(
            d.games,
            || crate::expeditions::IFrontierDiscoveryDispatcherTrait::discover_frontier_tile(
                map, tile, key.explorer_id, seed, context,
            ),
        );
        assert!(locked != crate::discovery::Discovery::Shrine && locked != crate::discovery::Discovery::Well);
        snforge_std::interact_with_state(
            d.games,
            || {
                crate::logic::research::write(
                    home, crate::research::RealmKnowledge { learned: crate::research::node_bit(node) },
                );
                crate::logic::expeditions::record_discovery(
                    crate::expeditions::ExpeditionDiscoveryKey { game_id, structure_id: army.owner, epoch: 3 },
                    crate::discovery::Discovery::Chest,
                );
            },
        );
        let found = snforge_std::interact_with_state(
            d.games,
            || crate::expeditions::IFrontierDiscoveryDispatcherTrait::discover_frontier_tile(
                map, tile, key.explorer_id, seed, context,
            ),
        );
        assert_eq!(found, expected);
        stop_cheat_caller_address(d.games);
        let occupancy = snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile).unwrap());
        assert_eq!(occupancy.category, category);
        assert!(!occupancy.is_structure);
        snforge_std::interact_with_state(
            d.games,
            || {
                assert!(
                    crate::logic::structures::structure(ResourceKey { game_id, entity_id: occupancy.entity_id })
                        .is_none(),
                );
                crate::logic::map::MapState::vacate(tile, occupancy.entity_id);
                crate::logic::research::write(home, crate::research::RealmKnowledge { learned: 0 });
            },
        );
    }
}
