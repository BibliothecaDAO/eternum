pub use world_test_support::tests::registrar::*;
use crate::tests::army_merge::{progress, slot, timers, write_progress};

#[test]
#[feature("safe_dispatcher")]
fn launch_rejects_unregistered_presets_before_allocating() {
    let d = setup();
    let preset = definition(false);
    assert!(safe(d, super::authority()).create_game(params(false)).is_err());
    assert!(safe(d, super::authority()).register_preset(0, preset).is_err());
    assert!(safe(d, d.actor).register_preset(1, preset).is_err());
    registry(d).register_preset(1, preset);
    assert_eq!(registry(d).preset_commitment(1), crate::presets::commitment(preset));
    assert!(safe(d, super::authority()).create_game(CreateGameParams { preset_id: 99, ..params(false) }).is_err());
    assert_eq!(registry(d).next_game_id(), 1);
}

#[test]
#[feature("safe_dispatcher")]
fn registered_presets_are_immutable_and_every_game_plays_the_release_numbers() {
    let d = setup();
    let original = definition(false);
    registry(d).register_preset(1, original);
    let old_id = registry(d).create_game(params(false));
    let mut changed = original;
    changed.rules.troop_stamina_config.stamina_explore_stamina_cost += 1;
    assert!(safe(d, d.actor).register_preset(1, changed).is_err());
    assert_eq!(registry(d).preset_commitment(1), crate::presets::commitment(original));
    assert!(safe(d, super::authority()).register_preset(1, original).is_err());
    assert!(safe(d, super::authority()).register_preset(1, changed).is_err());
    assert_eq!(registry(d).preset_commitment(1), crate::presets::commitment(original));
    assert_eq!(registry(d).create_game(params(false)), old_id);
    let next_params = CreateGameParams { name: 'next', ..params(false) };
    assert!(safe(d, super::authority()).create_game(CreateGameParams { preset_id: 101, ..next_params }).is_err());
    let next_original_id = registry(d).create_game(next_params);
    assert!(safe(d, d.actor).register_preset(101, changed).is_err());
    registry(d).register_preset(101, changed);
    assert_eq!(registry(d).preset_commitment(101), crate::presets::commitment(changed));
    let new_id = registry(d).create_game(CreateGameParams { name: 'changed', preset_id: 101, ..params(false) });
    let games = IGameDispatcher { contract_address: d.games };
    for game_id in array![old_id, next_original_id, new_id] {
        assert_eq!(
            games.rules(game_id).troop_stamina_config.stamina_explore_stamina_cost,
            crate::balance::rules::TROOP_STAMINA_CONFIG.stamina_explore_stamina_cost,
        );
    }
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
#[feature("safe_dispatcher")]
fn invalid_schedules_modes_and_registration_limits_never_allocate() {
    let d = setup();
    let preset = definition(false);
    registry(d).register_preset(1, preset);
    for input in array![
        CreateGameParams { name: 0, ..params(false) }, CreateGameParams { seed: 0, ..params(false) },
        CreateGameParams { duration_seconds: 0, ..params(false) },
        CreateGameParams { start_settling_at: 301, ..params(false) },
        CreateGameParams { registration_start: 200, ..params(false) },
    ] {
        assert!(safe(d, super::authority()).create_game(input).is_err());
    }
    assert_eq!(registry(d).next_game_id(), 1);
}

#[test]
#[feature("safe_dispatcher")]
fn a_game_without_a_season_close_takes_no_grace_period() {
    let d = setup();
    let mut preset = definition(false);
    preset.rules.mode_rules = preset.rules.mode_rules - crate::rules::SEASON_CLOSE;
    registry(d).register_preset(1, preset);
    let graceless = CreateGameParams { end_grace_seconds: 0, ..params(false) };
    assert!(safe(d, super::authority()).create_game(CreateGameParams { end_grace_seconds: 1, ..graceless }).is_err());
    assert_eq!(registry(d).create_game(graceless), 1);
}

#[test]
#[feature("safe_dispatcher")]
fn registration_refuses_a_fixed_roster_and_a_settlement_that_is_not_the_release() {
    let d = setup();
    let release = definition(false);
    let seated = PresetDefinition {
        rules: crate::rules::SliceRules { entry_rule: crate::rules::ENTRY_ROSTER, ..release.rules }, ..release,
    };
    let settlement = release.settlement;
    let grant = crate::resources::ResourceAmount { resource_type: 26, amount: 1 };
    let refused = array![
        seated,
        PresetDefinition { settlement: SettlementPreset { mode: SettlementMode::Triple, ..settlement }, ..release },
        PresetDefinition { settlement: SettlementPreset { spacing: settlement.spacing + 2, ..settlement }, ..release },
        PresetDefinition {
            settlement: SettlementPreset { order_aspects: array![1_u8].span(), ..settlement }, ..release,
        },
        PresetDefinition {
            settlement: SettlementPreset {
                realms: crate::settlement::RealmGrants { resources: array![grant].span(), ..settlement.realms },
                ..settlement,
            },
            ..release,
        },
        PresetDefinition {
            settlement: SettlementPreset {
                spires: Some(
                    crate::spires::SpireLayout { count: 1, base_distance: 0, layer_distance: 0, max_layer: 0 },
                ),
                ..settlement,
            },
            ..release,
        },
        PresetDefinition {
            settlement: SettlementPreset {
                villages: crate::village::VillageRules {
                    troop_delay_ticks: settlement.villages.troop_delay_ticks + 1, ..settlement.villages,
                },
                ..settlement,
            },
            ..release,
        },
    ];
    for preset in refused {
        assert!(safe(d, super::authority()).register_preset(1, preset).is_err());
        assert_eq!(registry(d).preset_commitment(1), 0);
    }
    registry(d).register_preset(1, release);
    assert_eq!(registry(d).preset_commitment(1), crate::presets::commitment(release));
}

#[test]
#[feature("safe_dispatcher")]
fn a_late_preset_validation_failure_rolls_back_the_record_and_allows_retry() {
    let d = setup();
    let mut preset = definition(false);
    preset.structures.upgrade_limits.realm_max = 4;
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
    registry(d).register_preset(1, definition(false));
    assert_eq!(registry(d).create_game(params(false)), 1);
}

#[test]
fn settlement_uses_block_time_after_grace_and_allows_retry_after_rejection() {
    let (d, _, _) = super::resource_commands::setup();
    let command = crate::commands::Command::MarkGameSettled;
    super::resource_commands::assert_terminal_rejection(d, command, 100);
    let d = super::bind_authority(d);
    let games = IGameDispatcher { contract_address: d.games };
    let game = games.game(3);
    let boundary = game.end_at + game.end_grace_seconds.into();
    super::resource_commands::assert_terminal_rejection(d, command, boundary);
    assert!(!games.game(3).settled);
    assert!(super::resource_commands::execute(d, command, boundary + 1));
    assert!(games.game(3).settled);
    assert_eq!(status_at(games.game(3), boundary + 1), GameStatus::Settled);
    assert!(super::resource_commands::execute(d, command, boundary + 2));
    assert_eq!(status_at(games.game(3), boundary + 2), GameStatus::Settled);
}

#[test]
#[feature("safe_dispatcher")]
fn preset_registration_rejects_enabled_mines_without_a_pool() {
    let d = setup();
    let mut preset = definition(false);
    preset.rules.map_config.shards_mines_win_probability = 1;
    registry(d).register_preset(2, preset);
    preset.resources.surface_mines = array![].span();
    assert!(safe(d, super::authority()).register_preset(1, preset).is_err());
    assert_eq!(registry(d).preset_commitment(1), 0);
}

#[test]
#[feature("safe_dispatcher")]
fn preset_registration_rejects_camps_with_zero_camp_labor() {
    let d = setup();
    let mut preset = definition(false);
    preset.rules.mode_rules = preset.rules.mode_rules | crate::rules::DISCOVER_CAMPS;
    preset.rules.map_config.camp_win_probability = 1;
    registry(d).register_preset(2, preset);
    preset.structures.camps.labor_rate = 0;
    assert!(safe(d, super::authority()).register_preset(1, preset).is_err());
    assert_eq!(registry(d).preset_commitment(1), 0);
}

#[test]
#[feature("safe_dispatcher")]
fn preset_registration_rejects_reversed_light_and_heavy_guard_bounds() {
    let d = setup();
    for light in array![true, false] {
        let mut preset = definition(false);
        if light {
            preset.rules.troop_limit_config.light_guard_lower_bound = 10;
            preset.rules.troop_limit_config.light_guard_upper_bound = 9;
        } else {
            preset.rules.troop_limit_config.heavy_guard_lower_bound = 10;
            preset.rules.troop_limit_config.heavy_guard_upper_bound = 9;
        }
        assert!(safe(d, super::authority()).register_preset(1, preset).is_err());
        assert_eq!(registry(d).preset_commitment(1), 0);
    }
}

#[test]
#[feature("safe_dispatcher")]
fn preset_registration_accepts_single_value_guard_ranges() {
    let d = setup();
    let mut preset = definition(false);
    preset.rules.troop_limit_config.light_guard_lower_bound = 10;
    preset.rules.troop_limit_config.light_guard_upper_bound = 10;
    preset.rules.troop_limit_config.heavy_guard_lower_bound = 65535;
    preset.rules.troop_limit_config.heavy_guard_upper_bound = 65535;
    assert!(safe(d, super::authority()).register_preset(1, preset).is_ok());
    assert_eq!(registry(d).preset_commitment(1), crate::presets::commitment(preset));
}

#[test]
#[feature("safe_dispatcher")]
fn launch_retries_return_the_same_game_and_a_changed_request_rejects() {
    let d = setup();
    let preset = definition(false);
    registry(d).register_preset(1, preset);
    let request = params(false);
    assert!(safe(d, d.actor).create_game(request).is_err());
    assert_eq!(registry(d).game_id_by_name(request.name), 0);
    let first = registry(d).create_game(request);
    assert_eq!(registry(d).create_game(request), first);
    assert_eq!(registry(d).next_game_id(), first + 1);
    assert_eq!(registry(d).game_id_by_name(request.name), first);
    assert!(safe(d, super::authority()).create_game(CreateGameParams { roster: roster(1), ..request }).is_err());
    assert!(safe(d, super::authority()).create_game(CreateGameParams { duration_seconds: 101, ..request }).is_err());
    assert_eq!(registry(d).next_game_id(), first + 1);
}

#[test]
#[feature("safe_dispatcher")]
fn an_open_game_names_no_seater() {
    let d = setup();
    registry(d).register_preset(1, expedition_preset());
    let season = CreateGameParams {
        dev_mode_on: true, end_grace_seconds: 0, duration_seconds: 2 * BAG_SECONDS, start_main_at: 360, ..params(false),
    };
    assert!(
        safe(d, super::authority()).create_game(CreateGameParams { seater: super::authority(), ..season }).is_err(),
    );
    assert_eq!(registry(d).create_game(season), 1);
    assert_eq!(IRegistrarDispatcher { contract_address: d.games }.game_seater(1), 0.try_into().unwrap());
}

#[test]
#[feature("safe_dispatcher")]
fn a_day_is_whole_armies_ticks_and_a_season_starts_on_one() {
    let d = setup();
    let mut uneven = expedition_preset();
    uneven.rules.tick_config.armies_tick_in_seconds = 50;
    assert!(safe(d, super::authority()).register_preset(1, uneven).is_err());
    registry(d).register_preset(1, expedition_preset());
    let season = CreateGameParams {
        dev_mode_on: true, end_grace_seconds: 0, duration_seconds: 2 * BAG_SECONDS, ..params(false),
    };
    assert!(safe(d, super::authority()).create_game(CreateGameParams { start_main_at: 310, ..season }).is_err());
    assert_eq!(registry(d).next_game_id(), 1);
    assert_eq!(registry(d).create_game(CreateGameParams { start_main_at: 360, ..season }), 1);
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
    assert!(execute_in_game(d, game_id, transfer(source, target, 1), 352));
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
    assert!(!execute_in_game(d, game_id, transfer(source, target, 1), 353));
    assert_eq!(troops.resolved_explorer(target).unwrap().troops.count, limit);
    assert_eq!(troops.resolved_explorer(source).unwrap().troops.count, 2 * RESOURCE_PRECISION);
}

#[test]
fn expedition_recruitment_uses_todays_home_and_preserves_progress_and_slot_stamina() {
    for direction in 0_u8..6 {
        let d = setup();
        let (game_id, preset, category) = expedition_home(d);
        let (army, _) = expedition_armies(d, game_id, category);
        let state = GameState { contract_address: d.games };
        let mut before = state.resolved_explorer(army).unwrap();
        let center = crate::expeditions::site(preset.settlement.spacing, 1, 0, 0);
        // Direction 1 is occupied by the second army; use the first army there only after removing it.
        let home = ResourceKey { game_id, entity_id: 1 };
        if direction == 1 {
            let armies = IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home);
            assert!(
                execute_in_game(
                    d,
                    game_id,
                    Command::ManageTroops(crate::troop_management::ManageTroops::RemoveExplorer(*armies.at(1))),
                    351,
                ),
            );
        }
        before.coord = crate::geometry::neighbor(center, direction);
        crate::tests::resource_commands::set_explorer_fixture(d.games, army, before);
        let veteran = crate::progression::ArmyProgress { logistics: 5, oath_slots: 1, ..Default::default() };
        write_progress(d, army, veteran);
        let maximum = crate::progression::stamina_max(
            veteran, before.troops.category, crate::balance::rules::TROOP_STAMINA_CONFIG,
        );
        let bar = if direction == 0 {
            7
        } else {
            maximum
        };
        assert!(maximum > crate::balance::rules::TROOP_STAMINA_CONFIG.stamina_initial.into());
        timers(d, army, bar, 400);
        let resource_type = crate::troops::stock_resource(before.troops.category, before.troops.tier);
        let resources = IResourceOperationsDispatcher { contract_address: d.games };
        let stock_key = ResourceSlot { game_id, entity_id: 1, resource_type };
        let stock = resources.resource_balance(stock_key);
        let capacity = resources.resource_weight(ResourceKey { game_id, entity_id: army.explorer_id }).capacity;
        let elapsed = if direction == 0 {
            crate::balance::rules::TICK_CONFIG.armies_tick_in_seconds
        } else {
            0
        };
        let expected_bar = if direction == 0 {
            bar + crate::balance::rules::TROOP_STAMINA_CONFIG.stamina_gain_per_tick.into()
        } else {
            bar
        };
        assert!(
            execute_in_game(d, game_id, crate::tests::frontier_economy::reinforce(army.explorer_id, 2), 360 + elapsed),
        );
        let after = state.resolved_explorer(army).unwrap();
        assert_eq!(after.coord, before.coord);
        assert_eq!(after.troops.count, 5 * RESOURCE_PRECISION);
        assert_eq!(slot(d, army, 0).stamina.amount, expected_bar);
        assert_eq!(slot(d, army, 0).stamina.settled_at, (360 + elapsed).try_into().unwrap());
        assert_eq!(after.troops.battle_cooldown_end, 400);
        assert_eq!(progress(d, army), Some(veteran));
        assert_eq!(resources.resource_balance(stock_key), stock - 2 * RESOURCE_PRECISION);
        assert_eq!(
            resources.resource_weight(ResourceKey { game_id, entity_id: army.explorer_id }).capacity, capacity * 5 / 3,
        );
    }
}

#[test]
fn expedition_recruitment_refuses_other_regions_depths_and_expired_armies_without_spending() {
    for location in 0_u8..4 {
        let d = setup();
        let (game_id, preset, category) = expedition_home(d);
        let (army, _) = expedition_armies(d, game_id, category);
        let state = GameState { contract_address: d.games };
        let mut explorer = state.resolved_explorer(army).unwrap();
        let home = crate::expeditions::site(preset.settlement.spacing, 1, 0, 0);
        explorer.coord = match location {
            0 => crate::geometry::neighbor(crate::geometry::neighbor(home, 0), 0),
            1 => crate::geometry::neighbor(crate::expeditions::site(preset.settlement.spacing, 2, 0, 0), 0),
            2 => crate::geometry::neighbor(crate::expeditions::site(preset.settlement.spacing, 1, 0, 1), 0),
            _ => explorer.coord,
        };
        crate::tests::resource_commands::set_explorer_fixture(d.games, army, explorer);
        let before = state.explorer(army);
        let resource_type = crate::troops::stock_resource(explorer.troops.category, explorer.troops.tier);
        let resources = IResourceOperationsDispatcher { contract_address: d.games };
        let stock_key = ResourceSlot { game_id, entity_id: 1, resource_type };
        let stock = resources.resource_balance(stock_key);
        let timestamp = if location == 3 {
            day_start(d, game_id, 1)
        } else {
            352
        };
        assert!(
            !execute_in_game(d, game_id, crate::tests::frontier_economy::reinforce(army.explorer_id, 2), timestamp),
        );
        assert_eq!(state.explorer(army), before);
        assert_eq!(resources.resource_balance(stock_key), stock);
    }
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
            d, game_id, Command::ManageTroops(crate::troop_management::ManageTroops::RecruitGuard(recruit)), 352,
        ),
    );
    assert!(
        !execute_in_game(
            d, game_id, Command::ManageTroops(crate::troop_management::ManageTroops::RemoveGuard(slot)), 353,
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
    let cap: u8 = crate::balance::rules::TROOP_LIMIT_CONFIG.settlement_armies.try_into().unwrap();
    for slot in 0..cap {
        assert!(execute_in_game(d, game_id, muster_slot_command(category, slot, slot), 351 + slot.into()));
    }
    assert!(!execute_in_game(d, game_id, muster_slot_command(category, cap, cap), 351 + cap.into()));
    let yesterday = structures.home_armies(home);
    let tomorrow = day_start(d, game_id, 1);
    for slot in 0..cap {
        assert!(execute_in_game(d, game_id, muster_slot_command(category, slot, slot), tomorrow + 1 + slot.into()));
    }
    for id in yesterday {
        assert!(troops.resolved_explorer(ExplorerKey { game_id, explorer_id: *id }).is_none());
    }
    assert_eq!(structures.home_armies(home).len(), cap.into());
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
    assert!(execute_in_game(d, game_id, muster_command(category, 0), 351));
    let key = ExplorerKey {
        game_id, explorer_id: *structures.home_armies(ResourceKey { game_id, entity_id: 1 }).at(0),
    };
    let spawn = troops.resolved_explorer(key).unwrap().coord;
    let site = crate::geometry::neighbor(spawn, 3);

    // All neighbours were materialized together before the first deployment.
    let (step, ring_tile) = free_ring_neighbor(map, game_id, spawn, site, spacing);
    let move = Command::Move(crate::commands::Move { explorer_id: key.explorer_id, directions: array![step].span() });
    assert!(execute_in_game(d, game_id, move, 352));
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
    // The fixture's armies start with one move of stamina and regain it per 50 s tick, and the move above spent it in
    // this tick; rest the army by one dearest move so the explore is judged on the ring rule, not on fatigue.
    let stamina = crate::balance::rules::TROOP_STAMINA_CONFIG;
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
    let discovery_key = crate::expeditions::ExpeditionDiscoveryKey { game_id, structure_id: 1, epoch: 0 };
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
            crate::balance::rules::TROOP_STAMINA_CONFIG,
        );
    let travel: u64 = crate::balance::rules::TROOP_STAMINA_CONFIG.stamina_travel_stamina_cost.into();
    let move_cost = if increase {
        travel + bonus.into()
    } else {
        travel - bonus.into()
    };
    assert!(
        execute_in_game(d, game_id, Command::Explore(Explore { explorer_id: key.explorer_id, direction: step }), 353),
    );
    let after = troops.resolved_explorer(key).unwrap();
    assert_eq!(progress_before, snforge_std::interact_with_state(d.games, || crate::logic::progression::read(key)));
    assert_eq!(
        discovery_before,
        snforge_std::interact_with_state(d.games, || crate::logic::expeditions::discovery(discovery_key)),
    );
    assert_eq!(after.coord, target);
    assert_eq!(before.troops.stamina.inline().amount - after.troops.stamina.inline().amount, move_cost);
    assert!(!map.occupancy(target_key).unwrap().is_structure);
    let mut index = 0;
    for resource in array![23_u8, 26, 38].span() {
        assert_eq!(
            resources.resource_balance(ResourceSlot { game_id, entity_id: 1, resource_type: *resource }),
            *balances.at(index),
        );
        index += 1;
    }
    // The home ring, the moved-to and the explored tiles keep the biome the terrain derives for them.
    assert!(
        super::terrain::assert_biomes_match_terrain(d, game_id, array![site, spawn, ring_tile, target].span()) != 0,
    );
}

#[test]
fn a_level_up_doubles_the_castle_labor_from_that_second() {
    let d = setup();
    let (game_id, _, _) = expedition_home(d);
    let home = ResourceKey { game_id, entity_id: 1 };
    let labor = ResourceSlot { game_id, entity_id: 1, resource_type: crate::resources::LABOR };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let base: u128 = crate::logic::resources::rule(crate::resources::LABOR).realm_rate.into();
    assert_eq!(resources.resource_production(labor).production_rate.into(), base);
    crate::tests::frontier_economy::settle(d, home, crate::resources::LABOR, 400);
    for cost in crate::logic::upgrades::recipe(1).costs {
        crate::tests::resource_commands::grant(d, home, *cost.resource_type, *cost.amount);
    }
    let before = resources.resource_balance(labor);
    let cost: u128 = (*crate::logic::upgrades::recipe(1).costs.at(0)).amount;
    assert!(execute_in_game(d, game_id, Command::LevelUp(1), 400));
    assert_eq!(resources.resource_balance(labor), before - cost);
    assert_eq!(resources.resource_production(labor).production_rate.into(), 2 * base);
    crate::tests::frontier_economy::settle(d, home, crate::resources::LABOR, 400 + 3600);
    assert_eq!(resources.resource_balance(labor), before - cost + 3600 * 2 * base);
}


#[test]
fn each_castle_level_stores_the_next_level_price() {
    let stores = crate::balance::structures::LABOR_STORES.span();
    for level in 0..3_u8 {
        let store: u128 = Into::<u32, u128>::into(*stores.at(level.into())) * RESOURCE_PRECISION;
        for cost in crate::logic::upgrades::recipe(level + 1).costs {
            assert!(store >= *cost.amount, "a castle level cannot hold the next level's price");
        }
    }
}
