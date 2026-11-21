pub use world_test_support::tests::building_commands::*;
use super::play_fixture::FIXTURE_START;
#[test]
fn building_commands_match_replay_views() {
    replay_buildings(false);
}

#[test]
#[ignore]
fn record_spatial_replay_buildings() {
    replay_buildings(true);
}

#[test]
fn failed_building_payment_rolls_back_placement_population_rate_and_resources() {
    let (deployment, home) = building_world();
    let structures = IStructureOperationsDispatcher { contract_address: deployment.games };
    let before = resource_facts(deployment, home);
    let counts = structures.structure_buildings(home);
    assert_terminal_rejection(
        deployment,
        Command::CreateBuilding(
            CreateBuilding {
                structure_id: home.entity_id, directions: array![0_u8].span(), category: 37, use_simple: false,
            },
        ),
        FIXTURE_START + 40,
    );
    assert_eq!(resource_facts(deployment, home), before);
    assert_eq!(structures.structure_buildings(home), counts);
    assert!(structures.building(east(home)).is_none());
    assert_terminal_rejection(deployment, create(home, 3), FIXTURE_START + 40);
    assert_eq!(resource_facts(deployment, home), before);
    assert!(structures.building(east(home)).is_none());
}

#[test]
fn building_placement_rejects_invalid_paths_categories_and_occupied_tiles() {
    let (deployment, home) = research_world();
    let structures = IStructureOperationsDispatcher { contract_address: deployment.games };
    let before = resource_facts(deployment, home);
    let counts = structures.structure_buildings(home);
    for directions in array![array![].span(), array![6_u8].span(), array![0_u8, 0, 0, 0, 0].span()] {
        assert_terminal_rejection(
            deployment,
            Command::CreateBuilding(
                CreateBuilding {
                    structure_id: home.entity_id, directions, category: crate::research::FARM, use_simple: true,
                },
            ),
            FIXTURE_START + 40,
        );
    }
    for category in array![0_u8, crate::buildings::BUILDING_CATEGORY_COUNT + 1] {
        assert_terminal_rejection(deployment, create(home, category), FIXTURE_START + 40);
    }
    assert_eq!(resource_facts(deployment, home), before);
    assert_eq!(structures.structure_buildings(home), counts);
    assert!(structures.building(east(home)).is_none());
    assert!(execute(deployment, create(home, crate::research::FARM), FIXTURE_START + 40));
    let before = resource_facts(deployment, home);
    let counts = structures.structure_buildings(home);
    assert_terminal_rejection(deployment, create(home, crate::research::FARM), FIXTURE_START + 40);
    assert_eq!(resource_facts(deployment, home), before);
    assert_eq!(structures.structure_buildings(home), counts);
}

#[test]
fn building_actions_require_ownership_and_the_game_window() {
    let (deployment, home) = building_world();
    let structures = IStructureOperationsDispatcher { contract_address: deployment.games };
    let before = resource_facts(deployment, home);
    for timestamp in array![19_u64] {
        for command in array![create(home, 37), Command::DestroyBuilding(change(home))] {
            assert_terminal_rejection(deployment, command, timestamp);
        }
    }
    let structure = structures.structure(home).unwrap();
    set_fixture(
        deployment.games,
        selector!("structures"),
        selector!("structures"),
        array![3, home.entity_id.into()].span(),
        crate::structures::StructureRecord {
            owner: 0x999.try_into().unwrap(),
            base: structure.base,
            metadata: structure.metadata,
            resources_packed: structure.resources_packed,
        },
    );
    for command in array![create(home, 37), Command::DestroyBuilding(change(home))] {
        assert_terminal_rejection(deployment, command, FIXTURE_START + 60);
    }
    set_fixture(
        deployment.games,
        selector!("structures"),
        selector!("structures"),
        array![3, home.entity_id.into()].span(),
        crate::structures::StructureRecord {
            owner: structure.owner,
            base: structure.base,
            metadata: structure.metadata,
            resources_packed: structure.resources_packed,
        },
    );
    for command in array![create(home, 37), Command::DestroyBuilding(change(home))] {
        assert_terminal_rejection(deployment, command, FIXTURE_START + super::play_fixture::FIXTURE_SEASON_SECONDS + 1);
    }
    assert_eq!(resource_facts(deployment, home), before);
    assert!(structures.building(east(home)).is_none());
}

#[test]
fn the_castle_cannot_be_destroyed_and_population_blocks_overbuilding() {
    let (deployment, home) = research_world();
    let structures = IStructureOperationsDispatcher { contract_address: deployment.games };
    let castle = ChangeBuilding { structure_id: home.entity_id, coord: Coord { alt: false, x: 10, y: 10 } };
    assert_terminal_rejection(deployment, Command::DestroyBuilding(castle), FIXTURE_START + 50);
    assert!(structures.building(BuildingKey { inner_col: 10, ..east(home) }).is_some());
    let counts = structures.structure_buildings(home);
    set_fixture(
        deployment.games,
        selector!("buildings"),
        selector!("structure_buildings"),
        array![3, home.entity_id.into()].span(),
        crate::buildings::StructureBuildings {
            population: crate::buildings::Population {
                current: counts.population.max
                    + IGameDispatcher { contract_address: deployment.games }.rules(3).building_config.base_population,
                max: counts.population.max,
            },
            ..counts,
        },
    );
    let before = resource_facts(deployment, home);
    assert_terminal_rejection(deployment, create(home, crate::research::FARM), FIXTURE_START + 60);
    assert_eq!(resource_facts(deployment, home), before);
}

#[test]
fn a_workshop_a_player_builds_costs_its_rule_population() {
    let (deployment, home) = research_world();
    let structures = IStructureOperationsDispatcher { contract_address: deployment.games };
    let workshop = *crate::balance::structures::BUILDINGS.span().at(crate::research::WORKSHOP.into() - 1);
    assert!(workshop.population_cost != 0);
    let before = structures.structure_buildings(home).population.current;
    assert!(execute(deployment, create(home, crate::research::WORKSHOP), FIXTURE_START + 40));
    assert_eq!(structures.structure_buildings(home).population.current, before + workshop.population_cost.into());
}

#[test]
fn castle_ring_limit_accepts_four_and_rejects_five() {
    let (deployment, home) = research_world();
    let structures = IStructureOperationsDispatcher { contract_address: deployment.games };
    assert_eq!(structures.structure(home).unwrap().base.level, crate::balance::structures::REALM_UPGRADE_MAX);
    assert!(
        execute(
            deployment,
            Command::CreateBuilding(
                CreateBuilding {
                    structure_id: home.entity_id,
                    directions: array![0_u8, 0, 0, 0].span(),
                    category: crate::research::FARM,
                    use_simple: true,
                },
            ),
            FIXTURE_START + 40,
        ),
    );
    let before = resource_facts(deployment, home);
    assert_terminal_rejection(
        deployment,
        Command::CreateBuilding(
            CreateBuilding {
                structure_id: home.entity_id,
                directions: array![0_u8, 0, 0, 0, 0].span(),
                category: crate::research::FARM,
                use_simple: true,
            },
        ),
        FIXTURE_START + 40,
    );
    assert_eq!(resource_facts(deployment, home), before);
    assert!(
        structures
            .building(BuildingKey { game_id: home.game_id, structure_id: home.entity_id, inner_col: 15, inner_row: 10 })
            .is_none(),
    );
}

#[test]
fn realm_knowledge_packs_each_row_tier_and_choice_where_the_client_reads_them() {
    let mut learned = 0;
    learned = crate::research::learn(learned, crate::research::ROW_FARM, crate::research::CHOICE_MAKE);
    learned = crate::research::learn(learned, crate::research::ROW_FARM, crate::research::CHOICE_STORE);
    learned = crate::research::learn(learned, crate::research::ROW_WORKSHOP, crate::research::CHOICE_MAKE);
    learned = crate::research::learn(learned, crate::research::ROW_LORE, 0);
    learned = crate::research::learn(learned, crate::research::ROW_LORE, 0);
    assert_eq!(learned, 562949953421449);
    assert_eq!(crate::research::picks(learned, crate::research::ROW_FARM, crate::research::CHOICE_STORE), 1);
    // Both independent sides and all other rows fit without changing neighboring fields.
    let mut full = 0;
    for row_ref in crate::research::ROWS.span() {
        let row = *row_ref;
        if crate::research::independent_sides(row) {
            for _ in 0_u8..5 {
                full = crate::research::learn(full, row, 0);
            }
        }
        for _ in 0..crate::research::max_tier(row) {
            full = crate::research::learn(full, row, crate::research::choice_count(row) - 1);
        }
    }
    for row_ref in crate::research::ROWS.span() {
        let row = *row_ref;
        assert_eq!(crate::research::tier(full, row), crate::research::max_tier(row));
    }
}

#[test]
fn a_row_opens_with_its_first_building_and_sells_each_tier_once_in_order_at_its_price() {
    let (d, home) = research_world();
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let essence = ResourceSlot {
        game_id: home.game_id, entity_id: home.entity_id, resource_type: crate::resources::ESSENCE,
    };
    let labor = ResourceSlot { resource_type: crate::resources::LABOR, ..essence };
    // No farm stands, and the castle's own labor building is not a workshop.
    assert_terminal_rejection(
        d, research(home, crate::research::ROW_FARM, crate::research::CHOICE_MAKE), FIXTURE_START + 40,
    );
    assert_terminal_rejection(
        d, research(home, crate::research::ROW_WORKSHOP, crate::research::CHOICE_MAKE), FIXTURE_START + 40,
    );
    assert!(execute(d, build_toward(home, crate::research::FARM, 0), FIXTURE_START + 40));
    assert_terminal_rejection(d, research(home, crate::research::ROW_FARM, 2), FIXTURE_START + 40);
    for side in 0_u8..2 {
        for tier in 1_u8..6 {
            let price = crate::logic::research::price(crate::research::ROW_FARM, tier);
            let (e, l) = *array![(500_u128, 500_u128), (1000, 1000), (4000, 3000), (12000, 8000), (30000, 20000)]
                .at((tier - 1).into());
            assert_eq!(price.essence, e * crate::rules::RESOURCE_PRECISION);
            assert_eq!(price.labor, l * crate::rules::RESOURCE_PRECISION);
            let (essence_before, labor_before) = (
                resources.resource_balance(essence), resources.resource_balance(labor),
            );
            assert!(execute(d, research(home, crate::research::ROW_FARM, side), FIXTURE_START + 40));
            assert_eq!(essence_before - resources.resource_balance(essence), price.essence);
            assert_eq!(labor_before - resources.resource_balance(labor), price.labor);
            assert_eq!(crate::research::picks(learned(d, home), crate::research::ROW_FARM, side), tier);
        }
        assert_terminal_rejection(d, research(home, crate::research::ROW_FARM, side), FIXTURE_START + 40);
    }
    assert_eq!(crate::research::purchases(learned(d, home), crate::research::ROW_FARM), 10);
    // The castle rows need no building and charge Essence alone.
    let before = resources.resource_balance(labor);
    for _ in 0..crate::research::LORE_SPIRES {
        assert!(execute(d, research(home, crate::research::ROW_LORE, 0), FIXTURE_START + 40));
    }
    assert_eq!(resources.resource_balance(labor), before);
    assert_terminal_rejection(d, research(home, crate::research::ROW_LORE, 0), FIXTURE_START + 40);
    // A hut row has no choice.
    assert!(execute(d, build_toward(home, crate::research::HUT, 1), FIXTURE_START + 40));
    assert_terminal_rejection(d, research(home, crate::research::ROW_HUT, 1), FIXTURE_START + 40);
    assert!(execute(d, research(home, crate::research::ROW_HUT, 0), FIXTURE_START + 40));
}

#[test]
fn a_make_pick_adds_a_fifth_of_the_base_to_every_building_of_the_type_standing_or_future() {
    let (d, home) = research_world();
    let wheat = 35_u8;
    assert!(execute(d, build_toward(home, crate::research::FARM, 0), FIXTURE_START + 40));
    assert!(execute(d, build_toward(home, crate::research::FARM, 1), FIXTURE_START + 40));
    let base = rate(d, home, wheat) / 2;
    let fields = stepped(base, 1);
    assert!(execute(d, research(home, crate::research::ROW_FARM, crate::research::CHOICE_MAKE), FIXTURE_START + 40));
    assert_eq!(rate(d, home, wheat), 2 * fields);
    assert!(execute(d, build_toward(home, crate::research::FARM, 2), FIXTURE_START + 40));
    assert_eq!(rate(d, home, wheat), 3 * fields);
    // Granary stores more and makes nothing more.
    assert!(execute(d, research(home, crate::research::ROW_FARM, crate::research::CHOICE_STORE), FIXTURE_START + 40));
    assert_eq!(rate(d, home, wheat), 3 * fields);
    assert!(execute(d, Command::DestroyBuilding(change(home)), FIXTURE_START + 40));
    assert_eq!(rate(d, home, wheat), 2 * fields);
    // Tools raise workshops and leave the castle's own labor alone.
    let labor = crate::resources::LABOR;
    let castle = rate(d, home, labor);
    let workshop = crate::balance::structures::BOARD.workshop_rate;
    assert!(execute(d, build_toward(home, crate::research::WORKSHOP, 3), FIXTURE_START + 40));
    assert_eq!(rate(d, home, labor), castle + workshop);
    assert!(
        execute(d, research(home, crate::research::ROW_WORKSHOP, crate::research::CHOICE_MAKE), FIXTURE_START + 40),
    );
    assert_eq!(rate(d, home, labor), castle + stepped(workshop, 1));
}

#[test]
fn each_hut_tier_adds_a_fifth_of_every_huts_population() {
    let (d, home) = research_world();
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let before = structures.structure_buildings(home).population.max;
    assert!(execute(d, build_toward(home, crate::research::HUT, 0), FIXTURE_START + 40));
    assert!(execute(d, build_toward(home, crate::research::HUT, 1), FIXTURE_START + 40));
    assert_eq!(structures.structure_buildings(home).population.max, before + 12);
    for _ in 0..3_u8 {
        assert!(execute(d, research(home, crate::research::ROW_HUT, 0), FIXTURE_START + 40));
    }
    // Two huts of 6 at Rare: 12 + 12 * 3 * 20%, rounded down once for the type.
    assert_eq!(structures.structure_buildings(home).population.max, before + 12 + 7);
    assert!(execute(d, build_toward(home, crate::research::HUT, 2), FIXTURE_START + 40));
    assert_eq!(structures.structure_buildings(home).population.max, before + 18 + 10);
    assert!(execute(d, Command::DestroyBuilding(change(home)), FIXTURE_START + 40));
    assert_eq!(structures.structure_buildings(home).population.max, before + 12 + 7);
}

#[test]
fn a_barracks_produces_only_knights_at_the_ruled_rate() {
    let (d, home) = research_world();
    let knights = crate::logic::resources::rule(26).realm_rate;
    assert!(execute(d, build_toward(home, crate::research::BARRACKS, 0), FIXTURE_START + 40));
    assert_eq!(rate(d, home, 26), knights);
    assert_eq!(rate(d, home, 27), 0);
    assert_eq!(rate(d, home, 28), 0);
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let knight = ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type: 26 };
    let before = resources.resource_balance(knight);
    assert!(execute(d, Command::DestroyBuilding(change(home)), FIXTURE_START + 100));
    assert_eq!(resources.resource_balance(knight), before + knights.into() * 60);
    for resource_type in array![27_u8, 28] {
        assert_eq!(resources.resource_balance(ResourceSlot { resource_type, ..knight }), 0);
    }
}

#[test]
fn a_tier_the_realm_cannot_pay_in_labor_is_refused_and_changes_nothing() {
    let (d, home) = research_world();
    assert!(execute(d, build_toward(home, crate::research::FARM, 0), FIXTURE_START + 40));
    for _ in 0..3_u8 {
        assert!(
            execute(d, research(home, crate::research::ROW_FARM, crate::research::CHOICE_MAKE), FIXTURE_START + 40),
        );
    }
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let labor = ResourceSlot {
        game_id: home.game_id, entity_id: home.entity_id, resource_type: crate::resources::LABOR,
    };
    let legendary = crate::logic::research::price(crate::research::ROW_FARM, 4).labor;
    let held = resources.resource_balance(labor);
    start_cheat_caller_address(d.games, d.games);
    crate::resources::IResourceOperationsDispatcherTrait::spend_resource(
        resources,
        home,
        crate::resources::LABOR,
        held - (legendary - 1),
        FIXTURE_START + 40,
        crate::commands::resource_context(
            crate::commands::ExecutionContext {
                timestamp: FIXTURE_START + 40, ..crate::tests::context(d.games, home.game_id),
            },
        ),
    );
    stop_cheat_caller_address(d.games);
    let before = resource_facts(d, home);
    let knowledge = learned(d, home);
    assert_terminal_rejection(
        d, research(home, crate::research::ROW_FARM, crate::research::CHOICE_MAKE), FIXTURE_START + 40,
    );
    assert_eq!(resource_facts(d, home), before);
    assert_eq!(learned(d, home), knowledge);
}

#[test]
fn a_copy_costs_its_base_times_one_plus_the_square_of_the_copies_before_it() {
    let (d, home) = building_world();
    grant_population(d, home, 40);
    let farm = *crate::balance::structures::BUILDINGS.span().at(crate::research::FARM.into() - 1);
    assert_eq!(farm.simple_count, 1);
    let cost = *crate::balance::structures::BUILDING_COSTS.span().at(farm.first_cost);
    assert_eq!(cost.resource_type, crate::resources::LABOR);
    super::unlimited_production::settle(d, home, crate::resources::LABOR, FIXTURE_START + 40);
    for (direction, multiple) in array![(0_u8, 1_u128), (1, 2), (2, 5), (3, 10)] {
        super::resource_commands::grant(d, home, crate::resources::LABOR, cost.amount * multiple);
        let before = balance(d, home, crate::resources::LABOR);
        assert!(execute(d, build_toward(home, crate::research::FARM, direction), FIXTURE_START + 40));
        assert_eq!(before - balance(d, home, crate::resources::LABOR), cost.amount * multiple);
    }
}

#[test]
fn granary_settles_overflow_under_the_old_limit_before_enlarging_it() {
    let (d, home) = research_world();
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let wheat = ResourceSlot {
        game_id: home.game_id, entity_id: home.entity_id, resource_type: crate::resources::WHEAT,
    };
    super::resource_commands::grant(d, home, crate::resources::WHEAT, 10000000 * crate::rules::RESOURCE_PRECISION);
    let base = resources.resource_balance(wheat);
    let troops = ResourceSlot { resource_type: 26, ..wheat };
    super::resource_commands::grant(d, home, 26, 10000000 * crate::rules::RESOURCE_PRECISION);
    let troop_base = resources.resource_balance(troops);
    assert!(base > 0 && troop_base > 0);
    assert!(execute(d, build_toward(home, crate::research::FARM, 0), FIXTURE_START + 40));
    assert!(execute(d, research(home, crate::research::ROW_FARM, crate::research::CHOICE_STORE), FIXTURE_START + 100));
    // Enlarging a full store cannot recover any earlier overflow.
    assert_eq!(resources.resource_balance(wheat), base);
    start_cheat_caller_address(d.games, d.games);
    for resource in array![crate::resources::WHEAT, 26] {
        crate::resources::IResourceOperationsDispatcherTrait::grant_resource(
            resources,
            home,
            resource,
            10000000 * crate::rules::RESOURCE_PRECISION,
            FIXTURE_START + 101,
            crate::commands::resource_context(super::context(d.games, home.game_id)),
        );
    }
    stop_cheat_caller_address(d.games);
    assert_eq!(resources.resource_balance(wheat), base * 7 / 5);
    assert_eq!(resources.resource_balance(troops), troop_base);
}

#[test]
fn frontier_storage_grants_clip_at_each_exact_s2_cap_without_changing_troops() {
    let (d, home) = building_world();
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    for level in 0_u32..4 {
        for picks in 0_u8..6 {
            let mut knowledge = 0;
            for _ in 0..picks {
                knowledge = crate::research::learn(knowledge, crate::research::ROW_FARM, 1);
                knowledge = crate::research::learn(knowledge, crate::research::ROW_WORKSHOP, 1);
            }
            let knowledge = knowledge;
            snforge_std::interact_with_state(
                d.games,
                || {
                    crate::logic::research::write(home, crate::research::RealmKnowledge { learned: knowledge });
                },
            );
            let board = crate::balance::structures::BOARD;
            let wheat_store: u128 = (*array![
                board.settlement_resource_cap, board.city_resource_cap, board.kingdom_resource_cap,
                board.empire_resource_cap,
            ]
                .at(level))
                .into();
            let labor_store: u128 = (*crate::balance::structures::LABOR_STORES.span().at(level)).into();
            let troop_cap: u128 = Into::<
                u32, u128,
            >::into(crate::troops::deployment_cap(crate::balance::rules::TROOP_LIMIT_CONFIG, level.try_into().unwrap()))
                * board.troop_store_deploys.into();
            for resource_type in array![crate::resources::WHEAT, crate::resources::LABOR, 26_u8] {
                let store = if resource_type == crate::resources::WHEAT {
                    wheat_store
                } else {
                    labor_store
                };
                let cap = if resource_type == 26 {
                    troop_cap
                } else {
                    store * (10000 + Into::<u8, u128>::into(picks) * board.storage_step_bps.into()) / 10000
                };
                // Clear prior stock before testing each grant, so larger stores cannot mask clipping.
                set_fixture(
                    d.games,
                    selector!("resources"),
                    selector!("balances"),
                    array![home.game_id.into(), home.entity_id.into(), resource_type.into()].span(),
                    0_u128,
                );
                super::resource_commands::grant(d, home, resource_type, 10000000 * crate::rules::RESOURCE_PRECISION);
                assert_eq!(
                    resources
                        .resource_balance(
                            ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type },
                        ),
                    cap * crate::rules::RESOURCE_PRECISION,
                );
            }
        }
        if level < 3 {
            snforge_std::interact_with_state(
                d.games,
                || {
                    let base = crate::logic::structures::structure(home).unwrap().base;
                    crate::logic::structures::StructureState::upgrade(
                        home, base, crate::balance::rules::TROOP_LIMIT_CONFIG,
                    );
                },
            );
        }
    }
}

#[test]
fn workshop_sides_follow_their_exact_ladder() {
    let ladders = array![
        (
            crate::research::ROW_WORKSHOP,
            crate::research::WORKSHOP,
            array![(1000_u128, 1000_u128), (2000, 2000), (8000, 6000), (24000, 16000), (60000, 40000)].span(),
        ),
    ];
    for (row, category, prices) in ladders {
        let (d, home) = research_world();
        let resources = IResourceOperationsDispatcher { contract_address: d.games };
        let essence = ResourceSlot {
            game_id: home.game_id, entity_id: home.entity_id, resource_type: crate::resources::ESSENCE,
        };
        let labor = ResourceSlot { resource_type: crate::resources::LABOR, ..essence };
        assert!(execute(d, build_toward(home, category, 0), FIXTURE_START + 40));
        for side in 0_u8..crate::research::choice_count(row) {
            for at in 0_u32..5 {
                start_cheat_caller_address(d.games, d.games);
                crate::resources::IResourceOperationsDispatcherTrait::grant_resource(
                    resources,
                    home,
                    crate::resources::LABOR,
                    10000000 * crate::rules::RESOURCE_PRECISION,
                    FIXTURE_START + 40,
                    crate::commands::resource_context(super::context(d.games, home.game_id)),
                );
                stop_cheat_caller_address(d.games);
                let before_e = resources.resource_balance(essence);
                let before_l = resources.resource_balance(labor);
                assert!(execute(d, research(home, row, side), FIXTURE_START + 40));
                let (expected_essence, expected_labor) = *prices.at(at);
                assert_eq!(
                    before_e - resources.resource_balance(essence), expected_essence * crate::rules::RESOURCE_PRECISION,
                );
                assert_eq!(
                    before_l - resources.resource_balance(labor), expected_labor * crate::rules::RESOURCE_PRECISION,
                );
                assert_eq!(crate::research::picks(learned(d, home), row, side), at.try_into().unwrap() + 1_u8);
            }
            assert_terminal_rejection(d, research(home, row, side), FIXTURE_START + 40);
        }
        assert_eq!(crate::research::purchases(learned(d, home), row), 5 * crate::research::choice_count(row));
    }
}

#[test]
#[test_case(42, 0, name: "supply_yard")]
fn construction_grants_common_once_and_the_next_purchase_costs_uncommon(category: u8, kind: u8) {
    let (d, home) = research_world();
    let row = crate::research::ROW_SUPPLY_YARD;
    let command = CreateBuilding {
        structure_id: home.entity_id, directions: array![0_u8].span(), category, use_simple: true,
    };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let essence = ResourceSlot {
        game_id: home.game_id, entity_id: home.entity_id, resource_type: crate::resources::ESSENCE,
    };
    let labor = ResourceSlot { resource_type: crate::resources::LABOR, ..essence };
    let essence_before = resources.resource_balance(essence);
    let construction_labor_before = resources.resource_balance(labor);
    assert!(execute(d, Command::CreateBuilding(command), FIXTURE_START + 40));
    assert_eq!(essence_before - resources.resource_balance(essence), 6000 * crate::rules::RESOURCE_PRECISION);
    assert_eq!(construction_labor_before - resources.resource_balance(labor), 1500 * crate::rules::RESOURCE_PRECISION);
    assert_eq!(crate::research::tier(learned(d, home), row), 1);
    let price = crate::logic::research::price(row, 2);
    assert_eq!(
        (price.essence, price.labor),
        (16000 * crate::rules::RESOURCE_PRECISION, 3000 * crate::rules::RESOURCE_PRECISION),
    );
    let essence_before = resources.resource_balance(essence);
    let labor_before = resources.resource_balance(labor);
    assert!(execute(d, research(home, row, kind), FIXTURE_START + 40));
    assert_eq!(essence_before - resources.resource_balance(essence), price.essence);
    assert_eq!(labor_before - resources.resource_balance(labor), price.labor);
    assert_eq!(crate::research::tier(learned(d, home), row), 2);
    let knowledge = learned(d, home);
    assert!(execute(d, Command::DestroyBuilding(change(home)), FIXTURE_START + 40));
    assert!(execute(d, Command::CreateBuilding(command), FIXTURE_START + 40));
    assert_eq!(learned(d, home), knowledge);
}

#[test]
fn lodges_produce_scouts_without_a_training_gate_and_each_copy_adds_its_rate() {
    let (d, home) = research_world();
    assert_eq!(learned(d, home), 0);
    assert!(execute(d, build_toward(home, crate::research::SCOUTS_LODGE, 0), FIXTURE_START + 40));
    let expected = crate::logic::resources::rule(32).realm_rate;
    assert_eq!(rate(d, home, 32), expected);
    assert!(execute(d, build_toward(home, crate::research::SCOUTS_LODGE, 1), FIXTURE_START + 40));
    assert_eq!(rate(d, home, 32), 2 * expected);
}

#[test]
fn supply_yard_is_unique_without_retired_research_prerequisites() {
    let (d, home) = research_world();
    assert_eq!(learned(d, home), 0);
    assert!(execute(d, build_toward(home, crate::research::SUPPLY_YARD, 0), FIXTURE_START + 40));
    assert_eq!(crate::research::tier(learned(d, home), crate::research::ROW_SUPPLY_YARD), 1);
    assert_terminal_rejection(d, build_toward(home, crate::research::SUPPLY_YARD, 2), FIXTURE_START + 40);
    assert_eq!(crate::research::tier(learned(d, home), crate::research::ROW_SUPPLY_YARD), 1);
}

#[test]
fn camp_research_settles_and_raises_every_troop_building_while_rations_is_independent() {
    let (d, home) = research_world();
    for (category, direction) in array![
        (crate::research::BARRACKS, 0_u8), (crate::research::RANGE, 1), (crate::research::SCOUTS_LODGE, 2),
    ] {
        assert!(execute(d, build_toward(home, category, direction), FIXTURE_START + 40));
    }
    assert!(execute(d, build_toward(home, crate::research::CONSCRIPTION_CAMP, 3), FIXTURE_START + 100));
    for resource_type in array![26_u8, 29, 32] {
        let base = crate::logic::resources::rule(resource_type).realm_rate;
        assert_eq!(rate(d, home, resource_type), stepped(base, 1));
        assert_eq!(balance(d, home, resource_type), base.into() * 60);
    }
    assert_eq!(crate::research::tier(learned(d, home), crate::research::ROW_RATIONS), 0);
    assert!(execute(d, research(home, crate::research::ROW_CONSCRIPTION, 0), FIXTURE_START + 160));
    assert!(execute(d, build_toward(home, crate::research::RATIONS_DEPOT, 4), FIXTURE_START + 160));
    for resource_type in array![26_u8, 29, 32] {
        let base = crate::logic::resources::rule(resource_type).realm_rate;
        assert_eq!(rate(d, home, resource_type), stepped(base, 2));
        assert_eq!(balance(d, home, resource_type), base.into() * 60 + stepped(base, 1).into() * 60);
    }
    assert_terminal_rejection(d, build_toward(home, crate::research::CONSCRIPTION_CAMP, 5), FIXTURE_START + 160);
    assert_terminal_rejection(d, build_toward(home, crate::research::RATIONS_DEPOT, 5), FIXTURE_START + 160);
    let crossbows = crate::logic::resources::rule(29).realm_rate;
    let held = balance(d, home, 29);
    assert!(execute(d, build_toward(home, crate::research::RANGE, 5), FIXTURE_START + 160));
    assert_eq!(rate(d, home, 29), 2 * stepped(crossbows, 2));
    assert!(
        execute(
            d,
            Command::DestroyBuilding(
                ChangeBuilding {
                    structure_id: home.entity_id,
                    coord: crate::geometry::neighbor(Coord { alt: false, x: 10, y: 10 }, 5),
                },
            ),
            FIXTURE_START + 190,
        ),
    );
    assert_eq!(rate(d, home, 29), stepped(crossbows, 2));
    assert_eq!(balance(d, home, 29), held + 2 * stepped(crossbows, 2).into() * 30);
}

#[test]
fn camp_and_depot_charge_their_own_exact_ladder_once_and_preserve_it_after_rebuilding() {
    for (row, category) in array![
        (crate::research::ROW_CONSCRIPTION, crate::research::CONSCRIPTION_CAMP),
        (crate::research::ROW_RATIONS, crate::research::RATIONS_DEPOT),
    ] {
        let (d, home) = research_world();
        let resources = IResourceOperationsDispatcher { contract_address: d.games };
        let essence = ResourceSlot {
            game_id: home.game_id, entity_id: home.entity_id, resource_type: crate::resources::ESSENCE,
        };
        let labor = ResourceSlot { resource_type: crate::resources::LABOR, ..essence };
        let prices = array![(2500_u128, 500_u128), (5000, 1000), (12500, 2500), (25000, 5000), (50000, 12500)];
        for at in 0_u32..5 {
            let before_e = resources.resource_balance(essence);
            let before_l = resources.resource_balance(labor);
            let command = if at == 0 {
                build_toward(home, category, 0)
            } else {
                research(home, row, 0)
            };
            assert!(execute(d, command, FIXTURE_START + 40));
            let (cost_e, cost_l) = *prices.at(at);
            assert_eq!(before_e - resources.resource_balance(essence), cost_e * crate::rules::RESOURCE_PRECISION);
            assert_eq!(before_l - resources.resource_balance(labor), cost_l * crate::rules::RESOURCE_PRECISION);
            assert_eq!(crate::research::tier(learned(d, home), row), at.try_into().unwrap() + 1_u8);
        }
        assert_terminal_rejection(d, research(home, row, 0), FIXTURE_START + 40);
        assert_terminal_rejection(d, research(home, row, 1), FIXTURE_START + 40);
        assert!(execute(d, Command::DestroyBuilding(change(home)), FIXTURE_START + 40));
        assert_terminal_rejection(d, research(home, row, 0), FIXTURE_START + 40);
        assert!(execute(d, build_toward(home, category, 0), FIXTURE_START + 40));
        assert_eq!(crate::research::tier(learned(d, home), row), 5);
    }
}

#[test]
fn range_and_camp_open_at_city_and_depot_at_kingdom() {
    let (d, home) = building_world();
    grant_population(d, home, 40);
    super::resource_commands::grant(d, home, crate::resources::ESSENCE, 100000 * crate::rules::RESOURCE_PRECISION);
    for category in array![crate::research::RANGE, crate::research::CONSCRIPTION_CAMP, crate::research::RATIONS_DEPOT] {
        assert_terminal_rejection(d, build_toward(home, category, 0), FIXTURE_START + 40);
    }
    level_up(d, home, FIXTURE_START + 40);
    super::resource_commands::grant(d, home, crate::resources::LABOR, 100000 * crate::rules::RESOURCE_PRECISION);
    assert!(execute(d, build_toward(home, crate::research::RANGE, 0), FIXTURE_START + 40));
    assert!(execute(d, build_toward(home, crate::research::CONSCRIPTION_CAMP, 1), FIXTURE_START + 40));
    assert_terminal_rejection(d, build_toward(home, crate::research::RATIONS_DEPOT, 2), FIXTURE_START + 40);
    level_up(d, home, FIXTURE_START + 40);
    super::resource_commands::grant(d, home, crate::resources::LABOR, 100000 * crate::rules::RESOURCE_PRECISION);
    assert!(execute(d, build_toward(home, crate::research::RATIONS_DEPOT, 2), FIXTURE_START + 40));
    assert_eq!(crate::research::tier(learned(d, home), crate::research::ROW_CONSCRIPTION), 1);
    assert_eq!(crate::research::tier(learned(d, home), crate::research::ROW_RATIONS), 1);
}

#[test]
fn knights_buy_three_oath_slots_at_the_barracks_for_the_exact_price() {
    buys_three_oath_slots(
        crate::research::ROW_KNIGHT_OATHS, crate::research::BARRACKS, crate::troops::TroopType::Knight,
    );
}

#[test]
fn paladins_buy_three_oath_slots_at_the_scouts_lodge_for_the_exact_price() {
    buys_three_oath_slots(
        crate::research::ROW_SCOUT_OATHS, crate::research::SCOUTS_LODGE, crate::troops::TroopType::Paladin,
    );
}

#[test]
fn crossbowmen_buy_three_oath_slots_at_the_range_for_the_exact_price() {
    buys_three_oath_slots(
        crate::research::ROW_CROSSBOW_OATHS, crate::research::RANGE, crate::troops::TroopType::Crossbowman,
    );
}

fn buys_three_oath_slots(row: u8, category: u8, troop: crate::troops::TroopType) {
    let (d, home) = research_world();
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let essence = ResourceSlot {
        game_id: home.game_id, entity_id: home.entity_id, resource_type: crate::resources::ESSENCE,
    };
    let labor = ResourceSlot { resource_type: crate::resources::LABOR, ..essence };
    assert_eq!(crate::research::oath_slots(learned(d, home), troop), 2);
    assert_terminal_rejection(d, research(home, row, 0), FIXTURE_START + 40);
    assert!(execute(d, build_toward(home, category, 0), FIXTURE_START + 40));
    assert_eq!(crate::research::oath_slots(learned(d, home), troop), 2);
    let prices = array![(5000_u128, 1000_u128), (35000, 7500), (150000, 35000)];
    for at in 0_u32..3 {
        let before_e = resources.resource_balance(essence);
        let before_l = resources.resource_balance(labor);
        assert!(execute(d, research(home, row, 0), FIXTURE_START + 40));
        let (cost_e, cost_l) = *prices.at(at);
        assert_eq!(before_e - resources.resource_balance(essence), cost_e * crate::rules::RESOURCE_PRECISION);
        assert_eq!(before_l - resources.resource_balance(labor), cost_l * crate::rules::RESOURCE_PRECISION);
        assert_eq!(crate::research::oath_slots(learned(d, home), troop), at.try_into().unwrap() + 3_u8);
        for other in array![
            crate::troops::TroopType::Knight, crate::troops::TroopType::Paladin, crate::troops::TroopType::Crossbowman,
        ] {
            if other != troop {
                assert_eq!(crate::research::oath_slots(learned(d, home), other), 2);
            }
        }
    }
    assert_terminal_rejection(d, research(home, row, 0), FIXTURE_START + 40);
    assert_terminal_rejection(d, research(home, row, 1), FIXTURE_START + 40);
    assert!(execute(d, Command::DestroyBuilding(change(home)), FIXTURE_START + 40));
    assert!(execute(d, build_toward(home, category, 0), FIXTURE_START + 40));
    assert_eq!(crate::research::oath_slots(learned(d, home), troop), 5);
}

