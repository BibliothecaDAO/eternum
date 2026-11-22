use world_test_support::tests::TroopObservationTrait;
pub use world_test_support::tests::frontier_economy::*;
use super::play_fixture::FIXTURE_START;


fn labor_store(level: u8) -> u128 {
    Into::<u32, u128>::into(*crate::balance::structures::LABOR_STORES.span().at(level.into())) * RESOURCE_PRECISION
}

#[test]
fn a_farm_produces_wheat_from_nothing_and_barracks_take_none_of_it() {
    let (deployment, home) = frontier_realm();
    store_exactly(deployment, home, WHEAT, 0);
    assert!(execute(deployment, build(home, FARM, WEST), FIXTURE_START + 40));
    assert!(execute(deployment, build(home, BARRACKS, EAST), FIXTURE_START + 40));
    settle(deployment, home, WHEAT, FIXTURE_START + 90);
    assert_eq!(stored(deployment, home, WHEAT), 50 * rate(deployment, home, WHEAT));
    assert_eq!(rate(deployment, home, WHEAT), crate::logic::resources::rule(WHEAT).realm_rate.into());
}

#[test]
fn troops_train_with_no_wheat_and_settle_without_touching_it() {
    let (deployment, home) = frontier_realm();
    store_exactly(deployment, home, WHEAT, 0);
    store_exactly(deployment, home, KNIGHT, 0);
    assert!(execute(deployment, build(home, BARRACKS, EAST), FIXTURE_START + 40));
    let knights = rate(deployment, home, KNIGHT);
    assert_eq!(stored(deployment, home, WHEAT), 0);
    let mut spy = snforge_std::spy_events();
    settle(deployment, home, KNIGHT, FIXTURE_START + 90);
    assert_eq!(stored(deployment, home, KNIGHT), 50 * knights);
    // One touch writes the troop's balance and its production, and nothing of the family: a board realm has no weight.
    assert_eq!(spy.get_events().emitted_by(deployment.games).events.len(), 2);

    assert!(execute(deployment, build(home, FARM, WEST), FIXTURE_START + 100));
    let wheat = rate(deployment, home, WHEAT);
    settle(deployment, home, KNIGHT, FIXTURE_START + 150);
    assert_eq!(stored(deployment, home, KNIGHT), 110 * knights);
    assert_eq!(stored(deployment, home, WHEAT), 0);
    settle(deployment, home, WHEAT, FIXTURE_START + 150);
    assert_eq!(stored(deployment, home, WHEAT), 50 * wheat);
    assert_eq!(stored(deployment, home, KNIGHT), 110 * knights);
}

#[test]
fn raising_troops_pays_two_wheat_each_from_settled_wheat_and_fails_when_the_realm_is_short() {
    let (deployment, home) = frontier_realm();
    allow_armies(deployment, home);
    let starting = IStructureOperationsDispatcher { contract_address: deployment.games }.home_armies(home).len();
    store_exactly(deployment, home, KNIGHT, 20 * RESOURCE_PRECISION);
    store_exactly(deployment, home, WHEAT, 0);
    assert!(execute(deployment, build(home, FARM, WEST), FIXTURE_START + 40));
    assert!(execute(deployment, build(home, FARM, 1), FIXTURE_START + 40));
    let wheat = rate(deployment, home, WHEAT);
    assert!(50 * wheat >= 8 * RESOURCE_PRECISION && 50 * wheat < 16 * RESOURCE_PRECISION);

    assert!(execute(deployment, raise(home, 3, 2, 2), FIXTURE_START + 90));
    assert_eq!(stored(deployment, home, KNIGHT), 17 * RESOURCE_PRECISION);
    assert_eq!(stored(deployment, home, WHEAT), 50 * wheat - 6 * RESOURCE_PRECISION);
    let army = newest_army(deployment, home);
    assert!(execute(deployment, reinforce(army, 1), FIXTURE_START + 90));
    assert_eq!(stored(deployment, home, KNIGHT), 16 * RESOURCE_PRECISION);
    assert_eq!(stored(deployment, home, WHEAT), 50 * wheat - 8 * RESOURCE_PRECISION);

    let before = super::resource_commands::resource_facts(deployment, home);
    let mut rejected = snforge_std::spy_events();
    assert_terminal_rejection(deployment, raise(home, 4, 3, 3), FIXTURE_START + 90);
    assert_eq!(
        super::play_fixture::rejection(ref rejected, deployment.games).reason, "realm cannot pay to raise troops",
    );
    let mut rejected = snforge_std::spy_events();
    assert_terminal_rejection(deployment, reinforce(army, 4), FIXTURE_START + 90);
    assert_eq!(
        super::play_fixture::rejection(ref rejected, deployment.games).reason, "realm cannot pay to raise troops",
    );
    assert_eq!(super::resource_commands::resource_facts(deployment, home), before);
    assert_eq!(
        IStructureOperationsDispatcher { contract_address: deployment.games }.home_armies(home).len(), starting + 1,
    );

    assert!(execute(deployment, raise(home, 4, 3, 3), FIXTURE_START + 140));
    assert_eq!(stored(deployment, home, KNIGHT), 12 * RESOURCE_PRECISION);
    assert_eq!(stored(deployment, home, WHEAT), 100 * wheat - 16 * RESOURCE_PRECISION);
}

#[test]
fn stores_pay_every_second_independently_of_the_armies_tick() {
    let (deployment, home) = frontier_realm();
    let built = FIXTURE_START + 40;
    assert!(execute(deployment, build(home, BARRACKS, EAST), built));
    let knights = rate(deployment, home, KNIGHT);
    let tick = crate::balance::rules::TICK_CONFIG.armies_tick_in_seconds;
    for settled_at in array![2 * tick - 1, 2 * tick, 3 * tick - 1, 3 * tick] {
        settle(deployment, home, KNIGHT, settled_at);
        assert_eq!(stored(deployment, home, KNIGHT), (settled_at - built).into() * knights);
    }
}

#[test]
fn each_muster_pays_the_wheat_price_for_its_troops() {
    let (deployment, home) = frontier_realm();
    allow_armies(deployment, home);
    store_exactly(deployment, home, KNIGHT, 20 * RESOURCE_PRECISION);
    store_exactly(deployment, home, WHEAT, 20 * RESOURCE_PRECISION);
    assert!(execute(deployment, raise(home, 4, 2, 2), FIXTURE_START + 40));
    assert_eq!(stored(deployment, home, WHEAT), 12 * RESOURCE_PRECISION);
    assert!(execute(deployment, raise(home, 4, 3, 3), FIXTURE_START + 40));
    assert_eq!(stored(deployment, home, WHEAT), 4 * RESOURCE_PRECISION);
}

#[test]
fn wheat_labor_and_troops_each_fill_to_their_own_limit_and_essence_has_none() {
    let (deployment, home) = frontier_realm();
    let limit = castle_limit(0);
    assert_eq!(resources(deployment).resource_weight(home).capacity, core::num::traits::Bounded::<u128>::MAX);
    grant(deployment, home, WHEAT, 2 * limit);
    assert_eq!(stored(deployment, home, WHEAT), limit);
    // A full granary leaves every other store its whole room.
    grant(deployment, home, crate::resources::LABOR, 2 * labor_store(0));
    assert_eq!(stored(deployment, home, crate::resources::LABOR), labor_store(0));
    grant(deployment, home, KNIGHT, 2 * limit);
    assert_eq!(stored(deployment, home, KNIGHT), limit);
    grant(deployment, home, crate::resources::ESSENCE, 2 * limit);
    assert_eq!(stored(deployment, home, crate::resources::ESSENCE), 2 * limit);
}

#[test]
fn a_payout_pays_what_fits_and_never_blocks() {
    let (deployment, home) = frontier_realm();
    assert!(execute(deployment, build(home, FARM, WEST), FIXTURE_START + 40));
    let limit = labor_store(0);
    store_exactly(deployment, home, crate::resources::LABOR, limit - 10);
    assert!(execute(deployment, demolish(home, WEST), FIXTURE_START + 50));
    assert_eq!(stored(deployment, home, crate::resources::LABOR), limit);

    start_cheat_caller_address(deployment.games, deployment.games);
    let granted = resources(deployment)
        .grant_resource(
            home,
            crate::resources::LABOR,
            50,
            FIXTURE_START + 50,
            crate::commands::resource_context(super::context(deployment.games, home.game_id)),
        );
    stop_cheat_caller_address(deployment.games);
    assert_eq!(granted, 0);
}

#[test]
#[feature("safe_dispatcher")]
fn production_past_a_limit_is_gone_and_later_spending_sees_what_was_kept() {
    let (deployment, home) = frontier_realm();
    assert!(execute(deployment, build(home, BARRACKS, EAST), FIXTURE_START + 40));
    let knights = rate(deployment, home, KNIGHT);
    let limit = castle_limit(0);
    store_exactly(deployment, home, KNIGHT, limit - 15 * knights);
    settle(deployment, home, KNIGHT, FIXTURE_START + 100);
    assert_eq!(stored(deployment, home, KNIGHT), limit);

    start_cheat_caller_address(deployment.games, deployment.games);
    let refused = IResourceOperationsSafeDispatcher { contract_address: deployment.games }
        .spend_resource(
            home,
            KNIGHT,
            limit + 1,
            FIXTURE_START + 100,
            crate::commands::resource_context(super::context(deployment.games, home.game_id)),
        );
    stop_cheat_caller_address(deployment.games);
    assert!(refused.is_err());
    spend(deployment, home, KNIGHT, 40 * knights, FIXTURE_START + 100);
    settle(deployment, home, KNIGHT, FIXTURE_START + 125);
    assert_eq!(stored(deployment, home, KNIGHT), limit - 15 * knights);
}

#[test]
fn a_level_up_settles_production_under_the_old_limits_before_raising_them() {
    let (deployment, home) = frontier_realm();
    assert!(execute(deployment, build(home, BARRACKS, EAST), FIXTURE_START + 40));
    let knights = rate(deployment, home, KNIGHT);
    store_exactly(deployment, home, KNIGHT, castle_limit(0) - 15 * knights);
    for cost in crate::logic::upgrades::recipe(1).costs {
        grant(deployment, home, *cost.resource_type, *cost.amount);
    }
    assert!(execute(deployment, Command::LevelUp(home.entity_id), FIXTURE_START + 100));
    settle(deployment, home, KNIGHT, FIXTURE_START + 100);
    assert_eq!(stored(deployment, home, KNIGHT), castle_limit(0));
    settle(deployment, home, KNIGHT, FIXTURE_START + 130);
    assert_eq!(stored(deployment, home, KNIGHT), castle_limit(0) + 30 * knights);
    assert!(castle_limit(1) > castle_limit(0) + 30 * knights);
}

#[test]
fn a_changed_rate_applies_only_after_production_settles_at_the_old_one() {
    let (deployment, home) = frontier_realm();
    assert!(execute(deployment, build(home, BARRACKS, EAST), FIXTURE_START + 40));
    let one = rate(deployment, home, KNIGHT);
    assert!(execute(deployment, build(home, BARRACKS, WEST), FIXTURE_START + 100));
    let two = rate(deployment, home, KNIGHT);
    assert!(two > one);
    // Each rate change settles all elapsed seconds at the previous rate.
    settle(deployment, home, KNIGHT, FIXTURE_START + 130);
    assert_eq!(stored(deployment, home, KNIGHT), 60 * one + 30 * two);

    assert!(execute(deployment, demolish(home, WEST), FIXTURE_START + 150));
    assert_eq!(rate(deployment, home, KNIGHT), one);
    settle(deployment, home, KNIGHT, FIXTURE_START + 190);
    assert_eq!(stored(deployment, home, KNIGHT), 60 * one + 50 * two + 40 * one);
}

#[test]
fn a_city_builds_lodges_and_deploys_their_scout_stock_at_two_wheat_each() {
    let (d, home) = frontier_realm();
    allow_armies(d, home);
    let lodge = build(home, crate::research::SCOUTS_LODGE, EAST);
    let before = super::resource_commands::resource_facts(d, home);
    assert_terminal_rejection(d, lodge, FIXTURE_START + 40);
    assert_eq!(super::resource_commands::resource_facts(d, home), before);
    super::building_commands::level_up(d, home, FIXTURE_START + 40);
    assert!(execute(d, lodge, FIXTURE_START + 40));
    grant(d, home, 32, 600 * RESOURCE_PRECISION);
    store_exactly(d, home, WHEAT, 1000 * RESOURCE_PRECISION);
    let knights = stored(d, home, KNIGHT);
    assert!(
        execute(
            d,
            Command::CreateExplorer(
                CreateExplorer {
                    slot: 2,
                    structure_id: home.entity_id,
                    category: 1,
                    tier: 0,
                    amount: 400 * RESOURCE_PRECISION,
                    direction: 2,
                },
            ),
            FIXTURE_START + 40,
        ),
    );
    assert_eq!(stored(d, home, 32), 200 * RESOURCE_PRECISION);
    assert_eq!(stored(d, home, WHEAT), 200 * RESOURCE_PRECISION);
    assert_eq!(stored(d, home, KNIGHT), knights);
    let id = newest_army(d, home);
    let army = super::state::GameState { contract_address: d.games }
        .resolved_explorer(crate::troops::ExplorerKey { game_id: home.game_id, explorer_id: id })
        .unwrap();
    assert_eq!(army.troops.category, crate::troops::TroopType::Paladin);
    assert_eq!(army.troops.count, 400 * RESOURCE_PRECISION);
}

#[test]
fn range_produces_deployable_crossbows_and_depot_prices_deployment_and_reinforcement_at_each_tier() {
    let (d, home) = frontier_realm();
    allow_armies(d, home);
    grant(d, home, crate::resources::ESSENCE, 1000000 * RESOURCE_PRECISION);
    grant(d, home, WHEAT, 10000 * RESOURCE_PRECISION);
    grant(d, home, 29, 30 * RESOURCE_PRECISION);
    super::building_commands::level_up(d, home, FIXTURE_START + 40);
    assert!(execute(d, build(home, crate::research::RANGE, WEST), FIXTURE_START + 40));
    super::building_commands::level_up(d, home, FIXTURE_START + 40);
    grant(d, home, crate::resources::LABOR, 100000 * RESOURCE_PRECISION);
    let crossbows = rate(d, home, 29);
    let mut army = 0_u64;
    for tier in 0_u8..6 {
        if tier == 1 {
            assert!(execute(d, build(home, crate::research::RATIONS_DEPOT, 2), FIXTURE_START + 100));
        } else if tier > 1 {
            assert!(
                execute(
                    d, super::building_commands::research(home, crate::research::ROW_RATIONS), FIXTURE_START + 100,
                ),
            );
        }
        let before = stored(d, home, WHEAT);
        if tier == 0 {
            assert!(
                execute(
                    d,
                    Command::CreateExplorer(
                        CreateExplorer {
                            slot: 2,
                            structure_id: home.entity_id,
                            category: 2,
                            tier: 0,
                            amount: 5 * RESOURCE_PRECISION,
                            direction: 2,
                        },
                    ),
                    FIXTURE_START + 100,
                ),
            );
            army = newest_army(d, home);
        } else {
            assert!(execute(d, reinforce(army, 5), FIXTURE_START + 100));
        }
        assert_eq!(before - stored(d, home, WHEAT), (10 - Into::<u8, u128>::into(tier)) * RESOURCE_PRECISION);
        assert_eq!(
            stored(d, home, 29), (30 - 5 * (Into::<u8, u128>::into(tier) + 1)) * RESOURCE_PRECISION + 60 * crossbows,
        );
    }
}

fn newest_army(d: super::Deployment, home: crate::resources::ResourceKey) -> u64 {
    let armies = IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home);
    *armies.at(armies.len() - 1)
}
