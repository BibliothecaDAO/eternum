use snforge_std::fs::{FileTrait, read_txt};
use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use crate::buildings::{BuildingKey, BuildingRule, BuildingRuleConfig, ChangeBuilding, CreateBuilding};
use crate::commands::Command;
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::registrar::IRegistrarSafeDispatcherTrait;
use crate::resources::{IResourceOperationsDispatcher, ResourceAmount, ResourceKey, ResourceSlot};
use crate::structures::IStructureOperationsDispatcher;
use crate::tests::state::{ResourceObservationTrait, StructureObservationTrait};
use crate::troops::Coord;
use crate::upgrades::{UpgradeLimits, UpgradeRecipe};
use super::resource_commands::{
    assert_terminal_rejection, execute, execute_recorded_at, resource_facts, set_fixture, setup,
};

pub fn rules() -> Span<BuildingRuleConfig> {
    let mut values = array![];
    for category in 1_u8..crate::buildings::BUILDING_CATEGORY_COUNT + 1 {
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
pub fn building_preset(board: Option<crate::buildings::BoardRules>) -> crate::presets::PresetDefinition {
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
    if board.is_some() {
        let (_, frontier) = super::preset_projection::current_definition("frontier");
        preset.structures.research = frontier.structures.research;
    }
    let recipe = UpgradeRecipe { costs: array![].span() };
    preset.structures.upgrade_limits = UpgradeLimits { realm_max: 3, village_max: 2 };
    preset.structures.upgrades = array![recipe, recipe, recipe].span();
    preset
}
pub fn building_world_with_preset(preset: crate::presets::PresetDefinition) -> (super::Deployment, ResourceKey) {
    let (deployment, home, _) = super::resource_commands::setup_with_preset(preset);
    if preset.structures.board.is_some() {
        snforge_std::interact_with_state(
            deployment.games,
            || {
                crate::logic::research::write(home, crate::research::RealmKnowledge { learned: 0 });
            },
        );
    }
    (deployment, home)
}
/// Frontier's board steps: a quarter of the base per make pick or hut tier, half the limit per store pick, a quarter
/// wheat off each troop per Rations pick, and training buildings behind a rare Barracks row.
pub fn board_rules() -> crate::buildings::BoardRules {
    crate::buildings::BoardRules {
        demolition_refund_bps: 5000,
        workshop_rate: 20,
        output_step_bps: 2500,
        storage_step_bps: 5000,
        population_step_bps: 2500,
        ration_step: crate::rules::RESOURCE_PRECISION / 4,
        training_gate_tier: 2,
        castle_store_deploys: 2,
    }
}

pub fn research_price(
    prices: Span<crate::research::ResearchPriceConfig>, row: u8, tier: u8,
) -> crate::research::ResearchPrice {
    for entry in prices {
        if *entry.row == row && *entry.tier == tier {
            return *entry.price;
        }
    }
    panic!("missing research price")
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
    // Two wheat a second, paid in whole minute ticks: the tick ended at 60 pays 120.
    assert!(execute(deployment, Command::PauseBuildingProduction(change(home)), 70));
    assert_eq!(resources.resource_balance(slot), 120);
    assert_eq!(resources.resource_production(slot).building_count, 0);
    assert!(structures.building(east()).unwrap().paused);
    assert_terminal_rejection(deployment, Command::PauseBuildingProduction(change(home)), 80);
    assert!(execute(deployment, Command::ResumeBuildingProduction(change(home)), 100));
    assert_eq!(resources.resource_balance(slot), 120);
    assert_eq!(resources.resource_production(slot).last_settled_tick, 1);
    assert!(execute(deployment, Command::DestroyBuilding(change(home)), 130));
    assert_eq!(resources.resource_balance(slot), 240);
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

/// A realm without a board, under Blitz's or Eternum's rules, whose storehouse adds one unit of storage.
fn arena_storehouse_world(blitz: bool) -> (super::Deployment, ResourceKey) {
    let rules = if blitz {
        crate::rules::SliceRules {
            mode_rules: super::recorded::BLITZ_RULES,
            entry_rule: crate::rules::ENTRY_ROSTER,
            command_mask: super::recorded::BLITZ_COMMAND_MASK,
            ..super::recorded::rules(),
        }
    } else {
        super::recorded::rules()
    };
    let mut preset = super::resource_commands::fixture_preset(rules);
    preset.structures = building_preset(None).structures;
    preset.rules.capacity_config.storehouse_boost_capacity = 1;
    building_world_with_preset(preset)
}

#[test]
fn a_blitz_farm_makes_an_hours_output_in_whole_ticks() {
    let (deployment, home) = arena_storehouse_world(true);
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    let wheat = ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type: 35 };
    assert!(execute(deployment, create(home, 37), 40));
    // Started mid-tick, an hour later it has been paid sixty whole minute ticks: the hour's output, unchanged.
    start_cheat_caller_address(deployment.games, deployment.games);
    crate::resources::IResourceOperationsDispatcherTrait::spend_resource(
        resources, home, 35, 0, 3640, crate::commands::resource_context(super::context(deployment.games, home.game_id)),
    );
    stop_cheat_caller_address(deployment.games);
    assert_eq!(resources.resource_balance(wheat), 3600 * resources.resource_production(wheat).production_rate.into());
}

/// Leaves `room` free in the realm's storage on top of whatever its storehouses add.
fn leave_room(deployment: super::Deployment, home: ResourceKey, room: u128) {
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    let weight = resources.resource_weight(home).weight;
    let storehouses: u128 = crate::buildings::category_count(
        IStructureOperationsDispatcher { contract_address: deployment.games }.structure_buildings(home), 2,
    )
        .into();
    set_fixture(
        deployment.games,
        selector!("resources"),
        selector!("weights"),
        array![home.game_id.into(), home.entity_id.into()].span(),
        crate::resources::Weight { capacity: weight + room + storehouses * crate::rules::RESOURCE_PRECISION, weight },
    );
}

/// The fixture realm's own producer makes two of resource 1 a second from time 30, paid each minute tick, up to 100.
fn produced_stock(deployment: super::Deployment, home: ResourceKey, timestamp: u64) -> u128 {
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    start_cheat_caller_address(deployment.games, deployment.games);
    crate::resources::IResourceOperationsDispatcherTrait::spend_resource(
        resources,
        home,
        1,
        0,
        timestamp,
        crate::commands::resource_context(super::context(deployment.games, home.game_id)),
    );
    stop_cheat_caller_address(deployment.games);
    resources.resource_balance(ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type: 1 })
}

fn a_new_storehouse_does_not_keep_what_there_was_no_room_for(blitz: bool) {
    let (deployment, home) = arena_storehouse_world(blitz);
    assert_eq!(produced_stock(deployment, home, 30), 100);
    leave_room(deployment, home, 10);
    // The ended tick makes the producer's last 100 where there is room for 10; the storehouse, paid with 10, cannot
    // rescue the rest.
    assert!(execute(deployment, create(home, 2), 70));
    assert_eq!(produced_stock(deployment, home, 70), 100);
}

fn a_demolished_storehouse_does_not_burn_what_was_held(blitz: bool) {
    let (deployment, home) = arena_storehouse_world(blitz);
    assert!(execute(deployment, create(home, 2), 40));
    let held = produced_stock(deployment, home, 40);
    leave_room(deployment, home, 10);
    // The ended tick makes the producer's last 100, which the storehouse holds; without it there is room for 10, so it
    // cannot go yet.
    let before = resource_facts(deployment, home);
    assert_terminal_rejection(deployment, Command::DestroyBuilding(change(home)), 70);
    assert_eq!(resource_facts(deployment, home), before);
    assert_eq!(produced_stock(deployment, home, 70), held + 100);
    start_cheat_caller_address(deployment.games, deployment.games);
    crate::resources::IResourceOperationsDispatcherTrait::spend_resource(
        IResourceOperationsDispatcher { contract_address: deployment.games },
        home,
        1,
        90,
        70,
        crate::commands::resource_context(super::context(deployment.games, home.game_id)),
    );
    stop_cheat_caller_address(deployment.games);
    assert!(execute(deployment, Command::DestroyBuilding(change(home)), 70));
    assert_eq!(produced_stock(deployment, home, 70), held + 10);
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

/// A board realm with its castle, every command open, room for many buildings and plenty of Essence and labor.
fn research_world() -> (super::Deployment, ResourceKey, crate::presets::PresetDefinition) {
    let mut preset = building_preset(Some(board_rules()));
    preset.rules.command_mask = 0xffffffffffffffffffffffffffffffff;
    preset.rules.building_config.base_population = 40;
    // Farms and barracks make 40 a second, so each quarter of the base is whole.
    let mut resources = array![];
    for rule in preset.resources.resources {
        resources
            .append(
                if *rule.resource_type == 26 || *rule.resource_type == 35 {
                    crate::resources::ResourceRule { realm_rate: 40, ..*rule }
                } else {
                    *rule
                },
            );
    }
    preset.resources.resources = resources.span();
    let (d, home) = building_world_with_preset(preset);
    seed_board_castle(d, home);
    super::resource_commands::grant(d, home, crate::resources::LABOR, 10000000 * crate::rules::RESOURCE_PRECISION);
    super::resource_commands::grant(d, home, crate::resources::ESSENCE, 10000000 * crate::rules::RESOURCE_PRECISION);
    (d, home, preset)
}

fn research(home: ResourceKey, row: u8, choice: u8) -> Command {
    Command::Research(crate::research::Research { structure_id: home.entity_id, row, choice })
}

fn build_toward(home: ResourceKey, category: u8, direction: u8) -> Command {
    Command::CreateBuilding(
        CreateBuilding { structure_id: home.entity_id, directions: array![direction].span(), category, use_simple: true },
    )
}

fn learned(d: super::Deployment, home: ResourceKey) -> u64 {
    snforge_std::interact_with_state(d.games, || crate::logic::research::require(home)).learned
}

fn rate(d: super::Deployment, home: ResourceKey, resource_type: u8) -> u64 {
    IResourceOperationsDispatcher { contract_address: d.games }
        .resource_production(ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type })
        .production_rate
}

// Matches packages/core realm-research.test.ts: the client decodes the same word.
#[test]
fn realm_knowledge_packs_each_row_tier_and_choice_where_the_client_reads_them() {
    let mut learned = 0;
    learned = crate::research::learn(learned, crate::research::ROW_FARM, crate::research::CHOICE_MAKE);
    learned = crate::research::learn(learned, crate::research::ROW_FARM, crate::research::CHOICE_STORE);
    learned = crate::research::learn(learned, crate::research::ROW_WORKSHOP, crate::research::CHOICE_MAKE);
    learned = crate::research::learn(learned, crate::research::ROW_SCOUTS_LODGE, crate::research::KIND_RIFTS);
    learned = crate::research::learn(learned, crate::research::ROW_SCOUTS_LODGE, crate::research::KIND_CAMPS);
    learned = crate::research::learn(learned, crate::research::ROW_SCOUTS_LODGE, crate::research::KIND_STRAGGLERS);
    learned = crate::research::learn(learned, crate::research::ROW_SHRINE, 0);
    learned = crate::research::learn(learned, crate::research::ROW_DEPTH, 0);
    learned = crate::research::learn(learned, crate::research::ROW_DEPTH, 0);
    assert_eq!(learned, 160600638357650);
    assert_eq!(crate::research::picks(learned, crate::research::ROW_FARM, crate::research::CHOICE_STORE), 1);
    assert_eq!(crate::research::choice(learned, crate::research::ROW_SCOUTS_LODGE, 3), crate::research::KIND_STRAGGLERS);
    // Every row, filled to its last tier on its last side, stays inside its own field.
    let mut full = 0;
    for row in 0..crate::research::ROW_COUNT {
        for _ in 0..crate::research::max_tier(row) {
            full = crate::research::learn(full, row, crate::research::choice_count(row) - 1);
        }
    }
    for row in 0..crate::research::ROW_COUNT {
        assert_eq!(crate::research::tier(full, row), crate::research::max_tier(row));
        for at in 1..crate::research::max_tier(row) + 1 {
            if crate::research::choice_count(row) > 1 {
                assert_eq!(crate::research::choice(full, row, at), crate::research::choice_count(row) - 1);
            }
        }
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
    for tier in 1_u8..5 {
        let side = tier % 2;
        let price = research_price(preset.structures.research, crate::research::ROW_FARM, tier);
        let (essence_before, labor_before) = (resources.resource_balance(essence), resources.resource_balance(labor));
        assert!(execute(d, research(home, crate::research::ROW_FARM, side), 40));
        assert_eq!(essence_before - resources.resource_balance(essence), price.essence);
        assert_eq!(labor_before - resources.resource_balance(labor), price.labor);
        assert_eq!(crate::research::tier(learned(d, home), crate::research::ROW_FARM), tier);
        // Every earlier choice stands: a tier's side is final for the season.
        for at in 1..tier + 1 {
            assert_eq!(crate::research::choice(learned(d, home), crate::research::ROW_FARM, at), at % 2);
        }
    }
    assert_terminal_rejection(d, research(home, crate::research::ROW_FARM, crate::research::CHOICE_MAKE), 40);
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
fn a_make_pick_adds_a_quarter_of_the_base_to_every_building_of_the_type_standing_or_future() {
    let (d, home, _) = research_world();
    let wheat = 35_u8;
    assert!(execute(d, build_toward(home, crate::research::FARM, 0), 40));
    assert!(execute(d, build_toward(home, crate::research::FARM, 1), 40));
    let base = rate(d, home, wheat) / 2;
    let fields = base * 12500 / 10000;
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
    assert_eq!(rate(d, home, labor), castle + 25);
}

#[test]
fn each_hut_tier_adds_a_quarter_of_every_huts_population() {
    let (d, home, _) = research_world();
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let before = structures.structure_buildings(home).population.max;
    assert!(execute(d, build_toward(home, crate::research::HUT, 0), 40));
    assert!(execute(d, build_toward(home, crate::research::HUT, 1), 40));
    assert_eq!(structures.structure_buildings(home).population.max, before + 12);
    for _ in 0..3_u8 {
        assert!(execute(d, research(home, crate::research::ROW_HUT, 0), 40));
    }
    // Two huts of 6 at epic: 12 + 12 * 3 * 25%, rounded down once for the type.
    assert_eq!(structures.structure_buildings(home).population.max, before + 12 + 9);
    assert!(execute(d, build_toward(home, crate::research::HUT, 2), 40));
    assert_eq!(structures.structure_buildings(home).population.max, before + 18 + 13);
    assert!(execute(d, Command::DestroyBuilding(change(home)), 40));
    assert_eq!(structures.structure_buildings(home).population.max, before + 12 + 9);
}

#[test]
fn frontier_barracks_make_one_troop_type_and_drill_adds_a_quarter() {
    let (d, home, _) = research_world();
    assert!(execute(d, build_toward(home, crate::research::BARRACKS, 0), 40));
    let base = rate(d, home, 26);
    assert_eq!(base, 40);
    for side in array![
        crate::research::CHOICE_DRILL, crate::research::CHOICE_DRILL, crate::research::CHOICE_RATIONS,
        crate::research::CHOICE_DRILL,
    ] {
        assert!(execute(d, research(home, crate::research::ROW_BARRACKS, side), 40));
    }
    assert_eq!(rate(d, home, 26), base * 17500 / 10000);
    assert_eq!(rate(d, home, 27), 0);
    assert_eq!(rate(d, home, 28), 0);
}

#[test]
fn a_training_building_is_unique_and_waits_for_a_rare_barracks_row() {
    let (d, home, _) = research_world();
    assert_terminal_rejection(d, build_toward(home, crate::research::WAR_HALL, 0), 40);
    assert_terminal_rejection(d, research(home, crate::research::ROW_WAR_HALL, 0), 40);
    assert!(execute(d, build_toward(home, crate::research::BARRACKS, 1), 40));
    assert!(execute(d, research(home, crate::research::ROW_BARRACKS, crate::research::CHOICE_DRILL), 40));
    assert_terminal_rejection(d, build_toward(home, crate::research::WAR_HALL, 0), 40);
    assert!(execute(d, research(home, crate::research::ROW_BARRACKS, crate::research::CHOICE_RATIONS), 40));
    assert!(execute(d, build_toward(home, crate::research::WAR_HALL, 0), 40));
    assert_terminal_rejection(d, build_toward(home, crate::research::WAR_HALL, 2), 40);
    assert!(execute(d, research(home, crate::research::ROW_WAR_HALL, 0), 40));
    assert!(execute(d, build_toward(home, crate::research::HEARTH, 2), 40));
}

#[test]
fn a_tier_the_realm_cannot_pay_in_labor_is_refused_and_changes_nothing() {
    let (d, home, preset) = research_world();
    assert!(execute(d, build_toward(home, crate::research::FARM, 0), 40));
    for _ in 0..3_u8 {
        assert!(execute(d, research(home, crate::research::ROW_FARM, crate::research::CHOICE_MAKE), 40));
    }
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let labor = ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type: crate::resources::LABOR };
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
    let labor = ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type: crate::resources::LABOR };
    for (direction, multiple) in array![(0_u8, 1_u128), (1, 2), (2, 5), (3, 10)] {
        let before = resources.resource_balance(labor);
        assert!(execute(d, build_toward(home, crate::research::FARM, direction), 40));
        assert_eq!(before - resources.resource_balance(labor), 100 * multiple);
    }
}

#[test]
fn the_marked_plot_changes_nothing_and_board_buildings_never_pause() {
    let (d, home, _) = research_world();
    let wheat = 35_u8;
    let marked = crate::building_ring::marked_plot(1, 1);
    assert_eq!(marked, crate::geometry::neighbor(Coord { alt: false, x: 10, y: 10 }, 4));
    assert!(execute(d, build_toward(home, crate::research::FARM, 0), 40));
    let plain = rate(d, home, wheat);
    assert!(execute(d, build_toward(home, crate::research::FARM, 4), 40));
    assert_eq!(rate(d, home, wheat), 2 * plain);
    assert_terminal_rejection(d, Command::PauseBuildingProduction(change(home)), 40);
}
