pub use world_test_support::tests::registrar::*;

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
    assert!(execute_in_game(d, game_id, muster, 351));
    let old_id = *structures.home_armies(home).at(0);
    let troops = GameState { contract_address: d.games };
    let old = ExplorerKey { game_id, explorer_id: old_id };
    let read_day = |
        id,
    | snforge_std::interact_with_state(d.games, || crate::state::read().troops.army_days.read((game_id, id)));
    assert_eq!(read_day(old_id), Some(0));
    let yesterday = troops.resolved_explorer(old).unwrap().coord;
    assert!(execute_in_game(d, game_id, Command::Explore(Explore { explorer_id: old_id, direction: 0 }), 360));
    let after_explore = troops.resolved_explorer(old).unwrap().coord;
    let old_tile = map.tile(crate::geometry::tile_key(game_id, crate::geometry::neighbor(yesterday, 0)));
    let tomorrow = day_start(d, game_id, 1);
    assert!(!execute_in_game(d, game_id, Command::Explore(Explore { explorer_id: old_id, direction: 1 }), tomorrow));
    assert_eq!(troops.resolved_explorer(old).unwrap().coord, after_explore);
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
    assert_ne!(today.y / preset.settlement.spacing, yesterday.y / preset.settlement.spacing);
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
    let elapsed: u128 = (tomorrow + 20 - 350).into();
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
                let site = crate::expeditions::site(1024, realm.into(), day, depth);
                let region: felt252 = Into::<u32, felt252>::into(site.x / 1024) * 0x100000000
                    + Into::<u32, felt252>::into(site.y / 1024);
                assert_eq!(regions.get(region), 0);
                regions.insert(region, 1);
                assert_eq!(crate::expeditions::region_day(site, 1024), day);
            }
        }
    }
}

#[test]
#[should_panic(expected: ("outside expedition region",))]
fn an_expedition_cannot_move_into_yesterdays_region() {
    let yesterday = crate::expeditions::site(1024, 1, 0, 0);
    let today = crate::expeditions::site(1024, 1, 1, 0);
    crate::expeditions::assert_same_region(today, yesterday, 1024);
}

#[test]
fn expedition_army_limits_follow_castle_level_without_guards_or_returning_troops() {
    let d = setup();
    let mut preset = definition(true);
    open_entry(ref preset);
    preset.rules.day_unit_seconds = FRONTIER_DAY_UNIT;
    let (_, frontier) = super::preset_projection::current_definition("frontier-check");
    preset.economy.labor = frontier.economy.labor;
    preset.rules.mode_rules = preset.rules.mode_rules | crate::rules::DEPTH_CONTENTS;
    preset.rules.map_config.camp_win_probability = 0;
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.rules.mode_rules = HOME_REWARDS | crate::rules::UNOWNED_TARGETS | crate::rules::DEPTH_CONTENTS;
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
            CreateGameParams {
                dev_mode_on: true, end_grace_seconds: 0, duration_seconds: FRONTIER_BAG_SECONDS, ..params(false),
            },
        );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("catalogue_count"), array![].span(), 8000_u32,
    );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("traits"), array![1].span(), 0x4000001_u32,
    );
    super::play_fixture::reserve_fixture_homes(d.games, game_id, d.actor);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(crate::realms::SettleSeason { selected_realm: Some(1), order: None }),
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
    assert_eq!(
        crate::troops::max_army_size(crate::balance::rules::TROOP_LIMIT_CONFIG, 0, crate::troops::TroopTier::T1), 3000,
    );
    let muster = Command::CreateExplorer(
        CreateExplorer { slot: 0, structure_id: 1, category, tier: 0, amount: RESOURCE_PRECISION, direction: 5 },
    );
    for level in 0_u8..4 {
        if level != 0 {
            for cost in crate::logic::upgrades::recipe(level).costs {
                super::resource_commands::grant(d, home, *cost.resource_type, *cost.amount);
            }
            assert!(execute_in_game(d, game_id, Command::LevelUp(1), 351));
        }
        let record = structures.structure(home).unwrap();
        assert_eq!(record.base.troop_max_guard_count, 0);
        assert_eq!(record.base.troop_max_explorer_count, army_allowance(level));
        while structures.home_armies(home).len() < army_allowance(level).into() {
            let direction: u8 = structures.home_armies(home).len().try_into().unwrap();
            assert!(
                execute_in_game(
                    d,
                    game_id,
                    Command::CreateExplorer(
                        CreateExplorer {
                            slot: direction, structure_id: 1, category, tier: 0, amount: RESOURCE_PRECISION, direction,
                        },
                    ),
                    351,
                ),
            );
        }
        assert!(!execute_in_game(d, game_id, muster, 351));
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
        ),
    );
    assert!(
        execute_in_game(
            d, game_id, Command::ManageTroops(crate::troop_management::ManageTroops::RemoveExplorer(id)), 351,
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
fn depth_entry_requires_spire_lore_and_keeps_stamina_at_every_depth() {
    let d = setup();
    let mut preset = definition(true);
    open_entry(ref preset);
    preset.rules.day_unit_seconds = DAY_UNIT;
    let (_, frontier) = super::preset_projection::current_definition("frontier-check");
    preset.economy.labor = frontier.economy.labor;
    preset.rules.mode_rules = preset.rules.mode_rules | crate::rules::DEPTH_CONTENTS;
    preset.rules.map_config.camp_win_probability = 0;
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.rules.mode_rules = HOME_REWARDS | crate::rules::DEPTH_CONTENTS;
    preset.rules.command_mask = 0xffffffffffffffffffffffffffffffff;
    preset.structures.board = frontier.structures.board;
    preset.structures.research = frontier.structures.research;
    registry(d).register_preset(1, preset);
    let game_id = registry(d)
        .create_game(
            CreateGameParams {
                dev_mode_on: true, end_grace_seconds: 0, duration_seconds: 2 * BAG_SECONDS, ..params(false),
            },
        );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("catalogue_count"), array![].span(), 8000_u32,
    );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("traits"), array![1].span(), 0x4000001_u32,
    );
    super::play_fixture::reserve_fixture_homes(d.games, game_id, d.actor);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(crate::realms::SettleSeason { selected_realm: Some(1), order: None }),
            350,
        ),
    );
    let home = ResourceKey { game_id, entity_id: 1 };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let essence = ResourceSlot { game_id, entity_id: 1, resource_type: 38 };
    let mut lore_budget = 0;
    for price in frontier.structures.research {
        if *price.row == crate::research::ROW_LORE {
            lore_budget += (*price.price).essence;
        }
    }
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
            lore_budget,
            350,
            crate::commands::resource_context(
                crate::commands::ExecutionContext { timestamp: 350, ..crate::tests::context(d.games, (home).game_id) },
            ),
        );
    stop_cheat_caller_address(d.games);
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let troops = GameState { contract_address: d.games };
    let map = IMapLogicDispatcher { contract_address: d.games };
    // Today's spire stands on the home ring's direction (day % 6), day 0's on direction 0; each army musters on it or
    // beside it.
    let spire_direction: u8 = 0;
    let beside_spire = array![spire_direction, (spire_direction + 1) % 6, (spire_direction + 5) % 6];
    let mut armies = array![];
    for depth in 1_u8..4 {
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::CreateExplorer(
                    CreateExplorer {
                        slot: depth - 1,
                        structure_id: 1,
                        category: 0,
                        tier: 0,
                        amount: RESOURCE_PRECISION,
                        direction: *beside_spire.at((depth - 1).into()),
                    },
                ),
                351,
            ),
        );
        let explorer_id = *structures.home_armies(home).at((depth - 1).into());
        let key = ExplorerKey { game_id, explorer_id };
        let mut empty = troops.resolved_explorer(key).unwrap();
        empty.troops.stamina.set_amount(0);
        super::resource_commands::set_explorer_fixture(d.games, key, empty);
        armies.append(key);
    }
    let first = *armies.at(0);
    let unmoved = troops.resolved_explorer(first).unwrap();
    let enter_first = Command::EnterDepth(crate::commands::EnterDepth { explorer_id: first.explorer_id, depth: 1 });
    let buy = Command::Research(
        crate::research::Research { structure_id: 1, row: crate::research::ROW_LORE, choice: 0 },
    );
    for lore in 1_u8..crate::research::LORE_SPIRES + 1 {
        assert!(!execute_in_game(d, game_id, enter_first, 351));
        assert_eq!(troops.resolved_explorer(first).unwrap(), unmoved);
        let balance = resources.resource_balance(essence);
        assert!(execute_in_game(d, game_id, buy, 351));
        assert_eq!(
            crate::research::tier(
                snforge_std::interact_with_state(d.games, || crate::logic::research::require(home)).learned,
                crate::research::ROW_LORE,
            ),
            lore,
        );
        assert_eq!(
            balance - resources.resource_balance(essence),
            super::building_commands::research_price(frontier.structures.research, crate::research::ROW_LORE, lore)
                .essence,
        );
    }
    for depth in 1_u8..4 {
        let key = *armies.at((depth - 1).into());
        let explorer_id = key.explorer_id;
        let before = troops.resolved_explorer(key).unwrap();
        assert_eq!(before.troops.stamina.inline().amount, 0);
        let enter = Command::EnterDepth(crate::commands::EnterDepth { explorer_id, depth });
        let after_purchase = resources.resource_balance(essence);
        assert!(execute_in_game(d, game_id, enter, 351));
        assert_eq!(structures.structure(home).unwrap().metadata.deepest_depth, depth);
        let inside = troops.resolved_explorer(key).unwrap();
        // The army lands on revealed ground in the depth below, with no discovery on its landing tile.
        let landing = map.tile(crate::geometry::tile_key(game_id, inside.coord)).unwrap().data;
        assert_ne!(landing / 0x20000000000 % 256, 0);
        assert!(!map.occupancy(crate::geometry::tile_key(game_id, inside.coord)).unwrap().is_structure);
        assert_eq!(inside.coord.x, before.coord.x);
        assert_eq!(inside.coord.y, before.coord.y + Into::<u8, u32>::into(depth) * preset.settlement.spacing);
        assert_eq!(inside.troops.stamina.inline().amount, 0);
        assert_eq!(resources.resource_balance(essence), after_purchase);
        assert!(!execute_in_game(d, game_id, enter, 351));
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
                    d, game_id, Command::EnterDepth(crate::commands::EnterDepth { explorer_id, depth: 1 }), 351,
                ),
            );
            assert_eq!(structures.structure(home).unwrap().metadata.deepest_depth, 2);
        }
    }
    let balance = resources.resource_balance(essence);
    assert!(!execute_in_game(d, game_id, buy, 351));
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
                home,
                crate::research::RealmKnowledge {
                    learned: world_test_support::tests::registrar::lore(crate::research::LORE_SPIRES),
                },
            );
        },
    );
    let spacing = preset.settlement.spacing;
    // The army musters at t=351, on day 0.
    let spire = crate::expeditions::spire(spacing, 1, 0);
    let site = crate::expeditions::site(spacing, 1, 0, 0);
    let day: u8 = 0;
    assert_eq!(spire, crate::geometry::neighbor(site, day));
    // The next day's spire stands one step further round that day's ring.
    assert_eq!(
        crate::expeditions::spire(spacing, 1, 1),
        crate::geometry::neighbor(crate::expeditions::site(spacing, 1, 1, 0), (day + 1) % 6),
    );
    // An army beside the realm's site but two tiles from its spire cannot enter a depth.
    assert!(execute_in_game(d, game_id, muster_command(category, (day + 3) % 6), 351));
    let away = *structures.home_armies(home).at(0);
    let troops = GameState { contract_address: d.games };
    let before = troops.resolved_explorer(ExplorerKey { game_id, explorer_id: away }).unwrap();
    assert!(
        !execute_in_game(
            d, game_id, Command::EnterDepth(crate::commands::EnterDepth { explorer_id: away, depth: 1 }), 352,
        ),
    );
    assert_eq!(troops.resolved_explorer(ExplorerKey { game_id, explorer_id: away }).unwrap(), before);
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
    let (_, frontier) = super::preset_projection::current_definition("frontier-check");
    let (d, game_id, key) = setup_frontier_relics_with_preset(frontier, frontier.structures.board);
    let army = strong_frontier_army(d, game_id, key);
    let coord = crate::geometry::neighbor(army.coord, 0);
    let context = crate::commands::ExecutionContext { timestamp: 360, ..crate::tests::context(d.games, game_id) };
    start_cheat_caller_address(d.games, d.games);
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let id = structures
        .create_discovery(
            game_id, 1, coord, crate::discovery::Discovery::Beasts, seed, 360, crate::commands::action_context(context),
        );
    stop_cheat_caller_address(d.games);
    let site_key = ResourceKey { game_id, entity_id: id };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let home = ResourceKey { game_id, entity_id: army.owner };
    let wheat = ResourceSlot { game_id, entity_id: army.owner, resource_type: crate::resources::WHEAT };
    start_cheat_caller_address(d.games, d.games);
    crate::resources::IResourceOperationsDispatcherTrait::grant_resource(
        resources,
        home,
        crate::resources::WHEAT,
        if full {
            1000000 * RESOURCE_PRECISION
        } else {
            0
        },
        361,
        crate::commands::resource_context(context),
    );
    stop_cheat_caller_address(d.games);
    let before = resources.resource_balance(wheat);
    let cap = Into::<u32, u128>::into(crate::balance::structures::BOARD.settlement_resource_cap) * RESOURCE_PRECISION;
    assert_eq!(
        snforge_std::interact_with_state(
            d.games, || crate::logic::resources::store_limit(home, crate::resources::WHEAT),
        ),
        Some(cap),
    );
    if full {
        assert_eq!(before, cap);
    } else {
        assert!(before + 250 * RESOURCE_PRECISION <= cap);
    }
    let attack = Command::BattleGuard(
        crate::commands::Battle { attacker_id: key.explorer_id, defender_id: id, relic_slot: None },
    );
    assert!(execute_in_game(d, game_id, attack, 361));
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
    assert!(!execute_in_game(d, game_id, attack, 362));
    assert_eq!(resources.resource_balance(wheat), before + amount);
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
            assert_eq!(
                event.data.span(), array![1, game_id.into(), 3, 1, crate::presets::commitment(preset), 1].span(),
            );
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
fn frontier_refuses_off_map_economy_commands_before_reading_positions() {
    let d = setup();
    let mut preset = definition(false);
    preset.rules.day_unit_seconds = FRONTIER_DAY_UNIT;
    let (_, frontier) = super::preset_projection::current_definition("frontier-check");
    preset.economy.labor = frontier.economy.labor;
    preset.rules.mode_rules = preset.rules.mode_rules | crate::rules::DEPTH_CONTENTS;
    preset.rules.map_config.camp_win_probability = 0;
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset
        .rules
        .command_mask = (*read_txt(@FileTrait::new("../fixtures/frontier-command-mask.txt")).at(0))
        .try_into()
        .unwrap();
    registry(d).register_preset(1, preset);
    let game_id = registry(d).create_game(CreateGameParams { duration_seconds: FRONTIER_BAG_SECONDS, ..params(false) });
    let transfer = crate::resources::ResourceTransfer {
        from_entity_id: 1, to_entity_id: 2, resources: array![].span(),
    };
    for command in array![
        Command::SendResources(transfer), Command::TransferExplorerResourcesToStructure(transfer),
        Command::WithdrawResource(
            crate::bridge::Withdraw {
                structure_id: 1, recipient: d.actor, resource_type: 1, amount: 1, client_fee_recipient: d.actor,
            },
        ),
    ] {
        super::play_fixture::assert_preflight_rejection(
            d.games, super::play_fixture::TestAction { game_id, actor: d.actor, command }, 350,
        );
    }
}

#[test]
fn expedition_deploy_chooses_a_free_slot_and_refuses_occupied_or_unallowed_slots() {
    let d = setup();
    let (game_id, _, category) = expedition_home(d);
    let key = crate::troops::ArmySlotKey { game_id, structure_id: 1, epoch: 0, slot: 1 };
    let read_slot = |key| snforge_std::interact_with_state(d.games, || crate::logic::army_slot_storage::read(key));
    let troops = GameState { contract_address: d.games };
    assert!(execute_in_game(d, game_id, muster_slot_command(category, 0, 1), 351));
    let fresh = read_slot(key).unwrap();
    let explorer = ExplorerKey { game_id, explorer_id: fresh.explorer_id };
    let army = troops.explorer(explorer).unwrap();
    assert_eq!(army.troops.stamina, crate::troops::StaminaSource::Slot(1));
    assert_eq!(
        fresh.stamina.amount,
        crate::progression::stamina_max(
            Default::default(), army.troops.category, crate::balance::rules::TROOP_STAMINA_CONFIG,
        ),
    );
    assert!(read_slot(crate::troops::ArmySlotKey { slot: 0, ..key }).is_none());
    let home = ResourceKey { game_id, entity_id: 1 };
    let before = IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home);
    // Both commands aim at an empty tile: the slot check is what refuses them.
    assert!(!execute_in_game(d, game_id, muster_slot_command(category, 1, 1), 351));
    let beyond: u8 = crate::balance::rules::TROOP_LIMIT_CONFIG.settlement_armies.try_into().unwrap();
    assert!(!execute_in_game(d, game_id, muster_slot_command(category, 1, beyond), 351));
    assert_eq!(IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home), before);
    assert_eq!(read_slot(key).unwrap(), fresh);
    assert!(read_slot(crate::troops::ArmySlotKey { slot: beyond, ..key }).is_none());
    let mut tired = troops.resolved_explorer(explorer).unwrap();
    tired.troops.stamina.set_amount(7);
    super::resource_commands::set_explorer_fixture(d.games, explorer, tired);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::ManageTroops(crate::troop_management::ManageTroops::RemoveExplorer(explorer.explorer_id)),
            351,
        ),
    );
    // The higher slot keeps its bar even though the lower slot has never been used.
    assert!(execute_in_game(d, game_id, muster_slot_command(category, 0, 1), 351));
    let reused = read_slot(key).unwrap();
    assert!(reused.explorer_id != fresh.explorer_id);
    assert_eq!(reused.stamina.amount, 7);
    assert!(execute_in_game(d, game_id, muster_slot_command(category, 1, 0), 351));
    assert_eq!(read_slot(crate::troops::ArmySlotKey { slot: 0, ..key }).unwrap().stamina.amount, fresh.stamina.amount);
}

#[test]
fn expedition_slot_reuse_preserves_its_bar_and_the_next_day_allocates_a_fresh_bar() {
    let d = setup();
    let (game_id, _, category) = expedition_home(d);
    let (first, second) = expedition_armies(d, game_id, category);
    let slot_key = crate::troops::ArmySlotKey { game_id, structure_id: 1, epoch: 0, slot: 0 };
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
        ),
    );
    assert_eq!(read_slot(slot_key).unwrap().explorer_id, 0);
    assert_eq!(read_slot(slot_key).unwrap().stamina.amount, 7);
    assert!(execute_in_game(d, game_id, muster_command(category, 0), 351));
    let replacement = read_slot(slot_key).unwrap().explorer_id;
    assert!(replacement != first.explorer_id && replacement != 0);
    assert_eq!(read_slot(slot_key).unwrap().stamina.amount, 7);
    assert_eq!(read_slot(crate::troops::ArmySlotKey { slot: 1, ..slot_key }).unwrap().explorer_id, second.explorer_id);
    let tomorrow = day_start(d, game_id, 1);
    assert!(execute_in_game(d, game_id, muster_command(category, 0), tomorrow));
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
    let (game_id, _, category) = expedition_home(d);
    let (first, _) = expedition_armies(d, game_id, category);
    let key = crate::troops::ArmySlotKey { game_id, structure_id: 1, epoch: 0, slot: 0 };
    let troops = GameState { contract_address: d.games };
    let mut defeated = troops.resolved_explorer(first).unwrap();
    let before = defeated.troops.count;
    defeated.troops.count = 0;
    defeated.troops.stamina.set_amount(2);
    let defeated = defeated;
    let context = crate::commands::action_context(
        crate::commands::ExecutionContext { raw_root: 1, timestamp: 351, ..crate::tests::context(d.games, game_id) },
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
    assert!(execute_in_game(d, game_id, muster_command(category, 0), 352));
    let reused = snforge_std::interact_with_state(d.games, || crate::logic::army_slot_storage::read(key)).unwrap();
    assert!(reused.explorer_id != first.explorer_id && reused.explorer_id != 0);
    assert_eq!(reused.stamina, vacant.stamina);
}

#[test]
fn frontier_floor_counts_seven_player_reveals_across_armies_and_depths_then_resets_at_the_days_end() {
    let discovery = crate::expeditions::FrontierDiscoveryRules {
        shrine_bps: 0, well_bps: 0, ..crate::balance::expeditions::FRONTIER_DISCOVERY,
    };
    let (d, game_id, first) = setup_frontier_relics();
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::CreateExplorer(
                CreateExplorer {
                    slot: 1, structure_id: 1, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction: 1,
                },
            ),
            352,
        ),
    );
    let home = ResourceKey { game_id, entity_id: 1 };
    let second = ExplorerKey {
        game_id, explorer_id: *IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home).at(1),
    };
    let counter = crate::expeditions::ExpeditionDiscoveryKey { game_id, structure_id: 1, epoch: 0 };
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::expeditions::discovery(counter)).is_none());
    let tomorrow = day_start(d, game_id, 1);
    let mut time = 353_u64;
    for index in 0_u8..8 {
        let key = if index % 2 == 0 {
            first
        } else {
            second
        };
        let mut army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
        let centre = crate::expeditions::site(1024, 1, 0, index % 4);
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
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::CreateExplorer(
                CreateExplorer {
                    slot: 0, structure_id: 1, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction: 0,
                },
            ),
            tomorrow,
        ),
    );
    let third = *IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home).at(0);
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
    let (preset_id, preset) = super::preset_projection::current_definition("frontier-check");
    registry(d).register_preset(preset_id, preset);
    let game_id = registry(d)
        .create_game(
            CreateGameParams { preset_id, start_main_at: 360, duration_seconds: FRONTIER_BAG_SECONDS, ..params(false) },
        );
    let context = crate::commands::ExecutionContext { timestamp: 360, ..crate::tests::context(d.games, game_id) };
    start_cheat_caller_address(d.games, d.games);
    for depth_index in 0_u32..4 {
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
                alt: false, x: 100 + offset, y: depth_index * preset.settlement.spacing + preset.settlement.spacing / 2,
            };
            let seed = 123 + Into::<u32, u256>::into(offset);
            let id = IStructureOperationsDispatcher { contract_address: d.games }
                .create_discovery(game_id, 1, coord, discovery, seed, 360, crate::commands::action_context(context));
            let guard = IGuardsDispatcher { contract_address: d.games }
                .guard(GuardKey { game_id, structure_id: id, slot: 0 });
            let expected = if let crate::discovery::Discovery::Ruin(relic) = discovery {
                crate::troops::ruin_guard(relic, depth_index.try_into().unwrap(), seed, context.rules.unbox(), 360)
            } else {
                crate::troops::frontier_guard(category, depth, seed, context.rules.unbox(), 360)
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
    let (game_id, _, category) = expedition_home(d);
    let (key, _) = expedition_armies(d, game_id, category);
    let army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    let home = ResourceKey { game_id, entity_id: army.owner };
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
                raw_root: 0, timestamp: 360, ..crate::tests::context(d.games, game_id),
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
        crate::realms::SettleSeason { selected_realm: None, order: first_order_choice(d, game_id) },
    );
    assert!(execute_in_game(d, game_id, command, 360));
    assert!(execute_in_game(other, game_id, command, 360));
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
                assert_eq!(crate::state::read().games.home_reservations.read((game_id, actor)), 0);
            }
        },
    );
}


#[test]
fn frontier_ruin_clear_awards_its_stored_relic_without_lords() {
    let (d, game_id, key) = setup_frontier_relics();
    let army = strong_frontier_army(d, game_id, key);
    let coord = crate::geometry::neighbor(army.coord, 0);
    let site_key = place_ruin(d, game_id, coord, RELIC);
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
        361,
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
    let first = place_ruin(d, game_id, first_coord, RELIC);
    let second = place_ruin(d, game_id, second_coord, RELIC);
    let home = ResourceKey { game_id, entity_id: army.owner };
    let before = snforge_std::interact_with_state(
        d.games, || crate::logic::resources::balance(home, crate::resources::LORDS),
    );
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let mut timestamp = 361;
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
