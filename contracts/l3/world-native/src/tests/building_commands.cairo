use snforge_std::fs::{FileTrait, read_txt};
use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use crate::buildings::{BuildingKey, BuildingRule, BuildingRuleConfig, ChangeBuilding, CreateBuilding};
use crate::commands::Command;
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::production::{ProductionRecipe, RecipeConfig};
use crate::registrar::IRegistrarSafeDispatcherTrait;
use crate::resources::{
    IResourceOperationsDispatcher, IResourceOperationsDispatcherTrait, ResourceAmount, ResourceKey, ResourceSlot,
};
use crate::structures::IStructureOperationsDispatcher;
use crate::tests::state::{ResourceObservationTrait, StructureObservationTrait};
use crate::troops::Coord;
use crate::upgrades::{UpgradeLimits, UpgradeRecipe};
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
fn building_preset(board: Option<crate::buildings::BoardRules>) -> crate::presets::PresetDefinition {
    let mut preset = super::resource_commands::fixture_preset(super::recorded::rules());
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
    preset.structures.buildings = configured.span();
    preset.structures.board = board;
    let recipe = UpgradeRecipe { costs: array![].span() };
    preset.structures.upgrade_limits = UpgradeLimits { realm_max: 3, village_max: 2 };
    preset.structures.upgrades = array![recipe, recipe, recipe].span();
    preset
}
fn building_world_with_preset(preset: crate::presets::PresetDefinition) -> (super::Deployment, ResourceKey) {
    let (deployment, home, _) = super::resource_commands::setup_with_preset(preset);
    (deployment, home)
}
fn building_world(board: Option<crate::buildings::BoardRules>) -> (super::Deployment, ResourceKey) {
    building_world_with_preset(building_preset(board))
}

fn create(home: ResourceKey, category: u8) -> Command {
    Command::CreateBuilding(
        CreateBuilding { structure_id: home.entity_id, directions: array![0_u8].span(), category, use_simple: true },
    )
}
fn east() -> BuildingKey {
    BuildingKey { game_id: 3, structure_id: 1, inner_col: 11, inner_row: 10 }
}
fn change(home: ResourceKey) -> ChangeBuilding {
    ChangeBuilding { structure_id: home.entity_id, coord: Coord { alt: false, x: 11, y: 10 } }
}

#[test]
fn recorded_board_commands_match_replay_views() {
    let (d, home) = building_world(None);
    let entities = array![home.entity_id].span();
    let tiles = array![IStructureOperationsDispatcher { contract_address: d.games }.position(home).unwrap()].span();
    let mut frames = array![super::spatial_replay::initial(d.games, 3, entities, tiles)];
    let mut spy = snforge_std::spy_events();
    for (command, timestamp) in array![
        (create(home, 37), 40_u64), (Command::PauseBuildingProduction(change(home)), 70),
        (Command::ResumeBuildingProduction(change(home)), 100), (Command::DestroyBuilding(change(home)), 130),
    ] {
        assert!(execute(d, command, timestamp));
        super::state::assert_spatial_indexes(d.games, 3, entities, tiles);
        frames.append(super::spatial_replay::capture(d.games, 3, entities, tiles, ref spy));
    }
    super::spatial_replay::compare("buildings", frames);
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
fn delayed_building_actions_use_recorded_time_after_the_game_ends() {
    let (deployment, home) = building_world(None);
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
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
        crate::resources::Weight { capacity: 100, weight: 0 },
    );
    assert!(execute(deployment, create(home, 2), 40));
    assert_eq!(resources.resource_weight(home).capacity, 100 + crate::rules::RESOURCE_PRECISION);
    assert!(execute(deployment, Command::PauseBuildingProduction(change(home)), 50));
    assert_eq!(resources.resource_weight(home).capacity, 100 + crate::rules::RESOURCE_PRECISION);
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
fn marked_ring_plot_doubles_output_capacity_and_population_without_neighbor_bonuses() {
    for category in array![37_u8, 2, 1] {
        let mut preset = building_preset(
            Some(
                crate::buildings::BoardRules {
                    demolition_refund_bps: 5000,
                    workshop_rate: 20,
                    barracks_ii_cost: 80,
                    barracks_iii_cost: 450,
                    neighbors: array![].span(),
                },
            ),
        );
        preset.rules.building_config.base_population = 20;
        preset.rules.building_config.base_cost_percent_increase = 1500;
        preset.rules.capacity_config.storehouse_boost_capacity = 10;
        let (deployment, home) = building_world_with_preset(preset);
        seed_board_castle(deployment, home);
        super::resource_commands::grant(deployment, home, 23, 10000);
        let baseline = board_output(deployment, home, category);
        assert!(execute(deployment, create(home, category), 40));
        let ordinary = board_output(deployment, home, category) - baseline;
        assert!(ordinary > 0, "fixture must produce an effect");
        let marked = crate::building_ring::marked_plot(1, 1);
        assert_eq!(marked, crate::geometry::neighbor(Coord { alt: false, x: 10, y: 10 }, 4));
        assert!(
            execute(
                deployment,
                Command::CreateBuilding(
                    CreateBuilding {
                        structure_id: home.entity_id, category, directions: array![4_u8].span(), use_simple: true,
                    },
                ),
                40,
            ),
        );
        assert_eq!(board_output(deployment, home, category) - baseline, 3 * ordinary);
        // A workshop beside the marked tile changes none of its effects.
        assert!(
            execute(
                deployment,
                Command::CreateBuilding(
                    CreateBuilding {
                        structure_id: home.entity_id, category: 25, directions: array![5_u8].span(), use_simple: true,
                    },
                ),
                40,
            ),
        );
        assert_eq!(board_output(deployment, home, category) - baseline, 3 * ordinary);
        assert!(execute(deployment, Command::DestroyBuilding(change(home)), 40));
        assert_eq!(board_output(deployment, home, category) - baseline, 2 * ordinary);
        let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
        let labor = ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 23 };
        let before = resources.resource_balance(labor);
        assert!(
            execute(
                deployment,
                Command::DestroyBuilding(ChangeBuilding { structure_id: home.entity_id, coord: marked }),
                40,
            ),
        );
        assert_eq!(resources.resource_balance(labor), before + 57);
        assert_eq!(board_output(deployment, home, category), baseline);
    }
}

fn seed_board_castle(deployment: super::Deployment, home: ResourceKey) {
    // Workshop copy pricing excludes the castle provisioned at settlement.
    set_fixture(
        deployment.games,
        selector!("buildings"),
        selector!("buildings"),
        array![home.game_id.into(), home.entity_id.into(), 10, 10].span(),
        crate::buildings::Building { category: 25, paused: false, labor_paid: 0 },
    );
    let mut counts = IStructureOperationsDispatcher { contract_address: deployment.games }.structure_buildings(home);
    crate::buildings::change_count(ref counts, 25, true);
    set_fixture(
        deployment.games,
        selector!("buildings"),
        selector!("structure_buildings"),
        array![home.game_id.into(), home.entity_id.into()].span(),
        counts,
    );
}

fn board_output(deployment: super::Deployment, home: ResourceKey, category: u8) -> u128 {
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    match category {
        37 => resources
            .resource_production(ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type: 35 })
            .production_rate
            .into(),
        2 => resources.resource_weight(home).capacity,
        1 => IStructureOperationsDispatcher { contract_address: deployment.games }
            .structure_buildings(home)
            .population
            .max
            .into(),
        _ => panic!("unsupported board effect fixture"),
    }
}

#[test]
fn building_ring_matches_shared_vectors_through_the_highest_castle_ring() {
    let input = read_txt(@FileTrait::new("tests/fixtures/frontier-ring-v1.txt"));
    let mut fields = input.span();
    let version: u32 = Serde::deserialize(ref fields).unwrap();
    let count: u32 = Serde::deserialize(ref fields).unwrap();
    assert_eq!(version, 1);
    let highest_ring: u32 = building_preset(None).structures.upgrade_limits.realm_max.into() + 1;
    assert_eq!(count, 12 * highest_ring);
    let mut highest_ring_rows = 0;
    for _ in 0..count {
        let (realm_id, ring, x, y): (u16, u8, u32, u32) = Serde::deserialize(ref fields).unwrap();
        assert!(ring > 0 && ring.into() <= highest_ring, "vector ring outside preset");
        if ring.into() == highest_ring {
            highest_ring_rows += 1;
        }
        let expected = Coord { alt: false, x, y };
        assert_eq!(crate::building_ring::marked_plot(realm_id, ring.into()), expected);
        assert_eq!(crate::geometry::distance(Coord { alt: false, x: 10, y: 10 }, expected), ring.into());
        assert!(crate::building_ring::is_marked_plot(realm_id, expected));
    }
    assert_eq!(highest_ring_rows, 12);
    assert!(fields.is_empty(), "trailing building ring vectors");
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

#[test]
fn barracks_lane_charges_each_essence_cost_and_changes_existing_barracks_to_the_bought_tier() {
    use crate::buildings::BoardRules;
    use crate::upgrades::{BuyRealmUpgrade, RealmUpgradeLane};
    let mut preset = building_preset(
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
    preset.rules.command_mask = 0xffffffffffffffffffffffffffffffff;
    let (deployment, home) = building_world_with_preset(preset);
    let structures = IStructureOperationsDispatcher { contract_address: deployment.games };
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
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
    let mut preset = building_preset(
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
    preset.resources.production = recipes.span();
    let (deployment, home) = building_world_with_preset(preset);
    super::resource_commands::grant(deployment, home, 23, 1000);
    super::resource_commands::grant(deployment, home, 35, 4);
    assert!(execute(deployment, create(home, 28), 40));
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    let troop = ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 26 };
    let wheat = ResourceSlot { resource_type: 35, ..troop };
    start_cheat_caller_address(deployment.games, deployment.games);
    resources
        .spend_resource(
            home, 26, 0, 50, crate::commands::resource_context(super::context(deployment.games, home.game_id)),
        );
    assert_eq!(resources.resource_balance(troop), 2);
    assert_eq!(resources.resource_balance(wheat), 0);
    resources
        .spend_resource(
            home, 26, 0, 60, crate::commands::resource_context(super::context(deployment.games, home.game_id)),
        );
    assert_eq!(resources.resource_balance(troop), 2);
    assert_eq!(resources.resource_production(troop).production_rate, 2);
    assert_eq!(resources.resource_production(troop).output_amount_left, crate::resources::UNLIMITED_OUTPUT);
    stop_cheat_caller_address(deployment.games);

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
    start_cheat_caller_address(deployment.games, deployment.games);
    resources
        .spend_resource(
            home, 26, 0, 75, crate::commands::resource_context(super::context(deployment.games, home.game_id)),
        );
    assert_eq!(resources.resource_balance(troop), 7);
    assert_eq!(resources.resource_balance(wheat), 0);
    // A new wheat grant cannot pay for training during the preceding starvation interval.
    resources
        .grant_resource(
            home,
            35,
            10,
            80,
            crate::commands::resource_context(
                crate::commands::ExecutionContext {
                    timestamp: 80, ..crate::tests::context(deployment.games, (home).game_id),
                },
            ),
        );
    assert_eq!(resources.resource_balance(troop), 12);
    assert_eq!(resources.resource_balance(wheat), 10);
    resources
        .spend_resource(
            home, 26, 0, 80, crate::commands::resource_context(super::context(deployment.games, home.game_id)),
        );
    assert_eq!(resources.resource_balance(troop), 12);
    resources
        .spend_resource(
            home, 26, 0, 81, crate::commands::resource_context(super::context(deployment.games, home.game_id)),
        );
    assert_eq!(resources.resource_balance(troop), 14);
    assert_eq!(resources.resource_balance(wheat), 8);
    assert_eq!(resources.resource_production(troop).output_amount_left, crate::resources::UNLIMITED_OUTPUT);
    stop_cheat_caller_address(deployment.games);
}
