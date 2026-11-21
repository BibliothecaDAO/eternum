pub use world_test_support::tests::registrar::*;
use crate::tests::army_merge::{progress, slot_at_home, timers, write_progress};

#[test]
#[feature("safe_dispatcher")]
fn invalid_schedules_and_registration_windows_never_allocate() {
    let d = setup();
    let request = super::play_fixture::fixture_params('native');
    for input in array![
        CreateGameParams { name: 0, ..request }, CreateGameParams { seed: 0, ..request },
        CreateGameParams { duration_seconds: 0, ..request },
        CreateGameParams { start_settling_at: request.start_main_at + 1, ..request },
        CreateGameParams { registration_start: request.start_settling_at.try_into().unwrap(), ..request },
    ] {
        assert!(safe(d, super::authority()).create_game(input).is_err());
    }
    assert_eq!(registry(d).next_game_id(), 1);
}

#[test]
fn settlement_uses_block_time_after_the_end_and_allows_retry_after_rejection() {
    let (d, _, _) = super::resource_commands::setup();
    let command = crate::commands::Command::MarkGameSettled;
    super::resource_commands::assert_terminal_rejection(d, command, super::play_fixture::FIXTURE_START);
    let d = super::bind_authority(d);
    let games = IGameDispatcher { contract_address: d.games };
    let boundary = games.game(3).end_at - 1;
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
fn launch_retries_return_the_same_game_and_a_changed_request_rejects() {
    let d = setup();
    let request = super::play_fixture::fixture_params('native');
    assert!(safe(d, d.actor).create_game(request).is_err());
    assert_eq!(registry(d).game_id_by_name(request.name), 0);
    let first = registry(d).create_game(request);
    assert_eq!(registry(d).create_game(request), first);
    assert_eq!(registry(d).next_game_id(), first + 1);
    assert_eq!(registry(d).game_id_by_name(request.name), first);
    assert!(
        safe(d, super::authority())
            .create_game(CreateGameParams { duration_seconds: request.duration_seconds + 120, ..request })
            .is_err(),
    );
    assert_eq!(registry(d).next_game_id(), first + 1);
}

#[test]
#[feature("safe_dispatcher")]
fn a_season_starts_and_ends_on_an_army_tick() {
    let d = setup();
    let season = super::play_fixture::fixture_params('native');
    let tick = crate::balance::rules::TICK_CONFIG.armies_tick_in_seconds;
    let off_tick = CreateGameParams {
        start_settling_at: season.start_main_at + 1, start_main_at: season.start_main_at + 1, ..season,
    };
    assert!(safe(d, super::authority()).create_game(off_tick).is_err());
    assert!(
        safe(d, super::authority())
            .create_game(CreateGameParams { duration_seconds: season.duration_seconds + 1, ..season })
            .is_err(),
    );
    assert_eq!(registry(d).next_game_id(), 1);
    assert_eq!(
        registry(d).create_game(CreateGameParams { start_settling_at: tick * 3, start_main_at: tick * 3, ..season }), 1,
    );
}

#[test]
fn expedition_armies_merge_into_the_lower_stamina_and_never_past_the_size_limit() {
    let d = setup();
    let (game_id, home, _) = expedition_home(d);
    let (source, target) = expedition_armies(d, home);
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
    let source_count = tired.troops.count;
    let target_count = troops.resolved_explorer(target).unwrap().troops.count;
    assert!(execute_in_game(d, game_id, transfer(source, target, 1), super::play_fixture::FIXTURE_START + 2));
    let merged = troops.resolved_explorer(target).unwrap();
    assert_eq!(merged.troops.count, target_count + RESOURCE_PRECISION);
    assert_eq!(merged.troops.stamina.inline().amount, 5);
    assert_eq!(troops.resolved_explorer(source).unwrap().troops.count, source_count - RESOURCE_PRECISION);

    // An army at its size limit takes no more troops.
    let rules = IGameDispatcher { contract_address: d.games }.rules(game_id);
    let level = IStructureOperationsDispatcher { contract_address: d.games }.structure(home).unwrap().base.level;
    let limit: u128 = crate::troops::max_army_size(rules.troop_limit_config, level, merged.troops.tier).into()
        * RESOURCE_PRECISION;
    let mut full = merged;
    full.troops.count = limit;
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: game_id.into(), explorer_id: target.explorer_id }, full,
    );
    assert!(!execute_in_game(d, game_id, transfer(source, target, 1), super::play_fixture::FIXTURE_START + 3));
    assert_eq!(troops.resolved_explorer(target).unwrap().troops.count, limit);
    assert_eq!(troops.resolved_explorer(source).unwrap().troops.count, source_count - RESOURCE_PRECISION);
}

#[test]
fn expedition_recruitment_uses_todays_home_and_preserves_progress_and_slot_stamina() {
    for direction in 0_u8..6 {
        let d = setup();
        let (game_id, home, _) = expedition_home(d);
        let (army, _) = expedition_armies(d, home);
        let state = GameState { contract_address: d.games };
        let mut before = state.resolved_explorer(army).unwrap();
        let center = crate::expeditions::site(
            crate::logic::settlement::spacing(), crate::entity_ids::namespace(home.entity_id), 0, 0,
        );
        // Direction 1 is occupied by the second army; use the first army there only after removing it.
        if direction == 1 {
            let armies = IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home);
            assert!(
                execute_in_game(
                    d,
                    game_id,
                    Command::ManageTroops(crate::troop_management::ManageTroops::RemoveExplorer(*armies.at(1))),
                    super::play_fixture::FIXTURE_START + 1,
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
        timers(d, army, bar, (super::play_fixture::FIXTURE_START + 50).try_into().unwrap());
        let resource_type = crate::troops::stock_resource(before.troops.category, before.troops.tier);
        let resources = IResourceOperationsDispatcher { contract_address: d.games };
        let stock_key = ResourceSlot { game_id, entity_id: home.entity_id, resource_type };
        super::resource_commands::fund_troops(d, home, resource_type, 2 * RESOURCE_PRECISION);
        let stock = resources.resource_balance(stock_key);
        let capacity = resources.resource_weight(ResourceKey { game_id, entity_id: army.explorer_id }).capacity;
        let count = before.troops.count;
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
        super::resource_commands::assert_executes(
            d,
            game_id,
            crate::tests::frontier_economy::reinforce(army.explorer_id, 2),
            super::play_fixture::FIXTURE_START + 10 + elapsed,
        );
        let after = state.resolved_explorer(army).unwrap();
        assert_eq!(after.coord, before.coord);
        assert_eq!(after.troops.count, count + 2 * RESOURCE_PRECISION);
        assert_eq!(slot_at_home(d, army, home.entity_id, 0).stamina.amount, expected_bar);
        assert_eq!(
            slot_at_home(d, army, home.entity_id, 0).stamina.settled_at,
            (super::play_fixture::FIXTURE_START + 10 + elapsed).try_into().unwrap(),
        );
        assert_eq!(after.troops.battle_cooldown_end, (super::play_fixture::FIXTURE_START + 50).try_into().unwrap());
        assert_eq!(progress(d, army), Some(veteran));
        assert_eq!(resources.resource_balance(stock_key), stock - 2 * RESOURCE_PRECISION);
        assert_eq!(
            resources.resource_weight(ResourceKey { game_id, entity_id: army.explorer_id }).capacity,
            capacity * (count + 2 * RESOURCE_PRECISION) / count,
        );
    }
}

#[test]
fn expedition_recruitment_refuses_other_regions_depths_and_expired_armies_without_spending() {
    for location in 0_u8..4 {
        let d = setup();
        let (game_id, home, _) = expedition_home(d);
        let (army, _) = expedition_armies(d, home);
        let state = GameState { contract_address: d.games };
        let mut explorer = state.resolved_explorer(army).unwrap();
        let site = crate::expeditions::site(
            crate::logic::settlement::spacing(), crate::entity_ids::namespace(home.entity_id), 0, 0,
        );
        explorer.coord = match location {
            0 => crate::geometry::neighbor(crate::geometry::neighbor(site, 0), 0),
            1 => crate::geometry::neighbor(
                crate::expeditions::site(
                    crate::logic::settlement::spacing(), crate::entity_ids::namespace(home.entity_id) + 1, 0, 0,
                ),
                0,
            ),
            2 => crate::geometry::neighbor(
                crate::expeditions::site(
                    crate::logic::settlement::spacing(), crate::entity_ids::namespace(home.entity_id), 0, 1,
                ),
                0,
            ),
            _ => explorer.coord,
        };
        crate::tests::resource_commands::set_explorer_fixture(d.games, army, explorer);
        let before = state.explorer(army);
        let resource_type = crate::troops::stock_resource(explorer.troops.category, explorer.troops.tier);
        let resources = IResourceOperationsDispatcher { contract_address: d.games };
        let stock_key = ResourceSlot { game_id, entity_id: home.entity_id, resource_type };
        let stock = resources.resource_balance(stock_key);
        let timestamp = if location == 3 {
            day_start(d, game_id, 1)
        } else {
            super::play_fixture::FIXTURE_START + 2
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
    let (game_id, home, _) = expedition_home(d);
    // Paying for the knights succeeds, so only the slot rule can refuse the recruit.
    start_cheat_caller_address(d.games, d.games);
    IResourceOperationsDispatcher { contract_address: d.games }
        .grant_resource(
            home,
            26,
            1000 * RESOURCE_PRECISION,
            super::play_fixture::FIXTURE_START + 1,
            crate::commands::resource_context(
                crate::commands::ExecutionContext {
                    timestamp: super::play_fixture::FIXTURE_START + 1, ..crate::tests::context(d.games, (home).game_id),
                },
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
            d,
            game_id,
            Command::ManageTroops(crate::troop_management::ManageTroops::RecruitGuard(recruit)),
            super::play_fixture::FIXTURE_START + 2,
        ),
    );
    assert!(
        !execute_in_game(
            d,
            game_id,
            Command::ManageTroops(crate::troop_management::ManageTroops::RemoveGuard(slot)),
            super::play_fixture::FIXTURE_START + 3,
        ),
    );
}

#[test]
fn yesterdays_armies_leave_todays_army_cap_free() {
    let d = setup();
    let (game_id, home, category) = expedition_home(d);
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let troops = GameState { contract_address: d.games };
    let cap: u8 = crate::balance::rules::TROOP_LIMIT_CONFIG.settlement_armies.try_into().unwrap();
    let starting: u8 = structures.home_armies(home).len().try_into().unwrap();
    let troop = crate::troops::troop_resource(held_troop(d, home), 0);
    super::resource_commands::fund_troops(d, home, troop, (2 * cap).into() * RESOURCE_PRECISION);
    let today = super::play_fixture::FIXTURE_START + 1;
    for slot in starting..cap {
        assert!(execute_in_game(d, game_id, muster_command(home, category, slot, slot), today));
    }
    assert!(!execute_in_game(d, game_id, muster_command(home, category, cap, cap), today));
    let yesterday = structures.home_armies(home);
    assert_eq!(yesterday.len(), cap.into());
    let tomorrow = day_start(d, game_id, 1);
    for slot in 0..cap {
        assert!(execute_in_game(d, game_id, muster_command(home, category, slot, slot), tomorrow + 1 + slot.into()));
    }
    for id in yesterday {
        assert!(troops.resolved_explorer(ExplorerKey { game_id, explorer_id: *id }).is_none());
    }
    assert_eq!(structures.home_armies(home).len(), cap.into());
}

#[test]
fn a_materialized_home_ring_moves_and_explores_without_a_roll() {
    let d = setup();
    let (game_id, home, _) = expedition_home(d);
    let spacing = crate::logic::settlement::spacing();
    let map = IMapLogicDispatcher { contract_address: d.games };
    let troops = GameState { contract_address: d.games };
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let key = ExplorerKey { game_id, explorer_id: *structures.home_armies(home).at(0) };
    let spawn = troops.resolved_explorer(key).unwrap().coord;
    let site = crate::geometry::neighbor(spawn, 3);

    // All neighbours were materialized together before the first deployment.
    let (step, ring_tile) = free_ring_neighbor(map, game_id, spawn, site, spacing);
    let move = Command::Move(crate::commands::Move { explorer_id: key.explorer_id, directions: array![step].span() });
    assert!(execute_in_game(d, game_id, move, super::play_fixture::FIXTURE_START + 2));
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
        balances
            .append(
                resources
                    .resource_balance(ResourceSlot { game_id, entity_id: home.entity_id, resource_type: *resource }),
            );
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
        execute_in_game(
            d,
            game_id,
            Command::Explore(Explore { explorer_id: key.explorer_id, direction: step }),
            super::play_fixture::FIXTURE_START + 3,
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
    assert!(!map.occupancy(target_key).unwrap().is_structure);
    let mut index = 0;
    for resource in array![23_u8, 26, 38].span() {
        assert_eq!(
            resources.resource_balance(ResourceSlot { game_id, entity_id: home.entity_id, resource_type: *resource }),
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
    let (game_id, home, _) = expedition_home(d);
    let labor = ResourceSlot { game_id, entity_id: home.entity_id, resource_type: crate::resources::LABOR };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let base: u128 = crate::logic::resources::rule(crate::resources::LABOR).realm_rate.into();
    assert_eq!(resources.resource_production(labor).production_rate.into(), base);
    crate::tests::frontier_economy::settle(d, home, crate::resources::LABOR, super::play_fixture::FIXTURE_START + 50);
    for cost in crate::logic::upgrades::recipe(1).costs {
        crate::tests::resource_commands::grant(d, home, *cost.resource_type, *cost.amount);
    }
    let before = resources.resource_balance(labor);
    let cost: u128 = (*crate::logic::upgrades::recipe(1).costs.at(0)).amount;
    assert!(execute_in_game(d, game_id, Command::LevelUp(home.entity_id), super::play_fixture::FIXTURE_START + 50));
    assert_eq!(resources.resource_balance(labor), before - cost);
    assert_eq!(resources.resource_production(labor).production_rate.into(), 2 * base);
    crate::tests::frontier_economy::settle(
        d, home, crate::resources::LABOR, super::play_fixture::FIXTURE_START + 50 + 3600,
    );
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
