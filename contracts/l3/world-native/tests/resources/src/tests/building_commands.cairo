pub use world_test_support::tests::building_commands::*;


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
fn building_lifecycle_settles_before_rate_changes_and_removes_the_final_building() {
    let (deployment, home) = building_world(None);
    let structures = IStructureOperationsDispatcher { contract_address: deployment.games };
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    let slot = ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 35 };
    assert!(execute(deployment, create(home, 37), 40));
    assert_eq!(resources.resource_production(slot).building_count, 1);
    assert_eq!(resources.resource_production(slot).production_rate, 2);
    assert_eq!(structures.structure_buildings(home).population.current, 1);
    // Two wheat a second from 40 to 70 pays 60 before pausing.
    assert!(execute(deployment, Command::PauseBuildingProduction(change(home)), 70));
    assert_eq!(resources.resource_balance(slot), 60);
    assert_eq!(resources.resource_production(slot).building_count, 0);
    assert!(structures.building(east()).unwrap().paused);
    assert_terminal_rejection(deployment, Command::PauseBuildingProduction(change(home)), 80);
    assert!(execute(deployment, Command::ResumeBuildingProduction(change(home)), 100));
    assert_eq!(resources.resource_balance(slot), 60);
    assert_eq!(resources.resource_production(slot).last_settled_at, 100);
    assert!(execute(deployment, Command::DestroyBuilding(change(home)), 130));
    assert_eq!(resources.resource_balance(slot), 120);
    assert_eq!(resources.resource_production(slot).building_count, 0);
    assert!(structures.building(east()).is_none());
    assert_eq!(structures.structure_buildings(home).population.current, 0);
}

#[test]
fn failed_building_payment_rolls_back_placement_population_rate_and_resources() {
    let (deployment, home) = building_world(None);
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
        40,
    );
    assert_eq!(resource_facts(deployment, home), before);
    assert_eq!(structures.structure_buildings(home), counts);
    assert!(structures.building(east()).is_none());
    assert_terminal_rejection(deployment, create(home, 3), 40);
    assert_eq!(resource_facts(deployment, home), before);
    assert!(structures.building(east()).is_none());
}

#[test]
fn building_pause_and_resume_use_block_time() {
    let (deployment, home) = building_world(None);
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    let slot = ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 35 };
    assert!(execute(deployment, create(home, 37), 40));
    assert!(execute(deployment, Command::PauseBuildingProduction(change(home)), 70));
    assert_eq!(resources.resource_balance(slot), 60);
    assert_eq!(resources.resource_production(slot).building_count, 0);
}

#[test]
#[feature("safe_dispatcher")]
fn building_configuration_is_authorized_complete_and_immutable() {
    let (deployment, _, _) = setup();
    let registry = crate::registrar::IRegistrarSafeDispatcher { contract_address: deployment.games };
    let preset = building_preset(None);
    assert!(registry.register_preset(20000, preset).is_err());
    start_cheat_caller_address(deployment.games, super::authority());
    let incomplete = crate::presets::PresetDefinition {
        structures: crate::presets::StructurePreset { buildings: rules().slice(0, 39), ..preset.structures }, ..preset,
    };
    assert!(registry.register_preset(20000, incomplete).is_err());
    assert!(registry.register_preset(20000, preset).is_ok());
    assert!(registry.register_preset(20000, preset).is_err());
    stop_cheat_caller_address(deployment.games);
}

#[test]
fn storehouse_capacity_is_retained_while_paused_and_cannot_be_removed_while_needed() {
    let mut preset = building_preset(None);
    preset.rules.capacity_config.storehouse_boost_capacity = 1;
    let (deployment, home) = building_world_with_preset(preset);
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    set_fixture(
        deployment.games,
        selector!("resources"),
        selector!("weights"),
        array![3, home.entity_id.into()].span(),
        crate::resources::Weight { capacity: 100, weight: 100 },
    );
    assert!(execute(deployment, create(home, 2), 40));
    assert_eq!(resources.resource_weight(home).capacity, 100 + crate::rules::RESOURCE_PRECISION);
    assert!(execute(deployment, Command::PauseBuildingProduction(change(home)), 50));
    assert_eq!(resources.resource_weight(home).capacity, 100 + crate::rules::RESOURCE_PRECISION);
    // Production since the last settlement is held stock too, so settle before pinning the stored weight.
    produced_stock(deployment, home, 60);
    let stored = resources.resource_weight(home);
    set_fixture(
        deployment.games,
        selector!("resources"),
        selector!("weights"),
        array![3, home.entity_id.into()].span(),
        crate::resources::Weight { weight: 101, ..stored },
    );
    assert_terminal_rejection(deployment, Command::DestroyBuilding(change(home)), 60);
    assert!(IStructureOperationsDispatcher { contract_address: deployment.games }.building(east()).is_some());
    assert_eq!(resources.resource_weight(home).capacity, stored.capacity);
    produced_stock(deployment, home, 70);
    set_fixture(
        deployment.games,
        selector!("resources"),
        selector!("weights"),
        array![3, home.entity_id.into()].span(),
        crate::resources::Weight { weight: 100, ..stored },
    );
    assert!(execute(deployment, Command::DestroyBuilding(change(home)), 70));
    assert_eq!(resources.resource_weight(home).capacity, 100);
}

#[test]
fn a_blitz_farm_makes_an_hours_output_from_its_exact_start() {
    let (deployment, home) = arena_storehouse_world(true);
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    let wheat = ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type: 35 };
    assert!(execute(deployment, create(home, 37), 40));
    // An hour after its exact start it has produced 3600 seconds of output.
    start_cheat_caller_address(deployment.games, deployment.games);
    crate::resources::IResourceOperationsDispatcherTrait::spend_resource(
        resources, home, 35, 0, 3640, crate::commands::resource_context(super::context(deployment.games, home.game_id)),
    );
    stop_cheat_caller_address(deployment.games);
    assert_eq!(resources.resource_balance(wheat), 3600 * resources.resource_production(wheat).production_rate.into());
}

#[test]
fn blitz_storehouse_settles_against_the_old_limit_when_built() {
    a_new_storehouse_does_not_keep_what_there_was_no_room_for(true);
}

#[test]
fn eternum_storehouse_settles_against_the_old_limit_when_built() {
    a_new_storehouse_does_not_keep_what_there_was_no_room_for(false);
}

#[test]
fn blitz_storehouse_settles_against_the_old_limit_when_demolished() {
    a_demolished_storehouse_does_not_burn_what_was_held(true);
}

#[test]
fn eternum_storehouse_settles_against_the_old_limit_when_demolished() {
    a_demolished_storehouse_does_not_burn_what_was_held(false);
}

#[test]
fn building_placement_rejects_invalid_paths_categories_and_occupied_tiles() {
    let (deployment, home) = building_world(None);
    let structures = IStructureOperationsDispatcher { contract_address: deployment.games };
    let before = resource_facts(deployment, home);
    let counts = structures.structure_buildings(home);
    for directions in array![array![].span(), array![6_u8].span(), array![0_u8, 0].span()] {
        assert_terminal_rejection(
            deployment,
            Command::CreateBuilding(
                CreateBuilding { structure_id: home.entity_id, directions, category: 37, use_simple: true },
            ),
            40,
        );
    }
    for category in array![0_u8, crate::buildings::BUILDING_CATEGORY_COUNT + 1] {
        assert_terminal_rejection(deployment, create(home, category), 40);
    }
    assert_eq!(resource_facts(deployment, home), before);
    assert_eq!(structures.structure_buildings(home), counts);
    assert!(structures.building(east()).is_none());
    assert!(execute(deployment, create(home, 37), 40));
    let before = resource_facts(deployment, home);
    let counts = structures.structure_buildings(home);
    assert_terminal_rejection(deployment, create(home, 37), 40);
    assert_eq!(resource_facts(deployment, home), before);
    assert_eq!(structures.structure_buildings(home), counts);
}

#[test]
fn building_actions_require_ownership_and_the_game_window() {
    let (deployment, home) = building_world(None);
    let structures = IStructureOperationsDispatcher { contract_address: deployment.games };
    let before = resource_facts(deployment, home);
    for timestamp in array![19_u64] {
        for command in array![
            create(home, 37), Command::PauseBuildingProduction(change(home)),
            Command::ResumeBuildingProduction(change(home)), Command::DestroyBuilding(change(home)),
        ] {
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
    for command in array![
        create(home, 37), Command::PauseBuildingProduction(change(home)),
        Command::ResumeBuildingProduction(change(home)), Command::DestroyBuilding(change(home)),
    ] {
        assert_terminal_rejection(deployment, command, 60);
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
    for command in array![
        create(home, 37), Command::PauseBuildingProduction(change(home)),
        Command::ResumeBuildingProduction(change(home)), Command::DestroyBuilding(change(home)),
    ] {
        assert_terminal_rejection(deployment, command, 201);
    }
    assert_eq!(resource_facts(deployment, home), before);
    assert!(structures.building(east()).is_none());
}

#[test]
fn labor_buildings_cannot_be_destroyed_and_population_blocks_overbuilding() {
    let (deployment, home) = building_world(None);
    let structures = IStructureOperationsDispatcher { contract_address: deployment.games };
    let structure = structures.structure(home).unwrap();
    set_fixture(
        deployment.games,
        selector!("structures"),
        selector!("structures"),
        array![3, home.entity_id.into()].span(),
        crate::structures::StructureRecord {
            owner: structure.owner, base: structure.base, metadata: structure.metadata, resources_packed: 23,
        },
    );
    assert!(execute(deployment, create(home, 25), 40));
    assert_terminal_rejection(deployment, Command::DestroyBuilding(change(home)), 50);
    assert!(structures.building(east()).is_some());
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
    assert_terminal_rejection(
        deployment,
        Command::CreateBuilding(
            CreateBuilding {
                structure_id: home.entity_id, directions: array![1_u8].span(), category: 37, use_simple: true,
            },
        ),
        60,
    );
    assert_eq!(resource_facts(deployment, home), before);
}

#[test]
fn a_labor_building_a_player_builds_costs_its_rule_population() {
    let mut preset = building_preset(None);
    let mut buildings = array![];
    for configured in preset.structures.buildings {
        buildings
            .append(
                BuildingRuleConfig {
                    rule: BuildingRule {
                        population_cost: if *configured.category == 25 {
                            2
                        } else {
                            *configured.rule.population_cost
                        },
                        ..*configured.rule,
                    },
                    ..*configured,
                },
            );
    }
    preset.structures.buildings = buildings.span();
    let (deployment, home) = building_world_with_preset(preset);
    let structures = IStructureOperationsDispatcher { contract_address: deployment.games };
    let structure = structures.structure(home).unwrap();
    set_fixture(
        deployment.games,
        selector!("structures"),
        selector!("structures"),
        array![3, home.entity_id.into()].span(),
        crate::structures::StructureRecord {
            owner: structure.owner, base: structure.base, metadata: structure.metadata, resources_packed: 23,
        },
    );
    let before = structures.structure_buildings(home).population.current;
    assert!(execute(deployment, create(home, 25), 40));
    assert_eq!(structures.structure_buildings(home).population.current, before + 2);
}

#[test]
fn castle_ring_limit_accepts_four_and_rejects_five() {
    let preset = building_preset(None);
    let highest_level = preset.structures.upgrade_limits.realm_max;
    let (deployment, home) = building_world_with_preset(preset);
    let structures = IStructureOperationsDispatcher { contract_address: deployment.games };
    let structure = structures.structure(home).unwrap();
    set_fixture(
        deployment.games,
        selector!("structures"),
        selector!("structures"),
        array![3, home.entity_id.into()].span(),
        crate::structures::StructureRecord {
            owner: structure.owner,
            base: crate::structures::StructureBase { level: highest_level, ..structure.base },
            metadata: structure.metadata,
            resources_packed: structure.resources_packed,
        },
    );
    assert!(
        execute(
            deployment,
            Command::CreateBuilding(
                CreateBuilding {
                    structure_id: home.entity_id,
                    directions: array![0_u8, 0, 0, 0].span(),
                    category: 37,
                    use_simple: true,
                },
            ),
            40,
        ),
    );
    let before = resource_facts(deployment, home);
    assert_terminal_rejection(
        deployment,
        Command::CreateBuilding(
            CreateBuilding {
                structure_id: home.entity_id,
                directions: array![0_u8, 0, 0, 0, 0].span(),
                category: 37,
                use_simple: true,
            },
        ),
        40,
    );
    assert_eq!(resource_facts(deployment, home), before);
    assert!(
        structures
            .building(BuildingKey { game_id: home.game_id, structure_id: home.entity_id, inner_col: 15, inner_row: 10 })
            .is_none(),
    );
}

// Matches packages/core realm-research.test.ts: the client decodes the same word.
#[test]
fn realm_knowledge_packs_each_row_tier_and_choice_where_the_client_reads_them() {
    let mut learned = 0;
    learned = crate::research::learn(learned, crate::research::ROW_FARM, crate::research::CHOICE_MAKE);
    learned = crate::research::learn(learned, crate::research::ROW_FARM, crate::research::CHOICE_STORE);
    learned = crate::research::learn(learned, crate::research::ROW_WORKSHOP, crate::research::CHOICE_MAKE);
    learned = crate::research::learn(learned, crate::research::ROW_SHRINE, 0);
    learned = crate::research::learn(learned, crate::research::ROW_DEPTH, 0);
    learned = crate::research::learn(learned, crate::research::ROW_DEPTH, 0);
    assert_eq!(learned, 633318697599113);
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
    let (d, home, preset) = research_world();
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let essence = ResourceSlot {
        game_id: home.game_id, entity_id: home.entity_id, resource_type: crate::resources::ESSENCE,
    };
    let labor = ResourceSlot { resource_type: crate::resources::LABOR, ..essence };
    // No farm stands, and the castle's own labor building is not a workshop.
    assert_terminal_rejection(d, research(home, crate::research::ROW_FARM, crate::research::CHOICE_MAKE), 40);
    assert_terminal_rejection(d, research(home, crate::research::ROW_WORKSHOP, crate::research::CHOICE_MAKE), 40);
    assert!(execute(d, build_toward(home, crate::research::FARM, 0), 40));
    assert_terminal_rejection(d, research(home, crate::research::ROW_FARM, 2), 40);
    for side in 0_u8..2 {
        for tier in 1_u8..6 {
            let price = research_price(preset.structures.research, crate::research::ROW_FARM, tier);
            let (e, l) = *array![(500_u128, 500_u128), (1000, 1000), (4000, 3000), (12000, 8000), (30000, 20000)]
                .at((tier - 1).into());
            assert_eq!(price.essence, e * crate::rules::RESOURCE_PRECISION);
            assert_eq!(price.labor, l * crate::rules::RESOURCE_PRECISION);
            let (essence_before, labor_before) = (
                resources.resource_balance(essence), resources.resource_balance(labor),
            );
            assert!(execute(d, research(home, crate::research::ROW_FARM, side), 40));
            assert_eq!(essence_before - resources.resource_balance(essence), price.essence);
            assert_eq!(labor_before - resources.resource_balance(labor), price.labor);
            assert_eq!(crate::research::picks(learned(d, home), crate::research::ROW_FARM, side), tier);
        }
        assert_terminal_rejection(d, research(home, crate::research::ROW_FARM, side), 40);
    }
    assert_eq!(crate::research::purchases(learned(d, home), crate::research::ROW_FARM), 10);
    // The castle rows need no building and charge Essence alone.
    let before = resources.resource_balance(labor);
    assert!(execute(d, research(home, crate::research::ROW_SHRINE, 0), 40));
    assert_eq!(resources.resource_balance(labor), before);
    assert_terminal_rejection(d, research(home, crate::research::ROW_SHRINE, 0), 40);
    // A hut row has no choice.
    assert!(execute(d, build_toward(home, crate::research::HUT, 1), 40));
    assert_terminal_rejection(d, research(home, crate::research::ROW_HUT, 1), 40);
    assert!(execute(d, research(home, crate::research::ROW_HUT, 0), 40));
}

#[test]
fn a_make_pick_adds_a_fifth_of_the_base_to_every_building_of_the_type_standing_or_future() {
    let (d, home, _) = research_world();
    let wheat = 35_u8;
    assert!(execute(d, build_toward(home, crate::research::FARM, 0), 40));
    assert!(execute(d, build_toward(home, crate::research::FARM, 1), 40));
    let base = rate(d, home, wheat) / 2;
    let fields = base * 12000 / 10000;
    assert!(execute(d, research(home, crate::research::ROW_FARM, crate::research::CHOICE_MAKE), 40));
    assert_eq!(rate(d, home, wheat), 2 * fields);
    assert!(execute(d, build_toward(home, crate::research::FARM, 2), 40));
    assert_eq!(rate(d, home, wheat), 3 * fields);
    // Granary stores more and makes nothing more.
    assert!(execute(d, research(home, crate::research::ROW_FARM, crate::research::CHOICE_STORE), 40));
    assert_eq!(rate(d, home, wheat), 3 * fields);
    assert!(execute(d, Command::DestroyBuilding(change(home)), 40));
    assert_eq!(rate(d, home, wheat), 2 * fields);
    // Tools raise workshops and leave the castle's own labor alone.
    let labor = crate::resources::LABOR;
    let castle = rate(d, home, labor);
    assert!(execute(d, build_toward(home, crate::research::WORKSHOP, 3), 40));
    assert_eq!(rate(d, home, labor), castle + 20);
    assert!(execute(d, research(home, crate::research::ROW_WORKSHOP, crate::research::CHOICE_MAKE), 40));
    assert_eq!(rate(d, home, labor), castle + 24);
}

#[test]
fn each_hut_tier_adds_a_fifth_of_every_huts_population() {
    let (d, home, _) = research_world();
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let before = structures.structure_buildings(home).population.max;
    assert!(execute(d, build_toward(home, crate::research::HUT, 0), 40));
    assert!(execute(d, build_toward(home, crate::research::HUT, 1), 40));
    assert_eq!(structures.structure_buildings(home).population.max, before + 12);
    for _ in 0..3_u8 {
        assert!(execute(d, research(home, crate::research::ROW_HUT, 0), 40));
    }
    // Two huts of 6 at Rare: 12 + 12 * 3 * 20%, rounded down once for the type.
    assert_eq!(structures.structure_buildings(home).population.max, before + 12 + 7);
    assert!(execute(d, build_toward(home, crate::research::HUT, 2), 40));
    assert_eq!(structures.structure_buildings(home).population.max, before + 18 + 10);
    assert!(execute(d, Command::DestroyBuilding(change(home)), 40));
    assert_eq!(structures.structure_buildings(home).population.max, before + 12 + 7);
}


#[test]
fn a_barracks_produces_only_knights_at_the_ruled_rate() {
    let (d, home, _) = research_world();
    assert!(execute(d, build_toward(home, crate::research::BARRACKS, 0), 40));
    assert_eq!(rate(d, home, 26), 40);
    assert_eq!(rate(d, home, 27), 0);
    assert_eq!(rate(d, home, 28), 0);
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let knight = ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type: 26 };
    let before = resources.resource_balance(knight);
    assert!(execute(d, Command::DestroyBuilding(change(home)), 100));
    assert_eq!(resources.resource_balance(knight), before + 2400);
    for resource_type in array![27_u8, 28] {
        assert_eq!(resources.resource_balance(ResourceSlot { resource_type, ..knight }), 0);
    }
}

#[test]
fn a_tier_the_realm_cannot_pay_in_labor_is_refused_and_changes_nothing() {
    let (d, home, preset) = research_world();
    assert!(execute(d, build_toward(home, crate::research::FARM, 0), 40));
    for _ in 0..3_u8 {
        assert!(execute(d, research(home, crate::research::ROW_FARM, crate::research::CHOICE_MAKE), 40));
    }
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let labor = ResourceSlot {
        game_id: home.game_id, entity_id: home.entity_id, resource_type: crate::resources::LABOR,
    };
    let legendary = research_price(preset.structures.research, crate::research::ROW_FARM, 4).labor;
    let held = resources.resource_balance(labor);
    start_cheat_caller_address(d.games, d.games);
    crate::resources::IResourceOperationsDispatcherTrait::spend_resource(
        resources,
        home,
        crate::resources::LABOR,
        held - (legendary - 1),
        30,
        crate::commands::resource_context(
            crate::commands::ExecutionContext { timestamp: 30, ..crate::tests::context(d.games, home.game_id) },
        ),
    );
    stop_cheat_caller_address(d.games);
    let before = resource_facts(d, home);
    let knowledge = learned(d, home);
    assert_terminal_rejection(d, research(home, crate::research::ROW_FARM, crate::research::CHOICE_MAKE), 40);
    assert_eq!(resource_facts(d, home), before);
    assert_eq!(learned(d, home), knowledge);
}

#[test]
fn a_copy_costs_its_base_times_one_plus_the_square_of_the_copies_before_it() {
    let mut preset = building_preset(Some(board_rules()));
    preset.rules.building_config.base_population = 40;
    preset.rules.building_config.base_cost_percent_increase = 10000;
    let (d, home) = building_world_with_preset(preset);
    seed_board_castle(d, home);
    super::resource_commands::grant(d, home, crate::resources::LABOR, 10000);
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let labor = ResourceSlot {
        game_id: home.game_id, entity_id: home.entity_id, resource_type: crate::resources::LABOR,
    };
    for (direction, multiple) in array![(0_u8, 1_u128), (1, 2), (2, 5), (3, 10)] {
        let before = resources.resource_balance(labor);
        assert!(execute(d, build_toward(home, crate::research::FARM, direction), 40));
        assert_eq!(before - resources.resource_balance(labor), 100 * multiple);
    }
}

#[test]
fn board_buildings_never_pause() {
    let (d, home, _) = research_world();
    assert!(execute(d, build_toward(home, crate::research::FARM, 0), 40));
    assert_terminal_rejection(d, Command::PauseBuildingProduction(change(home)), 40);
}

#[test]
fn granary_settles_overflow_under_the_old_limit_before_enlarging_it() {
    let (d, home, _) = research_world();
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
    assert!(execute(d, build_toward(home, crate::research::FARM, 0), 40));
    assert!(execute(d, research(home, crate::research::ROW_FARM, crate::research::CHOICE_STORE), 100));
    // Enlarging a full store cannot recover any earlier overflow.
    assert_eq!(resources.resource_balance(wheat), base);
    start_cheat_caller_address(d.games, d.games);
    for resource in array![crate::resources::WHEAT, 26] {
        crate::resources::IResourceOperationsDispatcherTrait::grant_resource(
            resources,
            home,
            resource,
            10000000 * crate::rules::RESOURCE_PRECISION,
            101,
            crate::commands::resource_context(super::context(d.games, home.game_id)),
        );
    }
    stop_cheat_caller_address(d.games);
    assert_eq!(resources.resource_balance(wheat), base * 7 / 5);
    assert_eq!(resources.resource_balance(troops), troop_base);
}

#[test]
fn frontier_storage_grants_clip_at_each_exact_s2_cap_without_changing_troops() {
    let (_, frontier) = super::preset_projection::current_definition("frontier-check");
    let mut preset = building_preset(frontier.structures.board);
    preset.rules.troop_limit_config = frontier.rules.troop_limit_config;
    let preset = preset;
    let (d, home) = building_world_with_preset(preset);
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
            for resource_type in array![crate::resources::WHEAT, crate::resources::LABOR, 26_u8] {
                let resource_cap = *array![6000_u128, 18000, 40000, 80000].at(level);
                let troop_cap = *array![6000_u128, 18000, 50000, 120000].at(level);
                let cap = if resource_type == 26 {
                    troop_cap
                } else {
                    resource_cap * (5 + 2 * Into::<u8, u128>::into(picks)) / 5
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
                    crate::logic::structures::StructureState::upgrade(home, base, preset.rules.troop_limit_config);
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
        let (d, home, _) = research_world();
        let resources = IResourceOperationsDispatcher { contract_address: d.games };
        let essence = ResourceSlot {
            game_id: home.game_id, entity_id: home.entity_id, resource_type: crate::resources::ESSENCE,
        };
        let labor = ResourceSlot { resource_type: crate::resources::LABOR, ..essence };
        assert!(execute(d, build_toward(home, category, 0), 40));
        for side in 0_u8..crate::research::choice_count(row) {
            for at in 0_u32..5 {
                start_cheat_caller_address(d.games, d.games);
                crate::resources::IResourceOperationsDispatcherTrait::grant_resource(
                    resources,
                    home,
                    crate::resources::LABOR,
                    10000000 * crate::rules::RESOURCE_PRECISION,
                    40,
                    crate::commands::resource_context(super::context(d.games, home.game_id)),
                );
                stop_cheat_caller_address(d.games);
                let before_e = resources.resource_balance(essence);
                let before_l = resources.resource_balance(labor);
                assert!(execute(d, research(home, row, side), 40));
                let (expected_essence, expected_labor) = *prices.at(at);
                assert_eq!(
                    before_e - resources.resource_balance(essence), expected_essence * crate::rules::RESOURCE_PRECISION,
                );
                assert_eq!(
                    before_l - resources.resource_balance(labor), expected_labor * crate::rules::RESOURCE_PRECISION,
                );
                assert_eq!(crate::research::picks(learned(d, home), row, side), at.try_into().unwrap() + 1_u8);
            }
            assert_terminal_rejection(d, research(home, row, side), 40);
        }
        assert_eq!(crate::research::purchases(learned(d, home), row), 5 * crate::research::choice_count(row));
    }
}

#[test]
#[test_case(42, 0, name: "supply_yard")]
fn construction_grants_common_once_and_the_next_purchase_costs_uncommon(category: u8, kind: u8) {
    let (d, home, preset) = research_world();
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
    assert!(execute(d, Command::CreateBuilding(command), 40));
    assert_eq!(essence_before - resources.resource_balance(essence), 6000 * crate::rules::RESOURCE_PRECISION);
    assert_eq!(construction_labor_before - resources.resource_balance(labor), 1500 * crate::rules::RESOURCE_PRECISION);
    assert_eq!(crate::research::tier(learned(d, home), row), 1);
    let price = research_price(preset.structures.research, row, 2);
    assert_eq!(
        (price.essence, price.labor),
        (16000 * crate::rules::RESOURCE_PRECISION, 3000 * crate::rules::RESOURCE_PRECISION),
    );
    let essence_before = resources.resource_balance(essence);
    let labor_before = resources.resource_balance(labor);
    assert!(execute(d, research(home, row, kind), 40));
    assert_eq!(essence_before - resources.resource_balance(essence), price.essence);
    assert_eq!(labor_before - resources.resource_balance(labor), price.labor);
    assert_eq!(crate::research::tier(learned(d, home), row), 2);
    let knowledge = learned(d, home);
    assert!(execute(d, Command::DestroyBuilding(change(home)), 40));
    assert!(execute(d, Command::CreateBuilding(command), 40));
    assert_eq!(learned(d, home), knowledge);
}


#[test]
fn lodges_produce_scouts_without_a_training_gate_and_each_copy_adds_its_rate() {
    let (d, home, _) = research_world();
    assert_eq!(learned(d, home), 0);
    assert!(execute(d, build_toward(home, crate::research::SCOUTS_LODGE, 0), 40));
    let expected: u64 = 40;
    assert_eq!(rate(d, home, 32), expected);
    assert!(execute(d, build_toward(home, crate::research::SCOUTS_LODGE, 1), 40));
    assert_eq!(rate(d, home, 32), 2 * expected);
}

#[test]
fn supply_yard_is_unique_without_retired_research_prerequisites() {
    let (d, home, _) = research_world();
    assert_eq!(learned(d, home), 0);
    assert!(execute(d, build_toward(home, crate::research::SUPPLY_YARD, 0), 40));
    assert_eq!(crate::research::tier(learned(d, home), crate::research::ROW_SUPPLY_YARD), 1);
    assert_terminal_rejection(d, build_toward(home, crate::research::SUPPLY_YARD, 2), 40);
    assert_eq!(crate::research::tier(learned(d, home), crate::research::ROW_SUPPLY_YARD), 1);
}

#[test]
fn camp_research_settles_and_raises_every_troop_building_while_rations_is_independent() {
    let (d, home, _) = research_world();
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    for (category, direction) in array![(crate::research::BARRACKS, 0_u8), (crate::research::RANGE, 1), (crate::research::SCOUTS_LODGE, 2)] {
        assert!(execute(d, build_toward(home, category, direction), 40));
    }
    assert!(execute(d, build_toward(home, crate::research::CONSCRIPTION_CAMP, 3), 100));
    for resource_type in array![26_u8, 29, 32] {
        assert_eq!(rate(d, home, resource_type), 48);
        assert_eq!(resources.resource_balance(ResourceSlot {game_id: home.game_id, entity_id: home.entity_id, resource_type}), 2400);
    }
    assert_eq!(crate::research::tier(learned(d, home), crate::research::ROW_RATIONS), 0);
    assert!(execute(d, research(home, crate::research::ROW_CONSCRIPTION, 0), 160));
    assert!(execute(d, build_toward(home, crate::research::RATIONS_DEPOT, 4), 160));
    for resource_type in array![26_u8, 29, 32] {
        assert_eq!(rate(d, home, resource_type), 56);
        assert_eq!(resources.resource_balance(ResourceSlot {game_id: home.game_id, entity_id: home.entity_id, resource_type}), 5280);
    }
    assert_terminal_rejection(d, build_toward(home, crate::research::CONSCRIPTION_CAMP, 5), 160);
    assert_terminal_rejection(d, build_toward(home, crate::research::RATIONS_DEPOT, 5), 160);
    assert!(execute(d, build_toward(home, crate::research::RANGE, 5), 160));
    assert_eq!(rate(d, home, 29), 112);
    assert!(execute(d, Command::DestroyBuilding(ChangeBuilding {structure_id: home.entity_id, coord: crate::geometry::neighbor(Coord {alt: false, x: 10, y: 10}, 5)}), 220));
    assert_eq!(rate(d, home, 29), 56);
    assert_eq!(resources.resource_balance(ResourceSlot {game_id: home.game_id, entity_id: home.entity_id, resource_type: 29}), 12000);
}

#[test]
fn camp_and_depot_charge_their_own_exact_ladder_once_and_preserve_it_after_rebuilding() {
    for (row, category) in array![(crate::research::ROW_CONSCRIPTION, crate::research::CONSCRIPTION_CAMP), (crate::research::ROW_RATIONS, crate::research::RATIONS_DEPOT)] {
        let (d, home, _) = research_world();
        let resources = IResourceOperationsDispatcher {contract_address: d.games};
        let essence = ResourceSlot {game_id: home.game_id, entity_id: home.entity_id, resource_type: crate::resources::ESSENCE};
        let labor = ResourceSlot {resource_type: crate::resources::LABOR, ..essence};
        let prices = array![(2500_u128, 500_u128), (5000, 1000), (12500, 2500), (25000, 5000), (50000, 12500)];
        for at in 0_u32..5 {
            let before_e = resources.resource_balance(essence);
            let before_l = resources.resource_balance(labor);
            let command = if at == 0 {build_toward(home, category, 0)} else {research(home, row, 0)};
            assert!(execute(d, command, 40));
            let (cost_e, cost_l) = *prices.at(at);
            assert_eq!(before_e - resources.resource_balance(essence), cost_e * crate::rules::RESOURCE_PRECISION);
            assert_eq!(before_l - resources.resource_balance(labor), cost_l * crate::rules::RESOURCE_PRECISION);
            assert_eq!(crate::research::tier(learned(d, home), row), at.try_into().unwrap() + 1_u8);
        }
        assert_terminal_rejection(d, research(home, row, 0), 40);
        assert_terminal_rejection(d, research(home, row, 1), 40);
        assert!(execute(d, Command::DestroyBuilding(change(home)), 40));
        assert_terminal_rejection(d, research(home, row, 0), 40);
        assert!(execute(d, build_toward(home, category, 0), 40));
        assert_eq!(crate::research::tier(learned(d, home), row), 5);
    }
}

#[test]
fn range_and_camp_open_at_city_and_depot_at_kingdom() {
    let (_, source) = super::preset_projection::current_definition("frontier-check");
    let mut preset = building_preset(source.structures.board);
    preset.structures.buildings = source.structures.buildings;
    preset.rules.building_config.base_population = 40;
    let (d, home) = building_world_with_preset(preset);
    seed_board_castle(d, home);
    super::resource_commands::grant(d, home, crate::resources::LABOR, 100000 * crate::rules::RESOURCE_PRECISION);
    super::resource_commands::grant(d, home, crate::resources::ESSENCE, 100000 * crate::rules::RESOURCE_PRECISION);
    for category in array![crate::research::RANGE, crate::research::CONSCRIPTION_CAMP, crate::research::RATIONS_DEPOT] {
        assert_terminal_rejection(d, build_toward(home, category, 0), 40);
    }
    assert!(execute(d, Command::LevelUp(home.entity_id), 40));
    assert!(execute(d, build_toward(home, crate::research::RANGE, 0), 40));
    assert!(execute(d, build_toward(home, crate::research::CONSCRIPTION_CAMP, 1), 40));
    assert_terminal_rejection(d, build_toward(home, crate::research::RATIONS_DEPOT, 2), 40);
    assert!(execute(d, Command::LevelUp(home.entity_id), 40));
    assert!(execute(d, build_toward(home, crate::research::RATIONS_DEPOT, 2), 40));
    assert_eq!(crate::research::tier(learned(d, home), crate::research::ROW_CONSCRIPTION), 1);
    assert_eq!(crate::research::tier(learned(d, home), crate::research::ROW_RATIONS), 1);
}
