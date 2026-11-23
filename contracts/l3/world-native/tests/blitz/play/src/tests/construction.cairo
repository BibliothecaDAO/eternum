pub use world_test_support::tests::building_commands::*;
use crate::buildings::{BuildingRule, BuildingRuleKey, IBuildingRulesDispatcher, IBuildingRulesDispatcherTrait};
use super::fixture::{WOOD, blitz_realm};
use super::play_fixture::FIXTURE_START;
use super::resource_commands::{execute_in_game, grant};

const COAL_MINE: u8 = 4;
const LUMBER_MILL: u8 = 5;
const NOW: u64 = FIXTURE_START + 40;

fn rule(d: super::Deployment, home: ResourceKey, category: u8) -> BuildingRule {
    IBuildingRulesDispatcher { contract_address: d.games }
        .building_rule(BuildingRuleKey { game_id: home.game_id, category })
}

fn copy_cost(amount: u128, copies_before: u128) -> u128 {
    let increase: u128 = crate::balance::rules::BUILDING_CONFIG.base_cost_percent_increase.into();
    amount + copies_before * copies_before * amount * increase / 10000
}

fn fund(d: super::Deployment, home: ResourceKey, category: u8, copies_before: u128) {
    for cost in rule(d, home, category).simple_cost {
        grant(d, home, *cost.resource_type, copy_cost(*cost.amount, copies_before));
    }
}

fn assert_spent(d: super::Deployment, home: ResourceKey, category: u8) {
    for cost in rule(d, home, category).simple_cost {
        assert_eq!(balance(d, home, *cost.resource_type), 0);
    }
}

fn mill_world() -> (super::Deployment, ResourceKey) {
    let (d, home) = blitz_realm();
    fund(d, home, LUMBER_MILL, 0);
    assert!(execute_in_game(d, home.game_id, create(home, LUMBER_MILL), NOW));
    (d, home)
}

fn wood_rate() -> u64 {
    crate::logic::resources::rule(WOOD).realm_rate
}

#[test]
fn a_building_pays_its_cost_and_starts_its_resource_at_the_realm_rate() {
    let (d, home) = mill_world();
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    assert_spent(d, home, LUMBER_MILL);
    assert_eq!(rate(d, home, WOOD), wood_rate());
    assert_eq!(structures.building(east(home)).unwrap().category, LUMBER_MILL);
    assert_eq!(
        structures.structure_buildings(home).population.current, rule(d, home, LUMBER_MILL).population_cost.into(),
    );
}

#[test]
fn a_second_copy_costs_its_base_plus_the_ruled_increase_and_adds_its_rate() {
    let (d, home) = mill_world();
    fund(d, home, LUMBER_MILL, 1);
    assert!(execute_in_game(d, home.game_id, build_toward(home, LUMBER_MILL, 1), NOW));
    assert_spent(d, home, LUMBER_MILL);
    assert_eq!(rate(d, home, WOOD), 2 * wood_rate());
}

#[test]
fn a_realm_builds_only_for_a_resource_it_holds() {
    let (d, home) = blitz_realm();
    fund(d, home, COAL_MINE, 0);
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let before = structures.structure_buildings(home);
    assert!(!execute_in_game(d, home.game_id, create(home, COAL_MINE), NOW));
    assert!(structures.building(east(home)).is_none());
    assert_eq!(structures.structure_buildings(home), before);
    for cost in rule(d, home, COAL_MINE).simple_cost {
        assert_eq!(balance(d, home, *cost.resource_type), *cost.amount);
    }
}

#[test]
fn a_destroyed_building_stops_its_rate_and_frees_its_population_without_a_refund() {
    let (d, home) = mill_world();
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    assert!(execute_in_game(d, home.game_id, Command::DestroyBuilding(change(home)), NOW + 60));
    assert_eq!(rate(d, home, WOOD), 0);
    assert!(structures.building(east(home)).is_none());
    assert_eq!(structures.structure_buildings(home).population.current, 0);
    assert_spent(d, home, LUMBER_MILL);
}

#[test]
fn a_paused_building_stops_its_rate_until_it_resumes() {
    let (d, home) = mill_world();
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let pause = Command::PauseBuildingProduction(change(home));
    let resume = Command::ResumeBuildingProduction(change(home));
    assert!(!execute_in_game(d, home.game_id, resume, NOW + 10));
    assert!(execute_in_game(d, home.game_id, pause, NOW + 20));
    assert_eq!(rate(d, home, WOOD), 0);
    assert!(structures.building(east(home)).unwrap().paused);
    assert!(!execute_in_game(d, home.game_id, pause, NOW + 30));
    assert!(execute_in_game(d, home.game_id, resume, NOW + 40));
    assert_eq!(rate(d, home, WOOD), wood_rate());
    assert!(!structures.building(east(home)).unwrap().paused);
}

#[test]
fn a_paused_building_is_destroyed_without_stopping_its_rate_twice() {
    let (d, home) = mill_world();
    fund(d, home, LUMBER_MILL, 1);
    assert!(execute_in_game(d, home.game_id, build_toward(home, LUMBER_MILL, 1), NOW));
    assert!(execute_in_game(d, home.game_id, Command::PauseBuildingProduction(change(home)), NOW + 20));
    assert!(execute_in_game(d, home.game_id, Command::DestroyBuilding(change(home)), NOW + 30));
    assert_eq!(rate(d, home, WOOD), wood_rate());
}
