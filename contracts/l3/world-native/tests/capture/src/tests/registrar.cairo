pub use world_test_support::tests::registrar::*;
use crate::logic::release::{IReleasesDispatcher, IReleasesDispatcherTrait, Release};


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
        for depth in 0_u8..3 {
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
            d, game_id, Command::SettleSeason(crate::realms::SettleSeason { selected_realm: Some(1) }), 350,
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
fn depth_entry_requires_research_and_keeps_stamina_at_every_depth() {
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
            d, game_id, Command::SettleSeason(crate::realms::SettleSeason { selected_realm: Some(1) }), 350,
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
        let mut empty = troops.resolved_explorer(key).unwrap();
        empty.troops.stamina.set_amount(0);
        super::resource_commands::set_explorer_fixture(d.games, key, empty);
        let before = troops.resolved_explorer(key).unwrap();
        assert_eq!(before.troops.stamina.inline().amount, 0);
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
        if depth == 3 {
            assert_eq!(inside.coord, crate::deep::arrival(preset.settlement.spacing));
        } else {
            assert_eq!(inside.coord.x, before.coord.x);
            assert_eq!(inside.coord.y, before.coord.y + Into::<u8, u32>::into(depth) * preset.settlement.spacing);
        }
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
    // A later day's army still uses the same Deep, while its slot belongs to that later day.
    let tomorrow = day_start(d, game_id, 1);
    for slot in 0_u8..2 {
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::CreateExplorer(
                    CreateExplorer {
                        slot, structure_id: 1, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction: slot + 1,
                    },
                ),
                tomorrow + 1,
            ),
        );
        let explorer_id = *structures.home_armies(home).at(slot.into());
        assert!(
            execute_in_game(
                d, game_id, Command::EnterDepth(crate::commands::EnterDepth { explorer_id, depth: 3 }), tomorrow + 1,
            ),
        );
        let key = ExplorerKey { game_id, explorer_id };
        let army = troops.resolved_explorer(key).unwrap();
        assert!(crate::deep::contains(army.coord, preset.settlement.spacing));
        assert_eq!(snforge_std::interact_with_state(d.games, || crate::logic::army_days::require(key)), 1);
        if slot == 0 {
            assert_eq!(army.coord, crate::deep::arrival(preset.settlement.spacing));
        } else {
            assert_ne!(army.coord, crate::deep::arrival(preset.settlement.spacing));
            assert!(crate::geometry::adjacent(army.coord, crate::deep::arrival(preset.settlement.spacing)));
        }
    }
    let first = *structures.home_armies(home).at(0);
    let key = ExplorerKey { game_id, explorer_id: first };
    let origin = troops.resolved_explorer(key).unwrap().coord;
    // Direction 3 points away from the nearest-free arrival, which takes direction 0 first.
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::Move(crate::commands::Move { explorer_id: first, directions: array![3].span() }),
            tomorrow + 2,
        ),
    );
    assert_eq!(troops.resolved_explorer(key).unwrap().coord, crate::geometry::neighbor(origin, 3));
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
        xp + crate::progression::clear_xp(site.initial_guard_count, 0),
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
        xp + crate::progression::clear_xp(site.initial_guard_count, 0),
    );
}

#[test]
fn an_exhausted_budget_never_funds_a_ruin_or_payout() {
    let rules = crate::expeditions::FrontierDiscoveryRules {
        beasts_bps: 1, camp_bps: 0, rift_bps: 0, ruin_bps: 8000, shrine_bps: 0, well_bps: 0, empty_reveal_limit: 7,
    };
    let (d, game_id, key) = setup_frontier_chests_with_rules(Some(rules));
    apply_ruin_depth_release(d, game_id);
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
    assert!(
        !snforge_std::interact_with_state(
            d.games,
            || crate::logic::expeditions::ruin_cleared_at(
                crate::expeditions::ExpeditionDiscoveryKey { game_id, structure_id: army.owner, epoch: 0 }, 0,
            ),
        ),
    );
    assert!(
        snforge_std::interact_with_state(
            d.games,
            || crate::logic::expeditions::expedition_site(ResourceKey { game_id, entity_id: site }).unwrap().clear,
        )
            .is_none(),
    );
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
fn frontier_closes_only_the_cleared_depth_and_starts_fresh_the_next_day() {
    let rules = ruin_discovery_rules();
    let (d, game_id, key) = setup_frontier_chests_with_rules(Some(rules));
    apply_ruin_depth_release(d, game_id);
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
    assert!(structures.structure(deeper).is_some());
    assert!(
        snforge_std::interact_with_state(
            d.games, || crate::logic::map::occupancy(crate::geometry::tile_key(game_id, deeper_coord)),
        )
            .is_some(),
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
    let refill = Command::RefillStamina(crate::relics::RefillStamina { explorer_id: key.explorer_id, amount: 110 });
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
    for amount in array![0_u64, 111].span() {
        let invalid = Command::RefillStamina(
            crate::relics::RefillStamina { explorer_id: key.explorer_id, amount: *amount },
        );
        assert!(!execute_in_game(d, game_id, invalid, 362));
    }
    let partial = Command::RefillStamina(crate::relics::RefillStamina { explorer_id: key.explorer_id, amount: 30 });
    assert!(execute_in_game(d, game_id, partial, 362));
    let partly_filled = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    assert_eq!(partly_filled.troops.stamina.inline().amount, 70);
    assert_eq!(relics.lords_budget(game_id).unwrap().pool_left, pool_before + 30);
    let remainder = Command::RefillStamina(crate::relics::RefillStamina { explorer_id: key.explorer_id, amount: 80 });
    assert!(execute_in_game(d, game_id, remainder, 362));
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
                assert_eq!(
                    withdrawal,
                    crate::relics::LordsWithdrawal { account: d.actor, amount: 200, prize_rank: 0, prize_count: 0 },
                );
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
                let count: u16 = (guard.troops.count / RESOURCE_PRECISION).try_into().unwrap();
                assert!(
                    (count >= depth.beast_weak_lower && count <= depth.beast_weak_upper)
                        || (count >= depth.beast_strong_lower && count <= depth.beast_strong_upper),
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
            crate::logic::shrines::discover(ResourceKey { game_id, entity_id: 900 }, 2, 123);
            crate::logic::map::MapState::occupy(tile, 900, crate::taxonomy::SHRINE_OCCUPIER, false);
        },
    );
    let first_reward = snforge_std::interact_with_state(
        d.games, || crate::logic::shrines::read(ResourceKey { game_id, entity_id: 900 }).unwrap(),
    );
    let closed = snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile).unwrap());
    start_cheat_block_timestamp_global(360);
    assert_eq!(snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile).unwrap()), closed);
    assert!(execute_in_game(d, game_id, command, 360));
    let progress = snforge_std::interact_with_state(d.games, || crate::logic::progression::require(key));
    assert_eq!(progress.xp, 7);
    assert_eq!(crate::progression::points(progress, first_reward.rank), 1);
    assert!(
        snforge_std::interact_with_state(
            d.games, || crate::logic::shrines::read(ResourceKey { game_id, entity_id: 900 }),
        )
            .is_none(),
    );
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile)).is_none());
    assert!(!execute_in_game(d, game_id, command, 360));
    snforge_std::interact_with_state(
        d.games,
        || {
            crate::logic::shrines::discover(ResourceKey { game_id, entity_id: 901 }, 3, 456);
            crate::logic::map::MapState::occupy(tile, 901, crate::taxonomy::SHRINE_OCCUPIER, false);
        },
    );
    assert!(execute_in_game(d, game_id, command, 360));
    let progress = snforge_std::interact_with_state(d.games, || crate::logic::progression::require(key));
    let second_rank = crate::progression::shrine_point(
        3, crate::random::range(456, 'shrine point', 10000).try_into().unwrap(),
    );
    assert_eq!(progress.xp, 7);
    assert_eq!(
        progress.common_points
            + progress.uncommon_points
            + progress.rare_points
            + progress.epic_points
            + progress.legendary_points,
        2,
    );
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
    assert_eq!(filled.troops.stamina.inline().amount, 107);
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
        crate::relics::SiteBenefit::ShrinePoint(first_reward.rank),
        crate::relics::SiteBenefit::ShrinePoint(second_rank), crate::relics::SiteBenefit::Well(97),
        crate::relics::SiteBenefit::Well(5), crate::relics::SiteBenefit::Well(0),
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
fn frontier_site_discovery_reads_home_knowledge_and_stores_the_shrine_reward() {
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
                let reward = crate::logic::shrines::read(ResourceKey { game_id, entity_id: occupancy.entity_id });
                if category == crate::taxonomy::SHRINE_OCCUPIER {
                    assert_eq!(
                        reward.unwrap().rank,
                        crate::progression::shrine_point(
                            0, crate::random::range(seed, 'shrine point', 10000).try_into().unwrap(),
                        ),
                    );
                } else {
                    assert!(reward.is_none());
                }
                crate::logic::map::MapState::vacate(tile, occupancy.entity_id);
                crate::logic::research::write(home, crate::research::RealmKnowledge { learned: 0 });
            },
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
    let command = Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None });
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

#[test_case(name: "legacy_surface", 0)]
#[test_case(name: "legacy_depth_one", 1)]
#[test_case(name: "legacy_depth_two", 2)]
#[test_case(name: "legacy_depth_three", 3)]
fn legacy_clear_survives_release_application_and_other_depths_pay(first_depth: u8) {
    let rules = ruin_discovery_rules();
    let (d, game_id, key) = setup_frontier_chests_with_rules(Some(rules));
    let army = strong_frontier_army(d, game_id, key);
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let relics = IRelicsDispatcher { contract_address: d.games };
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let lords = ResourceSlot { game_id, entity_id: army.owner, resource_type: crate::resources::LORDS };
    let before = resources.resource_balance(lords);
    let pool = relics.lords_budget(game_id).unwrap().pool_left;
    let counter = crate::expeditions::ExpeditionDiscoveryKey { game_id, structure_id: army.owner, epoch: 0 };
    let releases = IReleasesDispatcher { contract_address: d.games };
    let target = crate::logic::release::RUIN_DEPTH_LIMIT_RELEASE;
    let unrelated = super::declare_logic("LegacyRuinLimitFixture");
    start_cheat_caller_address(d.games, super::authority());
    for release_id in 2..target + 1 {
        releases.register_release(release_id, releases.release(1));
    }
    let game_classes = releases.release(1);
    releases
        .register_release(
            target + 1,
            Release {
                classes: games_storage::release::LogicClasses {
                    map: unrelated, troops: unrelated, ..game_classes.classes,
                },
                ..game_classes,
            },
        );
    stop_cheat_caller_address(d.games);
    assert_eq!(releases.current_release(), target + 1);
    assert_eq!(releases.game_release(game_id), 1);

    let legacy_deep_ruins = place_legacy_depth_three_ruins(d, game_id);
    let mut total_paid = 0_u128;
    for offset in 0_u8..4 {
        let timestamp = 360_u64 + Into::<u8, u64>::into(offset) * 3;
        let depth = (first_depth + offset) % 4;
        let coord = crate::geometry::neighbor(crate::expeditions::site(1024, 1, 0, depth), 0);
        super::resource_commands::set_explorer_fixture(d.games, key, crate::troops::ExplorerTroops { coord, ..army });
        let (ruin, sibling) = if depth == 3 {
            legacy_deep_ruins
        } else {
            let (ruin, _) = reveal_ruin(d, key, rules, timestamp);
            let (sibling, _) = reveal_ruin(d, key, rules, timestamp + 1);
            (ruin, sibling)
        };
        let chest = relics.site_chest(ruin).unwrap();
        let site = snforge_std::interact_with_state(
            d.games, || crate::logic::expeditions::expedition_site(ruin).unwrap(),
        );
        let xp = snforge_std::interact_with_state(d.games, || crate::logic::progression::require(key).xp);
        total_paid += chest.amount;
        assert!(structures.structure(ruin).is_some());
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::BattleGuard(
                    crate::commands::Battle { attacker_id: key.explorer_id, defender_id: ruin.entity_id },
                ),
                timestamp + 2,
            ),
        );
        assert_site_removed(d, ruin);
        snforge_std::interact_with_state(
            d.games,
            || {
                let state = crate::state::read();
                assert_eq!(state.structures.structures.read((game_id, ruin.entity_id)).base.category, 0);
                assert_eq!(state.map.occupancy.read((game_id, site.alt, site.col, site.row)), 0);
                assert_eq!(
                    crate::logic::expeditions::expedition_site(ruin).unwrap().clear,
                    Some(
                        crate::expeditions::SiteClear {
                            explorer_id: key.explorer_id,
                            home_id: army.owner,
                            reward: Some(
                                crate::resources::ResourceAmount {
                                    resource_type: crate::resources::LORDS, amount: chest.amount * RESOURCE_PRECISION,
                                },
                            ),
                        },
                    ),
                );
                assert_eq!(
                    crate::logic::progression::require(key).xp,
                    xp + crate::progression::clear_xp(site.initial_guard_count, depth),
                );
            },
        );
        assert_eq!(resources.resource_balance(lords) - before, total_paid * RESOURCE_PRECISION);
        assert_eq!(pool - relics.lords_budget(game_id).unwrap().pool_left, total_paid);
        assert!(structures.structure(sibling).is_none());
        let after = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
        assert!(
            !execute_in_game(
                d,
                game_id,
                Command::BattleGuard(
                    crate::commands::Battle { attacker_id: key.explorer_id, defender_id: sibling.entity_id },
                ),
                timestamp + 2,
            ),
        );
        assert_eq!(GameState { contract_address: d.games }.resolved_explorer(key).unwrap(), after);
        assert_eq!(resources.resource_balance(lords) - before, total_paid * RESOURCE_PRECISION);
        if offset == 0 {
            snforge_std::interact_with_state(
                d.games,
                || {
                    let allocated = crate::state::read().games.home_entities.read((game_id, 1));
                    for _ in allocated..346 {
                        crate::entity_ids::allocate_home(game_id, army.owner);
                    }
                },
            );
            // Registration alone left the old home-wide rule in force.
            for candidate in 0_u8..4 {
                assert!(
                    snforge_std::interact_with_state(
                        d.games, || crate::logic::expeditions::ruin_cleared_at(counter, candidate),
                    ),
                );
            }
            assert_eq!(
                snforge_std::interact_with_state(
                    d.games, || crate::state::read().map_rules.cleared_ruin_depths.read((game_id, 1, 0)),
                ),
                0,
            );
            start_cheat_caller_address(d.games, super::authority());
            for release_id in 2..target + 1 {
                releases.apply_release(game_id, release_id);
            }
            releases.apply_release(game_id, target);
            stop_cheat_caller_address(d.games);
            for candidate in 0_u8..4 {
                assert_eq!(
                    snforge_std::interact_with_state(
                        d.games, || crate::logic::expeditions::ruin_cleared_at(counter, candidate),
                    ),
                    candidate == first_depth,
                );
            }
        }
    }
    assert!(
        snforge_std::interact_with_state(d.games, || crate::state::read().map_rules.ruin_cleared.read((game_id, 1, 0))),
    );
    for depth in 0_u8..4 {
        assert!(
            snforge_std::interact_with_state(d.games, || crate::logic::expeditions::ruin_cleared_at(counter, depth)),
        );
        assert!(
            !snforge_std::interact_with_state(
                d.games,
                || crate::logic::expeditions::ruin_cleared_at(
                    crate::expeditions::ExpeditionDiscoveryKey { epoch: 1, ..counter }, depth,
                ),
            ),
        );
    }
}

fn place_legacy_depth_three_ruins(d: super::Deployment, game_id: u32) -> (ResourceKey, ResourceKey) {
    let army_coord = crate::geometry::neighbor(crate::deep::center(1024), 0);
    let first = crate::geometry::neighbor(army_coord, 0);
    let second = crate::geometry::neighbor(army_coord, 1);
    snforge_std::interact_with_state(
        d.games,
        || {
            for coord in array![first, second] {
                assert!(crate::logic::deep::contains(game_id, coord));
                assert!(crate::logic::map::tile(crate::geometry::tile_key(game_id, coord)).is_some());
            }
        },
    );
    (place_ruin(d, game_id, first, CHEST), place_ruin(d, game_id, second, CHEST))
}

#[test]
fn fixed_deep_refuses_exploration_without_changing_the_army_or_visible_tile() {
    let (d, game_id, key) = setup_frontier_chests_with_rules(Some(ruin_discovery_rules()));
    let army = crate::troops::ExplorerTroops {
        coord: crate::deep::center(1024), ..strong_frontier_army(d, game_id, key),
    };
    super::resource_commands::set_explorer_fixture(d.games, key, army);
    let tile = crate::geometry::tile_key(game_id, crate::geometry::neighbor(army.coord, 0));
    let before = snforge_std::interact_with_state(d.games, || crate::logic::map::tile(tile));
    assert!(before.is_some());
    assert!(
        !execute_in_game(d, game_id, Command::Explore(Explore { explorer_id: key.explorer_id, direction: 0 }), 360),
    );
    assert_eq!(GameState { contract_address: d.games }.resolved_explorer(key).unwrap(), army);
    assert_eq!(snforge_std::interact_with_state(d.games, || crate::logic::map::tile(tile)), before);
}

#[starknet::interface]
trait ILegacyRuinLimit<T> {
    fn close_ruin(ref self: T, game_id: u32, home: u64, day: u64);
}

#[starknet::contract]
mod LegacyRuinLimitFixture {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    #[storage]
    struct Storage {}
    #[abi(embed_v0)]
    impl Legacy of super::ILegacyRuinLimit<ContractState> {
        fn close_ruin(ref self: ContractState, game_id: u32, home: u64, day: u64) {
            let key = (game_id, crate::entity_ids::namespace(home).into(), day);
            let state = crate::state::write();
            assert!(!state.map_rules.ruin_cleared.read(key), "realm already cleared a ruin today");
            state.map_rules.ruin_cleared.write(key, true);
        }
    }
}

#[test]
fn later_legacy_class_cannot_add_a_clear_after_a_depth_mask_and_reupgrade_preserves_it() {
    let (d, game_id, _) = setup_frontier_chests();
    apply_ruin_depth_release(d, game_id);
    let counter = crate::expeditions::ExpeditionDiscoveryKey { game_id, structure_id: 1, epoch: 0 };
    snforge_std::interact_with_state(d.games, || crate::logic::expeditions::close_ruins(counter, 2));
    let releases = IReleasesDispatcher { contract_address: d.games };
    let first = crate::logic::release::RUIN_DEPTH_LIMIT_RELEASE;
    let new_rules = releases.release(first);
    let legacy = super::declare_logic("LegacyRuinLimitFixture");
    start_cheat_caller_address(d.games, super::authority());
    releases
        .register_release(
            first + 1,
            Release { classes: games_storage::release::LogicClasses { map: legacy, ..new_rules.classes }, ..new_rules },
        );
    releases.apply_release(game_id, first + 1);
    stop_cheat_caller_address(d.games);
    let rejected = snforge_std::interact_with_state(
        d.games,
        || {
            starknet::syscalls::library_call_syscall(
                legacy, selector!("close_ruin"), array![game_id.into(), 1, 0].span(),
            )
        },
    )
        .unwrap_err();
    let mut expected = array![core::byte_array::BYTE_ARRAY_MAGIC];
    let reason: ByteArray = "realm already cleared a ruin today";
    reason.serialize(ref expected);
    expected.append('ENTRYPOINT_FAILED');
    assert_eq!(rejected, expected);
    start_cheat_caller_address(d.games, super::authority());
    releases.register_release(first + 2, new_rules);
    releases.apply_release(game_id, first + 2);
    stop_cheat_caller_address(d.games);
    for depth in 0_u8..4 {
        assert_eq!(
            snforge_std::interact_with_state(d.games, || crate::logic::expeditions::ruin_cleared_at(counter, depth)),
            depth == 2,
        );
    }
}

#[test]
fn legacy_pin_cleans_site_before_closing_without_new_map_selectors() {
    let rules = ruin_discovery_rules();
    let (d, game_id, key) = setup_frontier_chests_with_rules(Some(rules));
    let army = strong_frontier_army(d, game_id, key);
    let (ruin, _) = reveal_ruin(d, key, rules, 360);
    let (sibling, _) = reveal_ruin(d, key, rules, 361);
    let releases = IReleasesDispatcher { contract_address: d.games };
    let first = releases.release(1);
    let legacy = super::declare_logic("LegacyRuinLimitFixture");
    start_cheat_caller_address(d.games, super::authority());
    releases
        .register_release(
            2, Release { classes: games_storage::release::LogicClasses { map: legacy, ..first.classes }, ..first },
        );
    releases.apply_release(game_id, 2);
    stop_cheat_caller_address(d.games);
    snforge_std::interact_with_state(
        d.games,
        || {
            let counter = crate::expeditions::ExpeditionDiscoveryKey { game_id, structure_id: army.owner, epoch: 0 };
            assert!(!crate::logic::expeditions::ruin_disappeared(ruin));
            let site = crate::logic::expeditions::expedition_site(ruin).unwrap();
            let receipt = crate::expeditions::SiteClear {
                explorer_id: key.explorer_id, home_id: army.owner, reward: None,
            };
            let depth = crate::logic::expeditions::depth_at(
                game_id, crate::troops::Coord { alt: site.alt, x: site.col, y: site.row },
            );
            crate::logic::expeditions::clear_rewarded_site(ruin, site, receipt, depth);
            crate::logic::expeditions::cache_ruin_depths(counter);
            for depth in 0_u8..4 {
                assert!(crate::logic::expeditions::ruin_cleared_at(counter, depth));
            }
            assert!(crate::logic::expeditions::ruin_disappeared(sibling));
            let state = crate::state::read();
            assert_eq!(state.map_rules.cleared_ruin_depths.read((game_id, 1, 0)), 0);
            assert_eq!(state.structures.structures.read((game_id, ruin.entity_id)).base.category, 0);
            assert_eq!(state.map.occupancy.read((game_id, site.alt, site.col, site.row)), 0);
            assert_eq!(crate::logic::expeditions::expedition_site(ruin).unwrap().clear, Some(receipt));
            for slot in 0_u8..4 {
                assert_eq!(
                    crate::logic::guards::guard(
                        crate::guards::GuardKey { game_id, structure_id: ruin.entity_id, slot },
                    ),
                    Default::default(),
                );
            }
            assert!(!crate::logic::expeditions::ruin_disappeared(ruin));
        },
    );
}

#[derive(Copy, Drop)]
struct LegacyRecoveryFixture {
    deployment: super::Deployment,
    key: ExplorerKey,
    army: crate::troops::ExplorerTroops,
    paid: ResourceKey,
    cold: ResourceKey,
    warm: ResourceKey,
    populated: u32,
}

fn legacy_recovery_fixture(allocated: u32) -> LegacyRecoveryFixture {
    let (d, game_id, key) = setup_frontier_chests();
    let army = strong_frontier_army(d, game_id, key);
    let paid = place_ruin(d, game_id, crate::geometry::neighbor(army.coord, 0), CHEST);
    let cold_position = crate::geometry::neighbor(crate::expeditions::site(1024, 1, 0, 1), 0);
    let warm_position = crate::geometry::neighbor(crate::expeditions::site(1024, 1, 0, 2), 0);
    let cold = place_ruin(d, game_id, crate::geometry::neighbor(cold_position, 0), CHEST);
    let warm = place_ruin(d, game_id, crate::geometry::neighbor(warm_position, 0), CHEST);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::BattleGuard(crate::commands::Battle { attacker_id: key.explorer_id, defender_id: paid.entity_id }),
            361,
        ),
    );
    let populated = snforge_std::interact_with_state(
        d.games,
        || {
            let state = crate::state::write();
            let before = state.games.home_entities.read((game_id, 1));
            assert!(allocated >= before);
            for index in before..allocated {
                let entity_id = crate::entity_ids::allocate_home(game_id, army.owner);
                let other_day_ruin = index % 2 == 0;
                let coord = crate::expeditions::site(1024, 1, 1, 2);
                state
                    .structures
                    .expedition_sites
                    .write(
                        (game_id, entity_id),
                        Some(
                            crate::expeditions::ExpeditionSite {
                                category: if other_day_ruin {
                                    crate::taxonomy::RUIN_CATEGORY
                                } else {
                                    crate::taxonomy::CAMP_CATEGORY
                                },
                                initial_guard_count: 2000 * RESOURCE_PRECISION,
                                alt: false,
                                col: coord.x,
                                row: coord.y,
                                clear: Some(
                                    crate::expeditions::SiteClear {
                                        explorer_id: key.explorer_id, home_id: army.owner, reward: None,
                                    },
                                ),
                            },
                        ),
                    );
                if other_day_ruin {
                    state
                        .structures
                        .site_chests
                        .write((game_id, entity_id), Some(SiteChest { reservation_day: 1, ..CHEST }));
                }
            }
            crate::logic::map::MapState::reveal(
                crate::geometry::tile_key(game_id, crate::geometry::neighbor(cold_position, 2)),
                crate::biome::Biome::Grassland.into(),
            );
            allocated - before + 3
        },
    );
    let army = crate::troops::ExplorerTroops { coord: cold_position, ..army };
    super::resource_commands::set_explorer_fixture(d.games, key, army);
    apply_ruin_depth_release(d, game_id);
    LegacyRecoveryFixture { deployment: d, key, army, paid, cold, warm, populated }
}

#[inline(never)]
fn measured_ruin_command(d: super::Deployment, game_id: u32, command: Command) -> (bool, u128) {
    let before = core::testing::get_available_gas();
    let applied = execute_in_game(d, game_id, command, 362);
    (applied, before - core::testing::get_available_gas())
}

#[test_case(name: "move_32_populated", 32, 0)]
#[test_case(name: "move_346_populated", 346, 0)]
#[test_case(name: "move_369_populated_inventory", 369, 0)]
#[test_case(name: "move_1024_populated_stress", 1024, 0)]
#[test_case(name: "attack_32_populated", 32, 1)]
#[test_case(name: "attack_346_populated", 346, 1)]
#[test_case(name: "attack_369_populated_inventory", 369, 1)]
#[test_case(name: "attack_1024_populated_stress", 1024, 1)]
#[test_case(name: "refusal_32_populated", 32, 2)]
#[test_case(name: "refusal_346_populated", 346, 2)]
#[test_case(name: "refusal_369_populated_inventory", 369, 2)]
#[test_case(name: "refusal_1024_populated_stress", 1024, 2)]
fn legacy_recovery_command_cost_and_refusal_atomicity(allocated: u32, kind: u8) {
    let fixture = legacy_recovery_fixture(allocated);
    let d = fixture.deployment;
    let key = fixture.key;
    let game_id = key.game_id;
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let relics = IRelicsDispatcher { contract_address: d.games };
    let lords = ResourceSlot { game_id, entity_id: fixture.army.owner, resource_type: crate::resources::LORDS };
    let funds = resources.resource_balance(lords);
    let funded = relics.lords_budget(game_id).unwrap();
    let guard_key = GuardKey { game_id, structure_id: fixture.cold.entity_id, slot: 0 };
    let guards = IGuardsDispatcher { contract_address: d.games };
    let guard_before = guards.guard(guard_key);
    let site_before = snforge_std::interact_with_state(
        d.games, || crate::logic::expeditions::expedition_site(fixture.cold),
    );
    let army_before = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    let command = if kind == 0 {
        Command::Move(crate::commands::Move { explorer_id: key.explorer_id, directions: array![2].span() })
    } else {
        Command::BattleGuard(
            crate::commands::Battle { attacker_id: key.explorer_id, defender_id: fixture.cold.entity_id },
        )
    };
    if kind == 2 {
        snforge_std::interact_with_state(
            d.games,
            || {
                crate::state::write()
                    .relics
                    .rollover_budget
                    .write(game_id, Some(crate::relics::LordsBudget { pool_left: 0, ..funded }));
            },
        );
    }
    let budget_before = relics.lords_budget(game_id).unwrap();
    let mut rejected = snforge_std::spy_events();
    let (applied, cold_gas) = measured_ruin_command(d, game_id, command);
    assert_eq!(applied, kind != 2);
    println!(
        "legacy recovery allocated={} populated={} depth=1 kind={} phase=cold applied={} samples=1 helper_gas={}",
        allocated,
        fixture.populated,
        kind,
        applied,
        cold_gas,
    );
    if kind == 2 {
        assert_eq!(
            super::play_fixture::rejection(ref rejected, d.games).reason, "day's LORDS budget cannot fund this ruin",
        );
        assert_eq!(
            snforge_std::interact_with_state(
                d.games, || crate::state::read().map_rules.cleared_ruin_depths.read((game_id, 1, 0)),
            ),
            0,
        );
        assert!(
            snforge_std::interact_with_state(
                d.games, || crate::state::read().map_rules.ruin_cleared.read((game_id, 1, 0)),
            ),
        );
        assert_eq!(GameState { contract_address: d.games }.resolved_explorer(key).unwrap(), army_before);
        assert_eq!(guards.guard(guard_key), guard_before);
        assert_eq!(
            snforge_std::interact_with_state(d.games, || crate::logic::expeditions::expedition_site(fixture.cold)),
            site_before,
        );
        assert_eq!(resources.resource_balance(lords), funds);
        assert_eq!(relics.lords_budget(game_id).unwrap(), budget_before);
        snforge_std::interact_with_state(
            d.games, || crate::state::write().relics.rollover_budget.write(game_id, Some(funded)),
        );
        let (retried, retry_gas) = measured_ruin_command(d, game_id, command);
        assert!(retried);
        println!(
            "legacy recovery allocated={} populated={} depth=1 kind={} phase=cold-retry applied=true samples=1 helper_gas={}",
            allocated,
            fixture.populated,
            kind,
            retry_gas,
        );
    }
    let mask = snforge_std::interact_with_state(
        d.games, || crate::state::read().map_rules.cleared_ruin_depths.read((game_id, 1, 0)),
    );
    assert_eq!(mask, if kind == 0 {
        1
    } else {
        3
    });
    let warm_army = if kind == 0 {
        fixture.army
    } else {
        crate::troops::ExplorerTroops {
            coord: crate::geometry::neighbor(crate::expeditions::site(1024, 1, 0, 2), 0), ..fixture.army,
        }
    };
    super::resource_commands::set_explorer_fixture(d.games, key, warm_army);
    let warm_command = if kind == 0 {
        command
    } else {
        Command::BattleGuard(
            crate::commands::Battle { attacker_id: key.explorer_id, defender_id: fixture.warm.entity_id },
        )
    };
    let (warm_applied, warm_gas) = measured_ruin_command(d, game_id, warm_command);
    assert!(warm_applied);
    println!(
        "legacy recovery allocated={} populated={} depth={} kind={} phase=warm applied=true samples=1 helper_gas={} absolute_delta={}",
        allocated,
        fixture.populated,
        if kind == 0 {
            1
        } else {
            2
        },
        kind,
        warm_gas,
        if cold_gas >= warm_gas {
            cold_gas - warm_gas
        } else {
            warm_gas - cold_gas
        },
    );
    assert_eq!(
        resources.resource_balance(lords) - funds, if kind == 0 {
            0
        } else {
            2 * CHEST.amount * RESOURCE_PRECISION
        },
    );
    assert_eq!(
        funded.pool_left - relics.lords_budget(game_id).unwrap().pool_left,
        if kind == 0 {
            0
        } else {
            2 * CHEST.amount
        },
    );
}

#[test_case(name: "missing_clear_receipt", 0)]
#[test_case(name: "non_ruin_receipt", 1)]
#[test_case(name: "other_day_receipt", 2)]
#[test_case(name: "other_home_receipt", 3)]
#[test_case(name: "mismatched_chest_day", 4)]
fn broken_legacy_clear_refuses_without_guessing_a_depth(defect: u8) {
    let fixture = legacy_recovery_fixture(32);
    let d = fixture.deployment;
    let key = fixture.key;
    let game_id = key.game_id;
    snforge_std::interact_with_state(
        d.games,
        || {
            let state = crate::state::write();
            let storage_key = (game_id, fixture.paid.entity_id);
            let mut site = state.structures.expedition_sites.read(storage_key).unwrap();
            match defect {
                0 => { site.clear = None; },
                1 => { site.category = crate::taxonomy::CAMP_CATEGORY; },
                2 => { site.row += 4096; },
                3 => { site.clear = Some(crate::expeditions::SiteClear { home_id: 2, ..site.clear.unwrap() }); },
                4 => {
                    state.structures.site_chests.write(storage_key, Some(SiteChest { reservation_day: 1, ..CHEST }));
                },
                _ => panic!("unknown fixture defect"),
            }
            state.structures.expedition_sites.write(storage_key, Some(site));
        },
    );
    let before = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    let relics = IRelicsDispatcher { contract_address: d.games };
    let budget = relics.lords_budget(game_id).unwrap();
    let lords = ResourceSlot { game_id, entity_id: fixture.army.owner, resource_type: crate::resources::LORDS };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let funds = resources.resource_balance(lords);
    let mut rejected = snforge_std::spy_events();
    assert!(
        !execute_in_game(
            d,
            game_id,
            Command::Move(crate::commands::Move { explorer_id: key.explorer_id, directions: array![2].span() }),
            362,
        ),
    );
    assert_eq!(
        super::play_fixture::rejection(ref rejected, d.games).reason,
        if defect == 4 {
            "legacy ruin day mismatch"
        } else {
            "missing legacy ruin clear"
        },
    );
    assert_eq!(GameState { contract_address: d.games }.resolved_explorer(key).unwrap(), before);
    assert_eq!(relics.lords_budget(game_id).unwrap(), budget);
    assert_eq!(resources.resource_balance(lords), funds);
    assert_eq!(
        snforge_std::interact_with_state(
            d.games, || crate::state::read().map_rules.cleared_ruin_depths.read((game_id, 1, 0)),
        ),
        0,
    );
    assert!(
        snforge_std::interact_with_state(d.games, || crate::state::read().map_rules.ruin_cleared.read((game_id, 1, 0))),
    );
}

#[test]
fn deep_has_one_fifty_by_fifty_map_and_no_private_depth_three_region() {
    let spacing = 1024;
    let center = crate::deep::center(spacing);
    assert_eq!(crate::deep::arrival(spacing).y, center.y - 20);
    let mut tiles = 0;
    for x in center.x - 26..center.x + 26 {
        for y in center.y - 26..center.y + 26 {
            let coord = crate::troops::Coord { alt: false, x, y };
            if crate::deep::contains(coord, spacing) {
                tiles += 1;
            }
        }
    }
    assert_eq!(tiles, 2500);
    assert!(!crate::deep::contains(crate::troops::Coord { alt: true, ..center }, spacing));
    for day in 1_u64..50 {
        assert!(!crate::deep::contains(crate::expeditions::site(spacing, 1, day, 3), spacing));
    }
}

#[test]
fn aspect_activity_counts_homes_once_across_slot_order_reuse_and_rollover() {
    let d = setup();
    let (game_id, _, category) = expedition_home(d);
    snforge_std::interact_with_state(
        d.games,
        || {
            let state = crate::state::write();
            let commitment = state.registrar.presets.read(state.games.games.entry(game_id).preset_id.read());
            state
                .presets
                .entry(commitment)
                .order_aspects
                .write(crate::aspects::pack(array![1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4].span()));
            state.settlements.home_aspects.write((game_id, 1), 1);
        },
    );
    let count = |
        game, aspect, day,
    | snforge_std::interact_with_state(
        d.games, || crate::state::read().troops.aspect_activity.read((game, aspect, day)),
    );
    assert_eq!(count(game_id, 1, 0), 0);
    // Slot 1 is the first allocation, so counting slot 0 would miss this home.
    assert!(execute_in_game(d, game_id, muster_slot_command(category, 0, 1), 351));
    assert_eq!(count(game_id, 1, 0), 1);
    assert!(!execute_in_game(d, game_id, muster_slot_command(category, 1, 1), 351));
    assert_eq!(count(game_id, 1, 0), 1);
    let armies = IStructureOperationsDispatcher { contract_address: d.games };
    let home = ResourceKey { game_id, entity_id: 1 };
    let first = *armies.home_armies(home).at(0);
    assert!(
        execute_in_game(
            d, game_id, Command::ManageTroops(crate::troop_management::ManageTroops::RemoveExplorer(first)), 352,
        ),
    );
    assert!(execute_in_game(d, game_id, muster_slot_command(category, 0, 1), 353));
    assert!(execute_in_game(d, game_id, muster_slot_command(category, 1, 0), 353));
    assert_eq!(count(game_id, 1, 0), 1);
    assert_eq!(count(game_id, 2, 0), 0);
    let tomorrow = day_start(d, game_id, 1);
    assert!(execute_in_game(d, game_id, muster_slot_command(category, 0, 0), tomorrow + 1));
    assert_eq!(count(game_id, 1, 0), 1);
    assert_eq!(count(game_id, 1, 1), 1);
    assert_eq!(count(game_id + 1, 1, 1), 0);
}


fn initialize_deep_fixture(d: super::Deployment, game_id: u32) {
    snforge_std::interact_with_state(
        d.games,
        || {
            let state = crate::state::write();
            let commitment = state.registrar.presets.read(state.games.games.entry(game_id).preset_id.read());
            let preset = state.presets.entry(commitment);
            preset.deep_rules.write(Some(deep_rules_fixture()));
            preset
                .order_aspects
                .write(crate::aspects::pack(array![1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4].span()));
            state.settlements.home_aspects.write((game_id, 1), 1);
            preset
                .race_rules
                .write(
                    Some(
                        crate::race::RaceRules {
                            season_days: 50,
                            glory_per_tick: 5,
                            height_per_tick: 5,
                            stage_height: 2000,
                            clear_mist_percent: 200,
                            second_wind_percent: 200,
                            pale_moon_percent: 50,
                            spoils_percent: 200,
                            first: crate::troops::Coord { alt: false, x: 5, y: 5 },
                            second: crate::troops::Coord { alt: false, x: 44, y: 5 },
                            third: crate::troops::Coord { alt: false, x: 5, y: 44 },
                            fourth: crate::troops::Coord { alt: false, x: 44, y: 44 },
                        },
                    ),
                );
            let release = state.releases.entry(state.game_releases.read(game_id)).classes;
            crate::race::IRaceDispatcherTrait::initialize_race(
                crate::race::IRaceLibraryDispatcher { class_hash: release.economy.read() }, game_id,
            );
            crate::deep::IDeepSitesDispatcherTrait::initialize_deep(
                crate::logic::deep_sites::dispatcher(game_id), game_id,
            );
        },
    );
}

fn deep_rules_fixture() -> crate::deep::DeepRules {
    crate::deep::DeepRules {
        foundation: crate::troops::Coord { alt: false, x: 25, y: 35 },
        quarry: crate::troops::Coord { alt: false, x: 12, y: 20 },
        altar: crate::troops::Coord { alt: false, x: 38, y: 20 },
        beast_count: 10000 * RESOURCE_PRECISION,
        loss_per_tick: 200 * RESOURCE_PRECISION,
        quarry_per_tick: 500 * RESOURCE_PRECISION,
        altar_per_tick: 5,
        altar_threshold: 1500,
    }
}

#[test]
fn game_creation_places_three_persistent_deep_sites_without_reveals() {
    let d = setup();
    let mut preset = expedition_preset();
    preset.economy.deep = Some(deep_rules_fixture());
    registry(d).register_preset(1, preset);
    let game_id = registry(d)
        .create_game(
            CreateGameParams {
                dev_mode_on: true, end_grace_seconds: 0, duration_seconds: 2 * BAG_SECONDS, ..params(false),
            },
        );
    let guards = IGuardsDispatcher { contract_address: d.games };
    let mut ids = array![];
    for kind in 0..crate::rules::DEEP_SITE_COUNT {
        let id = snforge_std::interact_with_state(d.games, || crate::state::read().deep.site_ids.read((game_id, kind)));
        assert!(id != 0);
        for prior in ids.span() {
            assert!(*prior != id);
        }
        ids.append(id);
        let key = ResourceKey { game_id, entity_id: id };
        assert_eq!(
            snforge_std::interact_with_state(d.games, || crate::logic::deep_sites::site(key)),
            Some(crate::deep::DeepSite { kind, day: 0 }),
        );
        assert_eq!(
            guards.guard(GuardKey { game_id, structure_id: id, slot: 0 }).troops.count, 10000 * RESOURCE_PRECISION,
        );
        let coord = crate::deep::site_coord(deep_rules_fixture(), kind, preset.settlement.spacing);
        let tile = crate::geometry::tile_key(game_id, coord);
        let occupied = snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile)).unwrap();
        assert_eq!(occupied.entity_id, id);
        assert_eq!(occupied.category, crate::taxonomy::DEEP_SITE_OCCUPIER);
        assert_eq!(
            snforge_std::interact_with_state(
                d.games, || crate::state::read().map.tiles.read((game_id, false, coord.x, coord.y)),
            ),
            0,
        );
    }
}

#[test]
fn defeating_a_deep_beast_keeps_its_site_and_the_next_day_restores_the_same_guard() {
    let d = setup();
    let (game_id, preset, category) = expedition_home(d);
    initialize_deep_fixture(d, game_id);
    assert!(execute_in_game(d, game_id, muster_command(category, 0), 351));
    let id = *IStructureOperationsDispatcher { contract_address: d.games }
        .home_armies(ResourceKey { game_id, entity_id: 1 })
        .at(0);
    let key = ExplorerKey { game_id, explorer_id: id };
    let troops = GameState { contract_address: d.games };
    let mut army = troops.resolved_explorer(key).unwrap();
    let coord = crate::deep::site_coord(deep_rules_fixture(), crate::rules::DEEP_FOUNDATION, preset.settlement.spacing);
    army.coord = crate::geometry::neighbor(coord, 0);
    army.troops.count = 100000 * RESOURCE_PRECISION;
    super::resource_commands::set_explorer_fixture(d.games, key, army);
    snforge_std::interact_with_state(
        d.games,
        || crate::logic::deep_armies::enter(
            key, crate::commands::ExecutionContext { timestamp: 360, ..crate::tests::context(d.games, game_id) },
        ),
    );
    snforge_std::interact_with_state(
        d.games,
        || {
            let state = crate::state::write();
            let before = state.resources.weights.read((game_id, id));
            state
                .resources
                .weights
                .write(
                    (game_id, id), crate::resources::Weight { capacity: 0xffffffffffffffffffffffffffffffff, ..before },
                );
        },
    );
    let site_id = snforge_std::interact_with_state(
        d.games, || crate::state::read().deep.site_ids.read((game_id, crate::rules::DEEP_FOUNDATION)),
    );
    let command = Command::BattleGuard(
        crate::commands::Battle { attacker_id: id, defender_id: site_id, relic_slot: None },
    );
    assert!(execute_in_game(d, game_id, command, 360));
    let guards = IGuardsDispatcher { contract_address: d.games };
    let guard_key = GuardKey { game_id, structure_id: site_id, slot: 0 };
    assert_eq!(guards.guard(guard_key).troops.count, 0);
    assert_eq!(
        snforge_std::interact_with_state(d.games, || crate::logic::deep_guards::guard(key)),
        Some(crate::deep::DeepGuard { site_id, slot: 0 }),
    );
    assert_eq!(troops.resolved_explorer(key).unwrap().coord, coord);
    assert!(!execute_in_game(d, game_id, command, 361));
    let occupied = snforge_std::interact_with_state(
        d.games, || crate::logic::map::occupancy(crate::geometry::tile_key(game_id, coord)),
    )
        .unwrap();
    assert_eq!(occupied.entity_id, site_id);
    assert_eq!(occupied.category, crate::taxonomy::DEEP_SITE_OCCUPIER);
    let tomorrow = day_start(d, game_id, 1);
    assert!(execute_in_game(d, game_id, muster_command(category, 0), tomorrow + 1));
    assert_eq!(guards.guard(guard_key).troops.count, 10000 * RESOURCE_PRECISION);
    assert_eq!(
        snforge_std::interact_with_state(
            d.games, || crate::logic::deep_sites::site(ResourceKey { game_id, entity_id: site_id }),
        )
            .unwrap()
            .day,
        1,
    );
    assert_eq!(
        snforge_std::interact_with_state(
            d.games, || crate::logic::map::occupancy(crate::geometry::tile_key(game_id, coord)),
        )
            .unwrap()
            .entity_id,
        site_id,
    );
}

fn deep_joiner_fixture(
    d: super::Deployment,
    game_id: u32,
    home: u64,
    actor: starknet::ContractAddress,
    coord: crate::troops::Coord,
    aspect: u8,
) -> ExplorerKey {
    let explorer_id = snforge_std::interact_with_state(
        d.games,
        || {
            let original = crate::logic::structures::record(ResourceKey { game_id, entity_id: 1 });
            crate::logic::structures::StructureState::create(
                ResourceKey { game_id, entity_id: home },
                crate::structures::StructureRecord { owner: actor, ..original },
            );
            crate::state::write().settlements.home_aspects.write((game_id, home), aspect);
            crate::entity_ids::allocate_home(game_id, home)
        },
    );
    let key = ExplorerKey { game_id, explorer_id };
    super::resource_commands::set_explorer_fixture(
        d.games,
        key,
        crate::troops::ExplorerTroops {
            owner: home,
            coord,
            troops: crate::troops::Troops { count: 3000 * RESOURCE_PRECISION, ..Default::default() },
        },
    );
    snforge_std::interact_with_state(d.games, || crate::logic::army_days::create(key, 0));
    start_cheat_caller_address(d.games, d.games);
    IResourceOperationsDispatcher { contract_address: d.games }
        .initialize_explorer_resources(
            ResourceKey { game_id, entity_id: explorer_id },
            3000 * RESOURCE_PRECISION,
            crate::commands::resource_context(crate::tests::context(d.games, game_id)),
        );
    stop_cheat_caller_address(d.games);
    snforge_std::interact_with_state(
        d.games,
        || crate::logic::deep_armies::enter(
            key, crate::commands::ExecutionContext { timestamp: 360, ..crate::tests::context(d.games, game_id) },
        ),
    );
    key
}

#[test]
fn deep_slots_accept_four_allied_players_refuse_duplicates_and_release_on_death_and_day_end() {
    let d = setup();
    let (game_id, preset, category) = expedition_home(d);
    initialize_deep_fixture(d, game_id);
    let coord = crate::deep::site_coord(deep_rules_fixture(), crate::rules::DEEP_FOUNDATION, preset.settlement.spacing);
    let site_id = snforge_std::interact_with_state(
        d.games, || crate::state::read().deep.site_ids.read((game_id, crate::rules::DEEP_FOUNDATION)),
    );
    let beast_key = GuardKey { game_id, structure_id: site_id, slot: 0 };
    snforge_std::interact_with_state(
        d.games,
        || {
            let mut beast = crate::logic::guards::guard(beast_key);
            beast.troops.count = 0;
            crate::logic::guards::GuardState::save(beast_key, beast);
        },
    );
    let mut armies = array![];
    let mut players = array![];
    for slot in 0_u8..4 {
        let (actor, _) = super::deploy_player(100 + Into::<u8, felt252>::into(slot), super::GUARDIAN);
        let key = deep_joiner_fixture(d, game_id, 100 + slot.into(), actor, crate::geometry::neighbor(coord, 0), 1);
        let player = super::Deployment { actor, ..d };
        assert!(
            execute_in_game(
                player,
                game_id,
                Command::InteractSite(crate::relics::InteractSite { explorer_id: key.explorer_id, coord }),
                360 + 2 * slot.into(),
            ),
        );
        assert_eq!(
            snforge_std::interact_with_state(d.games, || crate::logic::deep_guards::guard(key)),
            Some(crate::deep::DeepGuard { site_id, slot }),
        );
        assert_eq!(
            GameState { contract_address: d.games }.resolved_explorer(key).unwrap().troops.count,
            3000 * RESOURCE_PRECISION,
        );
        assert_eq!(GameState { contract_address: d.games }.resolved_explorer(key).unwrap().coord, coord);
        assert!(
            snforge_std::interact_with_state(
                d.games,
                || crate::logic::map::occupancy(
                    crate::geometry::tile_key(game_id, crate::geometry::neighbor(coord, 0)),
                ),
            )
                .is_none(),
        );
        assert!(
            !execute_in_game(
                player,
                game_id,
                Command::Move(crate::commands::Move { explorer_id: key.explorer_id, directions: array![0].span() }),
                361 + 2 * slot.into(),
            ),
        );
        armies.append(key);
        players.append(player);
    }
    let (fifth_actor, _) = super::deploy_player(104, super::GUARDIAN);
    let fifth = deep_joiner_fixture(d, game_id, 104, fifth_actor, crate::geometry::neighbor(coord, 0), 1);
    let fifth_player = super::Deployment { actor: fifth_actor, ..d };
    let join_fifth = Command::InteractSite(crate::relics::InteractSite { explorer_id: fifth.explorer_id, coord });
    assert!(!execute_in_game(fifth_player, game_id, join_fifth, 368));
    let first_player = *players.at(0);
    let first = *armies.at(0);
    assert!(
        execute_in_game(
            first_player,
            game_id,
            Command::ManageTroops(crate::troop_management::ManageTroops::RemoveExplorer(first.explorer_id)),
            369,
        ),
    );
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::deep_guards::guard(first)).is_none());
    assert!(GameState { contract_address: d.games }.resolved_explorer(first).is_none());
    let duplicate_player = *players.at(1);
    let duplicate = deep_joiner_fixture(
        d, game_id, 200, duplicate_player.actor, crate::geometry::neighbor(coord, 1), 1,
    );
    assert!(
        !execute_in_game(
            duplicate_player,
            game_id,
            Command::InteractSite(crate::relics::InteractSite { explorer_id: duplicate.explorer_id, coord }),
            370,
        ),
    );
    let (rival, _) = super::deploy_player(999, super::GUARDIAN);
    let enemy = deep_joiner_fixture(d, game_id, 201, rival, crate::geometry::neighbor(coord, 2), 2);
    assert!(
        !execute_in_game(
            super::Deployment { actor: rival, ..d },
            game_id,
            Command::InteractSite(crate::relics::InteractSite { explorer_id: enemy.explorer_id, coord }),
            371,
        ),
    );
    for key in array![fifth, duplicate, enemy] {
        let guard: Option<crate::deep::DeepGuard> = snforge_std::interact_with_state(
            d.games, || crate::logic::deep_guards::guard(key),
        );
        assert!(guard.is_none());
        assert_eq!(
            GameState { contract_address: d.games }.resolved_explorer(key).unwrap().troops.count,
            3000 * RESOURCE_PRECISION,
        );
    }
    assert!(execute_in_game(fifth_player, game_id, join_fifth, 372));
    assert_eq!(
        snforge_std::interact_with_state(d.games, || crate::logic::deep_guards::guard(fifth)),
        Some(crate::deep::DeepGuard { site_id, slot: 0 }),
    );
    let tomorrow = day_start(d, game_id, 1);
    assert!(execute_in_game(d, game_id, muster_command(category, 0), tomorrow + 1));
    for key in armies.span() {
        let key: ExplorerKey = *key;
        let guard: Option<crate::deep::DeepGuard> = snforge_std::interact_with_state(
            d.games, || crate::logic::deep_guards::guard(key),
        );
        assert!(guard.is_none());
        assert!(GameState { contract_address: d.games }.resolved_explorer(key).is_none());
    }
    assert!(GameState { contract_address: d.games }.resolved_explorer(fifth).is_none());
    assert_eq!(
        IGuardsDispatcher { contract_address: d.games }.guard(beast_key).troops.count, 10000 * RESOURCE_PRECISION,
    );
    let occupied: Option<crate::map::TileOccupancy> = snforge_std::interact_with_state(
        d.games, || crate::logic::map::occupancy(crate::geometry::tile_key(game_id, coord)),
    );
    assert_eq!(occupied.unwrap().entity_id, site_id);
}

#[test]
fn deep_descent_charges_new_ticks_once_and_dead_field_armies_free_the_arrival() {
    let d = setup();
    let (game_id, preset, category) = expedition_home(d);
    let home = ResourceKey { game_id, entity_id: 1 };
    snforge_std::interact_with_state(
        d.games,
        || {
            let state = crate::state::write();
            let commitment = state.registrar.presets.read(state.games.games.entry(game_id).preset_id.read());
            let mut rules = state.presets.entry(commitment).rules.read();
            rules.day_unit_seconds = 600;
            rules.tick_config.armies_tick_in_seconds = 120;
            state.presets.entry(commitment).rules.write(rules);
            state.presets.entry(commitment).deep_rules.write(Some(deep_rules_fixture()));
            let mut learned = 0;
            for _ in 0_u8..3 {
                learned = crate::research::learn(learned, crate::research::ROW_DEPTH, 0);
            }
            crate::logic::research::write(home, crate::research::RealmKnowledge { learned });
            crate::deep::IDeepSitesDispatcherTrait::initialize_deep(
                crate::logic::deep_sites::dispatcher(game_id), game_id,
            );
        },
    );
    assert!(execute_in_game(d, game_id, muster_command(category, 0), 351));
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let key = ExplorerKey { game_id, explorer_id: *structures.home_armies(home).at(0) };
    let troops = GameState { contract_address: d.games };
    let mut army = troops.resolved_explorer(key).unwrap();
    army.troops.count = 500 * RESOURCE_PRECISION;
    super::resource_commands::set_explorer_fixture(d.games, key, army);
    snforge_std::interact_with_state(
        d.games,
        || {
            let state = crate::state::write();
            let before = state.resources.weights.read((game_id, key.explorer_id));
            state
                .resources
                .weights
                .write(
                    (game_id, key.explorer_id), crate::resources::Weight { capacity: before.capacity * 500, ..before },
                );
        },
    );
    let enter = Command::EnterDepth(crate::commands::EnterDepth { explorer_id: key.explorer_id, depth: 3 });
    assert!(execute_in_game(d, game_id, enter, 351));
    assert_eq!(
        snforge_std::interact_with_state(
            d.games, || crate::state::read().deep.army_ticks.read((game_id, key.explorer_id)),
        ),
        Some(2),
    );
    for (timestamp, direction, count) in array![
        (360_u64, 0_u8, 300_u128), (361, 3, 300), (480, 0, 100), (481, 3, 100),
    ] {
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::Move(
                    crate::commands::Move { explorer_id: key.explorer_id, directions: array![direction].span() },
                ),
                timestamp,
            ),
        );
        assert_eq!(troops.resolved_explorer(key).unwrap().troops.count, count * RESOURCE_PRECISION);
    }
    assert_eq!(troops.resolved_explorer(key).unwrap().coord, crate::deep::arrival(preset.settlement.spacing));
    assert!(execute_in_game(d, game_id, muster_slot_command(category, 0, 1), 590));
    let second = *structures.home_armies(home).at(1);
    assert!(
        execute_in_game(
            d, game_id, Command::EnterDepth(crate::commands::EnterDepth { explorer_id: second, depth: 3 }), 600,
        ),
    );
    assert!(troops.resolved_explorer(key).is_none());
    assert!(
        snforge_std::interact_with_state(
            d.games, || crate::state::read().deep.army_ticks.read((game_id, key.explorer_id)),
        )
            .is_none(),
    );
    assert_eq!(
        troops.resolved_explorer(ExplorerKey { game_id, explorer_id: second }).unwrap().coord,
        crate::deep::arrival(preset.settlement.spacing),
    );
}

fn deep_tick_fixture() -> (super::Deployment, u32, u8) {
    let d = setup();
    let (game_id, _, category) = expedition_home(d);
    snforge_std::interact_with_state(
        d.games,
        || {
            let state = crate::state::write();
            let commitment = state.registrar.presets.read(state.games.games.entry(game_id).preset_id.read());
            let mut rules = state.presets.entry(commitment).rules.read();
            rules.day_unit_seconds = 600;
            rules.tick_config.armies_tick_in_seconds = 120;
            state.presets.entry(commitment).rules.write(rules);
            let mut game = crate::logic::game::game(game_id);
            game.end_at = game.start_main_at + 24000;
            crate::logic::game::write_game(game_id, game);
        },
    );
    initialize_deep_fixture(d, game_id);
    (d, game_id, category)
}

fn join_deep_tick_fixture(d: super::Deployment, game_id: u32, kind: u8, home: u64, count: u128) -> ExplorerKey {
    let (actor, _) = super::deploy_player(home.into(), super::GUARDIAN);
    let (site_id, coord) = snforge_std::interact_with_state(
        d.games,
        || {
            let site_id = crate::state::read().deep.site_ids.read((game_id, kind));
            let key = GuardKey { game_id, structure_id: site_id, slot: 0 };
            let mut beast = crate::logic::guards::guard(key);
            beast.troops.count = 0;
            crate::logic::guards::GuardState::save(key, beast);
            (site_id, crate::logic::map::entity_coord(ResourceKey { game_id, entity_id: site_id }).unwrap())
        },
    );
    let key = deep_joiner_fixture(d, game_id, home, actor, crate::geometry::neighbor(coord, 0), 1);
    let mut army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    army.troops.count = count * RESOURCE_PRECISION;
    super::resource_commands::set_explorer_fixture(d.games, key, army);
    start_cheat_caller_address(d.games, d.games);
    IResourceOperationsDispatcher { contract_address: d.games }
        .initialize_resources(
            ResourceKey { game_id, entity_id: home },
            0xffffffffffffffffffffffffffffffff,
            crate::taxonomy::REALM_CATEGORY,
            360,
            crate::commands::action_context(crate::tests::context(d.games, game_id)),
        );
    stop_cheat_caller_address(d.games);
    assert!(
        execute_in_game(
            super::Deployment { actor, ..d },
            game_id,
            Command::InteractSite(crate::relics::InteractSite { explorer_id: key.explorer_id, coord }),
            360,
        ),
    );
    assert_eq!(
        snforge_std::interact_with_state(d.games, || crate::logic::deep_guards::guard(key)).unwrap().site_id, site_id,
    );
    key
}

#[test]
fn deep_ticks_pay_pre_loss_weights_once_and_stop_paying_dead_guards() {
    let (d, game_id, category) = deep_tick_fixture();
    let first = join_deep_tick_fixture(d, game_id, crate::rules::DEEP_FOUNDATION, 101, 200);
    let second = join_deep_tick_fixture(d, game_id, crate::rules::DEEP_FOUNDATION, 102, 600);
    let quarry = join_deep_tick_fixture(d, game_id, crate::rules::DEEP_QUARRY, 103, 600);
    let altar = join_deep_tick_fixture(d, game_id, crate::rules::DEEP_ALTAR, 104, 600);
    assert!(execute_in_game(d, game_id, muster_command(category, 0), 480));
    snforge_std::interact_with_state(
        d.games,
        || {
            assert_eq!(
                crate::logic::race::member(ResourceKey { game_id, entity_id: 101 }).glory, 5 * RESOURCE_PRECISION / 4,
            );
            assert_eq!(
                crate::logic::race::member(ResourceKey { game_id, entity_id: 102 }).glory, 15 * RESOURCE_PRECISION / 4,
            );
            assert_eq!(
                crate::logic::race::member(ResourceKey { game_id, entity_id: 104 }).glory, 5 * RESOURCE_PRECISION,
            );
            assert_eq!(
                crate::logic::resources::balance(ResourceKey { game_id, entity_id: 103 }, crate::resources::LABOR),
                500 * RESOURCE_PRECISION,
            );
            assert_eq!(
                crate::logic::resources::balance(ResourceKey { game_id, entity_id: 103 }, crate::resources::ESSENCE),
                500 * RESOURCE_PRECISION,
            );
            assert!(crate::logic::troops::explorer(first).is_none());
            assert!(crate::logic::deep_guards::guard(first).is_none());
            assert_eq!(crate::logic::troops::explorer(second).unwrap().troops.count, 400 * RESOURCE_PRECISION);
        },
    );
    // The occupied home slot rejects the player command; periodic settlement remains committed.
    for timestamp in array![480_u64, 481, 720, 840] {
        assert!(!execute_in_game(d, game_id, muster_command(category, 0), timestamp));
    }
    snforge_std::interact_with_state(
        d.games,
        || {
            assert_eq!(
                crate::logic::race::member(ResourceKey { game_id, entity_id: 101 }).glory, 5 * RESOURCE_PRECISION / 4,
            );
            assert_eq!(
                crate::logic::race::member(ResourceKey { game_id, entity_id: 102 }).glory, 55 * RESOURCE_PRECISION / 4,
            );
            assert_eq!(
                crate::logic::race::member(ResourceKey { game_id, entity_id: 104 }).glory, 15 * RESOURCE_PRECISION,
            );
            assert_eq!(crate::logic::race::hyperstructure(crate::race::AspectKey { game_id, aspect: 1 }).height, 15);
            assert_eq!(
                crate::logic::resources::balance(ResourceKey { game_id, entity_id: 103 }, crate::resources::LABOR),
                1500 * RESOURCE_PRECISION,
            );
            assert_eq!(
                crate::logic::resources::balance(ResourceKey { game_id, entity_id: 103 }, crate::resources::ESSENCE),
                1500 * RESOURCE_PRECISION,
            );
            assert_eq!(crate::state::read().deep.altar_bars.read((game_id, 1)), 15);
            for key in array![second, quarry, altar] {
                assert!(crate::logic::troops::explorer(key).is_none());
                assert!(crate::logic::deep_guards::guard(key).is_none());
            }
            assert_eq!(crate::state::read().deep.paid_tick.read(game_id), Some(7));
        },
    );
}

#[test]
fn winning_tick_finishes_all_three_sites_and_rejects_the_waiting_command() {
    let (d, game_id, category) = deep_tick_fixture();
    let foundation = join_deep_tick_fixture(d, game_id, crate::rules::DEEP_FOUNDATION, 101, 600);
    let quarry = join_deep_tick_fixture(d, game_id, crate::rules::DEEP_QUARRY, 102, 600);
    let altar = join_deep_tick_fixture(d, game_id, crate::rules::DEEP_ALTAR, 103, 600);
    let scheduled_end = snforge_std::interact_with_state(
        d.games,
        || {
            crate::state::write().season.aspect_heights.write((game_id, 1), 9995);
            crate::logic::game::game(game_id).end_at
        },
    );
    assert!(!execute_in_game(d, game_id, muster_command(category, 0), 840));
    assert!(!execute_in_game(d, game_id, muster_command(category, 0), 841));
    snforge_std::interact_with_state(
        d.games,
        || {
            assert_eq!(crate::logic::game::game(game_id).end_at, 480);
            assert_eq!(
                crate::logic::race::result(game_id),
                Some(crate::race::RaceResult { winner: Some(1), ended_at: 480, scheduled_end_at: scheduled_end }),
            );
            assert_eq!(crate::logic::race::hyperstructure(crate::race::AspectKey { game_id, aspect: 1 }).height, 10000);
            assert_eq!(
                crate::logic::race::member(ResourceKey { game_id, entity_id: 101 }).glory, 5 * RESOURCE_PRECISION,
            );
            assert_eq!(
                crate::logic::race::member(ResourceKey { game_id, entity_id: 103 }).glory, 5 * RESOURCE_PRECISION,
            );
            assert_eq!(
                crate::logic::resources::balance(ResourceKey { game_id, entity_id: 102 }, crate::resources::LABOR),
                500 * RESOURCE_PRECISION,
            );
            assert_eq!(
                crate::logic::resources::balance(ResourceKey { game_id, entity_id: 102 }, crate::resources::ESSENCE),
                500 * RESOURCE_PRECISION,
            );
            assert_eq!(crate::state::read().deep.altar_bars.read((game_id, 1)), 5);
            for key in array![foundation, quarry, altar] {
                assert_eq!(crate::logic::troops::explorer(key).unwrap().troops.count, 400 * RESOURCE_PRECISION);
            }
            assert_eq!(crate::state::read().deep.paid_tick.read(game_id), Some(4));
            assert!(crate::logic::troops::home_armies(ResourceKey { game_id, entity_id: 1 }).is_empty());
        },
    );
}

#[test]
fn scheduled_end_pays_the_final_boundary_once() {
    let (d, game_id, category) = deep_tick_fixture();
    snforge_std::interact_with_state(
        d.games,
        || {
            let mut game = crate::logic::game::game(game_id);
            game.end_at = 720;
            crate::logic::game::write_game(game_id, game);
        },
    );
    let guard = join_deep_tick_fixture(d, game_id, crate::rules::DEEP_FOUNDATION, 101, 600);
    for now in array![720_u64, 840] {
        assert!(!execute_in_game(d, game_id, muster_command(category, 0), now));
        snforge_std::interact_with_state(
            d.games,
            || {
                assert_eq!(
                    crate::logic::race::member(ResourceKey { game_id, entity_id: 101 }).glory, 15 * RESOURCE_PRECISION,
                );
                assert_eq!(
                    crate::logic::race::hyperstructure(crate::race::AspectKey { game_id, aspect: 1 }).height, 15,
                );
                assert_eq!(crate::state::read().deep.paid_tick.read(game_id), Some(6));
                assert!(crate::logic::troops::explorer(guard).is_none());
            },
        );
    }
}

#[test]
fn altar_issues_next_day_banes_in_board_order_and_stops_world_rolls() {
    let (d, game_id, category) = deep_tick_fixture();
    snforge_std::interact_with_state(
        d.games,
        || {
            let state = crate::state::write();
            let commitment = state.registrar.presets.read(state.games.games.entry(game_id).preset_id.read());
            let mut deep = deep_rules_fixture();
            deep.altar_threshold = 5;
            state.presets.entry(commitment).deep_rules.write(Some(deep));
            state.presets.entry(commitment).bane_rules.write(Some((20, 25, 150, 50, 50)));
            state.season.aspect_heights.write((game_id, 1), 200);
            state.season.aspect_heights.write((game_id, 2), 100);
            state.season.aspect_heights.write((game_id, 3), 50);
            state.troops.aspect_activity.write((game_id, 2, 0), 5);
        },
    );
    let _ = join_deep_tick_fixture(d, game_id, crate::rules::DEEP_ALTAR, 101, 600);
    assert!(execute_in_game(d, game_id, muster_command(category, 0), 480));
    snforge_std::interact_with_state(
        d.games,
        || {
            assert!(crate::logic::deep_banes::bane(crate::deep::TeamBaneKey { game_id, aspect: 2, day: 1 }).is_some());
            assert!(crate::logic::deep_banes::bane(crate::deep::TeamBaneKey { game_id, aspect: 3, day: 1 }).is_none());
            assert_eq!(crate::state::read().banes.first_team_day.read(game_id), Some(0));
            assert!(!crate::logic::deep_banes::height_blocked(game_id, 2, 480));
        },
    );
    assert!(!execute_in_game(d, game_id, muster_command(category, 0), 720));
    snforge_std::interact_with_state(
        d.games,
        || {
            for aspect in 2_u8..5 {
                let issued = crate::logic::deep_banes::bane(crate::deep::TeamBaneKey { game_id, aspect, day: 1 })
                    .unwrap();
                assert_eq!(issued.source, 1);
                assert_eq!(issued.issued_day, 0);
                assert!(issued.quest >= crate::quests::STAND && issued.quest <= crate::quests::CULL);
            }
            assert!(crate::logic::deep_banes::bane(crate::deep::TeamBaneKey { game_id, aspect: 1, day: 1 }).is_none());
            assert_eq!(crate::state::read().deep.altar_bars.read((game_id, 1)), 0);
            assert_eq!(crate::logic::banes::required(game_id, 2, 1), 2);
            let tomorrow = crate::days::day_at_index(crate::logic::game::game(game_id), 600, 1);
            assert!(crate::logic::deep_banes::height_blocked(game_id, 2, tomorrow.start));
            assert!(!crate::logic::deep_banes::height_blocked(game_id, 3, tomorrow.start));
            assert!(!crate::logic::deep_banes::height_blocked(game_id, 2, tomorrow.end));
            for day in 1_u64..10 {
                assert!(crate::logic::banes::kind(game_id, day).is_none());
            }
        },
    );
}
