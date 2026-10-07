use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use crate::buildings::CreateBuilding;
use crate::commands::Command;
use crate::resources::{
    IResourceOperationsDispatcher, IResourceOperationsDispatcherTrait, Production, ResourceKey, ResourceSlot,
    UNLIMITED_OUTPUT,
};
use crate::tests::state::ResourceObservationTrait;
use super::resource_commands::{execute, grant, set_fixture};

const LABOR: u8 = 23;
const BARRACKS: u8 = 28;
const KNIGHT: u8 = 26;
const WORN: u128 = UNLIMITED_OUTPUT - 1_000_000;

fn resources(deployment: super::Deployment) -> IResourceOperationsDispatcher {
    IResourceOperationsDispatcher { contract_address: deployment.games }
}

fn slot(home: ResourceKey, resource_type: u8) -> ResourceSlot {
    ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type }
}

fn context(deployment: super::Deployment, home: ResourceKey) -> crate::commands::ResourceContext {
    crate::commands::resource_context(super::context(deployment.games, home.game_id))
}

/// Spending nothing settles one resource, as any action that touches it does.
fn settle(deployment: super::Deployment, home: ResourceKey, resource_type: u8, timestamp: u64) -> Production {
    start_cheat_caller_address(deployment.games, deployment.games);
    resources(deployment).spend_resource(home, resource_type, 0, timestamp, context(deployment, home));
    stop_cheat_caller_address(deployment.games);
    resources(deployment).resource_production(slot(home, resource_type))
}

/// A realm's labor producer as provisioning starts it: no cap on what it may make.
fn start_unlimited_labor(deployment: super::Deployment, home: ResourceKey, timestamp: u64) {
    start_cheat_caller_address(deployment.games, deployment.games);
    resources(deployment).start_production(home, LABOR, 3, UNLIMITED_OUTPUT, timestamp, context(deployment, home));
    stop_cheat_caller_address(deployment.games);
}

fn blitz_rules() -> crate::rules::SliceRules {
    crate::rules::SliceRules {
        mode_rules: super::recorded::BLITZ_RULES,
        entry_rule: crate::rules::ENTRY_ROSTER,
        command_mask: super::recorded::BLITZ_COMMAND_MASK,
        ..super::recorded::rules(),
    }
}

fn labor_stays_unlimited_through_every_settlement(rules: crate::rules::SliceRules) {
    let (deployment, home, _) = super::resource_commands::setup_with_rules(rules);
    start_unlimited_labor(deployment, home, 40);
    let before = resources(deployment).resource_balance(slot(home, LABOR));
    for timestamp in array![50_u64, 60, 75, 100] {
        assert_eq!(settle(deployment, home, LABOR, timestamp).output_amount_left, UNLIMITED_OUTPUT);
    }
    assert_eq!(resources(deployment).resource_balance(slot(home, LABOR)), before + 3 * 60);
}

#[test]
fn blitz_labor_stays_unlimited_through_every_settlement() {
    labor_stays_unlimited_through_every_settlement(blitz_rules());
}

#[test]
fn eternum_labor_stays_unlimited_through_every_settlement() {
    labor_stays_unlimited_through_every_settlement(super::recorded::rules());
}

#[test]
fn frontier_board_buildings_stay_unlimited_through_every_settlement() {
    let (deployment, home) = super::building_commands::building_world_with_preset(
        super::building_commands::building_preset(Some(super::building_commands::board_rules())),
    );
    grant(deployment, home, LABOR, 1000);
    assert!(
        execute(
            deployment,
            Command::CreateBuilding(
                CreateBuilding {
                    structure_id: home.entity_id, directions: array![0_u8].span(), category: BARRACKS, use_simple: true,
                },
            ),
            40,
        ),
    );
    let rate: u128 = resources(deployment).resource_production(slot(home, KNIGHT)).production_rate.into();
    assert_eq!(resources(deployment).resource_production(slot(home, KNIGHT)).output_amount_left, UNLIMITED_OUTPUT);
    for timestamp in array![50_u64, 60, 75, 100] {
        assert_eq!(settle(deployment, home, KNIGHT, timestamp).output_amount_left, UNLIMITED_OUTPUT);
    }
    assert_eq!(resources(deployment).resource_balance(slot(home, KNIGHT)), 60 * rate);
}

#[test]
fn a_marker_already_worn_by_a_running_game_still_never_runs_out_or_wears_further() {
    let (deployment, home, _) = super::resource_commands::setup();
    start_unlimited_labor(deployment, home, 40);
    set_fixture(
        deployment.games,
        selector!("resources"),
        selector!("productions"),
        array![home.game_id.into(), home.entity_id.into(), LABOR.into()].span(),
        Production { building_count: 1, production_rate: 3, output_amount_left: WORN, last_settled_tick: 40 },
    );
    let before = resources(deployment).resource_balance(slot(home, LABOR));
    assert_eq!(settle(deployment, home, LABOR, 100).output_amount_left, WORN);
    assert_eq!(resources(deployment).resource_balance(slot(home, LABOR)), before + 3 * 60);
    // A limited building added beside it cannot overflow the marker or cap it.
    start_cheat_caller_address(deployment.games, deployment.games);
    resources(deployment).start_production(home, LABOR, 2, 2_000_000, 110, context(deployment, home));
    stop_cheat_caller_address(deployment.games);
    assert_eq!(resources(deployment).resource_production(slot(home, LABOR)).output_amount_left, WORN);
    assert_eq!(settle(deployment, home, LABOR, 120).output_amount_left, WORN);
}

#[test]
fn a_limited_producer_still_counts_down_to_nothing() {
    // The fixture realm's producer makes two of resource 1 a second from time 30, a hundred in all.
    let (deployment, home, _) = super::resource_commands::setup();
    assert_eq!(settle(deployment, home, 1, 40).output_amount_left, 100);
    assert_eq!(settle(deployment, home, 1, 59).output_amount_left, 100);
    assert_eq!(settle(deployment, home, 1, 60).output_amount_left, 0);
    assert_eq!(settle(deployment, home, 1, 200).output_amount_left, 0);
    assert_eq!(resources(deployment).resource_balance(slot(home, 1)), 200);
}
