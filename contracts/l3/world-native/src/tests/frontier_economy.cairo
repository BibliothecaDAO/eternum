use eternum_randomness_protocol::entrypoint::IRecordedExecutionViewsDispatcher;
use snforge_std::{EventSpyTrait, EventsFilterTrait, start_cheat_caller_address, stop_cheat_caller_address};
use crate::buildings::{ChangeBuilding, CreateBuilding};
use crate::commands::{Command, CreateExplorer};
use crate::production::RefillProduction;
use crate::resources::{
    IResourceOperationsDispatcher, IResourceOperationsDispatcherTrait, IResourceOperationsSafeDispatcher,
    IResourceOperationsSafeDispatcherTrait, ResourceKey, ResourceRule, ResourceSlot, Weight,
};
use crate::rules::RESOURCE_PRECISION;
use crate::structures::IStructureOperationsDispatcher;
use crate::tests::state::{ResourceObservationTrait, StructureObservationTrait};
use crate::troop_management::{ManageTroops, RecruitExplorer};
use crate::troops::Coord;
use super::recorded_receipts::RecordedReceiptsTrait;
use super::resource_commands::{assert_terminal_rejection, execute, grant, set_fixture};

const KNIGHT: u8 = 26;
const WHEAT: u8 = 35;
const STOREHOUSE: u8 = 2;
const BARRACKS: u8 = 28;
const FARM: u8 = 37;
const EAST: u8 = 0;
const WEST: u8 = 3;

/// A board realm carrying Frontier's own recipes: two wheat for each troop.
fn frontier_preset() -> crate::presets::PresetDefinition {
    let mut preset = super::building_commands::building_preset(Some(super::building_commands::board_rules()));
    let (_, frontier) = super::preset_projection::current_definition("frontier");
    preset.resources.production = frontier.resources.production;
    preset
}

fn with_realm_rate(
    mut preset: crate::presets::PresetDefinition, resource_type: u8, realm_rate: u64,
) -> crate::presets::PresetDefinition {
    let mut rules = array![];
    for rule in preset.resources.resources {
        rules.append(if *rule.resource_type == resource_type {
            ResourceRule { realm_rate, ..*rule }
        } else {
            *rule
        });
    }
    preset.resources.resources = rules.span();
    preset
}

fn frontier_realm(preset: crate::presets::PresetDefinition) -> (super::Deployment, ResourceKey) {
    let (deployment, home) = super::building_commands::building_world_with_preset(preset);
    grant(deployment, home, crate::resources::LABOR, 1000);
    (deployment, home)
}

fn build(home: ResourceKey, category: u8, direction: u8) -> Command {
    Command::CreateBuilding(
        CreateBuilding {
            structure_id: home.entity_id, directions: array![direction].span(), category, use_simple: true,
        },
    )
}

fn demolish(home: ResourceKey, direction: u8) -> Command {
    Command::DestroyBuilding(
        ChangeBuilding {
            structure_id: home.entity_id,
            coord: crate::geometry::neighbor(Coord { alt: false, x: 10, y: 10 }, direction),
        },
    )
}

fn raise(home: ResourceKey, troops: u128, direction: u8) -> Command {
    Command::CreateExplorer(
        CreateExplorer {
            structure_id: home.entity_id, category: 0, tier: 0, amount: troops * RESOURCE_PRECISION, direction,
        },
    )
}

fn reinforce(explorer_id: u32, troops: u128) -> Command {
    Command::ManageTroops(
        ManageTroops::RecruitExplorer(RecruitExplorer { explorer_id, amount: troops * RESOURCE_PRECISION }),
    )
}

fn resources(deployment: super::Deployment) -> IResourceOperationsDispatcher {
    IResourceOperationsDispatcher { contract_address: deployment.games }
}

fn slot(home: ResourceKey, resource_type: u8) -> ResourceSlot {
    ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type }
}

fn stored(deployment: super::Deployment, home: ResourceKey, resource_type: u8) -> u128 {
    resources(deployment).resource_balance(slot(home, resource_type))
}

fn rate(deployment: super::Deployment, home: ResourceKey, resource_type: u8) -> u128 {
    resources(deployment).resource_production(slot(home, resource_type)).production_rate.into()
}

/// Spending nothing is the smallest action that touches one resource.
fn settle(deployment: super::Deployment, home: ResourceKey, resource_type: u8, timestamp: u64) {
    start_cheat_caller_address(deployment.games, deployment.games);
    resources(deployment)
        .spend_resource(
            home,
            resource_type,
            0,
            timestamp,
            crate::commands::resource_context(super::context(deployment.games, home.game_id)),
        );
    stop_cheat_caller_address(deployment.games);
}

fn spend(deployment: super::Deployment, home: ResourceKey, resource_type: u8, amount: u128, timestamp: u64) {
    start_cheat_caller_address(deployment.games, deployment.games);
    resources(deployment)
        .spend_resource(
            home,
            resource_type,
            amount,
            timestamp,
            crate::commands::resource_context(super::context(deployment.games, home.game_id)),
        );
    stop_cheat_caller_address(deployment.games);
}

/// Leaves exactly `room` free under the realm's storage limit.
fn leave_room(deployment: super::Deployment, home: ResourceKey, room: u128) {
    let weight = resources(deployment).resource_weight(home).weight;
    set_fixture(
        deployment.games,
        selector!("resources"),
        selector!("weights"),
        array![home.game_id.into(), home.entity_id.into()].span(),
        Weight { capacity: weight + room, weight },
    );
}

fn allow_armies(deployment: super::Deployment, home: ResourceKey) {
    let original = IStructureOperationsDispatcher { contract_address: deployment.games }.structure(home).unwrap();
    set_fixture(
        deployment.games,
        selector!("structures"),
        selector!("structures"),
        array![home.game_id.into(), home.entity_id.into()].span(),
        crate::structures::StructureRecord {
            owner: original.owner,
            base: crate::structures::StructureBase { troop_max_explorer_count: 4, ..original.base },
            resources_packed: original.resources_packed,
            metadata: original.metadata,
        },
    );
}

fn last_rejection(deployment: super::Deployment) -> ByteArray {
    IRecordedExecutionViewsDispatcher { contract_address: deployment.games }
        .recorded_outcome(3, super::recorded::head(deployment.games, 3).order)
        .unwrap()
        .reason
}

#[test]
fn a_farm_produces_wheat_from_nothing_and_barracks_take_none_of_it() {
    let (deployment, home) = frontier_realm(frontier_preset());
    assert!(execute(deployment, build(home, FARM, WEST), 40));
    assert!(execute(deployment, build(home, BARRACKS, EAST), 40));
    settle(deployment, home, WHEAT, 90);
    assert_eq!(stored(deployment, home, WHEAT), 50 * rate(deployment, home, WHEAT));
    assert_eq!(rate(deployment, home, WHEAT), 2);
}

#[test]
fn troops_train_with_no_wheat_and_settle_without_touching_it() {
    let (deployment, home) = frontier_realm(frontier_preset());
    assert!(execute(deployment, build(home, BARRACKS, EAST), 40));
    assert_eq!(stored(deployment, home, WHEAT), 0);
    let mut spy = snforge_std::spy_events();
    settle(deployment, home, KNIGHT, 90);
    assert_eq!(stored(deployment, home, KNIGHT), 100);
    // One touch writes the troop's balance, its production and the realm's weight, and nothing of the family.
    assert_eq!(spy.get_events().emitted_by(deployment.games).events.len(), 3);

    assert!(execute(deployment, build(home, FARM, WEST), 100));
    settle(deployment, home, KNIGHT, 150);
    assert_eq!(stored(deployment, home, KNIGHT), 220);
    assert_eq!(stored(deployment, home, WHEAT), 0);
    settle(deployment, home, WHEAT, 150);
    assert_eq!(stored(deployment, home, WHEAT), 100);
    assert_eq!(stored(deployment, home, KNIGHT), 220);
}

#[test]
fn raising_troops_pays_two_wheat_each_from_settled_wheat_and_fails_when_the_realm_is_short() {
    // The farm yields a quarter wheat a second, so every wheat spent here was produced, never granted.
    let (deployment, home) = frontier_realm(
        with_realm_rate(frontier_preset(), WHEAT, RESOURCE_PRECISION.try_into().unwrap() / 4),
    );
    allow_armies(deployment, home);
    grant(deployment, home, KNIGHT, 20 * RESOURCE_PRECISION);
    assert!(execute(deployment, build(home, FARM, WEST), 40));

    // Forty seconds of farming is ten wheat: three troops cost six of it.
    assert!(execute(deployment, raise(home, 3, 0), 80));
    assert_eq!(stored(deployment, home, KNIGHT), 17 * RESOURCE_PRECISION);
    assert_eq!(stored(deployment, home, WHEAT), 4 * RESOURCE_PRECISION);
    let army = *IStructureOperationsDispatcher { contract_address: deployment.games }.home_armies(home).at(0);
    assert!(execute(deployment, reinforce(army, 1), 80));
    assert_eq!(stored(deployment, home, KNIGHT), 16 * RESOURCE_PRECISION);
    assert_eq!(stored(deployment, home, WHEAT), 2 * RESOURCE_PRECISION);

    let before = super::resource_commands::resource_facts(deployment, home);
    assert_terminal_rejection(deployment, raise(home, 2, 1), 80);
    assert_eq!(last_rejection(deployment), "realm cannot pay to raise troops");
    assert_terminal_rejection(deployment, reinforce(army, 2), 80);
    assert_eq!(last_rejection(deployment), "realm cannot pay to raise troops");
    assert_eq!(super::resource_commands::resource_facts(deployment, home), before);
    assert_eq!(IStructureOperationsDispatcher { contract_address: deployment.games }.home_armies(home).len(), 1);

    // Eight more seconds of farming make up the two wheat the realm lacked.
    assert!(execute(deployment, raise(home, 2, 1), 88));
    assert_eq!(stored(deployment, home, KNIGHT), 14 * RESOURCE_PRECISION);
    assert_eq!(stored(deployment, home, WHEAT), 0);
}

fn learn_barracks(deployment: super::Deployment, home: ResourceKey, sides: Span<u8>) {
    let mut learned = 0;
    for side in sides {
        learned = crate::research::learn(learned, crate::research::ROW_BARRACKS, *side);
    }
    snforge_std::interact_with_state(
        deployment.games, || crate::logic::research::write(home, crate::research::RealmKnowledge { learned }),
    );
}

#[test]
fn each_rations_pick_takes_a_quarter_wheat_off_every_troop_deployed() {
    let (deployment, home) = frontier_realm(frontier_preset());
    allow_armies(deployment, home);
    grant(deployment, home, KNIGHT, 20 * RESOURCE_PRECISION);
    grant(deployment, home, WHEAT, 20 * RESOURCE_PRECISION);
    // Drill then Rations: 1.75 wheat a troop.
    learn_barracks(deployment, home, array![crate::research::CHOICE_DRILL, crate::research::CHOICE_RATIONS].span());
    assert!(execute(deployment, raise(home, 4, 0), 40));
    assert_eq!(stored(deployment, home, WHEAT), 13 * RESOURCE_PRECISION);
    // Rations twice: 1.5 wheat a troop.
    learn_barracks(deployment, home, array![crate::research::CHOICE_RATIONS, crate::research::CHOICE_RATIONS].span());
    assert!(execute(deployment, raise(home, 4, 1), 40));
    assert_eq!(stored(deployment, home, WHEAT), 7 * RESOURCE_PRECISION);
}

#[test]
#[feature("safe_dispatcher")]
fn settling_keeps_only_what_fits_the_storage_limit_and_later_spending_sees_that_amount() {
    let (deployment, home) = frontier_realm(frontier_preset());
    assert!(execute(deployment, build(home, BARRACKS, EAST), 40));
    leave_room(deployment, home, 30);
    // Sixty seconds train 120 troops; the realm has room for 30 and the rest is gone.
    settle(deployment, home, KNIGHT, 100);
    assert_eq!(stored(deployment, home, KNIGHT), 30);
    let weight = resources(deployment).resource_weight(home);
    assert_eq!(weight.weight, weight.capacity);

    start_cheat_caller_address(deployment.games, deployment.games);
    let refused = IResourceOperationsSafeDispatcher { contract_address: deployment.games }
        .spend_resource(
            home, KNIGHT, 31, 100, crate::commands::resource_context(super::context(deployment.games, home.game_id)),
        );
    stop_cheat_caller_address(deployment.games);
    assert!(refused.is_err());
    spend(deployment, home, KNIGHT, 30, 100);
    assert_eq!(stored(deployment, home, KNIGHT), 0);
    settle(deployment, home, KNIGHT, 105);
    assert_eq!(stored(deployment, home, KNIGHT), 10);
}

#[test]
fn a_storehouse_raises_the_limit_only_after_production_settles_against_the_old_one() {
    let mut preset = frontier_preset();
    preset.rules.capacity_config.storehouse_boost_capacity = 1;
    let (deployment, home) = frontier_realm(preset);
    assert!(execute(deployment, build(home, FARM, WEST), 40));
    // The fixture's own producer runs dry before the limit is pinned, so only wheat is pending afterwards.
    settle(deployment, home, 1, 90);
    settle(deployment, home, WHEAT, 90);
    assert_eq!(stored(deployment, home, WHEAT), 100);
    leave_room(deployment, home, 20);

    // Thirty seconds made 60 wheat under a limit with room for 20: the storehouse cannot rescue the other 40.
    assert!(execute(deployment, build(home, STOREHOUSE, EAST), 120));
    settle(deployment, home, WHEAT, 120);
    assert_eq!(stored(deployment, home, WHEAT), 120);
    settle(deployment, home, WHEAT, 130);
    assert_eq!(stored(deployment, home, WHEAT), 140);
}

#[test]
fn a_lost_storehouse_lowers_the_limit_only_after_production_settles_against_the_old_one() {
    let mut preset = frontier_preset();
    preset.rules.capacity_config.storehouse_boost_capacity = 1;
    let (deployment, home) = frontier_realm(preset);
    assert!(execute(deployment, build(home, FARM, WEST), 40));
    assert!(execute(deployment, build(home, STOREHOUSE, EAST), 40));
    settle(deployment, home, 1, 90);
    settle(deployment, home, WHEAT, 90);
    // Without the storehouse the realm would have room for ten more.
    let weight = resources(deployment).resource_weight(home).weight;
    set_fixture(
        deployment.games,
        selector!("resources"),
        selector!("weights"),
        array![home.game_id.into(), home.entity_id.into()].span(),
        Weight { capacity: weight + 10 + RESOURCE_PRECISION, weight },
    );

    // Thirty seconds made 60 wheat the storehouse still holds, so the realm cannot give the storehouse up.
    assert_terminal_rejection(deployment, demolish(home, EAST), 120);
    assert_eq!(last_rejection(deployment), "structure exceeds reduced capacity");
    spend(deployment, home, WHEAT, 160, 120);
    assert!(execute(deployment, demolish(home, EAST), 120));
    assert_eq!(stored(deployment, home, WHEAT), 0);
}

#[test]
fn a_changed_rate_applies_only_after_production_settles_at_the_old_one() {
    let (deployment, home) = frontier_realm(frontier_preset());
    assert!(execute(deployment, build(home, BARRACKS, EAST), 40));
    let one = rate(deployment, home, KNIGHT);
    assert!(execute(deployment, build(home, BARRACKS, WEST), 100));
    let two = rate(deployment, home, KNIGHT);
    assert!(two > one);
    settle(deployment, home, KNIGHT, 110);
    assert_eq!(stored(deployment, home, KNIGHT), 60 * one + 10 * two);

    assert!(execute(deployment, demolish(home, WEST), 150));
    assert_eq!(rate(deployment, home, KNIGHT), one);
    settle(deployment, home, KNIGHT, 160);
    assert_eq!(stored(deployment, home, KNIGHT), 60 * one + 50 * two + 10 * one);
}

#[test]
fn outside_a_board_troops_are_still_produced_only_from_the_wheat_their_recipe_burns() {
    let (_, blitz) = super::preset_projection::current_definition("blitz");
    let mut preset = super::resource_commands::fixture_preset(
        crate::rules::SliceRules {
            mode_rules: super::recorded::BLITZ_RULES,
            entry_rule: crate::rules::ENTRY_ROSTER,
            command_mask: super::recorded::BLITZ_COMMAND_MASK,
            ..super::recorded::rules(),
        },
    );
    preset.structures.buildings = super::building_commands::rules();
    preset.resources.production = blitz.resources.production;
    let (deployment, home, _) = super::resource_commands::setup_with_preset(preset);
    let mut knight = None;
    for config in blitz.resources.production {
        if *config.resource_type == KNIGHT {
            knight = Some(*config.recipe);
        }
    }
    let knight = knight.unwrap();
    let mut wheat_per_cycle = 0;
    for input in knight.complex_inputs {
        grant(deployment, home, *input.resource_type, *input.amount);
        if *input.resource_type == WHEAT {
            wheat_per_cycle = *input.amount;
        }
    }
    assert!(wheat_per_cycle != 0);

    // A barracks with wheat in store trains nothing until the recipe is paid.
    assert!(execute(deployment, build(home, BARRACKS, EAST), 40));
    settle(deployment, home, KNIGHT, 100);
    assert_eq!(stored(deployment, home, KNIGHT), 0);
    assert_eq!(stored(deployment, home, WHEAT), wheat_per_cycle);

    let refill = RefillProduction {
        structure_id: home.entity_id, resource_types: array![KNIGHT].span(), amounts: array![1].span(),
    };
    assert!(execute(deployment, Command::BurnResourceForResourceProduction(refill), 100));
    assert_eq!(stored(deployment, home, WHEAT), 0);
    settle(deployment, home, KNIGHT, 110);
    assert_eq!(stored(deployment, home, KNIGHT), 10 * rate(deployment, home, KNIGHT));
    assert_terminal_rejection(deployment, Command::BurnResourceForResourceProduction(refill), 110);
}

#[test]
fn outside_a_board_raising_troops_pays_no_recipe() {
    let (deployment, home, _) = super::resource_commands::setup();
    allow_armies(deployment, home);
    grant(deployment, home, KNIGHT, 5 * RESOURCE_PRECISION);
    grant(deployment, home, 2, 100);
    // This realm's knights do have a recipe: it prices refills, not armies.
    let recipe = *super::production::recipes().at(KNIGHT.into() - 1).recipe;
    assert_eq!(*recipe.simple_inputs.at(0).resource_type, 2);
    assert!(execute(deployment, raise(home, 5, 0), 80));
    assert_eq!(stored(deployment, home, KNIGHT), 0);
    assert_eq!(stored(deployment, home, 2), 100);
}
