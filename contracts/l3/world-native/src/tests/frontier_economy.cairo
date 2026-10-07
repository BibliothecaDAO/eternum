use eternum_randomness_protocol::entrypoint::IRecordedExecutionViewsDispatcher;
use snforge_std::{EventSpyTrait, EventsFilterTrait, start_cheat_caller_address, stop_cheat_caller_address};
use crate::buildings::{ChangeBuilding, CreateBuilding};
use crate::commands::{Command, CreateExplorer};
use crate::production::RefillProduction;
use crate::resources::{
    IResourceOperationsDispatcher, IResourceOperationsDispatcherTrait, IResourceOperationsSafeDispatcher,
    IResourceOperationsSafeDispatcherTrait, ResourceAmount, ResourceKey, ResourceRule, ResourceSlot,
};
use crate::rules::RESOURCE_PRECISION;
use crate::structures::IStructureOperationsDispatcher;
use crate::tests::state::{ResourceObservationTrait, StructureObservationTrait};
use crate::troop_management::{ManageTroops, RecruitExplorer};
use crate::troops::Coord;
use crate::upgrades::{UpgradeLimits, UpgradeRecipe};
use super::recorded_receipts::RecordedReceiptsTrait;
use super::resource_commands::{assert_terminal_rejection, execute, grant, set_fixture};

const KNIGHT: u8 = 26;
const WHEAT: u8 = 35;
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

/// The castle's limit on each of wheat, labor and troops: two full deploys of its level's cap.
fn castle_limit(level: u8) -> u128 {
    let cap = crate::troops::deployment_cap(super::recorded::rules().troop_limit_config, level);
    2 * Into::<u32, u128>::into(cap) * RESOURCE_PRECISION
}

/// Stores exactly `amount`, under the limit, to leave a store a known room.
fn store_exactly(deployment: super::Deployment, home: ResourceKey, resource_type: u8, amount: u128) {
    set_fixture(
        deployment.games,
        selector!("resources"),
        selector!("balances"),
        array![home.game_id.into(), home.entity_id.into(), resource_type.into()].span(),
        amount,
    );
}

fn level_up_once(mut preset: crate::presets::PresetDefinition) -> crate::presets::PresetDefinition {
    preset.structures.upgrade_limits = UpgradeLimits { realm_max: 1, village_max: 1 };
    preset
        .structures
        .upgrades =
            array![UpgradeRecipe { costs: array![ResourceAmount { resource_type: crate::resources::LABOR, amount: 17 }].span() }]
        .span();
    preset
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
    // The fixture's armies tick is a minute: by 90 the tick from 0 to 60 has ended, and the farm is paid all of it.
    settle(deployment, home, WHEAT, 90);
    assert_eq!(stored(deployment, home, WHEAT), 60 * rate(deployment, home, WHEAT));
    assert_eq!(rate(deployment, home, WHEAT), 2);
}

#[test]
fn troops_train_with_no_wheat_and_settle_without_touching_it() {
    let (deployment, home) = frontier_realm(frontier_preset());
    assert!(execute(deployment, build(home, BARRACKS, EAST), 40));
    assert_eq!(stored(deployment, home, WHEAT), 0);
    let mut spy = snforge_std::spy_events();
    settle(deployment, home, KNIGHT, 90);
    assert_eq!(stored(deployment, home, KNIGHT), 120);
    // One touch writes the troop's balance and its production, and nothing of the family: a board realm has no weight.
    assert_eq!(spy.get_events().emitted_by(deployment.games).events.len(), 2);

    assert!(execute(deployment, build(home, FARM, WEST), 100));
    settle(deployment, home, KNIGHT, 150);
    assert_eq!(stored(deployment, home, KNIGHT), 240);
    assert_eq!(stored(deployment, home, WHEAT), 0);
    settle(deployment, home, WHEAT, 150);
    assert_eq!(stored(deployment, home, WHEAT), 120);
    assert_eq!(stored(deployment, home, KNIGHT), 240);
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

    // One minute tick of farming is fifteen wheat: three troops cost six of it.
    assert!(execute(deployment, raise(home, 3, 0), 80));
    assert_eq!(stored(deployment, home, KNIGHT), 17 * RESOURCE_PRECISION);
    assert_eq!(stored(deployment, home, WHEAT), 9 * RESOURCE_PRECISION);
    let army = *IStructureOperationsDispatcher { contract_address: deployment.games }.home_armies(home).at(0);
    assert!(execute(deployment, reinforce(army, 1), 80));
    assert_eq!(stored(deployment, home, KNIGHT), 16 * RESOURCE_PRECISION);
    assert_eq!(stored(deployment, home, WHEAT), 7 * RESOURCE_PRECISION);

    let before = super::resource_commands::resource_facts(deployment, home);
    assert_terminal_rejection(deployment, raise(home, 4, 1), 80);
    assert_eq!(last_rejection(deployment), "realm cannot pay to raise troops");
    assert_terminal_rejection(deployment, reinforce(army, 4), 80);
    assert_eq!(last_rejection(deployment), "realm cannot pay to raise troops");
    assert_eq!(super::resource_commands::resource_facts(deployment, home), before);
    assert_eq!(IStructureOperationsDispatcher { contract_address: deployment.games }.home_armies(home).len(), 1);

    // The next tick's fifteen wheat make up what the realm lacked.
    assert!(execute(deployment, raise(home, 4, 1), 120));
    assert_eq!(stored(deployment, home, KNIGHT), 12 * RESOURCE_PRECISION);
    assert_eq!(stored(deployment, home, WHEAT), 14 * RESOURCE_PRECISION);
}

#[test]
fn stores_step_on_the_armies_tick_and_never_between() {
    let (deployment, home) = frontier_realm(frontier_preset());
    assert!(execute(deployment, build(home, BARRACKS, EAST), 40));
    // Production pulses on the stamina clock: the armies tick, counted from absolute time.
    assert_eq!(super::recorded::rules().tick_config.armies_tick_in_seconds, 60);
    settle(deployment, home, KNIGHT, 59);
    assert_eq!(stored(deployment, home, KNIGHT), 0);
    settle(deployment, home, KNIGHT, 60);
    assert_eq!(stored(deployment, home, KNIGHT), 120);
    settle(deployment, home, KNIGHT, 119);
    assert_eq!(stored(deployment, home, KNIGHT), 120);
    settle(deployment, home, KNIGHT, 120);
    assert_eq!(stored(deployment, home, KNIGHT), 240);
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
fn wheat_labor_and_troops_each_fill_to_their_own_limit_and_essence_has_none() {
    let (deployment, home) = frontier_realm(frontier_preset());
    let limit = castle_limit(0);
    assert_eq!(resources(deployment).resource_weight(home).capacity, core::num::traits::Bounded::<u128>::MAX);
    grant(deployment, home, WHEAT, 2 * limit);
    assert_eq!(stored(deployment, home, WHEAT), limit);
    // A full granary leaves every other store its whole room.
    grant(deployment, home, crate::resources::LABOR, 2 * limit);
    assert_eq!(stored(deployment, home, crate::resources::LABOR), limit);
    grant(deployment, home, KNIGHT, 2 * limit);
    assert_eq!(stored(deployment, home, KNIGHT), limit);
    grant(deployment, home, crate::resources::ESSENCE, 2 * limit);
    assert_eq!(stored(deployment, home, crate::resources::ESSENCE), 2 * limit);
}

#[test]
fn a_payout_pays_what_fits_and_never_blocks() {
    let (deployment, home) = frontier_realm(frontier_preset());
    assert!(execute(deployment, build(home, FARM, WEST), 40));
    let limit = castle_limit(0);
    store_exactly(deployment, home, crate::resources::LABOR, limit - 10);
    // Half the farm's hundred labor comes back, and only ten of it fits.
    assert!(execute(deployment, demolish(home, WEST), 50));
    assert_eq!(stored(deployment, home, crate::resources::LABOR), limit);

    start_cheat_caller_address(deployment.games, deployment.games);
    let granted = resources(deployment)
        .grant_resource(
            home,
            crate::resources::LABOR,
            50,
            50,
            crate::commands::resource_context(super::context(deployment.games, home.game_id)),
        );
    stop_cheat_caller_address(deployment.games);
    assert_eq!(granted, 0);
}

#[test]
#[feature("safe_dispatcher")]
fn production_past_a_limit_is_gone_and_later_spending_sees_what_was_kept() {
    let (deployment, home) = frontier_realm(frontier_preset());
    assert!(execute(deployment, build(home, BARRACKS, EAST), 40));
    let limit = castle_limit(0);
    store_exactly(deployment, home, KNIGHT, limit - 30);
    // A minute tick trains 120 troops; the store has room for 30 and the rest is gone.
    settle(deployment, home, KNIGHT, 100);
    assert_eq!(stored(deployment, home, KNIGHT), limit);

    start_cheat_caller_address(deployment.games, deployment.games);
    let refused = IResourceOperationsSafeDispatcher { contract_address: deployment.games }
        .spend_resource(
            home,
            KNIGHT,
            limit + 1,
            100,
            crate::commands::resource_context(super::context(deployment.games, home.game_id)),
        );
    stop_cheat_caller_address(deployment.games);
    assert!(refused.is_err());
    spend(deployment, home, KNIGHT, 200, 100);
    // The next tick's 120 all fit.
    settle(deployment, home, KNIGHT, 125);
    assert_eq!(stored(deployment, home, KNIGHT), limit - 80);
}

#[test]
fn a_level_up_settles_production_under_the_old_limits_before_raising_them() {
    let (deployment, home) = frontier_realm(level_up_once(frontier_preset()));
    assert!(execute(deployment, build(home, BARRACKS, EAST), 40));
    store_exactly(deployment, home, KNIGHT, castle_limit(0) - 30);
    // The ended tick trained 120 troops against room for 30: the castle's rise cannot rescue the other 90.
    assert!(execute(deployment, Command::LevelUp(home.entity_id), 100));
    settle(deployment, home, KNIGHT, 100);
    assert_eq!(stored(deployment, home, KNIGHT), castle_limit(0));
    settle(deployment, home, KNIGHT, 130);
    assert_eq!(stored(deployment, home, KNIGHT), castle_limit(0) + 120);
    assert!(castle_limit(1) > castle_limit(0) + 120);
}

#[test]
fn a_changed_rate_applies_only_after_production_settles_at_the_old_one() {
    let (deployment, home) = frontier_realm(frontier_preset());
    assert!(execute(deployment, build(home, BARRACKS, EAST), 40));
    let one = rate(deployment, home, KNIGHT);
    assert!(execute(deployment, build(home, BARRACKS, WEST), 100));
    let two = rate(deployment, home, KNIGHT);
    assert!(two > one);
    // Each ended tick pays the rate standing when it settles.
    settle(deployment, home, KNIGHT, 130);
    assert_eq!(stored(deployment, home, KNIGHT), 60 * one + 60 * two);

    assert!(execute(deployment, demolish(home, WEST), 150));
    assert_eq!(rate(deployment, home, KNIGHT), one);
    settle(deployment, home, KNIGHT, 190);
    assert_eq!(stored(deployment, home, KNIGHT), 60 * one + 60 * two + 60 * one);
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
    settle(deployment, home, KNIGHT, 160);
    assert_eq!(stored(deployment, home, KNIGHT), 60 * rate(deployment, home, KNIGHT));
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
