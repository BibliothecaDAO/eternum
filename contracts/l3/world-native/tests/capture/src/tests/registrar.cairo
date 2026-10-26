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
    let yesterday = troops.resolved_explorer(old).unwrap().coord;
    assert!(execute_in_game(d, game_id, Command::Explore(Explore { explorer_id: old_id, direction: 0 }), 360));
    let after_explore = troops.resolved_explorer(old).unwrap().coord;
    let old_tile = map.tile(crate::geometry::tile_key(game_id, crate::geometry::neighbor(yesterday, 0)));
    let tomorrow = day_start(d, game_id, 1);
    assert!(!execute_in_game(d, game_id, Command::Explore(Explore { explorer_id: old_id, direction: 1 }), tomorrow));
    assert_eq!(troops.resolved_explorer(old).unwrap().coord, after_explore);
    assert!(execute_in_game(d, game_id, muster, tomorrow + 1));
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
                assert!(crate::expeditions::is_current(site, 1024, day));
                assert!(!crate::expeditions::is_current(site, 1024, day + 1));
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
    preset.economy.discovery = Some(super::preset_projection::frontier_discovery_rules());
    let (_, frontier) = super::preset_projection::current_definition("frontier");
    preset.economy.chests = frontier.economy.chests;
    preset.economy.labor = frontier.economy.labor;
    preset.economy.relics = array![].span();
    preset.settlement.depths = frontier.settlement.depths;
    preset.rules.mode_rules = preset.rules.mode_rules | crate::rules::DEPTH_CONTENTS;
    preset.rules.map_config.camp_win_probability = 0;
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.economy.progression = Some(super::preset_projection::frontier_progression_rules());
    preset.rules.mode_rules = HOME_REWARDS | crate::rules::UNOWNED_TARGETS | crate::rules::DEPTH_CONTENTS;
    preset.settlement.spacing = 1024;
    let limits = crate::rules::TroopLimitConfig {
        settlement_armies: 3,
        city_armies: 4,
        kingdom_armies: 5,
        empire_armies: 6,
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
            Command::SettleSeason(crate::realms::SettleSeason { name: 'home', selected_realm: Some(1) }),
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
        CreateExplorer { slot: 0, structure_id: 1, category, tier: 0, amount: RESOURCE_PRECISION, direction: 5 },
    );
    for level in 0_u8..4 {
        if level != 0 {
            assert!(execute_in_game(d, game_id, Command::LevelUp(1), 351));
        }
        let record = structures.structure(home).unwrap();
        assert_eq!(record.base.troop_max_guard_count, 0);
        assert_eq!(record.base.troop_max_explorer_count, Into::<u8, u16>::into(level) + 3);
        while structures.home_armies(home).len() < Into::<u8, u32>::into(level) + 3 {
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
fn frontier_and_eternum_set_no_reward_cap_so_a_frontier_reveal_still_pays_on_the_whole_army() {
    for name in array!["frontier", "eternum"] {
        let (_, preset) = super::preset_projection::current_definition(name);
        assert_eq!(preset.rules.troop_limit_config.explore_reward_strength_cap, 0);
    }
    // 20k T1 at the surface's 10 percent, through the real explore: 2,000, as before the Blitz cap.
    assert_capture_with_reveal(
        0, 20_000 * RESOURCE_PRECISION, crate::troops::TroopTier::T1, 2_000 * RESOURCE_PRECISION,
    );
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
fn depth_entry_requires_research_and_spends_only_the_selected_depth_stamina() {
    let d = setup();
    let mut preset = definition(true);
    open_entry(ref preset);
    preset.rules.day_unit_seconds = DAY_UNIT;
    preset.rules.tick_config.armies_tick_in_seconds = 60;
    preset.economy.discovery = Some(super::preset_projection::frontier_discovery_rules());
    let (_, frontier) = super::preset_projection::current_definition("frontier");
    preset.economy.chests = frontier.economy.chests;
    preset.economy.labor = frontier.economy.labor;
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
                    ruin_guard_lower: 2000,
                    ruin_guard_upper: 4000,
                    guard_step: 1,
                    beast_weak_lower: 1,
                    beast_weak_upper: 1,
                    beast_strong_lower: 2,
                    beast_strong_upper: 2,
                    reveal_percent: depth + 1,
                    site_guard_lower: depth + 3,
                    site_guard_upper: depth + 3,
                    reveal_site_neighbors: false,
                    entry_stamina: if depth == 0 {
                        0
                    } else {
                        20 + 10 * depth
                    },
                    chest: ChestTiers { common: 10000, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
                },
            );
    }
    preset.settlement.depths = depths.span();
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
            Command::SettleSeason(crate::realms::SettleSeason { name: 'home', selected_realm: Some(1) }),
            350,
        ),
    );
    let home = ResourceKey { game_id, entity_id: 1 };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let essence = ResourceSlot { game_id, entity_id: 1, resource_type: 38 };
    let mut depth_budget = 0;
    for price in frontier.structures.research {
        if *price.row == crate::research::ROW_DEPTH {
            depth_budget += (*price.price).essence;
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
            depth_budget,
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
        let before = troops.resolved_explorer(key).unwrap();
        let enter = Command::EnterDepth(crate::commands::EnterDepth { explorer_id, depth });
        assert!(!execute_in_game(d, game_id, enter, 351));
        assert_eq!(troops.resolved_explorer(key).unwrap(), before);
        let buy = Command::Research(
            crate::research::Research { structure_id: 1, row: crate::research::ROW_DEPTH, choice: 0 },
        );
        let balance = resources.resource_balance(essence);
        assert!(execute_in_game(d, game_id, buy, 351));
        assert_eq!(
            crate::research::tier(
                snforge_std::interact_with_state(d.games, || crate::logic::research::require(home)).learned,
                crate::research::ROW_DEPTH,
            ),
            depth,
        );
        let after_purchase = resources.resource_balance(essence);
        assert_eq!(
            balance - after_purchase,
            super::building_commands::research_price(frontier.structures.research, crate::research::ROW_DEPTH, depth)
                .essence,
        );
        assert!(execute_in_game(d, game_id, enter, 351));
        assert_eq!(structures.structure(home).unwrap().metadata.deepest_depth, depth);
        let inside = troops.resolved_explorer(key).unwrap();
        // The army lands on revealed ground in the depth below, with no discovery on its landing tile.
        let landing = map.tile(crate::geometry::tile_key(game_id, inside.coord)).unwrap().data;
        assert_ne!(landing / 0x20000000000 % 256, 0);
        assert!(!map.occupancy(crate::geometry::tile_key(game_id, inside.coord)).unwrap().is_structure);
        assert_eq!(inside.coord.x, before.coord.x);
        assert_eq!(inside.coord.y, before.coord.y + Into::<u8, u32>::into(depth) * preset.settlement.spacing);
        assert_eq!(inside.troops.stamina.inline().amount, 150 - (20 + Into::<u8, u64>::into(depth) * 10));
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
    // Ethereal III is the depth row's last tier.
    let balance = resources.resource_balance(essence);
    assert!(
        !execute_in_game(
            d,
            game_id,
            Command::Research(
                crate::research::Research { structure_id: 1, row: crate::research::ROW_DEPTH, choice: 0 },
            ),
            351,
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
                home,
                crate::research::RealmKnowledge { learned: crate::research::learn(0, crate::research::ROW_DEPTH, 0) },
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
fn frontier_ruin_clear_pays_its_stored_chest_into_the_realm_and_leaves_no_chest() {
    let (d, game_id, key) = setup_frontier_chests();
    let army = strong_frontier_army(d, game_id, key);
    let coord = crate::geometry::neighbor(army.coord, 0);
    let site_key = place_ruin(d, game_id, coord, CHEST);
    let site = site_key.entity_id;
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    assert_eq!(structures.structure(site_key).unwrap().base.category, crate::taxonomy::RUIN_CATEGORY);
    // The card and the clear read the one row stored at discovery.
    let relics = IRelicsDispatcher { contract_address: d.games };
    assert_eq!(relics.site_chest(site_key), Some(CHEST));
    let initial = snforge_std::interact_with_state(
        d.games, || crate::logic::expeditions::expedition_site(site_key).unwrap(),
    );
    assert_eq!(structures.structure(site_key).unwrap().base.category, crate::taxonomy::RUIN_CATEGORY);
    assert!(
        initial.initial_guard_count >= 2000
            * RESOURCE_PRECISION && initial.initial_guard_count <= 4000
            * RESOURCE_PRECISION,
    );
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let lords = ResourceSlot { game_id, entity_id: army.owner, resource_type: crate::resources::LORDS };
    let before = resources.resource_balance(lords);
    let mut spy = snforge_std::spy_events();
    let captured = execute_in_game(
        d,
        game_id,
        Command::BattleGuard(crate::commands::Battle { attacker_id: key.explorer_id, defender_id: site }),
        361,
    );
    assert!(captured, "chest capture failed");
    assert_eq!(resources.resource_balance(lords) - before, CHEST.amount * RESOURCE_PRECISION);
    let pool = relics.lords_budget(game_id).unwrap().pool;
    assert_eq!(relics.lords_budget(game_id).unwrap().pool_left, pool - CHEST.amount);
    let tile = crate::geometry::tile_key(game_id, coord);
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile)).is_none());
    assert_site_removed(d, site_key);
    assert_eq!(relics.site_chest(site_key), Some(CHEST));
    let receipt = snforge_std::interact_with_state(
        d.games, || crate::logic::expeditions::expedition_site(site_key).unwrap().clear.unwrap(),
    );
    assert_eq!(receipt.explorer_id, key.explorer_id);
    assert_eq!(receipt.home_id, army.owner);
    assert_eq!(receipt.reward.unwrap().amount, resources.resource_balance(lords) - before);
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
                assert_eq!(
                    payout.reward,
                    Some(
                        crate::resources::ResourceAmount {
                            resource_type: crate::resources::LORDS, amount: CHEST.amount * RESOURCE_PRECISION,
                        },
                    ),
                );
            }
        }
    }
    assert_eq!(payouts, 1);
}

#[test]
fn a_beast_clear_pays_labor_once_keeps_xp_and_removes_its_blocker() {
    beast_clear_payout(false);
}

#[test]
fn a_beast_clear_clips_labor_at_storage_but_keeps_all_xp() {
    beast_clear_payout(true);
}

fn beast_clear_payout(full: bool) {
    let (_, frontier) = super::preset_projection::current_definition("frontier");
    let (d, game_id, key) = setup_frontier_chests_with_preset(None, frontier, frontier.structures.board);
    let army = strong_frontier_army(d, game_id, key);
    let coord = crate::geometry::neighbor(army.coord, 0);
    let context = crate::commands::ExecutionContext { timestamp: 360, ..crate::tests::context(d.games, game_id) };
    start_cheat_caller_address(d.games, d.games);
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let id = structures
        .create_discovery(
            game_id, 1, coord, crate::discovery::Discovery::Beasts, 123, 360, crate::commands::action_context(context),
        );
    stop_cheat_caller_address(d.games);
    let site_key = ResourceKey { game_id, entity_id: id };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let home = ResourceKey { game_id, entity_id: army.owner };
    let labor = ResourceSlot { game_id, entity_id: army.owner, resource_type: crate::resources::LABOR };
    start_cheat_caller_address(d.games, d.games);
    crate::resources::IResourceOperationsDispatcherTrait::grant_resource(
        resources,
        home,
        crate::resources::LABOR,
        if full {
            1000000 * RESOURCE_PRECISION
        } else {
            0
        },
        361,
        crate::commands::resource_context(context),
    );
    stop_cheat_caller_address(d.games);
    let before = resources.resource_balance(labor);
    let cap = 6000 * RESOURCE_PRECISION;
    assert_eq!(
        snforge_std::interact_with_state(
            d.games, || crate::logic::resources::store_limit(home, crate::resources::LABOR),
        ),
        Some(cap),
    );
    if full {
        assert_eq!(before, cap);
    } else {
        assert!(before + 250 * RESOURCE_PRECISION <= cap);
    }
    let xp = snforge_std::interact_with_state(d.games, || crate::logic::progression::require(key).xp);
    let attack = Command::BattleGuard(crate::commands::Battle { attacker_id: key.explorer_id, defender_id: id });
    assert!(execute_in_game(d, game_id, attack, 361));
    let site = snforge_std::interact_with_state(
        d.games, || crate::logic::expeditions::expedition_site(site_key).unwrap(),
    );
    let amount = if full {
        0
    } else {
        site.initial_guard_count / 4
    };
    assert_eq!(
        site.clear,
        Some(
            crate::expeditions::SiteClear {
                explorer_id: key.explorer_id,
                home_id: army.owner,
                reward: Some(crate::resources::ResourceAmount { resource_type: crate::resources::LABOR, amount }),
            },
        ),
    );
    assert_eq!(resources.resource_balance(labor) - before, amount);
    assert_eq!(
        snforge_std::interact_with_state(d.games, || crate::logic::progression::require(key).xp),
        xp + crate::progression::clear_xp(site.initial_guard_count),
    );
    assert_site_removed(d, site_key);
    assert!(
        snforge_std::interact_with_state(
            d.games, || crate::logic::map::occupancy(crate::geometry::tile_key(game_id, coord)),
        )
            .is_none(),
    );
    assert!(!execute_in_game(d, game_id, attack, 362));
    assert_eq!(resources.resource_balance(labor), before + amount);
    assert_eq!(
        snforge_std::interact_with_state(d.games, || crate::logic::progression::require(key).xp),
        xp + crate::progression::clear_xp(site.initial_guard_count),
    );
}

#[test]
fn an_exhausted_budget_never_funds_a_ruin_or_payout() {
    let rules = crate::expeditions::FrontierDiscoveryRules {
        beasts_bps: 1, camp_bps: 0, rift_bps: 0, ruin_bps: 8000, shrine_bps: 0, well_bps: 0, empty_reveal_limit: 7,
    };
    let (d, game_id, key) = setup_frontier_chests_with_rules(Some(rules));
    let context = crate::tests::context(d.games, game_id);
    let raw_root = discovery_root(game_id, rules, 0, Some(any_chest()), crate::discovery::Discovery::Ruin(any_chest()));
    let army = strong_frontier_army(d, game_id, key);
    let time = 360_u64;
    snforge_std::interact_with_state(
        d.games,
        || {
            let day = crate::days::day_of(context.game.unbox(), context.rules.unbox().day_unit_seconds, time).index;
            let exhausted = crate::relics::LordsBudget {
                pool_left: 0,
                ..crate::logic::lords_budget::first_day(crate::logic::lords_budget::chest_rules(game_id), 1000000, day),
            };
            crate::state::write().relics.rollover_budget.write(game_id, Some(exhausted));
        },
    );
    let lords = ResourceSlot { game_id, entity_id: army.owner, resource_type: crate::resources::LORDS };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let before = resources.resource_balance(lords);
    let mut spy = snforge_std::spy_events();
    assert!(explore_with_root(d, game_id, key.explorer_id, raw_root, time));
    let tile = crate::geometry::tile_key(game_id, crate::geometry::neighbor(army.coord, 0));
    let site = snforge_std::interact_with_state(d.games, || crate::map::structure_occupant(tile)).unwrap();
    let before_attack = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    let guards = IGuardsDispatcher { contract_address: d.games };
    let guard_key = GuardKey { game_id, structure_id: site, slot: 0 };
    let before_guard = guards.guard(guard_key);
    let mut refused = snforge_std::spy_events();
    assert!(
        !execute_in_game(
            d,
            game_id,
            Command::BattleGuard(crate::commands::Battle { attacker_id: key.explorer_id, defender_id: site }),
            time + 1,
        ),
    );
    assert_eq!(super::play_fixture::rejection(ref refused, d.games).reason, "day's LORDS budget cannot fund this ruin");
    assert_eq!(guards.guard(guard_key), before_guard);
    assert_eq!(GameState { contract_address: d.games }.resolved_explorer(key).unwrap(), before_attack);
    let budget = IRelicsDispatcher { contract_address: d.games }.lords_budget(game_id).unwrap();
    assert_eq!((budget.pool_left, budget.open), (0, 0));
    assert_eq!(resources.resource_balance(lords), before);
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        for selector in event.keys.span() {
            if *selector == selector!("StoryEvent") {
                let mut keys = event.keys.span().slice(1, event.keys.len() - 1);
                let mut data = event.data.span();
                let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
                if let crate::ownership::Story::SitePayout(_) = story.story {
                    panic!("unfunded site paid LORDS");
                }
            }
        }
    }
}

#[test]
fn frontier_reveals_many_ruins_clears_one_and_starts_fresh_the_next_day() {
    let rules = ruin_discovery_rules();
    let (d, game_id, key) = setup_frontier_chests_with_rules(Some(rules));
    let army = strong_frontier_army(d, game_id, key);
    let (first, _) = reveal_ruin(d, key, rules, 360);
    let (second, second_direction) = reveal_ruin(d, key, rules, 361);
    let deeper_coord = crate::expeditions::site(1024, 1, 0, 1);
    let deeper = place_ruin(d, game_id, deeper_coord, CHEST);
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    assert!(structures.structure(first).is_some() && structures.structure(second).is_some());
    let relics = IRelicsDispatcher { contract_address: d.games };
    assert_eq!(relics.lords_budget(game_id).unwrap().open, 0);
    let chest = relics.site_chest(first).unwrap();
    let lords = ResourceSlot { game_id, entity_id: army.owner, resource_type: crate::resources::LORDS };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let before = resources.resource_balance(lords);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::BattleGuard(
                crate::commands::Battle { attacker_id: key.explorer_id, defender_id: first.entity_id },
            ),
            362,
        ),
    );
    assert_eq!(resources.resource_balance(lords) - before, chest.amount * RESOURCE_PRECISION);
    assert!(structures.structure(first).is_none() && structures.structure(second).is_none());
    assert!(structures.structure(deeper).is_none());
    assert!(
        snforge_std::interact_with_state(
            d.games, || crate::logic::map::occupancy(crate::geometry::tile_key(game_id, deeper_coord)),
        )
            .is_none(),
    );
    let other_tile = crate::geometry::tile_key(game_id, crate::geometry::neighbor(army.coord, second_direction));
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(other_tile)).is_none());
    assert!(
        snforge_std::interact_with_state(d.games, || crate::logic::expeditions::expedition_site(second).unwrap().clear)
            .is_none(),
    );
    assert!(
        !execute_in_game(
            d,
            game_id,
            Command::BattleGuard(
                crate::commands::Battle { attacker_id: key.explorer_id, defender_id: second.entity_id },
            ),
            363,
        ),
    );
    assert_eq!(resources.resource_balance(lords) - before, chest.amount * RESOURCE_PRECISION);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::Move(
                crate::commands::Move { explorer_id: key.explorer_id, directions: array![second_direction].span() },
            ),
            364,
        ),
    );
    assert!(structures.structure(second).is_none(), "walked-over ruin remains absent");
    assert!(
        !execute_in_game(
            d,
            game_id,
            Command::BattleGuard(
                crate::commands::Battle { attacker_id: key.explorer_id, defender_id: second.entity_id },
            ),
            364,
        ),
    );
    assert_eq!(resources.resource_balance(lords) - before, chest.amount * RESOURCE_PRECISION);
    let back = (second_direction + 3) % 6;
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::Move(crate::commands::Move { explorer_id: key.explorer_id, directions: array![back].span() }),
            364,
        ),
    );
    assert!(structures.structure(second).is_none(), "vacated ruin remains absent");
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(other_tile)).is_none());
    assert!(
        !execute_in_game(
            d,
            game_id,
            Command::BattleGuard(
                crate::commands::Battle { attacker_id: key.explorer_id, defender_id: second.entity_id },
            ),
            364,
        ),
    );
    assert_eq!(resources.resource_balance(lords) - before, chest.amount * RESOURCE_PRECISION);
    let moved = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    let root = discovery_root(game_id, rules, 0, Some(any_chest()), crate::discovery::Discovery::Ruin(any_chest()));
    let mut explored = false;
    for direction in 0_u8..6 {
        let tile = crate::geometry::tile_key(game_id, crate::geometry::neighbor(moved.coord, direction));
        if snforge_std::interact_with_state(d.games, || crate::logic::map::tile(tile).is_some()) {
            continue;
        }
        assert!(
            super::play_fixture::play(
                d.games,
                super::play_fixture::TestAction {
                    game_id,
                    actor: d.actor,
                    command: Command::Explore(Explore { explorer_id: key.explorer_id, direction }),
                },
                root,
                365,
            ),
        );
        assert!(
            snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile))
                .map(|value| value.category != crate::taxonomy::RUIN_OCCUPIER)
                .unwrap_or(true),
        );
        explored = true;
        break;
    }
    assert!(explored, "fixture must explore after the clear");
    let tomorrow = day_start(d, game_id, 1);
    assert!(execute_in_game(d, game_id, muster_command(0, 0), tomorrow));
    let fresh = ExplorerKey {
        game_id, explorer_id: *structures.home_armies(ResourceKey { game_id, entity_id: army.owner }).at(0),
    };
    strong_frontier_army(d, game_id, fresh);
    let (next, _) = reveal_ruin(d, fresh, rules, tomorrow + 1);
    let reward = relics.site_chest(next).unwrap();
    let before = resources.resource_balance(lords);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::BattleGuard(
                crate::commands::Battle { attacker_id: fresh.explorer_id, defender_id: next.entity_id },
            ),
            tomorrow + 2,
        ),
    );
    assert_eq!(resources.resource_balance(lords) - before, reward.amount * RESOURCE_PRECISION);
}

#[test]
fn a_full_refill_costs_one_lords_a_point_returns_to_the_pool_and_is_allowed_beside_a_ruin() {
    let (d, game_id, key) = setup_frontier_chests();
    let army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    place_ruin(d, game_id, crate::geometry::neighbor(army.coord, 0), CHEST);
    // The army's bar lives in its slot; tire it there.
    let mut tired = army.troops;
    let mut bar = tired.stamina.inline();
    bar.amount = 40;
    tired.stamina = crate::troops::StaminaSource::Inline(bar);
    let tired = tired;
    snforge_std::interact_with_state(
        d.games,
        || {
            let record = crate::state::read().troops.explorers.read((game_id, key.explorer_id));
            crate::logic::army_slot_storage::persist(key, record, tired);
        },
    );
    let refill = Command::RefillStamina(crate::relics::RefillStamina { explorer_id: key.explorer_id });
    // LORDS can only be earned: without them the refill is refused.
    assert!(!execute_in_game(d, game_id, refill, 362));
    let home = ResourceKey { game_id, entity_id: army.owner };
    let maximum: u128 = 150;
    let missing = maximum - 40;
    start_cheat_caller_address(d.games, d.games);
    IResourceOperationsDispatcher { contract_address: d.games }
        .grant_resource(
            home,
            crate::resources::LORDS,
            (missing + 7) * RESOURCE_PRECISION,
            362,
            crate::commands::resource_context(
                crate::commands::ExecutionContext { timestamp: 362, ..crate::tests::context(d.games, game_id) },
            ),
        );
    stop_cheat_caller_address(d.games);
    // The synthetic grant has the same backing debit as a real chest payout.
    snforge_std::interact_with_state(
        d.games,
        || {
            let mut budget = crate::logic::lords_budget::budget(game_id).unwrap();
            budget.pool_left -= missing + 7;
            crate::state::write().relics.rollover_budget.write(game_id, Some(budget));
        },
    );
    let relics = IRelicsDispatcher { contract_address: d.games };
    let pool_before = relics.lords_budget(game_id).unwrap().pool_left;
    assert!(execute_in_game(d, game_id, refill, 362));
    let filled = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    assert_eq!(Into::<u64, u128>::into(filled.troops.stamina.inline().amount), maximum);
    let lords = ResourceSlot { game_id, entity_id: army.owner, resource_type: crate::resources::LORDS };
    assert_eq!(
        IResourceOperationsDispatcher { contract_address: d.games }.resource_balance(lords), 7 * RESOURCE_PRECISION,
    );
    assert_eq!(relics.lords_budget(game_id).unwrap().pool_left, pool_before + missing);
    // A full bar has nothing to refill.
    assert!(!execute_in_game(d, game_id, refill, 363));
}

#[test]
fn a_lords_withdrawal_after_season_end_spends_the_realm_once() {
    let (d, game_id, key) = setup_frontier_chests();
    let army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    let home = ResourceKey { game_id, entity_id: army.owner };
    start_cheat_caller_address(d.games, d.games);
    IResourceOperationsDispatcher { contract_address: d.games }
        .grant_resource(
            home,
            crate::resources::LORDS,
            300 * RESOURCE_PRECISION,
            362,
            crate::commands::resource_context(
                crate::commands::ExecutionContext { timestamp: 362, ..crate::tests::context(d.games, game_id) },
            ),
        );
    stop_cheat_caller_address(d.games);
    let withdraw = Command::WithdrawLords(crate::relics::WithdrawLords { structure_id: home.entity_id, amount: 200 });
    let mut spy = snforge_std::spy_events();
    let after_end = IGameDispatcher { contract_address: d.games }.game(game_id).end_at + 1;
    snforge_std::start_cheat_transaction_hash(d.games, 56789);
    assert!(execute_in_game(d, game_id, withdraw, after_end));
    snforge_std::start_cheat_transaction_hash(d.games, 56790);
    assert!(!execute_in_game(d, game_id, withdraw, after_end + 1));
    // A new affordable debit with the original hash must not overwrite its receipt.
    snforge_std::start_cheat_transaction_hash(d.games, 56789);
    let duplicate = Command::WithdrawLords(crate::relics::WithdrawLords { structure_id: home.entity_id, amount: 50 });
    assert!(!execute_in_game(d, game_id, duplicate, after_end + 2));
    let deadline = IGameDispatcher { contract_address: d.games }.game(game_id).end_at
        + Into::<
            u32, u64,
        >::into(
            snforge_std::interact_with_state(
                d.games, || crate::logic::lords_budget::chest_rules(game_id).claim_window_seconds,
            ),
        );
    super::play_fixture::assert_preflight_rejection(
        d.games, super::play_fixture::TestAction { game_id, actor: d.actor, command: duplicate }, deadline,
    );
    let lords = ResourceSlot { game_id, entity_id: home.entity_id, resource_type: crate::resources::LORDS };
    assert_eq!(
        IResourceOperationsDispatcher { contract_address: d.games }.resource_balance(lords), 100 * RESOURCE_PRECISION,
    );
    let mut withdrawals = 0;
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if event.keys.len() > 1 && *event.keys.at(1) == selector!("StoryEvent") {
            let mut keys = event.keys.span().slice(2, event.keys.len() - 2);
            let mut data = event.data.span();
            let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
            if let crate::ownership::Story::LordsWithdrawn(withdrawal) = story.story {
                withdrawals += 1;
                assert_eq!(withdrawal, crate::relics::LordsWithdrawal { account: d.actor, amount: 200 });
                assert_eq!(story.version, 2);
                assert_eq!(story.tx_hash, 56789);
                let stored = snforge_std::interact_with_state(
                    d.games, || {
                        crate::state::read().relics.lords_withdrawals.read(story.tx_hash)
                    },
                );
                assert_eq!(stored, Some(withdrawal));
            }
        }
    }
    assert_eq!(withdrawals, 1);
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
fn launcher_rotation_preserves_roster_batch_settlements() {
    let first_run = setup();
    let (helper_account, _) = super::deploy_player(3, super::GUARDIAN);
    let helper_run = super::Deployment { actor: helper_account, ..setup() };
    let preset = definition(true);
    let request = CreateGameParams { roster: roster(1), ..params(true) };
    registry(first_run).register_preset(1, preset);
    registry(helper_run).register_preset(1, preset);
    let game_id = registry(first_run).create_game(request);
    assert_eq!(registry(helper_run).create_game(request), game_id);
    let first_games = IGameDispatcher { contract_address: first_run.games };
    let helper_games = IGameDispatcher { contract_address: helper_run.games };
    let game = first_games.game(game_id);
    for d in array![first_run, helper_run] {
        super::resource_commands::set_fixture(
            d.games, selector!("games"), selector!("games"), array![game_id.into()].span(), game,
        );
        // Each run seats as its own actor: name it the game's seater.
        super::resource_commands::set_fixture(
            d.games, selector!("registrar"), selector!("seaters"), array![game_id.into()].span(), d.actor,
        );
    }
    assert!(helper_run.actor != first_run.actor);
    let first_views = ISettlementViewsDispatcher { contract_address: first_run.games };
    let helper_views = ISettlementViewsDispatcher { contract_address: helper_run.games };
    super::play_fixture::assert_preflight_rejection(
        first_run.games,
        super::play_fixture::TestAction { game_id, actor: super::authority(), command: Command::SettleBlitzRoster },
        205,
    );
    for batch in 0_u64..2 {
        assert!(execute_in_game(first_run, game_id, Command::SettleBlitzRoster, 205 + batch));
        assert!(execute_in_game(helper_run, game_id, Command::SettleBlitzRoster, 205 + batch));
        assert_eq!(first_views.blitz_settlement_order(game_id), helper_views.blitz_settlement_order(game_id));
        assert_eq!(first_views.settlement_progress(game_id), helper_views.settlement_progress(game_id));
        assert_eq!(first_games.game(game_id), helper_games.game(game_id));
    }
    let next = next_setup_entity(first_run, game_id);
    assert_eq!(next, next_setup_entity(helper_run, game_id));
    for setup_id in 1..next {
        let entity_id: u64 = setup_id.into();
        let key = ResourceKey { game_id, entity_id };
        let first = IStructureOperationsDispatcher { contract_address: first_run.games }.structure(key);
        let helper = IStructureOperationsDispatcher { contract_address: helper_run.games }.structure(key);
        assert_eq!(first, helper);
    }
}

#[test]
fn frontier_refuses_off_map_economy_commands_before_reading_positions() {
    let d = setup();
    let mut preset = definition(false);
    preset.rules.day_unit_seconds = FRONTIER_DAY_UNIT;
    preset.economy.discovery = Some(super::preset_projection::frontier_discovery_rules());
    let (_, frontier) = super::preset_projection::current_definition("frontier");
    preset.economy.chests = frontier.economy.chests;
    preset.economy.labor = frontier.economy.labor;
    preset.economy.relics = array![].span();
    preset.settlement.depths = frontier.settlement.depths;
    preset.rules.mode_rules = preset.rules.mode_rules | crate::rules::DEPTH_CONTENTS;
    preset.rules.map_config.camp_win_probability = 0;
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.economy.progression = Some(super::preset_projection::frontier_progression_rules());
    preset.settlement.spacing = 1024;
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
        super::play_fixture::assert_preflight_rejection(
            d.games, super::play_fixture::TestAction { game_id, actor: d.actor, command }, 350,
        );
    }
}

#[test]
fn expedition_deploy_chooses_a_free_slot_and_refuses_occupied_or_unallowed_slots() {
    let d = setup();
    let (game_id, preset, category) = expedition_home(d);
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
            crate::progression::initial(), army.troops.category, preset.rules.troop_stamina_config,
        ),
    );
    assert!(read_slot(crate::troops::ArmySlotKey { slot: 0, ..key }).is_none());
    let home = ResourceKey { game_id, entity_id: 1 };
    let before = IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home);
    // Both commands aim at an empty tile: the slot check is what refuses them.
    assert!(!execute_in_game(d, game_id, muster_slot_command(category, 1, 1), 351));
    assert!(!execute_in_game(d, game_id, muster_slot_command(category, 1, 2), 351));
    assert_eq!(IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home), before);
    assert_eq!(read_slot(key).unwrap(), fresh);
    assert!(read_slot(crate::troops::ArmySlotKey { slot: 2, ..key }).is_none());
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
    let (game_id, preset, category) = expedition_home(d);
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
    // The next day's first army starts full at its own maximum, not at the configured initial bar.
    let fresh = troops.explorer(ExplorerKey { game_id, explorer_id: next.explorer_id }).unwrap().troops;
    assert_eq!(
        next.stamina.amount,
        crate::progression::stamina_max(
            crate::progression::initial(), fresh.category, preset.rules.troop_stamina_config,
        ),
    );
    assert!(next.stamina.amount > preset.rules.troop_stamina_config.stamina_initial.into());
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
        shrine_bps: 0, well_bps: 0, ..super::preset_projection::frontier_discovery_rules(),
    };
    let (d, game_id, first) = setup_frontier_chests_with_rules(Some(discovery));
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
        let root = discovery_root(game_id, discovery, index, Some(any_chest()), expected);
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
    let root = discovery_root(game_id, discovery, 0, Some(any_chest()), crate::discovery::Discovery::None);
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
    let (preset_id, preset) = super::preset_projection::current_definition("frontier");
    registry(d).register_preset(preset_id, preset);
    let game_id = registry(d)
        .create_game(
            CreateGameParams { preset_id, start_main_at: 360, duration_seconds: FRONTIER_BAG_SECONDS, ..params(false) },
        );
    let context = crate::commands::ExecutionContext { timestamp: 360, ..crate::tests::context(d.games, game_id) };
    start_cheat_caller_address(d.games, d.games);
    for depth_index in 0_u32..4 {
        let depth = *preset.settlement.depths.at(depth_index);
        for (discovery, category, offset) in array![
            (crate::discovery::Discovery::Camp, crate::taxonomy::CAMP_CATEGORY, 0_u32),
            (crate::discovery::Discovery::Rift, crate::taxonomy::RIFT_CATEGORY, 1),
            (crate::discovery::Discovery::Ruin(any_chest()), crate::taxonomy::RUIN_CATEGORY, 2),
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
            let expected = crate::troops::frontier_guard(category, depth, seed, context.rules.unbox(), 360);
            assert_eq!(guard.troops, expected);
            if category == crate::taxonomy::BEASTS_CATEGORY {
                let ranges = array![
                    (300_u128, 350_u128, 450_u128, 550_u128), (900, 1050, 1350, 1650), (2400, 2800, 3600, 4400),
                    (6000, 7000, 9000, 11000),
                ];
                let (weak_lower, weak_upper, strong_lower, strong_upper) = *ranges.at(depth_index);
                let count = guard.troops.count / RESOURCE_PRECISION;
                assert!(
                    (count >= weak_lower && count <= weak_upper) || (count >= strong_lower && count <= strong_upper),
                );
                assert_eq!(guard.troops.category, crate::troops::TroopType::Knight);
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
fn frontier_shrine_and_well_persist_once_and_use_the_public_progress_and_slot() {
    let d = setup();
    let mut stories = snforge_std::spy_events();
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
            crate::logic::map::MapState::occupy(tile, 900, crate::taxonomy::SHRINE_OCCUPIER, false);
        },
    );
    let closed = snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile).unwrap());
    start_cheat_block_timestamp_global(360);
    assert_eq!(snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile).unwrap()), closed);
    assert!(execute_in_game(d, game_id, command, 360));
    let progress = snforge_std::interact_with_state(d.games, || crate::logic::progression::require(key));
    assert_eq!(progress.xp, 7 + 200);
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile)).is_none());
    assert!(!execute_in_game(d, game_id, command, 360));
    snforge_std::interact_with_state(
        d.games, || crate::logic::map::MapState::occupy(tile, 901, crate::taxonomy::SHRINE_OCCUPIER, false),
    );
    assert!(execute_in_game(d, game_id, command, 360));
    let progress = snforge_std::interact_with_state(d.games, || crate::logic::progression::require(key));
    assert_eq!(progress.xp, 7 + 200 + 200);
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile)).is_none());
    assert!(!execute_in_game(d, game_id, command, 360));
    snforge_std::interact_with_state(
        d.games,
        || {
            crate::logic::map::MapState::occupy(tile, 902, crate::taxonomy::WELL_OCCUPIER, false);
            crate::logic::progression::write(key, crate::progression::ArmyProgress { logistics: 3, ..progress });
            let mut army = crate::logic::troops::active_explorer(
                key, 360, crate::commands::load_context(game_id, 0, 360),
            );
            army.troops.stamina.set_amount(10);
            crate::logic::troops::TroopState::save(key, army.into_record());
        },
    );
    // A well's stamina persists into the same occupied slot.
    assert!(execute_in_game(d, game_id, command, 360));
    let filled = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    assert_eq!(filled.troops.stamina.inline().amount, 70);
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile)).is_none());
    assert!(!execute_in_game(d, game_id, command, 360));
    snforge_std::interact_with_state(
        d.games,
        || {
            crate::logic::map::MapState::occupy(tile, 903, crate::taxonomy::WELL_OCCUPIER, false);
            let mut army = crate::logic::troops::active_explorer(
                key, 360, crate::commands::load_context(game_id, 0, 360),
            );
            let maximum = crate::progression::stamina_max(
                crate::logic::progression::require(key),
                army.troops.category,
                crate::commands::load_context(game_id, 0, 360).rules.unbox().troop_stamina_config,
            );
            army.troops.stamina.set_amount(maximum - 5);
            crate::logic::troops::TroopState::save(key, army.into_record());
        },
    );
    let before = GameState { contract_address: d.games }.resolved_explorer(key).unwrap().troops.stamina.inline().amount;
    assert!(execute_in_game(d, game_id, command, 360));
    assert_eq!(
        GameState { contract_address: d.games }.resolved_explorer(key).unwrap().troops.stamina.inline().amount,
        before + 5,
    );

    // The story records actual gains: a near-full well gives 5, and a full well gives 0.
    snforge_std::interact_with_state(
        d.games, || crate::logic::map::MapState::occupy(tile, 904, crate::taxonomy::WELL_OCCUPIER, false),
    );
    assert!(execute_in_game(d, game_id, command, 360));
    assert!(!execute_in_game(d, game_id, command, 360));
    let expected = array![
        crate::relics::SiteBenefit::Shrine(200), crate::relics::SiteBenefit::Shrine(200),
        crate::relics::SiteBenefit::Well(60), crate::relics::SiteBenefit::Well(5), crate::relics::SiteBenefit::Well(0),
    ];
    let mut used = 0;
    for (_, event) in stories.get_events().emitted_by(d.games).events.span() {
        // Component stories may have their component selector before StoryEvent.
        let offset = if *event.keys.at(0) == selector!("StoryEvent") {
            1
        } else {
            if event.keys.len() < 2 || *event.keys.at(1) != selector!("StoryEvent") {
                continue;
            }
            2
        };
        let mut keys = event.keys.span().slice(offset, event.keys.len() - offset);
        let mut data = event.data.span();
        let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
        if let crate::ownership::Story::SiteUsed(visit) = story.story {
            assert_eq!(story.game_id, game_id);
            assert_eq!(story.entity_id, Some(key.explorer_id));
            assert_eq!(story.owner, Some(d.actor));
            assert_eq!(story.timestamp, 360);
            assert_eq!(visit.explorer_id, key.explorer_id);
            assert_eq!(visit.coord, coord);
            assert_eq!(visit.benefit, *expected.at(used));
            used += 1;
        }
    }
    assert_eq!(used, expected.len(), "one story per successful use, none for refusals");
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
    for (expected, row, category) in array![
        (crate::discovery::Discovery::Shrine, crate::research::ROW_SHRINE, crate::taxonomy::SHRINE_OCCUPIER),
        (crate::discovery::Discovery::Well, crate::research::ROW_WELL, crate::taxonomy::WELL_OCCUPIER),
    ] {
        let enabled = crate::expeditions::FrontierDiscoveryRules {
            shrine_bps: if row == crate::research::ROW_SHRINE {
                rules.shrine_bps
            } else {
                0
            },
            well_bps: if row == crate::research::ROW_WELL {
                rules.well_bps
            } else {
                0
            },
            ..rules,
        };
        let mut chosen = None;
        for sample in 0_u64..10000 {
            let seed: u256 = sample.into();
            if crate::discovery::frontier(enabled, 0, 0, 0, 0, Some(any_chest()), seed) == expected {
                chosen = Some(seed);
                break;
            }
        }
        let seed = chosen.expect('MISSING_SITE_ROOT');
        let coord = crate::geometry::neighbor(army.coord, 0);
        let tile = crate::geometry::tile_key(game_id, coord);
        let context = crate::commands::action_context(
            crate::commands::ExecutionContext {
                raw_root: 0, timestamp: 360, ..crate::tests::context(d.games, game_id),
            },
        );
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
                    home, crate::research::RealmKnowledge { learned: crate::research::learn(0, row, 0) },
                );
                crate::logic::expeditions::record_discovery(
                    crate::expeditions::ExpeditionDiscoveryKey { game_id, structure_id: army.owner, epoch: 0 },
                    crate::discovery::Discovery::Camp,
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

#[test]
fn open_frontier_settlement_uses_only_each_players_home_and_entry() {
    let d = setup();
    let (_, preset) = super::preset_projection::current_definition("frontier");
    registry(d).register_preset(1, preset);
    let game_id = registry(d)
        .create_game(
            CreateGameParams {
                start_main_at: 360,
                end_grace_seconds: 0,
                duration_seconds: Into::<u32, u64>::into(preset.rules.day_unit_seconds) * 20,
                ..params(false),
            },
        );
    snforge_std::interact_with_state(
        d.games,
        || {
            let state = crate::state::write();
            state.realms.catalogue_count.write(crate::realms::CANONICAL_REALM_COUNT);
            for index in 1_u32..crate::realms::CANONICAL_REALM_COUNT + 1 {
                state.realms.traits.write(index, 0x4000001);
            }
        },
    );
    let before = next_setup_entity(d, game_id);
    let views = ISettlementViewsDispatcher { contract_address: d.games };
    let progress = views.settlement_progress(game_id);
    let other = super::bind_authority(d);
    let command = Command::SettleSeason(crate::realms::SettleSeason { name: 'home', selected_realm: None });
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
