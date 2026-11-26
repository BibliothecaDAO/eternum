pub use world_test_support::tests::registrar::*;
use crate::balance::settlement::SETTLEMENT_SPACING_STEPS;
const NOW: u64 = super::play_fixture::FIXTURE_START + 240;

#[test]
fn expedition_rollover_expires_armies_and_preserves_the_home_economy() {
    let d = setup();
    let (game_id, home, category) = expedition_home(d);
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let home_id = home.entity_id;
    let home_before = structures.structure(home).unwrap();
    assert_eq!(home_before.owner, d.actor);
    let map = IMapLogicDispatcher { contract_address: d.games };
    assert!(structures.position(home).is_none());
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let labor = ResourceSlot { game_id, entity_id: home_id, resource_type: 23 };
    let stored = resources.resource_balance(labor);
    let producer = resources.resource_production(labor);
    let capacity = resources.resource_weight(home).capacity;
    let muster = muster_command(home, category, 0, 0);
    let old_id = *structures.home_armies(home).at(0);
    let troops = GameState { contract_address: d.games };
    let old = ExplorerKey { game_id, explorer_id: old_id };
    let read_day = |
        id,
    | snforge_std::interact_with_state(d.games, || crate::state::read().troops.army_days.read((game_id, id)));
    assert_eq!(read_day(old_id), Some(0));
    let yesterday = troops.resolved_explorer(old).unwrap().coord;
    assert!(execute_in_game(d, game_id, Command::Explore(Explore { explorer_id: old_id, direction: 0 }), NOW));
    let after_explore = troops.resolved_explorer(old).unwrap().coord;
    let old_tile = map.tile(crate::geometry::tile_key(game_id, crate::geometry::neighbor(yesterday, 0)));
    let tomorrow = day_start(d, game_id, 1);
    assert!(!execute_in_game(d, game_id, Command::Explore(Explore { explorer_id: old_id, direction: 1 }), tomorrow));
    assert_eq!(troops.resolved_explorer(old).unwrap().coord, after_explore);
    fund(d, home);
    assert!(execute_in_game(d, game_id, muster, tomorrow + 1));
    assert!(troops.resolved_explorer(old).is_none());
    assert_eq!(read_day(old_id), None);
    let new_id = *structures.home_armies(home).at(0);
    assert_eq!(read_day(new_id), Some(1));
    let today = troops.resolved_explorer(ExplorerKey { game_id, explorer_id: new_id }).unwrap().coord;
    super::state::assert_spatial_indexes(
        d.games,
        game_id,
        array![home.entity_id, old_id, new_id].span(),
        array![yesterday, crate::geometry::neighbor(yesterday, 0), today].span(),
    );
    assert_ne!(today.y / SETTLEMENT_SPACING_STEPS, yesterday.y / SETTLEMENT_SPACING_STEPS);
    assert_eq!(
        map.tile(crate::geometry::tile_key(game_id, crate::geometry::neighbor(yesterday, 0))).unwrap().data
            / 0x20000000000,
        old_tile.unwrap().data / 0x20000000000,
    );
    assert!(map.tile(crate::geometry::tile_key(game_id, crate::geometry::neighbor(today, 0))).is_none());
    assert!(
        execute_in_game(d, game_id, Command::Explore(Explore { explorer_id: new_id, direction: 0 }), tomorrow + 20),
    );
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
            tomorrow + 20,
            crate::commands::resource_context(
                crate::commands::ExecutionContext {
                    timestamp: tomorrow + 20, ..crate::tests::context(d.games, (home).game_id),
                },
            ),
        );
    stop_cheat_caller_address(d.games);
    let elapsed: u128 = (tomorrow + 20 - producer.last_settled_at.into()).into();
    assert_eq!(resources.resource_balance(labor), stored + elapsed * producer.production_rate.into());
    assert_eq!(resources.resource_production(labor).production_rate, producer.production_rate);
    for cost in crate::logic::upgrades::recipe(1).costs {
        super::resource_commands::grant(d, home, *cost.resource_type, *cost.amount);
    }
    assert!(execute_in_game(d, game_id, Command::LevelUp(home_id), tomorrow + 30));
    assert_eq!(structures.structure(home).unwrap().base.level, 1);
    assert!(structures.position(home).is_none());
}

#[test]
fn expedition_regions_remain_disjoint_for_every_depth_through_a_season() {
    let mut regions: core::dict::Felt252Dict<u32> = Default::default();
    for day in 0_u64..105 {
        for depth in 0_u8..4 {
            for realm in array![1_u16, 2, 8000] {
                let site = crate::expeditions::site(SETTLEMENT_SPACING_STEPS, realm.into(), day, depth);
                let region: felt252 = Into::<u32, felt252>::into(site.x / SETTLEMENT_SPACING_STEPS) * 0x100000000
                    + Into::<u32, felt252>::into(site.y / SETTLEMENT_SPACING_STEPS);
                assert_eq!(regions.get(region), 0);
                regions.insert(region, 1);
                assert_eq!(crate::expeditions::region_day(site, SETTLEMENT_SPACING_STEPS), day);
            }
        }
    }
}

#[test]
#[should_panic(expected: ("outside expedition region",))]
fn an_expedition_cannot_move_into_yesterdays_region() {
    let yesterday = crate::expeditions::site(SETTLEMENT_SPACING_STEPS, 1, 0, 0);
    let today = crate::expeditions::site(SETTLEMENT_SPACING_STEPS, 1, 1, 0);
    crate::expeditions::assert_same_region(today, yesterday, SETTLEMENT_SPACING_STEPS);
}

#[test]
fn expedition_army_limits_follow_castle_level_without_guards_or_returning_troops() {
    let d = setup();
    let (game_id, home, category) = expedition_home(d);
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let guards = IGuardsDispatcher { contract_address: d.games };
    assert_eq!(guards.guard(GuardKey { game_id, structure_id: home.entity_id, slot: 0 }).troops.count, 0);
    assert_eq!(
        crate::troops::max_army_size(crate::balance::rules::TROOP_LIMIT_CONFIG, 0, crate::troops::TroopTier::T1), 3000,
    );
    for level in 0_u8..4 {
        if level != 0 {
            for cost in crate::logic::upgrades::recipe(level).costs {
                super::resource_commands::grant(d, home, *cost.resource_type, *cost.amount);
            }
            assert!(execute_in_game(d, game_id, Command::LevelUp(home.entity_id), NOW));
        }
        let record = structures.structure(home).unwrap();
        assert_eq!(record.base.troop_max_guard_count, 0);
        assert_eq!(record.base.troop_max_explorer_count, army_allowance(level));
        while structures.home_armies(home).len() < army_allowance(level).into() {
            let slot: u8 = structures.home_armies(home).len().try_into().unwrap();
            fund(d, home);
            assert!(execute_in_game(d, game_id, muster_command(home, category, slot % 6, slot), NOW));
        }
        fund(d, home);
        let beyond: u8 = army_allowance(level).try_into().unwrap();
        assert!(!execute_in_game(d, game_id, muster_command(home, category, 0, beyond), NOW));
    }
    let id = *structures.home_armies(home).at(0);
    let slot = ResourceSlot {
        game_id, entity_id: home.entity_id, resource_type: crate::troops::troop_resource(held_troop(d, home), 0),
    };
    let before = resources.resource_balance(slot);
    let to_guard = crate::troop_management::ManageTroops::Transfer(
        crate::troop_management::TransferTroops {
            source: crate::troop_management::Army::Explorer(id),
            target: crate::troop_management::Army::Guard(
                crate::troop_management::GuardSlot { structure_id: home.entity_id, slot: 0 },
            ),
            amount: RESOURCE_PRECISION,
        },
    );
    assert!(!execute_in_game(d, game_id, Command::ManageTroops(to_guard), NOW));
    let remove = crate::troop_management::ManageTroops::RemoveExplorer(id);
    assert!(execute_in_game(d, game_id, Command::ManageTroops(remove), NOW));
    assert_eq!(resources.resource_balance(slot), before);
}

#[test]
fn surface_sites_pay_initial_guards_once_without_rift_production() {
    assert_expedition_capture(0);
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

#[test]
fn sites_pay_the_same_initial_guard_in_a_days_last_minute_as_in_its_first() {
    assert_capture_at(0, 1000 * RESOURCE_PRECISION, crate::troops::TroopTier::T1, 100 * RESOURCE_PRECISION, true, None);
}

#[test]
fn a_clear_records_only_the_labor_that_fits_and_clears_even_when_full() {
    for room in array![0_u128, 1_u128] {
        assert_capture_at(
            0, 1000 * RESOURCE_PRECISION, crate::troops::TroopTier::T1, 100 * RESOURCE_PRECISION, false, Some(room),
        );
    }
}

#[test]
fn a_herd_clear_pays_wheat_once_and_removes_its_blocker() {
    beast_clear_payout(false, false);
}

#[test]
fn a_herd_clear_clips_wheat_at_storage() {
    beast_clear_payout(true, false);
}

#[test]
fn a_band_clear_pays_no_resources() {
    beast_clear_payout(false, true);
}

fn beast_clear_payout(full: bool, band: bool) {
    let mut seed = 0_u256;
    while crate::troops::beast_draw_is_band(seed) != band {
        seed += 1;
    }
    let (d, game_id, key) = setup_frontier_relics();
    let army = strong_frontier_army(d, game_id, key);
    let coord = crate::geometry::neighbor(army.coord, 0);
    let context = crate::commands::ExecutionContext { timestamp: NOW, ..crate::tests::context(d.games, game_id) };
    start_cheat_caller_address(d.games, d.games);
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let id = structures
        .create_discovery(
            game_id,
            army.owner,
            coord,
            crate::discovery::Discovery::Beasts,
            seed,
            NOW,
            crate::commands::action_context(context),
        );
    stop_cheat_caller_address(d.games);
    let site_key = ResourceKey { game_id, entity_id: id };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let home = ResourceKey { game_id, entity_id: army.owner };
    let wheat = ResourceSlot { game_id, entity_id: army.owner, resource_type: crate::resources::WHEAT };
    let cap = Into::<u32, u128>::into(crate::balance::structures::BOARD.settlement_resource_cap) * RESOURCE_PRECISION;
    if full {
        super::resource_commands::grant(d, home, crate::resources::WHEAT, cap);
    } else {
        super::frontier_economy::spend(d, home, crate::resources::WHEAT, resources.resource_balance(wheat), NOW + 1);
    }
    let before = resources.resource_balance(wheat);
    assert_eq!(before, if full {
        cap
    } else {
        0
    });
    assert_eq!(
        snforge_std::interact_with_state(
            d.games, || crate::logic::resources::store_limit(home, crate::resources::WHEAT),
        ),
        Some(cap),
    );
    let attack = Command::BattleGuard(
        crate::commands::Battle { attacker_id: key.explorer_id, defender_id: id, relic_slot: None },
    );
    assert!(execute_in_game(d, game_id, attack, NOW + 1));
    let site = snforge_std::interact_with_state(
        d.games, || crate::logic::expeditions::expedition_site(site_key).unwrap(),
    );
    let amount = if full || band {
        0
    } else {
        site.initial_guard_count * 4
    };
    assert_eq!(
        site.clear,
        Some(
            crate::expeditions::SiteClear {
                explorer_id: key.explorer_id,
                home_id: army.owner,
                reward: if band {
                    None
                } else {
                    Some(crate::resources::ResourceAmount { resource_type: crate::resources::WHEAT, amount })
                },
            },
        ),
    );
    assert_eq!(resources.resource_balance(wheat) - before, amount);
    assert_site_removed(d, site_key);
    assert!(
        snforge_std::interact_with_state(
            d.games, || crate::logic::map::occupancy(crate::geometry::tile_key(game_id, coord)),
        )
            .is_none(),
    );
    assert!(!execute_in_game(d, game_id, attack, NOW + 2));
    assert_eq!(resources.resource_balance(wheat), before + amount);
}

#[test]
fn expedition_deploy_fills_the_free_slot_beside_the_starting_armies_and_refuses_occupied_or_unallowed_slots() {
    let d = setup();
    let (game_id, home, category) = expedition_home(d);
    let free: u8 = 2;
    let key = crate::troops::ArmySlotKey { game_id, structure_id: home.entity_id, epoch: 0, slot: free };
    let read_slot = |key| snforge_std::interact_with_state(d.games, || crate::logic::army_slot_storage::read(key));
    let troops = GameState { contract_address: d.games };
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    assert_eq!(structures.home_armies(home).len(), 2);
    assert!(read_slot(key).is_none());
    fund(d, home);
    assert!(execute_in_game(d, game_id, muster_command(home, category, free, free), NOW));
    let fresh = read_slot(key).unwrap();
    let explorer = ExplorerKey { game_id, explorer_id: fresh.explorer_id };
    let army = troops.explorer(explorer).unwrap();
    assert_eq!(army.troops.stamina, crate::troops::StaminaSource::Slot(free));
    assert_eq!(
        fresh.stamina.amount,
        crate::progression::stamina_max(
            Default::default(), army.troops.category, crate::balance::rules::TROOP_STAMINA_CONFIG,
        ),
    );
    let before = structures.home_armies(home);
    let beyond: u8 = crate::balance::rules::TROOP_LIMIT_CONFIG.settlement_armies.try_into().unwrap();
    assert_eq!(beyond, free + 1);
    fund(d, home);
    assert!(!execute_in_game(d, game_id, muster_command(home, category, 3, 0), NOW));
    assert!(!execute_in_game(d, game_id, muster_command(home, category, 3, beyond), NOW));
    assert_eq!(structures.home_armies(home), before);
    assert_eq!(read_slot(key).unwrap(), fresh);
    assert!(read_slot(crate::troops::ArmySlotKey { slot: beyond, ..key }).is_none());
    let mut tired = troops.resolved_explorer(explorer).unwrap();
    tired.troops.stamina.set_amount(7);
    tired.troops.stamina.set_settled_at(NOW);
    super::resource_commands::set_explorer_fixture(d.games, explorer, tired);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::ManageTroops(crate::troop_management::ManageTroops::RemoveExplorer(explorer.explorer_id)),
            NOW,
        ),
    );
    assert!(execute_in_game(d, game_id, muster_command(home, category, free, free), NOW));
    let reused = read_slot(key).unwrap();
    assert!(reused.explorer_id != fresh.explorer_id);
    assert_eq!(reused.stamina.amount, 7);
}

#[test]
fn expedition_slot_reuse_preserves_its_bar_and_the_next_day_allocates_a_fresh_bar() {
    let d = setup();
    let (game_id, home, category) = expedition_home(d);
    let (first, second) = expedition_armies(d, home);
    let slot_key = crate::troops::ArmySlotKey { game_id, structure_id: home.entity_id, epoch: 0, slot: 0 };
    let read_slot = |key| snforge_std::interact_with_state(d.games, || crate::logic::army_slot_storage::read(key));
    let troops = GameState { contract_address: d.games };
    assert_eq!(troops.explorer(first).unwrap().troops.stamina, crate::troops::StaminaSource::Slot(0));
    assert_eq!(troops.explorer(second).unwrap().troops.stamina, crate::troops::StaminaSource::Slot(1));
    assert_eq!(read_slot(slot_key).unwrap().explorer_id, first.explorer_id);
    assert!(read_slot(crate::troops::ArmySlotKey { slot: 2, ..slot_key }).is_none());
    let mut tired = troops.resolved_explorer(first).unwrap();
    tired.troops.stamina.set_amount(7);
    tired.troops.stamina.set_settled_at(NOW);
    super::resource_commands::set_explorer_fixture(d.games, first, tired);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::ManageTroops(crate::troop_management::ManageTroops::RemoveExplorer(first.explorer_id)),
            NOW,
        ),
    );
    assert_eq!(read_slot(slot_key).unwrap().explorer_id, 0);
    assert_eq!(read_slot(slot_key).unwrap().stamina.amount, 7);
    fund(d, home);
    assert!(execute_in_game(d, game_id, muster_command(home, category, 0, 0), NOW));
    let replacement = read_slot(slot_key).unwrap().explorer_id;
    assert!(replacement != first.explorer_id && replacement != 0);
    assert_eq!(read_slot(slot_key).unwrap().stamina.amount, 7);
    assert_eq!(read_slot(crate::troops::ArmySlotKey { slot: 1, ..slot_key }).unwrap().explorer_id, second.explorer_id);
    let tomorrow = day_start(d, game_id, 1);
    fund(d, home);
    assert!(execute_in_game(d, game_id, muster_command(home, category, 0, 0), tomorrow));
    let next = read_slot(crate::troops::ArmySlotKey { epoch: 1, ..slot_key }).unwrap();
    assert!(next.explorer_id != replacement && next.explorer_id != 0);
    let fresh = troops.explorer(ExplorerKey { game_id, explorer_id: next.explorer_id }).unwrap().troops;
    assert_eq!(
        next.stamina.amount,
        crate::progression::stamina_max(
            Default::default(), fresh.category, crate::balance::rules::TROOP_STAMINA_CONFIG,
        ),
    );
    assert_eq!(read_slot(slot_key).unwrap().stamina.amount, 7);
    assert_eq!(read_slot(slot_key).unwrap().explorer_id, 0);
    assert!(troops.explorer(ExplorerKey { game_id, explorer_id: replacement }).is_none());
}

#[test]
fn expedition_death_releases_the_slot_with_the_final_battle_bar() {
    let d = setup();
    let (game_id, home, category) = expedition_home(d);
    let (first, _) = expedition_armies(d, home);
    let key = crate::troops::ArmySlotKey { game_id, structure_id: home.entity_id, epoch: 0, slot: 0 };
    let troops = GameState { contract_address: d.games };
    let mut defeated = troops.resolved_explorer(first).unwrap();
    let before = defeated.troops.count;
    defeated.troops.count = 0;
    defeated.troops.stamina.set_amount(2);
    let defeated = defeated;
    let context = crate::commands::action_context(
        crate::commands::ExecutionContext { raw_root: 1, timestamp: NOW, ..crate::tests::context(d.games, game_id) },
    );
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
    fund(d, home);
    assert!(execute_in_game(d, game_id, muster_command(home, category, 0, 0), NOW + 1));
    let reused = snforge_std::interact_with_state(d.games, || crate::logic::army_slot_storage::read(key)).unwrap();
    assert!(reused.explorer_id != first.explorer_id && reused.explorer_id != 0);
    assert_eq!(reused.stamina, vacant.stamina);
}

#[test]
fn frontier_floor_counts_seven_player_reveals_across_armies_and_depths_then_resets_at_the_days_end() {
    let discovery = crate::expeditions::FrontierDiscoveryRules {
        shrine_bps: 0, well_bps: 0, ..crate::balance::expeditions::FRONTIER_DISCOVERY,
    };
    let d = setup();
    let (game_id, home, category) = expedition_home(d);
    let (first, second) = expedition_armies(d, home);
    let counter = crate::expeditions::ExpeditionDiscoveryKey { game_id, structure_id: home.entity_id, epoch: 0 };
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::expeditions::discovery(counter)).is_none());
    let tomorrow = day_start(d, game_id, 1);
    let mut time = NOW + 1;
    for index in 0_u8..8 {
        let key = if index % 2 == 0 {
            first
        } else {
            second
        };
        let mut army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
        let centre = crate::expeditions::site(
            SETTLEMENT_SPACING_STEPS, crate::entity_ids::namespace(home.entity_id), 0, index % 3,
        );
        army.coord = crate::troops::Coord { x: centre.x + 5 + Into::<u8, u32>::into(index) * 2, ..centre };
        while !is_open(d, game_id, army.coord) || !is_open(d, game_id, crate::geometry::neighbor(army.coord, 0)) {
            army.coord.x += 16;
        }
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
        let expected = if index < 7 {
            crate::discovery::Discovery::None
        } else {
            crate::discovery::Discovery::Camp
        };
        let root = discovery_root(game_id, discovery, 100, index, Some(any_relic()), expected);
        assert!(time < tomorrow);
        assert!(explore_with_root(d, game_id, key.explorer_id, root, time));
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
            || crate::logic::expeditions::discovery(crate::expeditions::ExpeditionDiscoveryKey { epoch: 1, ..counter }),
        )
            .is_none(),
    );
    fund(d, home);
    assert!(execute_in_game(d, game_id, muster_command(home, category, 0, 0), tomorrow));
    let third = snforge_std::interact_with_state(
        d.games,
        || crate::logic::army_slot_storage::read(
            crate::troops::ArmySlotKey { game_id, structure_id: home.entity_id, epoch: 1, slot: 0 },
        ),
    )
        .unwrap()
        .explorer_id;
    let time = tomorrow + 1;
    let root = discovery_root(game_id, discovery, 100, 0, Some(any_relic()), crate::discovery::Discovery::None);
    assert!(explore_with_root(d, game_id, third, root, time));
    assert_eq!(
        snforge_std::interact_with_state(
            d.games,
            || crate::logic::expeditions::discovery(crate::expeditions::ExpeditionDiscoveryKey { epoch: 1, ..counter })
                .unwrap()
                .empty_reveals,
        ),
        1,
    );
}

#[test]
fn frontier_sites_persist_the_seeded_guard_and_initial_count() {
    let d = setup();
    let (game_id, home, _) = expedition_home(d);
    let context = crate::commands::ExecutionContext { timestamp: NOW, ..crate::tests::context(d.games, game_id) };
    start_cheat_caller_address(d.games, d.games);
    for depth_index in 0_u32..3 {
        let depth = crate::logic::expeditions::depth_rules(depth_index.try_into().unwrap());
        for (discovery, category, offset) in array![
            (crate::discovery::Discovery::Camp, crate::taxonomy::CAMP_CATEGORY, 0_u32),
            (crate::discovery::Discovery::Rift, crate::taxonomy::RIFT_CATEGORY, 1),
            (
                crate::discovery::Discovery::Ruin(
                    crate::army_relics::ArmyRelic {
                        kind: crate::army_relics::RelicKind::Blade, rank: (depth_index + 1).try_into().unwrap(),
                    },
                ),
                crate::taxonomy::RUIN_CATEGORY,
                2,
            ),
            (crate::discovery::Discovery::Beasts, crate::taxonomy::BEASTS_CATEGORY, 3),
        ] {
            let coord = crate::troops::Coord {
                alt: false, x: 100 + offset, y: depth_index * SETTLEMENT_SPACING_STEPS + SETTLEMENT_SPACING_STEPS / 2,
            };
            let seed = 123 + Into::<u32, u256>::into(offset);
            let id = IStructureOperationsDispatcher { contract_address: d.games }
                .create_discovery(
                    game_id, home.entity_id, coord, discovery, seed, NOW, crate::commands::action_context(context),
                );
            let guard = IGuardsDispatcher { contract_address: d.games }
                .guard(GuardKey { game_id, structure_id: id, slot: 0 });
            let expected = if let crate::discovery::Discovery::Ruin(relic) = discovery {
                crate::troops::ruin_guard(relic, depth_index.try_into().unwrap(), seed, context.rules.unbox(), NOW)
            } else {
                crate::troops::frontier_guard(category, depth, seed, context.rules.unbox(), NOW)
            };
            assert_eq!(guard.troops, expected);
            if category == crate::taxonomy::BEASTS_CATEGORY {
                let count: u16 = (guard.troops.count / RESOURCE_PRECISION).try_into().unwrap();
                assert!(
                    (count >= depth.beast_weak_lower && count <= depth.beast_weak_upper)
                        || (count >= depth.beast_strong_lower && count <= depth.beast_strong_upper),
                );
                assert_eq!(
                    guard.troops.category,
                    if count <= depth.beast_weak_upper {
                        crate::troops::TroopType::Knight
                    } else {
                        crate::troops::TroopType::Crossbowman
                    },
                );
                assert_eq!(guard.troops.tier, crate::troops::TroopTier::T1);
            }
            let site = snforge_std::interact_with_state(
                d.games,
                || {
                    crate::logic::expeditions::expedition_site(ResourceKey { game_id, entity_id: id }).unwrap()
                },
            );
            assert_eq!(site.initial_guard_count, expected.count);
            let structure = IStructureOperationsDispatcher { contract_address: d.games }
                .structure(ResourceKey { game_id, entity_id: id })
                .unwrap();
            assert_eq!(structure.base.category, category);
            assert_eq!(structure.base.troop_max_explorer_count, 0);
        }
    }
}


#[test]
fn frontier_discovery_reads_home_knowledge_without_placing_shrines_or_wells() {
    let d = setup();
    let (game_id, home, _) = expedition_home(d);
    let (key, _) = expedition_armies(d, home);
    let army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    let rules = crate::balance::expeditions::FRONTIER_DISCOVERY;
    let discovery = crate::discovery::IExpeditionRevealLibraryDispatcher {
        class_hash: super::declare_logic("ConstructionLogic"),
    };
    for (expected, lore) in array![
        (crate::discovery::Discovery::Shrine, crate::research::LORE_SHRINES),
        (crate::discovery::Discovery::Well, crate::research::LORE_WELLS),
    ] {
        let enabled = crate::expeditions::FrontierDiscoveryRules {
            shrine_bps: if lore == crate::research::LORE_SHRINES {
                rules.shrine_bps
            } else {
                0
            },
            well_bps: if lore == crate::research::LORE_WELLS {
                rules.well_bps
            } else {
                0
            },
            ..rules,
        };
        let mut chosen = None;
        for sample in 0_u64..10000 {
            let seed: u256 = sample.into();
            if crate::discovery::frontier(enabled, 100, 0, Some(any_relic()), seed) == expected {
                chosen = Some(seed);
                break;
            }
        }
        let seed = chosen.expect('MISSING_SITE_ROOT');
        let direction = if lore == crate::research::LORE_SHRINES {
            0
        } else {
            1
        };
        let coord = crate::geometry::neighbor_at_distance(army.coord, direction, 5);
        let tile = crate::geometry::tile_key(game_id, coord);
        let context = crate::commands::action_context(
            crate::commands::ExecutionContext {
                raw_root: 0, timestamp: NOW, ..crate::tests::context(d.games, game_id),
            },
        );
        start_cheat_caller_address(d.games, d.games);
        let locked = snforge_std::interact_with_state(
            d.games,
            || crate::discovery::IExpeditionRevealDispatcherTrait::reveal_expedition_tile(
                discovery, tile, key.explorer_id, seed, context,
            ),
        );
        assert!(locked != crate::discovery::Discovery::Shrine && locked != crate::discovery::Discovery::Well);
        snforge_std::interact_with_state(
            d.games,
            || {
                crate::logic::research::write(
                    home, crate::research::RealmKnowledge { learned: world_test_support::tests::registrar::lore(lore) },
                );
                crate::logic::expeditions::record_discovery(
                    crate::expeditions::ExpeditionDiscoveryKey { game_id, structure_id: army.owner, epoch: 0 },
                    crate::discovery::Discovery::Camp,
                );
            },
        );
        let tile = crate::geometry::tile_key(game_id, crate::geometry::neighbor_at_distance(army.coord, direction, 6));
        let found = snforge_std::interact_with_state(
            d.games,
            || crate::discovery::IExpeditionRevealDispatcherTrait::reveal_expedition_tile(
                discovery, tile, key.explorer_id, seed, context,
            ),
        );
        assert_eq!(found, expected);
        stop_cheat_caller_address(d.games);
        assert!(snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile)).is_none());
        snforge_std::interact_with_state(
            d.games, || crate::logic::research::write(home, crate::research::RealmKnowledge { learned: 0 }),
        );
    }
}

#[test]
fn open_frontier_settlement_uses_only_each_players_home_and_entry() {
    let (d, game_id) = setup_open_frontier();
    let before = next_setup_entity(d, game_id);
    let views = ISettlementViewsDispatcher { contract_address: d.games };
    let progress = views.settlement_progress(game_id);
    let other = super::bind_authority(d);
    let command = Command::SettleSeason(
        crate::realms::SettleSeason { selected_realm: None, order: Some(aspect_order(1)) },
    );
    assert!(execute_in_game(d, game_id, command, NOW));
    assert!(execute_in_game(other, game_id, command, NOW));
    let first = snforge_std::interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor));
    let second = snforge_std::interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, other.actor));
    assert_ne!(first, second);
    assert_eq!(views.settlement_progress(game_id), progress);
    assert_eq!(next_setup_entity(d, game_id), before);
    snforge_std::interact_with_state(
        d.games,
        || {
            for actor in array![d.actor, other.actor] {
                let home = crate::entity_ids::home_for_actor(game_id, actor);
                let record = crate::logic::structures::record(ResourceKey { game_id, entity_id: home });
                assert_eq!(record.owner, actor);
                assert_eq!(
                    crate::state::read().realms.reverse_indices.read((game_id, record.metadata.realm_id.into())), 0,
                );
            }
        },
    );
}


#[test]
fn frontier_ruin_clear_awards_its_stored_relic_without_lords() {
    let (d, game_id, key) = setup_frontier_relics();
    let army = strong_frontier_army(d, game_id, key);
    let coord = crate::geometry::neighbor(army.coord, 0);
    let site_key = place_ruin(d, ResourceKey { game_id, entity_id: army.owner }, coord, RELIC, NOW);
    let site = site_key.entity_id;
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    assert_eq!(structures.structure(site_key).unwrap().base.category, crate::taxonomy::RUIN_CATEGORY);
    // The card and the clear read the one row stored at discovery.
    let initial = snforge_std::interact_with_state(
        d.games, || crate::logic::expeditions::expedition_site(site_key).unwrap(),
    );
    assert_eq!(structures.structure(site_key).unwrap().base.category, crate::taxonomy::RUIN_CATEGORY);
    assert!(
        initial.initial_guard_count >= 900
            * RESOURCE_PRECISION && initial.initial_guard_count <= 1100
            * RESOURCE_PRECISION,
    );
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let lords = ResourceSlot { game_id, entity_id: army.owner, resource_type: crate::resources::LORDS };
    let before = resources.resource_balance(lords);
    let mut spy = snforge_std::spy_events();
    let captured = execute_in_game(
        d,
        game_id,
        Command::BattleGuard(
            crate::commands::Battle { attacker_id: key.explorer_id, defender_id: site, relic_slot: None },
        ),
        NOW + 1,
    );
    assert!(captured, "relic capture failed");
    assert_eq!(resources.resource_balance(lords), before);
    assert_eq!(snforge_std::interact_with_state(d.games, || crate::logic::army_relics::read(key)).first, Some(RELIC));
    let tile = crate::geometry::tile_key(game_id, coord);
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile)).is_none());
    assert_site_removed(d, site_key);
    let receipt = snforge_std::interact_with_state(
        d.games, || crate::logic::expeditions::expedition_site(site_key).unwrap().clear.unwrap(),
    );
    assert_eq!(receipt.explorer_id, key.explorer_id);
    assert_eq!(receipt.home_id, army.owner);
    assert!(receipt.reward.is_none());
    let mut payouts = 0;
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(0) == selector!("StoryEvent") {
            let mut keys = event.keys.span().slice(1, event.keys.len() - 1);
            let mut data = event.data.span();
            let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
            if let crate::ownership::Story::StructureCapturedStory(_) = story.story {
                panic!("clear is not a capture");
            }
            if let crate::ownership::Story::SitePayout(payout) = story.story {
                payouts += 1;
                assert_eq!(payout.category, crate::taxonomy::RUIN_CATEGORY);
                assert_eq!(payout.reward, None);
            }
        }
    }
    assert_eq!(payouts, 1);
}

#[test]
fn two_ruins_at_the_same_depth_award_relics_without_closing_the_other_or_paying_lords() {
    let (d, game_id, key) = setup_frontier_relics();
    let army = strong_frontier_army(d, game_id, key);
    let first_coord = crate::geometry::neighbor(army.coord, 0);
    let second_coord = crate::geometry::neighbor(army.coord, 1);
    let home = ResourceKey { game_id, entity_id: army.owner };
    let first = place_ruin(d, home, first_coord, RELIC, NOW);
    let second = place_ruin(d, home, second_coord, RELIC, NOW);
    let before = snforge_std::interact_with_state(
        d.games, || crate::logic::resources::balance(home, crate::resources::LORDS),
    );
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let mut timestamp = NOW + 1;
    for target in array![first, second] {
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::BattleGuard(
                    crate::commands::Battle {
                        attacker_id: key.explorer_id, defender_id: target.entity_id, relic_slot: None,
                    },
                ),
                timestamp,
            ),
        );
        let after = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
        timestamp = core::cmp::max(timestamp + 1, Into::<u32, u64>::into(after.troops.battle_cooldown_end) + 1);
        assert_site_removed(d, target);
        snforge_std::interact_with_state(
            d.games,
            || {
                let receipt = crate::logic::expeditions::expedition_site(target).unwrap().clear.unwrap();
                assert_eq!(receipt.home_id, home.entity_id);
                assert_eq!(receipt.explorer_id, key.explorer_id);
                assert!(receipt.reward.is_none());
                assert_eq!(crate::logic::resources::balance(home, crate::resources::LORDS), before);
                if target == first {
                    assert!(crate::logic::map::occupancy(crate::geometry::tile_key(game_id, second_coord)).is_some());
                }
            },
        );
        if target == first {
            assert!(structures.structure(second).is_some());
        }
    }
    snforge_std::interact_with_state(
        d.games,
        || {
            let carried = crate::logic::army_relics::read(key);
            assert_eq!(carried.first, Some(RELIC));
            assert_eq!(carried.second, Some(RELIC));
            assert!(carried.third.is_none());
            assert_eq!(
                crate::logic::expeditions::depth_at(game_id, first_coord),
                crate::logic::expeditions::depth_at(game_id, second_coord),
            );
        },
    );
}

fn army_allowance(level: u8) -> u16 {
    let limits = crate::balance::rules::TROOP_LIMIT_CONFIG;
    match level {
        0 => limits.settlement_armies,
        1 => limits.city_armies,
        2 => limits.kingdom_armies,
        _ => limits.empire_armies,
    }
}

fn is_open(d: super::Deployment, game_id: u32, coord: crate::troops::Coord) -> bool {
    snforge_std::interact_with_state(
        d.games, || crate::logic::map::occupancy(crate::geometry::tile_key(game_id, coord)),
    )
        .is_none()
}

fn fund(d: super::Deployment, home: ResourceKey) {
    super::resource_commands::fund_troops(
        d, home, crate::troops::troop_resource(held_troop(d, home), 0), RESOURCE_PRECISION,
    );
}
