use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use crate::buildings::{
    BuildingKey, BuildingRule, BuildingRuleConfig, ChangeBuilding, CreateBuilding, IBuildingCommandsSafeDispatcher,
    IBuildingCommandsSafeDispatcherTrait, IBuildingRulesDispatcher, IBuildingRulesDispatcherTrait,
    IBuildingRulesSafeDispatcher, IBuildingRulesSafeDispatcherTrait,
};
use crate::commands::Command;
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
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
fn building_world() -> (super::Deployment, ResourceKey) {
    let (deployment, home, _) = setup();
    start_cheat_caller_address(deployment.peers.structures, super::authority());
    IBuildingRulesDispatcher { contract_address: deployment.peers.structures }.configure_buildings(3, rules());
    stop_cheat_caller_address(deployment.peers.structures);
    start_cheat_caller_address(deployment.peers.season, super::authority());
    let recipe = UpgradeRecipe { costs: array![].span() };
    IUpgradeRulesDispatcher { contract_address: deployment.peers.season }
        .configure_upgrades(3, UpgradeLimits { realm_max: 3, village_max: 2 }, array![recipe, recipe, recipe].span());
    stop_cheat_caller_address(deployment.peers.season);
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
    let (deployment, home) = building_world();
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
    let (deployment, home) = building_world();
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
    let (deployment, home) = building_world();
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
    assert!(dispatcher.configure_buildings(3, rules()).is_err());
    start_cheat_caller_address(deployment.peers.structures, super::authority());
    assert!(dispatcher.configure_buildings(3, rules().slice(0, 39)).is_err());
    assert!(dispatcher.configure_buildings(3, rules()).is_ok());
    assert!(dispatcher.configure_buildings(3, rules()).is_err());
    stop_cheat_caller_address(deployment.peers.structures);
}


#[test]
fn storehouse_capacity_is_retained_while_paused_and_cannot_be_removed_while_needed() {
    let (deployment, home) = building_world();
    let game = IGameDispatcher { contract_address: deployment.peers.season };
    let mut rules = game.rules(3);
    rules.capacity_config.storehouse_boost_capacity = 1;
    set_fixture(deployment.peers.season, selector!("rules"), array![3].span(), rules);
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
    let (deployment, home) = building_world();
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
    let (deployment, home) = building_world();
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
    let (deployment, home) = building_world();
    let structures = IStructuresDispatcher { contract_address: deployment.peers.structures };
    let before = resource_facts(deployment, home);
    for timestamp in array![19_u64, 201] {
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
            troop_guards: structure.troop_guards,
            resources_packed: structure.resources_packed,
        },
    );
    for command in array![
        create(home, 37), Command::PauseBuildingProduction(change(home)),
        Command::ResumeBuildingProduction(change(home)), Command::DestroyBuilding(change(home)),
    ] {
        assert_terminal_rejection(deployment, command, 60);
    }
    assert_eq!(resource_facts(deployment, home), before);
    assert!(structures.building(east()).is_none());
}

#[test]
fn labor_buildings_cannot_be_destroyed_and_population_blocks_overbuilding() {
    let (deployment, home) = building_world();
    let structures = IStructuresDispatcher { contract_address: deployment.peers.structures };
    let structure = structures.structure(home).unwrap();
    set_fixture(
        deployment.peers.structures,
        selector!("structures"),
        array![3, home.entity_id.into()].span(),
        crate::structures::StructureRecord {
            owner: structure.owner,
            base: structure.base,
            metadata: structure.metadata,
            troop_guards: structure.troop_guards,
            resources_packed: 23,
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
                    + IGameDispatcher { contract_address: deployment.peers.season }
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
