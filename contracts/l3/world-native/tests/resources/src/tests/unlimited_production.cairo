pub use world_test_support::tests::unlimited_production::*;
use super::play_fixture::FIXTURE_START;
#[test]
fn eternum_labor_stays_unlimited_through_every_settlement() {
    labor_stays_unlimited_through_every_settlement();
}

#[test]
fn frontier_board_buildings_stay_unlimited_through_every_settlement() {
    let (deployment, home) = super::building_commands::building_world();
    let barracks = *crate::balance::structures::BUILDINGS.span().at(BARRACKS.into() - 1);
    for cost in crate::balance::structures::BUILDING_COSTS.span().slice(barracks.first_cost, barracks.simple_count) {
        grant(deployment, home, *cost.resource_type, *cost.amount);
    }
    assert!(
        execute(
            deployment,
            Command::CreateBuilding(
                CreateBuilding {
                    structure_id: home.entity_id, directions: array![0_u8].span(), category: BARRACKS, use_simple: true,
                },
            ),
            FIXTURE_START + 40,
        ),
    );
    let rate: u128 = resources(deployment).resource_production(slot(home, KNIGHT)).production_rate.into();
    assert_eq!(resources(deployment).resource_production(slot(home, KNIGHT)).output_amount_left, UNLIMITED_OUTPUT);
    let before = resources(deployment).resource_balance(slot(home, KNIGHT));
    for timestamp in array![FIXTURE_START + 50, FIXTURE_START + 60, FIXTURE_START + 75, FIXTURE_START + 100] {
        assert_eq!(settle(deployment, home, KNIGHT, timestamp).output_amount_left, UNLIMITED_OUTPUT);
    }
    assert_eq!(resources(deployment).resource_balance(slot(home, KNIGHT)), before + 60 * rate);
}

#[test]
fn a_marker_already_worn_by_a_running_game_still_never_runs_out_or_wears_further() {
    let (deployment, home, _) = super::resource_commands::setup();
    start_unlimited_labor(deployment, home, FIXTURE_START + 40);
    set_fixture(
        deployment.games,
        selector!("resources"),
        selector!("productions"),
        array![home.game_id.into(), home.entity_id.into(), LABOR.into()].span(),
        Production {
            remainder: 0,
            building_count: 1,
            production_rate: 3,
            output_amount_left: WORN,
            last_settled_at: (FIXTURE_START + 40).try_into().unwrap(),
        },
    );
    let before = resources(deployment).resource_balance(slot(home, LABOR));
    assert_eq!(settle(deployment, home, LABOR, FIXTURE_START + 100).output_amount_left, WORN);
    assert_eq!(resources(deployment).resource_balance(slot(home, LABOR)), before + 3 * 60);
    // A limited building added beside it cannot overflow the marker or cap it.
    start_cheat_caller_address(deployment.games, deployment.games);
    resources(deployment).start_production(home, LABOR, 2, 2_000_000, FIXTURE_START + 110, context(deployment, home));
    stop_cheat_caller_address(deployment.games);
    assert_eq!(resources(deployment).resource_production(slot(home, LABOR)).output_amount_left, WORN);
    assert_eq!(settle(deployment, home, LABOR, FIXTURE_START + 120).output_amount_left, WORN);
}

#[test]
fn a_limited_producer_still_counts_down_to_nothing() {
    let (deployment, home, _) = super::resource_commands::setup();
    start_cheat_caller_address(deployment.games, deployment.games);
    resources(deployment).start_production(home, KNIGHT, 2, 100, FIXTURE_START + 30, context(deployment, home));
    stop_cheat_caller_address(deployment.games);
    let before = resources(deployment).resource_balance(slot(home, KNIGHT));
    assert_eq!(settle(deployment, home, KNIGHT, FIXTURE_START + 40).output_amount_left, 80);
    assert_eq!(settle(deployment, home, KNIGHT, FIXTURE_START + 59).output_amount_left, 42);
    assert_eq!(settle(deployment, home, KNIGHT, FIXTURE_START + 60).output_amount_left, 40);
    assert_eq!(settle(deployment, home, KNIGHT, FIXTURE_START + 200).output_amount_left, 0);
    assert_eq!(resources(deployment).resource_balance(slot(home, KNIGHT)), before + 100);
}
