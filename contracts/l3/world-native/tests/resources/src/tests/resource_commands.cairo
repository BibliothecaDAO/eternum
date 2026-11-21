pub use world_test_support::tests::resource_commands::*;
use super::play_fixture::FIXTURE_START;

#[test]
fn arrival_day_rollover_preserves_the_previous_tick_rule() {
    let yesterday = ArrivalKey { game_id: 1, entity_id: 1, day: 0, slot: 48 };
    let today = ArrivalKey { day: 1, slot: 1, ..yesterday };
    assert!(!has_arrived(yesterday, 180, 48 * 180 - 1));
    assert!(has_arrived(yesterday, 180, 48 * 180));
    assert!(!has_arrived(today, 180, 48 * 180));
    assert!(!has_arrived(today, 180, 49 * 180 - 1));
    assert!(has_arrived(today, 180, 49 * 180));
}

#[test]
fn fixture_grants_preserve_the_existing_production_clock() {
    let (deployment, source, _) = setup();
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    let slot = ResourceSlot {
        game_id: source.game_id, entity_id: source.entity_id, resource_type: crate::resources::LABOR,
    };
    start_cheat_caller_address(deployment.games, deployment.games);
    resources
        .settle_production(
            source,
            FIXTURE_START + 40,
            crate::commands::resource_context(
                ExecutionContext { timestamp: FIXTURE_START + 40, ..context(deployment.games, source.game_id) },
            ),
        );
    stop_cheat_caller_address(deployment.games);
    let production = resources.resource_production(slot);
    let settled_at: u64 = production.last_settled_at.into();
    assert_eq!(settled_at, FIXTURE_START + 40);
    let settled = resources.resource_balance(slot);
    grant(deployment, source, crate::resources::LABOR, 7);
    assert_eq!(resources.resource_balance(slot), settled + 7);
    assert_eq!(resources.resource_production(slot), production);
    grant(deployment, source, crate::resources::LABOR, 3);
    assert_eq!(resources.resource_balance(slot), settled + 10);
    assert_eq!(resources.resource_production(slot), production);
}
