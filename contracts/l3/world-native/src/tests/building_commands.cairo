use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use crate::buildings::{
    BuildingKey, BuildingRule, BuildingRuleConfig, ChangeBuilding, CreateBuilding, IBuildingCommandsSafeDispatcher,
    IBuildingCommandsSafeDispatcherTrait, IBuildingRulesDispatcher, IBuildingRulesDispatcherTrait,
    IBuildingRulesSafeDispatcher, IBuildingRulesSafeDispatcherTrait,
};
use crate::commands::Command;
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::production::{IProductionRulesDispatcher, IProductionRulesDispatcherTrait, ProductionRecipe, RecipeConfig};
use crate::resources::{IResourcesDispatcher, IResourcesDispatcherTrait, ResourceAmount, ResourceKey, ResourceSlot};
use crate::structures::{IStructuresDispatcher, IStructuresDispatcherTrait};
use crate::troops::Coord;
use crate::upgrades::{IUpgradeRulesDispatcher, IUpgradeRulesDispatcherTrait, UpgradeLimits, UpgradeRecipe};
use super::resource_commands::{
    assert_terminal_rejection, execute, execute_recorded_at, resource_facts, set_fixture, setup,
};

pub fn rules() -> Span<BuildingRuleConfig> {
    let mut values = array![];
    for category in 1_u8..41 {
        values
            .append(
                BuildingRuleConfig {
                    category,
                    rule: BuildingRule {
                        population_cost: if category > 2 {
                            1
                        } else {
                            0
                        },
                        capacity_grant: if category == 1 {
                            4
                        } else {
                            0
                        },
                        simple_cost: array![ResourceAmount { resource_type: 1, amount: 10 }].span(),
                        complex_cost: array![ResourceAmount { resource_type: 2, amount: 20 }].span(),
                    },
                },
            );
    }
    values.span()
}
fn building_world(board: Option<crate::buildings::BoardRules>) -> (super::Deployment, ResourceKey) {
    let (deployment, home, _) = setup();
    start_cheat_caller_address(deployment.peers.structures, super::authority());
    let mut configured = array![];
    for rule in rules() {
        configured
            .append(
                if board.is_some() {
                    BuildingRuleConfig {
                        category: *rule.category,
                        rule: BuildingRule {
                            capacity_grant: if *rule.category == 1 {
                                6
                            } else {
                                0
                            },
                            simple_cost: array![ResourceAmount { resource_type: 23, amount: 100 }].span(),
                            ..*rule.rule,
                        },
                    }
                } else {
                    *rule
                },
            );
    }
    IBuildingRulesDispatcher { contract_address: deployment.peers.structures }
        .configure_buildings(3, configured.span(), board);
    stop_cheat_caller_address(deployment.peers.structures);
    start_cheat_caller_address(deployment.peers.settlement, super::authority());
    let recipe = UpgradeRecipe { costs: array![].span() };
    IUpgradeRulesDispatcher { contract_address: deployment.peers.settlement }
        .configure_upgrades(3, UpgradeLimits { realm_max: 3, village_max: 2 }, array![recipe, recipe, recipe].span());
    stop_cheat_caller_address(deployment.peers.settlement);
    (deployment, home)
}
fn create(home: ResourceKey, category: u8) -> Command {
    Command::CreateBuilding(
        CreateBuilding { structure_id: home.entity_id, directions: array![0_u8].span(), category, use_simple: true },
    )
}
fn east() -> BuildingKey {
    BuildingKey { game_id: 3, alt: false, outer_col: 2000000, outer_row: 2000000, inner_col: 11, inner_row: 10 }
}
fn change(home: ResourceKey) -> ChangeBuilding {
    ChangeBuilding { structure_id: home.entity_id, coord: Coord { alt: false, x: 11, y: 10 } }
}

#[test]
fn building_lifecycle_settles_before_rate_changes_and_removes_the_final_building() {
    let (deployment, home) = building_world(None);
    let structures = IStructuresDispatcher { contract_address: deployment.peers.structures };
    let resources = IResourcesDispatcher { contract_address: deployment.peers.resources };
    let slot = ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 35 };
    assert!(execute(deployment, create(home, 37), 40));
    assert_eq!(resources.resource_production(slot).building_count, 1);
    assert_eq!(resources.resource_production(slot).production_rate, 2);
    assert_eq!(structures.structure_buildings(home).population.current, 1);
    assert!(execute(deployment, Command::PauseBuildingProduction(change(home)), 70));
    assert_eq!(resources.resource_balance(slot), 60);
    assert_eq!(resources.resource_production(slot).building_count, 0);
    assert!(structures.building(east()).unwrap().paused);
    assert_terminal_rejection(deployment, Command::PauseBuildingProduction(change(home)), 80);
    assert!(execute(deployment, Command::ResumeBuildingProduction(change(home)), 100));
    assert_eq!(resources.resource_balance(slot), 60);
    assert_eq!(resources.resource_production(slot).last_updated_at, 100);
    assert!(execute(deployment, Command::DestroyBuilding(change(home)), 130));
    assert_eq!(resources.resource_balance(slot), 120);
    assert_eq!(resources.resource_production(slot).building_count, 0);
    assert!(structures.building(east()).is_none());
    assert_eq!(structures.structure_buildings(home).population.current, 0);
}

#[test]
fn failed_building_payment_rolls_back_placement_population_rate_and_resources() {
    let (deployment, home) = building_world(None);
    let structures = IStructuresDispatcher { contract_address: deployment.peers.structures };
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
fn delayed_building_actions_use_recorded_time_after_the_game_ends() {
    let (deployment, home) = building_world(None);
    let resources = IResourcesDispatcher { contract_address: deployment.peers.resources };
    let slot = ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 35 };
    assert!(execute_recorded_at(deployment, create(home, 37), 40, 1000));
    assert!(execute_recorded_at(deployment, Command::PauseBuildingProduction(change(home)), 70, 1001));
    assert_eq!(resources.resource_balance(slot), 60);
    assert_eq!(resources.resource_production(slot).building_count, 0);
}

#[test]
#[feature("safe_dispatcher")]
fn building_configuration_is_authorized_complete_and_immutable() {
    let (deployment, _, _) = setup();
    let dispatcher = IBuildingRulesSafeDispatcher { contract_address: deployment.peers.structures };
    assert!(dispatcher.configure_buildings(3, rules(), None).is_err());
    start_cheat_caller_address(deployment.peers.structures, super::authority());
    assert!(dispatcher.configure_buildings(3, rules().slice(0, 39), None).is_err());
    assert!(dispatcher.configure_buildings(3, rules(), None).is_ok());
    assert!(dispatcher.configure_buildings(3, rules(), None).is_err());
    stop_cheat_caller_address(deployment.peers.structures);
}


#[test]
fn storehouse_capacity_is_retained_while_paused_and_cannot_be_removed_while_needed() {
    let (deployment, home) = building_world(None);
    let game = IGameDispatcher { contract_address: deployment.peers.registry };
    let mut rules = game.rules(3);
    rules.capacity_config.storehouse_boost_capacity = 1;
    set_fixture(deployment.peers.registry, selector!("rules"), array![3].span(), rules);
    let resources = IResourcesDispatcher { contract_address: deployment.peers.resources };
    set_fixture(
        deployment.peers.resources,
        selector!("weights"),
        array![3, home.entity_id.into()].span(),
        crate::resources::Weight { capacity: 100, weight: 0 },
    );
    assert!(execute(deployment, create(home, 2), 40));
    assert_eq!(resources.resource_weight(home).capacity, 100 + crate::rules::RESOURCE_PRECISION);
    assert!(execute(deployment, Command::PauseBuildingProduction(change(home)), 50));
    assert_eq!(resources.resource_weight(home).capacity, 100 + crate::rules::RESOURCE_PRECISION);
    let stored = resources.resource_weight(home);
    set_fixture(
        deployment.peers.resources,
        selector!("weights"),
        array![3, home.entity_id.into()].span(),
        crate::resources::Weight { weight: 101, ..stored },
    );
    assert_terminal_rejection(deployment, Command::DestroyBuilding(change(home)), 60);
    assert!(IStructuresDispatcher { contract_address: deployment.peers.structures }.building(east()).is_some());
    assert_eq!(resources.resource_weight(home).capacity, stored.capacity);
    set_fixture(
        deployment.peers.resources,
        selector!("weights"),
        array![3, home.entity_id.into()].span(),
        crate::resources::Weight { weight: 100, ..stored },
    );
    assert!(execute(deployment, Command::DestroyBuilding(change(home)), 70));
    assert_eq!(resources.resource_weight(home).capacity, 100);
}

#[test]
#[feature("safe_dispatcher")]
fn building_commands_reject_direct_and_foreign_domain_callers() {
    let (deployment, home) = building_world(None);
    let commands = IBuildingCommandsSafeDispatcher { contract_address: deployment.peers.structures };
    let context = crate::commands::ExecutionContext { timestamp: 40, raw_root: 1 };
    for caller in array![deployment.actor, deployment.peers.resources] {
        start_cheat_caller_address(deployment.peers.structures, caller);
        assert!(
            commands
                .create_building(
                    3,
                    deployment.actor,
                    CreateBuilding {
                        structure_id: home.entity_id, directions: array![0_u8].span(), category: 37, use_simple: true,
                    },
                    context,
                )
                .is_err(),
        );
        assert!(commands.destroy_building(3, deployment.actor, change(home), context).is_err());
        assert!(commands.pause_building_production(3, deployment.actor, change(home), context).is_err());
        assert!(commands.resume_building_production(3, deployment.actor, change(home), context).is_err());
    }
    stop_cheat_caller_address(deployment.peers.structures);
}

#[test]
fn building_placement_rejects_invalid_paths_categories_and_occupied_tiles() {
    let (deployment, home) = building_world(None);
    let structures = IStructuresDispatcher { contract_address: deployment.peers.structures };
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
    for category in array![0_u8, 41] {
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
fn building_actions_require_ownership_and_the_recorded_game_window() {
    let (deployment, home) = building_world(None);
    let structures = IStructuresDispatcher { contract_address: deployment.peers.structures };
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
        deployment.peers.structures,
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
        deployment.peers.structures,
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
    let structures = IStructuresDispatcher { contract_address: deployment.peers.structures };
    let structure = structures.structure(home).unwrap();
    set_fixture(
        deployment.peers.structures,
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
        deployment.peers.structures,
        selector!("structure_buildings"),
        array![3, home.entity_id.into()].span(),
        crate::buildings::StructureBuildings {
            population: crate::buildings::Population {
                current: counts.population.max
                    + IGameDispatcher { contract_address: deployment.peers.registry }
                        .rules(3)
                        .building_config
                        .base_population,
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
fn board_neighbors_change_production_capacity_and_population_and_demolition_refunds_paid_labor() {
    use crate::buildings::{BoardRules, Building, NeighborBonus, StructureBuildings};
    let mut neighbors = array![];
    for (building, neighbor) in array![(37_u8, 2_u8), (28, 37), (28, 0), (25, 0)] {
        neighbors.append(NeighborBonus { building, neighbor, production_bps: 1000, capacity_bps: 0, population: 0 });
    }
    for neighbor in array![37_u8, 25] {
        neighbors.append(NeighborBonus { building: 2, neighbor, production_bps: 0, capacity_bps: 1000, population: 0 });
    }
    neighbors.append(NeighborBonus { building: 1, neighbor: 0, production_bps: 0, capacity_bps: 0, population: 2 });
    let (deployment, home) = building_world(
        Some(
            BoardRules {
                demolition_refund_bps: 5000,
                workshop_rate: 20,
                barracks_ii_cost: 80,
                barracks_iii_cost: 450,
                neighbors: neighbors.span(),
            },
        ),
    );
    let structures = IStructuresDispatcher { contract_address: deployment.peers.structures };
    let resources = IResourcesDispatcher { contract_address: deployment.peers.resources };
    let game = IGameDispatcher { contract_address: deployment.peers.registry };
    let mut rules = game.rules(3);
    rules.building_config.base_population = 6;
    rules.building_config.base_cost_percent_increase = 1500;
    rules.capacity_config.storehouse_boost_capacity = 10;
    set_fixture(deployment.peers.registry, selector!("rules"), array![3].span(), rules);
    let mut realm = structures.structure(home).unwrap();
    realm.base.level = 1;
    set_fixture(
        deployment.peers.structures,
        selector!("structures"),
        array![3, home.entity_id.into()].span(),
        crate::structures::StructureRecord {
            owner: realm.owner, base: realm.base, metadata: realm.metadata, resources_packed: realm.resources_packed,
        },
    );
    set_fixture(
        deployment.peers.structures,
        selector!("buildings"),
        array![3, 0, 2000000, 2000000, 10, 10].span(),
        Building { category: 25, outer_entity_id: home.entity_id, paused: false, labor_paid: 0 },
    );
    set_fixture(
        deployment.peers.structures,
        selector!("structure_buildings"),
        array![3, home.entity_id.into()].span(),
        StructureBuildings { packed_counts_2: 0x10000000000000000, ..Default::default() },
    );
    for resource in array![23_u8, 26, 35] {
        set_fixture(
            deployment.peers.resources,
            selector!("resource_rules"),
            array![3, resource.into()].span(),
            (0_u128, 10_u128),
        );
    }
    super::resource_commands::grant(deployment, home, 23, 10000);
    start_cheat_caller_address(deployment.peers.resources, deployment.peers.structures);
    resources.start_production(home, 23, 10, 0xffffffffffffffffffffffffffffffff, 40);
    stop_cheat_caller_address(deployment.peers.resources);
    let capacity = resources.resource_weight(home).capacity;
    let labor = ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 23 };
    let wheat = ResourceSlot { resource_type: 35, ..labor };
    let troops = ResourceSlot { resource_type: 26, ..labor };
    for (category, directions) in array![
        (37_u8, array![0_u8].span()), (25, array![5_u8].span()), (2, array![0_u8, 5].span()), (28, array![1_u8].span()),
        (1, array![3_u8].span()),
    ] {
        assert!(
            execute(
                deployment,
                Command::CreateBuilding(
                    CreateBuilding { structure_id: home.entity_id, category, directions, use_simple: true },
                ),
                40,
            ),
        );
    }
    assert_eq!(resources.resource_production(wheat).production_rate, 11);
    assert_eq!(resources.resource_production(troops).production_rate, 12);
    assert_eq!(resources.resource_production(labor).production_rate, 32);
    assert_eq!(resources.resource_weight(home).capacity, capacity + 12 * crate::rules::RESOURCE_PRECISION);
    assert_eq!(structures.structure_buildings(home).population.max, 8);

    let before = resources.resource_balance(labor);
    assert!(
        execute(
            deployment,
            Command::CreateBuilding(
                CreateBuilding {
                    structure_id: home.entity_id, category: 37, directions: array![3_u8, 3].span(), use_simple: true,
                },
            ),
            40,
        ),
    );
    assert_eq!(resources.resource_balance(labor), before - 115);
    assert!(
        execute(
            deployment,
            Command::DestroyBuilding(
                ChangeBuilding { structure_id: home.entity_id, coord: Coord { alt: false, x: 8, y: 10 } },
            ),
            40,
        ),
    );
    assert_eq!(resources.resource_balance(labor), before - 115 + 57);

    assert!(execute(deployment, Command::DestroyBuilding(change(home)), 40));
    assert_eq!(resources.resource_production(troops).production_rate, 11);
    assert_eq!(resources.resource_weight(home).capacity, capacity + 11 * crate::rules::RESOURCE_PRECISION);
    assert!(
        execute(
            deployment,
            Command::DestroyBuilding(
                ChangeBuilding { structure_id: home.entity_id, coord: Coord { alt: false, x: 11, y: 9 } },
            ),
            40,
        ),
    );
    assert_eq!(resources.resource_production(labor).production_rate, 10);
    assert_eq!(resources.resource_weight(home).capacity, capacity + 10 * crate::rules::RESOURCE_PRECISION);
    assert!(execute(deployment, create(home, 37), 40));
    assert_eq!(resources.resource_production(wheat).production_rate, 11);
    assert!(
        execute(
            deployment,
            Command::DestroyBuilding(
                ChangeBuilding { structure_id: home.entity_id, coord: Coord { alt: false, x: 12, y: 9 } },
            ),
            40,
        ),
    );
    assert_eq!(resources.resource_production(wheat).production_rate, 10);
    assert_eq!(resources.resource_weight(home).capacity, capacity);
    for (x, y) in array![(9_u32, 10_u32), (11, 11)] {
        assert!(
            execute(
                deployment,
                Command::DestroyBuilding(
                    ChangeBuilding { structure_id: home.entity_id, coord: Coord { alt: false, x, y } },
                ),
                40,
            ),
        );
    }
    assert_eq!(structures.structure_buildings(home).population.max, 0);
    assert_eq!(resources.resource_production(troops).production_rate, 0);
}


#[test]
fn barracks_lane_charges_each_essence_cost_and_changes_existing_barracks_to_the_bought_tier() {
    use crate::buildings::BoardRules;
    use crate::upgrades::{BuyRealmUpgrade, RealmUpgradeLane};
    let (deployment, home) = building_world(
        Some(
            BoardRules {
                demolition_refund_bps: 5000,
                workshop_rate: 20,
                barracks_ii_cost: 80,
                barracks_iii_cost: 450,
                neighbors: array![].span(),
            },
        ),
    );
    let structures = IStructuresDispatcher { contract_address: deployment.peers.structures };
    let resources = IResourcesDispatcher { contract_address: deployment.peers.resources };
    let games = IGameDispatcher { contract_address: deployment.peers.registry };
    let mut rules = games.rules(3);
    rules.command_mask = 0xffffffffffffffffffffffffffffffff;
    set_fixture(deployment.peers.registry, selector!("rules"), array![3].span(), rules);
    super::resource_commands::grant(deployment, home, 23, 100);
    super::resource_commands::grant(deployment, home, 38, 79);
    assert!(execute(deployment, create(home, 28), 40));
    let essence = ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 38 };
    let troops = ResourceSlot { resource_type: 26, ..essence };
    let buy = Command::BuyRealmUpgrade(
        BuyRealmUpgrade { structure_id: home.entity_id, lane: RealmUpgradeLane::Barracks },
    );
    assert_terminal_rejection(deployment, buy, 40);
    assert_eq!(resources.resource_balance(essence), 79);
    assert_eq!(structures.structure(home).unwrap().metadata.barracks_tier, 0);
    assert_eq!(resources.resource_production(troops).production_rate, 2);
    super::resource_commands::grant(deployment, home, 38, 451);
    assert!(execute(deployment, buy, 40));
    assert_eq!(resources.resource_balance(essence), 450);
    assert_eq!(structures.structure(home).unwrap().metadata.barracks_tier, 1);
    assert_eq!(resources.resource_production(troops).production_rate, 0);
    assert_eq!(resources.resource_production(ResourceSlot { resource_type: 27, ..troops }).production_rate, 2);
    assert!(execute(deployment, buy, 40));
    assert_eq!(resources.resource_balance(essence), 0);
    assert_eq!(structures.structure(home).unwrap().metadata.barracks_tier, 2);
    assert_eq!(resources.resource_production(ResourceSlot { resource_type: 27, ..troops }).production_rate, 0);
    assert_eq!(resources.resource_production(ResourceSlot { resource_type: 28, ..troops }).production_rate, 2);
    assert_terminal_rejection(deployment, buy, 40);
    assert_eq!(structures.structure(home).unwrap().metadata.barracks_tier, 2);
}


#[test]
fn unlimited_training_consumes_its_simple_recipe_and_waits_for_farm_wheat_without_refills() {
    use crate::buildings::BoardRules;
    let (deployment, home) = building_world(
        Some(
            BoardRules {
                demolition_refund_bps: 5000,
                workshop_rate: 20,
                barracks_ii_cost: 80,
                barracks_iii_cost: 450,
                neighbors: array![].span(),
            },
        ),
    );
    let mut recipes = array![];
    for recipe in super::production::recipes() {
        recipes
            .append(
                RecipeConfig {
                    resource_type: *recipe.resource_type,
                    recipe: ProductionRecipe {
                        simple_output: 1,
                        simple_inputs: array![ResourceAmount { resource_type: 35, amount: 2 }].span(),
                        ..*recipe.recipe,
                    },
                },
            );
    }
    start_cheat_caller_address(deployment.peers.resources, super::authority());
    IProductionRulesDispatcher { contract_address: deployment.peers.resources }.configure_production(3, recipes.span());
    stop_cheat_caller_address(deployment.peers.resources);
    super::resource_commands::grant(deployment, home, 23, 1000);
    super::resource_commands::grant(deployment, home, 35, 4);
    assert!(execute(deployment, create(home, 28), 40));
    let resources = IResourcesDispatcher { contract_address: deployment.peers.resources };
    let troop = ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 26 };
    let wheat = ResourceSlot { resource_type: 35, ..troop };
    start_cheat_caller_address(deployment.peers.resources, deployment.peers.structures);
    resources.spend_resource(home, 26, 0, 50);
    assert_eq!(resources.resource_balance(troop), 2);
    assert_eq!(resources.resource_balance(wheat), 0);
    resources.spend_resource(home, 26, 0, 60);
    assert_eq!(resources.resource_balance(troop), 2);
    assert_eq!(resources.resource_production(troop).production_rate, 2);
    assert_eq!(resources.resource_production(troop).output_amount_left, crate::resources::UNLIMITED_OUTPUT);
    stop_cheat_caller_address(deployment.peers.resources);

    assert!(
        execute(
            deployment,
            Command::CreateBuilding(
                CreateBuilding {
                    structure_id: home.entity_id, category: 37, directions: array![3_u8].span(), use_simple: true,
                },
            ),
            70,
        ),
    );
    start_cheat_caller_address(deployment.peers.resources, deployment.peers.structures);
    resources.spend_resource(home, 26, 0, 75);
    assert_eq!(resources.resource_balance(troop), 7);
    assert_eq!(resources.resource_balance(wheat), 0);
    // A new wheat grant cannot pay for training during the preceding starvation interval.
    resources.grant_resource(home, 35, 10, 80);
    assert_eq!(resources.resource_balance(troop), 12);
    assert_eq!(resources.resource_balance(wheat), 10);
    resources.spend_resource(home, 26, 0, 80);
    assert_eq!(resources.resource_balance(troop), 12);
    resources.spend_resource(home, 26, 0, 81);
    assert_eq!(resources.resource_balance(troop), 14);
    assert_eq!(resources.resource_balance(wheat), 8);
    assert_eq!(resources.resource_production(troop).output_amount_left, crate::resources::UNLIMITED_OUTPUT);
    stop_cheat_caller_address(deployment.peers.resources);
}
