pub use world_test_support::tests::unlimited_production::*;


#[test]
fn blitz_labor_stays_unlimited_through_every_settlement() {
    labor_stays_unlimited_through_every_settlement(blitz_rules());
}

#[test]
fn eternum_labor_stays_unlimited_through_every_settlement() {
    labor_stays_unlimited_through_every_settlement(super::play_fixture::rules());
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
                    scouting_kind: 0,
                    structure_id: home.entity_id,
                    directions: array![0_u8].span(),
                    category: BARRACKS,
                    use_simple: true,
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
        Production { building_count: 1, production_rate: 3, output_amount_left: WORN, last_settled_at: 40 },
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
    assert_eq!(settle(deployment, home, 1, 40).output_amount_left, 80);
    assert_eq!(settle(deployment, home, 1, 59).output_amount_left, 42);
    assert_eq!(settle(deployment, home, 1, 60).output_amount_left, 40);
    assert_eq!(settle(deployment, home, 1, 200).output_amount_left, 0);
    assert_eq!(resources(deployment).resource_balance(slot(home, 1)), 200);
}
